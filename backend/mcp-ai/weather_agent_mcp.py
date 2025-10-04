# weather_agent_mcp.py
import pika
import json
import time
from weather_agent import WeatherAgent # We reuse your existing class

# This should be loaded from a config file or environment variable in a real app
OPENWEATHER_API_KEY = "144f40803196f5205a5d86fa652a4720"

def on_request(ch, method, props, body):
    """Callback function to handle incoming messages."""
    message = json.loads(body)
    trip_id = message.get("trip_id")
    intent = message.get("intent")
    payload = message.get("payload")

    print(f" [WeatherAgent] Received request for trip '{trip_id}' with intent '{intent}'")

    if intent == "GetWeatherForRoute":
        try:
            weather_agent = WeatherAgent(OPENWEATHER_API_KEY)
            route = payload.get("route", [])
            weather_results = []

            for point in route:
                lat, lon = map(float, point["coord"].split(","))
                # Re-using the logic from your original orchestrator
                weather_data = weather_agent.get_weather(lat, lon)
                weather_results.append({
                    "city": point["city"],
                    "coord": point["coord"],
                    "weather": weather_data
                })

            # Prepare the response message
            response_message = {
                "trip_id": trip_id,
                "intent": "WeatherForRouteProvided",
                "payload": {
                    "weather_data": weather_results
                }
            }

            # Send the response back to the orchestrator
            ch.basic_publish(
                exchange='',
                routing_key='orchestrator_queue',
                properties=pika.BasicProperties(correlation_id=props.correlation_id),
                body=json.dumps(response_message)
            )
            print(f" [WeatherAgent] Sent weather data for trip '{trip_id}' back to orchestrator.")

        except Exception as e:
            print(f" [WeatherAgent] Error processing weather: {e}")

    ch.basic_ack(delivery_tag=method.delivery_tag)


def start_agent():
    """Starts the WeatherAgent, connects to RabbitMQ, and listens for commands."""
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
            channel = connection.channel()

            channel.queue_declare(queue='weather_queue', durable=True)
            channel.queue_declare(queue='orchestrator_queue', durable=True)

            print(' [WeatherAgent] Awaiting requests. To exit press CTRL+C')
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue='weather_queue', on_message_callback=on_request)
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError:
            print(" [WeatherAgent] Connection to RabbitMQ failed. Retrying in 5 seconds...")
            time.sleep(5)
        except KeyboardInterrupt:
            print(" [WeatherAgent] Shutting down.")
            break

if __name__ == '__main__':
    start_agent()
