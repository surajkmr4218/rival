# Rival - AI-Powered Productivity Betting

## PRODUCT CONTEXT

Rival is a 1v1 productivity betting app where users commit money to measurable daily goals
(e.g., "stay under 2 hours of social media", "code for 4+ hours", "make 5 GitHub commits").
Both users stake equal amounts ($1-$20 typical). An AI referee evaluates outcomes using
device-level signals, generates an auditable decision report, and awards the pot to the winner.
Platform takes 10-15% commission.

## Tech Stack

- **Frontend**: React Native + Expo (with expo-router)
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL with SQLAlchemy
- **State**: Zustand
- **API**: Axios
- **Payments**: Stripe (not yet implemented)
- **AI**: Gemini API (not yet implemented)

## Design System

- **Background**: Dark green (#0a2f1f)
- **Card**: Slightly lighter green (#0d3d28)
- **Primary accent**: Neon green (#00ff88)
- **Border**: rgba(0, 255, 136, 0.3)
- **Text**: White primary (#ffffff), gray secondary (#9ca3af)
- **Error**: Red (#ef4444)
- **Buttons**: Neon green with dark text

## Project Structure

```
rival/
├── backend/                 # FastAPI Python backend
│   ├── app/
│   │   ├── models/          # SQLAlchemy models
│   │   ├── routers/         # API endpoints
│   │   ├── schemas/         # Pydantic schemas
│   │   └── core/            # Config, security, database
│   ├── alembic/             # Database migrations
│   └── requirements.txt
│
├── frontend/                # React Native + Expo
│   └── app/                 # File-based routing (expo-router)
│       ├── _layout.tsx      # Root layout (auth guard)
│       ├── login.tsx        # /login
│       │
│       ├── (tabs)/          # Authenticated tab group
│       │   ├── _layout.tsx  # Tab bar config
│       │   ├── index.tsx    # Dashboard (home)
│       │   ├── active.tsx   # Active challenges
│       │   ├── leaderboard.tsx
│       │   └── profile.tsx
│       │
│       ├── challenge/       # Challenge flow (future)
│       │   ├── create.tsx   # /challenge/create
│       │   └── [id].tsx     # /challenge/123 (detail)
│       │
│       ├── components/      # Reusable UI components
│       ├── api/             # API client, storage, types
│       ├── store/           # Zustand stores
│       ├── hooks/           # Custom hooks
│       ├── config.ts        # Backend URL
│       └── theme.ts         # Colors
│
└── CLAUDE.md
```

## Frontend Routes

| Route | File | Description |
|-------|------|-------------|
| /login | app/login.tsx | Sign in / Sign up |
| / | app/(tabs)/index.tsx | Dashboard |
| /active | app/(tabs)/active.tsx | Active challenges |
| /leaderboard | app/(tabs)/leaderboard.tsx | Rankings |
| /profile | app/(tabs)/profile.tsx | User profile |

## Backend Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login (form-encoded) |
| GET | /api/users/me | Get current user |
| GET | /health | Health check |

## Running Locally

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npx expo start
```

**Database:**
```bash
createdb rival
cd backend && alembic upgrade head
```
