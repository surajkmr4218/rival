import httpx
from datetime import datetime, timezone
from typing import Optional

GITHUB_API_BASE = "https://api.github.com"
DEFAULT_TIMEOUT = 30.0

# Cap how many of the user's most-recently-pushed repos we crawl. Keeps
# Gemini's prompt small enough for the free tier (was hitting "Quota exceeded
# for metric"), and limits GitHub API calls so we don't trip rate limits either.
MAX_REPOS_PER_FETCH = 5


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
            for repo in repos[:MAX_REPOS_PER_FETCH]:
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
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/user/repos",
                headers=self.headers,
                params={"per_page": 100, "sort": "pushed"},
            )
            response.raise_for_status()
            return response.json()

    async def get_user_activity(self, username: str, since: datetime) -> dict:
        """
        Fetch comprehensive GitHub activity for AI evaluation.

        Returns:
            {
                "commits": [{"message", "additions", "deletions", "date", "repo"}, ...],
                "pull_requests": [{"title", "state", "merged", "additions", "deletions"}, ...],
                "issues": [{"title", "state", "created_at"}, ...],
            }
        """
        since_str = since.strftime("%Y-%m-%dT%H:%M:%SZ")

        activity = {
            "commits": [],
            "pull_requests": [],
            "issues": [],
        }

        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            # Get user's repos (sorted by recent activity)
            repos = await self._fetch_user_repos(client)

            # Fetch activity from each repo — capped so Gemini's prompt stays
            # under the free-tier token limit and GitHub doesn't rate-limit us.
            for repo in repos[:MAX_REPOS_PER_FETCH]:
                repo_name = repo["full_name"]

                # Get commits with details
                commits = await self._fetch_repo_commits(client, repo_name, username, since_str)
                activity["commits"].extend(commits)

                # Get pull requests
                prs = await self._fetch_repo_prs(client, repo_name, username, since_str)
                activity["pull_requests"].extend(prs)

            # Get issues (uses search API, not per-repo)
            issues = await self._fetch_user_issues(client, username, since_str)
            activity["issues"] = issues

        return activity

    async def _fetch_user_repos(self, client: httpx.AsyncClient) -> list[dict]:
        """Fetch user's repositories sorted by push date."""
        response = await client.get(
            f"{GITHUB_API_BASE}/user/repos",
            headers=self.headers,
            params={"per_page": 100, "sort": "pushed", "direction": "desc"},
        )
        if response.status_code != 200:
            return []
        return response.json()

    async def _fetch_repo_commits(
        self,
        client: httpx.AsyncClient,
        repo: str,
        author: str,
        since: str,
    ) -> list[dict]:
        """Fetch commits from a repo with full details."""
        # First get commit list
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{repo}/commits",
            headers=self.headers,
            params={"author": author, "since": since, "per_page": 50},
        )

        if response.status_code != 200:
            return []

        commits = []
        for commit_ref in response.json()[:10]:  # Limit per repo
            # Fetch full commit details for stats
            detail = await self._fetch_commit_detail(client, commit_ref["url"])
            if detail:
                commits.append(detail)

        return commits

    async def _fetch_commit_detail(self, client: httpx.AsyncClient, url: str) -> Optional[dict]:
        """Fetch full commit details including additions/deletions."""
        response = await client.get(url, headers=self.headers)
        if response.status_code != 200:
            return None

        data = response.json()
        stats = data.get("stats", {})

        return {
            "sha": data["sha"][:7],
            "message": data["commit"]["message"],
            "additions": stats.get("additions", 0),
            "deletions": stats.get("deletions", 0),
            "date": data["commit"]["author"]["date"],
            "repo": data["html_url"].split("/commit/")[0].split("github.com/")[1],
        }

    async def _fetch_repo_prs(
        self,
        client: httpx.AsyncClient,
        repo: str,
        author: str,
        since: str,
    ) -> list[dict]:
        """Fetch pull requests from a repo by the user."""
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{repo}/pulls",
            headers=self.headers,
            params={"state": "all", "per_page": 30, "sort": "created", "direction": "desc"},
        )

        if response.status_code != 200:
            return []

        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        prs = []

        for pr in response.json():
            # Filter by author and date
            if pr["user"]["login"].lower() != author.lower():
                continue

            created_at = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
            if created_at < since_dt:
                continue

            # Fetch PR details for additions/deletions
            pr_detail = await self._fetch_pr_detail(client, pr["url"])

            prs.append({
                "number": pr["number"],
                "title": pr["title"],
                "state": pr["state"],
                "merged": pr.get("merged_at") is not None,
                "additions": pr_detail.get("additions", 0) if pr_detail else 0,
                "deletions": pr_detail.get("deletions", 0) if pr_detail else 0,
                "created_at": pr["created_at"],
                "repo": repo,
            })

        return prs

    async def _fetch_pr_detail(self, client: httpx.AsyncClient, url: str) -> Optional[dict]:
        """Fetch PR details for additions/deletions."""
        response = await client.get(url, headers=self.headers)
        if response.status_code != 200:
            return None
        data = response.json()
        return {
            "additions": data.get("additions", 0),
            "deletions": data.get("deletions", 0),
        }

    async def _fetch_user_issues(
        self,
        client: httpx.AsyncClient,
        username: str,
        since: str,
    ) -> list[dict]:
        """Fetch issues created by user using search API."""
        # Format date for search query (YYYY-MM-DD)
        date_str = since[:10]

        response = await client.get(
            f"{GITHUB_API_BASE}/search/issues",
            headers=self.headers,
            params={
                "q": f"author:{username} type:issue created:>={date_str}",
                "per_page": 30,
                "sort": "created",
            },
        )

        if response.status_code != 200:
            return []

        items = response.json().get("items", [])
        return [
            {
                "title": issue["title"],
                "state": issue["state"],
                "created_at": issue["created_at"],
                "repo": issue["repository_url"].split("/repos/")[1],
            }
            for issue in items
        ]


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
