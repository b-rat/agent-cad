"""AI agent backed by Claude for CAD-related conversations with tool use."""

import json
import logging
import os
from typing import Any, Callable, Awaitable

from anthropic import AsyncAnthropic

from .cad_engine import CadEngine

DEFAULT_MODEL = "claude-sonnet-4-5"
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", DEFAULT_MODEL)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are an expert CAD assistant embedded in a 3D CAD viewer application. \
You help users understand, inspect, and annotate STEP models.

You have access to a loaded CAD model (if one is loaded). You can:
- Query model info and face metadata (surface type, area, centroid, normals, radius, etc.)
- Select and deselect faces in the 3D viewport
- Create named features (groups of faces) and delete them
- Control display settings (x-ray, wireframe, colors, clip planes, fit-to-extents)

Guidelines:
- Be concise and precise. Use engineering terminology.
- When describing faces, mention their surface type, area, and relevant geometry.
- Units come from the STEP file (usually mm). Always state units.
- When the user asks to "show" or "highlight" faces, select them in the viewport.
- When creating features, use snake_case names.
- If no model is loaded, tell the user to import a STEP file first.
- You can select faces and then create a feature from the selection in sequence.
"""

TOOLS = [
    {
        "name": "get_model_info",
        "description": "Get information about the currently loaded CAD model: filename, number of faces, length unit, and existing features.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "query_faces",
        "description": "Query face metadata. Filter by surface type, minimum/maximum area, or specific face IDs. Returns matching face metadata (id, surface_type, area, centroid, normal, radius, etc.).",
        "input_schema": {
            "type": "object",
            "properties": {
                "surface_type": {
                    "type": "string",
                    "description": "Filter by surface type: planar, cylindrical, conical, spherical, toroidal, bspline, etc.",
                },
                "min_area": {
                    "type": "number",
                    "description": "Minimum face area filter.",
                },
                "max_area": {
                    "type": "number",
                    "description": "Maximum face area filter.",
                },
                "face_ids": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Specific face IDs to retrieve.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results to return. Defaults to 50.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "select_faces",
        "description": "Select (highlight) faces in the 3D viewport by their IDs. Replaces the current selection.",
        "input_schema": {
            "type": "object",
            "properties": {
                "face_ids": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Face IDs to select.",
                },
            },
            "required": ["face_ids"],
        },
    },
    {
        "name": "clear_selection",
        "description": "Clear all face selections in the 3D viewport.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "create_feature",
        "description": "Create a named feature from the currently selected faces. Faces must be selected first (use select_faces). The name should be snake_case.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Feature name in snake_case, e.g. 'mounting_holes'.",
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "delete_feature",
        "description": "Delete a named feature, unassigning its faces.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name of the feature to delete.",
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "set_display",
        "description": "Control viewport display settings: x-ray mode, wireframe visibility, face colors, clip planes, and fit-to-extents.",
        "input_schema": {
            "type": "object",
            "properties": {
                "xray": {
                    "type": "boolean",
                    "description": "Enable or disable x-ray (transparent) mode.",
                },
                "wireframe": {
                    "type": "boolean",
                    "description": "Show or hide wireframe edges.",
                },
                "colors": {
                    "type": "boolean",
                    "description": "Show or hide face colors.",
                },
                "clip_plane": {
                    "type": "string",
                    "enum": ["XY", "YZ", "XZ", "off"],
                    "description": "Set clip plane or 'off' to disable.",
                },
                "fit_all": {
                    "type": "boolean",
                    "description": "If true, fit the camera to show the entire model.",
                },
            },
            "required": [],
        },
    },
]

# Type alias for the callback that sends WS messages to the frontend
SendCommand = Callable[[dict[str, Any]], Awaitable[None]]


class AIAgent:
    """AI agent backed by Claude for CAD-related conversations."""

    def __init__(self, cad_engine: CadEngine, send_command: SendCommand) -> None:
        self.cad_engine = cad_engine
        self.send_command = send_command
        self.client = AsyncAnthropic()  # reads ANTHROPIC_API_KEY from env
        self.conversation_history: list[dict] = []

    async def send_message(self, user_message: str) -> str:
        """Send a user message, run the tool-use loop, return the final text response."""
        self.conversation_history.append({"role": "user", "content": user_message})

        # Agentic loop: call Claude, execute tools, repeat until end_turn
        while True:
            response = await self.client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=self.conversation_history,
            )

            # Append assistant response to history
            self.conversation_history.append(
                {"role": "assistant", "content": response.content}
            )

            if response.stop_reason == "end_turn":
                break

            # Extract tool_use blocks and execute them
            tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
            if not tool_use_blocks:
                break

            tool_results = []
            for tool_block in tool_use_blocks:
                result = await self._execute_tool(tool_block.name, tool_block.input)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_block.id,
                        "content": json.dumps(result) if isinstance(result, (dict, list)) else str(result),
                    }
                )

            # Append tool results as user message
            self.conversation_history.append({"role": "user", "content": tool_results})

        # Extract final text response
        text_parts = [b.text for b in response.content if b.type == "text"]
        return "\n".join(text_parts) if text_parts else ""

    async def _execute_tool(self, name: str, input_data: dict) -> Any:
        """Execute a tool call and return the result."""
        try:
            if name == "get_model_info":
                return await self._tool_get_model_info()
            elif name == "query_faces":
                return await self._tool_query_faces(input_data)
            elif name == "select_faces":
                return await self._tool_select_faces(input_data)
            elif name == "clear_selection":
                return await self._tool_clear_selection()
            elif name == "create_feature":
                return await self._tool_create_feature(input_data)
            elif name == "delete_feature":
                return await self._tool_delete_feature(input_data)
            elif name == "set_display":
                return await self._tool_set_display(input_data)
            else:
                return {"error": f"Unknown tool: {name}"}
        except Exception as e:
            logger.exception("Tool execution error: %s", name)
            return {"error": str(e)}

    async def _tool_get_model_info(self) -> dict:
        if self.cad_engine.shape is None:
            return {"error": "No model loaded. Please import a STEP file first."}

        filename = self.cad_engine.step_path.name if self.cad_engine.step_path else "unknown"
        return {
            "filename": filename,
            "num_faces": len(self.cad_engine.faces),
            "length_unit": self.cad_engine.length_unit,
            "features": list(self.cad_engine.features.keys()) if self.cad_engine.features else [],
        }

    async def _tool_query_faces(self, input_data: dict) -> dict:
        if self.cad_engine.shape is None:
            return {"error": "No model loaded."}

        faces = self.cad_engine.face_metadata
        results = list(faces)  # copy

        surface_type = input_data.get("surface_type")
        if surface_type:
            results = [f for f in results if f["surface_type"] == surface_type]

        min_area = input_data.get("min_area")
        if min_area is not None:
            results = [f for f in results if f["area"] >= min_area]

        max_area = input_data.get("max_area")
        if max_area is not None:
            results = [f for f in results if f["area"] <= max_area]

        face_ids = input_data.get("face_ids")
        if face_ids is not None:
            id_set = set(face_ids)
            results = [f for f in results if f["id"] in id_set]

        limit = input_data.get("limit", 50)
        results = results[:limit]

        return {"count": len(results), "faces": results}

    async def _tool_select_faces(self, input_data: dict) -> dict:
        face_ids = input_data.get("face_ids", [])
        if not face_ids:
            return {"error": "No face IDs provided."}

        # Send commands to frontend
        await self.send_command({
            "type": "cad_command",
            "action": "clear_selection",
        })
        await self.send_command({
            "type": "cad_command",
            "action": "select_faces",
            "face_ids": face_ids,
        })
        return {"selected": face_ids, "count": len(face_ids)}

    async def _tool_clear_selection(self) -> dict:
        await self.send_command({
            "type": "cad_command",
            "action": "clear_selection",
        })
        return {"status": "selection cleared"}

    async def _tool_create_feature(self, input_data: dict) -> dict:
        name = input_data.get("name", "")
        if not name:
            return {"error": "Feature name is required."}

        # Tell frontend to create the feature from current selection
        await self.send_command({
            "type": "cad_command",
            "action": "create_feature",
            "name": name,
        })
        return {"status": f"Feature '{name}' created from selected faces."}

    async def _tool_delete_feature(self, input_data: dict) -> dict:
        name = input_data.get("name", "")
        if not name:
            return {"error": "Feature name is required."}

        await self.send_command({
            "type": "cad_command",
            "action": "delete_feature",
            "name": name,
        })
        return {"status": f"Feature '{name}' deleted."}

    async def _tool_set_display(self, input_data: dict) -> dict:
        await self.send_command({
            "type": "cad_command",
            "action": "set_display",
            "xray": input_data.get("xray"),
            "wireframe": input_data.get("wireframe"),
            "colors": input_data.get("colors"),
            "clip_plane": None if input_data.get("clip_plane") == "off" else input_data.get("clip_plane"),
            "fit_all": input_data.get("fit_all"),
        })

        changes = {k: v for k, v in input_data.items() if v is not None}
        return {"status": "display updated", "changes": changes}
