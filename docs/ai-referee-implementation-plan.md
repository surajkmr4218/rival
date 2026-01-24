# AI Referee Implementation Plan

## Overview

Replace the hardcoded "5+ commits" challenge system with a flexible AI-powered referee that evaluates GitHub productivity based on user-defined challenge prompts.

**Current State:** Fixed goal types (commits_min, screentime_max) with numeric thresholds.

**Target State:** Free-form challenge prompts ("make 2 meaningful PRs", "10 quality commits") evaluated by Gemini AI acting as an impartial referee.

---

## User Experience

### Challenge Creation Flow

```
┌─────────────────────────────────────┐
│  NEW CHALLENGE                      │
├─────────────────────────────────────┤
│  Category: [Coding] [Screen Time]   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Describe the challenge...   │    │
│  │                             │    │
│  │ "Make 3 meaningful PRs to   │    │
│  │  open source projects"      │    │
│  └─────────────────────────────┘    │
│                                     │
│  Examples:                          │
│  • "10 commits with descriptive     │
│     messages"                       │
│  • "2 pull requests merged"         │
│  • "Most lines of code written"     │
│                                     │
│  Stakes: $10        Prize: $20      │
│                                     │
│  [LOCK IT IN]                       │
└─────────────────────────────────────┘
```

### Challenge Evaluation Display

```
┌─────────────────────────────────────┐
│  CHALLENGE COMPLETE                 │
├─────────────────────────────────────┤
│  🏆 Winner: @alice                  │
│                                     │
│  AI REFEREE VERDICT                 │
│  ─────────────────                  │
│  "Alice made 4 PRs with thorough    │
│   descriptions and meaningful code  │
│   changes. Bob made 2 PRs but one   │
│   was a typo fix. Based on the      │
│   challenge criteria of 'meaningful │
│   PRs', Alice wins."                │
│                                     │
│  @alice: 4 PRs, 847 lines changed   │
│  @bob: 2 PRs, 23 lines changed      │
│                                     │
│  [VIEW DETAILS]                     │
└─────────────────────────────────────┘
```

---

## Architecture

### System Components

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  GitHub API  │
│  (Expo RN)   │     │  (FastAPI)   │     │              │
└──────────────┘     └──────┬───────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Gemini API  │
                    │  (Referee)   │
                    └──────────────┘
```

### Data Flow

1. **Challenge Creation**
   - User enters free-form challenge prompt
   - Backend validates prompt (non-empty, reasonable length)
   - Challenge stored with prompt text

2. **Challenge Evaluation** (on demand or scheduled)
   - Fetch GitHub activity for both users since `accepted_at`
   - Compile activity report (commits, PRs, issues, etc.)
   - Send to Gemini with challenge prompt for evaluation
   - Store AI verdict and winner determination

---

## Database Changes

### Challenge Model Updates

```python
# backend/app/models/challenge.py

class Challenge(Base):
    # Existing fields...

    # REMOVE or deprecate:
    # goal_type: str      # "commits_min", "screentime_max"
    # goal_value: int     # 5, 120

    # ADD:
    challenge_prompt = Column(Text, nullable=False)  # User's challenge description
    ai_verdict = Column(Text, nullable=True)         # AI's evaluation reasoning
    ai_evaluated_at = Column(DateTime, nullable=True)

    # Keep for backwards compatibility during migration:
    goal_type = Column(String, nullable=True)        # Now optional
    goal_value = Column(Integer, nullable=True)      # Now optional
```

### Migration

```sql
-- Alembic migration
ALTER TABLE challenges ADD COLUMN challenge_prompt TEXT;
ALTER TABLE challenges ADD COLUMN ai_verdict TEXT;
ALTER TABLE challenges ADD COLUMN ai_evaluated_at TIMESTAMP;

-- Migrate existing challenges
UPDATE challenges
SET challenge_prompt = 'Make ' || goal_value || '+ commits'
WHERE goal_type = 'commits_min';
```

---

## Backend Implementation

### 1. Gemini Integration Module

**File:** `backend/app/core/gemini.py`

```python
import google.generativeai as genai
from app.core.config import settings

class GeminiReferee:
    """AI Referee for evaluating coding challenges."""

    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    async def evaluate_challenge(
        self,
        challenge_prompt: str,
        creator_activity: dict,
        opponent_activity: dict,
        creator_username: str,
        opponent_username: str,
    ) -> dict:
        """
        Evaluate a challenge and determine the winner.

        Returns:
            {
                "winner": "creator" | "opponent" | "tie",
                "verdict": "Detailed explanation...",
                "creator_score": 85,
                "opponent_score": 72,
            }
        """

        system_prompt = """You are an impartial AI referee for a productivity challenge app.

Your job is to evaluate GitHub activity and determine who better fulfilled the challenge criteria.

Rules:
1. Be fair and objective
2. Focus on the SPECIFIC challenge criteria, not general productivity
3. Quality matters more than quantity unless quantity is specifically requested
4. Provide clear reasoning for your decision
5. If it's genuinely too close to call, declare a tie

Output your response as JSON:
{
    "winner": "creator" | "opponent" | "tie",
    "verdict": "2-3 sentence explanation of your decision",
    "creator_summary": "Brief summary of creator's relevant activity",
    "opponent_summary": "Brief summary of opponent's relevant activity"
}"""

        user_prompt = f"""
CHALLENGE: "{challenge_prompt}"

CREATOR (@{creator_username}) GITHUB ACTIVITY:
{self._format_activity(creator_activity)}

OPPONENT (@{opponent_username}) GITHUB ACTIVITY:
{self._format_activity(opponent_activity)}

Based on the challenge criteria, who wins?"""

        response = await self.model.generate_content_async(
            [system_prompt, user_prompt],
            generation_config={"response_mime_type": "application/json"}
        )

        return json.loads(response.text)

    def _format_activity(self, activity: dict) -> str:
        """Format GitHub activity for the AI prompt."""
        lines = []

        if activity.get("commits"):
            lines.append(f"Commits ({len(activity['commits'])}):")
            for commit in activity["commits"][:10]:  # Limit to 10
                lines.append(f"  - {commit['message'][:100]} (+{commit['additions']}/-{commit['deletions']})")

        if activity.get("pull_requests"):
            lines.append(f"\nPull Requests ({len(activity['pull_requests'])}):")
            for pr in activity["pull_requests"][:10]:
                lines.append(f"  - {pr['title']} ({pr['state']}) - {pr['additions']}+ {pr['deletions']}-")

        if activity.get("issues"):
            lines.append(f"\nIssues ({len(activity['issues'])}):")
            for issue in activity["issues"][:5]:
                lines.append(f"  - {issue['title']} ({issue['state']})")

        return "\n".join(lines) if lines else "No activity found"
```

### 2. Enhanced GitHub Client

**File:** `backend/app/core/github.py` (additions)

```python
class GitHubClient:
    # ... existing code ...

    async def get_user_activity(self, username: str, since: datetime) -> dict:
        """
        Fetch comprehensive GitHub activity for a user.

        Returns:
            {
                "commits": [...],
                "pull_requests": [...],
                "issues": [...],
                "reviews": [...],
            }
        """
        since_str = since.strftime("%Y-%m-%dT%H:%M:%SZ")

        async with httpx.AsyncClient() as client:
            activity = {
                "commits": [],
                "pull_requests": [],
                "issues": [],
                "reviews": [],
            }

            # Get user's repos
            repos = await self._get_user_repos(client)

            for repo in repos[:20]:  # Limit to 20 repos
                repo_name = repo["full_name"]

                # Fetch commits with details
                commits = await self._get_repo_commits(
                    client, repo_name, username, since_str
                )
                activity["commits"].extend(commits)

                # Fetch PRs
                prs = await self._get_user_prs(
                    client, repo_name, username, since_str
                )
                activity["pull_requests"].extend(prs)

            # Fetch issues created by user
            activity["issues"] = await self._get_user_issues(
                client, username, since_str
            )

            return activity

    async def _get_repo_commits(
        self, client: httpx.AsyncClient, repo: str, author: str, since: str
    ) -> list:
        """Get commits with full details (additions, deletions, message)."""
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{repo}/commits",
            headers=self.headers,
            params={"author": author, "since": since, "per_page": 100},
        )

        if response.status_code != 200:
            return []

        commits = []
        for commit_summary in response.json()[:20]:  # Limit per repo
            # Fetch full commit details for additions/deletions
            detail_response = await client.get(
                commit_summary["url"],
                headers=self.headers,
            )
            if detail_response.status_code == 200:
                detail = detail_response.json()
                commits.append({
                    "sha": detail["sha"],
                    "message": detail["commit"]["message"],
                    "additions": detail["stats"]["additions"],
                    "deletions": detail["stats"]["deletions"],
                    "date": detail["commit"]["author"]["date"],
                    "repo": repo,
                })

        return commits

    async def _get_user_prs(
        self, client: httpx.AsyncClient, repo: str, author: str, since: str
    ) -> list:
        """Get pull requests by user."""
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{repo}/pulls",
            headers=self.headers,
            params={"state": "all", "per_page": 50},
        )

        if response.status_code != 200:
            return []

        prs = []
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))

        for pr in response.json():
            if pr["user"]["login"] != author:
                continue

            created_at = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
            if created_at < since_dt:
                continue

            prs.append({
                "number": pr["number"],
                "title": pr["title"],
                "state": pr["state"],
                "merged": pr.get("merged_at") is not None,
                "additions": pr.get("additions", 0),
                "deletions": pr.get("deletions", 0),
                "created_at": pr["created_at"],
                "repo": repo,
            })

        return prs

    async def _get_user_issues(
        self, client: httpx.AsyncClient, username: str, since: str
    ) -> list:
        """Get issues created by user across all repos."""
        response = await client.get(
            f"{GITHUB_API_BASE}/search/issues",
            headers=self.headers,
            params={
                "q": f"author:{username} type:issue created:>={since[:10]}",
                "per_page": 50,
            },
        )

        if response.status_code != 200:
            return []

        return [
            {
                "title": issue["title"],
                "state": issue["state"],
                "created_at": issue["created_at"],
                "repo": issue["repository_url"].split("/")[-1],
            }
            for issue in response.json().get("items", [])
        ]
```

### 3. Challenge Evaluation Endpoint

**File:** `backend/app/routers/challenges.py` (additions)

```python
from app.core.gemini import GeminiReferee

@router.post("/{challenge_id}/evaluate", response_model=ChallengeResponse)
async def evaluate_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Trigger AI evaluation of a challenge.
    Only available for active challenges where both users have GitHub connected.
    """
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    if challenge.status != ChallengeStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Challenge is not active")

    # Verify both users have GitHub connected
    if not challenge.creator.github_access_token:
        raise HTTPException(status_code=400, detail="Creator has not connected GitHub")
    if not challenge.opponent.github_access_token:
        raise HTTPException(status_code=400, detail="Opponent has not connected GitHub")

    # Fetch GitHub activity for both users
    since = challenge.accepted_at.replace(tzinfo=timezone.utc)

    creator_client = GitHubClient(challenge.creator.github_access_token)
    opponent_client = GitHubClient(challenge.opponent.github_access_token)

    creator_activity = await creator_client.get_user_activity(
        challenge.creator.github_username, since
    )
    opponent_activity = await opponent_client.get_user_activity(
        challenge.opponent.github_username, since
    )

    # Get AI verdict
    referee = GeminiReferee()
    verdict = await referee.evaluate_challenge(
        challenge_prompt=challenge.challenge_prompt,
        creator_activity=creator_activity,
        opponent_activity=opponent_activity,
        creator_username=challenge.creator.github_username,
        opponent_username=challenge.opponent.github_username,
    )

    # Update challenge with verdict
    challenge.ai_verdict = verdict["verdict"]
    challenge.ai_evaluated_at = datetime.utcnow()

    if verdict["winner"] == "creator":
        challenge.winner_id = challenge.creator_id
    elif verdict["winner"] == "opponent":
        challenge.winner_id = challenge.opponent_id
    else:
        challenge.winner_id = None  # Tie

    challenge.status = ChallengeStatus.COMPLETED
    challenge.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(challenge)

    return challenge_to_response(challenge)
```

### 4. Updated Challenge Creation

**File:** `backend/app/schemas/challenge.py`

```python
class ChallengeCreate(BaseModel):
    category: ChallengeCategory
    stake_cents: int
    opponent_username: Optional[str] = None
    challenge_prompt: str  # NEW: Free-form challenge description
    duration_hours: int = 24  # How long the challenge lasts

    @validator("challenge_prompt")
    def validate_prompt(cls, v):
        if len(v.strip()) < 10:
            raise ValueError("Challenge prompt must be at least 10 characters")
        if len(v) > 500:
            raise ValueError("Challenge prompt must be under 500 characters")
        return v.strip()
```

### 5. Configuration

**File:** `backend/app/core/config.py`

```python
class Settings(BaseSettings):
    # ... existing settings ...

    GEMINI_API_KEY: str = ""

    class Config:
        env_file = ".env"
```

**File:** `backend/.env`

```env
# ... existing vars ...
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Frontend Implementation

### 1. Update Challenge Creation Screen

**File:** `frontend/app/challenge/create.tsx`

Replace the fixed category selection with a prompt input:

```typescript
export default function CreateChallengeScreen() {
  const [challengePrompt, setChallengePrompt] = useState('');
  const [durationHours, setDurationHours] = useState(24);

  // ... existing state ...

  const handleSubmit = async () => {
    if (!challengePrompt.trim() || challengePrompt.length < 10) {
      Alert.alert('Invalid Prompt', 'Please describe your challenge (min 10 characters)');
      return;
    }

    await createChallenge({
      category: 'coding',
      stake_cents: stakeAmount,
      opponent_username: selectedUser?.username,
      challenge_prompt: challengePrompt,
      duration_hours: durationHours,
    });
  };

  return (
    // ... JSX with TextInput for challengePrompt ...
  );
}
```

### 2. Update Challenge Detail Screen

**File:** `frontend/app/challenge/[id].tsx`

Add AI verdict display:

```typescript
{challenge.status === 'completed' && challenge.ai_verdict && (
  <View style={styles.verdictCard}>
    <View style={styles.verdictHeader}>
      <Ionicons name="shield-checkmark" size={24} color={colors.accent} />
      <Text style={styles.verdictTitle}>AI REFEREE VERDICT</Text>
    </View>
    <Text style={styles.verdictText}>{challenge.ai_verdict}</Text>
    {challenge.winner_id && (
      <Text style={styles.winnerText}>
        Winner: @{challenge.winner_id === challenge.creator.id
          ? challenge.creator.username
          : challenge.opponent?.username}
      </Text>
    )}
  </View>
)}
```

### 3. Update Types

**File:** `frontend/lib/types.ts`

```typescript
export interface Challenge {
  id: number;
  creator: UserPublic;
  opponent: UserPublic | null;
  category: ChallengeCategory;
  stake_cents: number;
  prize_pool_cents: number;
  challenge_prompt: string;  // NEW
  duration_hours: number;    // NEW
  status: ChallengeStatus;
  creator_progress: number;
  opponent_progress: number;
  winner_id: number | null;
  ai_verdict: string | null; // NEW
  ai_evaluated_at: string | null; // NEW
  created_at: string;
  accepted_at: string | null;
  ends_at: string | null;
  completed_at: string | null;
}

export interface ChallengeCreateRequest {
  category: ChallengeCategory;
  stake_cents: number;
  opponent_username?: string;
  challenge_prompt: string;  // NEW
  duration_hours?: number;   // NEW
}
```

### 4. Update API Client

**File:** `frontend/lib/api.ts`

```typescript
export const createChallenge = (data: ChallengeCreateRequest) =>
  api.post('/api/challenges', data);

export const evaluateChallenge = (id: number) =>
  api.post(`/api/challenges/${id}/evaluate`);
```

---

## Implementation Order

### Phase 1: Backend Foundation
1. [ ] Add `GEMINI_API_KEY` to config and `.env.example`
2. [ ] Create database migration for new fields
3. [ ] Implement `GeminiReferee` class
4. [ ] Expand `GitHubClient` with activity fetching

### Phase 2: API Updates
5. [ ] Update `ChallengeCreate` schema
6. [ ] Update challenge creation endpoint
7. [ ] Implement `/evaluate` endpoint
8. [ ] Update `ChallengeResponse` schema

### Phase 3: Frontend Updates
9. [ ] Update types in `lib/types.ts`
10. [ ] Update API client in `lib/api.ts`
11. [ ] Redesign challenge creation screen with prompt input
12. [ ] Add AI verdict display to challenge detail screen
13. [ ] Add "Request Evaluation" button for active challenges

### Phase 4: Polish
14. [ ] Add prompt suggestions/examples in UI
15. [ ] Add loading states during AI evaluation
16. [ ] Error handling for API rate limits
17. [ ] Add evaluation history/audit trail

---

## API Rate Limits & Costs

### GitHub API
- **Authenticated requests:** 5,000/hour per user
- **Search API:** 30 requests/minute
- **Mitigation:** Cache activity data, batch requests

### Gemini API
- **Free tier:** 15 requests/minute, 1,500/day
- **Cost:** ~$0.0001 per evaluation (minimal)
- **Mitigation:** Only evaluate on user request, not automatically

---

## Security Considerations

1. **Prompt Injection:** Sanitize challenge prompts before sending to Gemini
2. **GitHub Token Storage:** Already encrypted, no changes needed
3. **Rate Limiting:** Add rate limits to `/evaluate` endpoint
4. **Audit Trail:** Log all AI evaluations for dispute resolution

---

## Example Challenge Prompts

| Prompt | What AI Evaluates |
|--------|-------------------|
| "Make 5 commits" | Commit count |
| "Most meaningful commits" | Commit messages, code changes |
| "2 pull requests merged" | PR count + merge status |
| "Best code quality" | Commit messages, PR descriptions, additions/deletions ratio |
| "Most active contributor" | Overall activity across commits, PRs, issues |
| "Ship a new feature" | PR titles/descriptions indicating features |

---

## Testing Plan

1. **Unit Tests**
   - `GeminiReferee` evaluation logic
   - `GitHubClient` activity parsing
   - Schema validation

2. **Integration Tests**
   - Full challenge flow with mock GitHub/Gemini responses
   - Error handling for API failures

3. **Manual Testing**
   - Create challenges with various prompts
   - Verify AI verdicts are sensible
   - Test edge cases (no activity, tie scenarios)
