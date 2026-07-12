"""
Shared test fixtures and configuration.

All external dependencies (Groq LLM, ChromaDB, Cohere) are mocked here
so that tests run without any API keys or network access.
"""
import pytest
from unittest.mock import MagicMock, patch
from langchain_core.documents import Document


# ---------------------------------------------------------------------------
# Minimal TripState fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def minimal_state():
    """A minimal valid TripState dictionary for unit tests."""
    return {
        "trip_id": "test-trip-001",
        "client_sid": "test-socket-123",
        "start_city": "Delhi",
        "end_city": "Goa",
        "num_days": 3,
        "start_date": "2026-07-01",
        "end_date": "2026-07-03",
        "transport_mode": "train_flight",
        "adults": 2,
        "user_preferences": "foodie, beaches",
        "route": [],
        "weather_data": [],
        "route_with_weather": [],
        "itinerary": [],
        "events": {},
        "budget": None,
        "retrieved_context": "",
        "next_agent": "",
        "completed_agents": [],
        "status": "pending",
        "status_messages": [],
        "critique": "",
        "revision_count": 0,
        "error": None,
        "trace_id": "trace-001",
        "token_usage": {},
    }


@pytest.fixture
def route_with_weather():
    """Sample route_with_weather list used across itinerary and critic tests."""
    return [
        {
            "city": "Delhi",
            "coord": "28.6139,77.2090",
            "weather": {"temp": 35, "weather": "Sunny"},
        },
        {
            "city": "Goa",
            "coord": "15.2993,74.1240",
            "weather": {"temp": 28, "weather": "Partly cloudy"},
        },
    ]


@pytest.fixture
def sample_itinerary():
    """A minimal 2-day itinerary fixture."""
    return [
        {
            "day": 1,
            "city": "Goa",
            "title": "Day 1: Arrival & Beaches",
            "activities": [
                {"id": 1, "time": "09:00", "title": "Check-in at hotel", "type": "hotel",
                 "notes": "Early check-in recommended", "duration": "1h", "price": "₹5000/night",
                 "includes": ["Room keys"], "status": "confirmed"},
                {"id": 2, "time": "11:00", "title": "Calangute Beach", "type": "sightseeing",
                 "notes": "Most popular beach in North Goa", "duration": "3h", "price": "Free",
                 "includes": [], "status": "recommended"},
                {"id": 3, "time": "13:00", "title": "Lunch at Fisherman's Wharf", "type": "meal",
                 "notes": "Famous for seafood", "duration": "1h 30m", "price": "₹800-1200",
                 "includes": [], "status": "recommended"},
                {"id": 4, "time": "19:00", "title": "Dinner at Britto's", "type": "meal",
                 "notes": "Beachside restaurant on Baga", "duration": "2h", "price": "₹1000-1500",
                 "includes": [], "status": "confirmed"},
            ],
        },
        {
            "day": 2,
            "city": "Goa",
            "title": "Day 2: Culture & Spice",
            "activities": [
                {"id": 1, "time": "08:00", "title": "Breakfast at hotel", "type": "meal",
                 "notes": "Complimentary breakfast included", "duration": "1h", "price": "Included",
                 "includes": [], "status": "confirmed"},
                {"id": 2, "time": "10:00", "title": "Old Goa Churches", "type": "sightseeing",
                 "notes": "UNESCO World Heritage Site", "duration": "2h", "price": "Free",
                 "includes": [], "status": "confirmed"},
                {"id": 3, "time": "13:00", "title": "Lunch at Vinayak", "type": "meal",
                 "notes": "Authentic Goan cuisine", "duration": "1h", "price": "₹500-800",
                 "includes": [], "status": "recommended"},
                {"id": 4, "time": "19:00", "title": "Dinner at A Reverie", "type": "meal",
                 "notes": "Continental fine dining", "duration": "2h", "price": "₹2000+",
                 "includes": [], "status": "optional"},
            ],
        },
    ]


@pytest.fixture
def mock_chroma_store():
    """Mock ChromaDB vector store."""
    store = MagicMock()
    store.similarity_search.return_value = [
        Document(
            page_content="Calangute is the most popular beach in North Goa.",
            metadata={"city": "goa", "category": "attractions", "chunk_index": 0},
        ),
        Document(
            page_content="Fisherman's Wharf is famous for authentic Goan seafood.",
            metadata={"city": "goa", "category": "food", "chunk_index": 1},
        ),
    ]
    return store


@pytest.fixture
def mock_groq_response():
    """Mock LangChain ChatGroq response."""
    response = MagicMock()
    response.content = '{"next": "map", "reasoning": "Need route first"}'
    response.response_metadata = {
        "token_usage": {"prompt_tokens": 100, "completion_tokens": 20}
    }
    return response
