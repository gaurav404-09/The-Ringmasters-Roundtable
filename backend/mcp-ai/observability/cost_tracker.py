"""
Token and cost tracker for LLM API usage.

Tracks token consumption across all LLM calls (Groq, Cohere)
to help monitor costs and optimize prompts.

Groq (Llama 3.1) is free, but tracking helps:
  - Identify wasteful prompts
  - Estimate costs if switching to paid models
  - Understand which agents consume the most tokens
  - Prepare for scale (rate limit awareness)
"""

import json
import os
import time
from datetime import datetime, timezone
from threading import Lock

from config import TRACE_LOG_DIR

# Pricing per 1M tokens (for cost estimation if using paid models)
PRICING = {
    "llama-3.1-70b-versatile": {"input": 0.59, "output": 0.79},
    "llama-3.1-8b-instant": {"input": 0.05, "output": 0.08},
    "command-a-03-2025": {"input": 2.50, "output": 10.00},
    "rerank-v3.5": {"per_search": 0.002},
}


class CostTracker:
    """Thread-safe token/cost tracker for a single trip planning run."""

    def __init__(self, trip_id: str):
        self.trip_id = trip_id
        self.records: list[dict] = []
        self._lock = Lock()

    def record(
        self,
        model: str,
        agent: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
    ):
        """Record a single LLM call."""
        pricing = PRICING.get(model, {"input": 0, "output": 0})
        if "per_search" in pricing:
            input_cost = pricing["per_search"]
            output_cost = 0.0
        else:
            input_cost = (prompt_tokens / 1_000_000) * pricing.get("input", 0)
            output_cost = (completion_tokens / 1_000_000) * pricing.get("output", 0)

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": model,
            "agent": agent,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "estimated_cost_usd": round(input_cost + output_cost, 6),
        }

        with self._lock:
            self.records.append(entry)

    def summary(self) -> dict:
        """Generate a cost summary for the trip."""
        with self._lock:
            total_prompt = sum(r["prompt_tokens"] for r in self.records)
            total_completion = sum(r["completion_tokens"] for r in self.records)
            total_cost = sum(r["estimated_cost_usd"] for r in self.records)

            by_agent = {}
            for r in self.records:
                agent = r["agent"]
                if agent not in by_agent:
                    by_agent[agent] = {"tokens": 0, "cost_usd": 0, "calls": 0}
                by_agent[agent]["tokens"] += r["total_tokens"]
                by_agent[agent]["cost_usd"] += r["estimated_cost_usd"]
                by_agent[agent]["calls"] += 1

            return {
                "trip_id": self.trip_id,
                "total_llm_calls": len(self.records),
                "total_prompt_tokens": total_prompt,
                "total_completion_tokens": total_completion,
                "total_tokens": total_prompt + total_completion,
                "estimated_total_cost_usd": round(total_cost, 6),
                "by_agent": by_agent,
                "note": "Groq Llama 3.1 is free. Costs shown are estimates for paid model equivalents.",
            }

    def save(self):
        """Persist cost data to file."""
        os.makedirs(TRACE_LOG_DIR, exist_ok=True)
        filepath = os.path.join(
            TRACE_LOG_DIR,
            f"costs_{self.trip_id[:8]}_{int(time.time())}.json",
        )
        with open(filepath, "w") as f:
            json.dump(self.summary(), f, indent=2)

    def print_summary(self):
        """Print a formatted cost summary."""
        s = self.summary()
        print(f"\n  💰 COST SUMMARY — Trip {self.trip_id[:8]}")
        print(f"  LLM calls: {s['total_llm_calls']}")
        print(f"  Tokens: {s['total_tokens']:,} (prompt: {s['total_prompt_tokens']:,}, completion: {s['total_completion_tokens']:,})")
        print(f"  Est. cost (if paid): ${s['estimated_total_cost_usd']:.4f}")
        for agent, data in s["by_agent"].items():
            print(f"    {agent}: {data['tokens']:,} tokens, {data['calls']} calls")
