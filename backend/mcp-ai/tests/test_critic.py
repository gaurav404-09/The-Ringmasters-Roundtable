"""
Unit tests for the Critic agent.

Tests:
  1. _parse_critic_response    — JSON parsing for APPROVE/REVISE verdicts
  2. _summarize_itinerary      — itinerary summarization for critic prompt
  3. Auto-approve at max revision loops (no LLM call needed)

No LLM calls are made.
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# _parse_critic_response
# ---------------------------------------------------------------------------

class TestParseCriticResponse:
    """Tests for the critic response JSON parser."""

    def setup_method(self):
        from agents.critic import _parse_critic_response
        self.parse = _parse_critic_response

    def test_parses_approve_verdict(self):
        raw = '{"verdict": "APPROVE", "score": 8, "feedback": "Good plan", "issues": []}'
        result = self.parse(raw)
        assert result["verdict"] == "APPROVE"
        assert result["score"] == 8

    def test_parses_revise_verdict(self):
        raw = '{"verdict": "REVISE", "score": 4, "feedback": "Missing meals", "issues": ["No lunch on Day 2"]}'
        result = self.parse(raw)
        assert result["verdict"] == "REVISE"
        assert "No lunch on Day 2" in result["issues"]

    def test_parses_json_in_markdown_fence(self):
        raw = '```json\n{"verdict": "APPROVE", "score": 9, "feedback": "Excellent", "issues": []}\n```'
        result = self.parse(raw)
        assert result["verdict"] == "APPROVE"
        assert result["score"] == 9

    def test_returns_default_approve_on_malformed_json(self):
        """Critic should never crash — default to APPROVE if parsing fails."""
        raw = "This plan looks great to me!"
        result = self.parse(raw)
        assert result["verdict"] == "APPROVE"
        assert "score" in result

    def test_returns_default_approve_on_empty_string(self):
        result = self.parse("")
        assert result["verdict"] == "APPROVE"

    def test_handles_extra_whitespace_and_newlines(self):
        raw = '\n\n  {"verdict": "APPROVE", "score": 7, "feedback": "Ok", "issues": []}  \n\n'
        result = self.parse(raw)
        assert result["verdict"] == "APPROVE"

    def test_score_is_numeric(self):
        raw = '{"verdict": "REVISE", "score": 3, "feedback": "Too few activities", "issues": ["Day 1 only 2 activities"]}'
        result = self.parse(raw)
        assert isinstance(result["score"], (int, float))


# ---------------------------------------------------------------------------
# _summarize_itinerary
# ---------------------------------------------------------------------------

class TestSummarizeItinerary:
    """Tests for the itinerary summarization helper used in critic prompts."""

    def setup_method(self):
        from agents.critic import _summarize_itinerary
        self.summarize = _summarize_itinerary

    def test_produces_one_line_per_day(self, sample_itinerary):
        summary = self.summarize(sample_itinerary)
        lines = [l for l in summary.strip().split("\n") if l]
        assert len(lines) == len(sample_itinerary)

    def test_includes_city_name(self, sample_itinerary):
        summary = self.summarize(sample_itinerary)
        assert "Goa" in summary

    def test_includes_activity_count(self, sample_itinerary):
        summary = self.summarize(sample_itinerary)
        # Day 1 has 4 activities
        assert "4 activities" in summary

    def test_returns_no_itinerary_data_on_empty(self):
        summary = self.summarize([])
        assert "No itinerary data" in summary

    def test_handles_day_with_no_activities(self):
        itinerary = [{"day": 1, "city": "Delhi", "activities": []}]
        summary = self.summarize(itinerary)
        assert "0 activities" in summary


# ---------------------------------------------------------------------------
# Auto-approve at max revisions (node-level logic)
# ---------------------------------------------------------------------------

class TestCriticAutoApprove:
    """Tests that critic auto-approves when MAX_REVISION_LOOPS is reached."""

    def test_auto_approves_at_max_revisions(self, minimal_state, sample_itinerary):
        """
        When revision_count >= MAX_REVISION_LOOPS, critic_node should
        return an APPROVE critique without calling the LLM.
        """
        from unittest.mock import patch
        from agents.critic import critic_node
        import config

        state = {**minimal_state, "itinerary": sample_itinerary, "revision_count": config.MAX_REVISION_LOOPS}

        # If LLM is called, the test will fail because we haven't mocked it
        with patch("agents.critic.ChatGroq") as mock_llm:
            result = critic_node(state)
            # LLM should NOT have been called
            mock_llm.assert_not_called()

        assert "APPROVE" in result["critique"]
        assert "critic" in result["completed_agents"]

    def test_auto_approves_returns_status_messages(self, minimal_state, sample_itinerary):
        from unittest.mock import patch
        from agents.critic import critic_node
        import config

        state = {**minimal_state, "itinerary": sample_itinerary, "revision_count": config.MAX_REVISION_LOOPS}

        with patch("agents.critic.ChatGroq"):
            result = critic_node(state)

        assert isinstance(result.get("status_messages"), list)
        assert len(result["status_messages"]) > 0
