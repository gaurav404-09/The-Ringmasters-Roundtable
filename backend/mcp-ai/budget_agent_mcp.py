import json
import time

import pika

from budget_agent import BudgetAgent


def on_request(ch, method, props, body):
    message = json.loads(body)
    trip_id = message.get("trip_id")
    intent = message.get("intent")
    payload = message.get("payload") or {}

    print(f" [BudgetAgent] Received request for trip '{trip_id}' with intent '{intent}'")

    if intent == "GenerateBudget":
        agent = BudgetAgent()
        try:
            summary = agent.generate_budget_summary(payload)
            response_message = {
                "trip_id": trip_id,
                "intent": "BudgetComputed",
                "payload": {
                    "budget_summary": summary
                }
            }
            ch.basic_publish(exchange='', routing_key='orchestrator_queue', body=json.dumps(response_message))
            print(f" [BudgetAgent] Sent budget summary for trip '{trip_id}' back to orchestrator.")
        except Exception as exc:
            print(f" [BudgetAgent] Error generating budget summary: {exc}")
            error_response = {
                "trip_id": trip_id,
                "intent": "BudgetComputed",
                "payload": {
                    "budget_summary": {
                        "source": "budget_agent",
                        "error": str(exc),
                        "notes": ["Budget agent failed to compute summary."]
                    }
                }
            }
            ch.basic_publish(exchange='', routing_key='orchestrator_queue', body=json.dumps(error_response))

    ch.basic_ack(delivery_tag=method.delivery_tag)


def start_agent():
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
            channel = connection.channel()
            channel.queue_declare(queue='budget_queue', durable=True)
            channel.queue_declare(queue='orchestrator_queue', durable=True)
            print(' [BudgetAgent] Awaiting requests. To exit press CTRL+C')
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue='budget_queue', on_message_callback=on_request)
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError:
            print(" [BudgetAgent] Connection to RabbitMQ failed. Retrying in 5 seconds...")
            time.sleep(5)
        except KeyboardInterrupt:
            print(" [BudgetAgent] Shutting down.")
            break


if __name__ == '__main__':
    start_agent()
