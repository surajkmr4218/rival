"""
Pytest configuration.

Sets safe environment variables BEFORE the app imports so `Settings` (which
fails fast on a missing/insecure SECRET_KEY) can instantiate cleanly during
tests without needing a real `.env`.
"""
import os

os.environ.setdefault(
    "SECRET_KEY",
    "test-only-secret-key-do-not-use-in-production-padded-to-min-length",
)
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("ALLOWED_ORIGINS", "*")
