"""
Gemini AI Referee for evaluating challenges.

This module handles all AI-powered challenge evaluation logic for both
GitHub (coding) and Notion (studying) challenges.

Quota strategy: each Gemini model has its OWN per-day free-tier bucket, so when
the primary runs dry we transparently fall back to lighter models that still
have headroom. Within each model we also retry transient 429s, respecting the
`retry_delay` the API hands us.
"""

import asyncio
import json
import logging
import re
from typing import Optional

import google.generativeai as genai
from google.api_core.exceptions import GoogleAPICallError, ResourceExhausted

from app.core.config import settings

logger = logging.getLogger(__name__)


# Ordered fallback chain: try the primary model first; on quota errors, walk
# down to lighter siblings that have their own separate free-tier allowances.
# `settings.GEMINI_MODEL` is the first attempt — anything else after dedupes.
def _build_model_chain(primary: str) -> list[str]:
    fallbacks = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite"]
    seen: set[str] = set()
    chain: list[str] = []
    for name in [primary, *fallbacks]:
        if name and name not in seen:
            seen.add(name)
            chain.append(name)
    return chain


_MAX_ATTEMPTS_PER_MODEL = 2          # retry transient 429s within a model
_FALLBACK_RETRY_DELAY_SECONDS = 5.0  # used if the API doesn't suggest one


class GeminiQuotaExhausted(Exception):
    """All models in the fallback chain are quota-exhausted / rate-limited."""


def _extract_retry_delay(exc: ResourceExhausted) -> Optional[float]:
    """
    Pull the suggested retry delay (seconds) out of a 429 error.

    Gemini's `ResourceExhausted` includes a `RetryInfo` proto in `details()`
    with a `retry_delay` Duration; if for any reason that's missing we fall
    back to parsing the human-readable "Please retry in X.Ys" line.
    """
    try:
        for detail in exc.details():
            retry_info = getattr(detail, "retry_delay", None)
            if retry_info is not None:
                return retry_info.seconds + retry_info.nanos / 1e9
    except Exception:
        pass

    match = re.search(r"retry in ([\d.]+)s", str(exc), re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


# Base rules shared by all referee prompts (DRY)
_BASE_RULES = """RULES:
1. TOPIC RELEVANCE IS MANDATORY - Content MUST be relevant to the challenge prompt.
   Off-topic content (even if high quality/volume) should be scored less.
   Example: If challenge is "study for math exam", notes about cooking recipes = 0 points.
2. Be fair and objective - no bias toward either participant
3. Focus on the SPECIFIC challenge criteria, not general productivity
4. Quality matters more than quantity unless quantity is explicitly requested
5. Provide clear, concise reasoning for your decision
6. If it's genuinely too close to call, declare a tie

OUTPUT FORMAT (JSON):
{
    "winner": "creator" | "opponent" | "tie",
    "creator_verdict": "2-3 sentences speaking directly to the creator using 'you'. Explain what they did well or poorly and why they won/lost.",
    "opponent_verdict": "2-3 sentences speaking directly to the opponent using 'you'. Explain what they did well or poorly and why they won/lost.",
    "creator_summary": "Brief factual summary of creator's relevant activity",
    "opponent_summary": "Brief factual summary of opponent's relevant activity"
}

IMPORTANT FOR VERDICTS:
- Each verdict should speak directly to that user in second person ("You...")
- Be encouraging but honest
- If a user had off-topic content, explicitly mention this
- Examples:
  - Winner: "You won! Your detailed implementation notes on the API design clearly demonstrated deep understanding..."
  - Loser: "You lost this challenge. While you created content, it was about trip planning which wasn't relevant to the coding challenge..."
  - Tie: "This challenge ended in a tie. Both you and your opponent produced similar quality work..."
"""

# GitHub coding challenges
CODING_REFEREE_PROMPT = f"""You are an impartial AI referee for Rival, a productivity challenge app.

Your job is to evaluate GitHub activity and determine who better fulfilled the challenge criteria.

{_BASE_RULES}"""

# Notion studying challenges
STUDYING_REFEREE_PROMPT = f"""You are an impartial AI referee for Rival, a productivity challenge app.

Your job is to evaluate Notion study notes and determine who studied more effectively.

CRITICAL FIRST CHECK - TOPIC RELEVANCE:
Before evaluating quality or volume, you MUST verify the content matches the challenge criteria.
- If a user's notes are about a DIFFERENT TOPIC than the challenge specifies, they get ZERO credit.
- Example: Challenge is "write implementation plan for coding project" but user wrote travel itinerary = ZERO points
- Example: Challenge is "study machine learning" but user wrote meeting notes = ZERO points
A participant with minimal relevant content beats a participant with extensive off-topic content.

EVALUATION CRITERIA (only for relevant content):
1. Topic relevance - Does the content match what the challenge asked for? (MANDATORY)
2. Depth of content - Are concepts explained thoroughly?
3. Organization - Are notes well-structured with headings, lists, and sections?
4. Volume - How much relevant content was created/edited during the challenge period?
5. Quality - Are there examples, references, or detailed explanations?
6. Consistency - Was work spread across the duration or crammed?

{_BASE_RULES}"""

# Keep backwards compatibility
REFEREE_SYSTEM_PROMPT = CODING_REFEREE_PROMPT


class GeminiReferee:
    """AI Referee that evaluates challenges using Gemini, with model fallback."""

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self._model_chain = _build_model_chain(settings.GEMINI_MODEL)

    async def _evaluate(self, system_prompt: str, user_prompt: str) -> dict:
        """
        Call Gemini with one prompt, walking the fallback chain on quota errors.

        For each model: try up to `_MAX_ATTEMPTS_PER_MODEL` times, sleeping the
        delay the API requests between tries. If still rate-limited, drop to
        the next (lighter) model — it has its own daily quota bucket.

        Raises `GeminiQuotaExhausted` only when every model in the chain has
        been rate-limited. Other errors (auth, bad request, etc.) are not
        swallowed — they bubble up unchanged.
        """
        last_error: Optional[Exception] = None
        generation_config = {"response_mime_type": "application/json"}

        for model_name in self._model_chain:
            model = genai.GenerativeModel(model_name)

            for attempt in range(1, _MAX_ATTEMPTS_PER_MODEL + 1):
                try:
                    response = await model.generate_content_async(
                        [system_prompt, user_prompt],
                        generation_config=generation_config,
                    )
                    if model_name != self._model_chain[0]:
                        logger.info("Gemini evaluation succeeded on fallback model %s", model_name)
                    return json.loads(response.text)

                except ResourceExhausted as e:
                    last_error = e
                    is_last_attempt = attempt == _MAX_ATTEMPTS_PER_MODEL
                    if is_last_attempt:
                        logger.warning(
                            "Gemini %s exhausted after %d attempts; falling back",
                            model_name, attempt,
                        )
                        break  # move to next model in chain
                    delay = _extract_retry_delay(e) or _FALLBACK_RETRY_DELAY_SECONDS
                    logger.warning(
                        "Gemini %s rate-limited (attempt %d/%d); retrying in %.1fs",
                        model_name, attempt, _MAX_ATTEMPTS_PER_MODEL, delay,
                    )
                    await asyncio.sleep(delay)

                except GoogleAPICallError:
                    # Non-quota Google error (auth, invalid arg, etc.) — don't
                    # retry, don't fall back: this is unlikely to fix itself.
                    raise

        raise GeminiQuotaExhausted(
            "All Gemini models are rate-limited or out of free-tier quota. "
            "Try again in a few minutes or set GEMINI_MODEL to another model. "
            f"Last error: {last_error}"
        )

    async def evaluate_challenge(
        self,
        challenge_prompt: str,
        creator_activity: dict,
        opponent_activity: dict,
        creator_username: str,
        opponent_username: str,
    ) -> dict:
        """
        Evaluate a GitHub coding challenge.

        Returns:
            dict with keys: winner, verdict, creator_summary, opponent_summary
        """
        user_prompt = f"""
CHALLENGE CRITERIA: "{challenge_prompt}"

=== CREATOR (@{creator_username}) ===
{self._format_github_activity(creator_activity)}

=== OPPONENT (@{opponent_username}) ===
{self._format_github_activity(opponent_activity)}

Based on the challenge criteria above, evaluate both participants and determine the winner."""

        return await self._evaluate(CODING_REFEREE_PROMPT, user_prompt)

    async def evaluate_studying_challenge(
        self,
        challenge_prompt: str,
        creator_activity: dict,
        opponent_activity: dict,
        creator_username: str,
        opponent_username: str,
    ) -> dict:
        """
        Evaluate a Notion studying challenge.

        Returns:
            dict with keys: winner, verdict, creator_summary, opponent_summary
        """
        user_prompt = f"""
CHALLENGE CRITERIA: "{challenge_prompt}"

=== CREATOR (@{creator_username}) ===
{self._format_notion_activity(creator_activity)}

=== OPPONENT (@{opponent_username}) ===
{self._format_notion_activity(opponent_activity)}

Based on the challenge criteria above, evaluate both participants' study notes and determine the winner."""

        return await self._evaluate(STUDYING_REFEREE_PROMPT, user_prompt)

    def _format_notion_activity(self, activity: dict) -> str:
        """Format Notion study activity for the AI prompt."""
        if not activity:
            return "No activity found"

        sections = []

        page_count = activity.get("page_count", 0)
        total_blocks = activity.get("total_blocks", 0)
        sections.append(f"STATS: {page_count} pages edited, {total_blocks} content blocks")

        # List pages edited
        pages = activity.get("pages_edited", [])
        if pages:
            sections.append("\nPAGES EDITED:")
            for page in pages[:10]:
                title = page.get("title", "Untitled")[:50]
                blocks = page.get("block_count", 0)
                sections.append(f"  • {title} ({blocks} blocks)")

        # Include content summary for AI to evaluate quality
        content = activity.get("content_summary", "")
        if content:
            sections.append(f"\nNOTES CONTENT:\n{content[:2000]}")

        return "\n".join(sections)

    def _format_github_activity(self, activity: dict) -> str:
        """Format GitHub activity data for the AI prompt."""
        sections = []

        # Format commits
        commits = activity.get("commits", [])
        if commits:
            sections.append(f"COMMITS ({len(commits)} total):")
            for commit in commits[:15]:  # Limit to prevent token overflow
                msg = commit.get("message", "").split("\n")[0][:80]  # First line, truncated
                additions = commit.get("additions", 0)
                deletions = commit.get("deletions", 0)
                sections.append(f"  • {msg} (+{additions}/-{deletions})")

        # Format pull requests
        prs = activity.get("pull_requests", [])
        if prs:
            sections.append(f"\nPULL REQUESTS ({len(prs)} total):")
            for pr in prs[:10]:
                title = pr.get("title", "")[:60]
                state = pr.get("state", "unknown")
                merged = " [MERGED]" if pr.get("merged") else ""
                additions = pr.get("additions", 0)
                deletions = pr.get("deletions", 0)
                sections.append(f"  • {title} ({state}{merged}) +{additions}/-{deletions}")

        # Format issues
        issues = activity.get("issues", [])
        if issues:
            sections.append(f"\nISSUES ({len(issues)} total):")
            for issue in issues[:5]:
                title = issue.get("title", "")[:60]
                state = issue.get("state", "unknown")
                sections.append(f"  • {title} ({state})")

        # Summary stats
        total_additions = sum(c.get("additions", 0) for c in commits)
        total_deletions = sum(c.get("deletions", 0) for c in commits)
        sections.append(f"\nSUMMARY: {len(commits)} commits, {len(prs)} PRs, {len(issues)} issues")
        sections.append(f"Total lines: +{total_additions}/-{total_deletions}")

        return "\n".join(sections) if sections else "No activity found"


def get_referee() -> Optional[GeminiReferee]:
    """Factory function to get a GeminiReferee instance."""
    if not settings.GEMINI_API_KEY:
        return None
    return GeminiReferee()
