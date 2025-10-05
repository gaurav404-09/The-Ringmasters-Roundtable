# orchestrator_mcp.py
# This is the main backend service. It continuously listens for trip requests
# from the Node.js server and orchestrates the agent workflow.
import pika
import json
import uuid
import threading
import time

class Orchestrator:
    def __init__(self):
        self.publish_connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
        self.publish_channel = self.publish_connection.channel()
        self.trip_states = {}

        # Declare all queues the system needs
        queues_to_declare = [
            'trip_requests_queue', 'trip_status_queue', 'trip_results_queue',
            'map_queue', 'weather_queue', 'itinerary_queue', 'event_queue'
        ]
        for q in queues_to_declare:
            self.publish_channel.queue_declare(queue=q, durable=True)
            
        print(" [Orchestrator] All queues declared.")

    def _ensure_connection(self):
        """Ensure we have a valid connection and channel."""
        try:
            if not hasattr(self, 'publish_connection') or self.publish_connection.is_closed:
                self.publish_connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
                self.publish_channel = self.publish_connection.channel()
                # Re-declare queues
                queues_to_declare = [
                    'trip_requests_queue', 'trip_status_queue', 'trip_results_queue',
                    'map_queue', 'weather_queue', 'itinerary_queue', 'event_queue'
                ]
                for q in queues_to_declare:
                    self.publish_channel.queue_declare(queue=q, durable=True)
            return True
        except Exception as e:
            print(f" [Orchestrator] Error ensuring connection: {e}")
            return False

    def send_status_update(self, trip_id, message):
        """Sends a log message back to the Node.js server for a specific trip."""
        try:
            state = self.trip_states.get(trip_id)
            if not state or 'client_sid' not in state:
                return

            print(f" [Orchestrator] [Trip: {trip_id[:6]}] Status: {message}")
            status_message = {
                "trip_id": trip_id,
                "client_sid": state['client_sid'],
                "message": message
            }
            
            if not self._ensure_connection():
                print(" [Orchestrator] Failed to establish connection for status update")
                return
                
            self.publish_channel.basic_publish(
                exchange='',
                routing_key='trip_status_queue',
                body=json.dumps(status_message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # make message persistent
                )
            )
        except Exception as e:
            print(f" [Orchestrator] Error in send_status_update: {e}")

    def send_final_result(self, trip_id):
        """Sends the complete, final trip plan back to the Node.js server."""
        state = self.trip_states.get(trip_id)
        if not state or state.get("status") != "COMPLETED":
            return

        print(f" [Orchestrator] [Trip: {trip_id[:6]}] Sending final result to server.")
        final_result = {
            "trip_id": trip_id,
            "itinerary": state.get("itinerary", []),
            "events": state.get("events", {})
        }
        self.publish_channel.basic_publish(
            exchange='',
            routing_key='trip_results_queue',
            body=json.dumps(final_result)
        )
        # Clean up the state for this completed trip
        del self.trip_states[trip_id]

    def on_response(self, ch, method, props, body):
        """Callback for when agents send their results back."""
        try:
            message = json.loads(body)
            trip_id = message.get("trip_id")
            intent = message.get("intent")
            payload = message.get("payload")

            if trip_id not in self.trip_states:
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            if intent == "RouteCalculated":
                self.trip_states[trip_id]["route"] = payload.get("route")
                self.request_weather(trip_id, payload.get("route"))

            elif intent == "WeatherForRouteProvided":
                route_data = self.trip_states[trip_id]["route"]
                weather_data = payload.get("weather_data", [])
                city_weather_map = {item['city']: item['weather'] for item in weather_data}
                route_with_weather = []
                for stop in route_data:
                    stop['weather'] = city_weather_map.get(stop['city'], {})
                    route_with_weather.append(stop)
                self.trip_states[trip_id]["route_with_weather"] = route_with_weather
                self.request_itinerary(trip_id, route_with_weather)

            elif intent == "ItineraryGenerated":
                self.trip_states[trip_id]["itinerary"] = payload.get("itinerary")
                cities = [day['city'] for day in payload.get("itinerary", [])]
                self.request_events(trip_id, cities)

            elif intent == "EventsFound":
                self.trip_states[trip_id]["events"] = payload.get("events_by_city")
                self.trip_states[trip_id]["status"] = "COMPLETED"
                self.send_status_update(trip_id, "Trip plan is complete! Sending result...")
                self.send_final_result(trip_id)

        except Exception as e:
            print(f" [Orchestrator] Error processing agent response: {e}")
        finally:
            ch.basic_ack(delivery_tag=method.delivery_tag)
            
    def request_weather(self, trip_id, route):
        self.send_status_update(trip_id, "Contacting Weather Agent for forecasts...")
        message = { "trip_id": trip_id, "intent": "GetWeatherForRoute", "payload": {"route": route} }
        self.publish_channel.basic_publish(exchange='', routing_key='weather_queue', body=json.dumps(message))

    def request_itinerary(self, trip_id, route_with_weather):
        self.send_status_update(trip_id, "Contacting Itinerary Agent to build activities...")
        message = { "trip_id": trip_id, "intent": "GenerateItinerary", "payload": {"route_with_weather": route_with_weather} }
        self.publish_channel.basic_publish(exchange='', routing_key='itinerary_queue', body=json.dumps(message))

    def request_events(self, trip_id, cities):
        self.send_status_update(trip_id, "Contacting Event Agent for local events...")
        unique_cities = list(dict.fromkeys(cities))
        message = { "trip_id": trip_id, "intent": "FindEvents", "payload": {"cities": unique_cities} }
        self.publish_channel.basic_publish(exchange='', routing_key='event_queue', body=json.dumps(message))

    def start_trip_planning(self, trip_id, client_sid, payload):
        """The main workflow for a single trip request."""
        self.trip_states[trip_id] = {"status": "PENDING", "client_sid": client_sid}
        
        start_city = payload.get("start_city")
        end_city = payload.get("end_city")
        num_days = payload.get("num_days")

        self.send_status_update(trip_id, f"Planning new trip from {start_city} to {end_city}.")
        self.send_status_update(trip_id, "Contacting Map Agent for route...")

        message = {
            "trip_id": trip_id,
            "intent": "CalculateRoute",
            "payload": {
                "start_city": start_city,
                "end_city": end_city,
                "num_days": num_days
            }
        }
        self.publish_channel.basic_publish(exchange='', routing_key='map_queue', body=json.dumps(message))

    def on_trip_request(self, ch, method, props, body):
        """Callback for when a NEW trip request comes from the server.js."""
        try:
            message = json.loads(body)
            trip_id = message.get("trip_id")
            client_sid = message.get("client_sid")
            payload = message.get("payload")
            print(f"\n [Orchestrator] Received new trip request from website: {trip_id}")

            # Start the complex orchestration in a separate thread
            # so the listener can immediately be ready for another request.
            thread = threading.Thread(target=self.start_trip_planning, args=(trip_id, client_sid, payload))
            thread.daemon = True
            thread.start()

        except Exception as e:
            print(f" [Orchestrator] Error processing new trip request: {e}")
        finally:
            ch.basic_ack(delivery_tag=method.delivery_tag)
    
    def start_listening(self):
        """Starts the main listeners for this service."""
        # A separate connection for consuming to avoid thread issues
        consume_connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
        consume_channel = consume_connection.channel()

        # Listener for agent RESPONSES
        consume_channel.queue_declare(queue='orchestrator_queue', durable=True)
        consume_channel.basic_consume(queue='orchestrator_queue', on_message_callback=self.on_response)

        # Listener for NEW trip REQUESTS from the website
        consume_channel.queue_declare(queue='trip_requests_queue', durable=True)
        consume_channel.basic_consume(queue='trip_requests_queue', on_message_callback=self.on_trip_request)

        print(" [Orchestrator] Service is running. Listening for new trip requests and agent responses...")
        try:
            consume_channel.start_consuming()
        except KeyboardInterrupt:
            print(" [Orchestrator] Shutting down.")
            consume_connection.close()
            self.publish_connection.close()

if __name__ == "__main__":
    orchestrator = Orchestrator()
    orchestrator.start_listening()
