import axios from 'axios';

class FreeDataService {
  constructor() {
    this.nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
    this.overpassBaseUrl = 'https://overpass-api.de/api/interpreter';
    this.weatherBaseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  // Lazy-load API key to ensure it's read after environment variables are loaded
  get weatherApiKey() {
    return process.env.OPENWEATHER_API_KEY || process.env.VITE_OPENWEATHER_API_KEY;
  }

  // Get coordinates for a destination
  async getCoordinates(destination) {
    try {
      const response = await axios.get(`${this.nominatimBaseUrl}/search`, {
        params: {
          q: destination,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        headers: { 
          'User-Agent': 'TravelApp/1.0',
          'Referer': 'https://yourapp.com'
        },
        timeout: 10000
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        return {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          display_name: result.display_name
        };
      }
      
      throw new Error('No results found');
    } catch (error) {
      console.error(`Error getting coordinates for ${destination}:`, error.message);
      throw error;
    }
  }

  // Query Overpass API
  async queryOverpass(query) {
    try {
      const response = await axios.post(this.overpassBaseUrl, query, {
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'TravelApp/1.0'
        },
        timeout: 30000
      });

      if (response.data?.elements) {
        return response.data.elements;
      }
      return [];
    } catch (error) {
      console.error('Overpass API error:', error.message);
      return [];
    }
  }

  // Get attractions for a destination
  async getAttractions(destination, budget = 'medium') {
    try {
      const coords = await this.getCoordinates(destination);
      const { lat, lon } = coords;
      
      const query = `[out:json][timeout:30];
(
  node["tourism"](around:5000,${lat},${lon});
  node["historic"](around:5000,${lat},${lon});
  node["natural"~"beach|waterfall|peak"](around:5000,${lat},${lon});
  node["leisure"~"park|garden"](around:5000,${lat},${lon});
);
out body 50;`;

      const elements = await this.queryOverpass(query);
      
      return elements
        .filter(el => el.tags?.name)
        .map(el => ({
          id: el.id,
          name: el.tags.name,
          type: el.tags.tourism || el.tags.historic || el.tags.natural || el.tags.leisure || 'attraction',
          description: this.generateDescription(el.tags),
          coordinates: { lat: el.lat, lon: el.lon },
          tags: el.tags
        }))
        .slice(0, 50);
    } catch (error) {
      console.error('Error fetching attractions:', error.message);
      return [];
    }
  }

  // Get restaurants for a destination
  async getRestaurants(destination, budget = 'medium') {
    try {
      const coords = await this.getCoordinates(destination);
      const { lat, lon } = coords;

      const query = `[out:json][timeout:20];
(
  node["amenity"="restaurant"](around:3000,${lat},${lon});
  node["amenity"="cafe"](around:3000,${lat},${lon});
);
out body 15;`;

      const elements = await this.queryOverpass(query);
      
      return elements
        .filter(el => el.tags?.name)
        .map(el => ({
          id: el.id,
          name: el.tags.name,
          cuisine: el.tags.cuisine || 'Local',
          description: `Serving ${el.tags.cuisine || 'local'} cuisine`,
          coordinates: { lat: el.lat, lon: el.lon },
          priceLevel: this.getPriceLevel(el.tags, budget)
        }))
        .slice(0, 10);
    } catch (error) {
      console.error('Error fetching restaurants:', error.message);
      return [];
    }
  }

  // Get hotels for a destination
  async getHotels(destination, budget = 'medium') {
    try {
      const coords = await this.getCoordinates(destination);
      const { lat, lon } = coords;

      const query = `[out:json][timeout:20];
(
  node["tourism"="hotel"](around:3000,${lat},${lon});
  node["tourism"="hostel"](around:3000,${lat},${lon});
  node["tourism"="guest_house"](around:3000,${lat},${lon});
);
out body 10;`;

      const elements = await this.queryOverpass(query);
      
      return elements
        .filter(el => el.tags?.name)
        .map(el => ({
          id: el.id,
          name: el.tags.name,
          type: el.tags.tourism || 'hotel',
          description: `A ${el.tags.tourism || 'hotel'} in ${destination}`,
          coordinates: { lat: el.lat, lon: el.lon },
          priceLevel: this.getPriceLevel(el.tags, budget),
          amenities: this.extractAmenities(el.tags)
        }))
        .slice(0, 8);
    } catch (error) {
      console.error('Error fetching hotels:', error.message);
      return [];
    }
  }

  // Get weather for a destination
  async getWeather(destination) {
    console.log('getWeather called for', destination, '- API Key:', this.weatherApiKey ? 'Present (len:' + this.weatherApiKey.length + ')' : 'Missing');
    if (!this.weatherApiKey) {
      console.log('Weather API key is missing, returning dummy data');
      return {
        temp: 25,
        description: 'Weather data unavailable',
        humidity: 'N/A',
        windSpeed: 'N/A'
      };
    }

    try {
      const coords = await this.getCoordinates(destination);
      const { lat, lon } = coords;

      const response = await axios.get(`${this.weatherBaseUrl}/weather`, {
        params: {
          lat,
          lon,
          appid: this.weatherApiKey,
          units: 'metric'
        },
        timeout: 5000
      });

      return {
        temp: Math.round(response.data.main.temp),
        description: response.data.weather[0].description,
        humidity: response.data.main.humidity,
        windSpeed: response.data.wind.speed
      };
    } catch (error) {
      console.error('Error fetching weather:', error.message);
      return {
        temp: 25,
        description: 'Weather data unavailable',
        humidity: 'N/A',
        windSpeed: 'N/A'
      };
    }
  }

  // Helper: Generate description
  generateDescription(tags) {
    const name = tags.name || 'Attraction';
    const type = tags.tourism || tags.historic || tags.natural || tags.leisure || 'place';
    return `${name} is a popular ${type} worth visiting.`;
  }

  // Helper: Get price level
  getPriceLevel(tags, budget) {
    if (budget === 'low') return '$';
    if (budget === 'high') return '$$$';
    return '$$';
  }

  // Helper: Extract amenities
  extractAmenities(tags) {
    const amenities = [];
    if (tags.wifi === 'yes') amenities.push('WiFi');
    if (tags.parking === 'yes') amenities.push('Parking');
    if (tags.air_conditioning === 'yes') amenities.push('AC');
    if (tags.breakfast === 'yes') amenities.push('Breakfast');
    return amenities;
  }

  // Get budget symbol
  getBudgetSymbol(budget) {
    if (budget === 'low') return '$';
    if (budget === 'high') return '$$$';
    return '$$';
  }
}

const freeDataService = new FreeDataService();

export default freeDataService;

// Named exports for convenience
export const getAttractions = (destination, budget) => freeDataService.getAttractions(destination, budget);
export const getRestaurants = (destination, budget) => freeDataService.getRestaurants(destination, budget);
export const getHotels = (destination, budget) => freeDataService.getHotels(destination, budget);
export const getWeather = (destination) => freeDataService.getWeather(destination);
export const getBudgetSymbol = (budget) => freeDataService.getBudgetSymbol(budget);
