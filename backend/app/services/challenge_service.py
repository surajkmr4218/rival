"""
Challenge business logic.

The router layer is intentionally thin — all state-machine transitions, balance
math, third-party fetches, and AI orchestration live here. Functions raise
`HTTPException` so the router can pass them through unchanged.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.ws import broadcast_challenge
from app.core.database import SessionLocal
from app.core.gemini import GeminiQuotaExhausted, get_referee
from app.core.github import GitHubClient
from app.core.notion import NotionClient
from app.models.balance_history import BalanceEventType
from app.models.challenge import Challenge, ChallengeCategory, ChallengeStatus
from app.models.user import User
from app.schemas.challenge import ChallengeAccept, ChallengeCreate
from app.services import notion_poller
from app.services.balance_service import apply_balance_change

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _insufficient_balance(have: int, need: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Insufficient balance. You have ${have / 100:.2f} but need ${need / 100:.2f}",
    )


def _get_or_404(db: Session, challenge_id: int) -> Challenge:
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")
    return challenge


def _require_participant(challenge: Challenge, user: User) -> None:
    if challenge.creator_id != user.id and challenge.opponent_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for this challenge",
        )


def _since(challenge: Challenge) -> datetime:
    """Activity-window start: the moment the challenge was accepted, in UTC.
    Falls back to 'now' for pre-accept callers — those paths shouldn't fetch
    activity anyway, so the value is mostly a safety default."""
    if challenge.accepted_at:
        return challenge.accepted_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# State transitions
# ---------------------------------------------------------------------------

def create_challenge(
    db: Session, creator: User, payload: ChallengeCreate
) -> Challenge:
    if creator.balance_cents < payload.stake_cents:
        raise _insufficient_balance(creator.balance_cents, payload.stake_cents)

    if payload.category == ChallengeCategory.STUDYING:
        if not creator.notion_access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Connect Notion in your profile before creating a studying challenge",
            )
        if not payload.creator_notion_page_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select a study page for the challenge",
            )

    opponent: Optional[User] = None
    if payload.opponent_username:
        opponent = (
            db.query(User).filter(User.username == payload.opponent_username).first()
        )
        if not opponent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opponent not found")
        if opponent.id == creator.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot challenge yourself"
            )

    challenge = Challenge(
        creator_id=creator.id,
        opponent_id=opponent.id if opponent else None,
        category=payload.category,
        stake_cents=payload.stake_cents,
        challenge_prompt=payload.challenge_prompt,
        duration_hours=payload.duration_hours,
        status=ChallengeStatus.PENDING,
        creator_notion_page_id=(
            payload.creator_notion_page_id
            if payload.category == ChallengeCategory.STUDYING
            else None
        ),
    )
    db.add(challenge)
    db.flush()  # need challenge.id for the ledger row

    apply_balance_change(
        db, creator, -payload.stake_cents, BalanceEventType.STAKE, challenge.id
    )

    db.commit()
    db.refresh(challenge)
    return challenge


def accept_challenge(
    db: Session,
    challenge_id: int,
    opponent: User,
    accept_data: Optional[ChallengeAccept],
) -> Challenge:
    challenge = _get_or_404(db, challenge_id)

    if challenge.opponent_id != opponent.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to accept this challenge",
        )
    if challenge.status != ChallengeStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge is not pending"
        )
    if opponent.balance_cents < challenge.stake_cents:
        raise _insufficient_balance(opponent.balance_cents, challenge.stake_cents)

    if challenge.category == ChallengeCategory.STUDYING:
        if not opponent.notion_access_token:
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

    apply_balance_change(
        db, opponent, -challenge.stake_cents, BalanceEventType.STAKE, challenge.id
    )

    challenge.status = ChallengeStatus.ACTIVE
    challenge.accepted_at = utcnow()
    challenge.ends_at = utcnow() + timedelta(hours=challenge.duration_hours or 24)

    db.commit()
    db.refresh(challenge)
    return challenge


def decline_challenge(db: Session, challenge_id: int, opponent: User) -> Challenge:
    challenge = _get_or_404(db, challenge_id)

    if challenge.opponent_id != opponent.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to decline this challenge",
        )
    if challenge.status != ChallengeStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge is not pending"
        )

    apply_balance_change(
        db,
        challenge.creator,
        challenge.stake_cents,
        BalanceEventType.STAKE_REFUND,
        challenge.id,
    )
    challenge.status = ChallengeStatus.DECLINED

    db.commit()
    db.refresh(challenge)
    return challenge


def cancel_challenge(db: Session, challenge_id: int, creator: User) -> Challenge:
    challenge = _get_or_404(db, challenge_id)

    if challenge.creator_id != creator.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can cancel this challenge",
        )
    if challenge.status != ChallengeStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending challenges can be cancelled",
        )

    apply_balance_change(
        db, creator, challenge.stake_cents, BalanceEventType.STAKE_REFUND, challenge.id
    )
    challenge.status = ChallengeStatus.CANCELLED

    db.commit()
    db.refresh(challenge)
    return challenge


def set_notion_page(
    db: Session, challenge_id: int, user: User, page_id: str
) -> Challenge:
    challenge = _get_or_404(db, challenge_id)

    if challenge.category != ChallengeCategory.STUDYING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Not a studying challenge"
        )
    if challenge.status != ChallengeStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge is not active"
        )

    if user.id == challenge.creator_id:
        challenge.creator_notion_page_id = page_id
    elif user.id == challenge.opponent_id:
        challenge.opponent_notion_page_id = page_id
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a participant in this challenge",
        )

    db.commit()
    db.refresh(challenge)
    return challenge


# ---------------------------------------------------------------------------
# Live progress refresh (used by GET /{id} and manual refresh endpoints)
# ---------------------------------------------------------------------------

# Min interval between automatic progress refreshes triggered by GET /{id}.
# Prevents thundering-herd against GitHub/Notion when the client polls during evaluation
# or repeatedly opens the detail page.
_AUTO_REFRESH_MIN_INTERVAL_SEC = 30


async def refresh_progress(
    challenge: Challenge, db: Session, *, force: bool = False
) -> None:
    """Update progress for an active challenge by category. Best-effort: third-party errors
    are logged and swallowed. Throttled to once per `_AUTO_REFRESH_MIN_INTERVAL_SEC`
    unless `force=True` (used by explicit refresh endpoints)."""
    if challenge.status != ChallengeStatus.ACTIVE:
        return

    if not force and challenge.last_notion_poll:
        age = (utcnow() - challenge.last_notion_poll).total_seconds()
        if age < _AUTO_REFRESH_MIN_INTERVAL_SEC:
            return

    if challenge.category == ChallengeCategory.CODING:
        await _refresh_coding_progress(challenge, db)
    elif challenge.category == ChallengeCategory.STUDYING:
        await notion_poller.poll_challenge(challenge, db)

    challenge.last_notion_poll = utcnow()
    db.commit()


async def _refresh_coding_progress(challenge: Challenge, db: Session) -> None:
    since = _since(challenge)

    if challenge.creator.github_access_token and challenge.creator.github_username:
        try:
            client = GitHubClient(challenge.creator.github_access_token)
            challenge.creator_progress = await client.get_commits_count(
                challenge.creator.github_username, since
            )
        except Exception as e:
            logger.warning(f"GitHub commits fetch failed for creator: {e}")

    if (
        challenge.opponent
        and challenge.opponent.github_access_token
        and challenge.opponent.github_username
    ):
        try:
            client = GitHubClient(challenge.opponent.github_access_token)
            challenge.opponent_progress = await client.get_commits_count(
                challenge.opponent.github_username, since
            )
        except Exception as e:
            logger.warning(f"GitHub commits fetch failed for opponent: {e}")


# ---------------------------------------------------------------------------
# AI evaluation: kickoff + background run + finalize
# ---------------------------------------------------------------------------

def start_evaluation(db: Session, challenge_id: int, user: User) -> Challenge:
    """Validate, flip status to EVALUATING, return immediately. Idempotent: if
    the challenge is already evaluating or completed, return its current state."""
    challenge = _get_or_404(db, challenge_id)
    _require_participant(challenge, user)

    # Idempotent: already in progress or done
    if challenge.status in (ChallengeStatus.EVALUATING, ChallengeStatus.COMPLETED):
        return challenge

    if challenge.status != ChallengeStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge is not active"
        )
    if not challenge.challenge_prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge has no prompt for AI evaluation",
        )
    if not get_referee():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI referee not available. GEMINI_API_KEY not configured.",
        )

    # Category-specific preconditions so we don't even mark EVALUATING if we'd just fail.
    if challenge.category == ChallengeCategory.CODING:
        if not (challenge.creator.github_access_token and challenge.creator.github_username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Creator has not connected GitHub",
            )
        if not (
            challenge.opponent
            and challenge.opponent.github_access_token
            and challenge.opponent.github_username
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opponent has not connected GitHub",
            )
    elif challenge.category == ChallengeCategory.STUDYING:
        if not challenge.creator.notion_access_token or not challenge.creator_notion_page_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Creator has not selected a study workspace",
            )
        if (
            not challenge.opponent
            or not challenge.opponent.notion_access_token
            or not challenge.opponent_notion_page_id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opponent has not selected a study workspace",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AI evaluation not available for this challenge type",
        )

    challenge.status = ChallengeStatus.EVALUATING
    db.commit()
    db.refresh(challenge)
    return challenge


async def run_evaluation(challenge_id: int) -> None:
    """Background task: fetch activity, call Gemini, finalize. Owns its own DB session.
    On failure, reset status to ACTIVE so the user can retry."""
    db: Session | None = None
    try:
        db = SessionLocal()
        challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
        if not challenge or challenge.status != ChallengeStatus.EVALUATING:
            logger.warning(f"run_evaluation: challenge {challenge_id} not in EVALUATING state")
            return

        referee = get_referee()
        if not referee:
            raise RuntimeError("Gemini referee unavailable mid-evaluation")

        since = _since(challenge)

        if challenge.category == ChallengeCategory.CODING:
            verdict = await _evaluate_coding(challenge, referee, since)
        else:
            verdict = await _evaluate_studying(challenge, referee, since)

        _finalize_evaluation(db, challenge, verdict)
        db.commit()
        db.refresh(challenge)                    # ← add: reload the committed row
        await broadcast_challenge(challenge)     # ← add: push verdict to both players
        logger.info(f"Challenge {challenge_id} evaluated: winner_id={challenge.winner_id}")
    except GeminiQuotaExhausted as e:
        # Don't dump a stack trace for this — it's an expected operational
        # condition. The challenge rolls back to ACTIVE so the user can retry.
        logger.warning(
            f"Evaluation for challenge {challenge_id} aborted — Gemini quota exhausted: {e}"
        )
        _safe_rollback_to_active(db, challenge_id)
    except Exception as e:
        logger.exception(f"Evaluation failed for challenge {challenge_id}: {e}")
        _safe_rollback_to_active(db, challenge_id)
    finally:
        if db is not None:
            db.close()


def _safe_rollback_to_active(db: Session | None, challenge_id: int) -> None:
    """Best-effort: revert a stuck EVALUATING challenge back to ACTIVE so the
    user can retry. Swallows secondary errors so the original failure surfaces."""
    if db is None:
        return
    try:
        db.rollback()
        challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
        if challenge and challenge.status == ChallengeStatus.EVALUATING:
            challenge.status = ChallengeStatus.ACTIVE
            db.commit()
    except Exception:
        logger.exception(
            "Failed to rollback challenge %s status after evaluation error", challenge_id
        )


async def _evaluate_coding(challenge: Challenge, referee, since: datetime) -> dict:
    creator_client = GitHubClient(challenge.creator.github_access_token)
    opponent_client = GitHubClient(challenge.opponent.github_access_token)

    creator_activity = await creator_client.get_user_activity(
        challenge.creator.github_username, since
    )
    opponent_activity = await opponent_client.get_user_activity(
        challenge.opponent.github_username, since
    )

    challenge.creator_progress = len(creator_activity.get("commits", []))
    challenge.opponent_progress = len(opponent_activity.get("commits", []))

    return await referee.evaluate_challenge(
        challenge_prompt=challenge.challenge_prompt,
        creator_activity=creator_activity,
        opponent_activity=opponent_activity,
        creator_username=challenge.creator.github_username,
        opponent_username=challenge.opponent.github_username,
    )


async def _evaluate_studying(challenge: Challenge, referee, since: datetime) -> dict:
    creator_client = NotionClient(challenge.creator.notion_access_token)
    opponent_client = NotionClient(challenge.opponent.notion_access_token)

    creator_activity = await creator_client.get_study_activity(
        challenge.creator_notion_page_id, since
    )
    opponent_activity = await opponent_client.get_study_activity(
        challenge.opponent_notion_page_id, since
    )

    challenge.creator_notion_activity = creator_activity
    challenge.opponent_notion_activity = opponent_activity
    challenge.creator_progress = creator_activity.get("page_count", 0)
    challenge.opponent_progress = opponent_activity.get("page_count", 0)

    return await referee.evaluate_studying_challenge(
        challenge_prompt=challenge.challenge_prompt,
        creator_activity=creator_activity,
        opponent_activity=opponent_activity,
        creator_username=challenge.creator.username,
        opponent_username=challenge.opponent.username,
    )


def _finalize_evaluation(db: Session, challenge: Challenge, verdict: dict) -> None:
    """Persist verdict, set winner, settle balances. Caller commits."""
    personalized = {
        "winner": verdict.get("winner", "tie"),
        "creator_verdict": verdict.get(
            "creator_verdict", verdict.get("verdict", "Evaluation completed.")
        ),
        "opponent_verdict": verdict.get(
            "opponent_verdict", verdict.get("verdict", "Evaluation completed.")
        ),
        "creator_summary": verdict.get("creator_summary", ""),
        "opponent_summary": verdict.get("opponent_summary", ""),
    }
    challenge.ai_verdict = json.dumps(personalized)
    challenge.ai_evaluated_at = utcnow()

    winner_result = (verdict.get("winner") or "").lower()
    stake = challenge.stake_cents
    prize_pool = stake * 2

    if winner_result == "creator":
        challenge.winner_id = challenge.creator_id
        apply_balance_change(
            db, challenge.creator, prize_pool, BalanceEventType.CHALLENGE_WIN, challenge.id
        )
    elif winner_result == "opponent":
        challenge.winner_id = challenge.opponent_id
        apply_balance_change(
            db, challenge.opponent, prize_pool, BalanceEventType.CHALLENGE_WIN, challenge.id
        )
    else:
        # Tie: refund both stakes
        challenge.winner_id = None
        apply_balance_change(
            db, challenge.creator, stake, BalanceEventType.STAKE_REFUND, challenge.id
        )
        apply_balance_change(
            db, challenge.opponent, stake, BalanceEventType.STAKE_REFUND, challenge.id
        )

    challenge.status = ChallengeStatus.COMPLETED
    challenge.completed_at = utcnow()
