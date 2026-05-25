"""Add EVALUATING status to challengestatus enum

Revision ID: 5d6e7f8g9h0i
Revises: 4c5d6e7f8g9h
Create Date: 2026-05-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5d6e7f8g9h0i'
down_revision: Union[str, None] = '4c5d6e7f8g9h'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres enums require ALTER TYPE ... ADD VALUE; must run outside a transaction.
    # SQLAlchemy's Enum stores member NAMES, so the existing labels are uppercase
    # ('PENDING', 'ACTIVE', ...). The new label must therefore be 'EVALUATING'.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE challengestatus ADD VALUE IF NOT EXISTS 'EVALUATING' AFTER 'ACTIVE'")


def downgrade() -> None:
    # Postgres has no native DROP VALUE; intentional no-op. Reverting requires
    # recreating the enum type, which is destructive — not worth automating here.
    pass
