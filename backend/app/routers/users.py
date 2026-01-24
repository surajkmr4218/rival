from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse
from app.schemas.challenge import UserPublic, UserSearchRequest, UserSearchResponse

router = APIRouter(prefix="/api/users", tags=["users"])


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
