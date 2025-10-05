# event_agent_mcp.py
# This script runs continuously to listen for event-related jobs.
import pika
import json
import time
from event_agent import EventAgent

def on_request(ch, method, props, body):
    message = json.loads(body)
    trip_id = message.get("trip_id")
    intent = message.get("intent")
    payload = message.get("payload")
    print(f" [EventAgent] Received request for trip '{trip_id}' with intent '{intent}'")
    
    if intent == "FindEvents":
        try:
            event_agent = EventAgent()
            cities = payload.get("cities", [])
            events_by_city = {}
            for city in cities:
                print(f" [EventAgent] Finding events for {city}...")
                events_by_city[city] = event_agent.get_events(city)

            response_message = {
                "trip_id": trip_id, "intent": "EventsFound", "payload": {"events_by_city": events_by_city}
            }
            ch.basic_publish(exchange='', routing_key='orchestrator_queue', body=json.dumps(response_message))
            print(f" [EventAgent] Sent events for trip '{trip_id}' back to orchestrator.")
        except Exception as e:
            print(f" [EventAgent] Error finding events: {e}")
            
    ch.basic_ack(delivery_tag=method.delivery_tag)

def start_agent():
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
            channel = connection.channel()
            channel.queue_declare(queue='event_queue', durable=True)
            channel.queue_declare(queue='orchestrator_queue', durable=True)
            print(' [EventAgent] Awaiting requests. To exit press CTRL+C')
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue='event_queue', on_message_callback=on_request)
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError:
            print(" [EventAgent] Connection to RabbitMQ failed. Retrying in 5 seconds...")
            time.sleep(5)
        except KeyboardInterrupt:
            print(" [EventAgent] Shutting down.")
            break

if __name__ == '__main__':
    start_agent()
