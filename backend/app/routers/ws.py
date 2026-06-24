"""The single per-user WebSocket endpoint: /api/ws"""

import logging

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.config import settings
from app.core.ws import manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Authenticate the user. We don't use a dependency here because we need to
    # handle the case where the user is not authenticated by closing the socket.
    #
    # Prefer the Authorization header: React Native CAN set WS headers,
    # and headers don't leak into server access logs the way query strings do.
    # Fall back to ?token= query param for the web build, where the browser 
    # WebSocket API forbids custom headers (local dev only).
    auth_header = websocket.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:]
    else:
        token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        # Same decode as app/core/security.py — verifies signature + expiry.
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload["sub"])   
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Register
    await manager.connect(user_id, websocket)

    # Keep the connection open until the client disconnects.
    # We don't expect the client to send anything; this loop only exists so we
    # learn when the socket closes (WebSocketDisconnect is raised) and can clean
    # up. The server speaks via broadcast_challenge(), not from here.
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        manager.disconnect(user_id, websocket)