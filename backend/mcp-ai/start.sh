#!/usr/bin/env bash
set -e

echo "==> Installing dependencies..."
pip install --no-cache-dir -r requirements.txt

echo "==> Starting LangGraph Orchestrator..."
python langgraph_orchestrator.py
