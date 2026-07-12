"""
Unit tests for TripState schema and LangGraph reducer behavior.

Tests:
  1. TripState accepts all expected keys (no KeyError on valid data)
  2. Annotated[list, operator.add] reducers accumulate across updates
     (this is the LangGraph state merge semantics we rely on)
  3. TripState is total=False (partial state dicts are valid)

These tests are purely in-memory — no LLM, no network, no disk access.
"""
import sys
import os
import operator
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# TripState structure
# ---------------------------------------------------------------------------

class TestTripStateSchema:
    """Tests that TripState accepts valid keys and has the expected shape."""

    def test_accepts_full_state(self, minimal_state):
        """A fully populated state dict should not raise any errors."""
        from state import TripState
        # TypedDict doesn't enforce at runtime, but we can verify key coverage
        expected_keys = {
            "trip_id", "client_sid", "start_city", "end_city", "num_days",
            "start_date", "end_date", "transport_mode", "adults", "user_preferences",
            "route", "weather_data", "route_with_weather", "itinerary", "events",
            "budget", "retrieved_context", "next_agent", "completed_agents", "status",
            "status_messages", "critique", "revision_count", "error", "trace_id",
            "token_usage",
        }
        assert expected_keys.issubset(minimal_state.keys()), (
            f"Missing keys in minimal_state: {expected_keys - minimal_state.keys()}"
        )

    def test_partial_state_is_valid(self):
        """TripState uses total=False, so partial dicts are valid."""
        from state import TripState
        # A subset of keys must be usable without errors
        partial: TripState = {"start_city": "Delhi", "end_city": "Goa"}
        assert partial["start_city"] == "Delhi"
        assert partial["end_city"] == "Goa"

    def test_transport_mode_valid_values(self):
        """transport_mode must be one of the two accepted string literals."""
        valid_modes = {"driving", "train_flight"}
        for mode in valid_modes:
            state = {"transport_mode": mode}
            assert state["transport_mode"] in valid_modes

    def test_revision_count_defaults_to_zero_in_fixture(self, minimal_state):
        assert minimal_state["revision_count"] == 0

    def test_completed_agents_defaults_to_empty_list(self, minimal_state):
        assert isinstance(minimal_state["completed_agents"], list)
        assert len(minimal_state["completed_agents"]) == 0


# ---------------------------------------------------------------------------
# LangGraph reducer semantics (Annotated[list, operator.add])
# ---------------------------------------------------------------------------

class TestLangGraphReducers:
    """
    Tests the accumulator (add) reducer pattern used for status_messages
    and completed_agents in TripState.

    In LangGraph, when a node returns {"completed_agents": ["map"]},
    the framework calls operator.add on the existing list and the returned list.
    This simulates that exact behavior.
    """

    def _simulate_merge(self, existing: list, update: list) -> list:
        """Simulate LangGraph's state merge for Annotated[list, operator.add] fields."""
        return operator.add(existing, update)

    def test_completed_agents_accumulates(self):
        """Simulates 3 agents completing in sequence."""
        state_completed = []
        state_completed = self._simulate_merge(state_completed, ["map"])
        state_completed = self._simulate_merge(state_completed, ["weather"])
        state_completed = self._simulate_merge(state_completed, ["itinerary"])
        assert state_completed == ["map", "weather", "itinerary"]

    def test_status_messages_accumulates(self):
        """Status messages from multiple agents should stack."""
        messages = []
        messages = self._simulate_merge(messages, ["🗺️ Map Agent: Calculating route..."])
        messages = self._simulate_merge(messages, ["✅ Route calculated: 2 stops"])
        messages = self._simulate_merge(messages, ["⛅ Weather Agent: Fetching forecasts..."])
        assert len(messages) == 3
        assert messages[0].startswith("🗺️")
        assert messages[2].startswith("⛅")

    def test_adding_empty_list_is_idempotent(self):
        """Merging with an empty list should not change the existing list."""
        existing = ["map", "weather"]
        result = self._simulate_merge(existing, [])
        assert result == ["map", "weather"]

    def test_order_is_preserved_across_merges(self):
        """The order of accumulated messages reflects the order of agent execution."""
        agents = []
        for agent in ["map", "weather", "itinerary", "events", "budget", "critic"]:
            agents = self._simulate_merge(agents, [agent])
        assert agents == ["map", "weather", "itinerary", "events", "budget", "critic"]

    def test_duplicate_entries_are_not_deduplicated(self):
        """
        operator.add does NOT deduplicate. This is intentional —
        the supervisor controls routing, not the reducer.
        """
        messages = ["map"]
        messages = self._simulate_merge(messages, ["map"])
        assert messages.count("map") == 2
