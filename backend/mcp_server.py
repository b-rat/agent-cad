"""
MCP server for generative CAD via CadQuery.

Standalone process (stdio transport) that lets Claude Code:
- Execute CadQuery Python code and push results to the 3D viewer
- Query the currently loaded model's face metadata

Usage:
    backend/.venv/bin/python backend/mcp_server.py
"""

import math
import os
import traceback
from collections import Counter
from pathlib import Path

import time

import cadquery as cq
import httpx
import numpy as np
from fastmcp import FastMCP
from fastmcp.utilities.types import Image
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.TopAbs import TopAbs_FACE
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Surface
from OCP.GeomAbs import (
    GeomAbs_Plane,
    GeomAbs_Cylinder,
    GeomAbs_Cone,
    GeomAbs_Sphere,
    GeomAbs_Torus,
    GeomAbs_BSplineSurface,
    GeomAbs_BezierSurface,
    GeomAbs_SurfaceOfRevolution,
    GeomAbs_SurfaceOfExtrusion,
    GeomAbs_OffsetSurface,
)

mcp = FastMCP(name="agent-cad")

VIEWER_URL = os.environ.get("CAD_VIEWER_URL", "http://localhost:8000")
GENERATED_DIR = Path(__file__).parent.parent / "generated"

SURFACE_TYPE_NAMES = {
    GeomAbs_Plane: "planar",
    GeomAbs_Cylinder: "cylindrical",
    GeomAbs_Cone: "conical",
    GeomAbs_Sphere: "spherical",
    GeomAbs_Torus: "toroidal",
    GeomAbs_BSplineSurface: "bspline",
    GeomAbs_BezierSurface: "bezier",
    GeomAbs_SurfaceOfRevolution: "revolution",
    GeomAbs_SurfaceOfExtrusion: "extrusion",
    GeomAbs_OffsetSurface: "offset",
}


def _viewer_healthy() -> bool:
    """Check if the viewer backend is running."""
    try:
        resp = httpx.get(f"{VIEWER_URL}/api/health", timeout=2)
        return resp.status_code == 200
    except (httpx.ConnectError, httpx.TimeoutException):
        return False


def _extract_shape_metadata(shape) -> dict:
    """Extract face counts, surface types, and bounding box from an OCP shape."""
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    surface_types: list[str] = []
    while explorer.More():
        face = TopoDS.Face_s(explorer.Current())
        adaptor = BRepAdaptor_Surface(face)
        stype = SURFACE_TYPE_NAMES.get(adaptor.GetType(), "other")
        surface_types.append(stype)
        explorer.Next()

    type_counts = dict(Counter(surface_types))

    bbox = Bnd_Box()
    BRepBndLib.Add_s(shape, bbox)
    xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()

    props = GProp_GProps()
    BRepGProp.SurfaceProperties_s(shape, props)

    return {
        "num_faces": len(surface_types),
        "surface_types": type_counts,
        "bbox": {
            "x_min": round(xmin, 4),
            "y_min": round(ymin, 4),
            "z_min": round(zmin, 4),
            "x_max": round(xmax, 4),
            "y_max": round(ymax, 4),
            "z_max": round(zmax, 4),
            "width": round(xmax - xmin, 4),
            "height": round(ymax - ymin, 4),
            "depth": round(zmax - zmin, 4),
        },
        "total_surface_area": round(props.Mass(), 4),
    }


@mcp.tool()
def execute_cadquery(code: str, filename: str = "generated") -> dict:
    """Execute CadQuery Python code and optionally push the result to the 3D viewer.

    The code must assign its result to a variable named `result`.
    The result should be a CadQuery Workplane or an OCP TopoDS_Shape.

    Example:
        result = cq.Workplane("XY").box(10, 20, 5)

    Args:
        code: CadQuery Python code to execute. Must assign to `result`.
        filename: Base name for the output STEP file (without extension).

    Returns:
        On success: filepath, num_faces, surface_types, bbox, viewer_status
        On error: error message and traceback for debugging
    """
    # Prepare execution namespace
    namespace = {
        "cq": cq,
        "math": math,
        "np": np,
    }

    # Execute the code
    try:
        exec(code, namespace)
    except Exception as e:
        return {
            "error": f"Execution error: {type(e).__name__}: {e}",
            "traceback": traceback.format_exc(),
        }

    # Get the result
    result = namespace.get("result")
    if result is None:
        return {
            "error": "Code must assign to a variable named `result`. "
            "Example: result = cq.Workplane('XY').box(10, 20, 5)",
        }

    # Extract the OCP shape
    try:
        if hasattr(result, "val"):
            # CadQuery Workplane
            shape = result.val().wrapped
        elif hasattr(result, "wrapped"):
            # CadQuery Shape
            shape = result.wrapped
        else:
            # Assume raw TopoDS_Shape
            shape = result
    except Exception as e:
        return {
            "error": f"Could not extract shape from result: {e}",
            "traceback": traceback.format_exc(),
        }

    # Export as STEP
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    step_path = GENERATED_DIR / f"{filename}.step"
    try:
        cq.exporters.export(result, str(step_path))
    except Exception as e:
        return {
            "error": f"STEP export failed: {e}",
            "traceback": traceback.format_exc(),
        }

    # Extract metadata
    try:
        metadata = _extract_shape_metadata(shape)
    except Exception as e:
        metadata = {"error": f"Metadata extraction failed: {e}"}

    # Upload to viewer if running
    viewer_status = "not_running"
    if _viewer_healthy():
        try:
            with open(step_path, "rb") as f:
                resp = httpx.post(
                    f"{VIEWER_URL}/api/upload",
                    files={"file": (step_path.name, f, "application/octet-stream")},
                    timeout=30,
                )
            if resp.status_code == 200:
                viewer_status = "uploaded"
            else:
                viewer_status = f"upload_failed: {resp.status_code} {resp.text[:200]}"
        except Exception as e:
            viewer_status = f"upload_error: {e}"

    return {
        "filepath": str(step_path),
        "viewer_status": viewer_status,
        **metadata,
    }


@mcp.tool()
def get_model_info() -> dict:
    """Get information about the model currently loaded in the 3D viewer.

    Returns filename, face count, units, features, surface type summary,
    and bounding box of the loaded model.
    """
    if not _viewer_healthy():
        return {"error": "Viewer backend is not running at " + VIEWER_URL}

    try:
        resp = httpx.get(f"{VIEWER_URL}/api/faces", timeout=10)
        if resp.status_code == 404:
            return {"error": "No model loaded in the viewer"}
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

    faces = resp.json().get("faces", [])
    type_counts = dict(Counter(f["surface_type"] for f in faces))

    # Compute bounding box from face bounds
    all_mins = [f["bounds"][:3] for f in faces if f.get("bounds")]
    all_maxs = [f["bounds"][3:] for f in faces if f.get("bounds")]
    bbox = {}
    if all_mins and all_maxs:
        mins = [min(v[i] for v in all_mins) for i in range(3)]
        maxs = [max(v[i] for v in all_maxs) for i in range(3)]
        bbox = {
            "x_min": mins[0], "y_min": mins[1], "z_min": mins[2],
            "x_max": maxs[0], "y_max": maxs[1], "z_max": maxs[2],
            "width": round(maxs[0] - mins[0], 4),
            "height": round(maxs[1] - mins[1], 4),
            "depth": round(maxs[2] - mins[2], 4),
        }

    # Get features
    features = {}
    try:
        feat_resp = httpx.get(f"{VIEWER_URL}/api/features", timeout=5)
        if feat_resp.status_code == 200:
            features = feat_resp.json().get("features", {})
    except Exception:
        pass

    return {
        "num_faces": len(faces),
        "surface_types": type_counts,
        "bbox": bbox,
        "features": features,
    }


@mcp.tool()
def query_faces(
    surface_type: str | None = None,
    min_area: float | None = None,
    max_area: float | None = None,
    limit: int = 20,
) -> dict:
    """Query faces of the model currently loaded in the 3D viewer.

    Filter by surface type and/or area range. Returns face metadata
    including id, surface_type, area, centroid, normal, radius, etc.

    Args:
        surface_type: Filter by type (e.g. "planar", "cylindrical", "conical",
                      "spherical", "toroidal", "bspline").
        min_area: Minimum face area.
        max_area: Maximum face area.
        limit: Maximum number of faces to return (default 20).
    """
    if not _viewer_healthy():
        return {"error": "Viewer backend is not running at " + VIEWER_URL}

    try:
        resp = httpx.get(f"{VIEWER_URL}/api/faces", timeout=10)
        if resp.status_code == 404:
            return {"error": "No model loaded in the viewer"}
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

    faces = resp.json().get("faces", [])

    if surface_type:
        faces = [f for f in faces if f["surface_type"] == surface_type]
    if min_area is not None:
        faces = [f for f in faces if f["area"] >= min_area]
    if max_area is not None:
        faces = [f for f in faces if f["area"] <= max_area]

    return {
        "total_matching": len(faces),
        "faces": faces[:limit],
        "truncated": len(faces) > limit,
    }


@mcp.tool()
def get_screenshot() -> Image | dict:
    """Capture a screenshot of the 3D viewer and return it as a PNG image.

    Requires the viewer backend and a browser with the viewer open.
    Returns the current viewport as a PNG image."""
    if not _viewer_healthy():
        return {"error": "Viewer backend is not running at " + VIEWER_URL}

    try:
        resp = httpx.get(f"{VIEWER_URL}/api/screenshot", timeout=10)
        resp.raise_for_status()
        return Image(data=resp.content, format="png")
    except httpx.TimeoutException:
        return {"error": "Screenshot timed out — is the browser open at localhost:5173?"}
    except httpx.HTTPStatusError as e:
        return {"error": f"Screenshot failed: {e.response.status_code} {e.response.text[:200]}"}
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def set_view(
    view: str = "front",
    zoom: float = 1.0,
) -> dict:
    """Set the camera view orientation in the 3D viewer.

    Use this before get_screenshot() to orient the camera to a standard view.

    Args:
        view: Camera orientation — "front", "back", "left", "right",
              "top", "bottom", or "isometric".
        zoom: Zoom multiplier. 1.0 = fit model in view, 2.0 = 2x closer,
              0.5 = 2x farther. Default 1.0.

    Returns:
        Confirmation of the view that was set.
    """
    valid_views = {"front", "back", "left", "right", "top", "bottom", "isometric"}
    if view not in valid_views:
        return {"error": f"Invalid view '{view}'. Must be one of: {', '.join(sorted(valid_views))}"}

    if not _viewer_healthy():
        return {"error": "Viewer backend is not running at " + VIEWER_URL}

    try:
        resp = httpx.post(
            f"{VIEWER_URL}/api/view",
            json={"view": view, "zoom": zoom},
            timeout=5,
        )
        resp.raise_for_status()
        # Give the browser time to receive WS, move camera, and render
        time.sleep(0.5)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    mcp.run()
