"""
Event Agent node for LangGraph.

Wraps the existing EventAgent class (Cohere-powered event generation)
as a LangGraph node function.
"""

from state import TripState
from event_agent import EventAgent


def event_node(state: TripState) -> dict:
    """
    LangGraph node: Find local events for each city in the itinerary.

    Uses the existing EventAgent which calls Cohere to generate
    plausible upcoming events for each destination city.
    """
    itinerary = state.get("itinerary", [])
    transport_mode = state.get("transport_mode", "train_flight")

    # Extract unique cities from itinerary
    cities = list(dict.fromkeys(
        day.get("city") for day in itinerary if day.get("city")
    ))

    # For train/flight mode, only get events for the destination
    if transport_mode == "train_flight" and cities:
        cities = [cities[-1]]

    if not cities:
        return {
            "events": {},
            "completed_agents": ["events"],
            "status_messages": ["⚠️ Event Agent: No cities to search"],
        }

    status_msg = f"🎪 Event Agent: Discovering events in {', '.join(cities)}..."

    try:
        agent = EventAgent()
        events_by_city = {}

        for city in cities:
            print(f"  [EventNode] Finding events for {city}...")
            events_by_city[city] = agent.get_events(city)

        total_events = sum(len(v) for v in events_by_city.values())

        return {
            "events": events_by_city,
            "completed_agents": ["events"],
            "status_messages": [
                status_msg,
                f"✅ Found {total_events} events across {len(cities)} cities",
            ],
        }

    except Exception as e:
        print(f"  [EventNode] Error: {e}")
        raise e
