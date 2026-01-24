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
        Uses the Search API to find commits by the user.
        """
        # Format date for GitHub search API
        since_str = since.strftime("%Y-%m-%dT%H:%M:%SZ")

        total_commits = 0
        page = 1

        async with httpx.AsyncClient() as client:
            # First, get user's repos that were recently pushed to
            repos_response = await client.get(
                f"{GITHUB_API_BASE}/user/repos",
                headers=self.headers,
                params={"per_page": 100, "sort": "pushed", "direction": "desc"},
            )
            repos_response.raise_for_status()
            repos = repos_response.json()

            # Check commits in each repo
            for repo in repos[:20]:  # Limit to 20 most recently pushed repos
                repo_name = repo["full_name"]

                try:
                    commits_response = await client.get(
                        f"{GITHUB_API_BASE}/repos/{repo_name}/commits",
                        headers=self.headers,
                        params={
                            "author": username,
                            "since": since_str,
                            "per_page": 100,
                        },
                    )

                    if commits_response.status_code == 200:
                        commits = commits_response.json()
                        total_commits += len(commits)
                except Exception:
                    # Skip repos we can't access
                    continue

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
