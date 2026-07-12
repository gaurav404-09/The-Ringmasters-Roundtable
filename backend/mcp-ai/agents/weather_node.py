"""
Weather Agent node for LangGraph.

Wraps the existing WeatherAgent class as a LangGraph node.
Fetches weather for all route stops and merges with route data.
"""

from state import TripState
from weather_agent import WeatherAgent
from config import OPENWEATHER_API_KEY


def weather_node(state: TripState) -> dict:
    """
    LangGraph node: Fetch weather forecasts for all cities on the route.

    Reads `route` from state, fetches weather for each stop,
    and produces `weather_data` and `route_with_weather`.
    """
    route = state.get("route", [])
    if not route:
        return {
            "weather_data": [],
            "route_with_weather": [],
            "completed_agents": ["weather"],
            "status_messages": ["⚠️ Weather Agent: Skipped (no route available)"],
        }

    status_msg = f"⛅ Weather Agent: Fetching forecasts for {len(route)} stops..."

    try:
        agent = WeatherAgent(OPENWEATHER_API_KEY)
        weather_results = []

        for point in route:
            try:
                lat, lon = map(float, point["coord"].split(","))
                weather_data = agent.get_weather(lat, lon)
            except (ValueError, KeyError):
                weather_data = {}

            weather_results.append({
                "city": point["city"],
                "coord": point.get("coord", "0,0"),
                "weather": weather_data,
            })

        # Merge weather into route
        city_weather_map = {
            item["city"]: item["weather"] for item in weather_results
        }
        route_with_weather = []
        for stop in route:
            enriched_stop = {**stop}
            enriched_stop["weather"] = city_weather_map.get(stop["city"], {})
            route_with_weather.append(enriched_stop)

        return {
            "weather_data": weather_results,
            "route_with_weather": route_with_weather,
            "completed_agents": ["weather"],
            "status_messages": [
                status_msg,
                f"✅ Weather fetched for {len(weather_results)} cities",
            ],
        }

    except Exception as e:
        print(f"  [WeatherNode] Error: {e}")
        raise e
