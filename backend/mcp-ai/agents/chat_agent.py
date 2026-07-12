import json
from datetime import datetime
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from config import GROQ_API_KEY, GROQ_MODEL_FAST

# In-memory session store for chat history (client_sid -> list of messages)
chat_sessions = {}

def get_system_prompt() -> str:
    today_str = datetime.now().strftime("%A, %b %d, %Y")
    return f"""You are a helpful and expert AI Travel Concierge.
Your goal is to flexibly gather the necessary parameters from the user to plan a trip. 
Do not be rigid. Have a natural conversation.

TODAY'S DATE: {today_str}

You need to extract the following 6 parameters before a trip can be planned:
1. start_city: The origin city (e.g., Delhi, New York)
2. end_city: The destination city (e.g., Goa, London)
3. num_days: The number of days for the trip (e.g., 5)
4. start_date: The start date of travel in YYYY-MM-DD format. If the user gives a relative date like "tomorrow" or "next Monday", convert it to the exact YYYY-MM-DD date based on today's date ({today_str}).
5. transport_mode: How they want to travel. Must evaluate to exactly 'driving' or 'train_flight'. Default to 'train_flight' if they are flying or taking a train.
6. preferences: Any specific interests (e.g., foodie, culture, nature, relaxing)

Ask conversational, friendly questions to get any missing information (especially the start date of travel).
If the user provides all the information, you MUST output a JSON block exactly in this format AND say something like "I have everything I need, let me trigger the orchestrator to plan that for you right now!":
```json
{{
  "READY": true,
  "start_city": "Delhi",
  "end_city": "Goa",
  "num_days": 5,
  "start_date": "2026-06-20",
  "transport_mode": "driving",
  "preferences": "foodie and beaches"
}}
```
Otherwise, just respond conversationally to gather what you need. 
DO NOT output the JSON block until you are absolutely sure you have all 6 parameters.
If they change their mind during the conversation, update your understanding.
"""

def process_chat_message(client_sid: str, text: str) -> tuple[str, dict]:
    """
    Process a chat message from a client.
    Returns a tuple of (reply_message, trigger_payload)
    If trigger_payload is not None, the orchestrator should trigger the trip plan.
    """
    # Initialize session if not exists
    if client_sid not in chat_sessions:
        chat_sessions[client_sid] = [SystemMessage(content=get_system_prompt())]
    
    messages = chat_sessions[client_sid]
    messages.append(HumanMessage(content=text))
    
    try:
        llm = ChatGroq(
            api_key=GROQ_API_KEY,
            model=GROQ_MODEL_FAST,
            temperature=0.5,
            max_tokens=1024,
        )
        
        response = llm.invoke(messages)
        reply = response.content
        messages.append(AIMessage(content=reply))
        
        trigger_payload = None
        
        # Check if the LLM output the READY JSON block
        if "```json" in reply:
            try:
                json_str = reply.split("```json")[1].split("```")[0].strip()
                data = json.loads(json_str)
                if data.get("READY"):
                    trigger_payload = data
            except Exception as e:
                print(f"[ChatAgent] Error parsing JSON: {e}")
                
        # Clean up the JSON from the user-facing reply so it looks natural
        if "```json" in reply:
            reply = reply.split("```json")[0].strip()
            
        return reply, trigger_payload

    except Exception as e:
        print(f"[ChatAgent] Error: {e}")
        return "I'm sorry, I'm having trouble connecting to my neural net right now. Let's try again in a moment.", None
