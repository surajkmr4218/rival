from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class BalanceDataPoint(BaseModel):
    timestamp: datetime
    balance_cents: int

    class Config:
        from_attributes = True


class BalanceHistoryResponse(BaseModel):
    period: str
    data_points: List[BalanceDataPoint]
    start_balance_cents: int
    current_balance_cents: int
    change_cents: int
    change_percent: float


class BalanceHistoryRecord(BaseModel):
    id: int
    balance_cents: int
    change_cents: int
    event_type: str
    challenge_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
