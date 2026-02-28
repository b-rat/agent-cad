# agent-cad

Harness for building CAD with AI agents. React + R3F frontend, FastAPI + CadQuery backend, with an MCP server that lets Claude Code generate and visualize parametric geometry.

## 3D Viewer

The browser-based viewer renders STEP/STP files in an interactive 3D viewport built on react-three-fiber.

- **Import** — Load `.step` / `.stp` files via the toolbar. The backend tessellates geometry with OCP and streams mesh data + face metadata to the frontend.
- **Navigation** — TrackballControls for full continuous orbit (no gimbal lock), zoom, and pan.
- **Face selection** — Click faces to select, shift-click to multi-select. Hover highlights with real-time feedback. Raycasting maps triangle hits back to B-Rep face IDs.
- **Features** — Group selected faces into named features (snake_case). Features are color-coded with a 10-color palette. Existing STEP entity names are imported automatically.
- **Measurements** — Auto-computed from selected faces: cylinder diameter/radius, distance between parallel planes, angle between non-parallel planes, center distance between cylinders, axis-to-plane distance.
- **Display modes** — X-ray (transparency), wireframe overlay, feature colors toggle, section clipping planes (XY/YZ/XZ with offset and flip), fit-to-extents.
- **Export** — Save model with named features back to a STEP file.

## Chat (AI Assistant)

The right panel includes a Chat tab connected to a Claude-powered AI agent via WebSocket.

- **Per-connection agent** — Each browser tab gets its own agent instance with fresh conversation history.
- **Tool use** — The agent can inspect the loaded model (face metadata, surface types, areas), select/deselect faces, create/delete features, and toggle display modes — all reflected live in the 3D viewport.
- **Model** — Uses `claude-sonnet-4-6` by default. Override with `CLAUDE_MODEL` env var (e.g. `claude-opus-4-6`).

## MCP / Claude Code Integration

The `.mcp.json` at project root registers a CadQuery MCP server with Claude Code. Any Claude Code session opened in this directory can generate geometry, label features, control the display, and interact with the viewer.

### MCP Tools

| Tool | Description |
|------|-------------|
| `execute_cadquery(code)` | Run CadQuery Python code, export STEP, push result to the viewer |
| `get_model_info()` | Query loaded model metadata — face count, surface types, bounding box, features |
| `query_faces(surface_type, min_area, max_area)` | Filter and inspect individual faces by type or area range |
| `get_screenshot()` | Capture the current 3D viewport as a PNG image |
| `set_view(view, zoom)` | Set camera to a standard view before capturing — front, back, left, right, top, bottom, isometric. Zoom: 1.0 = fit, 2.0 = 2x closer |
| `select_faces(face_ids)` | Select faces in the viewport by ID. Replaces current selection |
| `clear_selection()` | Clear all face selections |
| `create_feature(name)` | Create a named feature from the currently selected faces |
| `delete_feature(name)` | Delete a named feature |
| `set_display(xray, wireframe, colors, clip_plane, fit_all)` | Control viewport display settings — all parameters optional |

### Screenshot capture

The `get_screenshot` tool lets Claude Code see what's on screen. The flow:

1. Claude Code calls `get_screenshot` via MCP
2. MCP server sends `GET /api/screenshot` to the FastAPI backend
3. Backend broadcasts a `screenshot_request` over WebSocket to the browser
4. Browser captures the canvas (`toDataURL`) and POSTs the base64 PNG back
5. Backend returns the decoded PNG bytes to the MCP server
6. Claude Code receives the image

This requires the backend, frontend, and a browser tab to be running.

### View control

The `set_view` tool orients the camera to a standard view before capturing screenshots. Use it in combination with `get_screenshot` to get consistent, oriented images of the model. The view change is also reflected live in the browser viewport.

```
set_view(view="front")        # front view, fit to model
set_view(view="top", zoom=2)  # top-down, zoomed in 2x
get_screenshot()              # capture the result
```

### Feature labeling

Claude Code can select faces, create named features, and control display — the same capabilities as the in-app chat agent. All actions are reflected live in the browser viewport.

```
query_faces(surface_type="cylindrical")       # find cylindrical faces
select_faces(face_ids=[3, 7])                 # select them in the viewport
create_feature(name="bore_hole")              # label as a feature
set_display(xray=True)                        # x-ray mode to see internals
set_display(xray=False, fit_all=True)         # reset
delete_feature(name="bore_hole")              # remove if needed
clear_selection()                             # deselect all
```

## Setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY=<your-api-key>
```

### Frontend

```bash
cd frontend
npm install
```

## Running

Quick start (both servers in one terminal):

```bash
./start.sh    # Ctrl+C stops both
```

Or start separately:

```bash
# Terminal 1 — Backend (port 8000)
cd backend
source .venv/bin/activate
uvicorn app.main:app --port 8000

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

Open http://localhost:5173 to use the 3D viewer. The frontend proxies `/api` and `/ws` to the backend.

Note: avoid `--reload` on uvicorn — OCP imports are heavy and make restarts slow.
