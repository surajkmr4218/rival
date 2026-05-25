<div align="center">

# 🏆 Rival

### Put your money where your goals are.

**Rival is a 1v1 productivity-betting app where two people stake real money on measurable goals and an AI referee, backed by live data from GitHub and Notion, decides who wins.**

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-54-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-SQLAlchemy-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Gemini](https://img.shields.io/badge/AI-Gemini%202.0%20Flash-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)

[**Demo on Devpost**](https://devpost.com/software/1170625) · [Architecture](#-architecture) · [API Reference](#-api-reference) · [Getting Started](#-getting-started)

</div>

---

## 📖 Overview

Most productivity apps rely on streaks and badges — extrinsic motivation that fades. Rival adds the one incentive that doesn't: **money on the line, head-to-head against a real opponent.**

Two players agree on a goal ("Make 5+ meaningful commits in 24h", "Finish 3 chapters of organic chemistry"), each stake an equal amount ($1–$500), and the clock starts. When time's up, Rival doesn't ask anyone to self-report. Instead it pulls **real activity signals** — commits, PRs, and issues from the **GitHub API**, or edited pages and study notes from the **Notion API** — and hands them to an **AI referee** that produces an auditable verdict with per-player reasoning. The winner takes the pot.

> **Note on scope:** This is a working full-stack prototype. Stake settlement runs against an internal wallet ledger; real-money rails (Stripe) are intentionally stubbed and documented as such — see [Design Decisions](#-design-decisions).

---

## ✨ Features

| | |
|---|---|
| 🎯 **Head-to-head challenges** | Invite a specific user or create an open challenge. Full lifecycle state machine: `pending → active → evaluating → completed`, plus `declined` / `cancelled` with automatic stake refunds. |
| 🤖 **AI referee** | Google **Gemini 2.0 Flash** evaluates outcomes from real activity data and returns structured JSON: a winner, a per-player verdict, and human-readable summaries. Prompts enforce topic-relevance and quality-over-quantity. |
| 🐙 **GitHub integration** | OAuth connect, then fetch commits, pull requests, and issues within the challenge window to judge coding challenges. |
| 📝 **Notion integration** | OAuth connect a workspace, pick a study page, and Rival recursively crawls child pages to measure real study activity. |
| 💰 **Wallet & ledger** | Every balance change is recorded in an append-only `balance_history` ledger (event-sourcing-lite) that stays in lockstep with the user's balance. |
| 📊 **Stats & charts** | Win rate, streaks, lifetime earnings, and an interactive balance-over-time chart (1D / 1W / 1M / 6M / 1Y / ALL). |
| 🔄 **Live progress** | A background asyncio loop refreshes active studying challenges every 2 minutes so progress is current without user action. |
| 🔐 **Secure auth** | JWT (7-day) sessions, bcrypt-hashed passwords, OAuth tokens stored server-side, secrets kept in the device keychain via `expo-secure-store`. |

---

## 🧱 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Mobile** | React Native 0.81 · Expo 54 · Expo Router (file-based routing) · TypeScript 5.9 |
| **State** | Zustand · Axios (with auth interceptor) |
| **Backend** | FastAPI 0.115 · Uvicorn · Pydantic v2 · Python 3.12 |
| **Database** | PostgreSQL · SQLAlchemy 2.0 ORM · Alembic migrations |
| **AI** | Google Gemini 2.0 Flash (`google-generativeai`) |
| **Integrations** | GitHub OAuth + REST · Notion OAuth + API · `httpx` async client |
| **Security / Infra** | PyJWT · bcrypt · `slowapi` rate limiting · CORS middleware |

---

## 🧠 Design Decisions

A few choices that keep the system correct, auditable, and honest about its scope:

- **Thin routers, thick services.** Routers only parse/validate requests and shape responses; all state transitions, money math, and AI orchestration live in `backend/app/services/`. This keeps endpoints trivial and business logic unit-testable in isolation.
- **Async evaluation, never a 60-second request.** `POST /challenges/{id}/evaluate` flips the challenge to `evaluating`, returns `202` immediately, and runs the work in a FastAPI background task. The endpoint is **idempotent** (re-calling mid-evaluation is a no-op) and **rate-limited** to 5/min per IP via `slowapi`.
- **Money lives in an append-only ledger.** Every credit or debit flows through a single `balance_service.apply_balance_change`, which updates `users.balance_cents` and writes a `balance_history` row in the same transaction. Balances are always reconstructible and auditable — there's no path that mutates a balance without a paper trail.
- **AI output is structured, not prose.** The referee returns strict JSON (`winner`, per-player verdict, summaries), so the result is machine-actionable for settlement and renderable as a clean verdict card. Prompts mandate topic-relevance to defend against off-topic gaming.
- **OAuth that works on mobile.** GitHub uses a direct deep-link callback (`rival://auth/github`); Notion (which requires a fixed HTTPS redirect) uses a **backend relay** that smuggles the app's deep link through the OAuth `state` parameter and bounces the user back into the app.
- **Honest stubs.** Wallet top-ups (`POST /users/me/balance`) credit the account directly for demo purposes, capped per call. In production this would be replaced by a Stripe payment-intent webhook before crediting — and the platform commission applied at settlement. These boundaries are documented rather than hidden.

---

## 🗺 Roadmap

- [ ] Stripe payment intents for real-money deposits & withdrawals
- [ ] WebSocket push for instant verdict delivery (replacing client polling)
- [ ] Pytest suite + GitHub Actions CI
- [ ] Containerized local stack (Docker Compose)
- [ ] Structured logging + error monitoring (Sentry)
- [ ] Push notifications for invites, results, and deadlines

