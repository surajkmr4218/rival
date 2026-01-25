"""
Gemini AI Referee for evaluating challenges.

This module handles all AI-powered challenge evaluation logic for both
GitHub (coding) and Notion (studying) challenges.
"""

import json
import google.generativeai as genai
from typing import Optional
from app.core.config import settings


# Base rules shared by all referee prompts (DRY)
_BASE_RULES = """RULES:
1. Be fair and objective - no bias toward either participant
2. Focus on the SPECIFIC challenge criteria, not general productivity
3. Quality matters more than quantity unless quantity is explicitly requested
4. Provide clear, concise reasoning for your decision
5. If it's genuinely too close to call, declare a tie

OUTPUT FORMAT (JSON):
{
    "winner": "creator" | "opponent" | "tie",
    "verdict": "2-3 sentence explanation of your decision",
    "creator_summary": "Brief summary of creator's relevant activity",
    "opponent_summary": "Brief summary of opponent's relevant activity"
}"""

# GitHub coding challenges
CODING_REFEREE_PROMPT = f"""You are an impartial AI referee for Rival, a productivity challenge app.

Your job is to evaluate GitHub activity and determine who better fulfilled the challenge criteria.

{_BASE_RULES}"""

# Notion studying challenges
STUDYING_REFEREE_PROMPT = f"""You are an impartial AI referee for Rival, a productivity challenge app.

Your job is to evaluate Notion study notes and determine who studied more effectively.

EVALUATION CRITERIA:
1. Depth of content - Are concepts explained thoroughly?
2. Organization - Are notes well-structured with headings, lists, and sections?
3. Volume - How much content was created/edited during the challenge period?
4. Quality - Are there examples, references, or detailed explanations?
5. Consistency - Was work spread across the duration or crammed?

{_BASE_RULES}"""

# Keep backwards compatibility
REFEREE_SYSTEM_PROMPT = CODING_REFEREE_PROMPT


class GeminiReferee:
    """AI Referee that evaluates challenges using Gemini."""

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel("gemini-2.0-flash")

    async def _evaluate(self, system_prompt: str, user_prompt: str) -> dict:
        """Common evaluation logic - generates content and parses JSON response."""
        response = await self.model.generate_content_async(
            [system_prompt, user_prompt],
            generation_config={"response_mime_type": "application/json"},
        )
        return json.loads(response.text)

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
