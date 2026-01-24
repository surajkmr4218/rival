from pydantic import BaseModel
from datetime import datetime
from app.models.challenge import ChallengeCategory, ChallengeStatus


class UserPublic(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True


class ChallengeCreate(BaseModel):
    category: ChallengeCategory
    stake_cents: int
    opponent_username: str | None = None
    goal_type: str
    goal_value: int
    goal_period: str = "daily"


class ChallengeResponse(BaseModel):
    id: int
    creator: UserPublic
    opponent: UserPublic | None
    category: ChallengeCategory
    stake_cents: int
    prize_pool_cents: int
    goal_type: str
    goal_value: int
    goal_period: str
    status: ChallengeStatus
    creator_progress: int
    opponent_progress: int
    winner_id: int | None
    created_at: datetime
    accepted_at: datetime | None
    ends_at: datetime | None
    completed_at: datetime | None

    class Config:
        from_attributes = True


class ChallengeList(BaseModel):
    challenges: list[ChallengeResponse]


class UserSearchRequest(BaseModel):
    query: str


class UserSearchResponse(BaseModel):
    users: list[UserPublic]
