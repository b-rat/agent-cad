# Architecture Overview

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| 3D Rendering | react-three-fiber (@react-three/fiber + @react-three/drei) |
| State | Zustand (`useModelStore`) |
| Backend | FastAPI + uvicorn |
| CAD Kernel | CadQuery / OCP (OpenCascade) |
| AI Agent | Anthropic SDK (Claude with tool use) |
| Communication | REST (model data) + WebSocket (chat) |

## Data Flow

### STEP Import Pipeline

```
STEP file
  → POST /api/upload
  → CadEngine.load_step()
  → OCP parses B-rep (ADVANCED_FACE entities)
  → Face metadata extracted (surface type, area, centroid, normals, radius, axis)
  → BRepMesh tessellates → triangle mesh (vertices, normals, face_ids per triangle)
  → Topology edges discretized → wireframe line segments
  → JSON response to frontend
  → CadModel.tsx builds BufferGeometry imperatively
  → Vertex color buffer for selection/hover/feature coloring
```

### Raycasting & Selection

```
User click in viewport
  → R3F onPointerMove/onClick
  → Intersection → faceIndex
  → face_ids mapping (triangle index → CAD face ID)
  → Zustand store: selectFace(id)
  → Vertex color buffer rebuilt → visual highlight
```

### AI Agent Loop

```
ChatPanel → useWebSocket → WebSocket → ws.py → AIAgent → Anthropic API (Claude)
                                         ↑ send_command()        ↓ tool calls
                                         ↓ cad_command msgs      ↓
                                    useWebSocket.onmessage → handleCadCommand → Zustand → viewport
```

Each WebSocket connection gets its own `AIAgent` instance with fresh conversation history. The `CadEngine` singleton is shared across REST and WebSocket — same model data everywhere.

## Backend

### CadEngine (`backend/app/services/cad_engine.py`)

The core processing layer, wrapping CadQuery/OCP:

- **Load**: Parses STEP files, extracts `TopoDS_Shape` and individual `TopoDS_Face` objects
- **Metadata**: For each face — surface type (planar, cylindrical, conical, spherical, toroidal, bspline), area, centroid, normal vectors, cylinder radius/axis where applicable
- **Tessellate**: Converts B-rep faces to triangle meshes via `BRepMesh_IncrementalMesh`
- **Edge Discretization**: Extracts topology edges for wireframe rendering
- **Export**: Writes STEP files back out with named faces (features)

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/upload` | POST | Upload STEP file, returns mesh + face metadata |
| `/api/faces` | GET | All face metadata |
| `/api/face/{id}` | GET | Single face metadata |
| `/api/features` | GET/POST | Get/save feature definitions |
| `/api/export` | POST | Export named STEP file download |
| `/ws` | WS | Chat (Claude-powered AI agent) |

### AI Agent (`backend/app/services/ai_agent.py`)

Implements the agentic tool-use loop:

1. Receives user message, appends to conversation history
2. Calls Claude with system prompt + tools + history
3. If response contains `tool_use` blocks, executes each tool
4. Appends tool results to history, calls Claude again
5. Repeats until `stop_reason == "end_turn"`
6. Returns final text response

**Available Tools:**

| Tool | Type | Purpose |
|------|------|---------|
| `get_model_info` | Read-only | Filename, face count, length unit, features |
| `query_faces` | Read-only | Filter faces by surface type, area range, IDs |
| `select_faces` | Viewport | Highlight faces by ID |
| `clear_selection` | Viewport | Clear all selections |
| `create_feature` | Mutating | Group selected faces into a named feature |
| `delete_feature` | Mutating | Remove a feature |
| `set_display` | Viewport | Toggle xray, wireframe, colors, clip planes, fit-all |

Read-only tools query `CadEngine` directly. Viewport/mutating tools send `cad_command` messages over the WebSocket to the frontend.

### WebSocket Protocol

JSON messages with `type` field as discriminator:

| Type | Direction | Purpose |
|------|-----------|---------|
| `chat` | Both | User prompts and AI responses |
| `cad_command` | Server→Client | Agent tool actions (select, feature, display) |
| `cad_update` | Server→Client | Mesh data, modifications |
| `drawing` | Both | Strokes, annotations |
| `system` | Server→Client | Connection status, errors |

## Frontend

### Key Components

| Component | Responsibility |
|-----------|---------------|
| `CadViewer.tsx` | Canvas + lighting + TrackballControls + fit-to-extents |
| `CadModel.tsx` | Imperative BufferGeometry, vertex colors, raycasting |
| `CadEdges.tsx` | Wireframe from CAD topology edges |
| `Toolbar.tsx` | Import, view controls, display toggles, clip planes, export |
| `RightPanel.tsx` | Tabbed panel: Features / Face List / Chat |
| `FeaturesPanel.tsx` | Selection info, create/delete features, measurements |
| `FaceListPanel.tsx` | Filterable/sortable face list |
| `MeasurementDisplay.tsx` | Auto-computed measurements from selected faces |
| `ChatPanel.tsx` | WebSocket chat UI with thinking indicator |

### Zustand Store (`useModelStore`)

Single source of truth for all model state:

- **Mesh data**: vertices, normals, face_ids, edges
- **Face metadata**: surface type, area, centroid, etc.
- **Selection**: set of selected face IDs, hover face ID
- **Features**: named groups of faces with auto sub-naming and color palette
- **Display**: xray, wireframe, colors, clip plane settings

The WebSocket hook (`useWebSocket.ts`) dispatches `cad_command` messages directly to the store via `useModelStore.getState()`, keeping the agent's viewport mutations in sync with the UI.

### Measurements

Automatically computed from selected faces:

- 1 cylinder → diameter/radius
- 2 parallel planes → distance between
- 2 non-parallel planes → angle
- 2 cylinders → center distance or axis angle
- Cylinder + plane → axis-to-plane distance

## Current Capabilities

The system is a **read-analyze-annotate-export** pipeline:

1. **Import** STEP files
2. **Visualize** in 3D with face-level interaction
3. **Inspect** face metadata (surface type, area, geometry)
4. **Select** faces via click or AI agent
5. **Group** faces into named features
6. **Measure** geometric relationships
7. **Export** STEP files with feature names embedded
8. **Chat** with an AI agent that can query and manipulate all of the above

## Limitations for Generative CAD

The current implementation does not create or modify geometry:

- **No parametric modeling API exposed** — CadQuery can build geometry (`cq.Workplane("XY").box(10,10,10)`), but the engine only uses it for STEP import and analysis
- **No geometry update pipeline** — after the initial upload, there's no mechanism to push new/modified geometry to the frontend
- **No agent construction tools** — all 7 tools are read/annotate/display; none invoke CadQuery's modeling functions
- **No undo/history** — parametric CAD needs an operation stack for iteration

### Foundations Available for Extension

- **CadQuery is already imported** — full parametric kernel (OCCT) capable of primitives, booleans, fillets, chamfers, extrusions, sweeps, lofts
- **Tessellation pipeline exists** — `CadEngine` already converts `TopoDS_Shape` → triangle mesh + metadata; new shapes just need the same treatment
- **WebSocket command channel** — `cad_command` already mutates the frontend; a `load_mesh` or `update_model` action could push new geometry
- **Zustand store** — adding a `setMeshData()` action to receive new geometry is straightforward
