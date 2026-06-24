"""In-memory WebSocket connection registry + broadcast helper.

One process holds all open sockets in a dict keyed by user_id. This is the
whole real-time layer — there is no database or message broker involved.
"""

import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Tracks which open WebSockets belong to which user."""

    def __init__(self) -> None:
        # user_id -> set of that user's currently-open sockets.
        # A set (not a single socket) because the same user can be on two
        # devices, or have the app open twice.
        self._connections: dict[int, set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        """Accept the socket and remember it under this user."""
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(websocket)
        logger.info("WS connected: user %s (%d open)", user_id, len(self._connections[user_id]))

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        """Forget a socket that has closed."""
        sockets = self._connections.get(user_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(user_id, None)
        logger.info("WS disconnected: user %s (%d open)", user_id, len(self._connections[user_id]))

    async def send_to_users(self, user_ids: list[int], payload: dict) -> None:
        """Push a JSON payload to every open socket of every listed user.

        Dead sockets (closed without telling us) are removed quietly so they
        don't pile up.
        """
        for user_id in user_ids:
            for socket in list(self._connections.get(user_id, set())):
                try:
                    await socket.send_json(payload)
                except Exception:
                    # The socket is dead — drop it.
                    self.disconnect(user_id, socket)


# A single shared switchboard for the whole app. Import THIS everywhere.
manager = ConnectionManager()


async def broadcast_challenge(challenge) -> None:
    """Push an updated challenge to both of its participants.
    """
    # Imported here (not at top) to avoid a circular import: schemas import
    # models, and we only need this at call time.
    from app.schemas.challenge import challenge_to_response

    user_ids = [challenge.creator_id]
    if challenge.opponent_id:
        user_ids.append(challenge.opponent_id)

    payload = {
        "type": "challenge_updated",
        "challenge": challenge_to_response(challenge).model_dump(mode="json"),
    }
    await manager.send_to_users(user_ids, payload)