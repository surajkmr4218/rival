# Rival

## Elevator Pitch

Rival is a 1v1 productivity app where users stake money on measurable daily goals. Whether it's making GitHub commits, completing study sessions, or hitting custom objectives, both players commit equal amounts ($1-$500). An AI referee evaluates outcomes in real-time using integrated data sources (GitHub API, Notion, device signals) and awards the pot to the winner. The platform takes a 10-15% commission.

Devpost: https://devpost.com/software/1170625?ref_content=existing_user_added_to_software_team&ref_feature=portfolio&ref_medium=email&utm_campaign=software&utm_content=added_to_software_team&utm_medium=email&utm_source=transactional#app-team

## What is Rival?

Rival turns productivity into a competitive game with real stakes. Users challenge friends or request random matchups with goals like:

- **Coding**: Make 5+ GitHub commits
- **Studying**: Complete study sessions tracked in Notion
- **Custom**: A measurable goal verified by AI

Both players stake equal amounts. The AI referee monitors progress automatically and settles the winner.

## Tech Stack

**Frontend**: React Native + Expo (expo-router for file-based routing)

**Backend**: FastAPI (Python)

**Database**: PostgreSQL with SQLAlchemy ORM

**State Management**: Zustand

**APIs**: GitHub OAuth, Notion API, Gemini 2.0 Flash

**Authentication**: JWT tokens
