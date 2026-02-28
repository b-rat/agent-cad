#!/usr/bin/env bash
# Start (or restart) the agent-cad frontend and backend.
# Usage: ./start.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Kill existing processes
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "npm run dev.*agent-cad" 2>/dev/null || true
# Give ports a moment to free
sleep 1

# Backend
cd "$ROOT/backend"
source .venv/bin/activate
uvicorn app.main:app --port 8000 &
BACKEND_PID=$!

# Frontend
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend  PID=$BACKEND_PID  http://localhost:8000"
echo "Frontend PID=$FRONTEND_PID http://localhost:5173"
echo "Press Ctrl+C to stop both."

# Trap Ctrl+C to kill both
trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT TERM
wait
