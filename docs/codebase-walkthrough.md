# Rival — Full Codebase Walkthrough

A file-by-file reading guide for understanding the entire repo. Read it in the
order below: each section builds on the previous one, so by the end every file
makes sense in context.

**How the app fits together in one paragraph:** A React Native (Expo) mobile
app talks over HTTP (axios) to a FastAPI backend. Users register/login (JWT),
connect GitHub and/or Notion via OAuth, stake money on 1v1 productivity
challenges, and an AI referee (Gemini) decides the winner by analyzing each
player's GitHub commits or Notion notes. Money is tracked as an integer cent
balance with a full ledger. Postgres stores everything; Alembic manages schema.

**Mental model of the layers (backend):**
`HTTP request → router (thin) → service (business logic) → models (DB) /
core clients (GitHub/Notion/Gemini)`. Read foundations first (config, db,
models), then the logic that uses them (services), then the HTTP surface
(routers), then how it all boots (main).

---

# PART 1 — BACKEND

## 1.1 Foundations

### `backend/app/core/config.py`
The settings object. A `pydantic-settings` `Settings` class that reads from
environment / `.env`. Holds `DATABASE_URL`, JWT `SECRET_KEY` / `ALGORITHM` /
`ACCESS_TOKEN_EXPIRE_MINUTES` (7 days), and the GitHub / Notion / Gemini
credentials. The singleton `settings = Settings()` at the bottom is imported
everywhere. **Read first — everything depends on it.**

### `backend/app/core/database.py`
SQLAlchemy wiring. Creates the `engine` from `settings.DATABASE_URL`, a
`SessionLocal` session factory, and the `Base` declarative class all models
inherit from. `get_db()` is the FastAPI dependency that yields a request-scoped
session and closes it afterward. Background tasks open their own `SessionLocal()`
directly instead of using `get_db()`.

### `backend/app/models/user.py`
The `User` table. Key columns: `email`, `username`, `password_hash` (nullable —
reserved for Apple Sign-In), `balance_cents` (integer money), and the
integration tokens: `github_access_token` / `github_username`,
`notion_access_token` / `notion_workspace_id` / `notion_workspace_name`.
**Note:** tokens are stored in plaintext columns — the honest caveat to mention
in interviews.

### `backend/app/models/challenge.py`
The core domain object. Two enums:
- `ChallengeCategory`: `coding` (GitHub), `studying` (Notion), `screentime` (unused).
- `ChallengeStatus`: `pending → active → evaluating → completed`, plus
  `declined` / `cancelled`. The state machine the whole app revolves around.

The `Challenge` model holds participants (`creator_id`, `opponent_id`,
`winner_id`), `stake_cents`, the free-text `challenge_prompt`, `duration_hours`,
progress counters, the AI result (`ai_verdict` JSON string, `ai_evaluated_at`),
Notion tracking fields (`creator_notion_page_id`, `*_notion_activity`,
`last_notion_poll`), and timestamps (`accepted_at`, `ends_at`, `completed_at`).
Relationships expose `challenge.creator` / `.opponent` / `.winner`.

### `backend/app/models/balance_history.py`
The money ledger. `BalanceEventType` enum (`deposit`, `withdrawal`, `stake`,
`stake_refund`, `challenge_win`, `challenge_loss`). The `BalanceHistory` row
snapshots `balance_cents` (balance *after* the event), the `change_cents` delta,
the `event_type`, and an optional `challenge_id`. Append-only — you can replay a
user's whole financial history from this table. Powers the balance chart.

## 1.2 Schemas (request/response shapes)

### `backend/app/schemas/user.py`
Pydantic models for auth: `UserCreate` (register input), `UserResponse` (safe
public user — no password/tokens), `Token` (the JWT envelope). `from_attributes`
lets Pydantic read straight off ORM objects.

### `backend/app/schemas/challenge.py`
The biggest schema file. `ChallengeCreate` carries `@field_validator`s that are
the **authoritative** validation (prompt 10–500 chars, stake $1–$500, duration
1–168h). `ChallengeAccept` (optional Notion page). `ChallengeResponse` is the
full serialized challenge the frontend consumes. `UserPublic`, `ChallengeList`,
and search request/response shapes also live here.

### `backend/app/schemas/balance_history.py`
`BalanceDataPoint` (timestamp + balance) and `BalanceHistoryResponse` (the
charting payload: data points + start/current/change/percent).

## 1.3 Security

### `backend/app/core/security.py`
Auth primitives. `hash_password` / `verify_password` (bcrypt),
`create_access_token` (signs a JWT with `sub = user.id` and an expiry), and the
crucial `get_current_user` dependency: decodes the bearer token, loads the
`User`, or raises 401. Every protected endpoint depends on this. The
`OAuth2PasswordBearer(tokenUrl="/api/auth/login")` declares where tokens come from.

## 1.4 External-service clients (`core/`)

### `backend/app/core/github.py`
The GitHub API client + OAuth helper.
- `exchange_code_for_token(...)` — bottom of file — does the OAuth2 code→token
  exchange.
- `GitHubClient(access_token)` wraps the REST API with a bearer header.
- `get_commits_count(username, since)` — quick progress number.
- `get_user_activity(username, since)` — the rich fetch used for AI judging:
  walks the user's recently-pushed repos and aggregates commits (with
  additions/deletions), pull requests, and issues into one dict. The private
  `_fetch_*` helpers do the per-repo pagination.

### `backend/app/core/notion.py`
The Notion equivalent.
- `exchange_code_for_token(code, redirect_uri)` — OAuth2 token exchange using
  HTTP Basic auth (client id/secret), with `grant_type: authorization_code`.
- `NotionClient(access_token)`:
  - `search_pages` — for the page picker.
  - `get_page_content` — paginated block fetch.
  - `get_child_pages` — recursive (depth-limited) child-page crawl.
  - `get_study_activity(root_page_id, since)` — the key method: collects the
    root page + all descendants edited since the challenge started, counts
    blocks, and extracts up to ~3000 chars of plain text per page as
    `content_summary` for the AI. `_was_edited_since`, `_extract_page_title`,
    and `_extract_text_from_blocks` are the helpers.

### `backend/app/core/gemini.py`
The AI referee. `_BASE_RULES` + two system prompts (`CODING_REFEREE_PROMPT`,
`STUDYING_REFEREE_PROMPT`) instruct Gemini to enforce topic-relevance and to
return a strict JSON object (`winner`, `creator_verdict`, `opponent_verdict`,
summaries). `GeminiReferee`:
- `_evaluate(system, user)` — calls `gemini-2.0-flash` with
  `response_mime_type: application/json` and `json.loads` the reply.
- `evaluate_challenge(...)` / `evaluate_studying_challenge(...)` — build the user
  prompt from formatted activity and call `_evaluate`.
- `_format_github_activity` / `_format_notion_activity` — turn the raw activity
  dicts into compact, token-bounded text.
- `get_referee()` (module function) returns `None` if no API key is set — the
  callers treat that as "AI unavailable" (503).

### `backend/app/core/rate_limit.py`
A shared `slowapi` `Limiter` keyed by client IP. Imported by `main.py` (to
register the handler) and `routers/challenges.py` (to decorate `/evaluate`).

## 1.5 Services (business logic — the heart of the backend)

### `backend/app/services/balance_service.py`
One function: `apply_balance_change(db, user, change_cents, event_type,
challenge_id=None)`. Mutates `user.balance_cents` **and** appends the matching
`BalanceHistory` row, keeping them in sync. Does **not** commit — the caller
owns the transaction. Every money movement in the app goes through here.

### `backend/app/services/notion_poller.py`
The background poller. `poll_challenge(challenge, db)` refreshes one studying
challenge's Notion activity for both players (reused by the service layer too).
`poll_active_studying_challenges()` finds active studying challenges not polled
recently and updates them. `start_polling_loop()` is the infinite `asyncio` loop
(every `POLL_INTERVAL = 120s`) launched at app startup.

### `backend/app/services/challenge_service.py`
**The most important file in the backend.** All challenge state transitions and
AI orchestration. Read it slowly.

Helpers: `_get_or_404`, `_require_participant`, `_since(challenge)` (UTC activity
window start), `_insufficient_balance`.

State transitions (each validates preconditions, mutates, commits):
- `create_challenge(db, creator, payload)` — checks balance + Notion setup,
  resolves opponent by username, creates the row, deducts the creator's stake.
- `accept_challenge(...)` — opponent pays their stake, status → `active`, sets
  `accepted_at` / `ends_at`.
- `decline_challenge(...)` / `cancel_challenge(...)` — refund the creator,
  status → `declined` / `cancelled`.
- `set_notion_page(...)` — assign a participant's tracked page.

Progress refresh:
- `refresh_progress(challenge, db, force=False)` — called on `GET /{id}`.
  Self-throttles to once per 30s (via `last_notion_poll`) to avoid hammering
  GitHub/Notion when the client polls; `force=True` bypasses it for the explicit
  refresh endpoints. Delegates studying to `notion_poller.poll_challenge` and
  coding to `_refresh_coding_progress`.

AI evaluation (the kickoff + background + finalize pattern):
- `start_evaluation(db, challenge_id, user)` — validates everything (status,
  prompt, referee available, both integrations connected), then flips status to
  `evaluating` and commits. **Idempotent**: a no-op if already evaluating/done.
- `run_evaluation(challenge_id)` — the background task. Opens its own session,
  re-checks the status is still `evaluating`, calls `_evaluate_coding` /
  `_evaluate_studying`, then `_finalize_evaluation`. On any error it rolls back
  and resets status to `active` so the user can retry.
- `_finalize_evaluation(db, challenge, verdict)` — stores the verdict JSON, sets
  `winner_id`, pays the winner the full pool (or refunds both on a tie) via
  `apply_balance_change`, status → `completed`.

## 1.6 Routers (HTTP surface — thin)

### `backend/app/routers/auth.py`
`POST /api/auth/register` (dupe-checks email/username, hashes password) and
`POST /api/auth/login` (uses `OAuth2PasswordRequestForm`, so it's form-encoded;
the `username` field actually carries the email). Returns a JWT.

### `backend/app/routers/users.py`
`GET /me`, `POST /search` (username search), `GET /me/stats` (computes
won/lost/earnings/streak/win-rate from completed challenges),
`POST /me/balance` (the **demo-only** top-up — capped $10–$100, uses
`apply_balance_change`), and `GET /me/balance-history` (builds the chart payload
for a period). Read after the services.

### `backend/app/routers/challenges.py`
The main HTTP file, but now thin. `_to_response(c)` serializes a `Challenge`;
`_load_challenge` does fetch + participant auth. Routes map almost 1:1 to
service functions: create / list / pending / active / get / accept / decline /
cancel / set-notion-page / poll-notion / refresh. The standout is
`POST /{id}/evaluate`: rate-limited (`@limiter.limit("5/minute")`), calls
`start_evaluation`, and if the status became `evaluating`, schedules
`run_evaluation` via FastAPI `BackgroundTasks` and returns `202`.

### `backend/app/routers/github.py`
`GET /status`, `POST /connect` (exchanges the OAuth code, stores token +
username), `DELETE /disconnect`, `GET /commits`, `GET /oauth-url` (builds the
GitHub authorize URL).

### `backend/app/routers/notion.py`
Same shape as GitHub plus the **OAuth relay**: `GET /callback` is a public HTTPS
endpoint Notion redirects to; it then re-redirects to the app's deep link
(`state` carries the app URI) with the code. `POST /connect` exchanges the code;
`GET /pages` powers the page picker.

## 1.7 App entry + migrations

### `backend/app/main.py`
Boots the app. Creates tables, defines the `lifespan` context manager that
launches `start_polling_loop()` on startup and cancels it on shutdown, builds
the `FastAPI` app, registers the slowapi limiter + rate-limit handler, adds
permissive CORS, and includes all five routers. `GET /health` is here.

### `backend/alembic/env.py` + `backend/alembic.ini`
Alembic config. `env.py` imports `Base.metadata` and overrides the DB URL from
`settings` so migrations honor the same env var. Standard online/offline runners.

### `backend/alembic/versions/*.py`
Schema history, in order: initial users table → challenges → GitHub fields → AI
referee fields → Notion integration → balance_history → `add_evaluating_status`
(the most recent; uses `ALTER TYPE ... ADD VALUE` in an autocommit block — the
correct way to extend a Postgres enum). Skim the latest one; the rest are
historical.

### `backend/requirements.txt`
Dependency pins: `fastapi`, `uvicorn`, `sqlalchemy`, `psycopg2-binary`,
`alembic`, `bcrypt`, `PyJWT`, `httpx`, `google-generativeai`, `slowapi`.

---

# PART 2 — FRONTEND

Same idea: foundations (config, types, storage, api, store, theme) before
navigation, screens, then components.

## 2.1 Foundations (`lib/`)

### `frontend/lib/config.ts`
`BACKEND_URL` (from `EXPO_PUBLIC_BACKEND_URL`, falling back to localhost) and
`API_TIMEOUT`. `config.example.ts` is the committed template. **Read first.**

### `frontend/lib/types.ts`
The TypeScript mirror of the backend's Pydantic schemas: `User`, `UserStats`,
`Challenge`, `ChallengeStatus` (incl. `evaluating`), `AiVerdict`, `NotionPage`,
balance-history types. Keeping this in sync with the backend is what makes the
API calls type-safe.

### `frontend/lib/storage.ts`
Token persistence abstraction: `saveToken` / `getToken` / `deleteToken`, using
`expo-secure-store` on native and `localStorage` on web.

### `frontend/lib/api.ts`
The axios layer. Creates the client with `baseURL` + timeout, and a **request
interceptor** that injects `Authorization: Bearer <token>` from storage on every
call. Then exports one function per endpoint (auth, users, challenges, github,
notion). The single place the whole app talks to the backend — skim every export
to see the full API surface at a glance.

### `frontend/lib/auth.ts`
The Zustand store (the only global state). Holds `user`, `isLoading`, `error`
and the actions `login`, `register`, `logout`, `loadUser`. `login` saves the
token then calls `loadUser` (which hits `/me`). Components read auth via
`useAuth()`.

### `frontend/lib/theme.ts`
The color palette (dark green + neon accent). Imported by basically every screen.

## 2.2 Navigation (expo-router file-based routing)

### `frontend/app/_layout.tsx`
Root layout + auth gate. On mount calls `loadUser()`; a `useEffect` watching
`user` + route segments redirects unauthenticated users to `/login` and
authenticated users away from it. Declares the top-level `Stack` (login, tabs,
challenge, auth).

### `frontend/app/(tabs)/_layout.tsx`
The bottom tab bar: Dashboard (`index`), History, Profile.

### `frontend/app/challenge/_layout.tsx` and `frontend/app/auth/_layout.tsx`
Plain stacks grouping the challenge screens (`create`, `[id]`, `pending`) and
the auth callback screen (`github`) with the dark theme.

## 2.3 Screens

### `frontend/app/login.tsx`
Combined sign-in / sign-up form with a toggle. Local form state + client
validation (`canSubmitSignIn` / `canSubmitSignUp`); submits via the auth store.
Shows `error` from the store.

### `frontend/app/(tabs)/index.tsx` (Dashboard)
The home screen. On focus (`useFocusEffect`) it fetches active, pending, and all
challenges **in parallel** (`Promise.all`), shows a pending-invitations banner,
a "sent challenges" section (outgoing pending), and the active list — each as a
`ChallengeCard`. Pull-to-refresh + "Start New Challenge" button.

### `frontend/app/(tabs)/history.tsx`
A `FlatList` of *completed* challenges (filtered client-side), refetched on focus.

### `frontend/app/(tabs)/profile.tsx`
The densest screen. Shows balance, the `BalanceChart`, stats, and two
`IntegrationCard`s (GitHub, Notion). Holds the **inline OAuth flows**:
`handleConnectGitHub` / `handleConnectNotion` use `expo-auth-session` +
`expo-web-browser` to open the provider, capture the returned `code` from the
redirect URL, and call `connectGitHub` / `connectNotion`. Also opens the
`TopUpDrawer` (auto-prompts new users with $0). `fetchStatuses` loads everything
on focus.

### `frontend/app/challenge/create.tsx`
The multi-step challenge builder. Local state for category (coding/studying),
prompt (with example chips), duration (presets + custom h/m), stake (via
`StakeSlider`), opponent (via `UserSearchInput`), and — for studying — a Notion
page (via `NotionPagePicker`). `canSubmit` gates the button; `handleSubmit` posts
`createChallenge` and navigates home.

### `frontend/app/challenge/[id].tsx`
The challenge detail screen — the most complex screen, and where the polling
lives. Loads the challenge on mount; a `cancelledRef` (set by the effect
cleanup) aborts async work on navigate-away. Renders different footers by role +
status: accept/decline (opponent, pending), cancel (creator, pending), evaluate
(active). Key pieces:
- `handleEvaluate` → posts `/evaluate`, then `pollUntilDone` polls
  `getChallenge` on a backoff schedule (`[8,5,5,...]`) until status is
  `completed`, then shows `ChallengeResultPopup`.
- `getPersonalizedVerdict()` — `JSON.parse`es `ai_verdict` and returns the
  current user's side of the verdict.
- Renders Notion activity / commit progress, the AI verdict card, and a
  manual Notion refresh button (`handlePollNotion`).

### `frontend/app/challenge/pending.tsx`
Full-page list of incoming pending invitations (a `FlatList` of `ChallengeCard`).

### `frontend/app/auth/github.tsx`
A deep-link OAuth callback handler (alternate path to the inline profile flow):
reads `code` from the URL, calls `connectGitHub`, shows success/error, redirects
to profile. Useful to know it exists, but the profile screen's inline flow is the
primary path in practice.

## 2.4 Components (`components/`)

### `frontend/components/ChallengeCard.tsx`
The reusable challenge tile used on Dashboard, History, and Pending. Computes
"my" vs "their" progress relative to `currentUserId`, derives a status
color/label (WON/LOST/TIE for completed), shows the prize, progress bars for
active challenges, and an "AI Referee decided" indicator for completed ones.

### `frontend/components/UserSearchInput.tsx`
Opponent picker. Debounced (300ms) username search via `searchUsers`; shows
results, lets you select/clear. Used in create.

### `frontend/components/NotionPagePicker.tsx`
Modal page picker. Loads pages when opened, debounced search, handles
loading/error/empty, returns the chosen `NotionPage`. Used in create and detail.

### `frontend/components/StakeSlider.tsx`
Stake amount slider ($1–$500) with live "your stake / prize pool" display. Uses
an HTML range input on web and `@react-native-community/slider` on native.

### `frontend/components/TopUpDrawer.tsx`
The funding drawer. Preset/custom amounts and a **simulated** Apple Pay flow
(`setTimeout` + animated checkmark) — no real payment processor. Calls
`onComplete(amountCents)`, which the profile wires to `addBalance`.

### `frontend/components/ChallengeResultPopup.tsx`
The win/loss celebration modal shown after evaluation completes (props:
`isWin`, `amount`).

### `frontend/components/BalanceChart.tsx`
A from-scratch SVG line chart (`react-native-svg`) of balance history. Period
selector (1D…ALL), computes Y/X ticks and SVG point coordinates in a `useMemo`,
draws grid + line + points, and supports touch scrubbing with a tooltip via
`PanResponder`-style responder handlers. The most algorithm-heavy component.

## 2.5 Config files

### `frontend/app.json`
Expo config: the `rival://` deep-link scheme (used by OAuth), dark UI, icons/
splash, iOS/Android bundle IDs, cleartext-traffic allowances (for LAN dev), and
plugins (`expo-secure-store`, `expo-router`, `expo-web-browser`).

### `frontend/package.json`
Dependencies: Expo SDK 54, React Native 0.81, React 19, expo-router, axios,
zustand, react-native-svg, the slider, expo-auth-session/web-browser/secure-store.

### `frontend/tsconfig.json`
TypeScript config (extends the Expo base).

---

# Suggested reading session plan

1. **Session 1 (backend foundations):** config → database → models (user,
   challenge, balance_history) → schemas. You now know the data.
2. **Session 2 (backend logic):** security → core clients (github, notion,
   gemini) → services (balance_service, challenge_service, notion_poller). You
   now know the behavior.
3. **Session 3 (backend surface):** routers (auth, users, challenges, github,
   notion) → main → newest migration. You now know the API.
4. **Session 4 (frontend foundations):** config → types → storage → api →
   auth → theme. You now know how the app talks to the backend.
5. **Session 5 (frontend UI):** _layout → screens (login, dashboard, profile,
   create, [id]) → components. You now know the user-facing flows.

# The two flows worth tracing end-to-end

- **Create → accept → evaluate:** `create.tsx` → `POST /challenges`
  (`challenge_service.create_challenge`) → opponent's `[id].tsx` accept →
  `accept_challenge` → creator taps evaluate → `start_evaluation` (202) +
  `run_evaluation` background task → Gemini → `_finalize_evaluation` →
  `[id].tsx` polling sees `completed` → `ChallengeResultPopup`.
- **OAuth connect:** `profile.tsx` `handleConnectGitHub`/`Notion` →
  `GET /oauth-url` → provider consent → code captured → `POST /connect`
  (`exchange_code_for_token` → store token) → status badge updates.
