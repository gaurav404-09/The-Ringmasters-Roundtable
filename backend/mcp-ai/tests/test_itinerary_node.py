"""
Unit tests for the Itinerary node.

Tests:
  1. _parse_itinerary_response  — JSON extraction from LLM output
  2. enrich_itinerary           — date injection and weather matching

No LLM or RAG calls are made.
"""
import sys
import os
import pytest
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# _parse_itinerary_response
# ---------------------------------------------------------------------------

class TestParseItineraryResponse:
    """Tests for LLM JSON response parsing in the itinerary node."""

    def setup_method(self):
        from agents.itinerary_node import _parse_itinerary_response
        self.parse = _parse_itinerary_response

    def test_parses_raw_json_array(self):
        raw = '[{"day": 1, "city": "Goa", "title": "Day 1", "activities": []}]'
        result = self.parse(raw, route=[])
        assert isinstance(result, list)
        assert result[0]["city"] == "Goa"

    def test_strips_markdown_json_fence(self):
        """LLMs often return ```json ... ``` wrapping."""
        raw = '```json\n[{"day": 1, "city": "Jaipur", "title": "Day 1", "activities": []}]\n```'
        result = self.parse(raw, route=[])
        assert result[0]["city"] == "Jaipur"

    def test_strips_plain_code_fence(self):
        raw = '```\n[{"day": 1, "city": "Mumbai", "title": "Day 1", "activities": []}]\n```'
        result = self.parse(raw, route=[])
        assert result[0]["city"] == "Mumbai"

    def test_extracts_json_array_from_surrounding_text(self):
        """Sometimes LLM adds prose before/after the JSON."""
        raw = 'Here is your itinerary: [{"day": 1, "city": "Delhi", "title": "Day 1", "activities": []}] Hope you enjoy it!'
        result = self.parse(raw, route=[])
        assert result[0]["city"] == "Delhi"

    def test_raises_value_error_on_unparseable_input(self):
        """Completely unparseable input must raise ValueError for fallback."""
        raw = "I cannot generate an itinerary right now."
        with pytest.raises(ValueError, match="Could not parse itinerary"):
            self.parse(raw, route=[])

    def test_raises_value_error_on_empty_string(self):
        with pytest.raises(ValueError):
            self.parse("", route=[])

    def test_preserves_multiple_days(self):
        raw = '[{"day": 1, "city": "Goa", "title": "D1", "activities": []}, {"day": 2, "city": "Goa", "title": "D2", "activities": []}]'
        result = self.parse(raw, route=[])
        assert len(result) == 2

    def test_parses_activities_list(self):
        raw = '[{"day": 1, "city": "Goa", "title": "Day 1", "activities": [{"id": 1, "time": "09:00", "title": "Beach", "type": "sightseeing"}]}]'
        result = self.parse(raw, route=[])
        assert len(result[0]["activities"]) == 1
        assert result[0]["activities"][0]["time"] == "09:00"


# ---------------------------------------------------------------------------
# enrich_itinerary
# ---------------------------------------------------------------------------

class TestEnrichItinerary:
    """Tests for the date and weather enrichment step."""

    def setup_method(self):
        from agents.itinerary_node import enrich_itinerary
        self.enrich = enrich_itinerary

    def test_injects_start_date_on_day_1(self, sample_itinerary, route_with_weather):
        enriched = self.enrich(
            itinerary=sample_itinerary,
            start_date_str="2026-07-01",
            route_with_weather=route_with_weather,
        )
        assert "Jul 01, 2026" in enriched[0]["date"]

    def test_increments_date_per_day(self, sample_itinerary, route_with_weather):
        enriched = self.enrich(
            itinerary=sample_itinerary,
            start_date_str="2026-07-01",
            route_with_weather=route_with_weather,
        )
        assert "Jul 02, 2026" in enriched[1]["date"]

    def test_matches_weather_by_city_name(self, sample_itinerary, route_with_weather):
        """Weather from route_with_weather must be matched case-insensitively to itinerary city."""
        enriched = self.enrich(
            itinerary=sample_itinerary,
            start_date_str="2026-07-01",
            route_with_weather=route_with_weather,
        )
        # Both days are in "Goa" which is in route_with_weather
        assert enriched[0]["weather"]["temp"] == 28
        assert enriched[0]["weather"]["weather"] == "Partly cloudy"

    def test_handles_missing_start_date_gracefully(self, sample_itinerary, route_with_weather):
        """Enrich should not crash when start_date_str is None or empty."""
        enriched = self.enrich(
            itinerary=sample_itinerary,
            start_date_str=None,
            route_with_weather=route_with_weather,
        )
        # Should still have a date (fallback to today)
        assert "date" in enriched[0]
        assert enriched[0]["date"] != ""

    def test_handles_city_not_in_weather_map(self):
        """If a city has no weather data, should default gracefully."""
        from agents.itinerary_node import enrich_itinerary
        itinerary = [{"day": 1, "city": "UnknownCity", "title": "Day 1", "activities": []}]
        enriched = enrich_itinerary(itinerary, "2026-07-01", route_with_weather=[])
        assert "weather" in enriched[0]
        assert enriched[0]["weather"]["weather"] == "Unknown"

    def test_returns_same_number_of_days(self, sample_itinerary, route_with_weather):
        enriched = self.enrich(
            itinerary=sample_itinerary,
            start_date_str="2026-07-01",
            route_with_weather=route_with_weather,
        )
        assert len(enriched) == len(sample_itinerary)
