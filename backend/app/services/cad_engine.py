from pathlib import Path


class CadEngine:
    """CAD engine backed by CadQuery/OCP for STEP file operations."""

    def load_step(self, path: Path) -> None:
        """Load a STEP file into the engine."""
        raise NotImplementedError

    def tessellate(self) -> dict:
        """Tessellate the loaded shape and return mesh data (vertices, faces, normals)."""
        raise NotImplementedError

    def get_faces_metadata(self) -> list[dict]:
        """Return metadata for each face in the loaded shape."""
        raise NotImplementedError
