from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.challenge import Challenge, ChallengeStatus
from app.schemas.challenge import (
    ChallengeCreate,
    ChallengeResponse,
    ChallengeList,
    UserPublic,
    UserSearchRequest,
    UserSearchResponse,
)

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


def challenge_to_response(challenge: Challenge) -> ChallengeResponse:
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
        goal_type=challenge.goal_type,
        goal_value=challenge.goal_value,
        goal_period=challenge.goal_period,
        status=challenge.status,
        creator_progress=challenge.creator_progress,
        opponent_progress=challenge.opponent_progress,
        winner_id=challenge.winner_id,
        created_at=challenge.created_at,
        accepted_at=challenge.accepted_at,
        ends_at=challenge.ends_at,
        completed_at=challenge.completed_at,
    )


@router.post("", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
def create_challenge(
    challenge_data: ChallengeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new challenge."""
    # TODO: Re-enable balance check when Stripe is integrated
    # if current_user.balance_cents < challenge_data.stake_cents:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Insufficient balance for this stake",
    #     )

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
        goal_type=challenge_data.goal_type,
        goal_value=challenge_data.goal_value,
        goal_period=challenge_data.goal_period,
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
def get_challenge(
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

    # Check if user is part of this challenge
    if challenge.creator_id != current_user.id and challenge.opponent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this challenge",
        )

    return challenge_to_response(challenge)


@router.post("/{challenge_id}/accept", response_model=ChallengeResponse)
def accept_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a challenge invitation."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    if challenge.opponent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to accept this challenge",
        )

    if challenge.status != ChallengeStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge is not pending",
        )

    # TODO: Re-enable balance check when Stripe is integrated
    # if current_user.balance_cents < challenge.stake_cents:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Insufficient balance for this stake",
    #     )

    # TODO: Re-enable stake deduction when Stripe is integrated
    # challenge.creator.balance_cents -= challenge.stake_cents
    # current_user.balance_cents -= challenge.stake_cents

    # Update challenge status
    challenge.status = ChallengeStatus.ACTIVE
    challenge.accepted_at = datetime.utcnow()

    # Set end time based on goal period
    if challenge.goal_period == "daily":
        challenge.ends_at = datetime.utcnow() + timedelta(days=1)
    elif challenge.goal_period == "weekly":
        challenge.ends_at = datetime.utcnow() + timedelta(weeks=1)

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    if challenge.opponent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to decline this challenge",
        )

    if challenge.status != ChallengeStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge is not pending",
        )

    challenge.status = ChallengeStatus.DECLINED
    db.commit()
    db.refresh(challenge)

    return challenge_to_response(challenge)
