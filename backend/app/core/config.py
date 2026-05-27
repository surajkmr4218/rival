from pydantic import field_validator
from pydantic_settings import BaseSettings


# Values that have shipped as placeholder defaults in this repo at various
# points — refuse to start with any of them so a fresh-clone-with-no-.env
# never silently runs with a signing key everyone on GitHub can read.
_UNSAFE_SECRET_KEYS: frozenset[str] = frozenset({
    "",
    "your-secret-key-change-in-production",
    "change-this-in-production",
    "change-me-to-a-long-random-string",
    "replace-with-a-long-random-string",
})


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://localhost/rival"

    # JWT signing key. Required — no insecure default. Generate one with:
    #   python -c "import secrets; print(secrets.token_urlsafe(48))"
    SECRET_KEY: str

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    APPLE_BUNDLE_ID: str = "com.rivalhax1347.app"

    # CORS — comma-separated list of allowed origins. Defaults to "*" so the
    # native iOS/Android client (which doesn't enforce CORS anyway) works out
    # of the box; tighten this for any browser client / production deploy.
    # `*` together with credentials is never honored — see main.py.
    ALLOWED_ORIGINS: str = "*"

    # GitHub OAuth
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = ""

    # AI Referee (Gemini)
    GEMINI_API_KEY: str = ""
    # Primary model. The referee will fall back to lighter models on quota errors,
    # so this is just the first choice. See app/core/gemini.py for the chain.
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Notion OAuth
    NOTION_CLIENT_ID: str = ""
    NOTION_CLIENT_SECRET: str = ""
    NOTION_REDIRECT_URI: str = ""

    @field_validator("SECRET_KEY")
    @classmethod
    def _reject_unsafe_secret_key(cls, value: str) -> str:
        if value in _UNSAFE_SECRET_KEYS:
            raise ValueError(
                "SECRET_KEY must be set to a strong random value (not a placeholder). "
                "Generate one with:\n"
                "    python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        if len(value) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters for security")
        return value

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
