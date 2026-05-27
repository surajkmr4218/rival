# Rival — Existing Technical Highlights

A reference of what's already in the codebase that's worth talking about in an
interview or on a resume. Organized so each item has (1) the concept, (2) where
it lives, (3) the one-sentence "why this is non-trivial."

---

## Architecture

### Service-layer separation
- Routers (`backend/app/routers/`) are thin HTTP adapters: parse the request,
  call a service, serialize the response.
- Business logic, state-machine transitions, third-party calls, and balance
  math live in `backend/app/services/challenge_service.py` and
  `balance_service.py`.
- **Why it's non-trivial:** the routers used to be a 733-LOC god-file; the
  extraction makes the code testable, makes the state machine readable in one
  place, and proves you understand separation of concerns.

### Balance ledger pattern
- `BalanceHistory` (in `models/balance_history.py`) records every change to
  `users.balance_cents` with a snapshot of the post-change balance, the delta,
  an `event_type` (typed via `BalanceEventType` enum), and an optional
  `challenge_id` for traceability.
- All mutations flow through `apply_balance_change()` in
  `services/balance_service.py` — single source of truth.
- **Why it's non-trivial:** it's event-sourcing-lite. You can reconstruct any
  user's balance history, audit stake/refund/win/loss events, and chart their
  PnL over time (already wired into `GET /api/users/me/balance-history`).

### State machine for challenges
- `ChallengeStatus`: `pending → active → evaluating → completed`,
  with `declined` / `cancelled` as terminal branches.
- Each transition is one service method (`accept_challenge`,
  `decline_challenge`, `cancel_challenge`, `start_evaluation`,
  `_finalize_evaluation`) with preconditions enforced before the write.
- **Why it's non-trivial:** the `EVALUATING` state was added specifically to
  make the AI-evaluation kickoff durable across server restarts and idempotent
  for client retries.

---

## AI integration (Gemini)

### Async kickoff + frontend polling
- `POST /api/challenges/{id}/evaluate` validates preconditions, flips the
  status to `evaluating`, schedules a FastAPI `BackgroundTasks` job, and
  returns `202 Accepted` immediately.
- The background task (`run_evaluation` in `challenge_service.py`) owns its
  own DB session, calls Gemini, settles balances, commits.
- The React Native client polls `GET /api/challenges/{id}` with a linear
  backoff schedule (`[8, 5, 5, 5, 5, 8, 8, 10, 10, 10]`) until status flips
  to `completed`.
- **Why it's non-trivial:** the original implementation was a 60-second
  blocking HTTP request that timed out unreliably. Splitting into kickoff +
  poll demonstrates an understanding of long-running work, idempotency, and
  client-side retry logic.

### Idempotency
- `start_evaluation` is a no-op if the challenge is already `evaluating` or
  `completed` — clients can safely retry.
- The background task verifies the status is still `EVALUATING` before doing
  any work, so a duplicate enqueue doesn't run Gemini twice.

### Failure recovery
- If `run_evaluation` raises (Gemini error, GitHub/Notion 5xx), the exception
  handler rolls back the session and resets `status` to `active` so the user
  can retry. The kickoff transaction is intentionally committed before the
  background task is queued — so the EVALUATING marker is durable.

### Structured prompts with `response_mime_type: application/json`
- `core/gemini.py` instructs Gemini to return a strict JSON shape (`winner`,
  `creator_verdict`, `opponent_verdict`, etc.).
- The verdict is persisted as a JSON string on `challenges.ai_verdict` and
  rendered on the client via a typed `AiVerdict` interface.

---

## OAuth integrations

### Two production-grade OAuth flows
- **GitHub** (`backend/app/core/github.py` + `routers/github.py`): standard
  `client_id` / `client_secret` / `code` exchange, bearer-token-based API
  client, deep-linking back into the Expo app via `rival://auth/github`.
- **Notion** (`core/notion.py` + `routers/notion.py`): same pattern, but
  Notion requires a public HTTPS callback, so the backend acts as an OAuth
  relay — Notion calls the backend's `/api/notion/callback`, which then
  redirects to the app's deep link with the auth code in the URL.
- **Why it's non-trivial:** few side projects do real OAuth at all, and almost
  none do two. The Notion relay pattern in particular is a real-world
  workaround for mobile-OAuth limitations.

### Token storage
- Access tokens are stored on the `User` row (encrypted at rest via Postgres,
  not in the app — caveat worth noting).
- Frontend stores the JWT in `expo-secure-store` on native, `localStorage` on
  web (`frontend/lib/storage.ts`).

---

## Background processing

### Async polling loop for Notion
- `backend/app/services/notion_poller.py` runs an `asyncio` loop on app
  startup (via FastAPI lifespan context manager) that wakes every 2 minutes,
  finds active studying challenges, fetches the latest Notion activity, and
  updates progress.
- Skips challenges polled in the last ~110 seconds to avoid hammering the API.
- **Why it's non-trivial:** shows familiarity with FastAPI lifespan,
  long-running asyncio tasks, and graceful shutdown via `task.cancel()`.

### Auto-refresh throttling on GET
- `services/challenge_service.refresh_progress()` is called from
  `GET /api/challenges/{id}` to keep progress fresh, but it self-throttles
  to once per 30 seconds using the `last_notion_poll` column.
- Explicit refresh endpoints (`/refresh`, `/poll-notion`) pass `force=True`.
- **Why it's non-trivial:** without this, the frontend polling loop during
  AI evaluation would fan out to 4 third-party API calls every 3 seconds.
  It's a real thundering-herd guard.

---

## Reliability

### Rate limiting
- `slowapi` is wired in `core/rate_limit.py` + `main.py`. The `/evaluate`
  endpoint is capped at **5 requests/minute per IP** to bound Gemini cost.
- Combined with idempotency, accidental client retry storms can't blow up the
  bill.

### Database migrations
- Alembic manages the schema. The most recent migration
  (`5d6e7f8g9h0i_add_evaluating_status.py`) uses `ALTER TYPE ... ADD VALUE
  IF NOT EXISTS` inside an autocommit block — the correct way to extend a
  Postgres enum.

### Input validation
- Pydantic v2 with `field_validator` on `ChallengeCreate`: prompt length 10–500
  chars, stake $1–$500, duration 1–168 hours. Server-side authoritative —
  client-side validation is mirrored but not trusted.

---

## Frontend

### Cancellable polling with `useRef`
- `challenge/[id].tsx` uses a `cancelledRef` flipped by the `useEffect`
  cleanup, so the polling loop aborts cleanly when the user navigates away.
  Prevents `setState`-on-unmounted-component warnings and stale-screen Alerts.

### Type-safe API surface
- Pydantic response models on the backend and TypeScript interfaces in
  `frontend/lib/types.ts` are hand-kept in sync. The `AiVerdict` type, for
  example, is identical on both sides, and the client just calls `JSON.parse`
  on the stored verdict.

### Auth-guard layout
- `app/_layout.tsx` uses `expo-router`'s `useSegments` to redirect
  unauthenticated users to `/login` and authenticated users out of it,
  declaratively, without a third-party auth provider.

### Axios interceptor pattern
- `lib/api.ts` attaches `Authorization: Bearer <token>` via a request
  interceptor reading from secure storage. One place to change auth header
  logic; no manual passing in each call site.

### Deep linking
- `app.json` registers the `rival://` scheme; the GitHub OAuth flow uses
  `rival://auth/github?code=...` to hand the code back to the app. This is
  what makes mobile OAuth feel native.

---

## DX / hygiene

- Env-driven backend URL via `EXPO_PUBLIC_BACKEND_URL` — no hardcoded IPs.
- README documents the kickoff+poll AI flow, service layer, ledger pattern,
  and demo-only top-up caveat.
- Demo top-up endpoint is explicitly documented and capped at $100/call so
  the code doesn't lie about being a real payments flow.
