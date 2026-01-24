from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone, date
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/screentime", tags=["screentime"])


class ScreenTimeEntry(BaseModel):
    """Manual screen time entry."""
    date: date
    minutes: int  # Total screen time in minutes
    category: Optional[str] = None  # e.g., "social", "entertainment", "productivity"


class ScreenTimeResponse(BaseModel):
    id: int
    user_id: int
    date: date
    minutes: int
    category: Optional[str]
    created_at: datetime


class ScreenTimeSummary(BaseModel):
    total_minutes: int
    daily_average: int
    entries_count: int


# In-memory storage for MVP (replace with database model later)
# This is temporary - in production, create a ScreenTimeEntry model
_screentime_entries: dict[int, list[dict]] = {}


@router.post("/entry", response_model=dict)
def submit_screentime(
    entry: ScreenTimeEntry,
    current_user: User = Depends(get_current_user),
):
    """Submit a manual screen time entry."""
    if entry.minutes < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minutes cannot be negative",
        )

    if current_user.id not in _screentime_entries:
        _screentime_entries[current_user.id] = []

    # Check if entry for this date already exists
    for existing in _screentime_entries[current_user.id]:
        if existing["date"] == entry.date:
            # Update existing entry
            existing["minutes"] = entry.minutes
            existing["category"] = entry.category
            existing["updated_at"] = datetime.now(timezone.utc)
            return {
                "success": True,
                "message": "Screen time entry updated",
                "entry": existing,
            }

    # Create new entry
    new_entry = {
        "id": len(_screentime_entries[current_user.id]) + 1,
        "user_id": current_user.id,
        "date": entry.date,
        "minutes": entry.minutes,
        "category": entry.category,
        "created_at": datetime.now(timezone.utc),
    }
    _screentime_entries[current_user.id].append(new_entry)

    return {
        "success": True,
        "message": "Screen time entry submitted",
        "entry": new_entry,
    }


@router.get("/entries")
def get_screentime_entries(
    days: int = 7,
    current_user: User = Depends(get_current_user),
):
    """Get screen time entries for the current user."""
    entries = _screentime_entries.get(current_user.id, [])

    # Filter to last N days
    cutoff = date.today().toordinal() - days
    recent_entries = [
        e for e in entries
        if e["date"].toordinal() >= cutoff
    ]

    return {
        "entries": sorted(recent_entries, key=lambda x: x["date"], reverse=True),
        "count": len(recent_entries),
    }


@router.get("/today")
def get_today_screentime(
    current_user: User = Depends(get_current_user),
):
    """Get today's screen time entry."""
    entries = _screentime_entries.get(current_user.id, [])
    today = date.today()

    for entry in entries:
        if entry["date"] == today:
            return {"entry": entry, "found": True}

    return {"entry": None, "found": False}


@router.get("/summary", response_model=ScreenTimeSummary)
def get_screentime_summary(
    days: int = 7,
    current_user: User = Depends(get_current_user),
):
    """Get screen time summary for the current user."""
    entries = _screentime_entries.get(current_user.id, [])

    # Filter to last N days
    cutoff = date.today().toordinal() - days
    recent_entries = [
        e for e in entries
        if e["date"].toordinal() >= cutoff
    ]

    total_minutes = sum(e["minutes"] for e in recent_entries)
    entries_count = len(recent_entries)
    daily_average = total_minutes // entries_count if entries_count > 0 else 0

    return ScreenTimeSummary(
        total_minutes=total_minutes,
        daily_average=daily_average,
        entries_count=entries_count,
    )
