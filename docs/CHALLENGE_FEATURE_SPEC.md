# Challenge Creation Feature - Implementation Spec

## Overview

Implement a complete challenge creation and acceptance flow for the Rival app. Users can challenge friends to productivity duels with two tracking methods: **Screen Time** (iOS only) and **GitHub Commits**.

---

## User Flow

### 1. Create Challenge Flow
```
Dashboard → "START NEW CHALLENGE" → Create Challenge Screen
                                          ↓
                                    Step 1: Select Category
                                    - Coding Time (GitHub commits)
                                    - Social Limit (Screen Time)
                                          ↓
                                    Step 2: Set Stakes ($1-$500 slider)
                                          ↓
                                    Step 3: Challenge Rival
                                    - Search by username
                                    - OR Random Match
                                          ↓
                                    "LOCK IT IN" → Send Challenge
```

### 2. Accept Challenge Flow
```
Notification/Inbox → Challenge Invitation Screen
                            ↓
                     See challenger info, goal, stake
                            ↓
                     "ACCEPT CHALLENGE" or "DECLINE"
```

---

## Frontend Implementation

### New Files to Create

```
frontend/app/
├── challenge/
│   ├── _layout.tsx           # Stack layout for challenge flow
│   ├── create.tsx            # Create challenge screen (3 steps)
│   ├── [id].tsx              # Challenge detail/accept screen
│   └── pending.tsx           # Pending challenges inbox
├── components/
│   ├── StakeSlider.tsx       # $1-$500 stake slider
│   ├── CategoryPill.tsx      # Selectable category buttons
│   ├── UserSearchInput.tsx   # Search users by username
│   └── ChallengeCard.tsx     # Challenge card for dashboard
```

### Screen: Create Challenge (`/challenge/create`)

**UI Components (based on create_new_challenge.png):**

1. **Header**
   - X button (close/cancel)
   - "NEW CHALLENGE" title

2. **Step 01: SELECT CATEGORY**
   - Horizontal scrollable pills:
     - "Coding Time" (GitHub icon) - tracks commits
     - "Social Limit" (phone icon) - tracks screen time
   - Selected state: green background, white text
   - Unselected: dark background, gray border

3. **Step 02: SET THE STAKES**
   - Card with dark background
   - "YOUR STAKE" label with amount (e.g., $45)
   - "PRIZE POOL" label showing 2x stake (e.g., $90)
   - Slider: $1 min, $500 max
   - Helper text: "Opponent must match your stake to begin."

4. **Step 03: CHALLENGE RIVAL**
   - Search input: "Invite friend by username..."
   - OR "Random Match" button with shuffle icon

5. **AI REFEREE RULES** (info card)
   - "Automated Monitoring" - explains GitHub Webhooks / Screen Time APIs
   - "Escrow Security" - stakes locked until AI decides winner

6. **CTA Button**
   - "LOCK IT IN ⚡" - green button, full width

**State:**
```typescript
interface CreateChallengeState {
  category: 'coding' | 'screentime' | null;
  stakeAmount: number;  // cents
  opponentUsername: string;
  isRandomMatch: boolean;
}
```

### Screen: Accept Challenge (`/challenge/[id]`)

**UI Components (based on accept_challenge.png):**

1. **Header**
   - Back arrow
   - "Challenge Invitation" title

2. **Challenger Info**
   - Avatar image
   - "[Name] challenged you!"
   - Subtitle: "Productivity Duel"

3. **Challenge Image** (optional decorative)

4. **CHALLENGE SUMMARY** card
   - "Goal: Code for 4+ Hours" or "Goal: Screen Time < 2hrs"
   - "Stake: $10.00" with green dot

5. **AI Referee Rules** (collapsible)

6. **Action Buttons**
   - "ACCEPT CHALLENGE" - green button
   - "DECLINE" - dark/gray button

---

## Backend Implementation

### New API Endpoints

```
POST   /api/challenges              # Create challenge
GET    /api/challenges              # List user's challenges
GET    /api/challenges/{id}         # Get challenge details
POST   /api/challenges/{id}/accept  # Accept challenge
POST   /api/challenges/{id}/decline # Decline challenge
GET    /api/challenges/pending      # Get pending invitations

POST   /api/users/search            # Search users by username
POST   /api/integrations/github/connect    # OAuth connect GitHub
GET    /api/integrations/github/commits    # Fetch commit data
```

### Database Models

```python
# models/challenge.py

class ChallengeCategory(str, Enum):
    CODING = "coding"        # GitHub commits
    SCREENTIME = "screentime" # iOS Screen Time

class ChallengeStatus(str, Enum):
    PENDING = "pending"      # Waiting for opponent to accept
    ACTIVE = "active"        # In progress
    COMPLETED = "completed"  # Finished, winner decided
    DECLINED = "declined"    # Opponent declined
    CANCELLED = "cancelled"  # Creator cancelled

class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True)
    creator_id = Column(Integer, ForeignKey("users.id"))
    opponent_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    category = Column(Enum(ChallengeCategory))
    stake_cents = Column(Integer)  # Each user's stake

    # Goal details (JSON or separate fields)
    goal_type = Column(String)  # "commits_min", "screentime_max"
    goal_value = Column(Integer)  # e.g., 5 commits, 120 minutes
    goal_period = Column(String)  # "daily", "weekly"

    status = Column(Enum(ChallengeStatus), default=ChallengeStatus.PENDING)

    # Results
    creator_progress = Column(Integer, default=0)
    opponent_progress = Column(Integer, default=0)
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
```

### GitHub Integration

```python
# core/github.py

# 1. OAuth flow to connect user's GitHub account
# 2. Store access_token in user profile (encrypted)
# 3. Webhook or polling to track commits

class GitHubIntegration:
    async def connect_account(self, user_id: int, oauth_code: str):
        """Exchange OAuth code for access token, store in DB"""
        pass

    async def get_commits_count(self, user_id: int, since: datetime) -> int:
        """Fetch commit count from GitHub API"""
        # GET /users/{username}/events
        # Filter for PushEvent, count commits
        pass

    async def setup_webhook(self, user_id: int, repo: str):
        """Setup webhook for real-time commit tracking"""
        pass
```

### Screen Time Integration (iOS)

```typescript
// This requires native iOS module via expo-modules or bare workflow

// Option 1: expo-screen-time (if available)
// Option 2: Native iOS DeviceActivity framework (requires bare workflow)
// Option 3: User manually grants access via iOS Settings

// For MVP: User self-reports or screenshots
// For production: Use DeviceActivityMonitor API (iOS 15+)
```

**Note:** iOS Screen Time API is restricted. Options:
1. **Family Controls framework** - Requires Apple approval
2. **User self-report** - User enters their screen time manually
3. **Screenshot verification** - AI verifies screenshot of Screen Time

---

## API Schemas

```python
# schemas/challenge.py

class ChallengeCreate(BaseModel):
    category: ChallengeCategory
    stake_cents: int  # 100 = $1.00
    opponent_username: str | None = None  # null for random match
    goal_type: str
    goal_value: int
    goal_period: str = "daily"

class ChallengeResponse(BaseModel):
    id: int
    creator: UserPublic
    opponent: UserPublic | None
    category: ChallengeCategory
    stake_cents: int
    prize_pool_cents: int  # stake * 2
    goal_type: str
    goal_value: int
    status: ChallengeStatus
    creator_progress: int
    opponent_progress: int
    ends_at: datetime | None

class ChallengeAccept(BaseModel):
    challenge_id: int

class UserSearch(BaseModel):
    query: str  # username search

class UserSearchResult(BaseModel):
    users: list[UserPublic]
```

---

## Implementation Order

### Phase 1: Core Challenge CRUD
1. Create Challenge model and migration
2. Create challenge endpoints (create, list, get)
3. Build Create Challenge screen UI
4. Build Challenge detail/accept screen UI

### Phase 2: User Discovery
1. Add username search endpoint
2. Build UserSearchInput component
3. Implement random matching logic

### Phase 3: GitHub Integration
1. Setup GitHub OAuth app
2. Implement OAuth flow in app
3. Build commit tracking service
4. Setup webhooks for real-time updates

### Phase 4: Screen Time (MVP)
1. Build manual entry UI for screen time
2. Screenshot upload for verification
3. AI verification of screenshots (future)

### Phase 5: Challenge Resolution
1. Background job to check challenge completion
2. AI referee logic to determine winner
3. Update balances (winner gets prize pool)
4. Push notifications for results

---

## Design Reference

Colors (from theme.ts):
- Background: #0a2f1f
- Card: #0d3d28
- Accent (green): #00ff88
- Border: rgba(0, 255, 136, 0.3)
- Text: #ffffff
- Text muted: #9ca3af
- Error/Loss: #ef4444
- Win: #00ff88

Typography:
- Headers: Bold, uppercase
- Step labels: "STEP 01" in green, small caps
- Amounts: Large, bold ($45, $90)

Components:
- Pills: Rounded, border, icon + text
- Slider: Green track, circular thumb
- Cards: Dark background, subtle border
- Buttons: Full-width, rounded, green or dark

---

## Testing Checklist

- [ ] Create challenge with coding category
- [ ] Create challenge with screen time category
- [ ] Search and select opponent by username
- [ ] Random match creates challenge without opponent
- [ ] Stake slider works from $1-$500
- [ ] Challenge appears in opponent's pending list
- [ ] Accept challenge updates status to active
- [ ] Decline challenge updates status to declined
- [ ] GitHub OAuth connects successfully
- [ ] Commits are tracked correctly
- [ ] Challenge ends at correct time
- [ ] Winner is determined correctly
- [ ] Balances update after challenge completes
