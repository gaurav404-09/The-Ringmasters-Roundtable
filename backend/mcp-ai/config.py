"""
Centralized configuration for the AI travel planning system.
All API keys, model settings, and feature flags in one place.
Never hardcode secrets — everything comes from environment variables.
"""

import os
from dotenv import load_dotenv

load_dotenv()


# ─── LLM Configuration ───────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")
GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "llama-3.1-8b-instant")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.3"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "4096"))

# ─── External API Keys ───────────────────────────────────────────────
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
ORS_API_KEY = os.getenv("ORS_API_KEY", "")
COHERE_API_KEY = os.getenv("COHERE_API_KEY", "")
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "")
AMADEUS_CLIENT_ID = os.getenv("AMADEUS_CLIENT_ID", "")
AMADEUS_CLIENT_SECRET = os.getenv("AMADEUS_CLIENT_SECRET", "")

# ─── RAG Configuration ───────────────────────────────────────────────
CHROMA_PERSIST_DIR = os.getenv(
    "CHROMA_PERSIST_DIR",
    os.path.join(os.path.dirname(__file__), "data", "chromadb"),
)
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "destinations")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
RAG_CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "1000"))
RAG_CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "200"))
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "5"))

# ─── LangGraph Configuration ─────────────────────────────────────────
MAX_REVISION_LOOPS = int(os.getenv("MAX_REVISION_LOOPS", "2"))
ENABLE_CRITIC = os.getenv("ENABLE_CRITIC", "true").lower() == "true"

# ─── MCP Server Configuration ────────────────────────────────────────
MCP_SERVER_NAME = "ringmaster-travel-planner"
MCP_SERVER_VERSION = "1.0.0"

# ─── RabbitMQ Configuration ──────────────────────────────────────────
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))

# ─── Observability Configuration ─────────────────────────────────────
ENABLE_TRACING = os.getenv("ENABLE_TRACING", "true").lower() == "true"
TRACE_LOG_DIR = os.getenv(
    "TRACE_LOG_DIR",
    os.path.join(os.path.dirname(__file__), "logs", "traces"),
)
LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY", "")
LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT", "ringmaster-travel")

# ─── Destination Data Path ────────────────────────────────────────────
DESTINATIONS_DATA_DIR = os.path.join(
    os.path.dirname(__file__), "data", "destinations"
)
