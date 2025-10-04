# weather_agent.py
# ALL LOGIC - Stays in the main mcp-ai directory
import requests

class WeatherAgent:
    def __init__(self, api_key):
        self.api_key = api_key
        self.weather_base = "https://api.openweathermap.org/data/2.5/weather"

    def get_weather(self, lat, lon):
        params = {"lat": lat, "lon": lon, "appid": self.api_key, "units": "metric"}
        response = requests.get(self.weather_base, params=params)
        data = response.json()
        if "weather" in data:
            return {
                "weather": data["weather"][0]["description"],
                "temp": data["main"]["temp"],
            }
        return {"weather": "Unknown", "temp": 0}
