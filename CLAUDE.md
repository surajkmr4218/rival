# Rival - AI-Powered Productivity Betting

## PRODUCT CONTEXT

Rival is a 1v1 productivity betting app where users commit money to measurable daily goals
(e.g., "stay under 2 hours of social media", "code for 4+ hours", "make 5 GitHub commits").
Both users stake equal amounts ($1-$20 typical). An AI referee evaluates outcomes using
device-level signals, generates an auditable decision report, and awards the pot to the winner.
Platform takes 10-15% commission.

## Tech Stack

- **Frontend**: Swift/SwiftUI (iOS)
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL with SQLAlchemy
- **Payments**: Stripe (not yet implemented)
- **AI**: Gemini API (not yet implemented)

## Design System

- **Background**: Dark green (#0a2f1f)
- **Primary accent**: Neon green (#00ff88)
- **Card backgrounds**: Slightly lighter green with borders
- **Text**: White primary, gray secondary
- **Buttons**: Neon green with dark text

## Project Structure

```
rival/
├── backend/           # FastAPI Python backend
│   ├── app/
│   │   ├── models/    # SQLAlchemy models
│   │   ├── routers/   # API endpoints
│   │   ├── schemas/   # Pydantic schemas
│   │   └── core/      # Config, security, database
│   └── requirements.txt
├── ios/               # Swift/SwiftUI iOS app
│   └── Rival/
│       ├── Models/
│       ├── Views/
│       ├── ViewModels/
│       └── Services/
└── CLAUDE.md
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Get JWT token
- `GET /api/users/me` - Get current user

### Challenges (future)
- `POST /api/challenges` - Create challenge
- `GET /api/challenges` - List user's challenges
- `POST /api/challenges/{id}/accept` - Accept challenge
- `POST /api/challenges/{id}/verdict` - AI generates verdict
