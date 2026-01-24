import httpx
from datetime import datetime, timezone
from typing import Optional

GITHUB_API_BASE = "https://api.github.com"


class GitHubClient:
    """Client for interacting with GitHub API."""

    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def get_user(self) -> dict:
        """Get the authenticated user's profile."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/user",
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()

    async def get_commits_count(self, username: str, since: datetime) -> int:
        """
        Count commits made by the user since a given datetime.
        Uses the Events API to track PushEvents.
        """
        total_commits = 0
        page = 1

        async with httpx.AsyncClient() as client:
            while True:
                response = await client.get(
                    f"{GITHUB_API_BASE}/users/{username}/events",
                    headers=self.headers,
                    params={"per_page": 100, "page": page},
                )
                response.raise_for_status()
                events = response.json()

                if not events:
                    break

                for event in events:
                    # Parse event timestamp
                    event_time = datetime.fromisoformat(
                        event["created_at"].replace("Z", "+00:00")
                    )

                    # Skip events before our time window
                    if event_time < since:
                        return total_commits

                    # Count commits from PushEvents
                    if event["type"] == "PushEvent":
                        commits = event.get("payload", {}).get("commits", [])
                        total_commits += len(commits)

                page += 1

                # GitHub API limits to 10 pages (300 events)
                if page > 10:
                    break

        return total_commits

    async def get_repos(self) -> list[dict]:
        """Get the authenticated user's repositories."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/user/repos",
                headers=self.headers,
                params={"per_page": 100, "sort": "pushed"},
            )
            response.raise_for_status()
            return response.json()


async def exchange_code_for_token(
    client_id: str,
    client_secret: str,
    code: str,
) -> dict:
    """Exchange OAuth code for access token."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        return response.json()
