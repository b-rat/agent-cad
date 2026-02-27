# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**agent-cad** — A harness for building CAD (Computer-Aided Design) with AI agents.

- **Language**: Python 3.12
- **License**: MIT (owner: b-rat / Brian Ratliff)
- **Remote**: `git@github.com:b-rat/agent-cad.git`

## Architecture

**Monorepo** with `frontend/` and `backend/` directories.

- **Frontend**: React + TypeScript + Vite + react-three-fiber (@react-three/fiber + @react-three/drei)
- **Backend**: FastAPI + uvicorn + CadQuery/OCP + Anthropic SDK
- **Communication**: WebSocket at `/ws` with JSON messages using a `type` discriminator field
- **CAD Engine**: CadQuery + OCP

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
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/  # CadViewer, ChatPanel, DrawingOverlay
│   │   ├── hooks/       # useWebSocket
│   │   └── types/       # Shared TypeScript interfaces
│   └── ...
└── backend/           # FastAPI + Python
    └── app/
        ├── routers/     # health.py, ws.py
        ├── services/    # cad_engine.py, ai_agent.py
        └── models/      # Pydantic message models
```

## Environment Setup

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` — Vite proxies `/api` and `/ws` to the backend.

## Verification

```bash
curl http://localhost:8000/api/health   # → {"status": "ok", ...}
```

Browser at localhost:5173 shows 3D viewport with blue box + grid + orbit controls, and a chat sidebar.
