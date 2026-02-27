import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

from ..models.messages import (
    FaceMetadata, MeshData, ModelInfo, UploadResponse, ExportRequest,
)
from ..services.cad_engine import CadEngine

router = APIRouter(prefix="/api", tags=["model"])

# Single global engine instance (matches steplabeler pattern)
engine = CadEngine()


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

        return UploadResponse(
            success=True,
            info=ModelInfo(**info_dict),
            mesh=MeshData(**mesh_dict),
            faces=[FaceMetadata(**f) for f in faces_list],
            filename=file.filename,
        )
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
