import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from app.core.database import get_db

logger = logging.getLogger(__name__)
from app.core.security import get_current_user
from app.core.github import GitHubClient
from app.core.notion import NotionClient
from app.core.gemini import get_referee
from app.models.user import User
from app.models.challenge import Challenge, ChallengeStatus, ChallengeCategory
from app.schemas.challenge import (
    ChallengeCreate,
    ChallengeAccept,
    ChallengeResponse,
    ChallengeList,
    UserPublic,
)

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


# ============================================================================
# Helper Functions
# ============================================================================

def challenge_to_response(challenge: Challenge) -> ChallengeResponse:
    """Convert a Challenge model to a ChallengeResponse schema."""
    return ChallengeResponse(
        id=challenge.id,
        creator=UserPublic(
            id=challenge.creator.id,
            username=challenge.creator.username,
            email=challenge.creator.email,
        ),
        opponent=UserPublic(
            id=challenge.opponent.id,
            username=challenge.opponent.username,
            email=challenge.opponent.email,
        ) if challenge.opponent else None,
        category=challenge.category,
        stake_cents=challenge.stake_cents,
        prize_pool_cents=challenge.stake_cents * 2,
        challenge_prompt=challenge.challenge_prompt,
        duration_hours=challenge.duration_hours or 24,
        goal_type=challenge.goal_type,
        goal_value=challenge.goal_value,
        goal_period=challenge.goal_period,
        status=challenge.status,
        creator_progress=challenge.creator_progress,
        opponent_progress=challenge.opponent_progress,
        winner_id=challenge.winner_id,
        ai_verdict=challenge.ai_verdict,
        ai_evaluated_at=challenge.ai_evaluated_at,
        # Notion fields
        creator_notion_page_id=challenge.creator_notion_page_id,
        opponent_notion_page_id=challenge.opponent_notion_page_id,
        creator_notion_activity=challenge.creator_notion_activity,
        opponent_notion_activity=challenge.opponent_notion_activity,
        created_at=challenge.created_at,
        accepted_at=challenge.accepted_at,
        ends_at=challenge.ends_at,
        completed_at=challenge.completed_at,
    )


async def update_coding_progress(challenge: Challenge, db: Session) -> None:
    """Fetch GitHub commits and update progress for a coding challenge."""
    if challenge.category != ChallengeCategory.CODING:
        return
    if challenge.status != ChallengeStatus.ACTIVE:
        return

    since = challenge.accepted_at.replace(tzinfo=timezone.utc) if challenge.accepted_at else datetime.now(timezone.utc)

    # Update creator progress
    if challenge.creator.github_access_token and challenge.creator.github_username:
        try:
            client = GitHubClient(challenge.creator.github_access_token)
            commits = await client.get_commits_count(challenge.creator.github_username, since)
            challenge.creator_progress = commits
        except Exception as e:
            logger.warning(f"Failed to fetch commits for creator: {e}")

    # Update opponent progress
    if challenge.opponent and challenge.opponent.github_access_token and challenge.opponent.github_username:
        try:
            client = GitHubClient(challenge.opponent.github_access_token)
            commits = await client.get_commits_count(challenge.opponent.github_username, since)
            challenge.opponent_progress = commits
        except Exception as e:
            logger.warning(f"Failed to fetch commits for opponent: {e}")

    db.commit()


async def update_studying_progress(challenge: Challenge, db: Session) -> None:
    """Fetch Notion activity and update progress for a studying challenge."""
    if challenge.category != ChallengeCategory.STUDYING:
        return
    if challenge.status != ChallengeStatus.ACTIVE:
        return

    since = challenge.accepted_at.replace(tzinfo=timezone.utc) if challenge.accepted_at else datetime.now(timezone.utc)

    # Update creator progress
    if challenge.creator_notion_page_id and challenge.creator.notion_access_token:
        try:
            client = NotionClient(challenge.creator.notion_access_token)
            activity = await client.get_study_activity(challenge.creator_notion_page_id, since)
            challenge.creator_notion_activity = activity
            challenge.creator_progress = activity.get("page_count", 0)
        except Exception as e:
            logger.warning(f"Failed to fetch Notion activity for creator: {e}")

    # Update opponent progress
    if challenge.opponent_notion_page_id and challenge.opponent and challenge.opponent.notion_access_token:
        try:
            client = NotionClient(challenge.opponent.notion_access_token)
            activity = await client.get_study_activity(challenge.opponent_notion_page_id, since)
            challenge.opponent_notion_activity = activity
            challenge.opponent_progress = activity.get("page_count", 0)
        except Exception as e:
            logger.warning(f"Failed to fetch Notion activity for opponent: {e}")

    challenge.last_notion_poll = datetime.utcnow()
    db.commit()


# ============================================================================
# Challenge CRUD Endpoints
# ============================================================================

@router.post("", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
def create_challenge(
    challenge_data: ChallengeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new challenge with AI-evaluated prompt."""
    # Validate studying challenges require Notion connection and page selection
    if challenge_data.category == ChallengeCategory.STUDYING:
        if not current_user.notion_access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Connect Notion in your profile before creating a studying challenge",
            )
        if not challenge_data.creator_notion_page_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select a study page for the challenge",
            )

    # Find opponent if username provided
    opponent = None
    if challenge_data.opponent_username:
        opponent = db.query(User).filter(
            User.username == challenge_data.opponent_username
        ).first()
        if not opponent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Opponent not found",
            )
        if opponent.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot challenge yourself",
            )

    # Create challenge
    challenge = Challenge(
        creator_id=current_user.id,
        opponent_id=opponent.id if opponent else None,
        category=challenge_data.category,
        stake_cents=challenge_data.stake_cents,
        challenge_prompt=challenge_data.challenge_prompt,
        duration_hours=challenge_data.duration_hours,
        status=ChallengeStatus.PENDING,
        # Set creator's Notion page for studying challenges
        creator_notion_page_id=challenge_data.creator_notion_page_id if challenge_data.category == ChallengeCategory.STUDYING else None,
    )

    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    return challenge_to_response(challenge)


@router.get("", response_model=ChallengeList)
def list_challenges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all challenges for the current user."""
    challenges = db.query(Challenge).filter(
        (Challenge.creator_id == current_user.id) |
        (Challenge.opponent_id == current_user.id)
    ).order_by(Challenge.created_at.desc()).all()

    return ChallengeList(
        challenges=[challenge_to_response(c) for c in challenges]
    )


@router.get("/pending", response_model=ChallengeList)
def get_pending_challenges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get challenges waiting for the current user to accept."""
    challenges = db.query(Challenge).filter(
        Challenge.opponent_id == current_user.id,
        Challenge.status == ChallengeStatus.PENDING,
    ).order_by(Challenge.created_at.desc()).all()

    return ChallengeList(
        challenges=[challenge_to_response(c) for c in challenges]
    )


@router.get("/active", response_model=ChallengeList)
def get_active_challenges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get active challenges for the current user."""
    challenges = db.query(Challenge).filter(
        ((Challenge.creator_id == current_user.id) |
         (Challenge.opponent_id == current_user.id)),
        Challenge.status == ChallengeStatus.ACTIVE,
    ).order_by(Challenge.created_at.desc()).all()

    return ChallengeList(
        challenges=[challenge_to_response(c) for c in challenges]
    )


@router.get("/{challenge_id}", response_model=ChallengeResponse)
async def get_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific challenge."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    if challenge.creator_id != current_user.id and challenge.opponent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this challenge",
        )

    # Update progress for active challenges
    if challenge.category == ChallengeCategory.CODING:
        await update_coding_progress(challenge, db)
    elif challenge.category == ChallengeCategory.STUDYING:
        await update_studying_progress(challenge, db)

    return challenge_to_response(challenge)


# ============================================================================
# Challenge Actions
# ============================================================================

@router.post("/{challenge_id}/accept", response_model=ChallengeResponse)
def accept_challenge(
    challenge_id: int,
    accept_data: ChallengeAccept = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a challenge invitation."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    if challenge.opponent_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to accept this challenge")

    if challenge.status != ChallengeStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge is not pending")

    # Validate studying challenges require Notion connection and page selection
    if challenge.category == ChallengeCategory.STUDYING:
        if not current_user.notion_access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Connect Notion in your profile before accepting a studying challenge",
            )
        if not accept_data or not accept_data.opponent_notion_page_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select a study page to accept this challenge",
            )
        challenge.opponent_notion_page_id = accept_data.opponent_notion_page_id

    # Activate challenge
    challenge.status = ChallengeStatus.ACTIVE
    challenge.accepted_at = datetime.utcnow()
    challenge.ends_at = datetime.utcnow() + timedelta(hours=challenge.duration_hours or 24)

    db.commit()
    db.refresh(challenge)

    return challenge_to_response(challenge)


@router.post("/{challenge_id}/decline", response_model=ChallengeResponse)
def decline_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Decline a challenge invitation."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    if challenge.opponent_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to decline this challenge")

    if challenge.status != ChallengeStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge is not pending")

    challenge.status = ChallengeStatus.DECLINED
    db.commit()
    db.refresh(challenge)

    return challenge_to_response(challenge)


# ============================================================================
# Notion Challenge Endpoints
# ============================================================================

@router.post("/{challenge_id}/set-notion-page", response_model=ChallengeResponse)
def set_notion_page(
    challenge_id: int,
    page_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set the Notion page for tracking in a studying challenge."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    if challenge.category != ChallengeCategory.STUDYING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not a studying challenge")

    if challenge.status != ChallengeStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge is not active")

    # Set page based on which participant is making the request
    if current_user.id == challenge.creator_id:
        challenge.creator_notion_page_id = page_id
    elif current_user.id == challenge.opponent_id:
        challenge.opponent_notion_page_id = page_id
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this challenge")

    db.commit()
    db.refresh(challenge)

    return challenge_to_response(challenge)


@router.post("/{challenge_id}/poll-notion", response_model=ChallengeResponse)
async def poll_notion_activity(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger Notion activity poll for a studying challenge."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    if challenge.category != ChallengeCategory.STUDYING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not a studying challenge")

    if challenge.creator_id != current_user.id and challenge.opponent_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to poll this challenge")

    await update_studying_progress(challenge, db)

    return challenge_to_response(challenge)


@router.post("/{challenge_id}/refresh", response_model=ChallengeResponse)
async def refresh_challenge_progress(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually refresh progress for a challenge."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    if challenge.creator_id != current_user.id and challenge.opponent_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to refresh this challenge")

    await update_coding_progress(challenge, db)

    return challenge_to_response(challenge)


# ============================================================================
# AI Referee Evaluation
# ============================================================================

@router.post("/{challenge_id}/evaluate", response_model=ChallengeResponse)
async def evaluate_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Trigger AI evaluation of a challenge.

    The AI referee will analyze activity for both participants
    and determine a winner based on the challenge prompt.
    Supports both coding (GitHub) and studying (Notion) challenges.
    """
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    # Authorization check
    if challenge.creator_id != current_user.id and challenge.opponent_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to evaluate this challenge")

    # Can only evaluate active challenges
    if challenge.status != ChallengeStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge is not active")

    # Must have a challenge prompt
    if not challenge.challenge_prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge has no prompt for AI evaluation")

    # Get the AI referee
    referee = get_referee()
    if not referee:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI referee not available. GEMINI_API_KEY not configured.",
        )

    since = challenge.accepted_at.replace(tzinfo=timezone.utc)

    # Route to appropriate evaluation based on category
    if challenge.category == ChallengeCategory.CODING:
        verdict = await _evaluate_coding_challenge(challenge, referee, since)
    elif challenge.category == ChallengeCategory.STUDYING:
        verdict = await _evaluate_studying_challenge(challenge, referee, since)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AI evaluation not available for this challenge type")

    # Update challenge with verdict
    challenge.ai_verdict = verdict.get("verdict", "Evaluation completed.")
    challenge.ai_evaluated_at = datetime.utcnow()

    # Determine winner
    winner_result = verdict.get("winner", "").lower()
    if winner_result == "creator":
        challenge.winner_id = challenge.creator_id
    elif winner_result == "opponent":
        challenge.winner_id = challenge.opponent_id
    else:
        challenge.winner_id = None  # Tie

    # Mark challenge as completed
    challenge.status = ChallengeStatus.COMPLETED
    challenge.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(challenge)

    return challenge_to_response(challenge)


async def _evaluate_coding_challenge(challenge: Challenge, referee, since: datetime) -> dict:
    """Evaluate a GitHub coding challenge."""
    # Both users must have GitHub connected
    if not challenge.creator.github_access_token or not challenge.creator.github_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Creator has not connected GitHub")

    if not challenge.opponent or not challenge.opponent.github_access_token or not challenge.opponent.github_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Opponent has not connected GitHub")

    try:
        creator_client = GitHubClient(challenge.creator.github_access_token)
        opponent_client = GitHubClient(challenge.opponent.github_access_token)

        creator_activity = await creator_client.get_user_activity(challenge.creator.github_username, since)
        opponent_activity = await opponent_client.get_user_activity(challenge.opponent.github_username, since)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to fetch GitHub activity: {str(e)}")

    # Update progress
    challenge.creator_progress = len(creator_activity.get("commits", []))
    challenge.opponent_progress = len(opponent_activity.get("commits", []))

    try:
        return await referee.evaluate_challenge(
            challenge_prompt=challenge.challenge_prompt,
            creator_activity=creator_activity,
            opponent_activity=opponent_activity,
            creator_username=challenge.creator.github_username,
            opponent_username=challenge.opponent.github_username,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI evaluation failed: {str(e)}")


async def _evaluate_studying_challenge(challenge: Challenge, referee, since: datetime) -> dict:
    """Evaluate a Notion studying challenge."""
    # Both users must have Notion connected and pages selected
    if not challenge.creator.notion_access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Creator has not connected Notion")

    if not challenge.creator_notion_page_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Creator has not selected a study workspace")

    if not challenge.opponent or not challenge.opponent.notion_access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Opponent has not connected Notion")

    if not challenge.opponent_notion_page_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Opponent has not selected a study workspace")

    try:
        creator_client = NotionClient(challenge.creator.notion_access_token)
        opponent_client = NotionClient(challenge.opponent.notion_access_token)

        creator_activity = await creator_client.get_study_activity(challenge.creator_notion_page_id, since)
        opponent_activity = await opponent_client.get_study_activity(challenge.opponent_notion_page_id, since)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to fetch Notion activity: {str(e)}")

    # Update progress and cache activity
    challenge.creator_notion_activity = creator_activity
    challenge.opponent_notion_activity = opponent_activity
    challenge.creator_progress = creator_activity.get("page_count", 0)
    challenge.opponent_progress = opponent_activity.get("page_count", 0)

    try:
        return await referee.evaluate_studying_challenge(
            challenge_prompt=challenge.challenge_prompt,
            creator_activity=creator_activity,
            opponent_activity=opponent_activity,
            creator_username=challenge.creator.username,
            opponent_username=challenge.opponent.username,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI evaluation failed: {str(e)}")
