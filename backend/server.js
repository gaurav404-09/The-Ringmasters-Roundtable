import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import * as freeDataService from './services/freeDataService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}`,
    { headers: { 'User-Agent': 'CaravanCompass/1.0 (your-email@example.com)' } } // IMPORTANT: Change your email
  );
  const geoData = await geoRes.json();
  if (!geoData || !geoData[0]) throw new Error(`Could not geocode the place: ${place}`);
  return [parseFloat(geoData[0].lon), parseFloat(geoData[0].lat)];
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
    const [start, end] = await Promise.all([geocode(origin), geocode(destination)]);
    console.log('Geocoded coordinates:', { start, end });

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
      const errorData = await response.json();
      console.error('OpenRouteService error:', errorData);
      return res.status(response.status).json({ error: errorData.error?.message || 'Failed to fetch directions' });
    }

    const data = await response.json();
    if (!data.features || data.features.length === 0) {
      return res.status(404).json({ error: 'No route could be calculated for the given points' });
    }

    const routeData = data.features.map(f => {
      const segment = f.properties.segments[0];
      return {
        distance: segment.distance, // in km
        duration: segment.duration, // in seconds
        steps: segment.steps,
        geometry: f.geometry
      };
    });

    res.json({ routes: routeData });

  } catch (err) {
    console.error("API fetch error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch data" });
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

        itineraryDays.push({
            id: i + 1,
            date: currentDate.toISOString().split('T')[0],
            title: `Day ${i + 1}: Exploration & Culture`,
            activities: [
                { id: 1, time: '09:00', title: `Visit ${morningAttraction.name}`, type: 'sightseeing', location: morningAttraction.location, notes: morningAttraction.description, duration: '3h' },
                { id: 2, time: '12:30', title: `Lunch at ${lunchRestaurant.name}`, type: 'meal', location: lunchRestaurant.location, notes: `${lunchRestaurant.cuisine} cuisine`, duration: '1h 30m', price: lunchRestaurant.priceRange },
                { id: 3, time: '19:00', title: `Dinner at ${eveningRestaurant.name}`, type: 'meal', location: eveningRestaurant.location, notes: `${eveningRestaurant.cuisine} cuisine`, duration: '2h', price: eveningRestaurant.priceRange },
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


// --- START SERVER ---
app.listen(PORT, () => console.log(`🚀 Caravan Compass server running at http://localhost:${PORT}`));
