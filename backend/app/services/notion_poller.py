"""
Background service to poll Notion activity for active studying challenges.

Runs every 2 minutes to update progress for all active studying challenges.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.notion import NotionClient
from app.models.challenge import Challenge, ChallengeCategory, ChallengeStatus

logger = logging.getLogger(__name__)

# Polling interval in seconds (2 minutes)
POLL_INTERVAL = 120


async def poll_challenge(challenge: Challenge, db: Session) -> None:
    """Poll Notion activity for a single challenge."""
    since = challenge.accepted_at.replace(tzinfo=timezone.utc) if challenge.accepted_at else datetime.now(timezone.utc)

    # Poll creator
    if challenge.creator_notion_page_id and challenge.creator.notion_access_token:
        try:
            client = NotionClient(challenge.creator.notion_access_token)
            activity = await client.get_study_activity(challenge.creator_notion_page_id, since)
            challenge.creator_notion_activity = activity
            challenge.creator_progress = activity.get("page_count", 0)
        except Exception as e:
            logger.warning(f"Failed to poll creator Notion for challenge {challenge.id}: {e}")

    # Poll opponent
    if challenge.opponent_notion_page_id and challenge.opponent and challenge.opponent.notion_access_token:
        try:
            client = NotionClient(challenge.opponent.notion_access_token)
            activity = await client.get_study_activity(challenge.opponent_notion_page_id, since)
            challenge.opponent_notion_activity = activity
            challenge.opponent_progress = activity.get("page_count", 0)
        except Exception as e:
            logger.warning(f"Failed to poll opponent Notion for challenge {challenge.id}: {e}")

    challenge.last_notion_poll = datetime.utcnow()


async def poll_active_studying_challenges() -> None:
    """Poll Notion for all active studying challenges."""
    db: Session = SessionLocal()

    try:
        # Get active studying challenges that haven't been polled recently
        cutoff = datetime.utcnow() - timedelta(seconds=POLL_INTERVAL - 10)

        challenges = db.query(Challenge).filter(
            Challenge.category == ChallengeCategory.STUDYING,
            Challenge.status == ChallengeStatus.ACTIVE,
        ).filter(
            # Either never polled or polled before cutoff
            (Challenge.last_notion_poll == None) |  # noqa: E711
            (Challenge.last_notion_poll < cutoff)
        ).all()

        if challenges:
            logger.info(f"Polling {len(challenges)} active studying challenges")

        for challenge in challenges:
            await poll_challenge(challenge, db)

        db.commit()

    except Exception as e:
        logger.error(f"Error in Notion polling loop: {e}")
        db.rollback()
    finally:
        db.close()


async def start_polling_loop() -> None:
    """Start the background polling loop."""
    logger.info("Starting Notion polling service")

    while True:
        try:
            await poll_active_studying_challenges()
        except Exception as e:
            logger.error(f"Unhandled error in polling loop: {e}")

        await asyncio.sleep(POLL_INTERVAL)
