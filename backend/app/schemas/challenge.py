from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, Any
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
    # For studying challenges: creator selects their page upfront
    creator_notion_page_id: Optional[str] = None

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

class ChallengeAccept(BaseModel):
    """Schema for accepting a challenge."""
    # For studying challenges: opponent selects their page when accepting
    opponent_notion_page_id: Optional[str] = None

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
    # Notion (for studying challenges)
    creator_notion_page_id: Optional[str] = None
    opponent_notion_page_id: Optional[str] = None
    creator_notion_activity: Optional[Any] = None  # JSON object
    opponent_notion_activity: Optional[Any] = None
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


def challenge_to_response(c) -> ChallengeResponse:
    """Build the API response shape from a Challenge model row.

    Single source of truth — used by REST routes AND WebSocket broadcasts so
    the frontend always sees one consistent shape.
    """
    return ChallengeResponse(
        id=c.id,
        creator=UserPublic(id=c.creator.id, username=c.creator.username, email=c.creator.email),
        opponent=(
            UserPublic(id=c.opponent.id, username=c.opponent.username, email=c.opponent.email)
            if c.opponent
            else None
        ),
        category=c.category,
        stake_cents=c.stake_cents,
        prize_pool_cents=c.stake_cents * 2,
        challenge_prompt=c.challenge_prompt,
        duration_hours=c.duration_hours or 24,
        goal_type=c.goal_type,
        goal_value=c.goal_value,
        goal_period=c.goal_period,
        status=c.status,
        creator_progress=c.creator_progress,
        opponent_progress=c.opponent_progress,
        winner_id=c.winner_id,
        ai_verdict=c.ai_verdict,
        ai_evaluated_at=c.ai_evaluated_at,
        creator_notion_page_id=c.creator_notion_page_id,
        opponent_notion_page_id=c.opponent_notion_page_id,
        creator_notion_activity=c.creator_notion_activity,
        opponent_notion_activity=c.opponent_notion_activity,
        created_at=c.created_at,
        accepted_at=c.accepted_at,
        ends_at=c.ends_at,
        completed_at=c.completed_at,
    )