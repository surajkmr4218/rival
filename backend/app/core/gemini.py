"""
Gemini AI Referee for evaluating coding challenges.

This module handles all AI-powered challenge evaluation logic.
"""

import json
import google.generativeai as genai
from typing import Optional
from app.core.config import settings


# System prompt that defines the AI referee's behavior
REFEREE_SYSTEM_PROMPT = """You are an impartial AI referee for Rival, a productivity challenge app.

Your job is to evaluate GitHub activity and determine who better fulfilled the challenge criteria.

RULES:
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


class GeminiReferee:
    """AI Referee that evaluates GitHub challenges using Gemini."""

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel("gemini-1.5-flash")

    async def evaluate_challenge(
        self,
        challenge_prompt: str,
        creator_activity: dict,
        opponent_activity: dict,
        creator_username: str,
        opponent_username: str,
    ) -> dict:
        """
        Evaluate a challenge and determine the winner.

        Args:
            challenge_prompt: The user-defined challenge criteria
            creator_activity: GitHub activity data for challenge creator
            opponent_activity: GitHub activity data for opponent
            creator_username: GitHub username of creator
            opponent_username: GitHub username of opponent

        Returns:
            dict with keys: winner, verdict, creator_summary, opponent_summary
        """
        user_prompt = self._build_evaluation_prompt(
            challenge_prompt,
            creator_activity,
            opponent_activity,
            creator_username,
            opponent_username,
        )

        response = await self.model.generate_content_async(
            [REFEREE_SYSTEM_PROMPT, user_prompt],
            generation_config={"response_mime_type": "application/json"},
        )

        return json.loads(response.text)

    def _build_evaluation_prompt(
        self,
        challenge_prompt: str,
        creator_activity: dict,
        opponent_activity: dict,
        creator_username: str,
        opponent_username: str,
    ) -> str:
        """Build the evaluation prompt with all activity data."""
        return f"""
CHALLENGE CRITERIA: "{challenge_prompt}"

=== CREATOR (@{creator_username}) ===
{self._format_activity(creator_activity)}

=== OPPONENT (@{opponent_username}) ===
{self._format_activity(opponent_activity)}

Based on the challenge criteria above, evaluate both participants and determine the winner."""

    def _format_activity(self, activity: dict) -> str:
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
