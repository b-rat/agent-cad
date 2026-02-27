from typing import Literal

from pydantic import BaseModel


class ChatMessage(BaseModel):
    type: Literal["chat"] = "chat"
    role: Literal["user", "assistant"]
    content: str


class CadUpdateMessage(BaseModel):
    type: Literal["cad_update"] = "cad_update"
    vertices: list[float] = []
    faces: list[int] = []
    normals: list[float] = []
    metadata: dict | None = None


class DrawingMessage(BaseModel):
    type: Literal["drawing"] = "drawing"
    points: list[dict] = []
    action: Literal["start", "move", "end"] = "start"


class SystemMessage(BaseModel):
    type: Literal["system"] = "system"
    content: str


WSMessage = ChatMessage | CadUpdateMessage | DrawingMessage | SystemMessage
