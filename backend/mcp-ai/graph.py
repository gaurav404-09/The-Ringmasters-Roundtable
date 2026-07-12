"""
Main LangGraph StateGraph definition for the travel planning pipeline.

This is the core of Upgrade 1 — a stateful, agentic workflow graph that
replaces the old hardcoded sequential pipeline with LLM-driven routing.

Architecture:
  ┌───────────┐
  │   START   │
  └─────┬─────┘
        ▼
  ┌───────────┐      ┌───────────┐
  │ Supervisor │ ───▶ │ Map Agent │
  │ (LLM)     │ ───▶ │ Weather   │
  │            │ ───▶ │ Itinerary │  ← RAG + LLM
  │            │ ───▶ │ Events    │
  │ decides    │ ───▶ │ Budget    │
  │ next agent │ ───▶ │ Critic    │  ← Reflection loop
  │            │ ───▶ │ FINISH    │
  └───────────┘      └───────────┘

Key agentic features:
  - Supervisor LLM dynamically routes between agents
  - Critic can loop back to itinerary for self-improvement
  - Conditional edges enable skipping agents (e.g., no budget for driving)
  - State accumulates results across all nodes
  - Checkpointing enables pause/resume
"""

from langgraph.graph import StateGraph, START, END

from state import TripState
from agents.supervisor import supervisor_node
from agents.map_node import map_node
from agents.weather_node import weather_node
from agents.itinerary_node import itinerary_node
from agents.event_node import event_node
from agents.budget_node import budget_node
from agents.critic import critic_node


def _route_from_supervisor(state: TripState) -> str:
    """
    Conditional edge: read the supervisor's decision and route accordingly.
    Maps supervisor output to actual node names in the graph.
    """
    next_agent = state.get("next_agent", "FINISH")

    routing_map = {
        "map": "plan_route",
        "weather": "get_weather",
        "itinerary": "generate_itinerary",
        "events": "find_events",
        "budget": "calculate_budget",
        "critic": "review_plan",
        "FINISH": "finish",
    }

    return routing_map.get(next_agent, "finish")


def _wrap_node(node_name: str, node_func):
    import time
    from observability.tracer import get_current_trace

    def wrapper(state: TripState) -> dict:
        trace = get_current_trace()
        start_time = time.time()
        
        # Log node execution start
        if trace:
            trace.log(f"node_{node_name}_start", {
                "trip_id": state.get("trip_id"),
                "completed_agents": state.get("completed_agents", [])
            })
            
        try:
            # Run the node function
            result = node_func(state)
            
            # Record elapsed time
            elapsed_ms = int((time.time() - start_time) * 1000)
            if trace:
                trace.record_agent_timing(node_name, elapsed_ms)
                # Parse output properties if available (e.g. next_agent, budget)
                log_data = {"duration_ms": elapsed_ms}
                if isinstance(result, dict):
                    if "next_agent" in result:
                        log_data["next_agent"] = result["next_agent"]
                    if "critique" in result:
                        log_data["critique"] = result["critique"]
                    if "revision_count" in result:
                        log_data["revision_count"] = result["revision_count"]
                trace.log(f"node_{node_name}_completed", log_data)
                
            return result
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            if trace:
                trace.record_agent_timing(node_name, elapsed_ms)
                trace.log(f"node_{node_name}_failed", {
                    "error": str(e),
                    "duration_ms": elapsed_ms
                })
            raise e
            
    return wrapper


def _prepare_finish(state: TripState) -> dict:
    """
    Terminal node: mark the trip as completed.
    This is where the final state is assembled before returning.
    """
    return {
        "status": "completed",
        "status_messages": ["🎉 Trip planning complete! Your personalized plan is ready."],
    }


def build_travel_graph() -> StateGraph:
    """
    Construct and compile the LangGraph travel planning pipeline.

    Returns a compiled graph that can be invoked with:
        result = graph.invoke(initial_state)
    """
    graph = StateGraph(TripState)

    # ── Register all nodes ──────────────────────────────────────────
    graph.add_node("supervisor", _wrap_node("supervisor", supervisor_node))
    graph.add_node("plan_route", _wrap_node("map", map_node))
    graph.add_node("get_weather", _wrap_node("weather", weather_node))
    graph.add_node("generate_itinerary", _wrap_node("itinerary", itinerary_node))
    graph.add_node("find_events", _wrap_node("events", event_node))
    graph.add_node("calculate_budget", _wrap_node("budget", budget_node))
    graph.add_node("review_plan", _wrap_node("critic", critic_node))
    graph.add_node("finish", _wrap_node("finish", _prepare_finish))

    # ── Wire the edges ──────────────────────────────────────────────

    # START → Supervisor (supervisor always runs first)
    graph.add_edge(START, "supervisor")

    # Supervisor → Conditional routing (LLM decides where to go)
    graph.add_conditional_edges(
        "supervisor",
        _route_from_supervisor,
        {
            "plan_route": "plan_route",
            "get_weather": "get_weather",
            "generate_itinerary": "generate_itinerary",
            "find_events": "find_events",
            "calculate_budget": "calculate_budget",
            "review_plan": "review_plan",
            "finish": "finish",
        },
    )

    # Every agent node → back to Supervisor for next decision
    graph.add_edge("plan_route", "supervisor")
    graph.add_edge("get_weather", "supervisor")
    graph.add_edge("generate_itinerary", "supervisor")
    graph.add_edge("find_events", "supervisor")
    graph.add_edge("calculate_budget", "supervisor")
    graph.add_edge("review_plan", "supervisor")  # Critic → Supervisor → (maybe re-plan)

    # Finish → END
    graph.add_edge("finish", END)

    return graph.compile()


# Module-level singleton — compile once, reuse
_compiled_graph = None


def get_travel_graph():
    """Get or build the compiled travel planning graph (singleton)."""
    global _compiled_graph
    if _compiled_graph is None:
        print("  [Graph] Compiling LangGraph travel planning pipeline...")
        _compiled_graph = build_travel_graph()
        print("  [Graph] Pipeline ready.")
    return _compiled_graph


def plan_trip(
    trip_id: str,
    client_sid: str,
    start_city: str,
    end_city: str,
    num_days: int = 3,
    transport_mode: str = "train_flight",
    adults: int = 1,
    start_date: str = "",
    end_date: str = "",
    user_preferences: str = "",
    on_status_update=None,
) -> TripState:
    """
    High-level API: Plan a complete trip using the LangGraph pipeline.

    This is the main entry point called by the RabbitMQ bridge.

    Args:
        trip_id: Unique trip identifier
        client_sid: Socket.IO session ID for real-time updates
        start_city: Origin city
        end_city: Destination city
        num_days: Number of days for the trip
        transport_mode: "driving" or "train_flight"
        adults: Number of adult travelers
        start_date: ISO date string for trip start
        end_date: ISO date string for trip end
        user_preferences: Free-text user preferences
        on_status_update: Optional callback for streaming status messages

    Returns:
        Complete TripState with all agent results
    """
    import uuid

    graph = get_travel_graph()

    initial_state: TripState = {
        "trip_id": trip_id,
        "client_sid": client_sid,
        "start_city": start_city,
        "end_city": end_city,
        "num_days": num_days,
        "transport_mode": transport_mode,
        "adults": adults,
        "start_date": start_date,
        "end_date": end_date,
        "user_preferences": user_preferences or "general sightseeing and local cuisine",
        "route": [],
        "weather_data": [],
        "route_with_weather": [],
        "itinerary": [],
        "events": {},
        "budget": None,
        "retrieved_context": "",
        "next_agent": "",
        "completed_agents": [],
        "status": "pending",
        "status_messages": [],
        "critique": "",
        "revision_count": 0,
        "error": None,
        "trace_id": str(uuid.uuid4()),
        "token_usage": {},
    }

    print(f"\n  [Graph] Starting trip planning: {start_city} → {end_city} ({num_days} days)")

    try:
        result = initial_state.copy()
        for event in graph.stream(initial_state, stream_mode="updates"):
            for node_name, node_update in event.items():
                if isinstance(node_update, dict):
                    # Reducer merge logic
                    for key, value in node_update.items():
                        if key in ["status_messages", "completed_agents"]:
                            result[key] = result.get(key, []) + value
                        elif key == "events" and isinstance(value, dict):
                            if not isinstance(result.get("events"), dict):
                                result["events"] = {}
                            for day, events_list in value.items():
                                result["events"][day] = result["events"].get(day, []) + events_list
                        else:
                            result[key] = value
                    
                    # Fire status update callback
                    if "status_messages" in node_update and on_status_update:
                        for msg in node_update["status_messages"]:
                            on_status_update(msg)

        if result.get("status") == "pending":
            result["status"] = "completed"

        print(f"  [Graph] Trip planning complete. Status: {result.get('status')}")
        return result

    except Exception as e:
        print(f"  [Graph] Pipeline error: {e}")
        initial_state["status"] = "error"
        initial_state["error"] = str(e)
        return initial_state
