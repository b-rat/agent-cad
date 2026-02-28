# agent-cad

Harness for building CAD with AI agents. React + R3F frontend, FastAPI + CadQuery backend, with an MCP server that lets Claude Code generate and visualize parametric geometry.

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

## MCP Server (Generative CAD)

The `.mcp.json` at project root registers a CadQuery MCP server with Claude Code. Any Claude Code session opened in this directory can generate geometry and push it to the running viewer.

Tools:
- `execute_cadquery(code)` — run CadQuery Python code, export STEP, display in viewer
- `get_model_info()` — query the loaded model's face metadata
- `query_faces(surface_type, min_area, max_area)` — filter faces by type/area

Requires the backend and frontend to be running.
