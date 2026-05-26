from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode, quote

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.core.github import GitHubClient, exchange_code_for_token
from app.models.user import User

# Fallback deep-link route inside the mobile app that handles the OAuth result.
# Matches the file `frontend/app/auth/github.tsx`. The `rival://` scheme is
# declared in `frontend/app.json` and is only active in a real build of the app
# (NOT in Expo Go, which uses `exp://`). The frontend normally passes the
# correct deep link via the OAuth `state` parameter so this is just a backstop.
APP_DEEP_LINK = "rival://auth/github"

# Schemes the relay is allowed to bounce back to. Prevents an attacker from
# crafting a link that exfiltrates the auth code to an arbitrary site.
_ALLOWED_RETURN_SCHEMES = ("rival://", "exp://")


def _safe_return_url(url: str | None) -> str:
    """Return `url` only if it starts with a known app scheme; else the default."""
    if url and any(url.startswith(p) for p in _ALLOWED_RETURN_SCHEMES):
        return url
    return APP_DEEP_LINK

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


@router.get("/oauth-url")
def get_oauth_url(return_url: str | None = Query(None)):
    """
    Build the GitHub OAuth authorize URL.

    GitHub OAuth Apps only accept http(s) callback URLs registered on
    github.com — they cannot redirect to a custom mobile scheme like
    `rival://` directly. So the `redirect_uri` sent to GitHub is the backend
    URL (configured server-side as GITHUB_REDIRECT_URI), and the matching
    `/callback` endpoint below relays the user back into the app.

    The frontend passes its deep link as `return_url` (e.g. `exp://...` in
    Expo Go, `rival://...` in a real build). We smuggle it through GitHub
    via the OAuth `state` parameter — GitHub passes `state` back unchanged
    on the callback, where we validate it against an allowlist of app
    schemes before bouncing the user there.
    """
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth not configured",
        )
    if not settings.GITHUB_REDIRECT_URI:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GITHUB_REDIRECT_URI is not configured on the server",
        )

    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "scope": "read:user repo",
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
    }
    if return_url:
        # Validate up-front so we never put an attacker-controlled URL on the
        # wire, even though we also re-validate on the way back.
        params["state"] = _safe_return_url(return_url)

    oauth_url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return {"url": oauth_url, "client_id": settings.GITHUB_CLIENT_ID}


@router.get("/callback")
def github_oauth_callback(
    code: str | None = Query(None),
    error: str | None = Query(None),
    state: str | None = Query(None),
):
    """
    OAuth relay endpoint. GitHub redirects the user here (a real HTTPS URL
    GitHub will accept); we immediately bounce them into the app via the
    deep link the frontend supplied as `state` — falling back to the default
    `rival://` link if `state` is missing or doesn't pass allowlist checks.

    The deep-link handler at `frontend/app/auth/github.tsx` then exchanges
    the code by calling `POST /api/github/connect`.
    """
    app_redirect = _safe_return_url(state)

    if error:
        return RedirectResponse(f"{app_redirect}?error={quote(error)}")
    if not code:
        return RedirectResponse(f"{app_redirect}?error=no_code")
    return RedirectResponse(f"{app_redirect}?code={quote(code)}")
