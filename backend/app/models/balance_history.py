import enum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.clock import utcnow


class BalanceEventType(str, enum.Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    STAKE = "stake"
    STAKE_REFUND = "stake_refund"
    CHALLENGE_WIN = "challenge_win"
    CHALLENGE_LOSS = "challenge_loss"


class BalanceHistory(Base):
    __tablename__ = "balance_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Balance snapshot after this event
    balance_cents = Column(Integer, nullable=False)

    # How much changed (positive for gains, negative for losses)
    change_cents = Column(Integer, nullable=False)

    # Stored as string for backwards compatibility with existing rows.
    # Use BalanceEventType members at call sites.
    event_type = Column(String, nullable=False)

    # Optional reference to challenge (for win/loss events)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=True)

    created_at = Column(DateTime, default=utcnow, index=True)

    # Relationships
    user = relationship("User", backref="balance_history")
    challenge = relationship("Challenge", backref="balance_events")
