"""Add Notion integration fields

Revision ID: 3b4c5d6e7f8g
Revises: 2a9f3c8d4e5f
Create Date: 2024-01-24 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3b4c5d6e7f8g'
down_revision: Union[str, None] = '2a9f3c8d4e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'STUDYING' to the challengecategory enum (uppercase to match existing values)
    op.execute("ALTER TYPE challengecategory ADD VALUE IF NOT EXISTS 'STUDYING'")

    # Add Notion fields to users table
    op.add_column('users', sa.Column('notion_access_token', sa.String(), nullable=True))
    op.add_column('users', sa.Column('notion_workspace_id', sa.String(), nullable=True))
    op.add_column('users', sa.Column('notion_workspace_name', sa.String(), nullable=True))

    # Add Notion tracking fields to challenges table
    op.add_column('challenges', sa.Column('creator_notion_page_id', sa.String(), nullable=True))
    op.add_column('challenges', sa.Column('opponent_notion_page_id', sa.String(), nullable=True))
    op.add_column('challenges', sa.Column('creator_notion_activity', sa.JSON(), nullable=True))
    op.add_column('challenges', sa.Column('opponent_notion_activity', sa.JSON(), nullable=True))
    op.add_column('challenges', sa.Column('last_notion_poll', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove Notion tracking fields from challenges
    op.drop_column('challenges', 'last_notion_poll')
    op.drop_column('challenges', 'opponent_notion_activity')
    op.drop_column('challenges', 'creator_notion_activity')
    op.drop_column('challenges', 'opponent_notion_page_id')
    op.drop_column('challenges', 'creator_notion_page_id')

    # Remove Notion fields from users
    op.drop_column('users', 'notion_workspace_name')
    op.drop_column('users', 'notion_workspace_id')
    op.drop_column('users', 'notion_access_token')
