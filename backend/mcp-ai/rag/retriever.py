"""
RAG retriever with metadata filtering and Cohere re-ranking.

Retrieval strategy:
  1. Dense retrieval via ChromaDB (semantic similarity on embeddings)
  2. Metadata filtering (narrow by city, category, season)
  3. Cohere Rerank to surface the most relevant chunks
  4. Return top-K context as a formatted string for the LLM

Why this design:
  - Dense retrieval finds semantically related content
  - Metadata filters prevent cross-city contamination
  - Cohere Rerank dramatically improves relevance (free tier supports it)
  - Formatted output is ready to inject into LLM prompts
"""

import cohere
from langchain_core.documents import Document

from config import COHERE_API_KEY, RAG_TOP_K
from rag.vector_store import get_vector_store
from rag.ingest import ensure_city_knowledge


_rerank_client: cohere.Client | None = None


def _get_rerank_client() -> cohere.Client | None:
    """Singleton Cohere client for re-ranking."""
    global _rerank_client
    if _rerank_client is None and COHERE_API_KEY:
        _rerank_client = cohere.ClientV2(COHERE_API_KEY, timeout=15)
    return _rerank_client


def retrieve_destination_context(
    city: str,
    query: str,
    category: str | None = None,
    top_k: int = RAG_TOP_K,
    use_rerank: bool = True,
) -> str:
    """
    Retrieve relevant destination knowledge for a city and query.

    Steps:
      1. Ensure city knowledge exists in ChromaDB (auto-populate if needed)
      2. Build metadata filter (city required, category optional)
      3. Similarity search to get candidate chunks
      4. Optionally re-rank with Cohere for better relevance
      5. Format and return as a single context string

    Args:
        city: The destination city name
        query: The user's query or intent (e.g. "best restaurants for couples")
        category: Optional filter — "attractions", "food", "accommodation", etc.
        top_k: Number of chunks to return
        use_rerank: Whether to apply Cohere re-ranking

    Returns:
        Formatted string of retrieved context, ready for LLM prompt injection
    """
    # Step 1: Auto-populate knowledge if needed
    ensure_city_knowledge(city)

    # Step 2: Build metadata filter
    where_filter = {"city": city.lower()}
    if category:
        where_filter = {"$and": [{"city": city.lower()}, {"category": category}]}

    # Step 3: Dense retrieval — fetch more candidates for re-ranking
    store = get_vector_store()
    fetch_k = top_k * 3 if use_rerank else top_k
    
    try:
        results: list[Document] = store.similarity_search(
            query=query,
            k=fetch_k,
            filter=where_filter,
        )
    except Exception as e:
        print(f"  [RAG Retriever] Error in similarity search: {e}")
        # Fallback: try without category filter
        try:
            results = store.similarity_search(
                query=query,
                k=fetch_k,
                filter={"city": city.lower()},
            )
        except Exception:
            return f"No cached knowledge available for {city}."

    if not results:
        return f"No relevant information found for {city}."

    # Step 4: Cohere Re-ranking (dramatically improves relevance)
    if use_rerank and len(results) > 1:
        reranked = _rerank_documents(query, results, top_k)
        if reranked:
            results = reranked

    # Step 5: Format output
    return _format_context(city, results[:top_k])


def _rerank_documents(
    query: str, documents: list[Document], top_n: int
) -> list[Document] | None:
    """
    Re-rank documents using Cohere's Rerank API.
    Returns re-ordered documents or None if re-ranking fails.
    """
    client = _get_rerank_client()
    if not client:
        return None

    try:
        doc_texts = [doc.page_content for doc in documents]
        response = client.rerank(
            model="rerank-v3.5",
            query=query,
            documents=doc_texts,
            top_n=min(top_n, len(documents)),
        )

        # Log Cohere rerank search unit to active trace
        try:
            from observability.tracer import get_current_trace
            trace = get_current_trace()
            if trace:
                trace.record_search_unit(model="rerank-v3.5", agent="itinerary")
        except Exception as trace_err:
            print(f"  [RAG Retriever] Tracer error: {trace_err}")

        reranked = []
        for result in response.results:
            reranked.append(documents[result.index])
        return reranked

    except Exception as e:
        print(f"  [RAG Retriever] Rerank failed (falling back to dense): {e}")
        return None


def _format_context(city: str, documents: list[Document]) -> str:
    """Format retrieved documents into a clean context string for LLM injection."""
    if not documents:
        return f"No relevant information found for {city}."

    sections = []
    sections.append(f"=== Destination Knowledge: {city.title()} ===\n")

    for i, doc in enumerate(documents, 1):
        category = doc.metadata.get("category", "general")
        sections.append(f"[Source {i} | Category: {category}]")
        sections.append(doc.page_content.strip())
        sections.append("")  # blank line between chunks

    return "\n".join(sections)


def retrieve_multi_city_context(
    cities: list[str], query: str, top_k_per_city: int = 3
) -> dict[str, str]:
    """
    Retrieve context for multiple cities (used by Crystal Ball comparison).

    Returns:
        Dict mapping city name → context string
    """
    contexts = {}
    for city in cities:
        contexts[city] = retrieve_destination_context(
            city=city, query=query, top_k=top_k_per_city
        )
    return contexts
