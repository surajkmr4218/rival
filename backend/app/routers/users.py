from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.challenge import Challenge, ChallengeStatus
from app.models.balance_history import BalanceHistory
from app.schemas.user import UserResponse
from app.schemas.challenge import UserPublic, UserSearchRequest, UserSearchResponse
from app.schemas.balance_history import BalanceHistoryResponse, BalanceDataPoint

router = APIRouter(prefix="/api/users", tags=["users"])


class UserStats(BaseModel):
    challenges_won: int
    challenges_lost: int
    total_earnings_cents: int
    current_streak: int
    win_rate: float


class AddBalanceRequest(BaseModel):
    amount_cents: int


def record_balance_change(
    db: Session,
    user: User,
    change_cents: int,
    event_type: str,
    challenge_id: Optional[int] = None,
) -> BalanceHistory:
    """Record a balance change in the history table."""
    record = BalanceHistory(
        user_id=user.id,
        balance_cents=user.balance_cents,
        change_cents=change_cents,
        event_type=event_type,
        challenge_id=challenge_id,
    )
    db.add(record)
    return record


# Period mappings for balance history
PERIOD_DAYS = {
    "1D": 1,
    "1W": 7,
    "1M": 30,
    "6M": 180,
    "1Y": 365,
    "ALL": None,  # No limit
}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/search", response_model=UserSearchResponse)
def search_users(
    search: UserSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search for users by username."""
    if len(search.query) < 2:
        return UserSearchResponse(users=[])

    users = db.query(User).filter(
        User.username.ilike(f"%{search.query}%"),
        User.id != current_user.id,
    ).limit(10).all()

    return UserSearchResponse(
        users=[
            UserPublic(id=u.id, username=u.username, email=u.email)
            for u in users
        ]
    )


@router.get("/me/stats", response_model=UserStats)
def get_user_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user's challenge statistics."""
    # Get all completed challenges for user
    completed = db.query(Challenge).filter(
        ((Challenge.creator_id == current_user.id) | (Challenge.opponent_id == current_user.id)),
        Challenge.status == ChallengeStatus.COMPLETED,
    ).all()

    won = sum(1 for c in completed if c.winner_id == current_user.id)
    lost = len(completed) - won

    # Calculate earnings (wins minus losses)
    earnings = 0
    for c in completed:
        if c.winner_id == current_user.id:
            earnings += c.stake_cents  # Won opponent's stake
        elif c.winner_id is not None:
            earnings -= c.stake_cents  # Lost own stake

    # Calculate streak (consecutive recent wins)
    streak = 0
    for c in sorted(completed, key=lambda x: x.completed_at or x.created_at, reverse=True):
        if c.winner_id == current_user.id:
            streak += 1
        else:
            break

    win_rate = won / len(completed) if completed else 0

    return UserStats(
        challenges_won=won,
        challenges_lost=lost,
        total_earnings_cents=earnings,
        current_streak=streak,
        win_rate=win_rate,
    )


@router.post("/me/balance", response_model=UserResponse)
def add_balance(
    request: AddBalanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add funds to user's balance."""
    if request.amount_cents < 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum top-up amount is $10",
        )

    current_user.balance_cents += request.amount_cents

    # Record balance change
    record_balance_change(
        db=db,
        user=current_user,
        change_cents=request.amount_cents,
        event_type="deposit",
    )

    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me/balance-history", response_model=BalanceHistoryResponse)
def get_balance_history(
    period: str = Query(default="1W", regex="^(1D|1W|1M|6M|1Y|ALL)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user's balance history for charting."""
    # Determine date filter
    days = PERIOD_DAYS.get(period)

    query = db.query(BalanceHistory).filter(
        BalanceHistory.user_id == current_user.id
    )

    if days is not None:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(BalanceHistory.created_at >= cutoff)

    # Get records ordered by time
    records = query.order_by(BalanceHistory.created_at.asc()).all()

    # Build data points
    data_points = [
        BalanceDataPoint(
            timestamp=r.created_at,
            balance_cents=r.balance_cents,
        )
        for r in records
    ]

    # Calculate start and current balance
    current_balance = current_user.balance_cents

    if data_points:
        # Start balance is the balance before the first change in the period
        first_record = records[0]
        start_balance = first_record.balance_cents - first_record.change_cents
    else:
        # No history in period - use current balance as both
        start_balance = current_balance
        # Add a single point at current balance
        data_points = [
            BalanceDataPoint(
                timestamp=datetime.utcnow(),
                balance_cents=current_balance,
            )
        ]

    # Calculate change
    change_cents = current_balance - start_balance
    change_percent = (change_cents / start_balance * 100) if start_balance > 0 else 0.0

    return BalanceHistoryResponse(
        period=period,
        data_points=data_points,
        start_balance_cents=start_balance,
        current_balance_cents=current_balance,
        change_cents=change_cents,
        change_percent=round(change_percent, 2),
    )
