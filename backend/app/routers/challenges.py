"""
Challenge HTTP layer.

This module is intentionally thin: parse the request, call the service, return
the response. All business rules, balance math, and AI orchestration live in
`app.services.challenge_service`.
"""

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.ws import broadcast_challenge
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import get_current_user
from app.models.user import User
from app.models.challenge import Challenge, ChallengeStatus
from app.schemas.challenge import (
    ChallengeAccept,
    ChallengeCreate,
    ChallengeResponse,
    ChallengeList,
    ChallengeResponse,
    UserPublic,
    challenge_to_response,
)
from app.services import challenge_service

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


# ---------------------------------------------------------------------------
# Response serialization
# ---------------------------------------------------------------------------

def _load_challenge(db: Session, challenge_id: int, user: User) -> Challenge:
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")
    if challenge.creator_id != user.id and challenge.opponent_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this challenge"
        )
    return challenge


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.post("", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
def create_challenge(
    payload: ChallengeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = challenge_service.create_challenge(db, current_user, payload)
    return challenge_to_response(challenge)


@router.get("", response_model=ChallengeList)
def list_challenges(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    challenges = (
        db.query(Challenge)
        .filter(
            (Challenge.creator_id == current_user.id)
            | (Challenge.opponent_id == current_user.id)
        )
        .order_by(Challenge.created_at.desc())
        .all()
    )
    return ChallengeList(challenges=[challenge_to_response(c) for c in challenges])


@router.get("/pending", response_model=ChallengeList)
def list_pending(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    challenges = (
        db.query(Challenge)
        .filter(
            Challenge.opponent_id == current_user.id,
            Challenge.status == ChallengeStatus.PENDING,
        )
        .order_by(Challenge.created_at.desc())
        .all()
    )
    return ChallengeList(challenges=[challenge_to_response(c) for c in challenges])


@router.get("/active", response_model=ChallengeList)
def list_active(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    # Include EVALUATING so the dashboard shows in-flight challenges with a
    # "waiting for AI referee" indicator instead of having them disappear.
    in_progress_statuses = (ChallengeStatus.ACTIVE, ChallengeStatus.EVALUATING)
    challenges = (
        db.query(Challenge)
        .filter(
            (Challenge.creator_id == current_user.id)
            | (Challenge.opponent_id == current_user.id),
            Challenge.status.in_(in_progress_statuses),
        )
        .order_by(Challenge.created_at.desc())
        .all()
    )
    return ChallengeList(challenges=[challenge_to_response(c) for c in challenges])


@router.get("/{challenge_id}", response_model=ChallengeResponse)
def get_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the challenge as currently stored in the DB — does NOT trigger
    a GitHub/Notion fetch. That kept the detail screen blocked for seconds
    waiting on third-party APIs.

    The frontend should call `POST /{challenge_id}/refresh` separately after
    rendering, so the page paints instantly with cached progress and the
    progress bar updates when the fresh fetch returns.
    """
    challenge = _load_challenge(db, challenge_id, current_user)
    return challenge_to_response(challenge)


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

@router.post("/{challenge_id}/accept", response_model=ChallengeResponse)
def accept_challenge(
    challenge_id: int,
    accept_data: Optional[ChallengeAccept] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = challenge_service.accept_challenge(db, challenge_id, current_user, accept_data)
    return challenge_to_response(challenge)


@router.post("/{challenge_id}/decline", response_model=ChallengeResponse)
def decline_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = challenge_service.decline_challenge(db, challenge_id, current_user)
    return challenge_to_response(challenge)


@router.post("/{challenge_id}/cancel", response_model=ChallengeResponse)
def cancel_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = challenge_service.cancel_challenge(db, challenge_id, current_user)
    return challenge_to_response(challenge)


# ---------------------------------------------------------------------------
# Notion-specific
# ---------------------------------------------------------------------------

@router.post("/{challenge_id}/set-notion-page", response_model=ChallengeResponse)
def set_notion_page(
    challenge_id: int,
    page_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = challenge_service.set_notion_page(db, challenge_id, current_user, page_id)
    return challenge_to_response(challenge)


@router.post("/{challenge_id}/poll-notion", response_model=ChallengeResponse)
async def poll_notion(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = _load_challenge(db, challenge_id, current_user)
    await challenge_service.refresh_progress(challenge, db, force=True)
    return challenge_to_response(challenge)


@router.post("/{challenge_id}/refresh", response_model=ChallengeResponse)
async def refresh_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = _load_challenge(db, challenge_id, current_user)
    await challenge_service.refresh_progress(challenge, db, force=True)
    await broadcast_challenge(challenge)           
    return challenge_to_response(challenge)


# ---------------------------------------------------------------------------
# AI evaluation (kickoff + poll)
# ---------------------------------------------------------------------------

@router.post(
    "/{challenge_id}/evaluate",
    response_model=ChallengeResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("5/minute")
def evaluate_challenge(
    request: Request,
    challenge_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kick off AI evaluation. Returns immediately with status=evaluating.
    Client polls GET /api/challenges/{id} until status flips to completed.
    Idempotent: re-calling while evaluating or after completion is a no-op.
    """
    challenge = challenge_service.start_evaluation(db, challenge_id, current_user)
    if challenge.status == ChallengeStatus.EVALUATING:
        background_tasks.add_task(challenge_service.run_evaluation, challenge.id)
    return challenge_to_response(challenge)
