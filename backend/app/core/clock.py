"""Time helpers.

`datetime.utcnow()` is deprecated as of Python 3.12. Its non-deprecated
replacement, `datetime.now(timezone.utc)`, returns a timezone-*aware* value —
but our SQLAlchemy columns are naive `DateTime` (no `timezone=True`), and we do
arithmetic against DB-loaded naive values. Mixing aware/naive raises TypeError,
so this helper returns a naive UTC timestamp to preserve existing semantics
without a schema migration.
"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Current UTC time as a naive datetime (drop-in for ``datetime.utcnow()``)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
