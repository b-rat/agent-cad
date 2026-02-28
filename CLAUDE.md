# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**agent-cad** — A harness for building CAD (Computer-Aided Design) with AI agents.

Re-platformed from the **steplabeler** project (`/Users/brianratliff/machine_learning/steplabeler/`) which was Flask + vanilla Three.js. Now uses a modern React + R3F + FastAPI stack with hooks for agentic AI interaction via WebSocket chat.

- **Language**: Python 3.12 / TypeScript
- **License**: MIT (owner: b-rat / Brian Ratliff)
- **Remote**: `git@github.com:b-rat/agent-cad.git`

## Architecture

**Monorepo** with `frontend/` and `backend/` directories.

- **Frontend**: React + TypeScript + Vite + react-three-fiber (@react-three/fiber + @react-three/drei)
- **Backend**: FastAPI + uvicorn + CadQuery/OCP + Anthropic SDK
- **State**: Zustand store (`useModelStore`) — single source of truth for model, selection, features, display
- **Communication**: WebSocket at `/ws` for chat + cad_commands + screenshots (auto-reconnects every 2s); HTTP REST for model data and view control (`/api/upload`, `/api/faces`, `/api/view`, `/api/export`)
- **CAD Engine**: CadQuery + OCP (ported from steplabeler's `step_processor.py`)
- **3D Controls**: TrackballControls (full continuous orbit, no gimbal lock)

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/upload` | POST | Upload STEP file, returns mesh + face metadata |
| `/api/faces` | GET | All face metadata |
| `/api/face/{id}` | GET | Single face metadata |
| `/api/features` | GET/POST | Get/save feature definitions |
| `/api/export` | POST | Export named STEP file download |
| `/api/screenshot` | GET | Request viewport screenshot (triggers WS→browser→POST round-trip) |
| `/api/screenshot` | POST | Receive base64 PNG from browser (internal) |
| `/api/view` | POST | Set camera view orientation, broadcasts via WS |
| `/ws` | WS | Chat (Claude-powered AI agent) |

### WebSocket Protocol

JSON messages with `type` field as discriminator:

| Type | Direction | Purpose |
|------|-----------|---------|
| `chat` | Both | User prompts and AI responses |
| `cad_command` | Server→Client | Agent tool actions — actions: `select_faces`, `clear_selection`, `create_feature`, `delete_feature`, `set_display`, `set_view` |
| `cad_update` | Server→Client | Mesh data, modifications |
| `screenshot_request` | Server→Client | Ask browser to capture canvas and POST back |
| `drawing` | Both | Strokes, annotations |
| `system` | Server→Client | Connection status, errors |

### AI Agent Architecture

```
ChatPanel → useWebSocket → WS → ws.py → AIAgent → Anthropic API (Claude)
                                  ↑ send_command()        ↓ tool calls
                                  ↓ cad_command msgs       ↓
                             useWebSocket.onmessage → handleCadCommand → Zustand store → 3D viewport
```

- **Per-connection agent**: Each WS connection gets its own `AIAgent` with fresh conversation history
- **Shared CadEngine**: Imports the singleton from `model.py` — same instance serving REST endpoints
- **Tool use loop**: Agent calls Claude with tools, executes tool calls against CadEngine, sends `cad_command` messages to frontend for UI mutations, returns tool results to Claude, loops until text response
- **Model**: `claude-sonnet-4-6` by default (configurable via `CLAUDE_MODEL` env var)

### Agent Tools

| Tool | Purpose | Side Effects |
|------|---------|--------------|
| `get_model_info` | Filename, num_faces, units, features | None (read-only) |
| `query_faces` | Filter faces by type/area/IDs, returns metadata | None (read-only) |
| `select_faces` | Highlight faces in viewport | Sends `cad_command` → Zustand |
| `clear_selection` | Clear face selection | Sends `cad_command` → Zustand |
| `create_feature` | Group faces into named feature | Sends select + create commands |
| `delete_feature` | Remove a feature | Sends `cad_command` → Zustand |
| `set_display` | Toggle xray/wireframe/colors/clip/fit | Sends `cad_command` → Zustand |

### MCP Server Tools (Claude Code integration via `mcp_server.py`)

| Tool | Purpose |
|------|---------|
| `execute_cadquery` | Run CadQuery code, export STEP, push to viewer |
| `get_model_info` | Query loaded model metadata (faces, bbox, features) |
| `query_faces` | Filter faces by surface type/area range |
| `get_screenshot` | Capture viewport as PNG image (GET→WS→browser→POST round-trip) |
| `set_view` | Set camera to standard view (front/back/left/right/top/bottom/isometric) with zoom |

### Screenshot Flow

```
Claude Code ──MCP stdio──> mcp_server.py::get_screenshot()
                                │ httpx GET /api/screenshot
                                ▼
                      FastAPI GET handler → broadcast WS {"type":"screenshot_request"}
                                         → await asyncio.Event (5s timeout)
                      Browser receives WS → canvas.toDataURL("image/png")
                                         → POST /api/screenshot {image: dataURL}
                      FastAPI POST handler → decode base64 → set event
                      GET handler returns PNG bytes → MCP returns Image
```

### View Control Flow

```
Claude Code ──MCP stdio──> mcp_server.py::set_view(view, zoom)
                                │ httpx POST /api/view
                                ▼
                      FastAPI POST handler
                      → broadcast WS {"type":"cad_command", "action":"set_view", ...}
                                ▼
                      useWebSocket → handleCadCommand → store.setView()
                                ▼
                      ViewHelper component (CadViewer.tsx)
                      → direction vector + bbox → camera position + up vector
```

Standard views: front, back, left, right, top, bottom, isometric (Y-up coordinate system).
Zoom: 1.0 = fit model, 2.0 = 2x closer, 0.5 = 2x farther.

## Project Structure

```
agent-cad/
├── .mcp.json              # MCP server config (registers backend/mcp_server.py)
├── start.sh               # Start backend + frontend, Ctrl+C stops both
├── frontend/
│   ├── src/
│   │   ├── store/         # useModelStore (Zustand)
│   │   ├── components/
│   │   │   ├── CadViewer.tsx       # Canvas + lighting + TrackballControls + FitCameraHelper + ViewHelper
│   │   │   ├── CadModel.tsx        # Imperative mesh: BufferGeometry, vertex colors, raycasting, drag detection
│   │   │   ├── CadEdges.tsx        # Wireframe from CAD topology edges
│   │   │   ├── OriginAxes.tsx      # XYZ axis marker with labels
│   │   │   ├── Toolbar.tsx         # Import, view controls, display toggles, clip planes, export
│   │   │   ├── RightPanel.tsx      # Tabbed: Features / Face List / Chat
│   │   │   ├── FeaturesPanel.tsx   # Selection info, create/delete features, measurements
│   │   │   ├── FaceListPanel.tsx   # Filterable/sortable face list
│   │   │   ├── MeasurementDisplay.tsx  # Auto-computed measurements from selected faces
│   │   │   ├── FeatureNameDialog.tsx   # Modal for naming features (snake_case)
│   │   │   └── ChatPanel.tsx       # WebSocket chat UI with thinking indicator
│   │   ├── hooks/         # useWebSocket (cad_command dispatch, auto-reconnect)
│   │   └── types/         # TypeScript interfaces (MeshData, FaceMetadata, Feature, CadCommandMessage, etc.)
│   └── ...
└── backend/
    ├── mcp_server.py      # MCP server for Claude Code (CadQuery, screenshots, view control)
    └── app/
        ├── routers/       # health.py, model.py, ws.py
        ├── services/      # cad_engine.py (full STEP processor), ai_agent.py (Claude agent with tool use)
        └── models/        # Pydantic models (WS messages, CadCommandMessage, CAD data models)
```

## Key Implementation Details

- **CadEngine** (`cad_engine.py`): Loads STEP files, parses ADVANCED_FACE entities, extracts face metadata (surface type, area, centroid, normals, cylinder radius/axis), tessellates via BRepMesh, discretizes topology edges, exports with named faces
- **CadModel** renders imperatively: BufferGeometry with per-vertex color buffer rebuilt on selection/hover/feature changes. Raycasting via R3F `onPointerMove`/`onClick` → `faceIndex` → `face_ids` mapping. Drag-vs-click detection via pointerDown position tracking (>5px movement = drag, ignored)
- **Measurements**: 1 cylinder → diameter/radius; 2 parallel planes → distance; 2 non-parallel planes → angle; 2 cylinders → center distance or axis angle; cylinder+plane → axis-to-plane distance
- **Features**: Auto sub-naming from surface type, 10-color palette, imports existing STEP names on load
- **Fit-to-extents**: Auto on import + Fit All toolbar button; computes bounding box from vertices, positions camera at 1.5x distance
- **View control**: ViewHelper component watches `viewRequest` in Zustand store; sets camera position from direction vector + bounding box, sets `camera.up` (critical for top/bottom), syncs TrackballControls target and up

## Environment Setup

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY=<your-api-key>  # from console.anthropic.com (sk-ant-api...)
# Optional: export CLAUDE_MODEL=claude-opus-4-6  (default: claude-sonnet-4-6)
uvicorn app.main:app --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Note: `--reload` on uvicorn can be slow due to OCP import overhead. Omit it for faster startup.

Or use the convenience script to start both at once:

```bash
./start.sh        # starts backend + frontend, Ctrl+C stops both
```

Open `http://localhost:5173` — Vite proxies `/api` and `/ws` to the backend.

## Verification

```bash
curl http://localhost:8000/api/health   # → {"status": "ok", ...}
```

Browser at localhost:5173 shows 3D viewport with toolbar and tabbed right panel (Features / Face List / Chat). Import a `.step` or `.stp` file to load and interact with a model.
