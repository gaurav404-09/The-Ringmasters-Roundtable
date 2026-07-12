"""
Map Agent node for LangGraph.

Wraps the existing MapAgent class as a LangGraph node function.
Takes TripState, calculates route, and returns updated state.
"""

from state import TripState
from map_agent import MapAgent


def map_node(state: TripState) -> dict:
    """
    LangGraph node: Calculate the route between start and end city.

    Uses OpenRouteService to find intermediate cities along the route.
    On failure, creates a fallback route with just start and end cities.
    """
    start_city = state["start_city"]
    end_city = state["end_city"]
    num_days = state.get("num_days", 3)
    transport_mode = state.get("transport_mode", "train_flight")

    status_msg = f"🗺️ Map Agent: Calculating route from {start_city} to {end_city}..."

    try:
        agent = MapAgent()
        if transport_mode == "train_flight":
            # For flight/train, no intermediate road stops. Just start and end coordinates.
            try:
                start_lat, start_lon = agent.get_coordinates(start_city)
                end_lat, end_lon = agent.get_coordinates(end_city)
                route = [
                    {"city": start_city, "coord": f"{start_lat},{start_lon}"},
                    {"city": end_city, "coord": f"{end_lat},{end_lon}"}
                ]
            except Exception as geocode_error:
                print(f"  [MapNode] Geocoding failed, using fallbacks: {geocode_error}")
                route = [
                    {"city": start_city, "coord": "28.6139,77.2090"},
                    {"city": end_city, "coord": "15.3005,74.0855"}
                ]
        else:
            route = agent.get_intermediate_cities(start_city, end_city, num_days)

        if not route:
            raise ValueError("MapAgent returned empty route")

        return {
            "route": route,
            "completed_agents": ["map"],
            "status_messages": [
                status_msg,
                f"✅ Route calculated: {len(route)} stops",
            ],
        }

    except Exception as e:
        print(f"  [MapNode] Error: {e}")
        raise e
