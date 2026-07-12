"""
RAG evaluation framework (LLM-as-a-judge).

Evaluates:
  1. Faithfulness: Is the generated itinerary grounded in the retrieved context?
  2. Answer Relevancy: Does the itinerary address the user's preferences?
"""

import json
import os
import time
from datetime import datetime, timezone
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

from config import GROQ_API_KEY, GROQ_MODEL_FAST, TRACE_LOG_DIR

FAITHFULNESS_PROMPT = """You are an AI quality evaluator. Your task is to check if the Generated Itinerary is FAITHFUL to the Retrieved Destination Knowledge (context).

RULES:
- A faithful itinerary only recommends attractions, restaurants, and zones that are mentioned in the retrieved context.
- If the itinerary makes up prices, names, or locations NOT present in the retrieved context, it is not faithful (low score).
- Score from 1 to 5 (1 = completely hallucinated, 5 = perfectly faithful to context).

RETRIEVED KNOWLEDGE CONTEXT:
{context}

GENERATED ITINERARY:
{itinerary}

Respond in ONLY valid JSON:
{{
  "score": 1-5,
  "reasoning": "brief explanation of potential discrepancies or perfect alignment"
}}"""

RELEVANCY_PROMPT = """You are an AI quality evaluator. Your task is to evaluate how RELEVANT the Generated Itinerary is to the User's Preferences.

RULES:
- If the user prefers "local food" and the itinerary has rich food recommendations, relevance is high.
- If the itinerary completely ignores user preferences, relevance is low.
- Score from 1 to 5 (1 = completely irrelevant, 5 = perfectly relevant).

USER PREFERENCES:
{preferences}

GENERATED ITINERARY:
{itinerary}

Respond in ONLY valid JSON:
{{
  "score": 1-5,
  "reasoning": "brief explanation of why the plan is relevant or where it fails"
}}"""


class RAGEvaluator:
    """Evaluates RAG generation using Llama 3.1 8b on Groq."""

    def __init__(self, trip_id: str):
        self.trip_id = trip_id

    def evaluate_trip(
        self,
        context: str,
        itinerary: list,
        preferences: str,
    ) -> dict:
        """Run evaluation for a completed trip plan."""
        if not context or not itinerary:
            return {
                "status": "skipped",
                "reason": "Missing context or itinerary data",
            }

        itinerary_str = json.dumps(itinerary, indent=2)
        
        faithfulness = self._evaluate_metric(
            system_prompt=FAITHFULNESS_PROMPT,
            inputs={"context": context, "itinerary": itinerary_str},
        )
        
        relevancy = self._evaluate_metric(
            system_prompt=RELEVANCY_PROMPT,
            inputs={"preferences": preferences, "itinerary": itinerary_str},
        )

        evaluation = {
            "trip_id": self.trip_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "faithfulness": faithfulness,
            "relevancy": relevancy,
            "average_score": round(
                (faithfulness.get("score", 3) + relevancy.get("score", 3)) / 2, 2
            ),
        }

        self._save_evaluation(evaluation)
        return evaluation

    def _evaluate_metric(self, system_prompt: str, inputs: dict) -> dict:
        """Evaluate a single metric via Groq LLM."""
        try:
            llm = ChatGroq(
                api_key=GROQ_API_KEY,
                model=GROQ_MODEL_FAST,
                temperature=0,
                max_tokens=256,
            )
            prompt = ChatPromptTemplate.from_messages([("system", system_prompt)])
            chain = prompt | llm
            response = chain.invoke(inputs)

            # Parse response
            text = response.content.strip()
            text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            
            result = json.loads(text)
            if isinstance(result, dict) and "score" in result:
                return result
                
        except Exception as e:
            print(f"  [RAG Evaluator] LLM evaluation error: {e}")
            
        return {"score": 3, "reasoning": "Evaluation failed or returned invalid JSON"}

    def _save_evaluation(self, data: dict):
        """Save evaluation results to file."""
        os.makedirs(TRACE_LOG_DIR, exist_ok=True)
        filepath = os.path.join(
            TRACE_LOG_DIR,
            f"eval_{self.trip_id[:8]}_{int(time.time())}.json",
        )
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
        print(f"  [RAG Evaluator] Saved evaluation: {filepath}")
