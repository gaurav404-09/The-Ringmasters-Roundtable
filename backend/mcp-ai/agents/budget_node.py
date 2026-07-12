"""
Budget Agent node for LangGraph.

Wraps the existing BudgetAgent class (Amadeus flights/hotels + Indian Railways)
as a LangGraph node function.
"""

from state import TripState
from budget_agent import BudgetAgent


def budget_node(state: TripState) -> dict:
    """
    LangGraph node: Calculate budget with flights, hotels, and trains.

    Uses the existing BudgetAgent which queries Amadeus API for flights/hotels
    and Indian Railways API for train options, then finds the cheapest combo.
    """
    itinerary = state.get("itinerary", [])
    route = state.get("route", [])

    if not itinerary:
        return {
            "budget": {"error": "No itinerary available for budget calculation"},
            "completed_agents": ["budget"],
            "status_messages": ["⚠️ Budget Agent: Skipped (no itinerary)"],
        }

    # Extract trip parameters
    start_city = state.get("start_city") or (
        route[0]["city"] if route else itinerary[0].get("city", "Unknown")
    )
    end_city = state.get("end_city") or (
        route[-1]["city"] if route else itinerary[-1].get("city", "Unknown")
    )
    start_date = state.get("start_date") or itinerary[0].get("date", "")
    end_date = state.get("end_date") or itinerary[-1].get("date", "")
    adults = state.get("adults", 1)
    num_days = state.get("num_days", len(itinerary))

    payload = {
        "start_city": start_city,
        "end_city": end_city,
        "origin": start_city,
        "destination": end_city,
        "start_date": start_date,
        "end_date": end_date,
        "adults": adults,
        "num_days": num_days,
    }

    status_msg = f"💰 Budget Agent: Calculating costs for {start_city} → {end_city}..."

    try:
        agent = BudgetAgent()
        summary = agent.generate_budget_summary(payload)

        return {
            "budget": summary,
            "completed_agents": ["budget"],
            "status_messages": [
                status_msg,
                "✅ Budget calculated with flight, hotel, and train options",
            ],
        }

    except Exception as e:
        print(f"  [BudgetNode] Error: {e}")
        raise e
