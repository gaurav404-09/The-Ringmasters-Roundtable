# event_agent.py
# Contains the core EventAgent class for generating events using the Cohere API.
import os
import json
import re
import requests
import cohere

# --- IMPORTANT ---
# You must set your Cohere API key as an environment variable.
# For example, in your terminal: export COHERE_API_KEY="YOUR_API_KEY"
# If you don't have one, get it from https://cohere.com/
# As a fallback, I've added a placeholder. The agent will return dummy data without a real key.
COHERE_API_KEY = os.environ.get("COHERE_API_KEY", "TDqJle6hLi86L7AYbarwkVMpJrPGMpziV8FlI2AX")
UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "BDC_IfRT8fqFvRJyx4xjNjzndSVs6P1q45FQqBxa3xA")

class EventAgent:
    def __init__(self):
        if COHERE_API_KEY == "YOUR_COHERE_API_KEY_HERE":
            print(" [EventAgent] WARNING: Cohere API key not found. Using fallback data.")
            self.client = None
        else:
            self.client = cohere.Client(COHERE_API_KEY)

    def get_event_image_url(self, keywords="event"):
        if not UNSPLASH_ACCESS_KEY:
            return "https://placehold.co/800x600/grey/white?text=Image"
        try:
            url = f"https://api.unsplash.com/photos/random?query={requests.utils.quote(keywords)}&client_id={UNSPLASH_ACCESS_KEY}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('urls', {}).get('regular', "https://source.unsplash.com/random/800x600/?event")
        except Exception as e:
            print(f" [EventAgent] Unsplash Error: {e}")
            return f"https://source.unsplash.com/random/800x600/?{requests.utils.quote(keywords)}"

    def get_fallback_events(self, city):
        events = [
            {"title": "Local Music Fest", "date": "Upcoming", "location": f"{city} Central Park", "description": "Enjoy live music from local bands.", "category": "music"},
            {"title": "Artisan Food Market", "date": "This Weekend", "location": f"{city} Town Square", "description": "Taste and buy local delicacies.", "category": "food"},
            {"title": "Indie Art Showcase", "date": "Next Week", "location": f"{city} Cultural Hall", "description": "Discover emerging visual artists from the region.", "category": "art"},
        ]
        for event in events:
            event['imageUrl'] = self.get_event_image_url(f"{event['title']} {city}")
        return events

    def get_events(self, city):
        if not self.client:
            return self.get_fallback_events(city)

        prompt = f"""
        Generate 3 unique and plausible upcoming events in {city} for the next two weeks.
        Format the response as a valid JSON array of objects with these exact property names:
        [
          {{
            "title": "Event Title",
            "date": "YYYY-MM-DD",
            "location": "Venue Name, Area",
            "description": "A brief, engaging description of the event.",
            "category": "music, art, food, sports, or festival"
          }}
        ]
        """
        try:
            response = self.client.chat(model="command", message=prompt, temperature=0.6)
            json_text = re.search(r'\[.*\]', response.text, re.DOTALL)

            if not json_text:
                print(" [EventAgent] Cohere response did not contain a valid JSON array.")
                return self.get_fallback_events(city)

            parsed_events = json.loads(json_text.group(0))
            if not isinstance(parsed_events, list):
                raise ValueError('Parsed events payload is not a list')

            cleaned_events = []
            for event in parsed_events:
                if not isinstance(event, dict):
                    continue
                title = event.get('title')
                if not title:
                    continue
                cleaned = {
                    'title': title,
                    'date': event.get('date', 'Upcoming'),
                    'location': event.get('location', city),
                    'description': event.get('description', ''),
                    'category': event.get('category', 'festival'),
                }
                cleaned['imageUrl'] = self.get_event_image_url(f"{cleaned['title']} {city} {cleaned['category']}")
                cleaned_events.append(cleaned)

            if len(cleaned_events) < 3:
                fallback_events = self.get_fallback_events(city)
                existing_titles = {event['title'].lower() for event in cleaned_events}
                for fallback in fallback_events:
                    if fallback['title'].lower() in existing_titles:
                        continue
                    cleaned_events.append(fallback)
                    existing_titles.add(fallback['title'].lower())
                    if len(cleaned_events) >= 3:
                        break

            if len(cleaned_events) > 3:
                cleaned_events = cleaned_events[:3]

            return cleaned_events if cleaned_events else self.get_fallback_events(city)
        except Exception as e:
            print(f" [EventAgent] Cohere API Error: {e}")
            return self.get_fallback_events(city)
