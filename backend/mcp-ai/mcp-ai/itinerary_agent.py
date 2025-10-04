# itinerary_agent.py
# Contains the core ItineraryAgent class for generating detailed daily plans.
from freeDataService import FreeDataService
from datetime import date, timedelta

class ItineraryAgent:
    def __init__(self):
        self.data_service = FreeDataService()

    def generate_itinerary(self, route_data):
        detailed_itinerary = []
        
        for i, city_stop in enumerate(route_data):
            destination = city_stop['city']
            print(f" [ItineraryAgent] Generating plan for {destination}...")
            
            attractions = self.data_service.get_attractions(destination)
            restaurants = self.data_service.get_restaurants(destination)

            # Fallbacks if no data is found
            if not attractions:
                attractions.append({'name': f'{destination} City Walk', 'description': 'Explore the city center', 'coordinates': None})
            if not restaurants:
                restaurants.append({'name': 'a local restaurant', 'cuisine': 'Local', 'coordinates': None})

            morning_attraction = attractions[0]
            lunch_restaurant = restaurants[0]
            dinner_restaurant = restaurants[-1] # Pick a different one for dinner

            def format_location(item):
                if item.get('coordinates'):
                    return f"{item['coordinates'].get('lat')}, {item['coordinates'].get('lon')}"
                return destination

            day_plan = {
                "day": i + 1,
                "city": destination,
                "weather": city_stop.get('weather', {}),
                "activities": [
                    { "time": '09:00', "title": f"Visit {morning_attraction['name']}", "notes": morning_attraction['description'], "location": format_location(morning_attraction)},
                    { "time": '12:30', "title": f"Lunch at {lunch_restaurant['name']}", "notes": f"Enjoy {lunch_restaurant['cuisine']} cuisine", "location": format_location(lunch_restaurant)},
                    { "time": '19:00', "title": f"Dinner at {dinner_restaurant['name']}", "notes": f"Relaxed dinner", "location": format_location(dinner_restaurant)},
                ]
            }
            detailed_itinerary.append(day_plan)
            
        return detailed_itinerary
