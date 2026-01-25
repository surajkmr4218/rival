import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.routers import auth, users, challenges, github, notion
from app.services.notion_poller import start_polling_loop

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables
Base.metadata.create_all(bind=engine)


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

# CORS for iOS app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
