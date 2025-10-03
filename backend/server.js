import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import * as freeDataService from './services/freeDataService.js';
import { Orchestrator } from './mcp/Orchestrator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Error loading .env:', result.error);
} else {
  console.log('.env loaded successfully');
  console.log('OPENWEATHER_API_KEY:', process.env.OPENWEATHER_API_KEY ? 'Set' : 'Not set');
}

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
// Use the more specific CORS configuration and allow all necessary headers/methods
app.use(cors({
  origin: "http://localhost:5173", // Your frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization','x-api-key']
}));

app.use(express.json());


// --- HELPER FUNCTIONS for Directions API ---

// Helper function to geocode a location using Nominatim
const geocode = async (place) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`
    );
    const data = await response.json();
    if (!data || data.length === 0) {
      throw new Error('Location not found');
    }
    // Return coordinates in [lon, lat] format as required by OpenRouteService
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error('Failed to geocode location');
  }
};

// Haversine formula to calculate distance between two points in km
const distanceKm = (start, end) => {
  const [lon1, lat1] = start;
  const [lon2, lat2] = end;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};


// --- API ROUTES ---

// == Directions API Route ==
app.get("/api/directions", async (req, res) => {
  const { origin, destination, mode } = req.query;
  const apiKey = process.env.VITE_ORS_API_KEY || process.env.ORS_API_KEY;

  if (!origin || !destination || !mode) {
    return res.status(400).json({ error: "Missing required parameters: origin, destination, and mode are required" });
  }

  try {
    console.log(`Fetching route from ${origin} to ${destination} via ${mode}`);
    
    // Add error handling for geocoding
    let start, end;
    try {
      [start, end] = await Promise.all([
        geocode(origin),
        geocode(destination)
      ]);
    } catch (error) {
      return res.status(400).json({ error: `Failed to geocode locations: ${error.message}` });
    }

    console.log('Geocoded coordinates:', { start, end });

    // Verify coordinates
    if (!start || !end || !Array.isArray(start) || !Array.isArray(end)) {
      return res.status(500).json({ error: 'Invalid geocoding response' });
    }

    let profile = "driving-car";
    if (mode === "walking") profile = "foot-walking";
    else if (mode === "cycling") profile = "cycling-regular";

    const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/geo+json'
      },
      body: JSON.stringify({
        coordinates: [start, end],
        units: 'km',
        language: 'en'
      }),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: 'Invalid response from routing service' };
      }
      console.error('OpenRouteService error:', errorData);
      return res.status(response.status).json({ 
        error: errorData.error?.message || 'Failed to fetch directions',
        details: errorData
      });
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return res.status(404).json({ 
        error: 'No route could be calculated',
        message: 'The routing service could not find a valid route between these points. Try adjusting your start or end points.',
        details: {
          start,
          end,
          mode: profile
        }
      });
    }

    const routeData = data.features[0]; // Take the first (and typically only) route
    const segment = routeData.properties?.segments?.[0];
    
    if (!segment) {
      return res.status(404).json({ 
        error: 'No valid route segments found',
        message: 'The routing service returned an incomplete route. Please try different locations or transportation mode.',
        details: {
          start,
          end,
          mode: profile,
          hasFeatures: data.features?.length > 0,
          hasSegments: data.features?.[0]?.properties?.segments?.length > 0
        }
      });
    }

    res.json({
      distance: segment.distance, // in km
      duration: segment.duration, // in seconds
      steps: segment.steps.map(step => ({
        distance: step.distance,
        duration: step.duration,
        instruction: step.instruction,
        name: step.name || 'Unnamed road'
      })),
      geometry: routeData.geometry
    });

  } catch (error) {
    console.error('Directions error:', error);
    res.status(500).json({ 
      error: 'Failed to calculate route',
      message: error.message 
    });
  }
});


// == Itinerary API Route ==
app.post('/api/itinerary', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 8);
  console.log(`\n=== New Itinerary Request (ID: ${requestId}) ===`);
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { destination, days, interests, startDate, budget, travelers } = req.body;

    if (!destination || !days || !startDate) {
      const errorMsg = 'Missing required fields: destination, days, and startDate';
      console.error(`[${requestId}] Error: ${errorMsg}`);
      return res.status(400).json({ error: errorMsg });
    }
    
    console.log(`[${requestId}] Fetching data for ${days}-day trip to ${destination}`);

    // Fetch all data in parallel from the mock service
    const [attractions, restaurants, hotels, weather] = await Promise.all([
        freeDataService.getAttractions(destination, budget),
        freeDataService.getRestaurants(destination, budget),
        freeDataService.getHotels(destination, budget),
        freeDataService.getWeather(destination)
    ]);
    
    console.log(`[${requestId}] Data fetched: ${attractions.length} attractions, ${restaurants.length} restaurants, ${hotels.length} hotels.`);

    // Handle empty data
    if (attractions.length === 0) {
      attractions.push({ name: `${destination} City Center`, description: 'Explore the city center', coordinates: { lat: 0, lon: 0 } });
    }
    if (restaurants.length === 0) {
      restaurants.push({ name: 'Local Restaurant', cuisine: 'Local', description: 'Try local cuisine', priceLevel: '$$', coordinates: { lat: 0, lon: 0 } });
    }

    // --- Itinerary Generation Logic ---
    let itineraryDays = [];
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + i);
        
        // Use modulo to cycle through available data if there aren't enough unique items
        const morningAttraction = attractions[i % attractions.length];
        const lunchRestaurant = restaurants[i % restaurants.length];
        const eveningRestaurant = restaurants[(i + 1) % restaurants.length]; // Different one for dinner

        // Format location string from coordinates
        const formatLocation = (item) => {
          if (item.coordinates) {
            return `${item.coordinates.lat.toFixed(4)}, ${item.coordinates.lon.toFixed(4)}`;
          }
          return destination;
        };

        itineraryDays.push({
            id: i + 1,
            date: currentDate.toISOString().split('T')[0],
            title: `Day ${i + 1}: Exploration & Culture`,
            activities: [
                { 
                  id: 1, 
                  time: '09:00', 
                  title: `Visit ${morningAttraction.name}`, 
                  type: 'sightseeing', 
                  location: formatLocation(morningAttraction), 
                  notes: morningAttraction.description || 'Explore this attraction', 
                  duration: '3h' 
                },
                { 
                  id: 2, 
                  time: '12:30', 
                  title: `Lunch at ${lunchRestaurant.name}`, 
                  type: 'meal', 
                  location: formatLocation(lunchRestaurant), 
                  notes: `${lunchRestaurant.cuisine || 'Local'} cuisine`, 
                  duration: '1h 30m', 
                  price: lunchRestaurant.priceLevel || '$$' 
                },
                { 
                  id: 3, 
                  time: '19:00', 
                  title: `Dinner at ${eveningRestaurant.name}`, 
                  type: 'meal', 
                  location: formatLocation(eveningRestaurant), 
                  notes: `${eveningRestaurant.cuisine || 'Local'} cuisine`, 
                  duration: '2h', 
                  price: eveningRestaurant.priceLevel || '$$' 
                },
            ]
        });
    }

    const itinerary = {
        destination,
        duration: `${days} days`,
        travelDates: `${start.toLocaleDateString()} - ${new Date(start.getTime() + (days - 1) * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
        travelers,
        budget: freeDataService.getBudgetSymbol(budget),
        weather,
        days: itineraryDays,
    };

    console.log(`[${requestId}] ✅ Itinerary generated successfully for ${destination}`);
    res.json(itinerary);

  } catch (error) {
    console.error(`[${requestId}] Error generating itinerary:`, error);
    res.status(500).json({ error: 'Failed to generate itinerary', message: error.message });
  }
});


// == Compare Destinations API Route ==
app.post('/api/compare', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 8);
  console.log(`\n=== New Compare Request (ID: ${requestId}) ===`);
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { destination1, destination2 } = req.body;

    if (!destination1 || !destination2) {
      const errorMsg = 'Missing required fields: destination1 and destination2';
      console.error(`[${requestId}] Error: ${errorMsg}`);
      return res.status(400).json({ error: errorMsg });
    }

    console.log(`[${requestId}] Fetching comparison data for ${destination1} vs ${destination2}`);

    // Fetch data for both destinations in parallel
    const [dest1Attractions, dest2Attractions, dest1Restaurants, dest2Restaurants, dest1Weather, dest2Weather] = await Promise.all([
      freeDataService.getAttractions(destination1, 'medium'),
      freeDataService.getAttractions(destination2, 'medium'),
      freeDataService.getRestaurants(destination1, 'medium'),
      freeDataService.getRestaurants(destination2, 'medium'),
      freeDataService.getWeather(destination1),
      freeDataService.getWeather(destination2)
    ]);

    // Calculate scores based on available data
    const calculateScore = (attractions, restaurants) => {
      const attractionScore = Math.min(attractions.length / 10, 1) * 5;
      const restaurantScore = Math.min(restaurants.length / 10, 1) * 5;
      return {
        food: restaurantScore,
        culture: attractionScore,
        adventure: (attractionScore + restaurantScore) / 2,
        nightlife: restaurantScore * 0.8,
        shopping: (attractionScore + restaurantScore) / 2 * 0.9
      };
    };

    const dest1Scores = calculateScore(dest1Attractions, dest1Restaurants);
    const dest2Scores = calculateScore(dest2Attractions, dest2Restaurants);

    // Generate pros and cons based on data
    const generateProsConsWeather = (weather, attractions, restaurants, destName) => {
      const pros = [];
      const cons = [];

      // Attractions-based pros/cons
      if (attractions.length > 30) {
        pros.push(`Rich in cultural heritage (${attractions.length}+ attractions)`);
      } else if (attractions.length > 10) {
        pros.push('Plenty of things to see and do');
      } else if (attractions.length > 5) {
        pros.push('Good selection of attractions');
      } else if (attractions.length <= 3) {
        cons.push('Limited tourist attractions');
      }

      // Restaurants-based pros/cons
      if (restaurants.length > 8) {
        pros.push('Excellent dining scene');
      } else if (restaurants.length > 5) {
        pros.push('Good variety of restaurants');
      } else if (restaurants.length <= 2) {
        cons.push('Limited dining options');
      }

      // Weather-based pros/cons
      if (weather && weather.temp !== undefined) {
        if (weather.temp >= 20 && weather.temp <= 28) {
          pros.push(`Perfect weather (${weather.temp}°C)`);
        } else if (weather.temp > 28 && weather.temp <= 32) {
          pros.push('Warm and sunny climate');
        } else if (weather.temp > 32) {
          cons.push(`Very hot weather (${weather.temp}°C)`);
        } else if (weather.temp < 10) {
          cons.push(`Cold weather (${weather.temp}°C)`);
        } else if (weather.temp >= 10 && weather.temp < 20) {
          pros.push('Cool and comfortable temperature');
        }

        // Weather description based insights
        if (weather.description && weather.description.includes('clear')) {
          pros.push('Clear skies for sightseeing');
        } else if (weather.description && weather.description.includes('rain')) {
          cons.push('Rainy conditions');
        }
      }

      // Ensure we always have at least some pros/cons
      if (pros.length === 0) {
        pros.push('Unique travel destination');
        pros.push('Authentic local experience');
      }
      if (cons.length === 0) {
        cons.push('Check visa requirements');
        cons.push('Plan transportation ahead');
      }

      // Limit to top 4 of each
      return { pros: pros.slice(0, 4), cons: cons.slice(0, 4) };
    };

    const dest1ProsCons = generateProsConsWeather(dest1Weather, dest1Attractions, dest1Restaurants);
    const dest2ProsCons = generateProsConsWeather(dest2Weather, dest2Attractions, dest2Restaurants);

    const comparisonData = {
      destination1: {
        name: destination1,
        rating: (Object.values(dest1Scores).reduce((a, b) => a + b, 0) / Object.keys(dest1Scores).length).toFixed(1),
        reviews: `${dest1Attractions.length + dest1Restaurants.length}`,
        description: `Explore ${destination1} with ${dest1Attractions.length} attractions and ${dest1Restaurants.length} restaurants`,
        price: dest1Restaurants.length > 5 ? '$$' : dest1Restaurants.length > 10 ? '$$$' : '$',
        bestTime: dest1Weather ? `${dest1Weather.description}` : 'Check local weather',
        avgTemp: dest1Weather ? `${Math.round(dest1Weather.temp)}°C` : 'N/A',
        highlights: dest1Attractions.slice(0, 4).map(a => a.name),
        categories: dest1Scores,
        pros: dest1ProsCons.pros,
        cons: dest1ProsCons.cons,
        weather: dest1Weather
      },
      destination2: {
        name: destination2,
        rating: (Object.values(dest2Scores).reduce((a, b) => a + b, 0) / Object.keys(dest2Scores).length).toFixed(1),
        reviews: `${dest2Attractions.length + dest2Restaurants.length}`,
        description: `Explore ${destination2} with ${dest2Attractions.length} attractions and ${dest2Restaurants.length} restaurants`,
        price: dest2Restaurants.length > 5 ? '$$' : dest2Restaurants.length > 10 ? '$$$' : '$',
        bestTime: dest2Weather ? `${dest2Weather.description}` : 'Check local weather',
        avgTemp: dest2Weather ? `${Math.round(dest2Weather.temp)}°C` : 'N/A',
        highlights: dest2Attractions.slice(0, 4).map(a => a.name),
        categories: dest2Scores,
        pros: dest2ProsCons.pros,
        cons: dest2ProsCons.cons,
        weather: dest2Weather
      }
    };

    console.log(`[${requestId}] ✅ Comparison data generated successfully`);
    res.json(comparisonData);

  } catch (error) {
    console.error(`[${requestId}] Error generating comparison:`, error);
    res.status(500).json({ error: 'Failed to generate comparison', message: error.message });
  }
});

app.post('/api/plan-trip-mcp', async (req, res) => {
  const orchestrator = new Orchestrator();
  try {
    const plan = await orchestrator.planTrip(req.body);
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to plan trip', message: error.message });
  }
});
// --- START SERVER ---
app.listen(PORT, () => console.log(`🚀 Caravan Compass server running at http://localhost:${PORT}`));
