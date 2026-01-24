from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.routers import auth, users, challenges

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Rival API",
    description="AI-powered productivity betting platform",
    version="0.1.0"
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


@app.get("/health")
def health_check():
    return {"status": "healthy"}
