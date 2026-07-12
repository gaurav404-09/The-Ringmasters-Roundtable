"""
Itinerary Agent node for LangGraph — the crown jewel of the RAG pipeline.

This is the most AI-heavy node in the system.  Unlike the old template-based
ItineraryAgent that just slotted OSM data into a fixed structure, this node:

  1. Retrieves destination knowledge from ChromaDB (RAG)
  2. Uses Groq LLM (Llama 3.1) to generate a personalized itinerary
  3. Takes user preferences, weather, and local knowledge into account
  4. Produces rich, context-aware daily plans

This is the key differentiator for interviews — it shows real RAG + LLM
integration, not just API wrapper code.
"""

import json
import re
from datetime import datetime, timedelta
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

from state import TripState
from config import GROQ_API_KEY, GROQ_MODEL, GROQ_MODEL_FAST, LLM_TEMPERATURE
from rag.retriever import retrieve_destination_context


ITINERARY_SYSTEM_PROMPT = """You are an expert travel planner specializing in Indian destinations.
Generate a detailed, personalized daily itinerary using the provided destination knowledge.

RULES:
- Use ONLY information from the provided destination knowledge context
- Include specific attraction names, restaurant names, timings, and prices from the context
- Adapt the plan to the weather conditions provided
- Consider the user's preferences when choosing activities and restaurants
- Each day should have 5-8 activities (breakfast, sightseeing, lunch, afternoon activity, dinner minimum)
- Include realistic timings and durations
- Mark status as "confirmed", "recommended", or "optional"

OUTPUT FORMAT: Return a valid JSON array. Each element represents one day:
[
  {{
    "day": 1,
    "city": "City Name",
    "title": "Day 1: Theme Title",
    "activities": [
      {{
        "id": 1,
        "time": "08:00",
        "title": "Activity/Restaurant Name",
        "type": "meal|sightseeing|hotel|transport|shopping|culture",
        "location": "Specific location or coordinates",
        "notes": "Description and insider tips",
        "duration": "1h 30m",
        "price": "₹200-500",
        "includes": ["item1", "item2"],
        "status": "confirmed|recommended|optional"
      }}
    ]
  }}
]

Return ONLY the JSON array. No markdown, no explanations."""


ITINERARY_USER_PROMPT = """Plan a {num_days}-day trip itinerary.

TRIP DETAILS:
- Route: {route_summary}
- Target Destination(s) to Plan: {plan_cities_str}
- Transport Instructions: {transport_instructions}
- Travelers: {adults} adult(s)
- Preferences: {preferences}

WEATHER CONDITIONS:
{weather_summary}

DESTINATION KNOWLEDGE (use this for specific recommendations):
{destination_context}

Generate the complete {num_days}-day itinerary as a JSON array."""


def itinerary_node(state: TripState) -> dict:
    """
    LangGraph node: Generate a personalized itinerary using RAG + LLM.

    This node:
    1. Extracts cities from the route
    2. Retrieves relevant destination knowledge from ChromaDB
    3. Sends the context + user preferences to Groq LLM
    4. Parses the structured JSON response into the itinerary format
    """
    route_with_weather = state.get("route_with_weather", [])
    transport_mode = state.get("transport_mode", "train_flight")
    num_days = state.get("num_days", len(route_with_weather) or 3)
    adults = state.get("adults", 1)
    preferences = state.get("user_preferences", "general sightseeing and local food")
    critique = state.get("critique", "")

    # Determine which cities to plan for
    if transport_mode == "train_flight" and route_with_weather:
        plan_cities = [route_with_weather[-1]]  # Only destination
    else:
        plan_cities = route_with_weather

    if not plan_cities:
        return {
            "itinerary": [],
            "completed_agents": ["itinerary"],
            "status_messages": ["⚠️ Itinerary Agent: No cities to plan for"],
        }

    cities = [stop["city"] for stop in plan_cities]
    status_msg = f"📋 Itinerary Agent: Generating AI-powered plan for {', '.join(cities)}..."

    try:
        # Step 1: RAG retrieval — get destination knowledge
        all_context = []
        # Calculate dynamic top_k to avoid token limit issues with multiple cities
        dynamic_top_k = max(2, 6 // len(cities)) if len(cities) > 1 else 5
        for city in cities:
            context = retrieve_destination_context(
                city=city,
                query=f"top attractions restaurants food culture activities in {city} for {preferences}",
                top_k=dynamic_top_k,
            )
            all_context.append(context)
        destination_context = "\n\n".join(all_context)

        # Step 2: Build route and weather summaries
        if transport_mode == "train_flight":
            route_summary = f"{state['start_city']} → {state['end_city']}"
            transport_instructions = f"The user is traveling via Train/Flight. Since travel time is short, ALL {num_days} days should be spent EXCLUSIVELY exploring {state['end_city']}."
        else:
            route_summary = " → ".join([stop["city"] for stop in route_with_weather])
            plan_cities_str = ", ".join(cities)
            transport_instructions = f"The user is Driving. Distribute the {num_days} days logically across the cities along the route ({plan_cities_str}), accounting for realistic driving times between them."
            
        weather_lines = []
        for stop in plan_cities:
            weather = stop.get("weather", {})
            if weather:
                temp = weather.get("temp", "N/A")
                desc = weather.get("weather", "N/A")
                weather_lines.append(f"- {stop['city']}: {temp}°C, {desc}")
            else:
                weather_lines.append(f"- {stop['city']}: Weather data unavailable")
        weather_summary = "\n".join(weather_lines) or "No weather data available"

        # Step 3: If there was a critique, include revision instructions
        revision_instruction = ""
        if critique:
            revision_instruction = f"\n\nPREVIOUS REVIEW FEEDBACK (address these issues):\n{critique}\n"

        plan_cities_str = ", ".join(cities)

        # Step 4: LLM call via Groq with automated fallback for rate limits (429)
        prompt = ChatPromptTemplate.from_messages([
            ("system", ITINERARY_SYSTEM_PROMPT),
            ("human", ITINERARY_USER_PROMPT + revision_instruction),
        ])

        used_model = GROQ_MODEL
        try:
            llm = ChatGroq(
                api_key=GROQ_API_KEY,
                model=GROQ_MODEL,
                temperature=LLM_TEMPERATURE,
                max_tokens=4096,
            )
            chain = prompt | llm
            response = chain.invoke({
                "plan_cities_str": plan_cities_str,
                "num_days": num_days,
                "route_summary": route_summary,
                "transport_instructions": transport_instructions,
                "adults": adults,
                "preferences": preferences,
                "weather_summary": weather_summary,
                "destination_context": destination_context,
            })
        except Exception as e:
            err_msg = str(e).lower()
            if "rate_limit" in err_msg or "429" in err_msg or "limit reached" in err_msg:
                print(f"  [ItineraryNode] Primary model '{GROQ_MODEL}' rate limited. Falling back to fast model '{GROQ_MODEL_FAST}'...")
                used_model = GROQ_MODEL_FAST
                llm_fallback = ChatGroq(
                    api_key=GROQ_API_KEY,
                    model=GROQ_MODEL_FAST,
                    temperature=LLM_TEMPERATURE,
                    max_tokens=4096,
                )
                chain_fallback = prompt | llm_fallback
                response = chain_fallback.invoke({
                    "plan_cities_str": plan_cities_str,
                    "num_days": num_days,
                    "route_summary": route_summary,
                    "transport_instructions": transport_instructions,
                    "adults": adults,
                    "preferences": preferences,
                    "weather_summary": weather_summary,
                    "destination_context": destination_context,
                })
            else:
                raise e

        # Extract and log token usage
        try:
            from observability.tracer import get_current_trace
            trace = get_current_trace()
            if trace and hasattr(response, "response_metadata") and "token_usage" in response.response_metadata:
                usage = response.response_metadata["token_usage"]
                trace.add_llm_tokens(
                    model=used_model,
                    agent="itinerary",
                    prompt=usage.get("prompt_tokens", 0),
                    completion=usage.get("completion_tokens", 0)
                )
        except Exception as trace_err:
            print(f"  [Itinerary] Tracer error: {trace_err}")

        # Step 5: Parse the LLM response
        itinerary = _parse_itinerary_response(response.content, plan_cities)
        
        # Step 6: Enrich itinerary with dates and weather
        enriched_itinerary = enrich_itinerary(
            itinerary=itinerary,
            start_date_str=state.get("start_date"),
            route_with_weather=state.get("route_with_weather", [])
        )

        return {
            "itinerary": enriched_itinerary,
            "retrieved_context": destination_context[:2000],  # Store truncated for observability
            "completed_agents": ["itinerary"],
            "critique": "",  # Clear critique since we've regenerated the itinerary
            "status_messages": [
                status_msg,
                f"✅ Generated {len(itinerary)}-day itinerary with RAG context",
            ],
        }

    except Exception as e:
        print(f"  [ItineraryNode] LLM/RAG Error: {e}, using template fallback...")
        return _fallback_itinerary(state, plan_cities, str(e))


def _parse_itinerary_response(response_text: str, route: list) -> list:
    """
    Parse LLM response into structured itinerary.
    Handles cases where the LLM wraps JSON in markdown code blocks.
    """
    # Strip markdown code blocks if present
    cleaned = response_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        itinerary = json.loads(cleaned)
        if isinstance(itinerary, list):
            return itinerary
    except json.JSONDecodeError:
        # Try to find JSON array in the response
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

    print("  [ItineraryNode] Failed to parse LLM response as JSON")
    raise ValueError("Could not parse itinerary from LLM response")


def _fallback_itinerary(state: TripState, plan_cities: list, error: str) -> dict:
    """Fallback to the original template-based ItineraryAgent."""
    try:
        from itinerary_agent import ItineraryAgent
        agent = ItineraryAgent()
        itinerary = agent.generate_itinerary(plan_cities)
        
        # Enrich fallback itinerary too
        enriched_itinerary = enrich_itinerary(
            itinerary=itinerary,
            start_date_str=state.get("start_date"),
            route_with_weather=state.get("route_with_weather", [])
        )
        
        return {
            "itinerary": enriched_itinerary,
            "completed_agents": ["itinerary"],
            "critique": "",  # Clear critique
            "status_messages": [
                f"⚠️ Itinerary Agent: LLM failed ({error}), used template fallback",
                f"✅ Generated {len(itinerary)}-day template itinerary",
            ],
        }
    except Exception as fallback_error:
        return {
            "itinerary": [],
            "completed_agents": ["itinerary"],
            "status_messages": [
                f"❌ Itinerary Agent: Both LLM and fallback failed: {fallback_error}",
            ],
        }


def enrich_itinerary(itinerary: list, start_date_str: str, route_with_weather: list) -> list:
    """Enrich the parsed itinerary with date-wise calendars and OpenWeather data."""
    start_date = None
    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str.split("T")[0], "%Y-%m-%d")
        except ValueError:
            pass
            
    if not start_date:
        start_date = datetime.now()
        
    weather_map = {}
    for stop in route_with_weather:
        city_name = stop.get("city", "").lower().strip()
        weather_map[city_name] = stop.get("weather", {})
        
    for i, day in enumerate(itinerary):
        # Calculate date for this day
        day_date = start_date + timedelta(days=i)
        day["date"] = day_date.strftime("%A, %b %d, %Y")  # e.g. "Saturday, Jun 20, 2026"
        
        # Match weather by city name case-insensitively
        city_name = day.get("city", "").lower().strip()
        if city_name in weather_map:
            day["weather"] = weather_map[city_name]
        else:
            # Fallback if no exact match (e.g. use first matching stop or general unknown)
            day["weather"] = {"weather": "Unknown", "temp": 0}
            
    return itinerary
