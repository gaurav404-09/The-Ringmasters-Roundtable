"""
Structured tracing and observability for the AI travel planning pipeline.

Why this matters for interviews:
  "How do you debug an agentic system in production?"
  This module provides the answer: structured traces, latency tracking,
  and a decision audit log for every trip planning run.

Features:
  - Trace every agent execution with timing
  - Log supervisor routing decisions
  - Track token usage and costs
  - Export traces as JSON for analysis
  - Optional LangSmith integration for hosted tracing
"""

import json
import os
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from config import TRACE_LOG_DIR, ENABLE_TRACING, LANGSMITH_API_KEY


# ── Ensure log directory exists ──────────────────────────────────────
os.makedirs(TRACE_LOG_DIR, exist_ok=True)


class TripTrace:
    """
    A structured trace for a single trip planning run.

    Captures:
      - Overall timing (start, end, duration)
      - Per-agent execution records (node, duration, status)
      - Supervisor routing decisions
      - Token usage
      - Errors
    """

    def __init__(self, trip_id: str, start_city: str, end_city: str):
        self.trace_id = str(uuid.uuid4())
        self.trip_id = trip_id
        self.start_city = start_city
        self.end_city = end_city
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.ended_at = None
        self.duration_ms = 0
        self.events: list[dict] = []
        self.agent_timings: dict[str, float] = {}
        self.token_usage = {"prompt_tokens": 0, "completion_tokens": 0}
        self.status = "in_progress"
        self._start_time = time.time()
        
        from observability.cost_tracker import CostTracker
        self.cost_tracker = CostTracker(trip_id)

    def log(self, event_type: str, data: dict = None):
        """Add an event to the trace timeline."""
        self.events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "elapsed_ms": int((time.time() - self._start_time) * 1000),
            "type": event_type,
            "data": data or {},
        })

    def record_agent_timing(self, agent: str, duration_ms: float):
        """Record how long an agent took to execute."""
        self.agent_timings[agent] = duration_ms

    def add_token_usage(self, prompt: int = 0, completion: int = 0):
        """Accumulate token usage across all LLM calls."""
        self.token_usage["prompt_tokens"] += prompt
        self.token_usage["completion_tokens"] += completion

    def add_llm_tokens(self, model: str, agent: str, prompt: int = 0, completion: int = 0):
        """Accumulate token usage across all LLM calls and log to cost tracker."""
        self.add_token_usage(prompt, completion)
        self.cost_tracker.record(model, agent, prompt, completion)

    def record_search_unit(self, model: str, agent: str):
        """Record a search/rerank API call in the cost tracker."""
        self.cost_tracker.record(model, agent, 0, 0)

    def complete(self, status: str = "completed"):
        """Mark the trace as finished."""
        self.ended_at = datetime.now(timezone.utc).isoformat()
        self.duration_ms = int((time.time() - self._start_time) * 1000)
        self.status = status

    def to_dict(self) -> dict:
        """Export trace as a JSON-serializable dict."""
        return {
            "trace_id": self.trace_id,
            "trip_id": self.trip_id,
            "route": f"{self.start_city} → {self.end_city}",
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "duration_ms": self.duration_ms,
            "status": self.status,
            "agent_timings": self.agent_timings,
            "token_usage": self.token_usage,
            "total_tokens": sum(self.token_usage.values()),
            "events_count": len(self.events),
            "events": self.events,
            "estimated_cost_usd": self.cost_tracker.summary().get("estimated_total_cost_usd", 0.0),
        }

    def save(self):
        """Persist the trace and cost data to JSON files."""
        if not ENABLE_TRACING:
            return

        filename = f"trace_{self.trip_id[:8]}_{int(time.time())}.json"
        filepath = os.path.join(TRACE_LOG_DIR, filename)

        with open(filepath, "w") as f:
            json.dump(self.to_dict(), f, indent=2, default=str)

        print(f"  [Tracer] Trace saved: {filepath}")
        
        # Save cost summary as well
        try:
            self.cost_tracker.save()
            self.cost_tracker.print_summary()
        except Exception as e:
            print(f"  [Tracer] Failed to save cost summary: {e}")


# ── Module-level current trace ────────────────────────────────────────
_current_trace: TripTrace | None = None


def get_current_trace() -> TripTrace | None:
    """Get the active trace for the current trip planning run."""
    return _current_trace


@contextmanager
def trace_trip_planning(trip_id: str, start_city: str, end_city: str):
    """
    Context manager that wraps a full trip planning pipeline.

    Usage:
        with trace_trip_planning(trip_id, "Delhi", "Jaipur"):
            result = plan_trip(...)
    """
    global _current_trace

    if not ENABLE_TRACING:
        yield
        return

    trace = TripTrace(trip_id, start_city, end_city)
    _current_trace = trace
    trace.log("pipeline_start", {"start_city": start_city, "end_city": end_city})

    try:
        yield trace
        if trace.status == "in_progress":
            trace.complete("completed")
        else:
            trace.complete(trace.status)
    except Exception as e:
        trace.log("pipeline_error", {"error": str(e)})
        trace.complete("error")
        raise
    finally:
        trace.save()
        _current_trace = None

        # Print a summary
        print(f"\n  {'='*60}")
        print(f"  📊 TRACE SUMMARY — Trip {trip_id[:8]}")
        print(f"  {'='*60}")
        print(f"  Route: {start_city} → {end_city}")
        print(f"  Duration: {trace.duration_ms}ms ({trace.duration_ms / 1000:.1f}s)")
        print(f"  Status: {trace.status}")
        print(f"  Tokens: {sum(trace.token_usage.values())}")
        if trace.agent_timings:
            print(f"  Agent timings:")
            for agent, ms in sorted(trace.agent_timings.items()):
                print(f"    {agent}: {ms:.0f}ms")
        print(f"  Events: {len(trace.events)}")
        print(f"  {'='*60}\n")


def log_event(trip_id: str, event_type: str, data: dict = None):
    """Log an event to the current trace (if active) and to console."""
    trace = get_current_trace()
    if trace and trace.trip_id == trip_id:
        trace.log(event_type, data)

    if ENABLE_TRACING:
        print(f"  [Trace] [{trip_id[:8]}] {event_type}: {json.dumps(data or {}, default=str)}")


def setup_langsmith():
    """
    Configure LangSmith tracing if API key is available.

    LangSmith provides hosted tracing with a beautiful UI for
    inspecting LLM calls, chain executions, and agent decisions.
    Free tier: 5,000 traces/month.

    Set LANGSMITH_API_KEY and LANGSMITH_PROJECT in .env to enable.
    """
    if not LANGSMITH_API_KEY:
        return False

    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = LANGSMITH_API_KEY

    from config import LANGSMITH_PROJECT
    os.environ["LANGCHAIN_PROJECT"] = LANGSMITH_PROJECT

    print(f"  [Tracer] LangSmith tracing enabled (project: {LANGSMITH_PROJECT})")
    return True
