#!/usr/bin/env bash
set -e

echo "==> Python binary: $(which python)"
echo "==> Pip target: $(python -m pip --version)"
echo "==> Installing dependencies into runtime Python..."
python -m pip install --no-cache-dir pika langchain langchain-core langchain-groq langchain-community langchain-huggingface langchain-chroma langchain-text-splitters langgraph groq cohere chromadb sentence-transformers "mcp[cli]" python-dotenv requests

echo "==> Starting LangGraph Orchestrator..."
python langgraph_orchestrator.py
