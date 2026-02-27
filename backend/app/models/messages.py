from typing import Literal

from pydantic import BaseModel


# --- WebSocket message models ---

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


# --- CAD model data models ---

class FaceMetadata(BaseModel):
    id: int
    surface_type: str
    area: float
    centroid: list[float]
    normal: list[float]
    bounds: list[float]
    radius: float | None = None
    axis_direction: list[float] | None = None
    axis_point: list[float] | None = None
    arc_angle: float | None = None
    step_name: str | None = None


class MeshData(BaseModel):
    vertices: list[float]
    normals: list[float]
    triangles: list[int]
    face_ids: list[int]
    num_faces: int
    edges: list[float]


class ModelInfo(BaseModel):
    num_faces: int
    num_step_entities: int
    length_unit: str
    length_scale: float


class UploadResponse(BaseModel):
    success: bool
    info: ModelInfo | None = None
    mesh: MeshData | None = None
    faces: list[FaceMetadata] | None = None
    filename: str | None = None
    error: str | None = None


class FeatureMember(BaseModel):
    face_id: int
    sub_name: str | None = None


class Feature(BaseModel):
    color: list[float]
    faces: list[FeatureMember]


class ExportRequest(BaseModel):
    features: dict[str, list[FeatureMember]]
