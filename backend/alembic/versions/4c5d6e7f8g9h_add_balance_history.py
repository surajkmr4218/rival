"""Add balance_history table

Revision ID: 4c5d6e7f8g9h
Revises: 3b4c5d6e7f8g
Create Date: 2026-01-25 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c5d6e7f8g9h'
down_revision: Union[str, None] = '3b4c5d6e7f8g'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('balance_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('balance_cents', sa.Integer(), nullable=False),
        sa.Column('change_cents', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('challenge_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['challenge_id'], ['challenges.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_balance_history_id'), 'balance_history', ['id'], unique=False)
    op.create_index(op.f('ix_balance_history_created_at'), 'balance_history', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_balance_history_created_at'), table_name='balance_history')
    op.drop_index(op.f('ix_balance_history_id'), table_name='balance_history')
    op.drop_table('balance_history')
