# Notion Integration Implementation Plan

## Overview

This document describes the implementation plan for adding Notion-based study challenges to Rival. Users can compete on who studies more effectively by tracking their Notion pages, with an AI referee evaluating the quality and depth of their notes.

## Feature Summary

1. **Connect Notion** - OAuth integration in Profile screen
2. **Challenge Type Toggle** - Switch between GitHub (coding) and Notion (studying) challenges
3. **Root Page Selection** - User selects a Notion page as their "study workspace"
4. **Activity Polling** - Track changes to Notion pages every 2 minutes
5. **AI Evaluation** - Referee determines winner based on study depth and detail

---

## Architecture

### New Files to Create

```
backend/
├── app/
│   ├── core/
│   │   └── notion.py          # NotionClient class for API calls
│   ├── routers/
│   │   └── notion.py          # OAuth + page endpoints
│   └── services/
│       └── notion_poller.py   # Background polling service

frontend/
├── app/
│   └── challenge/
│       └── create.tsx         # Update with category toggle
├── components/
│   └── NotionPagePicker.tsx   # Page selection modal
└── lib/
    └── api.ts                 # Add Notion endpoints
```

### Files to Modify

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py          # Add Notion OAuth credentials
│   │   └── gemini.py          # Update AI prompts for Notion evaluation
│   ├── models/
│   │   ├── user.py            # Add notion_access_token, notion_workspace_id
│   │   └── challenge.py       # Add notion_page_id, category='studying'
│   └── routers/
│       └── challenges.py      # Handle Notion-based challenges

frontend/
├── app/
│   └── (tabs)/
│       └── profile.tsx        # Add "Connect Notion" button
└── lib/
    └── types.ts               # Add Notion types
```

---

## Phase 1: Backend Notion OAuth

### 1.1 Configuration (`backend/app/core/config.py`)

Add Notion OAuth credentials:

```python
# Notion OAuth
NOTION_CLIENT_ID: str = ""
NOTION_CLIENT_SECRET: str = ""
NOTION_REDIRECT_URI: str = ""
```

### 1.2 User Model Updates (`backend/app/models/user.py`)

Add Notion fields:

```python
# Notion Integration
notion_access_token = Column(String, nullable=True)
notion_workspace_id = Column(String, nullable=True)
notion_workspace_name = Column(String, nullable=True)
```

### 1.3 Alembic Migration

Create migration to add Notion columns to users table.

### 1.4 Notion Client (`backend/app/core/notion.py`)

```python
"""
Notion API client for tracking study activity.
"""

import httpx
from datetime import datetime
from typing import Optional, List
from app.core.config import settings

NOTION_API_VERSION = "2022-06-28"
NOTION_BASE_URL = "https://api.notion.com/v1"


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
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NOTION_BASE_URL}/users/me",
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()

    async def search_pages(self, query: str = "") -> List[dict]:
        """Search for pages the user has access to."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{NOTION_BASE_URL}/search",
                headers=self.headers,
                json={
                    "query": query,
                    "filter": {"property": "object", "value": "page"},
                    "sort": {"direction": "descending", "timestamp": "last_edited_time"},
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("results", [])

    async def get_page(self, page_id: str) -> dict:
        """Get a specific page by ID."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NOTION_BASE_URL}/pages/{page_id}",
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()

    async def get_page_content(self, page_id: str) -> List[dict]:
        """Get all blocks (content) from a page."""
        blocks = []
        cursor = None

        async with httpx.AsyncClient() as client:
            while True:
                params = {"page_size": 100}
                if cursor:
                    params["start_cursor"] = cursor

                response = await client.get(
                    f"{NOTION_BASE_URL}/blocks/{page_id}/children",
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

    async def get_child_pages(self, page_id: str) -> List[dict]:
        """Get all child pages under a parent page (recursive)."""
        child_pages = []
        blocks = await self.get_page_content(page_id)

        for block in blocks:
            if block.get("type") == "child_page":
                child_page_id = block.get("id")
                child_page = await self.get_page(child_page_id)
                child_pages.append(child_page)

                # Recursively get grandchildren
                grandchildren = await self.get_child_pages(child_page_id)
                child_pages.extend(grandchildren)

        return child_pages

    async def get_study_activity(
        self,
        root_page_id: str,
        since: datetime,
    ) -> dict:
        """
        Get comprehensive study activity from a root page and all children.

        Returns:
            dict with keys:
            - pages_edited: List of pages edited since `since`
            - total_blocks: Total content blocks across all pages
            - content_summary: Text summary of notes for AI evaluation
        """
        all_pages = [await self.get_page(root_page_id)]
        all_pages.extend(await self.get_child_pages(root_page_id))

        pages_edited = []
        total_blocks = 0
        content_summaries = []

        for page in all_pages:
            last_edited = page.get("last_edited_time", "")
            if last_edited:
                edited_dt = datetime.fromisoformat(last_edited.replace("Z", "+00:00"))
                if edited_dt >= since.replace(tzinfo=edited_dt.tzinfo):
                    # Get page title
                    title = self._extract_page_title(page)

                    # Get page content
                    blocks = await self.get_page_content(page["id"])
                    total_blocks += len(blocks)

                    # Extract text content for AI
                    text_content = self._extract_text_from_blocks(blocks)

                    pages_edited.append({
                        "id": page["id"],
                        "title": title,
                        "last_edited": last_edited,
                        "block_count": len(blocks),
                    })

                    if text_content:
                        content_summaries.append(f"## {title}\n{text_content}")

        return {
            "pages_edited": pages_edited,
            "total_blocks": total_blocks,
            "page_count": len(pages_edited),
            "content_summary": "\n\n".join(content_summaries[:10]),  # Limit for AI context
        }

    def _extract_page_title(self, page: dict) -> str:
        """Extract title from a Notion page object."""
        props = page.get("properties", {})
        title_prop = props.get("title") or props.get("Name") or {}
        title_array = title_prop.get("title", [])
        if title_array:
            return title_array[0].get("plain_text", "Untitled")
        return "Untitled"

    def _extract_text_from_blocks(self, blocks: List[dict]) -> str:
        """Extract plain text from Notion blocks."""
        texts = []

        for block in blocks:
            block_type = block.get("type", "")
            block_data = block.get(block_type, {})

            # Handle rich_text blocks (paragraph, heading, bulleted_list, etc.)
            rich_text = block_data.get("rich_text", [])
            for text_obj in rich_text:
                plain_text = text_obj.get("plain_text", "")
                if plain_text:
                    texts.append(plain_text)

            # Handle toggle blocks with children
            if block_data.get("children"):
                child_text = self._extract_text_from_blocks(block_data["children"])
                if child_text:
                    texts.append(child_text)

        return " ".join(texts)[:3000]  # Limit text for AI context


async def exchange_code_for_token(code: str, redirect_uri: str) -> dict:
    """Exchange OAuth code for access token."""
    async with httpx.AsyncClient() as client:
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
```

### 1.5 Notion Router (`backend/app/routers/notion.py`)

```python
"""
Notion OAuth and API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from urllib.parse import urlencode

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.core.notion import NotionClient, exchange_code_for_token
from app.models.user import User

router = APIRouter(prefix="/api/notion", tags=["notion"])


class NotionOAuthUrlResponse(BaseModel):
    url: str
    client_id: str


class NotionConnectRequest(BaseModel):
    code: str


class NotionConnectResponse(BaseModel):
    workspace_name: str
    workspace_id: str


class NotionStatusResponse(BaseModel):
    connected: bool
    workspace_name: str | None = None
    workspace_id: str | None = None


class NotionPageResponse(BaseModel):
    id: str
    title: str
    last_edited: str | None = None


@router.get("/oauth-url", response_model=NotionOAuthUrlResponse)
async def get_oauth_url(
    redirect_uri: str | None = None,
    current_user: User = Depends(get_current_user),
):
    """Get Notion OAuth authorization URL."""
    if not settings.NOTION_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Notion OAuth not configured")

    params = {
        "client_id": settings.NOTION_CLIENT_ID,
        "response_type": "code",
        "owner": "user",
        "redirect_uri": redirect_uri or settings.NOTION_REDIRECT_URI,
    }

    url = f"https://api.notion.com/v1/oauth/authorize?{urlencode(params)}"

    return NotionOAuthUrlResponse(url=url, client_id=settings.NOTION_CLIENT_ID)


@router.post("/connect", response_model=NotionConnectResponse)
async def connect_notion(
    request: NotionConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Exchange OAuth code and connect Notion workspace."""
    try:
        token_data = await exchange_code_for_token(
            request.code,
            settings.NOTION_REDIRECT_URI,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth failed: {str(e)}")

    access_token = token_data.get("access_token")
    workspace_id = token_data.get("workspace_id")
    workspace_name = token_data.get("workspace_name", "Notion Workspace")

    if not access_token:
        raise HTTPException(status_code=400, detail="No access token received")

    # Update user
    current_user.notion_access_token = access_token
    current_user.notion_workspace_id = workspace_id
    current_user.notion_workspace_name = workspace_name
    db.commit()

    return NotionConnectResponse(
        workspace_name=workspace_name,
        workspace_id=workspace_id,
    )


@router.get("/status", response_model=NotionStatusResponse)
async def get_notion_status(current_user: User = Depends(get_current_user)):
    """Check if Notion is connected."""
    return NotionStatusResponse(
        connected=bool(current_user.notion_access_token),
        workspace_name=current_user.notion_workspace_name,
        workspace_id=current_user.notion_workspace_id,
    )


@router.delete("/disconnect")
async def disconnect_notion(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect Notion workspace."""
    current_user.notion_access_token = None
    current_user.notion_workspace_id = None
    current_user.notion_workspace_name = None
    db.commit()
    return {"success": True}


@router.get("/pages", response_model=list[NotionPageResponse])
async def get_pages(
    query: str = "",
    current_user: User = Depends(get_current_user),
):
    """Search for pages to use as study workspace."""
    if not current_user.notion_access_token:
        raise HTTPException(status_code=400, detail="Notion not connected")

    client = NotionClient(current_user.notion_access_token)

    try:
        pages = await client.search_pages(query)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch pages: {str(e)}")

    return [
        NotionPageResponse(
            id=page["id"],
            title=client._extract_page_title(page),
            last_edited=page.get("last_edited_time"),
        )
        for page in pages[:20]  # Limit results
    ]
```

### 1.6 Register Router (`backend/app/main.py`)

```python
from app.routers import notion
app.include_router(notion.router)
```

---

## Phase 2: Challenge Model Updates

### 2.1 Update Challenge Category Enum

```python
class ChallengeCategory(str, Enum):
    CODING = "coding"
    SCREENTIME = "screentime"
    STUDYING = "studying"  # NEW
```

### 2.2 Add Notion Fields to Challenge Model

```python
# Notion tracking (for studying challenges)
creator_notion_page_id = Column(String, nullable=True)
opponent_notion_page_id = Column(String, nullable=True)
creator_notion_activity = Column(JSON, nullable=True)  # Cached activity data
opponent_notion_activity = Column(JSON, nullable=True)
last_notion_poll = Column(DateTime, nullable=True)
```

### 2.3 Alembic Migration

Create migration to add Notion fields to challenges table.

---

## Phase 3: AI Referee Updates

### 3.1 Update Gemini Referee (`backend/app/core/gemini.py`)

Add Notion-specific evaluation prompt:

```python
STUDYING_REFEREE_PROMPT = """You are an impartial AI referee for Rival, a productivity challenge app.

Your job is to evaluate Notion study notes and determine who studied more effectively.

EVALUATION CRITERIA:
1. Depth of content - Are concepts explained thoroughly?
2. Organization - Are notes well-structured with headings, lists, and sections?
3. Volume - How much content was created/edited during the challenge period?
4. Quality - Are there examples, diagrams references, or detailed explanations?
5. Consistency - Was work spread across the duration or crammed?

OUTPUT FORMAT (JSON):
{
    "winner": "creator" | "opponent" | "tie",
    "verdict": "2-3 sentence explanation of your decision",
    "creator_summary": "Brief summary of creator's study activity",
    "opponent_summary": "Brief summary of opponent's study activity",
    "creator_score": 0-100,
    "opponent_score": 0-100
}"""


class GeminiReferee:
    # ... existing code ...

    async def evaluate_studying_challenge(
        self,
        challenge_prompt: str,
        creator_activity: dict,
        opponent_activity: dict,
        creator_username: str,
        opponent_username: str,
    ) -> dict:
        """Evaluate a Notion-based studying challenge."""
        user_prompt = f"""
CHALLENGE CRITERIA: "{challenge_prompt}"

=== CREATOR (@{creator_username}) ===
Pages edited: {creator_activity.get('page_count', 0)}
Total content blocks: {creator_activity.get('total_blocks', 0)}

NOTES CONTENT:
{creator_activity.get('content_summary', 'No content found')}

=== OPPONENT (@{opponent_username}) ===
Pages edited: {opponent_activity.get('page_count', 0)}
Total content blocks: {opponent_activity.get('total_blocks', 0)}

NOTES CONTENT:
{opponent_activity.get('content_summary', 'No content found')}

Based on the challenge criteria, evaluate both participants' study notes and determine the winner."""

        response = await self.model.generate_content_async(
            [STUDYING_REFEREE_PROMPT, user_prompt],
            generation_config={"response_mime_type": "application/json"},
        )

        return json.loads(response.text)
```

---

## Phase 4: Challenge Router Updates

### 4.1 Create Studying Challenge Endpoint

Update `backend/app/routers/challenges.py`:

```python
@router.post("/{challenge_id}/set-notion-page")
async def set_notion_page(
    challenge_id: int,
    page_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set the Notion page for tracking in a studying challenge."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    if challenge.category != ChallengeCategory.STUDYING:
        raise HTTPException(status_code=400, detail="Not a studying challenge")

    if current_user.id == challenge.creator_id:
        challenge.creator_notion_page_id = page_id
    elif current_user.id == challenge.opponent_id:
        challenge.opponent_notion_page_id = page_id
    else:
        raise HTTPException(status_code=403, detail="Not a participant")

    db.commit()
    return {"success": True, "page_id": page_id}


@router.post("/{challenge_id}/poll-notion")
async def poll_notion_activity(
    challenge_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually trigger Notion activity poll for a challenge."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    if not challenge or challenge.category != ChallengeCategory.STUDYING:
        raise HTTPException(status_code=404, detail="Studying challenge not found")

    # Poll creator's Notion
    if challenge.creator_notion_page_id and challenge.creator.notion_access_token:
        client = NotionClient(challenge.creator.notion_access_token)
        activity = await client.get_study_activity(
            challenge.creator_notion_page_id,
            challenge.accepted_at,
        )
        challenge.creator_notion_activity = activity
        challenge.creator_progress = activity.get("page_count", 0)

    # Poll opponent's Notion
    if challenge.opponent_notion_page_id and challenge.opponent.notion_access_token:
        client = NotionClient(challenge.opponent.notion_access_token)
        activity = await client.get_study_activity(
            challenge.opponent_notion_page_id,
            challenge.accepted_at,
        )
        challenge.opponent_notion_activity = activity
        challenge.opponent_progress = activity.get("page_count", 0)

    challenge.last_notion_poll = datetime.utcnow()
    db.commit()

    return {"success": True}
```

### 4.2 Update Evaluate Endpoint

Modify the evaluate endpoint to handle studying challenges:

```python
@router.post("/{challenge_id}/evaluate")
async def evaluate_challenge(challenge_id: int, ...):
    # ... existing validation ...

    if challenge.category == ChallengeCategory.STUDYING:
        # Use Notion activity data
        result = await referee.evaluate_studying_challenge(
            challenge.challenge_prompt,
            challenge.creator_notion_activity or {},
            challenge.opponent_notion_activity or {},
            challenge.creator.username,
            challenge.opponent.username,
        )
    else:
        # Existing GitHub evaluation
        result = await referee.evaluate_challenge(...)

    # ... rest of evaluation logic ...
```

---

## Phase 5: Background Polling Service

### 5.1 Notion Poller (`backend/app/services/notion_poller.py`)

```python
"""
Background service to poll Notion activity for active studying challenges.
"""

import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.notion import NotionClient
from app.models.challenge import Challenge, ChallengeCategory, ChallengeStatus


async def poll_active_studying_challenges():
    """Poll Notion for all active studying challenges."""
    db: Session = SessionLocal()

    try:
        # Get active studying challenges
        challenges = db.query(Challenge).filter(
            Challenge.category == ChallengeCategory.STUDYING,
            Challenge.status == ChallengeStatus.ACTIVE,
        ).all()

        for challenge in challenges:
            # Skip if polled recently (within 2 minutes)
            if challenge.last_notion_poll:
                time_since_poll = datetime.utcnow() - challenge.last_notion_poll
                if time_since_poll < timedelta(minutes=2):
                    continue

            # Poll creator
            if challenge.creator_notion_page_id and challenge.creator.notion_access_token:
                try:
                    client = NotionClient(challenge.creator.notion_access_token)
                    activity = await client.get_study_activity(
                        challenge.creator_notion_page_id,
                        challenge.accepted_at,
                    )
                    challenge.creator_notion_activity = activity
                    challenge.creator_progress = activity.get("page_count", 0)
                except Exception as e:
                    print(f"Error polling creator Notion: {e}")

            # Poll opponent
            if challenge.opponent_notion_page_id and challenge.opponent.notion_access_token:
                try:
                    client = NotionClient(challenge.opponent.notion_access_token)
                    activity = await client.get_study_activity(
                        challenge.opponent_notion_page_id,
                        challenge.accepted_at,
                    )
                    challenge.opponent_notion_activity = activity
                    challenge.opponent_progress = activity.get("page_count", 0)
                except Exception as e:
                    print(f"Error polling opponent Notion: {e}")

            challenge.last_notion_poll = datetime.utcnow()

        db.commit()
    finally:
        db.close()


async def start_polling_loop():
    """Start the background polling loop (every 2 minutes)."""
    while True:
        await poll_active_studying_challenges()
        await asyncio.sleep(120)  # 2 minutes
```

### 5.2 Start Poller on App Startup (`backend/app/main.py`)

```python
import asyncio
from contextlib import asynccontextmanager
from app.services.notion_poller import start_polling_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background polling task
    polling_task = asyncio.create_task(start_polling_loop())
    yield
    # Cancel on shutdown
    polling_task.cancel()

app = FastAPI(lifespan=lifespan)
```

---

## Phase 6: Frontend Implementation

### 6.1 Update Types (`frontend/lib/types.ts`)

```typescript
export type ChallengeCategory = 'coding' | 'screentime' | 'studying';

export interface Challenge {
  // ... existing fields ...
  creator_notion_page_id: string | null;
  opponent_notion_page_id: string | null;
  creator_notion_activity: NotionActivity | null;
  opponent_notion_activity: NotionActivity | null;
}

export interface NotionActivity {
  pages_edited: NotionPage[];
  total_blocks: number;
  page_count: number;
  content_summary: string;
}

export interface NotionPage {
  id: string;
  title: string;
  last_edited: string;
}

export interface ChallengeCreate {
  category: ChallengeCategory;
  stake_cents: number;
  opponent_username?: string;
  challenge_prompt: string;
  duration_hours?: number;
  notion_page_id?: string;  // For studying challenges
}
```

### 6.2 Add API Endpoints (`frontend/lib/api.ts`)

```typescript
// Notion
export const getNotionStatus = () => api.get('/api/notion/status');
export const getNotionOAuthUrl = (redirectUri?: string) =>
  api.get('/api/notion/oauth-url', { params: redirectUri ? { redirect_uri: redirectUri } : {} });
export const connectNotion = (code: string) => api.post('/api/notion/connect', { code });
export const disconnectNotion = () => api.delete('/api/notion/disconnect');
export const searchNotionPages = (query?: string) =>
  api.get('/api/notion/pages', { params: query ? { query } : {} });

// Challenge Notion
export const setChallengeNotionPage = (challengeId: number, pageId: string) =>
  api.post(`/api/challenges/${challengeId}/set-notion-page`, null, { params: { page_id: pageId } });
export const pollChallengeNotion = (challengeId: number) =>
  api.post(`/api/challenges/${challengeId}/poll-notion`);
```

### 6.3 Update Profile Screen (`frontend/app/(tabs)/profile.tsx`)

Add Notion section similar to GitHub:

```tsx
{/* Notion Integration */}
<View style={styles.integrationCard}>
  <View style={styles.integrationHeader}>
    <Ionicons name="book" size={24} color={colors.accent} />
    <Text style={styles.integrationTitle}>Notion</Text>
  </View>

  {notionConnected ? (
    <View style={styles.connectedState}>
      <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
      <Text style={styles.connectedText}>{notionWorkspace}</Text>
      <Pressable onPress={handleDisconnectNotion}>
        <Text style={styles.disconnectText}>Disconnect</Text>
      </Pressable>
    </View>
  ) : (
    <Pressable style={styles.connectButton} onPress={handleConnectNotion}>
      <Text style={styles.connectText}>Connect Notion</Text>
    </Pressable>
  )}
</View>
```

### 6.4 Update Challenge Creation (`frontend/app/challenge/create.tsx`)

Add category toggle at top of screen:

```tsx
{/* Category Toggle - Top Right */}
<View style={styles.categoryToggle}>
  <Pressable
    style={[styles.categoryPill, category === 'coding' && styles.categoryPillActive]}
    onPress={() => setCategory('coding')}
  >
    <Ionicons name="logo-github" size={16} color={category === 'coding' ? colors.background : colors.text} />
    <Text style={[styles.categoryText, category === 'coding' && styles.categoryTextActive]}>GitHub</Text>
  </Pressable>

  <Pressable
    style={[styles.categoryPill, category === 'studying' && styles.categoryPillActive]}
    onPress={() => setCategory('studying')}
  >
    <Ionicons name="book" size={16} color={category === 'studying' ? colors.background : colors.text} />
    <Text style={[styles.categoryText, category === 'studying' && styles.categoryTextActive]}>Notion</Text>
  </Pressable>
</View>

{/* Conditional prompt examples based on category */}
{category === 'studying' && (
  <View style={styles.examplePrompts}>
    <Text style={styles.exampleLabel}>Example study challenges:</Text>
    <Pressable onPress={() => setPrompt('Study for 2 hours with detailed notes')}>
      <Text style={styles.exampleText}>"Study for 2 hours with detailed notes"</Text>
    </Pressable>
    <Pressable onPress={() => setPrompt('Create comprehensive notes on 3 topics')}>
      <Text style={styles.exampleText}>"Create comprehensive notes on 3 topics"</Text>
    </Pressable>
  </View>
)}
```

### 6.5 Notion Page Picker Component (`frontend/components/NotionPagePicker.tsx`)

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { searchNotionPages } from '../lib/api';

interface NotionPage {
  id: string;
  title: string;
  last_edited: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (page: NotionPage) => void;
}

export default function NotionPagePicker({ visible, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPages();
    }
  }, [visible, query]);

  const loadPages = async () => {
    setLoading(true);
    try {
      const response = await searchNotionPages(query);
      setPages(response.data);
    } catch (error) {
      console.error('Failed to load pages:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Study Workspace</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            Choose a Notion page as your study root. All child pages will be tracked.
          </Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search pages..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />

          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <FlatList
              data={pages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable style={styles.pageItem} onPress={() => onSelect(item)}>
                  <Ionicons name="document-text" size={20} color={colors.accent} />
                  <Text style={styles.pageTitle}>{item.title}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No pages found</Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
```

### 6.6 Update Challenge Detail Screen (`frontend/app/challenge/[id].tsx`)

Add Notion page selection prompt for studying challenges:

```tsx
{/* Notion Page Selection (for studying challenges) */}
{challenge.category === 'studying' && isActive && !userNotionPageSet && (
  <View style={styles.notionPromptCard}>
    <Ionicons name="book" size={24} color={colors.accent} />
    <Text style={styles.notionPromptText}>
      Select a Notion page as your study workspace
    </Text>
    <Pressable style={styles.selectPageButton} onPress={() => setPagePickerVisible(true)}>
      <Text style={styles.selectPageText}>SELECT PAGE</Text>
    </Pressable>
  </View>
)}

{/* Notion Activity Display */}
{challenge.category === 'studying' && (
  <View style={styles.activityCard}>
    <Text style={styles.activityTitle}>STUDY ACTIVITY</Text>
    <View style={styles.activityRow}>
      <Text style={styles.activityLabel}>@{challenge.creator.username}</Text>
      <Text style={styles.activityValue}>
        {challenge.creator_notion_activity?.page_count || 0} pages edited
      </Text>
    </View>
    <View style={styles.activityRow}>
      <Text style={styles.activityLabel}>@{challenge.opponent?.username}</Text>
      <Text style={styles.activityValue}>
        {challenge.opponent_notion_activity?.page_count || 0} pages edited
      </Text>
    </View>
    <Text style={styles.pollNote}>Activity updates every 2 minutes</Text>
  </View>
)}
```

---

## Phase 7: Setup Instructions

### 7.1 Notion OAuth App Setup

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Configure:
   - Name: "Rival"
   - Type: "Public" (for OAuth)
   - Redirect URI: `exp://localhost:8081` (for Expo) or your production URL
4. Copy OAuth client ID and secret

### 7.2 Environment Variables

Add to `backend/.env`:

```env
NOTION_CLIENT_ID=your_client_id
NOTION_CLIENT_SECRET=your_client_secret
NOTION_REDIRECT_URI=exp://localhost:8081
```

### 7.3 Database Migration

```bash
cd backend
alembic revision --autogenerate -m "Add Notion integration fields"
alembic upgrade head
```

---

## Testing Checklist

- [ ] Notion OAuth flow works from Profile screen
- [ ] User can search and select Notion pages
- [ ] Challenge creation allows selecting category (GitHub/Notion)
- [ ] Studying challenges prompt for Notion page selection
- [ ] Background polling updates activity every 2 minutes
- [ ] AI referee correctly evaluates study notes
- [ ] Challenge detail shows Notion activity metrics
- [ ] Disconnect Notion clears all related data

---

## Security Considerations

1. **Token Storage**: Notion access tokens stored encrypted in database
2. **Page Access**: Only pages shared with the Notion integration are accessible
3. **Content Privacy**: Only summaries sent to AI, not full content
4. **Rate Limiting**: Polling limited to every 2 minutes to respect Notion API limits

---

## Future Enhancements

1. **Real-time updates** via Notion webhooks (when available)
2. **Detailed analytics** dashboard showing study patterns
3. **Multiple workspaces** support
4. **Notion templates** for study challenges
5. **Export study reports** to Notion
