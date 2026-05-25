"""
Balance mutations with audit trail.

All balance changes flow through `apply_balance_change` so the User row and
the BalanceHistory ledger always stay in sync.
"""

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.balance_history import BalanceEventType, BalanceHistory


def apply_balance_change(
    db: Session,
    user: User,
    change_cents: int,
    event_type: BalanceEventType,
    challenge_id: int | None = None,
) -> None:
    """
    Mutate `user.balance_cents` by `change_cents` and append a matching
    BalanceHistory row snapshotting the new balance. Caller is responsible
    for committing the session.
    """
    user.balance_cents += change_cents
    db.add(
        BalanceHistory(
            user_id=user.id,
            balance_cents=user.balance_cents,
            change_cents=change_cents,
            event_type=event_type.value,
            challenge_id=challenge_id,
        )
    )
