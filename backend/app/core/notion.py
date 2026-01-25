"""
Notion API client for tracking study activity.

Follows the same async pattern as GitHubClient for consistency.
"""

import httpx
from datetime import datetime
from typing import Optional

from app.core.config import settings

NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_API_VERSION = "2022-06-28"
DEFAULT_TIMEOUT = 30.0


class NotionClient:
    """Async client for Notion API."""

    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Notion-Version": NOTION_API_VERSION,
            "Content-Type": "application/json",
        }

    async def get_user(self) -> dict:
        """Get the authenticated user's info."""
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.get(
                f"{NOTION_API_BASE}/users/me",
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()

    async def search_pages(self, query: str = "") -> list[dict]:
        """Search for pages the user has access to."""
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.post(
                f"{NOTION_API_BASE}/search",
                headers=self.headers,
                json={
                    "query": query,
                    "filter": {"property": "object", "value": "page"},
                    "sort": {"direction": "descending", "timestamp": "last_edited_time"},
                },
            )
            response.raise_for_status()
            return response.json().get("results", [])

    async def get_page(self, page_id: str) -> dict:
        """Get a specific page by ID."""
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.get(
                f"{NOTION_API_BASE}/pages/{page_id}",
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()

    async def get_page_content(self, page_id: str) -> list[dict]:
        """Get all blocks (content) from a page with pagination."""
        blocks = []
        cursor = None

        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            while True:
                params = {"page_size": 100}
                if cursor:
                    params["start_cursor"] = cursor

                response = await client.get(
                    f"{NOTION_API_BASE}/blocks/{page_id}/children",
                    headers=self.headers,
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                blocks.extend(data.get("results", []))

                if not data.get("has_more"):
                    break
                cursor = data.get("next_cursor")

        return blocks

    async def get_child_pages(self, page_id: str, depth: int = 3) -> list[dict]:
        """
        Get all child pages under a parent page (recursive with depth limit).

        Args:
            page_id: The parent page ID
            depth: Maximum recursion depth to prevent infinite loops
        """
        if depth <= 0:
            return []

        child_pages = []
        blocks = await self.get_page_content(page_id)

        for block in blocks:
            if block.get("type") == "child_page":
                child_page_id = block.get("id")
                try:
                    child_page = await self.get_page(child_page_id)
                    child_pages.append(child_page)

                    # Recursively get grandchildren
                    grandchildren = await self.get_child_pages(child_page_id, depth - 1)
                    child_pages.extend(grandchildren)
                except Exception:
                    # Skip pages we can't access
                    continue

        return child_pages

    async def get_study_activity(self, root_page_id: str, since: datetime) -> dict:
        """
        Get comprehensive study activity from a root page and all children.

        Returns:
            {
                "pages_edited": [{"id", "title", "last_edited", "block_count"}, ...],
                "total_blocks": int,
                "page_count": int,
                "content_summary": str (for AI evaluation),
            }
        """
        # Collect all pages under root
        all_pages = []
        try:
            root_page = await self.get_page(root_page_id)
            all_pages.append(root_page)
        except Exception:
            return self._empty_activity()

        child_pages = await self.get_child_pages(root_page_id)
        all_pages.extend(child_pages)

        pages_edited = []
        total_blocks = 0
        content_summaries = []

        for page in all_pages:
            if self._was_edited_since(page, since):
                title = self._extract_page_title(page)

                try:
                    blocks = await self.get_page_content(page["id"])
                    block_count = len(blocks)
                    total_blocks += block_count

                    text_content = self._extract_text_from_blocks(blocks)

                    pages_edited.append({
                        "id": page["id"],
                        "title": title,
                        "last_edited": page.get("last_edited_time", ""),
                        "block_count": block_count,
                    })

                    if text_content:
                        content_summaries.append(f"## {title}\n{text_content}")
                except Exception:
                    continue

        return {
            "pages_edited": pages_edited,
            "total_blocks": total_blocks,
            "page_count": len(pages_edited),
            "content_summary": "\n\n".join(content_summaries[:10]),  # Limit for AI context
        }

    def _empty_activity(self) -> dict:
        """Return empty activity structure."""
        return {
            "pages_edited": [],
            "total_blocks": 0,
            "page_count": 0,
            "content_summary": "",
        }

    def _was_edited_since(self, page: dict, since: datetime) -> bool:
        """Check if page was edited after the given datetime."""
        last_edited = page.get("last_edited_time", "")
        if not last_edited:
            return False

        try:
            edited_dt = datetime.fromisoformat(last_edited.replace("Z", "+00:00"))
            since_tz = since.replace(tzinfo=edited_dt.tzinfo) if since.tzinfo is None else since
            return edited_dt >= since_tz
        except Exception:
            return False

    def _extract_page_title(self, page: dict) -> str:
        """Extract title from a Notion page object."""
        props = page.get("properties", {})

        # Try common title property names
        for key in ["title", "Title", "Name", "name"]:
            if key in props:
                title_array = props[key].get("title", [])
                if title_array:
                    return title_array[0].get("plain_text", "Untitled")

        return "Untitled"

    def _extract_text_from_blocks(self, blocks: list[dict], max_length: int = 3000) -> str:
        """Extract plain text from Notion blocks for AI evaluation."""
        texts = []
        current_length = 0

        for block in blocks:
            if current_length >= max_length:
                break

            block_type = block.get("type", "")
            block_data = block.get(block_type, {})

            # Handle rich_text blocks (paragraph, heading, bulleted_list, etc.)
            rich_text = block_data.get("rich_text", [])
            for text_obj in rich_text:
                plain_text = text_obj.get("plain_text", "")
                if plain_text:
                    texts.append(plain_text)
                    current_length += len(plain_text)

        return " ".join(texts)[:max_length]


async def exchange_code_for_token(code: str, redirect_uri: str) -> dict:
    """Exchange OAuth code for access token."""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.post(
            "https://api.notion.com/v1/oauth/token",
            auth=(settings.NOTION_CLIENT_ID, settings.NOTION_CLIENT_SECRET),
            json={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        response.raise_for_status()
        return response.json()
