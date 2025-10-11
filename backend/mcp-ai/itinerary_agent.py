# itinerary_agent.py
# Contains the core ItineraryAgent class for generating detailed daily plans.
from freeDataService import FreeDataService
from datetime import date, timedelta

class ItineraryAgent:
    def __init__(self):
        self.data_service = FreeDataService()

    def generate_itinerary(self, route_data):
        detailed_itinerary = []
        total_days = len(route_data)
        
        for i, city_stop in enumerate(route_data):
            destination = city_stop['city']
            print(f" [ItineraryAgent] Generating comprehensive plan for {destination} (Day {i + 1}/{total_days})...")
            
            attractions = self.data_service.get_attractions(destination)
            restaurants = self.data_service.get_restaurants(destination)
            hotels = self.data_service.get_hotels(destination)

            # Fallbacks if no data is found
            if not attractions:
                attractions = [
                    {'name': f'{destination} City Center', 'description': 'Explore the historic city center', 'coordinates': None},
                    {'name': f'{destination} Cultural District', 'description': 'Immerse in local culture', 'coordinates': None},
                    {'name': f'{destination} Scenic Viewpoint', 'description': 'Capture stunning panoramic views', 'coordinates': None}
                ]
            if not restaurants:
                restaurants = [
                    {'name': 'Local Breakfast Spot', 'cuisine': 'Local', 'coordinates': None, 'priceLevel': '$'},
                    {'name': 'Traditional Restaurant', 'cuisine': 'Local', 'coordinates': None, 'priceLevel': '$$'},
                    {'name': 'Fine Dining Experience', 'cuisine': 'International', 'coordinates': None, 'priceLevel': '$$$'}
                ]
            if not hotels:
                hotels = [{'name': f'{destination} Hotel', 'description': 'Comfortable accommodation', 'coordinates': None}]

            # Select varied attractions for the day
            morning_attraction = attractions[i % len(attractions)]
            afternoon_attraction = attractions[(i + 1) % len(attractions)]
            evening_attraction = attractions[(i + 2) % len(attractions)]
            
            # Select restaurants
            breakfast_restaurant = restaurants[i % len(restaurants)]
            lunch_restaurant = restaurants[(i + 1) % len(restaurants)]
            dinner_restaurant = restaurants[(i + 2) % len(restaurants)]
            
            # Select hotel
            hotel = hotels[i % len(hotels)]

            def format_location(item):
                if item and item.get('coordinates'):
                    coords = item['coordinates']
                    if coords.get('lat') and coords.get('lon'):
                        return f"{coords['lat']}, {coords['lon']}"
                return destination

            activities = []
            activity_id = 1

            # First day: Check-in activity
            if i == 0:
                activities.append({
                    "id": activity_id,
                    "time": '14:00',
                    "title": f"Check-in at {hotel['name']}",
                    "type": 'hotel',
                    "location": format_location(hotel),
                    "notes": f"{hotel.get('description', 'Settle in and freshen up before exploring.')}",
                    "duration": '30m',
                    "includes": ['Room keys', 'Welcome amenities', 'Hotel orientation'],
                    "status": 'confirmed'
                })
                activity_id += 1

            # Breakfast (skip on first day - arrival day)
            if i > 0:
                activities.append({
                    "id": activity_id,
                    "time": '08:00',
                    "title": f"Breakfast at {breakfast_restaurant['name']}",
                    "type": 'meal',
                    "location": format_location(breakfast_restaurant),
                    "notes": f"Start your day with a hearty {breakfast_restaurant.get('cuisine', 'local')} breakfast.",
                    "duration": '1h',
                    "price": breakfast_restaurant.get('priceLevel', '$'),
                    "includes": ['Continental breakfast', 'Fresh juice', 'Coffee/Tea']
                })
                activity_id += 1

            # Morning sightseeing
            activities.append({
                "id": activity_id,
                "time": '16:00' if i == 0 else '09:30',  # Later start on arrival day
                "title": f"Explore {morning_attraction['name']}",
                "type": 'sightseeing',
                "location": format_location(morning_attraction),
                "notes": morning_attraction.get('description', 'Start the day by soaking in the local highlights.'),
                "duration": '3h',
                "status": 'recommended'
            })
            activity_id += 1

            # Lunch
            activities.append({
                "id": activity_id,
                "time": '19:00' if i == 0 else '12:30',  # Later lunch on arrival day
                "title": f"Lunch at {lunch_restaurant['name']}",
                "type": 'meal',
                "location": format_location(lunch_restaurant),
                "notes": f"{lunch_restaurant.get('cuisine', 'Local')} cuisine pick for the afternoon.",
                "duration": '1h 30m',
                "price": lunch_restaurant.get('priceLevel', '$$')
            })
            activity_id += 1

            # Afternoon activities (skip on arrival day)
            if i > 0:
                activities.append({
                    "id": activity_id,
                    "time": '15:30',
                    "title": f"Afternoon at {afternoon_attraction['name']}",
                    "type": 'sightseeing',
                    "location": format_location(afternoon_attraction),
                    "notes": afternoon_attraction.get('description', 'A perfect mid-day cultural stop.'),
                    "duration": '2h',
                    "status": 'suggested'
                })
                activity_id += 1

                activities.append({
                    "id": activity_id,
                    "time": '18:00',
                    "title": f"Golden Hour at {evening_attraction['name']}",
                    "type": 'sightseeing',
                    "location": format_location(evening_attraction),
                    "notes": evening_attraction.get('description', 'Capture sunset moments before dinner.'),
                    "duration": '1h 30m',
                    "status": 'optional'
                })
                activity_id += 1

            # Dinner
            activities.append({
                "id": activity_id,
                "time": '20:00',
                "title": f"Dinner at {dinner_restaurant['name']}",
                "type": 'meal',
                "location": format_location(dinner_restaurant),
                "notes": f"{dinner_restaurant.get('cuisine', 'Local')} cuisine to wrap up the day.",
                "duration": '2h',
                "price": dinner_restaurant.get('priceLevel', '$$')
            })
            activity_id += 1

            # Last day: Check-out activity
            if i == total_days - 1:
                activities.append({
                    "id": activity_id,
                    "time": '11:00',
                    "title": f"Check-out from {hotel['name']}",
                    "type": 'hotel',
                    "location": format_location(hotel),
                    "notes": 'Hotel check-out. Collect luggage and prepare for departure.',
                    "duration": '30m',
                    "includes": ['Final bill settlement', 'Luggage assistance', 'Transportation arrangement'],
                    "status": 'confirmed'
                })
                activity_id += 1

            day_plan = {
                "id": i + 1,
                "day": i + 1,
                "city": destination,
                "title": f"Day {i + 1}: {'Arrival & First Impressions' if i == 0 else 'Final Discoveries & Departure' if i == total_days - 1 else 'Discovery & Moments'}",
                "weather": city_stop.get('weather', {}),
                "activities": activities
            }
            detailed_itinerary.append(day_plan)
            print(f" [ItineraryAgent] Generated {len(activities)} activities for Day {i + 1}")
            
        return detailed_itinerary
