import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # Send system greeting
    await websocket.send_json({
        "type": "system",
        "content": "Connected to agent-cad server.",
    })

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "chat":
                await websocket.send_json({
                    "type": "chat",
                    "role": "assistant",
                    "content": f"[echo] {message.get('content', '')}",
                })
    except WebSocketDisconnect:
        pass
