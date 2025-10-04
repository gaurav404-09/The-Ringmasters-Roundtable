# free_data_service.py
# A Python service to fetch attractions, restaurants, etc., from open data sources.
# This is the Python equivalent of the freeDataService.js you provided.
import requests
import os

class FreeDataService:
    def __init__(self):
        self.nominatim_base_url = 'https://nominatim.openstreetmap.org'
        self.overpass_base_url = 'https://overpass-api.de/api/interpreter'
        self.weather_api_key = os.environ.get("OPENWEATHER_API_KEY", "144f40803196f5205a5d86fa652a4720")

    def get_coordinates(self, destination):
        try:
            response = requests.get(f"{self.nominatim_base_url}/search", params={'q': destination, 'format': 'json', 'limit': 1}, headers={'User-Agent': 'TravelApp/1.0'})
            response.raise_for_status()
            data = response.json()
            if data:
                return {'lat': float(data[0]['lat']), 'lon': float(data[0]['lon'])}
            raise ValueError("No results found")
        except Exception as e:
            print(f"Error getting coordinates for {destination}: {e}")
            return None

    def query_overpass(self, query):
        try:
            response = requests.post(self.overpass_base_url, data=query, headers={'User-Agent': 'TravelApp/1.0'}, timeout=30)
            response.raise_for_status()
            return response.json().get('elements', [])
        except Exception as e:
            print(f"Overpass API error: {e}")
            return []

    def get_attractions(self, destination):
        coords = self.get_coordinates(destination)
        if not coords: return []
        lat, lon = coords['lat'], coords['lon']
        query = f"""
        [out:json][timeout:30];
        (
          node["tourism"~"attraction|museum|viewpoint"](around:5000,{lat},{lon});
          node["historic"](around:5000,{lat},{lon});
          node["leisure"~"park|garden"](around:5000,{lat},{lon});
        );
        out body 20;
        """
        elements = self.query_overpass(query)
        return [
            {
                'name': el['tags'].get('name', 'Unknown Attraction'),
                'description': el['tags'].get('tourism', el['tags'].get('historic', 'Interesting place')),
                'coordinates': {'lat': el.get('lat'), 'lon': el.get('lon')}
            }
            for el in elements if 'name' in el.get('tags', {})
        ]

    def get_restaurants(self, destination):
        coords = self.get_coordinates(destination)
        if not coords: return []
        lat, lon = coords['lat'], coords['lon']
        query = f"""
        [out:json][timeout:20];
        (
          node["amenity"="restaurant"](around:3000,{lat},{lon});
          node["amenity"="cafe"](around:3000,{lat},{lon});
        );
        out body 15;
        """
        elements = self.query_overpass(query)
        return [
            {
                'name': el['tags'].get('name', 'Local Eatery'),
                'cuisine': el['tags'].get('cuisine', 'Local'),
                'coordinates': {'lat': el.get('lat'), 'lon': el.get('lon')}
            }
            for el in elements if 'name' in el.get('tags', {})
        ]
