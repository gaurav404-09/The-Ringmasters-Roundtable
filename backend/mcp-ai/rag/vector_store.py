"""
ChromaDB vector store wrapper for the RAG pipeline.

Design decisions:
- ChromaDB chosen over FAISS because it supports metadata filtering
  (filter by city, category, season) which is critical for travel context.
- Persistent storage so embeddings survive restarts.
- Uses sentence-transformers (all-MiniLM-L6-v2) for free, local embeddings.
"""

import chromadb
from chromadb.config import Settings
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

from typing import Any

from config import CHROMA_PERSIST_DIR, CHROMA_COLLECTION_NAME, EMBEDDING_MODEL


_embedding_fn: HuggingFaceEmbeddings | None = None
_chroma_client: Any = None


def get_embedding_function() -> HuggingFaceEmbeddings:
    """Singleton embedding model — loaded once, reused across calls."""
    global _embedding_fn
    if _embedding_fn is None:
        _embedding_fn = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embedding_fn


def get_chroma_client() -> Any:
    """Singleton ChromaDB persistent client."""
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=CHROMA_PERSIST_DIR,
            settings=Settings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_vector_store() -> Chroma:
    """
    Returns a LangChain-compatible Chroma vector store.

    This is the main interface used by the retriever.  Wraps the raw
    ChromaDB client so LangChain chains can call `.similarity_search()`
    or `.as_retriever()` directly.
    """
    return Chroma(
        client=get_chroma_client(),
        collection_name=CHROMA_COLLECTION_NAME,
        embedding_function=get_embedding_function(),
    )


def collection_has_city(city: str) -> bool:
    """Check if we already have knowledge for a given city in the store."""
    store = get_vector_store()
    results = store.get(where={"city": city.lower()}, limit=1)
    return len(results.get("ids", [])) > 0


def get_collection_stats() -> dict:
    """Return basic stats about the vector store (for observability)."""
    client = get_chroma_client()
    try:
        collection = client.get_collection(CHROMA_COLLECTION_NAME)
        count = collection.count()
        return {"collection": CHROMA_COLLECTION_NAME, "document_count": count}
    except Exception:
        return {"collection": CHROMA_COLLECTION_NAME, "document_count": 0}
