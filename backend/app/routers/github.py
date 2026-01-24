from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.core.github import GitHubClient, exchange_code_for_token
from app.models.user import User

router = APIRouter(prefix="/api/github", tags=["github"])


class GitHubConnectRequest(BaseModel):
    code: str


class GitHubConnectResponse(BaseModel):
    success: bool
    github_username: str


class GitHubStatusResponse(BaseModel):
    connected: bool
    github_username: str | None


class CommitCountResponse(BaseModel):
    commits: int
    since: datetime
    github_username: str


@router.get("/status", response_model=GitHubStatusResponse)
def get_github_status(current_user: User = Depends(get_current_user)):
    """Check if user has connected their GitHub account."""
    return GitHubStatusResponse(
        connected=current_user.github_access_token is not None,
        github_username=current_user.github_username,
    )


@router.post("/connect", response_model=GitHubConnectResponse)
async def connect_github(
    request: GitHubConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Connect GitHub account using OAuth code."""
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth not configured",
        )

    try:
        # Exchange code for access token
        token_response = await exchange_code_for_token(
            client_id=settings.GITHUB_CLIENT_ID,
            client_secret=settings.GITHUB_CLIENT_SECRET,
            code=request.code,
        )

        if "error" in token_response:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=token_response.get("error_description", "Failed to connect GitHub"),
            )

        access_token = token_response.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No access token received",
            )

        # Get GitHub user info
        github_client = GitHubClient(access_token)
        github_user = await github_client.get_user()

        # Save to user record
        current_user.github_access_token = access_token
        current_user.github_username = github_user["login"]
        db.commit()

        return GitHubConnectResponse(
            success=True,
            github_username=github_user["login"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to connect GitHub: {str(e)}",
        )


@router.delete("/disconnect")
def disconnect_github(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect GitHub account."""
    current_user.github_access_token = None
    current_user.github_username = None
    db.commit()
    return {"success": True}


@router.get("/commits", response_model=CommitCountResponse)
async def get_commits(
    hours: int = 24,
    current_user: User = Depends(get_current_user),
):
    """Get commit count for the authenticated user."""
    if not current_user.github_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub account not connected",
        )

    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    try:
        github_client = GitHubClient(current_user.github_access_token)
        commits = await github_client.get_commits_count(
            username=current_user.github_username,
            since=since,
        )

        return CommitCountResponse(
            commits=commits,
            since=since,
            github_username=current_user.github_username,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch commits: {str(e)}",
        )


@router.get("/debug")
async def debug_github(
    current_user: User = Depends(get_current_user),
):
    """Debug endpoint to check GitHub connection and recent events."""
    if not current_user.github_access_token:
        return {"error": "GitHub not connected"}

    import httpx
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/users/{current_user.github_username}/events",
            headers={
                "Authorization": f"Bearer {current_user.github_access_token}",
                "Accept": "application/vnd.github+json",
            },
            params={"per_page": 3},
        )
        events = response.json()

        # Also check the scopes from the response headers
        scopes = response.headers.get("x-oauth-scopes", "none")

    # Return first raw event for debugging
    first_event_raw = events[0] if events else None

    return {
        "github_username": current_user.github_username,
        "token_scopes": scopes,
        "events_count": len(events) if isinstance(events, list) else 0,
        "first_event_raw": first_event_raw,
    }


@router.get("/oauth-url")
def get_oauth_url(redirect_uri: str | None = None):
    """Get the GitHub OAuth URL for the frontend to redirect to."""
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth not configured",
        )

    oauth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.GITHUB_CLIENT_ID}"
        f"&scope=read:user%20repo"
    )

    # Use provided redirect_uri or fall back to configured one
    if redirect_uri:
        oauth_url += f"&redirect_uri={redirect_uri}"
    elif settings.GITHUB_REDIRECT_URI:
        oauth_url += f"&redirect_uri={settings.GITHUB_REDIRECT_URI}"

    return {"url": oauth_url, "client_id": settings.GITHUB_CLIENT_ID}
