# map_agent_mcp.py
import pika
import json
import time
from map_agent import MapAgent # We reuse your existing class

def on_request(ch, method, props, body):
    """Callback function to handle incoming messages."""
    message = json.loads(body)
    trip_id = message.get("trip_id")
    intent = message.get("intent")
    payload = message.get("payload")

    print(f" [MapAgent] Received request for trip '{trip_id}' with intent '{intent}'")

    if intent == "CalculateRoute":
        try:
            map_agent = MapAgent()
            start_city = payload.get("start_city")
            end_city = payload.get("end_city")
            num_days = payload.get("num_days")

            # Perform the core logic
            intermediate_points = map_agent.get_intermediate_cities(start_city, end_city, num_days)

            # Prepare the response message
            response_message = {
                "trip_id": trip_id,
                "intent": "RouteCalculated",
                "payload": {
                    "route": intermediate_points
                }
            }

            # Send the response back to the orchestrator
            ch.basic_publish(
                exchange='',
                routing_key='orchestrator_queue',
                properties=pika.BasicProperties(correlation_id=props.correlation_id),
                body=json.dumps(response_message)
            )
            print(f" [MapAgent] Sent route for trip '{trip_id}' back to orchestrator.")

        except Exception as e:
            print(f" [MapAgent] Error processing route: {e}")
            # Optionally, send an error message back

    ch.basic_ack(delivery_tag=method.delivery_tag)

def start_agent():
    """Starts the MapAgent, connects to RabbitMQ, and listens for commands."""
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
            channel = connection.channel()

            # Declare the queue this agent will listen to
            channel.queue_declare(queue='map_queue', durable=True)
            # Declare the queue it will respond to
            channel.queue_declare(queue='orchestrator_queue', durable=True)

            print(' [MapAgent] Awaiting requests. To exit press CTRL+C')
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue='map_queue', on_message_callback=on_request)
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError:
            print(" [MapAgent] Connection to RabbitMQ failed. Retrying in 5 seconds...")
            time.sleep(5)
        except KeyboardInterrupt:
            print(" [MapAgent] Shutting down.")
            break

if __name__ == '__main__':
    start_agent()
