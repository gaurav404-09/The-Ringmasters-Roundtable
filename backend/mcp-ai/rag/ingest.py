"""
Self-populating RAG ingestion pipeline.

Instead of maintaining static markdown files for every destination,
this module dynamically generates comprehensive destination knowledge
using Cohere's API and caches it in ChromaDB.

Flow:
  1. User queries a city (e.g. "Jaipur")
  2. Check ChromaDB — if knowledge exists, skip (cache hit)
  3. If not, call Cohere to generate rich destination guide
  4. Chunk the generated text with RecursiveCharacterTextSplitter
  5. Embed and store in ChromaDB with metadata (city, category)
  6. Future queries for the same city are served from cache

This is a "self-populating knowledge base" pattern — the RAG store
grows automatically as users explore new destinations.
"""

import re
import cohere
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from config import (
    COHERE_API_KEY,
    RAG_CHUNK_SIZE,
    RAG_CHUNK_OVERLAP,
)
from rag.vector_store import get_vector_store, collection_has_city


_cohere_client: cohere.Client | None = None


def _get_cohere_client() -> cohere.Client:
    """Singleton Cohere client."""
    global _cohere_client
    if _cohere_client is None:
        if not COHERE_API_KEY:
            raise ValueError(
                "COHERE_API_KEY is not set. "
                "Get a free key at https://dashboard.cohere.com/api-keys"
            )
        _cohere_client = cohere.ClientV2(COHERE_API_KEY, timeout=15)
    return _cohere_client


DESTINATION_PROMPT = """Generate a comprehensive travel guide for {city}, India. 
Cover ALL of the following sections with rich, specific detail:

## Overview
Brief history, geography, why tourists visit, what makes it unique.

## Top Attractions
List 6-8 major attractions with:
- Name, description, historical significance
- Timings, entry fees (in ₹), recommended duration
- Best time to visit, insider tips

## Food & Cuisine
- 5-6 must-try local dishes with descriptions
- 5 specific restaurant recommendations with cuisine type, location area, and budget range (₹)
- Street food specialties and where to find them

## Cultural Experiences
- Local festivals and when they occur
- Art forms, music, dance traditions
- Workshops or classes available for tourists

## Shopping
- Famous markets and bazaars
- What to buy (specialties and souvenirs)
- Bargaining tips

## Accommodation Zones
- Different areas to stay with character description
- Budget ranges for each zone
- Which zone suits which type of traveler

## Travel Tips
- Best months to visit with temperature ranges
- Local transport options and costs
- Safety tips, dos and don'ts
- How to get there from major cities

Write in an informative but engaging tone. Include specific names, prices in ₹, 
and practical details a real traveler would need. Do NOT use placeholder text."""


def generate_destination_knowledge(city: str) -> str:
    """
    Call Cohere to generate a rich destination guide for a city.
    Returns the full text content.
    """
    client = _get_cohere_client()
    prompt = DESTINATION_PROMPT.format(city=city)

    response = client.chat(
        model="command-a-03-2025",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
    )

    # Extract and log token usage
    try:
        from observability.tracer import get_current_trace
        trace = get_current_trace()
        if trace and hasattr(response, "usage") and response.usage:
            input_tok = getattr(response.usage.tokens, "input_tokens", 0)
            output_tok = getattr(response.usage.tokens, "output_tokens", 0)
            trace.add_llm_tokens(
                model="command-a-03-2025",
                agent="itinerary",  # Group under itinerary since RAG ingest supports itinerary generation
                prompt=int(input_tok or 0),
                completion=int(output_tok or 0)
            )
    except Exception as trace_err:
        print(f"  [RAG Ingest] Tracer error: {trace_err}")

    # Extract text from response
    text = response.message.content[0].text
    return text


def _extract_category(text: str) -> str:
    """Infer the category of a chunk from its content/headers."""
    text_lower = text.lower()
    if any(kw in text_lower for kw in ["attraction", "fort", "temple", "palace", "monument", "museum"]):
        return "attractions"
    if any(kw in text_lower for kw in ["food", "cuisine", "restaurant", "dish", "eat", "street food"]):
        return "food"
    if any(kw in text_lower for kw in ["hotel", "accommodation", "stay", "hostel", "resort"]):
        return "accommodation"
    if any(kw in text_lower for kw in ["shop", "market", "bazaar", "buy", "souvenir"]):
        return "shopping"
    if any(kw in text_lower for kw in ["culture", "festival", "dance", "art", "music", "workshop"]):
        return "culture"
    if any(kw in text_lower for kw in ["tip", "transport", "weather", "best time", "safety", "how to get"]):
        return "travel_tips"
    return "general"


def _extract_season(text: str) -> str:
    """Infer the best season from chunk content."""
    text_lower = text.lower()
    if any(kw in text_lower for kw in ["october", "november", "december", "january", "february", "march", "winter"]):
        return "winter"
    if any(kw in text_lower for kw in ["april", "may", "june", "summer"]):
        return "summer"
    if any(kw in text_lower for kw in ["july", "august", "september", "monsoon", "rain"]):
        return "monsoon"
    return "all_seasons"


def chunk_and_embed(city: str, text: str) -> int:
    """
    Split destination text into chunks with metadata and store in ChromaDB.

    Returns the number of chunks stored.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=RAG_CHUNK_SIZE,
        chunk_overlap=RAG_CHUNK_OVERLAP,
        separators=["\n## ", "\n### ", "\n\n", "\n", ". ", " "],
    )

    raw_chunks = splitter.split_text(text)

    documents = []
    for i, chunk in enumerate(raw_chunks):
        metadata = {
            "city": city.lower(),
            "city_display": city.title(),
            "chunk_index": i,
            "category": _extract_category(chunk),
            "season": _extract_season(chunk),
            "source": "cohere_generated",
        }
        documents.append(Document(page_content=chunk, metadata=metadata))

    store = get_vector_store()
    store.add_documents(documents)

    return len(documents)


def ensure_city_knowledge(city: str) -> dict:
    """
    Main entry point: ensure destination knowledge exists in ChromaDB.

    If the city is already cached, returns immediately (cache hit).
    If not, generates knowledge via Cohere, chunks it, and stores it.

    Returns:
        dict with keys: city, status ("cache_hit" | "generated"), chunks_count
    """
    city_normalized = city.strip()

    if collection_has_city(city_normalized):
        return {
            "city": city_normalized,
            "status": "cache_hit",
            "chunks_count": 0,
        }

    print(f"  [RAG Ingest] Generating knowledge for '{city_normalized}' via Cohere...")
    text = generate_destination_knowledge(city_normalized)

    print(f"  [RAG Ingest] Chunking and embedding {len(text)} chars...")
    chunks_count = chunk_and_embed(city_normalized, text)

    print(f"  [RAG Ingest] Stored {chunks_count} chunks for '{city_normalized}'")
    return {
        "city": city_normalized,
        "status": "generated",
        "chunks_count": chunks_count,
    }


def ensure_cities_knowledge(cities: list[str]) -> list[dict]:
    """Batch-ensure knowledge for multiple cities."""
    results = []
    for city in cities:
        try:
            result = ensure_city_knowledge(city)
            results.append(result)
        except Exception as e:
            print(f"  [RAG Ingest] Error generating knowledge for '{city}': {e}")
            results.append({"city": city, "status": "error", "error": str(e)})
    return results
