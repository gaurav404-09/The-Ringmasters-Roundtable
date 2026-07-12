"""
Unit tests for the Supervisor agent.

Tests the two most interview-critical components:
  1. _parse_supervisor_response  — JSON parsing robustness
  2. _fallback_routing           — deterministic dependency-chain routing

No LLM calls are made; all tests are pure logic.
"""
import sys
import os
import pytest

# Ensure the mcp-ai directory is importable without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# _parse_supervisor_response
# ---------------------------------------------------------------------------

class TestParseSupervisorResponse:
    """Tests for the JSON response parser in the Supervisor node."""

    def setup_method(self):
        from agents.supervisor import _parse_supervisor_response
        self.parse = _parse_supervisor_response

    def test_parses_valid_json(self):
        raw = '{"next": "map", "reasoning": "Route is first dependency"}'
        result = self.parse(raw)
        assert result["next"] == "map"
        assert "reasoning" in result

    def test_parses_json_in_markdown_fence(self):
        """LLMs often wrap JSON in ```json ... ``` blocks."""
        raw = '```json\n{"next": "weather", "reasoning": "Map done"}\n```'
        result = self.parse(raw)
        assert result["next"] == "weather"

    def test_parses_json_in_plain_fence(self):
        raw = '``` {"next": "itinerary", "reasoning": "Weather done"} ```'
        result = self.parse(raw)
        assert result["next"] == "itinerary"

    def test_extracts_json_from_surrounding_text(self):
        """Supervisor might add prose before or after the JSON."""
        raw = 'The next step should be: {"next": "events", "reasoning": "Itinerary done"} as I mentioned.'
        result = self.parse(raw)
        assert result["next"] == "events"

    def test_returns_finish_on_completely_malformed_input(self):
        raw = "I cannot decide what to do next."
        result = self.parse(raw)
        assert result["next"] == "FINISH"

    def test_returns_finish_on_empty_string(self):
        result = self.parse("")
        assert result["next"] == "FINISH"

    def test_returns_finish_when_json_missing_next_key(self):
        """
        When the LLM returns valid JSON but without a 'next' key,
        the parser returns the dict as-is. The caller then calls
        result.get('next', 'FINISH') to apply the default.
        This test verifies the parser does NOT raise and the caller's
        .get() idiom works correctly.
        """
        raw = '{"decision": "map", "step": 1}'
        result = self.parse(raw)
        # The parser returns what it finds; caller must use .get('next', 'FINISH')
        effective_next = result.get('next', 'FINISH')
        assert effective_next == 'FINISH'


# ---------------------------------------------------------------------------
# _fallback_routing
# ---------------------------------------------------------------------------

class TestFallbackRouting:
    """Tests for the deterministic fallback routing logic."""

    def setup_method(self):
        from agents.supervisor import _fallback_routing
        self.route = _fallback_routing

    def _call(self, completed, transport_mode="train_flight", needs_revision=False):
        state = {"revision_count": 0, "critique": ""}
        return self.route(state, completed, transport_mode, needs_revision)

    def test_routes_to_map_when_nothing_done(self):
        result = self._call(completed=[])
        assert result["next_agent"] == "map"

    def test_routes_to_weather_after_map(self):
        result = self._call(completed=["map"])
        assert result["next_agent"] == "weather"

    def test_routes_to_itinerary_after_weather(self):
        result = self._call(completed=["map", "weather"])
        assert result["next_agent"] == "itinerary"

    def test_routes_to_events_after_itinerary(self):
        result = self._call(completed=["map", "weather", "itinerary"])
        assert result["next_agent"] == "events"

    def test_routes_to_budget_after_events_for_train_flight(self):
        result = self._call(
            completed=["map", "weather", "itinerary", "events"],
            transport_mode="train_flight"
        )
        assert result["next_agent"] == "budget"

    def test_skips_budget_for_driving_mode(self):
        """Driving mode should skip budget and go to critic (or FINISH)."""
        result = self._call(
            completed=["map", "weather", "itinerary", "events"],
            transport_mode="driving"
        )
        # Budget should be skipped — expect critic or FINISH, never budget
        assert result["next_agent"] != "budget"

    def test_routes_to_itinerary_when_revision_needed(self):
        """If critic requested revision, should route back to itinerary."""
        result = self._call(
            completed=["map", "weather", "itinerary", "events", "budget", "critic"],
            needs_revision=True
        )
        assert result["next_agent"] == "itinerary"

    def test_routes_to_finish_when_all_done(self):
        """All agents done with no revision needed → FINISH."""
        result = self._call(
            completed=["map", "weather", "itinerary", "events", "budget", "critic"],
            needs_revision=False
        )
        assert result["next_agent"] == "FINISH"

    def test_status_messages_always_returned(self):
        """The fallback must always return a status_messages list."""
        result = self._call(completed=[])
        assert "status_messages" in result
        assert isinstance(result["status_messages"], list)
        assert len(result["status_messages"]) > 0

    def test_next_agent_key_always_present(self):
        """next_agent must always be in the result dict."""
        for completed in [[], ["map"], ["map", "weather"]]:
            result = self._call(completed=completed)
            assert "next_agent" in result
