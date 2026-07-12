"""
Supervisor node for LangGraph — the brain of the agentic pipeline.

The supervisor is an LLM that examines the current state and decides
which agent to invoke next.  This is what makes the system truly
"agentic" rather than a hardcoded pipeline:

  - It can SKIP agents (e.g., skip budget for driving mode)
  - It can handle ERRORS and decide to retry or proceed
  - It can route to the CRITIC when enough data is gathered
  - It logs its REASONING for observability / audit

The supervisor uses Groq (Llama 3.1) for fast, free inference.
"""

import json
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

from state import TripState
from config import GROQ_API_KEY, GROQ_MODEL_FAST, ENABLE_CRITIC


SUPERVISOR_PROMPT = """You are the Supervisor of an AI travel planning system. 
Your job is to decide which agent should run NEXT based on the current state.

AVAILABLE AGENTS (in typical order):
1. "map" — Calculates the driving route with intermediate stops
2. "weather" — Fetches weather forecasts for route cities (REQUIRES: map done)
3. "itinerary" — Generates a detailed daily plan using AI + RAG (REQUIRES: weather done)
4. "events" — Finds local events at destination cities (REQUIRES: itinerary done)
5. "budget" — Calculates flight/hotel/train costs (REQUIRES: itinerary done)
6. "critic" — Reviews the complete plan for quality (REQUIRES: itinerary + events done)
7. "FINISH" — All work is complete, return the final result

RULES:
- Respect data dependencies: you CANNOT run weather before map, or itinerary before weather
- If transport_mode is "driving", you may SKIP "budget" (driving costs are handled differently)
- If an agent has already completed, do NOT run it again (unless the critic requested revision)
- If the critic requested a revision, route back to "itinerary" to re-generate
- Route to "critic" only after itinerary AND events are done
- Route to "FINISH" after the critic approves OR if critic is disabled

CURRENT STATE:
- Completed agents: {completed}
- Transport mode: {transport_mode}
- Has route: {has_route}
- Has weather: {has_weather}
- Has itinerary: {has_itinerary}
- Has events: {has_events}
- Has budget: {has_budget}
- Critic enabled: {critic_enabled}
- Critic requested revision: {needs_revision}
- Revision count: {revision_count}
- Max revisions: {max_revisions}

Respond with ONLY a JSON object: {{"next": "agent_name", "reasoning": "brief explanation"}}"""


def _get_last_index(lst: list, item: str) -> int:
    try:
        return len(lst) - 1 - lst[::-1].index(item)
    except ValueError:
        return -1


def supervisor_node(state: TripState) -> dict:
    """
    LangGraph node: LLM-based supervisor decides the next agent to invoke.

    Examines current state and routes to the appropriate next node.
    Includes fallback logic if the LLM response is unparseable.
    """
    completed = state.get("completed_agents", [])
    transport_mode = state.get("transport_mode", "train_flight")
    critique = state.get("critique", "")
    revision_count = state.get("revision_count", 0)

    from config import MAX_REVISION_LOOPS
    max_revisions = MAX_REVISION_LOOPS

    # Determine if critic requested revision
    needs_revision = bool(
        critique
        and "REVISE" in critique.upper()
        and revision_count < max_revisions
    )

    # Compute up-to-date status of each agent to pass to LLM and fallback routing
    idx_map = _get_last_index(completed, "map")
    idx_weather = _get_last_index(completed, "weather")
    idx_itinerary = _get_last_index(completed, "itinerary")
    idx_events = _get_last_index(completed, "events")
    idx_budget = _get_last_index(completed, "budget")
    idx_critic = _get_last_index(completed, "critic")

    is_map_done = idx_map >= 0
    is_weather_done = idx_weather >= 0
    is_itinerary_done = idx_itinerary >= 0 and not needs_revision
    is_events_done = idx_events >= 0
    is_budget_done = (transport_mode == "driving") or (idx_budget >= 0)
    # The critic reviews the plan; if itinerary was regenerated/revised, critic must rerun.
    is_critic_done = idx_critic >= 0 and idx_critic > idx_itinerary

    up_to_date_completed = []
    if is_map_done: up_to_date_completed.append("map")
    if is_weather_done: up_to_date_completed.append("weather")
    if is_itinerary_done: up_to_date_completed.append("itinerary")
    if is_events_done: up_to_date_completed.append("events")
    if is_budget_done: up_to_date_completed.append("budget")
    if is_critic_done: up_to_date_completed.append("critic")

    try:
        llm = ChatGroq(
            api_key=GROQ_API_KEY,
            model=GROQ_MODEL_FAST,
            temperature=0,
            max_tokens=256,
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", SUPERVISOR_PROMPT),
        ])

        chain = prompt | llm
        response = chain.invoke({
            "completed": ", ".join(up_to_date_completed) if up_to_date_completed else "none",
            "transport_mode": transport_mode,
            "has_route": bool(state.get("route")),
            "has_weather": bool(state.get("weather_data")),
            "has_itinerary": bool(state.get("itinerary")),
            "has_events": bool(state.get("events")),
            "has_budget": bool(state.get("budget")) if transport_mode != "driving" else True,
            "critic_enabled": ENABLE_CRITIC,
            "needs_revision": needs_revision,
            "revision_count": revision_count,
            "max_revisions": max_revisions,
        })

        # Extract and log token usage
        try:
            from observability.tracer import get_current_trace
            trace = get_current_trace()
            if trace and hasattr(response, "response_metadata") and "token_usage" in response.response_metadata:
                usage = response.response_metadata["token_usage"]
                trace.add_llm_tokens(
                    model=GROQ_MODEL_FAST,
                    agent="supervisor",
                    prompt=usage.get("prompt_tokens", 0),
                    completion=usage.get("completion_tokens", 0)
                )
        except Exception as trace_err:
            print(f"  [Supervisor] Tracer error: {trace_err}")

        decision = _parse_supervisor_response(response.content)
        next_agent = decision.get("next", "FINISH")
        reasoning = decision.get("reasoning", "No reasoning provided")

        print(f"  [Supervisor] Decision: {next_agent} | Reason: {reasoning}")

        return {
            "next_agent": next_agent,
            "status_messages": [
                f"🧠 Supervisor: → {next_agent} ({reasoning})"
            ],
        }

    except Exception as e:
        print(f"  [Supervisor] LLM error, using fallback routing: {e}")
        return _fallback_routing(state, completed, transport_mode, needs_revision)


def _parse_supervisor_response(text: str) -> dict:
    """Parse the supervisor's JSON response."""
    text = text.strip()
    # Strip markdown code blocks
    text = text.removeprefix("```json").removeprefix("```")
    text = text.removesuffix("```")
    text = text.strip()

    try:
        result = json.loads(text)
        if isinstance(result, dict) and "next" in result:
            return result
    except json.JSONDecodeError:
        pass

    # Try to find JSON in the response
    import re
    match = re.search(r'\{[^}]+\}', text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return {"next": "FINISH", "reasoning": "Could not parse supervisor response"}


def _fallback_routing(
    state: TripState,
    completed: list,
    transport_mode: str,
    needs_revision: bool,
) -> dict:
    """
    Deterministic fallback routing when LLM fails.
    Follows the natural dependency chain.
    """
    idx_map = _get_last_index(completed, "map")
    idx_weather = _get_last_index(completed, "weather")
    idx_itinerary = _get_last_index(completed, "itinerary")
    idx_events = _get_last_index(completed, "events")
    idx_budget = _get_last_index(completed, "budget")
    idx_critic = _get_last_index(completed, "critic")

    is_map_done = idx_map >= 0
    is_weather_done = idx_weather >= 0
    is_itinerary_done = idx_itinerary >= 0 and not needs_revision
    is_events_done = idx_events >= 0
    is_budget_done = (transport_mode == "driving") or (idx_budget >= 0)
    # The critic reviews the plan; if itinerary was regenerated/revised, critic must rerun.
    is_critic_done = idx_critic >= 0 and idx_critic > idx_itinerary

    if not is_map_done:
        next_agent = "map"
        reason = "Route needed first (fallback)"
    elif not is_weather_done:
        next_agent = "weather"
        reason = "Weather needed before itinerary (fallback)"
    elif not is_itinerary_done:
        next_agent = "itinerary"
        reason = "Itinerary generation needed or revision requested (fallback)"
    elif not is_events_done:
        next_agent = "events"
        reason = "Events needed (fallback)"
    elif not is_budget_done:
        next_agent = "budget"
        reason = "Budget calculation needed (fallback)"
    elif not is_critic_done and ENABLE_CRITIC:
        next_agent = "critic"
        reason = "Quality review needed (fallback)"
    else:
        next_agent = "FINISH"
        reason = "All agents completed (fallback)"

    print(f"  [Supervisor] Fallback: {next_agent} | Reason: {reason}")

    return {
        "next_agent": next_agent,
        "status_messages": [f"🧠 Supervisor (fallback): → {next_agent} ({reason})"],
    }
