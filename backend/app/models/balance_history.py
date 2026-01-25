from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class BalanceHistory(Base):
    __tablename__ = "balance_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Balance snapshot after this event
    balance_cents = Column(Integer, nullable=False)

    # How much changed (positive for gains, negative for losses)
    change_cents = Column(Integer, nullable=False)

    # Type of event: 'deposit', 'challenge_win', 'challenge_loss', 'withdrawal', 'stake', 'stake_refund'
    event_type = Column(String, nullable=False)

    # Optional reference to challenge (for win/loss events)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", backref="balance_history")
    challenge = relationship("Challenge", backref="balance_events")
