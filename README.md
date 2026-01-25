# Rival

## Elevator Pitch

Rival is a 1v1 productivity app where users stake money on measurable daily goals. Whether it's making GitHub commits, completing study sessions, or hitting custom objectives, both players commit equal amounts ($1-$500). An AI referee evaluates outcomes in real-time using integrated data sources (GitHub API, Notion, device signals) and awards the pot to the winner. The platform takes a 10-15% commission.

## What is Rival?

Rival turns productivity into a competitive game with real stakes. Users challenge friends or request random matchups with goals like:

- **Coding**: Make 5+ GitHub commits
- **Studying**: Complete study sessions tracked in Notion
- **Custom**: A measurable goal verified by AI

Both players stake equal amounts. The AI referee monitors progress automatically and settles the winner. Winner takes home 85-90% of the combined stake.

## Tech Stack

**Frontend**: React Native + Expo (expo-router for file-based routing)

**Backend**: FastAPI (Python)

**Database**: PostgreSQL with SQLAlchemy ORM

**State Management**: Zustand

**APIs**: GitHub OAuth, Notion API, Gemini 2.0 Flash

**Authentication**: JWT tokens
