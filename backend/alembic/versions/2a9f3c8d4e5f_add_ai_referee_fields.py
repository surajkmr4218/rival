"""Add AI referee fields to challenges

Revision ID: 2a9f3c8d4e5f
Revises: 1f70420ebc3d
Create Date: 2024-01-24 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a9f3c8d4e5f'
down_revision: Union[str, None] = '1f70420ebc3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add AI referee fields
    op.add_column('challenges', sa.Column('challenge_prompt', sa.Text(), nullable=True))
    op.add_column('challenges', sa.Column('duration_hours', sa.Integer(), nullable=True, server_default='24'))
    op.add_column('challenges', sa.Column('ai_verdict', sa.Text(), nullable=True))
    op.add_column('challenges', sa.Column('ai_evaluated_at', sa.DateTime(), nullable=True))

    # Make legacy fields nullable
    op.alter_column('challenges', 'goal_type', existing_type=sa.String(), nullable=True)
    op.alter_column('challenges', 'goal_value', existing_type=sa.Integer(), nullable=True)
    op.alter_column('challenges', 'goal_period', existing_type=sa.String(), nullable=True)

    # Migrate existing challenges to have a challenge_prompt based on goal_type/goal_value
    op.execute("""
        UPDATE challenges
        SET challenge_prompt = 'Make ' || goal_value || '+ commits'
        WHERE goal_type = 'commits_min' AND challenge_prompt IS NULL
    """)
    op.execute("""
        UPDATE challenges
        SET challenge_prompt = 'Keep screen time under ' || (goal_value / 60) || ' hours'
        WHERE goal_type = 'screentime_max' AND challenge_prompt IS NULL
    """)


def downgrade() -> None:
    # Remove AI referee fields
    op.drop_column('challenges', 'ai_evaluated_at')
    op.drop_column('challenges', 'ai_verdict')
    op.drop_column('challenges', 'duration_hours')
    op.drop_column('challenges', 'challenge_prompt')

    # Restore NOT NULL on legacy fields
    op.alter_column('challenges', 'goal_type', existing_type=sa.String(), nullable=False)
    op.alter_column('challenges', 'goal_value', existing_type=sa.Integer(), nullable=False)
    op.alter_column('challenges', 'goal_period', existing_type=sa.String(), nullable=False)
