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
- **Communication**: WebSocket at `/ws` for chat (agentic); HTTP REST for model data (`/api/upload`, `/api/faces`, `/api/export`)
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
| `/ws` | WS | Chat (agentic interaction — stub, ready for AI agent) |

### WebSocket Protocol

JSON messages with `type` field as discriminator:

| Type | Direction | Purpose |
|------|-----------|---------|
| `chat` | Both | User prompts and AI responses |
| `cad_update` | Server→Client | Mesh data, modifications |
| `drawing` | Both | Strokes, annotations |
| `system` | Server→Client | Connection status, errors |

## Project Structure

```
agent-cad/
├── frontend/
│   ├── src/
│   │   ├── store/         # useModelStore (Zustand)
│   │   ├── components/
│   │   │   ├── CadViewer.tsx       # Canvas + lighting + TrackballControls + fit-to-extents
│   │   │   ├── CadModel.tsx        # Imperative mesh: BufferGeometry, vertex colors, raycasting
│   │   │   ├── CadEdges.tsx        # Wireframe from CAD topology edges
│   │   │   ├── Toolbar.tsx         # Import, view controls, display toggles, clip planes, export
│   │   │   ├── RightPanel.tsx      # Tabbed: Features / Face List / Chat
│   │   │   ├── FeaturesPanel.tsx   # Selection info, create/delete features, measurements
│   │   │   ├── FaceListPanel.tsx   # Filterable/sortable face list
│   │   │   ├── MeasurementDisplay.tsx  # Auto-computed measurements from selected faces
│   │   │   ├── FeatureNameDialog.tsx   # Modal for naming features (snake_case)
│   │   │   └── ChatPanel.tsx       # WebSocket chat UI
│   │   ├── hooks/         # useWebSocket
│   │   └── types/         # TypeScript interfaces (MeshData, FaceMetadata, Feature, etc.)
│   └── ...
└── backend/
    └── app/
        ├── routers/       # health.py, model.py, ws.py
        ├── services/      # cad_engine.py (full STEP processor), ai_agent.py (stub)
        └── models/        # Pydantic models (WS messages + CAD data models)
```

## Key Implementation Details

- **CadEngine** (`cad_engine.py`): Loads STEP files, parses ADVANCED_FACE entities, extracts face metadata (surface type, area, centroid, normals, cylinder radius/axis), tessellates via BRepMesh, discretizes topology edges, exports with named faces
- **CadModel** renders imperatively: BufferGeometry with per-vertex color buffer rebuilt on selection/hover/feature changes. Raycasting via R3F `onPointerMove`/`onClick` → `faceIndex` → `face_ids` mapping
- **Measurements**: 1 cylinder → diameter/radius; 2 parallel planes → distance; 2 non-parallel planes → angle; 2 cylinders → center distance or axis angle; cylinder+plane → axis-to-plane distance
- **Features**: Auto sub-naming from surface type, 10-color palette, imports existing STEP names on load
- **Fit-to-extents**: Auto on import + Fit All toolbar button; computes bounding box from vertices, positions camera at 1.5x distance

## Agentic Status

The WebSocket chat and `ai_agent.py` service are **stubs** — ready for plugging in Anthropic SDK agent logic to interpret user prompts, manipulate the model, create features, etc. The Zustand store provides reactive state that an agent can drive programmatically.

## Environment Setup

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Note: `--reload` on uvicorn can be slow due to OCP import overhead. Omit it for faster startup.

Open `http://localhost:5173` — Vite proxies `/api` and `/ws` to the backend.

## Verification

```bash
curl http://localhost:8000/api/health   # → {"status": "ok", ...}
```

Browser at localhost:5173 shows 3D viewport with toolbar and tabbed right panel (Features / Face List / Chat). Import a `.step` or `.stp` file to load and interact with a model.
