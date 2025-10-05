# mapAgent.py
import requests
from math import radians, sin, cos, sqrt, atan2

class MapAgent:
    MAJOR_CITIES = [
    {"name": "Adoni", "lat": 15.63, "lon": 77.28},
    {"name": "Agartala", "lat": 23.83, "lon": 91.29},
    {"name": "Agra", "lat": 27.18, "lon": 78.01},
    {"name": "Ahmedabad", "lat": 23.02, "lon": 72.57},
    {"name": "Ahmednagar", "lat": 19.09, "lon": 74.74},
    {"name": "Aizawl", "lat": 23.73, "lon": 92.72},
    {"name": "Ajmer", "lat": 26.45, "lon": 74.64},
    {"name": "Akola", "lat": 20.70, "lon": 77.01},
    {"name": "Alappuzha", "lat": 9.49, "lon": 76.33},
    {"name": "Aligarh", "lat": 27.89, "lon": 78.06},
    {"name": "Alwar", "lat": 27.55, "lon": 76.63},
    {"name": "Amaravati", "lat": 16.51, "lon": 80.52},
    {"name": "Ambala", "lat": 30.38, "lon": 76.78},
    {"name": "Ambattur", "lat": 13.11, "lon": 80.16},
    {"name": "Amravati", "lat": 20.93, "lon": 77.75},
    {"name": "Amritsar", "lat": 31.63, "lon": 74.87},
    {"name": "Amroha", "lat": 28.91, "lon": 78.47},
    {"name": "Anand", "lat": 22.56, "lon": 72.96},
    {"name": "Anantapur", "lat": 14.68, "lon": 77.60},
    {"name": "Arrah", "lat": 25.56, "lon": 84.67},
    {"name": "Asansol", "lat": 23.68, "lon": 86.97},
    {"name": "Aurangabad", "lat": 19.88, "lon": 75.34},
    {"name": "Avadi", "lat": 13.11, "lon": 80.10},
    {"name": "Bahraich", "lat": 27.58, "lon": 81.60},
    {"name": "Ballari", "lat": 15.14, "lon": 76.92},
    {"name": "Bardhaman", "lat": 23.23, "lon": 87.86},
    {"name": "Bareilly", "lat": 28.37, "lon": 79.43},
    {"name": "Bathinda", "lat": 30.21, "lon": 74.94},
    {"name": "Begusarai", "lat": 25.42, "lon": 86.13},
    {"name": "Belagavi", "lat": 15.85, "lon": 74.50},
    {"name": "Bengaluru", "lat": 12.97, "lon": 77.59},
    {"name": "Bettiah", "lat": 26.80, "lon": 84.50},
    {"name": "Bhagalpur", "lat": 25.24, "lon": 86.98},
    {"name": "Bhavnagar", "lat": 21.78, "lon": 72.15},
    {"name": "Bhilai", "lat": 21.21, "lon": 81.38},
    {"name": "Bhilwara", "lat": 25.34, "lon": 74.64},
    {"name": "Bhimavaram", "lat": 16.54, "lon": 81.52},
    {"name": "Bhind", "lat": 26.56, "lon": 78.79},
    {"name": "Bhiwandi", "lat": 19.30, "lon": 73.06},
    {"name": "Bhiwani", "lat": 28.79, "lon": 76.13},
    {"name": "Bhopal", "lat": 23.26, "lon": 77.41},
    {"name": "Bhubaneswar", "lat": 20.29, "lon": 85.82},
    {"name": "Bikaner", "lat": 28.02, "lon": 73.31},
    {"name": "Bilaspur", "lat": 22.09, "lon": 82.14},
    {"name": "Bokaro Steel City", "lat": 23.67, "lon": 86.15},
    {"name": "Brahmapur", "lat": 19.32, "lon": 84.79},
    {"name": "Buxar", "lat": 25.56, "lon": 83.98},
    {"name": "Chandigarh", "lat": 30.73, "lon": 76.78},
    {"name": "Chandrapur", "lat": 19.96, "lon": 79.29},
    {"name": "Chapra", "lat": 25.78, "lon": 84.73},
    {"name": "Chennai", "lat": 13.08, "lon": 80.27},
    {"name": "Chittoor", "lat": 13.22, "lon": 79.10},
    {"name": "Coimbatore", "lat": 11.02, "lon": 76.96},
    {"name": "Cuttack", "lat": 20.46, "lon": 85.88},
    {"name": "Darbhanga", "lat": 26.16, "lon": 85.90},
    {"name": "Davanagere", "lat": 14.46, "lon": 75.92},
    {"name": "Dehradun", "lat": 30.32, "lon": 78.03},
    {"name": "Dehri", "lat": 24.87, "lon": 84.18},
    {"name": "Delhi", "lat": 28.70, "lon": 77.10},
    {"name": "Deoghar", "lat": 24.48, "lon": 86.70},
    {"name": "Dewas", "lat": 22.96, "lon": 76.05},
    {"name": "Dhanbad", "lat": 23.80, "lon": 86.44},
    {"name": "Dharamshala", "lat": 32.22, "lon": 76.32},
    {"name": "Dhule", "lat": 20.90, "lon": 74.77},
    {"name": "Dibrugarh", "lat": 27.47, "lon": 94.91},
    {"name": "Dimapur", "lat": 25.91, "lon": 93.75},
    {"name": "Dindigul", "lat": 10.36, "lon": 77.98},
    {"name": "Durgapur", "lat": 23.52, "lon": 87.31},
    {"name": "Eluru", "lat": 16.71, "lon": 81.10},
    {"name": "Erode", "lat": 11.34, "lon": 77.72},
    {"name": "Etah", "lat": 27.63, "lon": 78.66},
    {"name": "Etawah", "lat": 26.78, "lon": 79.03},
    {"name": "Faridabad", "lat": 28.41, "lon": 77.32},
    {"name": "Farrukhabad", "lat": 27.39, "lon": 79.58},
    {"name": "Fatehpur", "lat": 25.92, "lon": 80.80},
    {"name": "Firozabad", "lat": 27.15, "lon": 78.39},
    {"name": "Gandhidham", "lat": 23.08, "lon": 70.13},
    {"name": "Gandhinagar", "lat": 23.22, "lon": 72.67},
    {"name": "Gangtok", "lat": 27.33, "lon": 88.61},
    {"name": "Gaya", "lat": 24.79, "lon": 85.00},
    {"name": "Ghaziabad", "lat": 28.67, "lon": 77.45},
    {"name": "Giridih", "lat": 24.18, "lon": 86.30},
    {"name": "Gorakhpur", "lat": 26.76, "lon": 83.37},
    {"name": "Gulbarga", "lat": 17.33, "lon": 76.83},
    {"name": "Guna", "lat": 24.64, "lon": 77.32},
    {"name": "Guntur", "lat": 16.31, "lon": 80.44},
    {"name": "Gurugram", "lat": 28.46, "lon": 77.03},
    {"name": "Guwahati", "lat": 26.14, "lon": 91.74},
    {"name": "Gwalior", "lat": 26.22, "lon": 78.18},
    {"name": "Hajipur", "lat": 25.68, "lon": 85.22},
    {"name": "Haldia", "lat": 22.03, "lon": 88.06},
    {"name": "Hapur", "lat": 28.73, "lon": 77.78},
    {"name": "Haridwar", "lat": 29.95, "lon": 78.16},
    {"name": "Hazaribagh", "lat": 23.99, "lon": 85.36},
    {"name": "Hisar", "lat": 29.15, "lon": 75.72},
    {"name": "Hosapete", "lat": 15.27, "lon": 76.39},
    {"name": "Hoshiarpur", "lat": 31.53, "lon": 75.92},
    {"name": "Hosur", "lat": 12.74, "lon": 77.82},
    {"name": "Howrah", "lat": 22.59, "lon": 88.31},
    {"name": "Hubli-Dharwad", "lat": 15.36, "lon": 75.12},
    {"name": "Hyderabad", "lat": 17.38, "lon": 78.48},
    {"name": "Ichalkaranji", "lat": 16.70, "lon": 74.46},
    {"name": "Imphal", "lat": 24.81, "lon": 93.94},
    {"name": "Indore", "lat": 22.72, "lon": 75.86},
    {"name": "Itanagar", "lat": 27.08, "lon": 93.61},
    {"name": "Jabalpur", "lat": 23.18, "lon": 79.99},
    {"name": "Jaipur", "lat": 26.91, "lon": 75.79},
    {"name": "Jalandhar", "lat": 31.33, "lon": 75.58},
    {"name": "Jalgaon", "lat": 21.00, "lon": 75.56},
    {"name": "Jalna", "lat": 19.84, "lon": 75.88},
    {"name": "Jamalpur", "lat": 25.30, "lon": 86.48},
    {"name": "Jammu", "lat": 32.73, "lon": 74.86},
    {"name": "Jamnagar", "lat": 22.47, "lon": 70.06},
    {"name": "Jamshedpur", "lat": 22.80, "lon": 86.20},
    {"name": "Jaunpur", "lat": 25.75, "lon": 82.68},
    {"name": "Jhansi", "lat": 25.43, "lon": 78.58},
    {"name": "Jodhpur", "lat": 26.24, "lon": 73.02},
    {"name": "Jorhat", "lat": 26.75, "lon": 94.22},
    {"name": "Junagadh", "lat": 21.52, "lon": 70.46},
    {"name": "Kakinada", "lat": 16.99, "lon": 82.25},
    {"name": "Kalyan-Dombivali", "lat": 19.24, "lon": 73.13},
    {"name": "Kannur", "lat": 11.87, "lon": 75.37},
    {"name": "Kanpur", "lat": 26.45, "lon": 80.33},
    {"name": "Karimnagar", "lat": 18.44, "lon": 79.13},
    {"name": "Karnal", "lat": 29.69, "lon": 76.99},
    {"name": "Katihar", "lat": 25.54, "lon": 87.57},
    {"name": "Khammam", "lat": 17.25, "lon": 80.15},
    {"name": "Khandwa", "lat": 21.83, "lon": 76.35},
    {"name": "Kharagpur", "lat": 22.33, "lon": 87.32},
    {"name": "Kochi", "lat": 9.93, "lon": 76.26},
    {"name": "Kohima", "lat": 25.66, "lon": 94.10},
    {"name": "Kolhapur", "lat": 16.70, "lon": 74.24},
    {"name": "Kolkata", "lat": 22.57, "lon": 88.36},
    {"name": "Kollam", "lat": 8.89, "lon": 76.61},
    {"name": "Korba", "lat": 22.36, "lon": 82.73},
    {"name": "Kota", "lat": 25.21, "lon": 75.83},
    {"name": "Kottayam", "lat": 9.59, "lon": 76.52},
    {"name": "Kozhikode", "lat": 11.26, "lon": 75.78},
    {"name": "Kurnool", "lat": 15.83, "lon": 78.04},
    {"name": "Latur", "lat": 18.40, "lon": 76.58},
    {"name": "Leh", "lat": 34.16, "lon": 77.58},
    {"name": "Lucknow", "lat": 26.85, "lon": 80.95},
    {"name": "Ludhiana", "lat": 30.90, "lon": 75.86},
    {"name": "Madhyamgram", "lat": 22.70, "lon": 88.45},
    {"name": "Madurai", "lat": 9.93, "lon": 78.12},
    {"name": "Mahbubnagar", "lat": 16.74, "lon": 77.99},
    {"name": "Malegaon", "lat": 20.55, "lon": 74.53},
    {"name": "Mangaluru", "lat": 12.91, "lon": 74.86},
    {"name": "Mango", "lat": 22.82, "lon": 86.23},
    {"name": "Mathura", "lat": 27.49, "lon": 77.67},
    {"name": "Mau", "lat": 25.94, "lon": 83.56},
    {"name": "Meerut", "lat": 28.98, "lon": 77.71},
    {"name": "Mira-Bhayandar", "lat": 19.29, "lon": 72.85},
    {"name": "Mirzapur", "lat": 25.14, "lon": 82.57},
    {"name": "Mohali", "lat": 30.70, "lon": 76.72},
    {"name": "Moradabad", "lat": 28.83, "lon": 78.78},
    {"name": "Morbi", "lat": 22.82, "lon": 70.83},
    {"name": "Motihari", "lat": 26.65, "lon": 84.92},
    {"name": "Mumbai", "lat": 19.08, "lon": 72.88},
    {"name": "Munger", "lat": 25.38, "lon": 86.47},
    {"name": "Muzaffarnagar", "lat": 29.47, "lon": 77.70},
    {"name": "Muzaffarpur", "lat": 26.12, "lon": 85.36},
    {"name": "Mysuru", "lat": 12.30, "lon": 76.64},
    {"name": "Nadiad", "lat": 22.70, "lon": 72.86},
    {"name": "Nagaon", "lat": 26.35, "lon": 92.68},
    {"name": "Nagpur", "lat": 21.15, "lon": 79.09},
    {"name": "Nainital", "lat": 29.38, "lon": 79.45},
    {"name": "Nanded", "lat": 19.15, "lon": 77.31},
    {"name": "Nandyal", "lat": 15.48, "lon": 78.48},
    {"name": "Nashik", "lat": 20.00, "lon": 73.79},
    {"name": "Navi Mumbai", "lat": 19.03, "lon": 73.02},
    {"name": "Nellore", "lat": 14.44, "lon": 79.99},
    {"name": "Nizamabad", "lat": 18.67, "lon": 78.09},
    {"name": "Noida", "lat": 28.54, "lon": 77.39},
    {"name": "Ongole", "lat": 15.50, "lon": 80.05},
    {"name": "Orai", "lat": 25.99, "lon": 79.46},
    {"name": "Pali", "lat": 25.77, "lon": 73.33},
    {"name": "Panaji", "lat": 15.49, "lon": 73.83},
    {"name": "Panchkula", "lat": 30.70, "lon": 76.85},
    {"name": "Panipat", "lat": 29.39, "lon": 76.96},
    {"name": "Panvel", "lat": 18.99, "lon": 73.12},
    {"name": "Parbhani", "lat": 19.26, "lon": 76.77},
    {"name": "Patiala", "lat": 30.34, "lon": 76.38},
    {"name": "Patna", "lat": 25.59, "lon": 85.14},
    {"name": "Phagwara", "lat": 31.22, "lon": 75.77},
    {"name": "Pimpri-Chinchwad", "lat": 18.62, "lon": 73.80},
    {"name": "Port Blair", "lat": 11.62, "lon": 92.72},
    {"name": "Prayagraj", "lat": 25.44, "lon": 81.85},
    {"name": "Puducherry", "lat": 11.94, "lon": 79.81},
    {"name": "Pune", "lat": 18.52, "lon": 73.86},
    {"name": "Puri", "lat": 19.81, "lon": 85.83},
    {"name": "Purnia", "lat": 25.77, "lon": 87.47},
    {"name": "Raebareli", "lat": 26.22, "lon": 81.24},
    {"name": "Raichur", "lat": 16.20, "lon": 77.36},
    {"name": "Raipur", "lat": 21.25, "lon": 81.63},
    {"name": "Rajahmundry", "lat": 17.00, "lon": 81.78},
    {"name": "Rajkot", "lat": 22.30, "lon": 70.80},
    {"name": "Rampur", "lat": 28.81, "lon": 79.02},
    {"name": "Ranchi", "lat": 23.34, "lon": 85.31},
    {"name": "Ratlam", "lat": 23.33, "lon": 75.04},
    {"name": "Rewa", "lat": 24.53, "lon": 81.29},
    {"name": "Rishikesh", "lat": 30.09, "lon": 78.29},
    {"name": "Rohtak", "lat": 28.90, "lon": 76.58},
    {"name": "Rourkela", "lat": 22.26, "lon": 84.85},
    {"name": "Sagar", "lat": 23.84, "lon": 78.74},
    {"name": "Saharanpur", "lat": 29.96, "lon": 77.55},
    {"name": "Saharasa", "lat": 25.88, "lon": 86.60},
    {"name": "Salem", "lat": 11.67, "lon": 78.14},
    {"name": "Sambalpur", "lat": 21.47, "lon": 83.98},
    {"name": "Sambhal", "lat": 28.58, "lon": 78.57},
    {"name": "Sangli", "lat": 16.85, "lon": 74.58},
    {"name": "Sasaram", "lat": 24.95, "lon": 84.03},
    {"name": "Satara", "lat": 17.68, "lon": 74.00},
    {"name": "Satna", "lat": 24.58, "lon": 80.83},
    {"name": "Shahjahanpur", "lat": 27.88, "lon": 79.91},
    {"name": "Shillong", "lat": 25.58, "lon": 91.89},
    {"name": "Shimla", "lat": 31.10, "lon": 77.17},
    {"name": "Shivamogga", "lat": 13.93, "lon": 75.57},
    {"name": "Sikar", "lat": 27.61, "lon": 75.14},
    {"name": "Silchar", "lat": 24.82, "lon": 92.80},
    {"name": "Siliguri", "lat": 26.73, "lon": 88.39},
    {"name": "Silvassa", "lat": 20.27, "lon": 73.01},
    {"name": "Singrauli", "lat": 24.20, "lon": 82.66},
    {"name": "Siwan", "lat": 26.22, "lon": 84.36},
    {"name": "Solapur", "lat": 17.66, "lon": 75.91},
    {"name": "Sonipat", "lat": 28.99, "lon": 77.02},
    {"name": "Srinagar", "lat": 34.08, "lon": 74.80},
    {"name": "Surat", "lat": 21.17, "lon": 72.83},
    {"name": "Surendranagar", "lat": 22.73, "lon": 71.64},
    {"name": "Tenali", "lat": 16.24, "lon": 80.58},
    {"name": "Tezpur", "lat": 26.63, "lon": 92.80},
    {"name": "Thane", "lat": 19.22, "lon": 72.98},
    {"name": "Thanjavur", "lat": 10.79, "lon": 79.14},
    {"name": "Thiruvananthapuram", "lat": 8.52, "lon": 76.94},
    {"name": "Thoothukudi", "lat": 8.80, "lon": 78.14},
    {"name": "Thrissur", "lat": 10.53, "lon": 76.21},
    {"name": "Tinsukia", "lat": 27.50, "lon": 95.37},
    {"name": "Tiruchirappalli", "lat": 10.79, "lon": 78.70},
    {"name": "Tirunelveli", "lat": 8.71, "lon": 77.76},
    {"name": "Tirupati", "lat": 13.63, "lon": 79.42},
    {"name": "Tiruppur", "lat": 11.11, "lon": 77.34},
    {"name": "Tumakuru", "lat": 13.34, "lon": 77.11},
    {"name": "Udaipur", "lat": 24.57, "lon": 73.71},
    {"name": "Udupi", "lat": 13.34, "lon": 74.75},
    {"name": "Ujjain", "lat": 23.18, "lon": 75.78},
    {"name": "Ulhasnagar", "lat": 19.22, "lon": 73.16},
    {"name": "Unnao", "lat": 26.54, "lon": 80.49},
    {"name": "Vadodara", "lat": 22.31, "lon": 73.18},
    {"name": "Varanasi", "lat": 25.32, "lon": 83.00},
    {"name": "Vasai-Virar", "lat": 19.47, "lon": 72.81},
    {"name": "Vellore", "lat": 12.92, "lon": 79.13},
    {"name": "Vijayawada", "lat": 16.51, "lon": 80.65},
    {"name": "Visakhapatnam", "lat": 17.69, "lon": 83.22},
    {"name": "Vizianagaram", "lat": 18.11, "lon": 83.40},
    {"name": "Warangal", "lat": 17.97, "lon": 79.59},
    {"name": "Yamunanagar", "lat": 30.13, "lon": 77.28},
]
    ROUTE_URL = "https://router.project-osrm.org/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}?overview=full&geometries=geojson"

    def get_coordinates(self, city_name):
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": city_name, "format": "json", "limit": 1}
        headers = {"User-Agent": "mcp-ai-travel-app"}
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        if not data:
            raise ValueError(f"Could not find coordinates for city: {city_name}")
        return float(data[0]["lat"]), float(data[0]["lon"])

    def get_nearest_major_city(self, lat, lon):
        min_distance = float('inf')
        nearest_city = "Unknown"
        for city in self.MAJOR_CITIES:
            lat2, lon2 = city["lat"], city["lon"]
            R = 6371
            dlat = radians(lat2 - lat)
            dlon = radians(lon2 - lon)
            a = sin(dlat/2)**2 + cos(radians(lat))*cos(radians(lat2))*sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            distance = R * c
            if distance < min_distance:
                min_distance = distance
                nearest_city = city["name"]
        return nearest_city

    def get_intermediate_cities(self, start_city, end_city, num_days=10):
        start_lat, start_lon = self.get_coordinates(start_city)
        end_lat, end_lon = self.get_coordinates(end_city)
        url = self.ROUTE_URL.format(start_lon=start_lon, start_lat=start_lat, end_lon=end_lon, end_lat=end_lat)
        response = requests.get(url)
        response.raise_for_status()
        coords = response.json()["routes"][0]["geometry"]["coordinates"]
        
        points = []
        total_segments = max(1, num_days - 1)
        for i in range(num_days):
            idx = int(i * (len(coords) - 1) / total_segments)
            points.append(coords[idx])
        
        final_points = []
        seen_cities = set()
        for lon, lat in points:
            city_name = self.get_nearest_major_city(lat, lon)
            if city_name not in seen_cities:
                final_points.append({"city": city_name, "coord": f"{lat},{lon}"})
                seen_cities.add(city_name)
        
        final_points[0] = {"city": start_city, "coord": f"{start_lat},{start_lon}"}
        final_points[-1] = {"city": end_city, "coord": f"{end_lat},{end_lon}"}
        
        ordered_unique_points = []
        final_seen_cities = set()
        for point in final_points:
            if point['city'] not in final_seen_cities:
                ordered_unique_points.append(point)
                final_seen_cities.add(point['city'])
        return ordered_unique_points
