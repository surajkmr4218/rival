from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://localhost/rival"
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    APPLE_BUNDLE_ID: str = "com.rivalhax1347.app"

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

    class Config:
        env_file = ".env"


settings = Settings()
