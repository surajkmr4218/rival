"""
Notion OAuth and API endpoints.

Follows the same pattern as github.py for consistency.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query

logger = logging.getLogger(__name__)
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from urllib.parse import urlencode, quote

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.core.notion import NotionClient, exchange_code_for_token
from app.models.user import User

router = APIRouter(prefix="/api/notion", tags=["notion"])


# --- Pydantic Schemas ---

class NotionConnectRequest(BaseModel):
    code: str


class NotionConnectResponse(BaseModel):
    success: bool
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


# --- Endpoints ---

@router.get("/oauth-url")
def get_oauth_url(
    redirect_uri: str | None = None,
    current_user: User = Depends(get_current_user),
):
    """Get the Notion OAuth URL for the frontend to redirect to."""
    if not settings.NOTION_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Notion OAuth not configured",
        )

    # Use backend callback URL, pass app redirect URI in state
    backend_callback = settings.NOTION_REDIRECT_URI  # e.g., http://your-ip:8000/api/notion/callback
    app_redirect = redirect_uri or "rival://notion/callback"

    params = {
        "client_id": settings.NOTION_CLIENT_ID,
        "response_type": "code",
        "owner": "user",
        "redirect_uri": backend_callback,
        "state": app_redirect,  # Pass app URI in state for redirect after callback
    }

    url = f"https://api.notion.com/v1/oauth/authorize?{urlencode(params)}"

    return {"url": url, "client_id": settings.NOTION_CLIENT_ID, "backend_callback": backend_callback}


@router.get("/callback")
def notion_oauth_callback(
    code: str = Query(None),
    error: str = Query(None),
    state: str = Query(None),  # state contains the app redirect URI
):
    """
    OAuth callback endpoint. Notion redirects here, then we redirect to the mobile app.
    """
    if not state:
        return RedirectResponse("rival://notion/callback?error=missing_state")

    # state contains the app's redirect URI (e.g., exp://172.20.99.223:8081)
    app_redirect = state

    if error:
        return RedirectResponse(f"{app_redirect}?error={quote(error)}")

    if code:
        return RedirectResponse(f"{app_redirect}?code={quote(code)}")

    return RedirectResponse(f"{app_redirect}?error=no_code")


@router.get("/status", response_model=NotionStatusResponse)
def get_notion_status(current_user: User = Depends(get_current_user)):
    """Check if user has connected their Notion workspace."""
    logger.info(f"Notion status check for user {current_user.id}: token={'yes' if current_user.notion_access_token else 'no'}, workspace={current_user.notion_workspace_name}")
    return NotionStatusResponse(
        connected=current_user.notion_access_token is not None,
        workspace_name=current_user.notion_workspace_name,
        workspace_id=current_user.notion_workspace_id,
    )


@router.post("/connect", response_model=NotionConnectResponse)
async def connect_notion(
    request: NotionConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Connect Notion workspace using OAuth code."""
    if not settings.NOTION_CLIENT_ID or not settings.NOTION_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Notion OAuth not configured",
        )

    try:
        # Exchange code for access token (use backend callback URL)
        logger.info(f"Exchanging code for token, redirect_uri={settings.NOTION_REDIRECT_URI}")
        token_data = await exchange_code_for_token(
            code=request.code,
            redirect_uri=settings.NOTION_REDIRECT_URI,
        )
        logger.info(f"Token response: {token_data}")

        access_token = token_data.get("access_token")
        workspace_id = token_data.get("workspace_id", "")
        workspace_name = token_data.get("workspace_name", "Notion Workspace")

        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No access token received",
            )

        # Save to user record
        current_user.notion_access_token = access_token
        current_user.notion_workspace_id = workspace_id
        current_user.notion_workspace_name = workspace_name
        db.commit()

        return NotionConnectResponse(
            success=True,
            workspace_name=workspace_name,
            workspace_id=workspace_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to connect Notion: {str(e)}",
        )


@router.delete("/disconnect")
def disconnect_notion(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notion not connected",
        )

    try:
        client = NotionClient(current_user.notion_access_token)
        pages = await client.search_pages(query)

        return [
            NotionPageResponse(
                id=page["id"],
                title=client._extract_page_title(page),
                last_edited=page.get("last_edited_time"),
            )
            for page in pages[:20]  # Limit results
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch pages: {str(e)}",
        )
