# Production Readiness Audit — Rival

> Pre-launch review of issues to fix before shipping Rival to the App Store / Play Store and exposing it to real users and real money. Findings are grounded in the current code with `file:line` references.

**Severity legend**

| Level | Meaning |
|-------|---------|
| 🔴 **P0 — Blocker** | Will cause store rejection, a security breach, or financial loss. Must fix before any public release. |
| 🟠 **P1 — High** | Serious security/correctness gap. Fix before real users / real money. |
| 🟡 **P2 — Medium** | Reliability, scale, or maintainability. Fix soon after launch. |
| ⚪ **P3 — Low** | Polish / hygiene. |

---

## 1. App Store & platform compliance

### 1.1 🔴 Real-money contests trigger gambling/real-money-gaming rules
Rival has users stake real money on an outcome and pays out a pot — this falls under Apple **Guideline 5.3 (Gaming, Gambling, Lotteries)** and **3.1.5(b) / 3.2.1**, and Google Play's **Real-Money Gambling** policy. These require, at minimum: legal authorization/licensing in every region you operate, geo-restriction to permitted jurisdictions, age verification (18/21+), and often a formal application to the stores. Many US states and countries prohibit paid skill/contests entirely.
**Why it matters:** This is the single largest launch blocker — it is a legal/regulatory question, not just an engineering one.
**Fix:** Get legal review on the contest model. Decide: real-money (license + geofence + KYC/AML + age-gating + tax reporting) vs. virtual-currency/no-cash-out (far simpler compliance). Document the decision before building payments.

### 1.2 🔴 App Transport Security is fully disabled
`frontend/app.json:20-24` sets `NSAllowsArbitraryLoads: true` (+ `NSAllowsLocalNetworking`), and `app.json:33` sets Android `usesCleartextTraffic: true`. These exist to allow `http://<LAN-IP>:8000` during development.
**Why it matters:** Apple rejects blanket ATS exceptions without justification, and cleartext traffic exposes JWTs/tokens to network interception.
**Fix:** Serve the backend over HTTPS on a real domain, remove `NSAllowsArbitraryLoads` and `usesCleartextTraffic`, and rely on default ATS.

### 1.3 🔴 No in-app account deletion or privacy policy
Apple **Guideline 5.1.1(v)** requires an in-app "delete account" flow for any app with account creation, plus a published privacy policy and accurate privacy "nutrition labels." Neither exists (no delete endpoint; `auth.py` only has register/login).
**Fix:** Add `DELETE /api/users/me` (hard-delete or anonymize, including OAuth token revocation), a privacy policy URL, and configure App Privacy details.

### 1.4 🟠 Bundle identifier mismatch
`frontend/app.json:18,32` uses `com.rival.app`, but `backend/app/core/config.py:9` declares `APPLE_BUNDLE_ID = "com.rivalhax1347.app"`.
**Why it matters:** Sign in with Apple token validation and push/entitlements key off the bundle ID; a mismatch silently breaks them.
**Fix:** Pick one canonical bundle ID and use it everywhere.

---

## 2. OAuth & redirect-URI handling  *(the area you flagged)*

### 2.1 🔴 Redirect URIs are dev-only (LAN IP / localhost), not public HTTPS
`NOTION_REDIRECT_URI` is documented as `http://your-ip:8000/api/notion/callback` (`backend/app/routers/notion.py:64`); `GITHUB_REDIRECT_URI` defaults empty and is set to a deep link in dev. The entire OAuth round-trip assumes the backend is reachable at a machine-local address.
**Why it matters:** OAuth providers redirect the *user's browser* to the callback URL. A `localhost`/LAN address is unreachable from a real device on cellular or another network, so connecting GitHub/Notion will fail in production.
**Fix:** Deploy the backend to a stable public HTTPS domain (e.g. `https://api.rival.app`), register that exact callback in the GitHub OAuth App and Notion integration, and set the `*_REDIRECT_URI` env vars to it.

### 2.2 🔴 Open redirect / OAuth code interception via unvalidated `redirect_uri`/`state`
`notion.py:53,65` accepts an arbitrary `redirect_uri` from the client and stores it in the OAuth `state`; the callback at `notion.py:89-101` then blindly does `RedirectResponse(f"{app_redirect}?code=...")` to whatever was in `state`. `github.py:148,163-164` similarly reflects a client-supplied `redirect_uri`.
**Why it matters:** An attacker can craft an authorize link whose `state`/`redirect_uri` points at a site they control, causing the victim's **authorization code to be delivered to the attacker** — leading to account/integration takeover. Classic open-redirect + OAuth code leak.
**Fix:** Validate every redirect target against a server-side allowlist of exact URIs (your app scheme + known callbacks). Reject anything else.

### 2.3 🟠 No CSRF protection in the OAuth flow
The `state` parameter is being repurposed to carry the redirect URI (`notion.py:72`) instead of a random, server-bound nonce. There is no anti-CSRF check on the callback.
**Why it matters:** Without a validated `state` nonce, the flow is vulnerable to OAuth login-CSRF (attacker connects *their* integration to a victim's account).
**Fix:** Generate a random `state`, persist it server-side bound to the user/session, and verify it on callback. Carry the redirect separately (and allowlisted, per 2.2).

### 2.4 🟠 GitHub OAuth scope is over-privileged
`github.py:159` requests `scope=read:user repo`. The `repo` scope grants **full read/write access to all of the user's private repositories**.
**Why it matters:** You only need to read public commit/PR activity. Requesting `repo` is a security liability, scares users, and invites reviewer scrutiny.
**Fix:** Drop to the minimum (`read:user`, and `public_repo` only if you must, or none). Re-evaluate what the referee actually reads.

### 2.5 🟠 GitHub custom-scheme callback won't work for a standard OAuth App
The dev flow uses `rival://auth/github`. GitHub OAuth Apps require an `http(s)` Authorization callback URL and do not support custom URI schemes.
**Fix:** Use the same backend-relay pattern as Notion (HTTPS callback → deep link), or migrate to an AuthSession/PKCE flow with a registered HTTPS redirect.

---

## 3. Security

### 3.1 🔴 OAuth access tokens stored in plaintext
`user.github_access_token` and `user.notion_access_token` are persisted as plain columns (`models/user.py`; written at `github.py:83`, `notion.py:149`).
**Why it matters:** A database leak hands attackers live tokens to users' GitHub repos and Notion workspaces — combined with the over-broad `repo` scope (2.4), that's read/write to private code.
**Fix:** Encrypt tokens at rest (e.g. Fernet/envelope encryption with a KMS-managed key); decrypt only in memory when calling the provider.

### 3.2 🔴 Insecure default `SECRET_KEY`
`config.py:6` defaults `SECRET_KEY` to `"your-secret-key-change-in-production"`; `docker-compose.yml:28` defaults to `change-this-in-production`. JWTs are signed with this (`security.py:28`).
**Why it matters:** If the env var isn't set in prod, the signing key is public knowledge → anyone can forge a token for any user → total account takeover.
**Fix:** Remove the insecure default and **fail fast on startup** if `SECRET_KEY` is unset/known-default in a production environment.

### 3.3 🟠 `allow_origins=["*"]` with `allow_credentials=True`
`main.py:52-58`.
**Why it matters:** This combination is invalid per the CORS spec and overly permissive. (It's harmless for the *native* app, which ignores CORS, but matters the moment a browser client exists.)
**Fix:** Restrict `allow_origins` to known frontend origins via env config; only enable credentials if actually used.

### 3.4 🟠 No rate limiting on auth endpoints
Only `/api/challenges/{id}/evaluate` is rate-limited (`challenges.py:235`). `register`/`login` (`auth.py`) are unprotected.
**Why it matters:** Open to credential stuffing / brute force / signup spam.
**Fix:** Apply `slowapi` limits to login/register (and ideally account lockout/backoff).

### 3.5 🟠 Internal exception details leaked to clients
Handlers return `detail=f"Failed to connect ...: {str(e)}"` (`github.py:97`, `notion.py:165,210`).
**Why it matters:** Leaks stack/internal details to API consumers (information disclosure).
**Fix:** Return a generic message to the client; log the exception server-side with context.

### 3.6 🟠 No token revocation / refresh strategy
JWTs live 7 days (`config.py:8`) with no refresh tokens, no logout-side invalidation, no denylist.
**Why it matters:** A stolen token is valid for a week with no way to revoke; can't force logout on password change/account deletion.
**Fix:** Short-lived access tokens + rotating refresh tokens, and a revocation/denylist mechanism (ties into 1.3 account deletion).

### 3.7 🟡 Known-vulnerable / unused dependency
`backend/requirements.txt` pins `python-jose==3.3.0` (known CVEs) even though the app uses `PyJWT` for tokens (`security.py`).
**Fix:** Remove `python-jose` (and other unused crypto deps like `ecdsa` if unreferenced); add `pip-audit`/Dependabot to CI.

### 3.8 🟡 Minimal JWT claims
`security.py:24-28` sets only `sub` + `exp`. No `iat`, `nbf`, `iss`, or `aud`.
**Fix:** Add issued-at/issuer/audience and validate them on decode.

---

## 4. Financial integrity (real-money correctness)

### 4.1 🔴 Time-of-check/time-of-use race on balances
`create_challenge` (`challenge_service.py:74` check → `:118` debit) and `accept_challenge` (`:144` check → `:160` debit) read `balance_cents`, then debit, with no row lock or atomic conditional update.
**Why it matters:** Two concurrent requests can both pass the balance check and overdraw — i.e. spend money the user doesn't have. Unacceptable for real funds.
**Fix:** Use `SELECT … FOR UPDATE` on the user row within the transaction, or an atomic `UPDATE … WHERE balance_cents >= :amount` and verify rows affected.

### 4.2 🔴 No database constraint preventing negative balances
There is no `CHECK (balance_cents >= 0)` on the users table.
**Fix:** Add the constraint as a last line of defense so no code path can drive a balance negative.

### 4.3 🔴 Live "free money" demo top-up endpoint
`POST /api/users/me/balance` (`users.py:115-143`) credits the caller's balance directly (capped $10–$100/call) with no payment.
**Why it matters:** In production this is unlimited free funds (call it repeatedly).
**Fix:** Remove/disable in production; replace with a Stripe payment-intent webhook that credits the balance **only** after a confirmed, idempotent payment.

### 4.4 🟠 No idempotency on financial mutations
Top-ups, stakes, and settlements have no idempotency keys; client retries / double-taps / webhook redelivery can double-apply.
**Fix:** Idempotency keys on all money-moving endpoints + a uniqueness guard in the ledger.

### 4.5 🟠 Settlement is not crash-safe (stuck `evaluating`)
`run_evaluation` runs as an in-process `BackgroundTask`; recovery from failure only happens inside the same task's `except` (`challenge_service.py:409-419`). A hard crash/restart mid-evaluation leaves the challenge in `EVALUATING` forever, with stakes locked.
**Fix:** Move evaluation to a durable job queue with retries; add a startup reconciliation/timeout sweeper that re-queues or reverts stuck `EVALUATING` challenges.

### 4.6 🟡 Platform commission not implemented
`_finalize_evaluation` pays the winner the full `prize_pool = stake * 2` (`challenge_service.py:488-499`); the documented 10–15% fee is never taken.
**Fix:** Apply the commission at settlement and record it as a distinct ledger event (and reconcile to a platform account).

---

## 5. Reliability & scale

### 5.1 🔴 Background work assumes a single in-process worker
The Notion poller (`main.py:27`, `services/notion_poller.py`) and the `slowapi` limiter (in-memory by default) live in the app process.
**Why it matters:** With more than one Uvicorn/Gunicorn worker, every worker runs its own poller (duplicate/competing polling) and keeps its own rate-limit counters (limits effectively multiply). State is lost on every restart.
**Fix:** Move scheduling to a single dedicated worker / job scheduler (Celery beat, Arq, APScheduler-with-lock) and back the rate limiter with Redis.

### 5.2 🟠 Dual schema management (`create_all` + Alembic)
`main.py:20` calls `Base.metadata.create_all(bind=engine)` while Alembic migrations also exist.
**Why it matters:** The two can drift; `create_all` silently creates tables that bypass migration history.
**Fix:** Remove `create_all` in production and rely solely on `alembic upgrade head` (already done in `entrypoint.sh`).

### 5.3 🟠 No DB pooling / liveness / TLS config
`database.py:6` is `create_engine(settings.DATABASE_URL)` with all defaults — no `pool_pre_ping`, no pool sizing, no SSL.
**Why it matters:** Managed Postgres drops idle connections, causing intermittent 500s; no enforced TLS to the DB.
**Fix:** Add `pool_pre_ping=True`, sensible `pool_size`/`max_overflow`, and `sslmode=require` (or equivalent) for production.

### 5.4 🟡 `/health` doesn't check dependencies
`main.py:67-69` returns static `{"status": "healthy"}`.
**Fix:** Add a readiness probe that checks DB connectivity (and key external deps) so orchestrators can route traffic correctly.

### 5.5 🟡 External API failures aren't gracefully degraded
Evaluation depends on GitHub/Notion/Gemini being up; failures surface as generic 500s with no retry/backoff.
**Fix:** Timeouts (partly present), retries with backoff, and user-visible "evaluation pending/retrying" states.

---

## 6. Observability

### 6.1 🟠 No error monitoring or structured logging
Only `logging.basicConfig(level=INFO)` (`main.py:16`). No Sentry/crash reporting, no request IDs, no structured logs.
**Fix:** Add error monitoring (e.g. Sentry) on backend + app, structured JSON logs, and request correlation IDs.

### 6.2 🟡 Sensitive context in logs
`notion.py:107,130` logs token presence and redirect URIs.
**Fix:** Scrub auth-related fields from logs.

---

## 7. Client / config

### 7.1 🟠 Frontend backend URL falls back to localhost
`frontend/lib/config.ts` defaults `BACKEND_URL` to `http://localhost:8000` if `EXPO_PUBLIC_BACKEND_URL` is unset.
**Why it matters:** A release build with the env var unset points at nothing.
**Fix:** Require the production HTTPS URL at build time (EAS env/profiles); fail the build if missing.

---

## 8. Quality, testing & CI

### 8.1 🟠 No automated tests
No `test_*.py` anywhere in `backend/`. For a money-handling app this is a significant risk.
**Fix:** Unit tests for `balance_service`/`challenge_service` (esp. state machine, settlement, races), integration tests for auth & OAuth.

### 8.2 🟠 No CI pipeline
No `.github/workflows/`.
**Fix:** Add CI: lint, type-check, tests, `pip-audit`/Dependabot, and a migration check, gating merges.

### 8.3 ⚪ Deprecated FastAPI/Pydantic usage
`users.py:148` uses `Query(..., regex=...)`, deprecated in Pydantic v2 / FastAPI.
**Fix:** Use `pattern=` instead.

---

## Priority summary

| # | Issue | Severity | Area |
|---|-------|----------|------|
| 1.1 | Real-money gambling/contest compliance | 🔴 P0 | Legal/Store |
| 1.2 | ATS disabled / cleartext traffic | 🔴 P0 | Store/Security |
| 1.3 | No account deletion / privacy policy | 🔴 P0 | Store |
| 2.1 | Redirect URIs not public HTTPS | 🔴 P0 | OAuth |
| 2.2 | Open redirect / OAuth code interception | 🔴 P0 | OAuth/Security |
| 3.1 | OAuth tokens stored in plaintext | 🔴 P0 | Security |
| 3.2 | Insecure default `SECRET_KEY` | 🔴 P0 | Security |
| 4.1 | Balance check/debit race (overdraw) | 🔴 P0 | Money |
| 4.2 | No negative-balance constraint | 🔴 P0 | Money |
| 4.3 | Live free-money top-up endpoint | 🔴 P0 | Money |
| 5.1 | Single-process background work / limiter | 🔴 P0 | Scale |
| 1.4 | Bundle ID mismatch | 🟠 P1 | Store |
| 2.3 | No OAuth CSRF `state` nonce | 🟠 P1 | OAuth |
| 2.4 | Over-broad GitHub `repo` scope | 🟠 P1 | Security |
| 2.5 | GitHub custom-scheme callback | 🟠 P1 | OAuth |
| 3.3 | CORS `*` + credentials | 🟠 P1 | Security |
| 3.4 | No auth-endpoint rate limiting | 🟠 P1 | Security |
| 3.5 | Exception details leaked | 🟠 P1 | Security |
| 3.6 | No token revocation/refresh | 🟠 P1 | Security |
| 4.4 | No idempotency on money ops | 🟠 P1 | Money |
| 4.5 | Settlement not crash-safe | 🟠 P1 | Money |
| 4.6 | Commission not implemented | 🟡 P2 | Money |
| 5.2 | Dual schema management | 🟠 P1 | Reliability |
| 5.3 | No DB pooling/TLS | 🟠 P1 | Reliability |
| 6.1 | No error monitoring | 🟠 P1 | Observability |
| 7.1 | Frontend URL localhost fallback | 🟠 P1 | Config |
| 8.1 | No tests | 🟠 P1 | Quality |
| 8.2 | No CI | 🟠 P1 | Quality |
| 3.7 | Vulnerable/unused dep (`python-jose`) | 🟡 P2 | Security |
| 3.8 | Minimal JWT claims | 🟡 P2 | Security |
| 5.4 | `/health` lacks dependency checks | 🟡 P2 | Reliability |
| 5.5 | No graceful external-API degradation | 🟡 P2 | Reliability |
| 6.2 | Sensitive data in logs | 🟡 P2 | Observability |
| 8.3 | Deprecated `Query(regex=)` | ⚪ P3 | Quality |

---

*Generated from a review of the current `main` branch. Re-audit after addressing P0/P1 items.*
</content>
