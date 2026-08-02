import axios from 'axios';
import { CityDataFetchError } from '../utils/errors.js';

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
    console.log(`[FreeDataService] Getting coordinates for: ${destination}`);
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
        console.log(`[FreeDataService] Found coordinates for ${destination}:`, { 
          lat: result.lat, 
          lon: result.lon,
          name: result.display_name 
        });
        return {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          display_name: result.display_name
        };
      }
      
      console.warn(`[FreeDataService] No coordinates found for: ${destination}`);
      throw new Error('No results found for the specified location');
    } catch (error) {
      throw new CityDataFetchError(error.message, destination, 'getCoordinates', error);
    }
  }

  // Query Overpass API with exponential backoff (max 3 attempts)
  async queryOverpass(query) {
    const maxRetries = 3;
    let attempt = 1;
    let waitTimeMs = 1000;

    while (attempt <= maxRetries) {
      console.log(`[FreeDataService] Sending query to Overpass API (Attempt ${attempt}/${maxRetries})`);
      try {
        const response = await axios.post(this.overpassBaseUrl, query, {
          headers: { 
            'Content-Type': 'text/plain',
            'User-Agent': 'TravelApp/1.0 (https://yourapp.com; contact@yourapp.com)'
          },
          timeout: 30000
        });
        
        if (!response.data || !Array.isArray(response.data.elements)) {
          console.warn('[FreeDataService] Unexpected response format from Overpass:', response.data);
          return [];
        }
        
        console.log(`[FreeDataService] Received ${response.data.elements.length} elements from Overpass on attempt ${attempt}`);
        return response.data.elements;
      } catch (error) {
        console.error(`[FreeDataService] Overpass API error on attempt ${attempt}:`, error.message);
        if (error.response && error.response.status === 429) {
          console.warn(`[FreeDataService] Overpass rate limit hit.`);
        }
        
        if (attempt === maxRetries) {
          console.error(`[FreeDataService] Exhausted all ${maxRetries} Overpass API attempts.`);
          throw error; // Let the caller wrap it in CityDataFetchError
        }
        
        console.log(`[FreeDataService] Waiting ${waitTimeMs}ms before next Overpass attempt...`);
        await new Promise(r => setTimeout(r, waitTimeMs));
        waitTimeMs *= 2; // Exponential backoff (1s, 2s, 4s)
        attempt++;
      }
    }
  }

  async searchLocations(query, options = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query is required for location search');
    }

    const { limit = 6 } = options;
    const resolvedLimit = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 10);

    try {
      const response = await axios.get(`${this.nominatimBaseUrl}/search`, {
        params: {
          q: query,
          format: 'json',
          addressdetails: 1,
          limit: resolvedLimit,
        },
        headers: {
          'User-Agent': 'TravelApp/1.0 (https://yourapp.com; contact@yourapp.com)',
          Referer: 'https://yourapp.com',
        },
        timeout: 10000,
      });

      if (!Array.isArray(response.data)) {
        return [];
      }

      return response.data.map((result) => ({
        id: `${result.osm_type || 'node'}:${result.osm_id}`,
        name: result.display_name,
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        type: result.type,
        address: result.address || {},
        raw: result,
      }));
    } catch (error) {
      console.error('[FreeDataService] Error searching locations:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  // Get attractions for a destination
  async getAttractions(destination, budget = 'medium') {
    console.log(`[FreeDataService] Fetching attractions for: ${destination}`);
    try {
      const coords = await this.getCoordinates(destination);
      const { lat, lon } = coords;
      console.log(`[FreeDataService] Using coordinates:`, { lat, lon });

      const query = `[out:json][timeout:25];
(
  node["tourism"]["tourism"!~"hotel|guest_house|hostel|motel|apartment|camp_site|caravan_site"](around:5000,${lat},${lon});
  way["tourism"]["tourism"!~"hotel|guest_house|hostel|motel|apartment|camp_site|caravan_site"](around:5000,${lat},${lon});
  relation["tourism"]["tourism"!~"hotel|guest_house|hostel|motel|apartment|camp_site|caravan_site"](around:5000,${lat},${lon});
  node["historic"](around:5000,${lat},${lon});
  way["historic"](around:5000,${lat},${lon});
  relation["historic"](around:5000,${lat},${lon});
  node["leisure"]["leisure"!~"park|pitch|sports_centre|stadium|golf_course|fitness_centre"](around:5000,${lat},${lon});
  way["leisure"]["leisure"!~"park|pitch|sports_centre|stadium|golf_course|fitness_centre"](around:5000,${lat},${lon});
  relation["leisure"]["leisure"!~"park|pitch|sports_centre|stadium|golf_course|fitness_centre"](around:5000,${lat},${lon});
);
out body 50;
>;
out skel qt;`;

      console.log(`[FreeDataService] Executing Overpass query for attractions`);
      const elements = await this.queryOverpass(query);
      console.log(`[FreeDataService] Received ${elements.length} elements from Overpass`);
      
      const attractions = elements
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

      console.log(`[FreeDataService] Found ${attractions.length} attractions for ${destination}`);
      return attractions;
    } catch (error) {
      console.error(`[FreeDataService] Error fetching attractions for ${destination}:`, error.message);
      throw new CityDataFetchError(`Failed to fetch attractions for ${destination}`, destination, 'getAttractions', error);
    }
  }

  async getRestaurants(destination, budget = 'medium') {
    console.log(`[FreeDataService] Fetching restaurants for: ${destination}`);
    try {
      const coords = await this.getCoordinates(destination);
      const { lat, lon } = coords;
      console.log(`[FreeDataService] Using coordinates:`, { lat, lon });

      const query = `[out:json][timeout:25];
(
  node["amenity"="restaurant"](around:3000,${lat},${lon});
  node["amenity"="cafe"](around:3000,${lat},${lon});
  way["amenity"="restaurant"](around:3000,${lat},${lon});
  way["amenity"="cafe"](around:3000,${lat},${lon});
);
out body 20;
>;
out skel qt;`;

      console.log(`[FreeDataService] Executing Overpass query for restaurants`);
      const elements = await this.queryOverpass(query);
      console.log(`[FreeDataService] Received ${elements.length} elements from Overpass`);
      
      const restaurants = elements
        .filter(el => el.tags?.name)
        .map(el => ({
          id: el.id,
          name: el.tags.name || 'Unnamed Restaurant',
          cuisine: el.tags.cuisine ? el.tags.cuisine.split(';')[0] : 'Local',
          description: el.tags.cuisine ? `Serving ${el.tags.cuisine.split(';').join(', ')} cuisine` : 'Local cuisine',
          coordinates: { lat: el.lat || lat, lon: el.lon || lon },
          priceLevel: this.getPriceLevel(el.tags, budget),
          address: el.tags['addr:street'] ? 
            `${el.tags['addr:street']}${el.tags['addr:housenumber'] ? ' ' + el.tags['addr:housenumber'] : ''}` : 
            'Address not available'
        }))
        .slice(0, 15);

      console.log(`[FreeDataService] Found ${restaurants.length} restaurants for ${destination}`);
      return restaurants;
    } catch (error) {
      console.error(`[FreeDataService] Error fetching restaurants for ${destination}:`, error.message);
      throw new CityDataFetchError(`Failed to fetch restaurants for ${destination}`, destination, 'getRestaurants', error);
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
      throw new CityDataFetchError(`Failed to fetch hotels for ${destination}`, destination, 'getHotels', error);
    }
  }

  async getNearbyPlaces({ lat, lon }, options = {}) {
    const { radius = 2500, focus = 'mixed' } = options;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new Error('Latitude and longitude must be provided for nearby search');
    }

    const focusFilters = {
      coffee: [
        'node["amenity"="cafe"]',
        'node["amenity"="coffee_shop"]',
        'node["amenity"="restaurant"]["cuisine"~"coffee|cafe",i]'
      ],
      scenic: [
        'node["tourism"="viewpoint"]',
        'node["natural"="peak"]',
        'node["tourism"="attraction"]["name"~"view|point",i]'
      ],
      mixed: [
        'node["amenity"="cafe"]',
        'node["amenity"="restaurant"]',
        'node["tourism"="viewpoint"]',
        'node["leisure"="park"]',
        'node["tourism"="attraction"]'
      ]
    };

    const filters = focusFilters[focus] || focusFilters.mixed;
    const union = filters
      .map((filter) => `  ${filter}(around:${radius},${lat},${lon});`)
      .join('\n');

    const query = `[out:json][timeout:25];
(
${union}
);
out body 30;
>;
out skel qt;`;

    try {
      const elements = await this.queryOverpass(query);
      return elements
        .filter((el) => el.tags?.name)
        .map((el) => ({
          id: el.id,
          name: el.tags.name,
          type:
            el.tags.cuisine ? 'coffee' :
            el.tags.amenity || el.tags.tourism || el.tags.natural || 'place',
          description: this.generateDescription(el.tags),
          coordinates: {
            lat: el.lat ?? el.center?.lat ?? lat,
            lon: el.lon ?? el.center?.lon ?? lon
          },
          address: el.tags['addr:street']
            ? `${el.tags['addr:street']}${el.tags['addr:housenumber'] ? ' ' + el.tags['addr:housenumber'] : ''}`
            : undefined,
          tags: el.tags
        }));
    } catch (error) {
      console.error('[FreeDataService] Error fetching nearby places:', error.message);
      return [];
    }
  }

  // Get weather data aligned to specific dates
  async getWeather(destination, targetDatesArray = []) {
    console.log(`[FreeDataService] Getting weather for: ${destination} for dates:`, targetDatesArray);
    try {
      if (!this.weatherApiKey) {
        console.error('[FreeDataService] OpenWeatherMap API key is not configured');
        return null;
      }

      const { lat, lon } = await this.getCoordinates(destination);
      
      const response = await axios.get(`${this.weatherBaseUrl}/forecast`, {
        params: {
          lat,
          lon,
          appid: this.weatherApiKey,
          units: 'metric'
        },
        timeout: 10000,
        validateStatus: (status) => status < 500 // Don't throw for 4xx errors
      });

      if (response.status === 200 && response.data && response.data.list) {
        // Group forecasts by date
        const forecastByDate = {};
        for (const item of response.data.list) {
          const dateStr = item.dt_txt.split(' ')[0]; // YYYY-MM-DD
          
          if (!forecastByDate[dateStr]) {
            forecastByDate[dateStr] = [];
          }
          forecastByDate[dateStr].push(item);
        }

        const results = {};
        for (const dateStr of targetDatesArray) {
           if (forecastByDate[dateStr]) {
             // Find closest to noon (12:00:00)
             const noonForecast = forecastByDate[dateStr].find(f => f.dt_txt.includes('12:00:00')) || forecastByDate[dateStr][0];
             results[dateStr] = {
               temp: Math.round(noonForecast.main.temp),
               description: noonForecast.weather[0].description,
               available: true
             };
           } else {
             results[dateStr] = {
               temp: null,
               description: "Forecast unavailable",
               available: false
             };
           }
        }
        return results;
      } else {
        throw new Error(`Weather API returned status: ${response.status}`);
      }
    } catch (error) {
      console.error(`[FreeDataService] Error getting weather for ${destination}:`, error.message);
      // Fail gracefully so trip planning can still proceed even if weather fails
      return null;
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

  // Get driving distance using OSRM
  async getDrivingData(city1, city2) {
    try {
      const c1 = await this.getCoordinates(city1);
      const c2 = await this.getCoordinates(city2);

      const url = `https://router.project-osrm.org/route/v1/driving/${c1.lon},${c1.lat};${c2.lon},${c2.lat}?overview=false`;
      const res = await axios.get(url, { timeout: 10000 });
      
      if (res.data.routes && res.data.routes.length > 0) {
        const distanceKm = (res.data.routes[0].distance / 1000).toFixed(1);
        const durationHrs = (res.data.routes[0].duration / 3600).toFixed(1);
        return { distanceKm: parseFloat(distanceKm), durationHrs: parseFloat(durationHrs) };
      }
      throw new Error('No routes returned from OSRM');
    } catch (err) {
      throw new Error(`Failed to fetch routing data between ${city1} and ${city2}: ${err.message}`);
    }
  }
}

const freeDataService = new FreeDataService();

export default freeDataService;

// Named exports for convenience
export const getAttractions = (destination, budget) => freeDataService.getAttractions(destination, budget);
export const getRestaurants = (destination, budget) => freeDataService.getRestaurants(destination, budget);
export const getHotels = (destination, budget) => freeDataService.getHotels(destination, budget);
export const getWeather = (destination, targetDatesArray) => freeDataService.getWeather(destination, targetDatesArray);
export const getBudgetSymbol = (budget) => freeDataService.getBudgetSymbol(budget);
export const getNearbyPlaces = (coords, options) => freeDataService.getNearbyPlaces(coords, options);
