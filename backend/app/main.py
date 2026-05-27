import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.rate_limit import limiter
from app.routers import auth, users, challenges, github, notion
from app.services.notion_poller import start_polling_loop

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Schema is managed exclusively by Alembic (`alembic upgrade head`, run from
# entrypoint.sh). We deliberately do NOT call Base.metadata.create_all here:
# it bypasses migration history and lets the live schema drift from the
# version-controlled migrations.


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle - start background tasks on startup."""
    # Start background polling task
    polling_task = asyncio.create_task(start_polling_loop())
    logger.info("Background Notion polling started")

    yield

    # Cancel on shutdown
    polling_task.cancel()
    try:
        await polling_task
    except asyncio.CancelledError:
        logger.info("Background Notion polling stopped")


app = FastAPI(
    title="Rival API",
    description="AI-powered productivity betting platform",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiter (slowapi) — protects expensive endpoints like Gemini-backed /evaluate.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — origins are env-configurable (ALLOWED_ORIGINS, comma-separated).
# Never combine wildcard origins with credentials: it's invalid per the CORS
# spec and most browsers ignore the Access-Control-Allow-Credentials header
# in that combination. We use Bearer JWTs anyway, so credentials aren't needed
# when origins are wildcarded for the native client.
_allowed_origins = settings.allowed_origins_list
_allow_credentials = "*" not in _allowed_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(challenges.router)
app.include_router(github.router)
app.include_router(notion.router)


@app.get("/health")
def health_check():
    return {"status": "healthy"}
