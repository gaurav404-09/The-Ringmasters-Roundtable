# itinerary_agent_mcp.py
# This script runs continuously to listen for itinerary-related jobs.
import pika
import json
import time
from itinerary_agent import ItineraryAgent

def on_request(ch, method, props, body):
    message = json.loads(body)
    trip_id = message.get("trip_id")
    intent = message.get("intent")
    payload = message.get("payload")
    print(f" [ItineraryAgent] Received request for trip '{trip_id}' with intent '{intent}'")
    if intent == "GenerateItinerary":
        try:
            itinerary_agent = ItineraryAgent()
            # The payload now contains the combined route and weather data
            detailed_itinerary = itinerary_agent.generate_itinerary(payload.get("route_with_weather"))
            
            response_message = {
                "trip_id": trip_id, "intent": "ItineraryGenerated", "payload": {"itinerary": detailed_itinerary}
            }
            ch.basic_publish(exchange='', routing_key='orchestrator_queue', body=json.dumps(response_message))
            print(f" [ItineraryAgent] Sent detailed itinerary for trip '{trip_id}' back to orchestrator.")
        except Exception as e:
            print(f" [ItineraryAgent] Error generating itinerary: {e}")
    ch.basic_ack(delivery_tag=method.delivery_tag)

def start_agent():
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
            channel = connection.channel()
            channel.queue_declare(queue='itinerary_queue', durable=True)
            channel.queue_declare(queue='orchestrator_queue', durable=True)
            print(' [ItineraryAgent] Awaiting requests. To exit press CTRL+C')
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue='itinerary_queue', on_message_callback=on_request)
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError:
            print(" [ItineraryAgent] Connection to RabbitMQ failed. Retrying in 5 seconds...")
            time.sleep(5)
        except KeyboardInterrupt:
            print(" [ItineraryAgent] Shutting down.")
            break

if __name__ == '__main__':
    start_agent()
