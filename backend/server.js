import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
import { findEvents } from "./services/cohereEventService.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = 3000; // Forced to 3000 as requested

// --- MIDDLEWARE ---
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173"
];

// CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      console.warn(msg);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "x-api-key",
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Headers"
  ],
  exposedHeaders: [
    "Content-Length", 
    "X-Foo", 
    "X-Bar"
  ]
};

// Enable CORS for all routes
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

app.use(express.json());

// --- ITINERARY ENDPOINT ---
app.post('/api/itinerary', async (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { destination, days, interests, startDate, budget, travelers } = req.body;
    
    if (!destination || !days || !startDate) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['destination', 'days', 'startDate']
      });
    }

    // Import freeDataService
    const freeDataService = (await import('./services/freeDataService.js')).default;
    
    // Fetch real data
    const [attractions, restaurants] = await Promise.all([
      freeDataService.getAttractions(destination, budget),
      freeDataService.getRestaurants(destination, budget)
    ]);

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + parseInt(days) - 1);
    
    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    // Generate daily itineraries with real data
    const daysArray = [];
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      
      // Get attractions and restaurants for this day
      const dayAttractions = attractions.slice(i * 2, (i + 1) * 2);
      // Get two different restaurants for lunch and dinner
      const lunchIndex = (i * 2) % restaurants.length;
      const dinnerIndex = (i * 2 + 1) % restaurants.length;
      const lunchRestaurant = restaurants[lunchIndex];
      const dinnerRestaurant = restaurants[dinnerIndex] || lunchRestaurant; // Fallback to lunch restaurant if no dinner option
      
      const activities = [
        {
          id: 1,
          time: '08:00',
          title: 'Breakfast at Hotel',
          type: 'meal',
          icon: '<FaUtensils className="text-red-500" />',
          location: 'Hotel',
          notes: 'Complimentary breakfast for hotel guests',
          duration: '1h'
        }
      ];

      // Add morning activity (attraction)
      if (dayAttractions[0]) {
        activities.push({
          id: 2,
          time: '10:00',
          title: dayAttractions[0].name,
          type: 'sightseeing',
          icon: '<FaCamera className="text-blue-500" />',
          location: dayAttractions[0].tags?.address || destination,
          notes: dayAttractions[0].description || 'Explore this local attraction',
          duration: '2h',
          price: 'Free'
        });
      }

      // Add lunch
      if (lunchRestaurant) {
        activities.push({
          id: 3,
          time: '12:30',
          title: lunchRestaurant.name || 'Local Restaurant',
          type: 'meal',
          icon: '<FaUtensils className="text-red-500" />',
          location: lunchRestaurant.tags?.address || 'Local Restaurant',
          notes: lunchRestaurant.cuisine ? `Serving ${lunchRestaurant.cuisine}` : 'Local cuisine',
          duration: '1h 30m',
          price: freeDataService.getBudgetSymbol(budget)
        });
      }

      // Add afternoon activity (attraction)
      if (dayAttractions[1]) {
        activities.push({
          id: 4,
          time: '14:30',
          title: dayAttractions[1].name,
          type: 'sightseeing',
          icon: '<FaCamera className="text-blue-500" />',
          location: dayAttractions[1].tags?.address || destination,
          notes: dayAttractions[1].description || 'Explore this local attraction',
          duration: '2h',
          price: 'Free'
        });
      }

      // Add dinner
      if (dinnerRestaurant) {
        activities.push({
          id: 5,
          time: '19:00',
          title: dinnerRestaurant.name || 'Local Restaurant',
          type: 'meal',
          icon: '<FaUtensils className="text-red-500" />',
          location: dinnerRestaurant.tags?.address || 'Local Restaurant',
          notes: dinnerRestaurant.cuisine ? `Serving ${dinnerRestaurant.cuisine}` : 'Local cuisine',
          duration: '2h',
          price: freeDataService.getBudgetSymbol(budget)
        });
      }

      daysArray.push({
        id: i + 1,
        date: formatDate(currentDate),
        title: `Day ${i + 1}: ${destination} Exploration`,
        activities
      });
    }

    const itinerary = {
      destination,
      duration: `${days} days`,
      travelDates: `${formatDate(start)} - ${formatDate(end)}`,
      travelers: parseInt(travelers) || 1,
      budget: freeDataService.getBudgetSymbol(budget),
      days: daysArray
    };

    res.json(itinerary);
  } catch (error) {
    console.error('Error generating itinerary:', error);
    res.status(500).json({ 
      error: 'Failed to generate itinerary',
      details: error.message 
    });
  }
});

// --- EVENTS ENDPOINT ---
app.get("/api/events", async (req, res) => {
  try {
    const { city, category, dateRange } = req.query;
    
    if (!city) {
      return res.status(400).json({ error: "City parameter is required" });
    }

    console.log(`Fetching events for city: ${city}, category: ${category}, dateRange: ${dateRange}`);
    const events = await findEvents(city, dateRange, category);
    
    if (!events || events.length === 0) {
      return res.status(404).json({ 
        error: "No events found",
        message: `Could not find any events in ${city}${category ? ' in the ' + category + ' category' : ''}`
      });
    }
    
    res.json(events);
  } catch (error) {
    console.error("Error in /api/events:", error);
    res.status(500).json({ 
      error: "Failed to fetch events",
      details: error.message 
    });
  }
});
app.use(express.static(path.join(__dirname, '../build')));

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// --- API ROUTES ---

/**
 * Route: GET /api/events
 * Example: /api/events?city=Delhi&category=music&dateRange=next%20week
 */
app.get("/api/events", async (req, res) => {
  try {
    const { city, category, dateRange } = req.query;

    if (!city) {
      return res.status(400).json({ error: "City parameter is required" });
    }

    const events = await findEvents(city, dateRange, category);
    res.json(events);
  } catch (error) {
    console.error("Error in /api/events:", error);
    res.status(500).json({ 
      error: "Failed to fetch events",
      details: error.message 
    });
  }
});

// --- ITINERARY GENERATION ENDPOINT ---
app.post("/api/itinerary", async (req, res) => {
  try {
    const { destination, startDate, endDate, travelers, budget, interests } = req.body;
    
    if (!destination || !startDate || !endDate) {
      return res.status(400).json({ 
        error: "Missing required fields: destination, startDate, and endDate are required" 
      });
    }

    // Generate a sample itinerary (you can replace this with actual logic)
    const sampleItinerary = {
      destination,
      startDate,
      endDate,
      travelers: travelers || 1,
      budget: budget || 'medium',
      interests: interests || [],
      days: [
        {
          date: startDate,
          activities: [
            {
              type: 'attraction',
              name: 'Local Landmark',
              time: '10:00 AM',
              duration: '2 hours',
              description: 'Visit a famous local landmark',
              location: 'City Center',
              cost: 'Free',
              bookingLink: '#'
            },
            {
              type: 'meal',
              name: 'Lunch at Local Restaurant',
              time: '12:30 PM',
              duration: '1.5 hours',
              cuisine: 'Local Cuisine',
              cost: '$$',
              bookingLink: '#'
            },
            {
              type: 'attraction',
              name: 'Museum Visit',
              time: '2:30 PM',
              duration: '2 hours',
              description: 'Explore local history and culture',
              location: 'Museum District',
              cost: '$15 per person',
              bookingLink: '#'
            }
          ]
        }
      ]
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    res.json(sampleItinerary);
  } catch (error) {
    console.error("Error generating itinerary:", error);
    res.status(500).json({
      error: "Failed to generate itinerary",
      details: error.message
    });
  }
});

// --- COMPARE DESTINATIONS ---
app.post("/api/compare", async (req, res) => {
  try {
    const { destination1, destination2 } = req.body;
    
    if (!destination1 || !destination2) {
      return res.status(400).json({ 
        error: "Both destination1 and destination2 are required" 
      });
    }

    // Mock response - replace with actual comparison logic
    const comparisonData = {
      destination1: {
        name: destination1,
        rating: 4.5,
        description: `Compare ${destination1} with ${destination2}`,
        price: "$$",
        bestTime: "All year",
        highlights: ["Attraction 1", "Attraction 2", "Attraction 3"],
        categories: {
          food: 4.2,
          culture: 4.7,
          adventure: 4.0,
          nightlife: 3.8,
          shopping: 4.1
        },
        pros: ["Rich culture", "Great food", "Friendly locals"],
        cons: ["Can be crowded", "Expensive"]
      },
      destination2: {
        name: destination2,
        rating: 4.3,
        description: `Compare ${destination2} with ${destination1}`,
        price: "$$$",
        bestTime: "Spring/Fall",
        highlights: ["Sight 1", "Sight 2", "Sight 3"],
        categories: {
          food: 4.5,
          culture: 4.3,
          adventure: 4.2,
          nightlife: 4.0,
          shopping: 3.9
        },
        pros: ["Beautiful scenery", "Lots of activities", "Great public transport"],
        cons: ["Touristy areas can be expensive", "Language barrier"]
      }
    };

    res.json(comparisonData);
  } catch (error) {
    console.error("Error in /api/compare:", error);
    res.status(500).json({ 
      error: "Failed to compare destinations",
      details: error.message 
    });
  }
});


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


// --- STATIC FRONTEND BUILD (for production) ---
app.use(express.static(path.join(__dirname, "client", "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "dist", "index.html"));
});

// --- ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: "Something went wrong!",
    message: err.message 
  });
});

// --- START SERVER ---
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
});

// Error handling for server
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});

// Log when server is closed
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});