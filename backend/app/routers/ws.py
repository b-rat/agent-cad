import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .model import engine
from ..services.ai_agent import AIAgent

logger = logging.getLogger(__name__)

router = APIRouter()

# Connected WebSocket clients — used to broadcast model updates from REST uploads
connected_clients: set[WebSocket] = set()


async def broadcast(data: dict):
    """Send a message to all connected WebSocket clients."""
    dead: list[WebSocket] = []
    for ws in connected_clients:
        try:
            await ws.send_json(data)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connected_clients.discard(ws)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)

    # Closure that sends JSON to this specific websocket connection
    async def send_command(data: dict):
        await websocket.send_json(data)

    # Per-connection agent sharing the global CadEngine
    agent = AIAgent(cad_engine=engine, send_command=send_command)

    await websocket.send_json({
        "type": "system",
        "content": "Connected to agent-cad server. AI assistant ready.",
    })

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "chat":
                user_text = message.get("content", "")
                try:
                    reply = await agent.send_message(user_text)
                    await websocket.send_json({
                        "type": "chat",
                        "role": "assistant",
                        "content": reply,
                    })
                except Exception:
                    logger.exception("Agent error")
                    await websocket.send_json({
                        "type": "system",
                        "content": "An error occurred while processing your message. Please try again.",
                    })
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
