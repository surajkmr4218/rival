from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)  # Nullable for Apple Sign In users
    apple_user_id = Column(String, unique=True, index=True, nullable=True)
    balance_cents = Column(Integer, default=0)

    # GitHub integration
    github_access_token = Column(String, nullable=True)
    github_username = Column(String, nullable=True)

    # Notion integration
    notion_access_token = Column(String, nullable=True)
    notion_workspace_id = Column(String, nullable=True)
    notion_workspace_name = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
