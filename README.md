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

The `.mcp.json` at project root registers a CadQuery MCP server with Claude Code. Any Claude Code session opened in this directory can generate geometry and interact with the viewer.

### MCP Tools

| Tool | Description |
|------|-------------|
| `execute_cadquery(code)` | Run CadQuery Python code, export STEP, push result to the viewer |
| `get_model_info()` | Query loaded model metadata — face count, surface types, bounding box, features |
| `query_faces(surface_type, min_area, max_area)` | Filter and inspect individual faces by type or area range |
| `get_screenshot()` | Capture the current 3D viewport as a PNG image |

### Screenshot capture

The `get_screenshot` tool lets Claude Code see what's on screen. The flow:

1. Claude Code calls `get_screenshot` via MCP
2. MCP server sends `GET /api/screenshot` to the FastAPI backend
3. Backend broadcasts a `screenshot_request` over WebSocket to the browser
4. Browser captures the canvas (`toDataURL`) and POSTs the base64 PNG back
5. Backend returns the decoded PNG bytes to the MCP server
6. Claude Code receives the image

This requires the backend, frontend, and a browser tab to be running.

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

Start both the backend and frontend in separate terminals:

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
