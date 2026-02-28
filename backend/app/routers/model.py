import asyncio
import base64
import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from ..models.messages import (
    FaceMetadata, MeshData, ModelInfo, UploadResponse, ExportRequest,
)
from ..services.cad_engine import CadEngine

router = APIRouter(prefix="/api", tags=["model"])

# Single global engine instance (matches steplabeler pattern)
engine = CadEngine()

# Screenshot handshake state
_screenshot_data: bytes | None = None
_screenshot_event: asyncio.Event | None = None


@router.post("/upload", response_model=UploadResponse)
async def upload_step(file: UploadFile = File(...)):
    """Upload a STEP file, tessellate, and return mesh + metadata."""
    if not file.filename:
        raise HTTPException(400, "No file provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".step", ".stp"):
        raise HTTPException(400, f"Unsupported file type: {suffix}")

    # Save to temp directory
    tmp_dir = Path(tempfile.mkdtemp())
    tmp_path = tmp_dir / file.filename
    content = await file.read()
    tmp_path.write_bytes(content)

    try:
        info_dict = engine.load_step(tmp_path)
        mesh_dict = engine.tessellate()
        faces_list = engine.get_faces_metadata()

        response = UploadResponse(
            success=True,
            info=ModelInfo(**info_dict),
            mesh=MeshData(**mesh_dict),
            faces=[FaceMetadata(**f) for f in faces_list],
            filename=file.filename,
        )

        # Broadcast to all connected WebSocket clients so the viewer updates
        from .ws import broadcast
        await broadcast({
            "type": "cad_update",
            "mesh": mesh_dict,
            "faces": faces_list,
            "info": info_dict,
            "filename": file.filename,
        })

        return response
    except Exception as e:
        return UploadResponse(success=False, error=str(e))


@router.get("/faces")
async def get_faces():
    """Return face metadata array."""
    meta = engine.get_faces_metadata()
    if not meta:
        raise HTTPException(404, "No model loaded")
    return {"faces": meta}


@router.get("/face/{face_id}")
async def get_face(face_id: int):
    """Return single face metadata."""
    face = engine.get_face_metadata(face_id)
    if face is None:
        raise HTTPException(404, f"Face {face_id} not found")
    return face


@router.post("/features")
async def save_features(data: dict):
    """Save feature definitions."""
    engine.features = data.get("features", {})
    return {"success": True}


@router.get("/features")
async def get_features():
    """Get current feature definitions."""
    return {"features": engine.features}


class ScreenshotPayload(BaseModel):
    image: str  # data:image/png;base64,... URL


@router.get("/screenshot")
async def get_screenshot():
    """Request a screenshot from the browser and return PNG bytes."""
    global _screenshot_data, _screenshot_event
    _screenshot_data = None
    _screenshot_event = asyncio.Event()

    # Ask all connected browsers to capture their canvas
    from .ws import broadcast
    await broadcast({"type": "screenshot_request"})

    # Wait for the browser to POST back the image
    try:
        await asyncio.wait_for(_screenshot_event.wait(), timeout=5.0)
    except asyncio.TimeoutError:
        raise HTTPException(504, "Screenshot capture timed out — is the browser open?")

    if _screenshot_data is None:
        raise HTTPException(500, "Screenshot data was not received")

    return Response(content=_screenshot_data, media_type="image/png")


@router.post("/screenshot")
async def post_screenshot(payload: ScreenshotPayload):
    """Receive a screenshot from the browser (base64 data URL)."""
    global _screenshot_data, _screenshot_event

    # Strip the data URL prefix: "data:image/png;base64,..."
    header, _, b64 = payload.image.partition(",")
    if not b64:
        raise HTTPException(400, "Invalid image data URL")

    _screenshot_data = base64.b64decode(b64)
    if _screenshot_event is not None:
        _screenshot_event.set()

    return {"success": True}


class ViewRequest(BaseModel):
    view: str
    zoom: float = 1.0


@router.post("/view")
async def set_view(request: ViewRequest):
    """Set the camera view orientation in the 3D viewer."""
    from .ws import broadcast
    await broadcast({
        "type": "cad_command",
        "action": "set_view",
        "view": request.view,
        "zoom": request.zoom,
    })
    return {"success": True, "view": request.view, "zoom": request.zoom}


class SelectFacesRequest(BaseModel):
    face_ids: list[int]


@router.post("/select-faces")
async def select_faces(request: SelectFacesRequest):
    """Select faces in the 3D viewer by ID. Replaces current selection."""
    from .ws import broadcast
    await broadcast({"type": "cad_command", "action": "clear_selection"})
    await broadcast({
        "type": "cad_command",
        "action": "select_faces",
        "face_ids": request.face_ids,
    })
    return {"success": True, "face_ids": request.face_ids}


@router.post("/clear-selection")
async def clear_selection():
    """Clear all face selections in the 3D viewer."""
    from .ws import broadcast
    await broadcast({"type": "cad_command", "action": "clear_selection"})
    return {"success": True}


class CreateFeatureRequest(BaseModel):
    name: str


@router.post("/create-feature")
async def create_feature(request: CreateFeatureRequest):
    """Create a named feature from currently selected faces."""
    from .ws import broadcast
    await broadcast({
        "type": "cad_command",
        "action": "create_feature",
        "name": request.name,
    })
    return {"success": True, "name": request.name}


class DeleteFeatureRequest(BaseModel):
    name: str


@router.post("/delete-feature")
async def delete_feature(request: DeleteFeatureRequest):
    """Delete a named feature."""
    from .ws import broadcast
    await broadcast({
        "type": "cad_command",
        "action": "delete_feature",
        "name": request.name,
    })
    return {"success": True, "name": request.name}


class DisplayRequest(BaseModel):
    xray: bool | None = None
    wireframe: bool | None = None
    colors: bool | None = None
    clip_plane: str | None = None
    fit_all: bool | None = None


@router.post("/display")
async def set_display(request: DisplayRequest):
    """Control viewport display settings."""
    from .ws import broadcast
    payload: dict = {"type": "cad_command", "action": "set_display"}
    if request.xray is not None:
        payload["xray"] = request.xray
    if request.wireframe is not None:
        payload["wireframe"] = request.wireframe
    if request.colors is not None:
        payload["colors"] = request.colors
    if request.clip_plane is not None:
        payload["clip_plane"] = request.clip_plane
    if request.fit_all is not None:
        payload["fit_all"] = request.fit_all
    await broadcast(payload)
    return {"success": True}


@router.post("/export")
async def export_step(request: ExportRequest):
    """Export named STEP file."""
    if engine.step_content is None:
        raise HTTPException(400, "No model loaded")

    # Convert to the format expected by export_named_step
    features_dict = {}
    for name, members in request.features.items():
        features_dict[name] = [m.model_dump() for m in members]

    tmp_dir = Path(tempfile.mkdtemp())
    original_name = engine.step_path.stem if engine.step_path else "model"
    output_path = tmp_dir / f"{original_name}_named.step"

    try:
        engine.export_named_step(features_dict, output_path)
        return FileResponse(
            path=str(output_path),
            filename=output_path.name,
            media_type="application/octet-stream",
        )
    except Exception as e:
        raise HTTPException(500, str(e))
