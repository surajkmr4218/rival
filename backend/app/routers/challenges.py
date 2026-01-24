from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.github import GitHubClient
from app.core.gemini import get_referee
from app.models.user import User
from app.models.challenge import Challenge, ChallengeStatus, ChallengeCategory
from app.schemas.challenge import (
    ChallengeCreate,
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
            print(f"Failed to fetch commits for creator: {e}")

    # Update opponent progress
    if challenge.opponent and challenge.opponent.github_access_token and challenge.opponent.github_username:
        try:
            client = GitHubClient(challenge.opponent.github_access_token)
            commits = await client.get_commits_count(challenge.opponent.github_username, since)
            challenge.opponent_progress = commits
        except Exception as e:
            print(f"Failed to fetch commits for opponent: {e}")

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

    # Update progress for active coding challenges
    await update_coding_progress(challenge, db)

    return challenge_to_response(challenge)


# ============================================================================
# Challenge Actions
# ============================================================================

@router.post("/{challenge_id}/accept", response_model=ChallengeResponse)
def accept_challenge(
    challenge_id: int,
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
    Trigger AI evaluation of a coding challenge.

    The AI referee will analyze GitHub activity for both participants
    and determine a winner based on the challenge prompt.
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

    # Only coding challenges can be AI-evaluated
    if challenge.category != ChallengeCategory.CODING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AI evaluation only available for coding challenges")

    # Both users must have GitHub connected
    if not challenge.creator.github_access_token or not challenge.creator.github_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Creator has not connected GitHub")

    if not challenge.opponent or not challenge.opponent.github_access_token or not challenge.opponent.github_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Opponent has not connected GitHub")

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

    # Fetch GitHub activity for both users
    since = challenge.accepted_at.replace(tzinfo=timezone.utc)

    try:
        creator_client = GitHubClient(challenge.creator.github_access_token)
        opponent_client = GitHubClient(challenge.opponent.github_access_token)

        creator_activity = await creator_client.get_user_activity(
            challenge.creator.github_username, since
        )
        opponent_activity = await opponent_client.get_user_activity(
            challenge.opponent.github_username, since
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch GitHub activity: {str(e)}",
        )

    # Get AI verdict
    try:
        verdict = await referee.evaluate_challenge(
            challenge_prompt=challenge.challenge_prompt,
            creator_activity=creator_activity,
            opponent_activity=opponent_activity,
            creator_username=challenge.creator.github_username,
            opponent_username=challenge.opponent.github_username,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI evaluation failed: {str(e)}",
        )

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

    # Update final progress counts
    challenge.creator_progress = len(creator_activity.get("commits", []))
    challenge.opponent_progress = len(opponent_activity.get("commits", []))

    db.commit()
    db.refresh(challenge)

    return challenge_to_response(challenge)
