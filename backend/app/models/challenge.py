from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class ChallengeCategory(str, enum.Enum):
    CODING = "coding"
    SCREENTIME = "screentime"
    STUDYING = "studying"  # Notion-based studying challenges


class ChallengeStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    opponent_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    category = Column(SQLEnum(ChallengeCategory), nullable=False)
    stake_cents = Column(Integer, nullable=False)

    # AI Referee: free-form challenge prompt
    challenge_prompt = Column(Text, nullable=True)  # e.g., "Make 3 meaningful PRs"
    duration_hours = Column(Integer, default=24)    # Challenge duration

    # Legacy fields (kept for backwards compatibility)
    goal_type = Column(String, nullable=True)   # "commits_min", "screentime_max"
    goal_value = Column(Integer, nullable=True) # e.g., 5 commits, 120 minutes
    goal_period = Column(String, nullable=True) # "daily", "weekly"

    status = Column(SQLEnum(ChallengeStatus), default=ChallengeStatus.PENDING)

    # AI Referee verdict
    ai_verdict = Column(Text, nullable=True)           # AI's evaluation reasoning
    ai_evaluated_at = Column(DateTime, nullable=True)  # When AI made the decision

    # Notion tracking (for studying challenges)
    creator_notion_page_id = Column(String, nullable=True)
    opponent_notion_page_id = Column(String, nullable=True)
    creator_notion_activity = Column(JSON, nullable=True)  # Cached activity data
    opponent_notion_activity = Column(JSON, nullable=True)
    last_notion_poll = Column(DateTime, nullable=True)

    creator_progress = Column(Integer, default=0)
    opponent_progress = Column(Integer, default=0)
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    creator = relationship("User", foreign_keys=[creator_id], backref="created_challenges")
    opponent = relationship("User", foreign_keys=[opponent_id], backref="received_challenges")
    winner = relationship("User", foreign_keys=[winner_id])
