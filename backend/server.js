// server.js
import express from "express";
import cors from "cors";
import path from "path";
import freeDataService from "./services/freeDataService.js";
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';
import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import dotenv from "dotenv";
import { findEvents } from "./services/cohereEventService.js";
import fetch from 'node-fetch';
import { getToken, getFlights, getHotels } from './services/amadeus.js';
import { getTrains } from './services/trains.js';
import { findCheapestTrip } from './services/optimizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const app = express();
const server = http.createServer(app); // Create HTTP server from Express app

// --- CORS Configuration ---
const allowedOrigins = [
  "http://localhost:5173", 
  "http://127.0.0.1:5173",
  "http://localhost:3000"
];

// Configure CORS with specific options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // Check if the origin is allowed
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log CORS errors for debugging
    console.error('CORS Error: Origin not allowed', origin);
    return callback(new Error(`Not allowed by CORS: ${origin}`), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "X-Requested-With"],
  credentials: true,
  optionsSuccessStatus: 204,
  preflightContinue: false,
  // Enable CORS for all routes
  preflightContinue: false
};

// Apply CORS middleware
console.log('CORS allowed origins:', allowedOrigins);
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Add a test route to verify CORS
app.get('/api/test-cors', (req, res) => {
  res.json({ message: 'CORS is working!', timestamp: new Date().toISOString() });
});

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// API Routes - Must come before static file serving
app.get('/api/*', (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.originalUrl}`);
  next();
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../../The-Ringmasters-Roundtable/dist');
  app.use(express.static(staticPath));
  console.log('Serving static files from:', staticPath);

  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'), (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Error loading the application');
      }
    });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', websocket: io.engine.clientsCount });
});

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
// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "Backend is running" });
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
  const requestId = Math.random().toString(36).substring(2, 8);
  console.log(`\n=== New Compare Request (ID: ${requestId}) ===`);
  
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
    const { destination1, destination2 } = req.body;
    
    if (!destination1 || !destination2) {
      console.error(`[${requestId}] Error: Missing required parameters`);
      return res.status(400).json({ 
        success: false,
        error: "Both destinations are required",
        requestId
      });
    }

    console.log(`[${requestId}] Fetching data for ${destination1} and ${destination2}`);
    console.log(`[${requestId}] Environment check - OPENWEATHER_API_KEY: ${process.env.OPENWEATHER_API_KEY ? 'Present' : 'Missing'}`);

    // Test coordinates lookup first with error handling
    console.log(`[${requestId}] Testing coordinates lookup for ${destination1}...`);
    let coords1;
    try {
      coords1 = await freeDataService.getCoordinates(destination1);
      console.log(`[${requestId}] Coordinates for ${destination1}:`, coords1);
    } catch (error) {
      console.warn(`[${requestId}] Failed to get coordinates for ${destination1}:`, error.message);
      coords1 = { lat: 0, lon: 0 }; // Default fallback
    }

    console.log(`[${requestId}] Testing coordinates lookup for ${destination2}...`);
    let coords2;
    try {
      coords2 = await freeDataService.getCoordinates(destination2);
      console.log(`[${requestId}] Coordinates for ${destination2}:`, coords2);
    } catch (error) {
      console.warn(`[${requestId}] Failed to get coordinates for ${destination2}:`, error.message);
      coords2 = { lat: 0, lon: 0 }; // Default fallback
    }

    // Fetch data for both destinations in parallel with better error handling
    console.log(`[${requestId}] Starting data fetch for both destinations`);
    const results = await Promise.allSettled([
      fetchDestinationData(destination1, requestId),
      fetchDestinationData(destination2, requestId)
    ]);

    // Handle results
    const data1 = results[0].status === 'fulfilled' ? results[0].value : { name: destination1, error: 'Failed to fetch data' };
    const data2 = results[1].status === 'fulfilled' ? results[1].value : { name: destination2, error: 'Failed to fetch data' };

    console.log(`[${requestId}] Data fetch completed:`, {
      dest1: { success: results[0].status === 'fulfilled', dataPoints: Object.keys(data1).length },
      dest2: { success: results[1].status === 'fulfilled', dataPoints: Object.keys(data2).length }
    });

    // Log detailed data for debugging
    console.log(`[${requestId}] Destination 1 data:`, {
      name: data1.name,
      attractions: data1.attractions?.length || 0,
      restaurants: data1.restaurants?.length || 0,
      weather: data1.weather ? 'present' : 'missing'
    });
    console.log(`[${requestId}] Destination 2 data:`, {
      name: data2.name,
      attractions: data2.attractions?.length || 0,
      restaurants: data2.restaurants?.length || 0,
      weather: data2.weather ? 'present' : 'missing'
    });

    // Calculate comparison scores
    const dest1Scores = calculateScore(data1.attractions || [], data1.restaurants || []);
    const dest2Scores = calculateScore(data2.attractions || [], data2.restaurants || []);

    // Generate pros and cons
    const dest1ProsCons = generateProsConsWeather(
      data1.weather || {},
      data1.attractions || [],
      data1.restaurants || [],
      destination1
    );

    const dest2ProsCons = generateProsConsWeather(
      data2.weather || {},
      data2.attractions || [],
      data2.restaurants || [],
      destination2
    );

    const comparisonData = {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      destination1: {
        ...data1,
        coordinates: coords1,
        scores: dest1Scores,
        pros: dest1ProsCons.pros,
        cons: dest1ProsCons.cons,
        // Calculate derived fields for frontend
        rating: dest1Scores.overall.toFixed(1),
        reviews: `${(data1.attractions?.length || 0) + (data1.restaurants?.length || 0)}`,
        description: `Explore ${destination1} with ${(data1.attractions?.length || 0)} attractions and ${(data1.restaurants?.length || 0)} restaurants`,
        price: data1.restaurants?.length > 5 ? '$$' : data1.restaurants?.length > 10 ? '$$$' : '$',
        avgTemp: data1.weather?.temp ? `${Math.round(data1.weather.temp)}°C` : 'N/A',
        weather: data1.weather || { temp: null, description: 'Weather data unavailable', humidity: 'N/A', windSpeed: 'N/A' },
        highlights: data1.attractions?.slice(0, 4).map(a => a.name).filter(name => name && name.length > 0) || []
      },
      destination2: {
        ...data2,
        coordinates: coords2,
        scores: dest2Scores,
        pros: dest2ProsCons.pros,
        cons: dest2ProsCons.cons,
        // Calculate derived fields for frontend
        rating: dest2Scores.overall.toFixed(1),
        reviews: `${(data2.attractions?.length || 0) + (data2.restaurants?.length || 0)}`,
        description: `Explore ${destination2} with ${(data2.attractions?.length || 0)} attractions and ${(data2.restaurants?.length || 0)} restaurants`,
        price: data2.restaurants?.length > 5 ? '$$' : data2.restaurants?.length > 10 ? '$$$' : '$',
        avgTemp: data2.weather?.temp ? `${Math.round(data2.weather.temp)}°C` : 'N/A',
        weather: data2.weather || { temp: null, description: 'Weather data unavailable', humidity: 'N/A', windSpeed: 'N/A' },
        highlights: data2.attractions?.slice(0, 4).map(a => a.name).filter(name => name && name.length > 0) || []
      },
      comparison: {
        winner: dest1Scores.overall > dest2Scores.overall ? destination1 : destination2,
        scores: {
          [destination1]: dest1Scores.overall,
          [destination2]: dest2Scores.overall
        },
        winnerScores: dest1Scores.overall > dest2Scores.overall ? dest1Scores : dest2Scores,
        winnerName: dest1Scores.overall > dest2Scores.overall ? destination1 : destination2
      }
    };

    console.log(`[${requestId}] Comparison data prepared`);
    console.log(`[${requestId}] Final response structure:`, {
      dest1: {
        name: comparisonData.destination1.name,
        rating: comparisonData.destination1.rating,
        attractions: comparisonData.destination1.attractions?.length || 0,
        restaurants: comparisonData.destination1.restaurants?.length || 0,
        highlights: comparisonData.destination1.highlights?.length || 0,
        weather: comparisonData.destination1.weather?.temp ? 'present' : 'missing'
      },
      dest2: {
        name: comparisonData.destination2.name,
        rating: comparisonData.destination2.rating,
        attractions: comparisonData.destination2.attractions?.length || 0,
        restaurants: comparisonData.destination2.restaurants?.length || 0,
        highlights: comparisonData.destination2.highlights?.length || 0,
        weather: comparisonData.destination2.weather?.temp ? 'present' : 'missing'
      }
    });
    res.json(comparisonData);
  } catch (error) {
    console.error(`[${requestId}] Error in /api/compare:`, error);
    res.status(500).json({ 
      success: false,
      requestId,
      error: "Failed to compare destinations",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

async function fetchDestinationData(destination, requestId) {
  console.log(`[${requestId}] Starting fetchDestinationData for ${destination}`);
  try {
    console.log(`[${requestId}] Fetching data for ${destination}`);

    // Fetch data in parallel
    const [attractions, restaurants, hotels, weather] = await Promise.all([
      freeDataService.getAttractions(destination).catch(err => {
        console.error(`[${requestId}] Error fetching attractions for ${destination}:`, err.message);
        return [];
      }),
      freeDataService.getRestaurants(destination).catch(err => {
        console.error(`[${requestId}] Error fetching restaurants for ${destination}:`, err.message);
        return [];
      }),
      freeDataService.getHotels(destination).catch(err => {
        console.error(`[${requestId}] Error fetching hotels for ${destination}:`, err.message);
        return [];
      }),
      freeDataService.getWeather(destination).catch(err => {
        console.error(`[${requestId}] Error fetching weather for ${destination}:`, err.message);
        return null;
      })
    ]);

    console.log(`[${requestId}] Data fetched for ${destination}:`, {
      attractions: attractions?.length || 0,
      restaurants: restaurants?.length || 0,
      hotels: hotels?.length || 0,
      weather: weather ? 'success' : 'failed'
    });

    return {
      name: destination,
      attractions: attractions?.slice(0, 10) || [], // Limit to prevent large responses
      restaurants: restaurants?.slice(0, 8) || [], // Limit to prevent large responses
      hotels: hotels?.slice(0, 5) || [], // Limit to prevent large responses
      weather: weather || { error: 'Weather data unavailable' },
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`[${requestId}] Error in fetchDestinationData for ${destination}:`, error);
    return {
      name: destination,
      error: `Failed to fetch data: ${error.message}`,
      lastUpdated: new Date().toISOString()
    };
  }
}


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
app.get("/api/test", (req, res) => {
  res.json({ status: "Backend working!" });
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
    
    const token = await getToken();
    const flights = await getFlights(token, origin, destination, date);
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


// Initialize data fetching
console.log("Fetching data...");

(async () => {
  try {
    // Get Amadeus access token
    const token = await getToken();

    // Fetch all travel data in parallel with default values
    const defaultOrigin = 'DEL'; // Delhi
    const defaultDestination = 'BOM'; // Mumbai
    const defaultDate = new Date().toISOString().split('T')[0]; // Today's date
    
    const [flights, hotels, trains] = await Promise.all([
      getFlights(token, defaultOrigin, defaultDestination, defaultDate, 1, 3).catch(err => {
        console.error('Error fetching flights:', err.message);
        return [];
      }),
      getHotels(token).catch(err => {
        console.error('Error fetching hotels:', err.message);
        return [];
      }),
      getTrains(defaultOrigin, defaultDestination, defaultDate).catch(err => {
        console.error('Error fetching trains:', err.message);
        return [];
      }),
    ]);

    console.log("Flights fetched:", flights);
    console.log("Hotels fetched:", hotels);
    console.log("Trains fetched:", trains);

    // Find cheapest trip
    const cheapestTrip = findCheapestTrip(flights, trains, hotels);
    console.log("Cheapest Trip:", cheapestTrip);

    // Optional AI recommendation
    // const aiRecommendation = await aiSuggest([
    //   ...flights,
    //   ...trains,
    //   ...hotels,
    // ]);
    // console.log("AI Recommendation:\n", aiRecommendation);
  } catch (err) {
    console.error("Error fetching travel data:", err);
  }
})();

// ====== Travel Route ======
// Common IATA airport codes for validation
const IATA_CODES = new Set([
  'DEL', 'BOM', 'MAA', 'BLR', 'HYD', 'CCU', 'GOI', 'COK', 'PNQ', 'AMD', 'JAI',
  'SIN', 'BKK', 'DXB', 'LHR', 'JFK', 'LAX', 'CDG', 'FRA', 'HKG', 'SYD'
]);

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

    // Convert city names to IATA codes
    const getCityCode = (city) => {
      if (!city) return 'DEL'; // Default to Delhi if no city provided
      const lowerCity = city.toString().toLowerCase().trim();
      return cityCodeMap[lowerCity] || 'DEL'; // Default to Delhi if city not found
    };

    const originCode = getCityCode(origin);
    const destCode = getCityCode(destination);

    // Log the converted codes for debugging
    console.log(`[${requestId}] Converted city codes:`, { origin, originCode, destination, destCode });
    
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
    
    // Fetch data in parallel
    const [flights, hotels, rawTrains] = await Promise.all([
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
          const data = await getHotels(destCode, hotelCheckIn, hotelCheckOut, adults);
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
          const data = await getTrains(originCode, destCode, date);
          console.log(`[${requestId}] Successfully fetched ${data?.length || 0} trains`);
          return data || [];
        } catch (err) {
          console.error(`[${requestId}] Error fetching trains:`, err);
          return [];
        }
      })()
    ]);

    // Log raw data for debugging
    console.log(`[${requestId}] Raw data received:`);
    console.log(`[${requestId}] Flights (${flights?.length || 0}):`, JSON.stringify(flights, null, 2));
    console.log(`[${requestId}] Hotels (${hotels?.length || 0}):`, JSON.stringify(hotels, null, 2));
    console.log(`[${requestId}] Raw trains (${rawTrains?.length || 0}):`, JSON.stringify(rawTrains, null, 2));

    // Log raw trains data for debugging
    console.log(`[${requestId}] Raw trains data:`, JSON.stringify(rawTrains, null, 2));
    
    // Format trains data to match frontend expectations
    const trains = rawTrains.map((train) => {
      const trainData = train.train_base || {};
      const formattedTrain = {
        type: 'train',
        provider: 'Indian Railways',
        from: trainData.from_stn_name || train.from || origin.toUpperCase(),
        to: trainData.to_stn_name || train.to || destination.toUpperCase(),
        fromCode: trainData.from_stn_code || origin.slice(0, 3).toUpperCase(),
        toCode: trainData.to_stn_code || destination.slice(0, 3).toUpperCase(),
        price: Number(train.price) || 0, // Ensure price is a number
        duration: trainData.travel_time || 'N/A',
        details: {
          trainName: trainData.train_name || 'Express',
          trainNumber: trainData.train_no || 'N/A',
          departureTime: trainData.from_time || 'N/A',
          arrivalTime: trainData.to_time || 'N/A',
          runningDays: trainData.running_days || 'Daily',
          class: train.class || 'SL',
          seatsAvailable: train.seats_available || 0
        }
      };
      
      console.log(`[${requestId}] Formatted train:`, JSON.stringify(formattedTrain, null, 2));
      return formattedTrain;
    });

    // Format flights and hotels to ensure price is a number
    const formattedFlights = (Array.isArray(flights) ? flights : []).map(flight => ({
      ...flight,
      price: Number(flight.price) || 0,
    }));

    const formattedHotels = (Array.isArray(hotels) ? hotels : []).map(hotel => ({
      ...hotel,
      price: Number(hotel.price) || 0,
    }));

    const formattedTrains = Array.isArray(trains) ? trains : [];

    console.log('Formatted data for cheapest trip calculation:', {
      flights: formattedFlights,
      trains: formattedTrains,
      hotels: formattedHotels
    });

    // Log formatted data before finding cheapest trip
    console.log(`[${requestId}] Formatted flights:`, JSON.stringify(formattedFlights, null, 2));
    console.log(`[${requestId}] Formatted hotels:`, JSON.stringify(formattedHotels, null, 2));
    console.log(`[${requestId}] Formatted trains:`, JSON.stringify(formattedTrains, null, 2));
    
    // Find cheapest trip
    const cheapestTrip = findCheapestTrip(formattedFlights, formattedTrains, formattedHotels);
    console.log(`[${requestId}] Cheapest trip result:`, JSON.stringify(cheapestTrip, null, 2));
    
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

app.post('/api/plan-trip-mcp', async (req, res) => {
  const orchestrator = new Orchestrator();
  try {
    // TODO: Implement trip planning logic here
    const plan = {
      status: 'not_implemented',
      message: 'Trip planning functionality is not yet implemented'
    };
    res.json(plan);
  } catch (error) {
    console.error('Error in /api/plan-trip-mcp:', error);
    res.status(500).json({ 
      error: 'Failed to plan trip', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
