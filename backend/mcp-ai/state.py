"""
LangGraph state schema for the travel planning pipeline.

The TripState is a TypedDict that flows through every node in the graph.
Each node reads from and writes to this shared state, enabling data to
flow between agents without tight coupling.

Design decisions:
- Using Annotated with `operator.add` for list fields that accumulate
  across nodes (status_messages, completed_agents).
- Keeping both raw inputs (start_city, end_city) and derived data
  (route, weather, itinerary) in the same state for simplicity.
- revision_count + MAX_REVISION_LOOPS prevents infinite critic loops.
"""

from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict


class TripState(TypedDict, total=False):
    """Shared state that flows through the LangGraph travel planning pipeline."""

    # ── Trip identity ────────────────────────────────────────────────
    trip_id: str
    client_sid: str  # Socket.IO session for real-time updates

    # ── User inputs ──────────────────────────────────────────────────
    start_city: str
    end_city: str
    num_days: int
    start_date: str   # ISO 8601  e.g. "2026-07-01"
    end_date: str     # ISO 8601  e.g. "2026-07-04"
    transport_mode: str  # "driving" | "train_flight"
    adults: int
    user_preferences: str  # Free-text user preferences (e.g. "foodie couple, budget ₹30k")

    # ── Intermediate agent results ───────────────────────────────────
    route: list[dict[str, Any]]             # From Map Agent
    weather_data: list[dict[str, Any]]      # From Weather Agent
    route_with_weather: list[dict[str, Any]]  # Merged route + weather
    itinerary: list[dict[str, Any]]         # From Itinerary Agent (RAG+LLM)
    events: dict[str, Any]                  # From Event Agent
    budget: dict[str, Any] | None           # From Budget Agent

    # ── RAG context ──────────────────────────────────────────────────
    retrieved_context: str  # Relevant destination knowledge from ChromaDB

    # ── Control flow ─────────────────────────────────────────────────
    next_agent: str  # Supervisor's decision on what runs next
    completed_agents: Annotated[list[str], operator.add]  # Accumulates
    status: str  # "pending" | "in_progress" | "completed" | "error"

    # ── Status updates (sent to frontend via RabbitMQ) ───────────────
    status_messages: Annotated[list[str], operator.add]  # Accumulates

    # ── Critic / reflection ──────────────────────────────────────────
    critique: str
    revision_count: int

    # ── Error handling ───────────────────────────────────────────────
    error: str | None

    # ── Observability ────────────────────────────────────────────────
    trace_id: str
    token_usage: dict[str, int]  # {"prompt_tokens": N, "completion_tokens": M}
