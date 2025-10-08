#!/bin/bash
cd "$(dirname "$0")/mcp-ai"
source venv/bin/activate
python orchestrator_mcp.py
