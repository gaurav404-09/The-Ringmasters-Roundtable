#!/bin/bash
# start_mcp_agents.sh
# Launches the LangGraph orchestrator in a new Terminal window.
# This single process replaces the old 6-agent setup (map, weather,
# itinerary, events, budget, orchestrator) — everything now runs inside
# the LangGraph StateGraph pipeline.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$SCRIPT_DIR/backend/mcp-ai"
VENV_ACTIVATE="$MCP_DIR/venv/bin/activate"
ORCHESTRATOR="$MCP_DIR/langgraph_orchestrator.py"

if [ ! -d "$MCP_DIR" ]; then
  echo "Error: MCP directory not found at $MCP_DIR" >&2
  exit 1
fi

if [ ! -f "$VENV_ACTIVATE" ]; then
  echo "Error: Python virtualenv not found. Expected $VENV_ACTIVATE" >&2
  echo "Run: cd backend/mcp-ai && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt" >&2
  exit 1
fi

if [ ! -f "$ORCHESTRATOR" ]; then
  echo "Error: LangGraph orchestrator not found at $ORCHESTRATOR" >&2
  exit 1
fi

echo "Starting LangGraph orchestrator in a new Terminal window..."

osascript <<EOF
tell application "Terminal"
  activate
  do script "cd '$MCP_DIR'; source '$VENV_ACTIVATE'; python langgraph_orchestrator.py"
end tell
EOF

echo "LangGraph orchestrator launched. It handles all agents internally via the StateGraph pipeline."
echo "Monitor the Terminal window for live agent logs."
