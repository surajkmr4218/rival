from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional
from app.models.challenge import ChallengeCategory, ChallengeStatus


class UserPublic(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True


class ChallengeCreate(BaseModel):
    """Schema for creating a new challenge."""
    category: ChallengeCategory
    stake_cents: int
    opponent_username: Optional[str] = None
    challenge_prompt: str  # AI-evaluated challenge description
    duration_hours: int = 24

    @field_validator("challenge_prompt")
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Challenge prompt must be at least 10 characters")
        if len(v) > 500:
            raise ValueError("Challenge prompt must be under 500 characters")
        return v

    @field_validator("stake_cents")
    @classmethod
    def validate_stake(cls, v: int) -> int:
        if v < 100:  # Minimum $1
            raise ValueError("Minimum stake is $1 (100 cents)")
        if v > 50000:  # Maximum $500
            raise ValueError("Maximum stake is $500 (50000 cents)")
        return v

    @field_validator("duration_hours")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Duration must be at least 1 hour")
        if v > 168:  # Max 1 week
            raise ValueError("Duration cannot exceed 168 hours (1 week)")
        return v


class ChallengeResponse(BaseModel):
    """Schema for challenge responses."""
    id: int
    creator: UserPublic
    opponent: Optional[UserPublic]
    category: ChallengeCategory
    stake_cents: int
    prize_pool_cents: int
    challenge_prompt: Optional[str]
    duration_hours: int
    # Legacy fields (for backwards compatibility)
    goal_type: Optional[str] = None
    goal_value: Optional[int] = None
    goal_period: Optional[str] = None
    # Status & progress
    status: ChallengeStatus
    creator_progress: int
    opponent_progress: int
    winner_id: Optional[int]
    # AI Referee
    ai_verdict: Optional[str]
    ai_evaluated_at: Optional[datetime]
    # Timestamps
    created_at: datetime
    accepted_at: Optional[datetime]
    ends_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ChallengeList(BaseModel):
    """Schema for list of challenges."""
    challenges: list[ChallengeResponse]


class AIVerdictResponse(BaseModel):
    """Schema for AI evaluation response."""
    winner: str  # "creator", "opponent", or "tie"
    verdict: str
    creator_summary: str
    opponent_summary: str


class UserSearchRequest(BaseModel):
    query: str


class UserSearchResponse(BaseModel):
    users: list[UserPublic]
