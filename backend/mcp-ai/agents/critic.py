"""
Critic / Reflection node for LangGraph.

The critic reviews the assembled trip plan and either APPROVES it
or requests a REVISION with specific feedback.  This reflection loop
is a key agentic pattern — it enables self-improvement without
human intervention.

Interview talking points:
  - "The critic implements a reflection loop — a core pattern in
     agentic AI where the system evaluates its own output"
  - "We cap revisions at 2 to prevent infinite loops while still
     allowing meaningful quality improvement"
  - "The critic's feedback is injected into the itinerary node's
     next prompt, creating a feedback → generation → feedback cycle"
"""

import json
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

from state import TripState
from config import GROQ_API_KEY, GROQ_MODEL_FAST, MAX_REVISION_LOOPS


CRITIC_PROMPT = """You are a travel plan quality reviewer. Evaluate the following trip plan 
and decide whether it meets quality standards or needs revision.

CHECK FOR:
1. Each day has at least 4 activities (breakfast, sightseeing, lunch, dinner minimum)
2. Timings are realistic (no overlapping activities, reasonable travel time between spots)
3. Activity variety — mix of sightseeing, food, culture, leisure
4. Meals are included (breakfast, lunch, dinner each day)
5. First day accounts for arrival, last day accounts for departure
6. Activities match the destination (e.g., beach activities for Goa, forts for Jaipur)

TRIP PLAN:
Destination: {destination}
Duration: {num_days} days
Transport: {transport_mode}
Transport Instructions: {transport_instructions}
Travelers: {adults} adult(s)
User preferences: {preferences}

ITINERARY:
{itinerary_summary}

EVENTS FOUND:
{events_summary}

RESPOND WITH ONLY a JSON object:
{{
  "verdict": "APPROVE" or "REVISE",
  "score": 1-10,
  "feedback": "specific feedback explaining your verdict",
  "issues": ["issue 1", "issue 2"]
}}"""


def critic_node(state: TripState) -> dict:
    """
    LangGraph node: Review the trip plan and approve or request revision.

    If the plan is approved, the graph proceeds to FINISH.
    If revision is needed, the supervisor routes back to the itinerary node
    with the critic's feedback included in the prompt.
    """
    itinerary = state.get("itinerary", [])
    events = state.get("events", {})
    revision_count = state.get("revision_count", 0)

    # If we've hit max revisions, auto-approve
    if revision_count >= MAX_REVISION_LOOPS:
        return {
            "critique": "APPROVE: Max revision limit reached, accepting current plan.",
            "completed_agents": ["critic"],
            "status_messages": [
                f"🔍 Critic: Auto-approved (reached max {MAX_REVISION_LOOPS} revisions)"
            ],
        }

    if not itinerary:
        return {
            "critique": "APPROVE: No itinerary to review.",
            "completed_agents": ["critic"],
            "status_messages": ["⚠️ Critic: Nothing to review"],
        }

    status_msg = f"🔍 Critic: Reviewing trip plan (revision {revision_count})..."

    try:
        llm = ChatGroq(
            api_key=GROQ_API_KEY,
            model=GROQ_MODEL_FAST,
            temperature=0,
            max_tokens=512,
        )

        # Build summaries
        itinerary_summary = _summarize_itinerary(itinerary)
        events_summary = _summarize_events(events)

        route_with_weather = state.get("route_with_weather", [])
        transport_mode = state.get("transport_mode", "train_flight")
        num_days = state.get("num_days", len(itinerary))
        
        if transport_mode == "train_flight" and route_with_weather:
            plan_cities = [route_with_weather[-1]]
            cities = [stop.get("city", "Unknown") for stop in plan_cities] if plan_cities else ["Unknown"]
            transport_instructions = f"The user is traveling via Train/Flight. Since travel time is short, ALL {num_days} days should be spent EXCLUSIVELY exploring {cities[0]}."
        else:
            plan_cities = route_with_weather
            cities = [stop.get("city", "Unknown") for stop in plan_cities] if plan_cities else ["Unknown"]
            transport_instructions = f"The user is Driving. Distribute the {num_days} days logically across the cities along the route ({', '.join(cities)}), accounting for realistic driving times between them."
            
        destination = ", ".join(cities)

        prompt = ChatPromptTemplate.from_messages([
            ("system", CRITIC_PROMPT),
        ])

        chain = prompt | llm
        response = chain.invoke({
            "destination": destination,
            "num_days": num_days,
            "transport_mode": transport_mode,
            "transport_instructions": transport_instructions,
            "adults": state.get("adults", 1),
            "preferences": state.get("user_preferences", "general"),
            "itinerary_summary": itinerary_summary,
            "events_summary": events_summary,
        })

        # Extract and log token usage
        try:
            from observability.tracer import get_current_trace
            trace = get_current_trace()
            if trace and hasattr(response, "response_metadata") and "token_usage" in response.response_metadata:
                usage = response.response_metadata["token_usage"]
                trace.add_llm_tokens(
                    model=GROQ_MODEL_FAST,
                    agent="critic",
                    prompt=usage.get("prompt_tokens", 0),
                    completion=usage.get("completion_tokens", 0)
                )
        except Exception as trace_err:
            print(f"  [Critic] Tracer error: {trace_err}")

        review = _parse_critic_response(response.content)
        verdict = review.get("verdict", "APPROVE")
        score = review.get("score", 7)
        feedback = review.get("feedback", "")
        issues = review.get("issues", [])

        # Build critique string (supervisor checks for "REVISE" keyword)
        if verdict == "REVISE" and issues:
            critique = f"REVISE: Score {score}/10. {feedback}. Issues: {'; '.join(issues)}"
            new_revision_count = revision_count + 1
        else:
            critique = f"APPROVE: Score {score}/10. {feedback}"
            new_revision_count = revision_count

        return {
            "critique": critique,
            "revision_count": new_revision_count,
            "completed_agents": ["critic"],
            "status_messages": [
                status_msg,
                f"{'✅' if verdict == 'APPROVE' else '🔄'} Critic: {verdict} (Score: {score}/10) — {feedback[:100]}",
            ],
        }

    except Exception as e:
        print(f"  [CriticNode] Error: {e}")
        return {
            "critique": "APPROVE: Critic failed, accepting current plan.",
            "completed_agents": ["critic"],
            "status_messages": [
                status_msg,
                f"⚠️ Critic: Error ({e}), auto-approving",
            ],
        }


def _summarize_itinerary(itinerary: list) -> str:
    """Create a concise summary of the itinerary for the critic prompt."""
    lines = []
    for day in itinerary:
        day_num = day.get("day", "?")
        city = day.get("city", "Unknown")
        activities = day.get("activities", [])
        activity_titles = [a.get("title", "?") for a in activities]
        lines.append(f"Day {day_num} ({city}): {len(activities)} activities — {', '.join(activity_titles[:5])}")
    return "\n".join(lines) or "No itinerary data"


def _summarize_events(events: dict) -> str:
    """Create a concise summary of events for the critic prompt."""
    if not events:
        return "No events found"
    lines = []
    for city, city_events in events.items():
        if isinstance(city_events, list):
            event_titles = [e.get("title", "?") for e in city_events]
            lines.append(f"{city}: {', '.join(event_titles)}")
    return "\n".join(lines) or "No events found"


def _parse_critic_response(text: str) -> dict:
    """Parse the critic's JSON response."""
    import re
    text = text.strip()
    text = text.removeprefix("```json").removeprefix("```")
    text = text.removesuffix("```")
    text = text.strip()

    try:
        result = json.loads(text)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    match = re.search(r'\{[^}]+\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    # Default: approve if we can't parse
    return {"verdict": "APPROVE", "score": 7, "feedback": "Could not parse critic response"}
