// server.js
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
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
import communityRoutes from './routes/communityRoutes.js';
import { startOpportunityScheduler, runOpportunityAgent } from './services/opportunityAgent.js';
import opportunityRoutes from './routes/opportunityRoutes.js';
import requestLogger from './middleware/requestLogger.js';
import { getFlights, getHotels } from './services/amadeus.js';
import { getTrains } from './services/trains.js';
import { findCheapestTrip } from './services/optimizer.js';
import crystalBallRoutes from './routes/crystalBallRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
const rootEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: rootEnvPath });
const backendEnvPath = path.resolve(__dirname, '.env');
dotenv.config({ path: backendEnvPath, override: true });

const app = express();
const server = http.createServer(app); // Create HTTP server from Express app
console.log("Amadeus Key:", process.env.AMADEUS_CLIENT_ID);

const ENABLE_RABBITMQ = process.env.ENABLE_RABBITMQ === 'true';
const clientDistPath = path.join(__dirname, "client", "dist");
const hasClientBuild = fs.existsSync(clientDistPath);

const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
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
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
app.use('/api', crystalBallRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/opportunities', opportunityRoutes);
if (hasClientBuild) {
  app.use(express.static(clientDistPath));
}

// --- RABBITMQ & WEBSOCKET LOGIC (MCP Integration) ---

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
let amqpConnection = null;
let amqpChannel = null;
let rabbitReconnectTimer = null;
const tripSubscribers = new Map(); // Maps trip_id to a client's socket.id

const scheduleRabbitReconnect = () => {
  if (rabbitReconnectTimer) return;
  rabbitReconnectTimer = setTimeout(() => {
    rabbitReconnectTimer = null;
    connectRabbitMQ().catch((error) => {
      console.error(' [Server] RabbitMQ reconnection attempt failed:', error.message);
    });
  }, 5000);
};

async function connectRabbitMQ() {
  if (!ENABLE_RABBITMQ) {
    console.warn(' [Server] RabbitMQ connection attempted while disabled.');
    return null;
  }

  if (amqpChannel) {
    return amqpChannel;
  }

    try {
        console.log(` [Server] Attempting to connect to RabbitMQ (${RABBITMQ_URL})...`);
        const connection = await amqp.connect(RABBITMQ_URL);
        amqpConnection = connection;

        connection.on('close', () => {
            console.warn(' [Server] RabbitMQ connection closed. Scheduling reconnect...');
            amqpConnection = null;
            amqpChannel = null;
            scheduleRabbitReconnect();
        });

        connection.on('error', (error) => {
            console.error(' [Server] RabbitMQ connection error:', error.message);
        });

        const channel = await connection.createChannel();
        amqpChannel = channel;
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
        return channel;
    } catch (error) {
        console.error(' [Server] RabbitMQ connection error. Retrying in 5 seconds...', error.message);
        amqpConnection = null;
        amqpChannel = null;
        scheduleRabbitReconnect();
        return null;
    }
}

const ensureRabbitMQ = async () => {
  if (!ENABLE_RABBITMQ) return null;
  if (amqpChannel) return amqpChannel;
  return connectRabbitMQ();
};

// Only attempt to connect to RabbitMQ if enabled
if (ENABLE_RABBITMQ) {
    ensureRabbitMQ().catch((error) => {
        console.error(' [Server] Failed to initialize RabbitMQ:', error.message);
    });
} else {
    console.log(' [Server] RabbitMQ is disabled (ENABLE_RABBITMQ is not set to true)');
}

io.on('connection', (socket) => {
    console.log(` [Server] Client connected: ${socket.id}`);

    // This is the new endpoint for planning a trip with the agent system
    socket.on('plan_trip', async (data) => {
        if (!ENABLE_RABBITMQ) {
            return socket.emit('status_update', {
                error: 'RabbitMQ is not enabled',
                message: 'This feature requires RabbitMQ to be enabled and running.'
            });
        }

        const channel = await ensureRabbitMQ();
        if (!channel) {
            return socket.emit('status_update', { 
                error: 'RabbitMQ is not enabled or not connected',
                message: 'This feature requires RabbitMQ to be enabled and running.' 
            });
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
                transport_mode: data.transport_mode || 'train_flight',
            },
        };

        try {
            // Send the job to the Python orchestrator
            channel.sendToQueue(
              'trip_requests_queue',
              Buffer.from(JSON.stringify(message)),
              { persistent: true }
            );

            console.log(` [Server] Sent job for trip ${trip_id} to orchestrator.`);
            socket.emit('status_update', { message: `Trip request sent for ${data.start_city} to ${data.end_city}.` });
        } catch (error) {
            console.error(' [Server] Failed to enqueue trip request:', error.message);
            socket.emit('status_update', {
              error: 'Failed to queue trip request',
              message: 'RabbitMQ accepted the connection but queueing failed. Check server logs.'
            });
        }
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
if (hasClientBuild) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

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

  startOpportunityScheduler();

  if (process.env.PIP_AGENT_ENABLED === 'true') {
    runOpportunityAgent().catch((error) => {
      console.error('[OpportunityAgent] Initial run failed:', error);
    });
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
// Flight search endpoint
app.get('/api/flights', async (req, res) => {
  try {
    const { origin, destination, date } = req.query;
    
    if (!origin || !destination || !date) {
      return res.status(400).json({
        error: 'Missing required parameters: origin, destination, and date are required'
      });
    }
    
    // getFlights from services/amadeus.js handles token retrieval internally
    const flights = await getFlights(origin, destination, date);
    res.json(flights);
  } catch (error) {
    console.error('Flight search error:', error);
    res.status(500).json({
      error: 'Failed to fetch flights',
      details: error.message
    });
  }
});

// Train search endpoint (support both /api/trains and /trains/getTrainOn for backward compatibility)
app.get(['/api/trains', '/trains/getTrainOn'], async (req, res) => {
  try {
    const { from, to, date } = req.query;
    
    if (!from || !to || !date) {
      return res.status(400).json({
        error: 'Missing required parameters: from, to, and date are required'
      });
    }
    
    // Placeholder response - implement actual train search logic here
    res.json({
      message: 'Train search endpoint',
      from,
      to,
      date,
      trains: []
    });
  } catch (error) {
    console.error('Train search error:', error);
    res.status(500).json({
      error: 'Failed to fetch trains',
      details: error.message
    });
  }
});


// Initialize data fetching (demo logging only)
console.log("Fetching data...");

(async () => {
  try {
    const defaultOrigin = 'DEL';
    const defaultDestination = 'BOM';
    const today = new Date();
    const defaultDate = today.toISOString().split('T')[0];
    const checkoutDateObj = new Date(today);
    checkoutDateObj.setDate(checkoutDateObj.getDate() + 1);
    const defaultCheckOut = checkoutDateObj.toISOString().split('T')[0];

    const [flights, hotels, trains] = await Promise.all([
      getFlights(defaultOrigin, defaultDestination, defaultDate).catch(err => {
        console.error('Error fetching flights:', err.message);
        return [];
      }),
      getHotels(defaultDestination, defaultDate, defaultCheckOut, 1, defaultDestination).catch(err => {
        console.error('Error fetching hotels:', err.message);
        return [];
      }),
      getTrains(defaultOrigin, defaultDestination, defaultDate).catch(err => {
        console.error('Error fetching trains:', err.message);
        return [];
      }),
    ]);

    console.log("Flights fetched:", Array.isArray(flights) ? flights.length : 0);
    console.log("Hotels fetched:", Array.isArray(hotels) ? hotels.length : 0);
    console.log("Trains fetched:", Array.isArray(trains) ? trains.length : 0);

    const cheapestTrip = findCheapestTrip(flights, trains, hotels);
    console.log("Cheapest Trip:", cheapestTrip ? 'available' : 'none');
  } catch (err) {
    console.error("Error fetching travel data:", err.message);
  }
})();

// ====== Travel Route ======
// Common IATA airport codes for validation
const IATA_CODES = new Set([
  'DEL', 'BOM', 'MAA', 'BLR', 'HYD', 'CCU', 'GOI', 'COK', 'PNQ', 'AMD', 'JAI',
  'SIN', 'BKK', 'DXB', 'LHR', 'JFK', 'LAX', 'CDG', 'FRA', 'HKG', 'SYD'
]);

const IATA_TO_RAIL_STATION = {
  BOM: 'CSMT',
  DEL: 'NDLS',
  HYD: 'HYB',
  BLR: 'SBC',
  MAA: 'MAS',
  CCU: 'HWH',
  GOI: 'MAO',
  COK: 'ERS',
  PNQ: 'PUNE',
  AMD: 'ADI',
  JAI: 'JP',
  BBI: 'BBS',
  LKO: 'LKO',
  PAT: 'PNBE',
  GAU: 'GHY'
};

const getRailStationCode = (iataCode) => {
  if (!iataCode) return '';
  return IATA_TO_RAIL_STATION[iataCode] || iataCode;
};


/**
 * GET /api/travel - Search for travel options
 * Query parameters:
 *   - origin: 3-letter IATA code (e.g., DEL, BOM)
 *   - destination: 3-letter IATA code
 *   - date: Departure date in YYYY-MM-DD format
 *   - checkInDate: Check-in date in YYYY-MM-DD format (defaults to departure date)
 *   - checkOutDate: Check-out date in YYYY-MM-DD format (required for hotels)
 *   - adults: Number of adults (default: 1)
 */
app.get("/api/travel", async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 8);
  console.log(`\n=== New Travel Request (ID: ${requestId}) ===`);
  
  try {
    // Extract parameters
    const origin = String(req.query.origin || '').trim().toUpperCase();
    const destination = String(req.query.destination || '').trim().toUpperCase();
    const date = String(req.query.date || '').trim();
    const checkInDate = String(req.query.checkInDate || date).trim();
    const checkOutDate = String(req.query.checkOutDate || '').trim();
    const adults = parseInt(req.query.adults) || 1;
    
    // Log raw parameters for debugging
    console.log(`[${requestId}] Raw parameters:`, {
      origin,
      destination,
      date,
      checkInDate,
      checkOutDate,
      adults
    });

    // Log request for debugging
    console.log(`[${requestId}] Request:`, {
      origin,
      destination,
      date,
      checkInDate,
      checkOutDate,
      adults
    });

    // Validate parameters
    const errors = [];
    const today = new Date().toISOString().split('T')[0];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Validate IATA codes format (3 uppercase letters)
    const iataRegex = /^[A-Z]{3}$/;
    if (!origin || !iataRegex.test(origin)) {
      errors.push(`Invalid origin: '${origin}'. Must be a 3-letter IATA code (e.g., DEL, BOM)`);
    } else if (!IATA_CODES.has(origin)) {
      console.warn(`[${requestId}] Warning: Origin '${origin}' is not in the list of known IATA codes`);
    }
    
    if (!destination || !iataRegex.test(destination)) {
      errors.push(`Invalid destination: '${destination}'. Must be a 3-letter IATA code`);
    } else if (!IATA_CODES.has(destination)) {
      console.warn(`[${requestId}] Warning: Destination '${destination}' is not in the list of known IATA codes`);
    }
    
    // Validate dates
    if (!date || !dateRegex.test(date)) {
      errors.push(`Invalid date format: '${date}'. Use YYYY-MM-DD`);
    } else if (date < today) {
      errors.push(`Departure date cannot be in the past: ${date}`);
    }

    if (!checkInDate || !dateRegex.test(checkInDate)) {
      errors.push(`Invalid check-in date: '${checkInDate}'. Use YYYY-MM-DD`);
    } else if (checkInDate < today) {
      errors.push(`Check-in date cannot be in the past: ${checkInDate}`);
    }

    if (!checkOutDate || !dateRegex.test(checkOutDate)) {
      errors.push(`Invalid check-out date: '${checkOutDate}'. Use YYYY-MM-DD`);
    } else if (checkOutDate <= checkInDate) {
      errors.push(`Check-out date must be after check-in date (${checkInDate} < ${checkOutDate})`);
    }

      // Return validation errors if any
      if (errors.length > 0) {
        console.error(`[${requestId}] Validation failed:`, errors);
        return res.status(400).json({ 
          success: false,
          errors,
          requestId,
          receivedParams: req.query
        });
      }

      console.log(`[${requestId}] Fetching travel data for ${origin} to ${destination} on ${date}`);
      console.log(`[${requestId}] Check-in: ${checkInDate}, Check-out: ${checkOutDate}, Adults: ${adults}`);
      
      // Log environment variables (without sensitive data)
      console.log(`[${requestId}] Environment:`, {
        NODE_ENV: process.env.NODE_ENV,
        AMADEUS_CLIENT_ID: process.env.AMADEUS_CLIENT_ID ? '***' + process.env.AMADEUS_CLIENT_ID.slice(-4) : 'MISSING',
        AMADEUS_CLIENT_SECRET: process.env.AMADEUS_CLIENT_SECRET ? '***' + process.env.AMADEUS_CLIENT_SECRET.slice(-4) : 'MISSING'
      });

      // City code mapping for common cities (case-insensitive)
      const cityCodeMap = {
        'bombay': 'BOM',
        'bangalore': 'BLR',
        'chennai': 'MAA',
        'kolkata': 'CCU',
        'hyderabad': 'HYD',
        'pune': 'PNQ',
        'ahmedabad': 'AMD',
        'goa': 'GOI',
      'kochi': 'COK',
      'jaipur': 'JAI',
      'lucknow': 'LKO',
      'patna': 'PAT',
      'guwahati': 'GAU',
      'chandigarh': 'IXC',
      'amritsar': 'ATQ',
      'varanasi': 'VNS',
      'indore': 'IDR',
      'bhopal': 'BHO',
      'raipur': 'RPR',
      'nagpur': 'NAG',
      'vadodara': 'BDQ',
      'surat': 'STV',
      'rajkot': 'RAJ',
      'bhubaneswar': 'BBI',
      'visakhapatnam': 'VTZ',
      'coimbatore': 'CJB',
      'kozhikode': 'CCJ',
      'mangalore': 'IXE',
      'goa': 'GOI',
      'srinagar': 'SXR',
      'jammu': 'IXJ',
      'leh': 'IXL',
      'shimla': 'SLV',
      'manali': 'KUU',
      'dharamshala': 'DHM',
      'dehradun': 'DED',
      'udaipur': 'UDR',
      'jodhpur': 'JDH',
      'jaisalmer': 'JSA',
      'jabalpur': 'JLR',
      'gwalior': 'GWL',
      'bikaner': 'BKB',
      'jodhpur': 'JDH',
      'jaisalmer': 'JSA',
      'jabalpur': 'JLR',
      'gwalior': 'GWL',
      'bikaner': 'BKB',
      'jodhpur': 'JDH',
      'jaisalmer': 'JSA',
      'jabalpur': 'JLR',
      'gwalior': 'GWL',
      'bikaner': 'BKB'
    };

    // Convert input to IATA code when needed: if already a 3-letter code, keep it; otherwise map common city names
    const getCityCode = (place) => {
      if (!place) return 'DEL';
      const str = place.toString().trim();
      const upper = str.toUpperCase();
      // If it's already a 3-letter code, use it directly
      if (/^[A-Z]{3}$/.test(upper)) return upper;
      // Otherwise map known city names (case-insensitive)
      const lower = str.toLowerCase();
      return cityCodeMap[lower] || 'DEL';
    };

    const originCode = getCityCode(origin);
    const destCode = getCityCode(destination);

    // Log the converted codes for debugging
    console.log(`[${requestId}] Converted city codes:`, { origin, originCode, destination, destCode });
    const originRailCode = getRailStationCode(originCode);
    const destRailCode = getRailStationCode(destCode);
    console.log(`[${requestId}] Rail station codes:`, { originRailCode, destRailCode });
    
    // Validate date format (YYYY-MM-DD)
    if (!dateRegex.test(date)) {
      throw new Error('Invalid date format. Please use YYYY-MM-DD');
    }

    // Prepare hotel check-in/check-out dates with validation
    let hotelCheckIn, hotelCheckOut;
    try {
      hotelCheckIn = checkInDate || date;
      
      // If no check-out date provided, default to check-in + 1 day
      if (!checkOutDate) {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        hotelCheckOut = nextDay.toISOString().split('T')[0];
      } else {
        hotelCheckOut = checkOutDate;
      }
      
      // Final validation of dates
      if (new Date(hotelCheckOut) <= new Date(hotelCheckIn)) {
        throw new Error('Check-out date must be after check-in date');
      }
    } catch (error) {
      console.error(`[${requestId}] Error processing dates:`, error);
      errors.push(`Invalid date range: ${error.message}`);
    }
    
    console.log(`[${requestId}] Starting data fetch...`);
    console.log(`[${requestId}] Flight search: ${originCode} -> ${destCode} on ${date}`);
    console.log(`[${requestId}] Hotel search: ${destCode} from ${hotelCheckIn} to ${hotelCheckOut}`);
    console.log(`[${requestId}] Train search: ${originRailCode} -> ${destRailCode} on ${date}`);
    
    // Fetch data in parallel
    const [flightsRaw, hotelsRaw, rawTrains] = await Promise.all([
      // Flights
      (async () => {
        try {
          const data = await getFlights(originCode, destCode, date);
          console.log(`[${requestId}] Successfully fetched ${data?.length || 0} flights`);
          if (data.length === 0) {
            console.log(`[${requestId}] No flights found. This could be due to no availability or API limits.`);
          } else {
            console.log(`[${requestId}] Sample flight:`, JSON.stringify(data[0], null, 2));
          }
          return data || [];
        } catch (err) {
          console.error(`[${requestId}] Error fetching flights:`, err.message);
          console.error(`[${requestId}] Error stack:`, err.stack);
          return [];
        }
      })(),
      
      // Hotels
      (async () => {
        try {
          const data = await getHotels(destCode, hotelCheckIn, hotelCheckOut, adults, destination);
          console.log(`[${requestId}] Successfully fetched ${data?.length || 0} hotels`);
          if (data.length === 0) {
            console.log(`[${requestId}] No hotels found. This could be due to no availability or API limits.`);
          } else {
            console.log(`[${requestId}] Sample hotel:`, JSON.stringify(data[0], null, 2));
          }
          return data || [];
        } catch (err) {
          console.error(`[${requestId}] Error fetching hotels:`, err.message);
          console.error(`[${requestId}] Error stack:`, err.stack);
          return [];
        }
      })(),
        
      // Trains
      (async () => {
        try {
          const data = await getTrains(originRailCode, destRailCode, date);
          console.log(`[${requestId}] Successfully fetched ${data?.length || 0} trains`);
          return data || [];
        } catch (err) {
          console.error(`[${requestId}] Error fetching trains:`, err);
          return [];
        }
      })()
    ]);

    const flights = Array.isArray(flightsRaw) ? flightsRaw : [];
    const hotels = Array.isArray(hotelsRaw) ? hotelsRaw : [];
    const trainsSource = Array.isArray(rawTrains) ? rawTrains : [];

    if (!flights.length) {
      console.warn(`[${requestId}] No flight data available after processing.`);
    }
    if (!hotels.length) {
      console.warn(`[${requestId}] No hotel data available after processing.`);
    }
    if (!trainsSource.length) {
      console.warn(`[${requestId}] No train data available after processing.`);
    }

    // Log data for debugging
    console.log(`[${requestId}] Data used:`);
    console.log(`[${requestId}] Flights (${flights.length}):`, JSON.stringify(flights, null, 2));
    console.log(`[${requestId}] Hotels (${hotels.length}):`, JSON.stringify(hotels, null, 2));
    console.log(`[${requestId}] Trains (${trainsSource.length}):`, JSON.stringify(trainsSource, null, 2));

    // Format trains data to match frontend expectations
    const formattedTrainsRaw = trainsSource.map((train) => {
      const trainData = train.train_base || {};
      const formattedTrain = {
        type: 'train',
        provider: 'Indian Railways',
        from: trainData.from_stn_name || train.from || origin.toUpperCase(),
        to: trainData.to_stn_name || train.to || destination.toUpperCase(),
        fromCode: trainData.from_stn_code || origin.slice(0, 3).toUpperCase(),
        toCode: trainData.to_stn_code || destination.slice(0, 3).toUpperCase(),
        price: (Number.isFinite(Number(train.price)) ? Number(train.price) : undefined),
        currency: Number.isFinite(Number(train.price)) ? 'INR' : undefined,
        duration: trainData.travel_time || 'N/A',
        details: {
          trainName: trainData.train_name || 'Express',
          trainNumber: trainData.train_no || 'N/A',
          departureTime: trainData.from_time || 'N/A',
          arrivalTime: trainData.to_time || 'N/A',
          runningDays: Array.isArray(trainData.running_days_list)
            ? trainData.running_days_list.join(', ')
            : trainData.running_days || 'Daily',
          runningDaysList: Array.isArray(trainData.running_days_list)
            ? trainData.running_days_list
            : undefined,
          class: train.class || 'SL',
          seatsAvailable: train.seats_available || 0
        }
      };
      
      console.log(`[${requestId}] Formatted train:`, JSON.stringify(formattedTrain, null, 2));
      return formattedTrain;
    });

    // Format flights and hotels to ensure price is a number and carry currency
    const formattedFlights = (Array.isArray(flights) ? flights : []).map(flight => ({
      ...flight,
      price: Number(flight.price) || 0,
      currency: flight.currency || 'INR',
    }));

    const formattedHotels = (Array.isArray(hotels) ? hotels : []).map(hotel => ({
      ...hotel,
      price: Number(hotel.price) || 0,
      currency: hotel.currency || 'INR',
    }));

    const formattedTrains = Array.isArray(formattedTrainsRaw) ? formattedTrainsRaw : [];

    const normalizeTransport = (item) => {
      if (!item) return null;
      const price = Number(item.price);
      const currency = item.currency || item.details?.currency || 'INR';
      const type = item.type || (item.details?.airline ? 'flight' : item.details?.trainName ? 'train' : 'transport');
      return {
        type,
        provider: item.provider || item.details?.airline || item.details?.trainName || 'Unknown',
        from: item.from || item.origin || null,
        to: item.to || item.destination || null,
        price: Number.isFinite(price) && price > 0 ? price : 0,
        currency,
        duration: item.duration || item.details?.duration || 'N/A',
        departureTime: item.details?.departureTime || item.departureTime || null,
        arrivalTime: item.details?.arrivalTime || item.arrivalTime || null,
        details: item.details || {}
      };
    };

    const normalizeHotel = (item) => {
      if (!item) return null;
      const price = Number(item.price);
      const currency = item.currency || item.details?.currency || 'INR';
      const details = item.details || {};
      return {
        type: 'hotel',
        name: details.hotelName || item.name || 'Hotel',
        price: Number.isFinite(price) && price > 0 ? price : 0,
        currency,
        location: item.location || details.address || destCode,
        checkIn: item.checkIn || details.checkIn || hotelCheckIn || null,
        checkOut: item.checkOut || details.checkOut || hotelCheckOut || null,
        details: {
          ...details,
          hotelName: details.hotelName || item.name || 'Hotel'
        }
      };
    };

    const buildCheapestTripResponse = (trip) => {
      if (!trip) return null;

      let transportCandidate = null;
      let hotelCandidate = null;

      if (trip.transport || trip.hotel) {
        transportCandidate = trip.transport || null;
        hotelCandidate = trip.hotel || null;
      } else if (trip.type === 'hotel') {
        hotelCandidate = trip;
      } else {
        transportCandidate = trip;
      }

      const transport = normalizeTransport(transportCandidate);
      const hotel = normalizeHotel(hotelCandidate);

      if (!transport && !hotel) {
        return null;
      }

      const computedTotal = (transport?.price || 0) + (hotel?.price || 0);
      const rawTotal = Number(trip.totalCost);
      const totalCost = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : computedTotal;

      return {
        transport,
        hotel,
        totalCost,
        currency: transport?.currency || hotel?.currency || 'INR'
      };
    };

    // Find cheapest trip using provider data only
    const cheapestTripRaw = findCheapestTrip(formattedFlights, formattedTrains, formattedHotels);
    console.log(`[${requestId}] Cheapest trip result:`, JSON.stringify(cheapestTripRaw, null, 2));
    const cheapestTrip = buildCheapestTripResponse(cheapestTripRaw);

    if (cheapestTrip) {
      console.log(`[${requestId}] Normalized cheapest trip:`, JSON.stringify(cheapestTrip, null, 2));
    }

    // Prepare the final response
    const result = { 
      flights: formattedFlights,
      hotels: formattedHotels,
      trains: formattedTrains,
      cheapestTrip: cheapestTrip || null
    };
    
    // Log the response structure
    console.log(`[${requestId}] Sending response with data`);
    console.log(`[${requestId}] Response structure:`, {
      flights: { count: result.flights.length, hasPrices: result.flights.some(f => f.price > 0) },
      hotels: { count: result.hotels.length, hasPrices: result.hotels.some(h => h.price > 0) },
      trains: { count: result.trains.length, hasPrices: result.trains.some(t => t.price > 0) },
      hasCheapestTrip: !!result.cheapestTrip
    });
    
    // Send the response
    res.json(result);
  } catch (err) {
    console.error("Error in /api/travel:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});