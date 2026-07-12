"""
LangGraph Orchestrator — bridges RabbitMQ (Node.js backend) to LangGraph.

This replaces the old orchestrator_mcp.py and ALL individual agent consumers.
Instead of 6 separate Python processes communicating via RabbitMQ queues,
we now run a SINGLE process that:

  1. Listens on RabbitMQ for trip requests from the Node.js server
  2. Invokes the LangGraph pipeline (which handles all agent coordination)
  3. Streams status updates back to RabbitMQ as the graph progresses
  4. Sends the final result back when complete

Benefits over the old architecture:
  - Single process instead of 6 (simpler deployment)
  - LLM-driven routing instead of hardcoded message passing
  - RAG-powered itinerary generation
  - Critic reflection loop for quality assurance
  - Full observability via state tracking
"""

import json
import threading
import pika

from config import RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_URL
from graph import plan_trip
from observability.tracer import trace_trip_planning, log_event


class LangGraphOrchestrator:
    """
    Main entry point for the AI travel planning system.

    Listens on RabbitMQ `trip_requests_queue` for incoming trip requests
    from the Node.js backend, processes them through the LangGraph pipeline,
    and returns results via `trip_results_queue` with status updates via
    `trip_status_queue`.
    """

    def __init__(self):
        if RABBITMQ_URL:
            self.connection_params = pika.URLParameters(RABBITMQ_URL)
        else:
            self.connection_params = pika.ConnectionParameters(
                host=RABBITMQ_HOST, port=RABBITMQ_PORT
            )

        # Publishing connection (for sending results/status)
        self.pub_connection = pika.BlockingConnection(self.connection_params)
        self.pub_channel = self.pub_connection.channel()

        # Declare all queues
        for queue in [
            "trip_requests_queue",
            "trip_status_queue",
            "trip_results_queue",
            "chat_requests_queue",
            "chat_responses_queue",
        ]:
            self.pub_channel.queue_declare(queue=queue, durable=True)

        print(" [LangGraph Orchestrator] Connected to RabbitMQ. Queues declared.")

    def _ensure_pub_connection(self):
        """Ensure the publishing connection is alive."""
        try:
            if self.pub_connection.is_closed:
                self.pub_connection = pika.BlockingConnection(self.connection_params)
                self.pub_channel = self.pub_connection.channel()
                for queue in [
                    "trip_requests_queue",
                    "trip_status_queue",
                    "trip_results_queue",
                    "chat_requests_queue",
                    "chat_responses_queue",
                ]:
                    self.pub_channel.queue_declare(queue=queue, durable=True)
        except Exception as e:
            print(f" [Orchestrator] Reconnection error: {e}")

    def send_status(self, trip_id: str, client_sid: str, message: str):
        """Send a status update back to the Node.js server."""
        try:
            self._ensure_pub_connection()
            status_msg = {
                "trip_id": trip_id,
                "client_sid": client_sid,
                "message": message,
            }
            self.pub_channel.basic_publish(
                exchange="",
                routing_key="trip_status_queue",
                body=json.dumps(status_msg),
                properties=pika.BasicProperties(delivery_mode=2),
            )
        except Exception as e:
            print(f" [Orchestrator] Status send error: {e}")

    def send_result(self, trip_id: str, client_sid: str, result: dict):
        """Send the final trip result back to the Node.js server."""
        try:
            self._ensure_pub_connection()
            final_result = {
                "trip_id": trip_id,
                "client_sid": client_sid,
                "start_city": result.get("start_city", ""),
                "end_city": result.get("end_city", ""),
                "start_date": result.get("start_date", ""),
                "end_date": result.get("end_date", ""),
                "num_days": result.get("num_days", 3),
                "itinerary": result.get("itinerary", []),
                "events": result.get("events", {}),
                "budget": result.get("budget"),
                "transport_mode": result.get("transport_mode", "train_flight"),
            }
            self.pub_channel.basic_publish(
                exchange="",
                routing_key="trip_results_queue",
                body=json.dumps(final_result),
            )
            print(f" [Orchestrator] Final result sent for trip {trip_id[:8]}")
        except Exception as e:
            print(f" [Orchestrator] Result send error: {e}")

    def process_trip_request(self, trip_id: str, client_sid: str, payload: dict):
        """
        Process a single trip request through the LangGraph pipeline.

        This runs in a separate thread to not block the RabbitMQ consumer.
        """
        start_city = payload.get("start_city", "")
        end_city = payload.get("end_city", "")
        num_days = payload.get("num_days", 3)
        transport_mode = payload.get("transport_mode", "train_flight")
        adults = payload.get("adults") or payload.get("travellers") or 1

        self.send_status(trip_id, client_sid, f"🚀 Starting AI-powered trip planning: {start_city} → {end_city}")

        # Run the LangGraph pipeline
        with trace_trip_planning(trip_id, start_city, end_city) as trace:
            result = plan_trip(
                trip_id=trip_id,
                client_sid=client_sid,
                start_city=start_city,
                end_city=end_city,
                num_days=num_days,
                transport_mode=transport_mode,
                adults=adults,
                start_date=payload.get("start_date", ""),
                end_date=payload.get("end_date", ""),
                user_preferences=payload.get("preferences", ""),
                on_status_update=lambda msg: self.send_status(trip_id, client_sid, msg),
            )
            if trace and isinstance(result, dict) and result.get("status") == "error":
                trace.status = "error"

        # Send final result
        if result.get("status") == "completed":
            self.send_status(trip_id, client_sid, "🎉 Trip plan is complete! Sending result...")
            self.send_result(trip_id, client_sid, result)
            log_event(trip_id, "trip_completed", {
                "days": len(result.get("itinerary", [])),
                "events": sum(len(v) if isinstance(v, list) else 0 for v in result.get("events", {}).values()),
                "has_budget": result.get("budget") is not None,
            })
            
            # Trigger RAG evaluation
            try:
                from observability.evaluator import RAGEvaluator
                evaluator = RAGEvaluator(trip_id)
                evaluator.evaluate_trip(
                    context=result.get("retrieved_context", ""),
                    itinerary=result.get("itinerary", []),
                    preferences=payload.get("preferences", "")
                )
            except Exception as eval_err:
                print(f"  [Orchestrator] Evaluation failed to run: {eval_err}")
        else:
            error = result.get("error", "Unknown error")
            self.send_status(trip_id, client_sid, f"❌ Trip planning failed: {error}")
            log_event(trip_id, "trip_failed", {"error": error})

    def on_trip_request(self, ch, method, props, body):
        """RabbitMQ callback for incoming trip requests from Node.js server."""
        try:
            message = json.loads(body)
            trip_id = message.get("trip_id", "unknown")
            client_sid = message.get("client_sid", "")
            payload = message.get("payload", {})

            print(f"\n [Orchestrator] Received trip request: {trip_id}")

            # Process in a thread to not block the consumer
            thread = threading.Thread(
                target=self.process_trip_request,
                args=(trip_id, client_sid, payload),
                daemon=True,
            )
            thread.start()

        except Exception as e:
            print(f" [Orchestrator] Error processing request: {e}")
        finally:
            ch.basic_ack(delivery_tag=method.delivery_tag)

    def process_chat_request(self, client_sid: str, text: str):
        from agents.chat_agent import process_chat_message
        import uuid
        
        reply, trigger_payload = process_chat_message(client_sid, text)
        
        # Send reply back to RabbitMQ
        self._ensure_pub_connection()
        response_msg = {
            "client_sid": client_sid,
            "message": reply,
        }
        self.pub_channel.basic_publish(
            exchange="",
            routing_key="chat_responses_queue",
            body=json.dumps(response_msg),
        )
        
        # If the ChatAgent collected all parameters, trigger a trip plan!
        if trigger_payload:
            trip_id = str(uuid.uuid4())
            self.send_status(trip_id, client_sid, "🤖 I have all the details! Handing off to the orchestrator...")
            
            thread = threading.Thread(
                target=self.process_trip_request,
                args=(trip_id, client_sid, trigger_payload),
                daemon=True,
            )
            thread.start()

    def on_chat_request(self, ch, method, props, body):
        try:
            message = json.loads(body)
            client_sid = message.get("client_sid", "")
            text = message.get("text", "")
            
            if client_sid and text:
                thread = threading.Thread(
                    target=self.process_chat_request,
                    args=(client_sid, text),
                    daemon=True,
                )
                thread.start()
        except Exception as e:
            print(f" [Orchestrator] Error processing chat request: {e}")
        finally:
            ch.basic_ack(delivery_tag=method.delivery_tag)

    def start(self):
        """Start listening for trip requests on RabbitMQ."""
        # Separate connection for consuming (thread safety)
        consume_conn = pika.BlockingConnection(self.connection_params)
        consume_ch = consume_conn.channel()

        consume_ch.queue_declare(queue="trip_requests_queue", durable=True)
        consume_ch.basic_qos(prefetch_count=1)
        consume_ch.basic_consume(
            queue="trip_requests_queue",
            on_message_callback=self.on_trip_request,
        )

        consume_ch.queue_declare(queue="chat_requests_queue", durable=True)
        consume_ch.basic_consume(
            queue="chat_requests_queue",
            on_message_callback=self.on_chat_request,
        )

        print(" [LangGraph Orchestrator] ✅ Ready. Listening for trip requests...")
        print(" [LangGraph Orchestrator] Press CTRL+C to stop.\n")

        try:
            consume_ch.start_consuming()
        except KeyboardInterrupt:
            print("\n [Orchestrator] Shutting down gracefully...")
            consume_conn.close()
            self.pub_connection.close()


def start_health_server():
    import os
    from http.server import BaseHTTPRequestHandler, HTTPServer
    
    class HealthHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
            
        def log_message(self, format, *args):
            return

    port = int(os.getenv("PORT", "10000"))
    try:
        server = HTTPServer(("0.0.0.0", port), HealthHandler)
        print(f" [Health Server] ✅ Listening on port {port} for Render health checks...")
        server.serve_forever()
    except Exception as e:
        print(f" [Health Server] ⚠️ Failed to start: {e}")


if __name__ == "__main__":
    import threading
    health_thread = threading.Thread(target=start_health_server, daemon=True)
    health_thread.start()

    orchestrator = LangGraphOrchestrator()
    orchestrator.start()
