# Rival: AI-Powered Productivity Betting

## Elevator Pitch

Rival is a **1v1 productivity betting app** where users commit real money to measurable daily goals and compete against friends. Whether it's making GitHub commits, reducing screen time, or completing study sessions, both players stake equal amounts ($1-$500). An **AI referee powered by Gemini** evaluates outcomes using real-time integrations (GitHub API, Notion, device sensors) and awards the pot to the winner. Winner takes home 85-90% of the combined stake; the platform keeps 10-15% commission.

---

## What is Rival?

Rival turns productivity into a competitive, accountable game. Users can challenge friends with stakes on:

- **Coding**: Make 5+ GitHub commits, open pull requests
- **Studying**: Track study hours, take notes in Notion
- **General Productivity**: Custom measurable goals

The AI referee automatically monitors progress, generates transparent decision reports, and settles disputes fairly.

### Key Features

✅ **Real-Money Stakes**: $1-$500 wagers with transparent payout splits
✅ **Smart Integrations**: GitHub API, Notion, device-level APIs
✅ **AI Referee**: Gemini-powered automated decision-making
✅ **Real-Time Progress**: Live tracking and notifications
✅ **Friend Challenges**: Search and challenge any user or request random matchups
✅ **Leaderboard**: Rankings based on win rate and total earnings
✅ **Transparent Reporting**: Detailed decision logs and payout history

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React Native + Expo (expo-router) |
| **Backend** | FastAPI (Python) |
| **Database** | PostgreSQL with SQLAlchemy ORM |
| **State** | Zustand (frontend) |
| **APIs** | GitHub OAuth, Notion API, Gemini 2.0 Flash |
| **Auth** | JWT tokens |
| **Integrations** | Stripe (ready), GitHub, Notion |

---

## Project Structure

```
rival/
├── frontend/                          # React Native mobile app
│   ├── app/
│   │   ├── (tabs)/                   # Authenticated tab navigation
│   │   │   ├── index.tsx             # Dashboard (home)
│   │   │   ├── active.tsx            # Active challenges
│   │   │   ├── history.tsx           # Challenge history
│   │   │   └── profile.tsx           # User profile & integrations
│   │   ├── challenge/
│   │   │   ├── create.tsx            # Create new challenge
│   │   │   ├── [id].tsx              # Challenge detail & progress
│   │   │   └── pending.tsx           # Pending invitations
│   │   ├── auth/
│   │   │   └── github.tsx            # GitHub OAuth callback
│   │   ├── login.tsx                 # Sign in/up
│   │   └── _layout.tsx               # Root layout & auth guard
│   ├── components/                   # Reusable UI components
│   ├── lib/
│   │   ├── api.ts                    # API client
│   │   ├── types.ts                  # TypeScript types
│   │   └── theme.ts                  # Design tokens
│   └── store/                        # Zustand state management
│
├── backend/                           # FastAPI Python backend
│   ├── app/
│   │   ├── models/                   # SQLAlchemy ORM models
│   │   │   ├── user.py               # User with GitHub/Notion tokens
│   │   │   └── challenge.py          # Challenge tracking
│   │   ├── routers/                  # API endpoints
│   │   │   ├── auth.py               # Authentication
│   │   │   ├── challenges.py         # Challenge CRUD & progress
│   │   │   ├── github.py             # GitHub OAuth & API
│   │   │   ├── notion.py             # Notion OAuth & API
│   │   │   └── users.py              # User profile
│   │   ├── core/
│   │   │   ├── config.py             # Settings (env-based)
│   │   │   ├── security.py           # JWT, password hashing
│   │   │   ├── github.py             # GitHub API client
│   │   │   ├── notion.py             # Notion API client
│   │   │   ├── gemini.py             # Gemini AI client
│   │   │   └── database.py           # DB connection
│   │   ├── schemas/                  # Pydantic request/response schemas
│   │   └── main.py                   # App initialization
│   ├── alembic/                      # Database migrations
│   │   └── versions/                 # Migration scripts
│   ├── requirements.txt               # Python dependencies
│   └── .env                           # Environment variables
│
└── README.md
```

---

## Frontend Routes

| Route | Purpose |
|-------|---------|
| `/login` | Sign in / Sign up |
| `/` | Dashboard - home screen |
| `/active` | Active challenges view |
| `/history` | Past challenges and results |
| `/profile` | User profile, GitHub/Notion connections |
| `/challenge/create` | Create new challenge |
| `/challenge/[id]` | Challenge detail & live progress |
| `/challenge/pending` | Pending challenge invitations |

---

## Backend API Endpoints

### Authentication
```
POST   /api/auth/register          Register new user
POST   /api/auth/login             Login (form-encoded)
GET    /api/users/me               Current user profile
```

### Challenges
```
POST   /api/challenges             Create challenge
GET    /api/challenges             List user's challenges
GET    /api/challenges/active      Active challenges only
GET    /api/challenges/pending     Pending invitations
GET    /api/challenges/{id}        Challenge detail
POST   /api/challenges/{id}/accept Accept challenge
POST   /api/challenges/{id}/decline Decline challenge
GET    /api/challenges/{id}/refresh Update progress
```

### GitHub Integration
```
GET    /api/github/status           Check connection status
GET    /api/github/oauth-url        Get OAuth authorization URL
POST   /api/github/connect          Exchange code for token
DELETE /api/github/disconnect       Remove GitHub connection
GET    /api/github/commits          Get commit count
```

### Notion Integration
```
GET    /api/notion/status           Check connection status
GET    /api/notion/oauth-url        Get OAuth authorization URL
POST   /api/notion/connect          Exchange code for token
DELETE /api/notion/disconnect       Remove Notion connection
GET    /api/notion/pages            List Notion pages
POST   /api/notion/changes          Track workspace changes
```

### Health
```
GET    /health                      Health check
```

---

## Challenge Categories

### 1. **Coding**
Track GitHub productivity with real commit data.
- Goal: "Make 5+ commits"
- Duration: 6h - 1 week
- Auto-verified via GitHub API
- Real-time progress display

### 2. **Studying**
Track study sessions with Notion page links.
- Goal: Custom study objectives
- Notion integration: Link to study pages
- Gemini AI evaluates completion
- Examples: "Write 2000 words on topic X"

### 3. **Custom**
Flexible challenges with AI-powered verification.
- Goal: User-defined objective (text)
- Duration: Custom hours/minutes
- Gemini 2.0 Flash evaluates evidence
- Suitable for: Exercise, learning, projects

---

## AI Referee System

Powered by **Gemini 2.0 Flash**, the AI Referee:

1. **Monitors** real-time data from integrated services (GitHub, Notion, device APIs)
2. **Evaluates** goal completion based on evidence
3. **Generates** transparent decision reports with reasoning
4. **Settles** disputes and awards the pot to the winner
5. **Learns** from user feedback and adjustments

Example verdict:
```
Challenge: "Make 5+ commits with descriptive messages"
User A: 6 commits (avg 15 chars message length) ✅ WIN
User B: 3 commits (avg 8 chars message length) ❌ LOSE
Confidence: 98%
Payout: User A gets $19 (85% of $22.50 pot)
```

---

## Running Locally

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- PostgreSQL 12+
- Expo CLI: `npm install -g expo-cli`

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup database
createdb rival
alembic upgrade head

# Configure environment
cp .env.example .env
# Edit .env with your credentials:
# - DATABASE_URL=postgresql://user:password@localhost/rival
# - SECRET_KEY=your_secret_key
# - GITHUB_CLIENT_ID=your_github_oauth_id
# - GITHUB_CLIENT_SECRET=your_github_oauth_secret
# - NOTION_CLIENT_ID=your_notion_oauth_id
# - NOTION_CLIENT_SECRET=your_notion_oauth_secret
# - GEMINI_API_KEY=your_gemini_api_key

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Expo development server
npx expo start

# Press 'i' for iOS or 'a' for Android
# Or scan QR code with Expo Go app
```

### Environment Variables

**Backend** (`.env`):
```env
# Database
DATABASE_URL=postgresql://user:password@localhost/rival

# Security
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/api/github/callback

# Notion OAuth
NOTION_CLIENT_ID=your_client_id
NOTION_CLIENT_SECRET=your_client_secret
NOTION_REDIRECT_URI=exp://localhost:8081/--/notion/callback

# Gemini API
GEMINI_API_KEY=your_gemini_api_key
```

**Frontend** (`lib/config.ts`):
```typescript
export const BACKEND_URL = 'http://your-mac-ip:8000';
export const API_TIMEOUT = 10000;
```

---

## Design System

| Element | Color | Usage |
|---------|-------|-------|
| Background | `#0a2f1f` | App background |
| Card | `#0d3d28` | Card backgrounds |
| Primary Accent | `#00ff88` | Buttons, highlights |
| Border | `rgba(0, 255, 136, 0.3)` | Card borders |
| Text Primary | `#ffffff` | Main text |
| Text Secondary | `#9ca3af` | Secondary text |
| Success | `#10b981` | Success states |
| Error | `#ef4444` | Error states |
| Warning | `#f59e0b` | Warning states |

---

## Key Features Implemented

✅ User authentication (sign up, login)
✅ GitHub OAuth integration & commit tracking
✅ Notion OAuth integration & page selection
✅ Challenge creation with customizable goals
✅ Real-time progress tracking
✅ Challenge acceptance/decline
✅ User search and friend challenges
✅ Leaderboard and rankings
✅ Challenge history
✅ Gemini AI referee (evaluates custom challenges)
✅ Transparent payout calculations

---

## In Progress / Roadmap

🔄 Stripe payment integration
🔄 AI-powered fraud detection
🔄 Mobile push notifications
🔄 Challenge badges & achievements
🔄 Referral rewards
🔄 API rate limiting
🔄 Challenge analytics dashboard

---

## Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `email` - Unique email
- `hashed_password` - Bcrypt hash
- `github_access_token` - GitHub OAuth token (nullable)
- `github_username` - Verified GitHub username
- `notion_access_token` - Notion OAuth token (nullable)
- `notion_workspace_name` - Notion workspace
- `total_wagered_cents` - Total money staked
- `total_won_cents` - Total money won
- `win_rate` - Calculated win percentage
- `created_at` - Registration timestamp

### Challenges Table
- `id` - Primary key
- `creator_id` - Challenge creator (FK → users)
- `opponent_id` - Challenge opponent (FK → users)
- `category` - enum: 'coding' | 'studying' | 'custom'
- `goal_description` - Text description of goal
- `stake_cents` - Amount staked (in cents)
- `status` - enum: 'pending' | 'active' | 'completed'
- `creator_progress` - Numeric progress toward goal
- `opponent_progress` - Opponent's progress
- `starts_at` - Challenge start time
- `ends_at` - Challenge end time
- `winner_id` - Winner (FK → users, nullable)
- `ai_verdict` - JSON with AI decision details
- `created_at` - Timestamp

---

## Testing

### Backend Tests
```bash
cd backend
pytest tests/
pytest tests/test_auth.py -v
pytest tests/test_challenges.py -v
```

### Frontend Tests
```bash
cd frontend
npm test
npm run test:coverage
```

---

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "feat: description"`
3. Push to remote: `git push origin feature/your-feature`
4. Create a Pull Request

---

## License

MIT

---

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Contact: [support email]

---

**Built with ❤️ for productive competition**
