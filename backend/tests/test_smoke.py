"""
Smoke tests — verify the app boots and the most security-sensitive bits of
configuration behave as documented. Kept intentionally minimal: this is the
"does the wiring even work" layer; richer unit tests belong alongside the
services they cover.
"""
from datetime import datetime

import pytest
from pydantic import ValidationError


# ---------------------------------------------------------------------------
# Config — SECRET_KEY fail-fast
# ---------------------------------------------------------------------------

def test_settings_rejects_known_default_secret_key():
    """A fresh deploy that forgets to set SECRET_KEY must NOT silently start
    with a publicly-known placeholder — that would make JWTs forgeable."""
    from app.core.config import Settings

    with pytest.raises(ValidationError):
        Settings(SECRET_KEY="your-secret-key-change-in-production")


def test_settings_rejects_short_secret_key():
    from app.core.config import Settings

    with pytest.raises(ValidationError):
        Settings(SECRET_KEY="too-short")


def test_settings_accepts_strong_secret_key():
    from app.core.config import Settings

    s = Settings(SECRET_KEY="a" * 48)
    assert s.SECRET_KEY == "a" * 48


def test_allowed_origins_list_splits_on_commas():
    from app.core.config import Settings

    s = Settings(SECRET_KEY="a" * 48, ALLOWED_ORIGINS="https://a.com, https://b.com")
    assert s.allowed_origins_list == ["https://a.com", "https://b.com"]


# ---------------------------------------------------------------------------
# clock — non-deprecated UTC helper
# ---------------------------------------------------------------------------

def test_utcnow_returns_naive_utc_datetime():
    """`clock.utcnow()` is a drop-in for the deprecated `datetime.utcnow()`
    — must remain naive so DB columns (DateTime without timezone) accept it
    and arithmetic against loaded values doesn't raise TypeError."""
    from app.core.clock import utcnow

    now = utcnow()
    assert isinstance(now, datetime)
    assert now.tzinfo is None


# ---------------------------------------------------------------------------
# App boot — /health endpoint
# ---------------------------------------------------------------------------

def test_health_endpoint_returns_ok():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


# ---------------------------------------------------------------------------
# Gemini fallback chain — order and dedup
# ---------------------------------------------------------------------------

def test_gemini_model_chain_puts_primary_first_and_dedupes():
    from app.core.gemini import _build_model_chain

    chain = _build_model_chain("gemini-2.5-flash")
    assert chain[0] == "gemini-2.5-flash"
    # No duplicates, and contains at least one lighter fallback.
    assert len(chain) == len(set(chain))
    assert any("lite" in m for m in chain)


def test_gemini_model_chain_handles_unknown_primary():
    """Setting GEMINI_MODEL to a non-default model still keeps it first and
    appends the documented fallbacks after it."""
    from app.core.gemini import _build_model_chain

    chain = _build_model_chain("gemini-experimental-x")
    assert chain[0] == "gemini-experimental-x"
    assert "gemini-2.5-flash" in chain
