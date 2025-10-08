// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';
import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import dotenv from "dotenv";
import fetch from 'node-fetch';
import tripRoutes from './routes/tripRoutes.js';
import createHealthRoutes from './routes/healthRoutes.js';
import weatherRoutes from './routes/weatherRoutes.js';
import eventsRoutes from './routes/eventsRoutes.js';
import directionsRoutes from './routes/directionsRoutes.js';
import itineraryRoutes from './routes/itineraryRoutes.js';
import compareRoutes from './routes/compareRoutes.js';
import nearbyRoutes from './routes/nearbyRoutes.js';
import requestLogger from './middleware/requestLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const app = express();
const server = http.createServer(app); // Create HTTP server from Express app
console.log("Amadeus Key:", process.env.AMADEUS_CLIENT_ID);
// --- SOCKET.IO CONFIGURATION ---
const io = new Server(server, {
  path: "/socket.io/",
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

// Handle WebSocket connection errors
io.engine.on("connection_error", (err) => {
  console.error('Socket.IO connection error:', err.message);
  console.error('Error details:', err.description);
  console.error('Error context:', err.context);
});

const PORT = process.env.PORT || 3000; // Running backend on port 3000

// --- MIDDLEWARE ---
// Configure CORS for both HTTP and WebSocket
const corsOptions = {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
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
  ],
  credentials: true
};

// Enable CORS for all routes
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(requestLogger);
app.use('/health', createHealthRoutes(io));
app.use('/api/users', tripRoutes);
app.use('/api', weatherRoutes);
app.use('/api', eventsRoutes);
app.use('/api', directionsRoutes);
app.use('/api', itineraryRoutes);
app.use('/api', compareRoutes);
app.use('/api', nearbyRoutes);
app.use(express.static(path.join(__dirname, '../build')));

// --- RABBITMQ & WEBSOCKET LOGIC (MCP Integration) ---

const RABBITMQ_URL = 'amqp://localhost';
let amqpChannel = null;
const tripSubscribers = new Map(); // Maps trip_id to a client's socket.id

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        console.log(' [Server] Connected to RabbitMQ');

        // Ensure all necessary queues exist
        await channel.assertQueue('trip_requests_queue', { durable: true });
        await channel.assertQueue('trip_status_queue', { durable: true });
        await channel.assertQueue('trip_results_queue', { durable: true });

        // Listener for STATUS updates from the Python orchestrator
        channel.consume('trip_status_queue', (msg) => {
            if (msg !== null) {
                const status = JSON.parse(msg.content.toString());
                if (status.client_sid) {
                    io.to(status.client_sid).emit('status_update', { message: status.message });
                }
                channel.ack(msg);
            }
        });
        
        // Listener for FINAL results from the Python orchestrator
        channel.consume('trip_results_queue', (msg) => {
            if (msg !== null) {
                const result = JSON.parse(msg.content.toString());
                const { trip_id } = result;
                console.log(` [Server] Received final result for trip ${trip_id}`);
                if (tripSubscribers.has(trip_id)) {
                    const clientSid = tripSubscribers.get(trip_id);
                    io.to(clientSid).emit('trip_result', result);
                    tripSubscribers.delete(trip_id); // Clean up
                }
                channel.ack(msg);
            }
        });
        
        amqpChannel = channel;
    } catch (error) {
        console.error(' [Server] RabbitMQ connection error. Retrying...', error);
        setTimeout(connectRabbitMQ, 5000);
    }
}

io.on('connection', (socket) => {
    console.log(` [Server] Client connected: ${socket.id}`);

    // This is the new endpoint for planning a trip with the agent system
    socket.on('plan_trip', (data) => {
        if (!amqpChannel) {
            return socket.emit('status_update', { message: 'Error: Backend is not ready.' });
        }
        
        const trip_id = uuidv4();
        tripSubscribers.set(trip_id, socket.id);

        const message = {
            trip_id,
            client_sid: socket.id, 
            payload: {
                start_city: data.start_city,
                end_city: data.end_city,
                start_date: data.start_date,
                end_date: data.end_date,
                num_days: parseInt(data.num_days, 10),
            },
        };

        // Send the job to the Python orchestrator
        amqpChannel.sendToQueue('trip_requests_queue', Buffer.from(JSON.stringify(message)), { persistent: true });
        
        console.log(` [Server] Sent job for trip ${trip_id} to orchestrator.`);
        socket.emit('status_update', { message: `Trip request sent for ${data.start_city} to ${data.end_city}.` });
    });

    socket.on('disconnect', () => {
        console.log(` [Server] Client disconnected: ${socket.id}`);
    });
});


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


// This endpoint has been consolidated into the /api/compare endpoint above

// Calculate scores based on available data
function calculateScore(attractions = [], restaurants = []) {
  // If no data, return neutral scores
  if ((!attractions || attractions.length === 0) && (!restaurants || restaurants.length === 0)) {
    return {
      food: 2.5,
      culture: 2.5,
      adventure: 2.5,
      nightlife: 2.0,
      shopping: 2.5,
      overall: 2.5
    };
  }
  
  // Calculate scores based on number of attractions and restaurants
  const maxAttractions = 20; // Consider 20+ attractions as maximum
  const maxRestaurants = 15; // Consider 15+ restaurants as maximum
  
  const attractionScore = Math.min(attractions.length / maxAttractions, 1) * 5;
  const restaurantScore = Math.min(restaurants.length / maxRestaurants, 1) * 5;
  
  const scores = {
    food: parseFloat(restaurantScore.toFixed(1)),
    culture: parseFloat(attractionScore.toFixed(1)),
    adventure: parseFloat(((attractionScore * 0.6) + (restaurantScore * 0.4)).toFixed(1)),
    nightlife: parseFloat((restaurantScore * 0.8).toFixed(1)),
    shopping: parseFloat(((attractionScore * 0.4) + (restaurantScore * 0.6)).toFixed(1))
  };
  
  // Calculate overall score (weighted average)
  const weights = {
    food: 0.2,
    culture: 0.25,
    adventure: 0.25,
    nightlife: 0.15,
    shopping: 0.15
  };
  
  scores.overall = parseFloat((
    scores.food * weights.food +
    scores.culture * weights.culture +
    scores.adventure * weights.adventure +
    scores.nightlife * weights.nightlife +
    scores.shopping * weights.shopping
  ).toFixed(1));
  
  return scores;
}

// Generate pros and cons based on data
function generateProsConsWeather(weather = {}, attractions = [], restaurants = [], destName = '') {
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
    cons.push('Limited information available');
  }

  return { pros, cons };
}

// --- STATIC FRONTEND BUILD (for production) ---
app.use(express.static(path.join(__dirname, "client", "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "dist", "index.html"));
});

// --- ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// --- START SERVER ---
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket server is running on ws://0.0.0.0:${PORT}/socket.io/`);
  console.log('Server is ready to accept connections');
  
  // Connect to RabbitMQ if enabled
  if (process.env.ENABLE_RABBITMQ === 'true') {
    connectRabbitMQ().catch(console.error);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
