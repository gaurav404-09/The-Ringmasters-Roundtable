import { CohereClient } from "cohere-ai";
import freeDataService from "./freeDataService.js";
import { routePlanSchema, criticOutputSchema } from "./schemas.js";
import { 
  PlannerOutputValidationError, 
  CriticOutputValidationError, 
  RouteApprovalExhaustedError, 
  RoutingDataFetchError,
  InsufficientVenueDataError,
  DatabaseConnectionError,
  McpToolCallError
} from "../utils/errors.js";
import { structuredLog } from "../utils/logger.js";
import axios from "axios";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

let cohere = null;
function getCohereClient() {
  if (!cohere) {
    cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
  }
  return cohere;
}

/**
 * Helper to fetch OSRM driving distance/duration between two cities.
 */
async function getDrivingData(city1, city2) {
  try {
    const c1 = await freeDataService.getCoordinates(city1);
    const c2 = await freeDataService.getCoordinates(city2);

    const url = `https://router.project-osrm.org/route/v1/driving/${c1.lon},${c1.lat};${c2.lon},${c2.lat}?overview=false`;
    const res = await axios.get(url, { timeout: 10000 });
    
    if (res.data.routes && res.data.routes.length > 0) {
      const distanceKm = (res.data.routes[0].distance / 1000).toFixed(1);
      const durationHrs = (res.data.routes[0].duration / 3600).toFixed(1);
      return { distanceKm: parseFloat(distanceKm), durationHrs: parseFloat(durationHrs) };
    }
    throw new Error('No routes returned from OSRM');
  } catch (err) {
    throw new RoutingDataFetchError(`Failed to fetch routing data between ${city1} and ${city2}: ${err.message}`, `${city1} -> ${city2}`);
  }
}

/**
 * Agent 1: The Route Planner
 */
async function planRoute(startCity, endCity, numDays, interests, totalDistanceKm, criticFeedbackStr = "") {
  let distanceGuidance = "";
  if (totalDistanceKm > 600) {
    distanceGuidance = `CRITICAL CONSTRAINT: The distance from ${startCity} to ${endCity} is ${totalDistanceKm}km (>600km). You MUST NOT insert intermediate stopover base cities. All days MUST be spent in ${endCity}. You may include nearby attractions (within 150km) as 'day_trip' entries, but the primary base must only be ${endCity}.`;
  } else {
    distanceGuidance = `The distance from ${startCity} to ${endCity} is ${totalDistanceKm}km, which is drivable. You MAY consider splitting days across logical intermediate cities if it makes sense.`;
  }

  const prompt = `You are a Master Travel Route Planner.
A client wants to travel from ${startCity} to ${endCity} for a total of ${numDays} days.
Their interests are: ${interests?.length ? interests.join(', ') : 'general sightseeing'}.

${distanceGuidance}

${criticFeedbackStr ? 'CRITIC FEEDBACK FROM PREVIOUS ATTEMPT:\\n' + criticFeedbackStr + '\\nPlease adjust the route strictly addressing this feedback.' : ''}

The total days across all entries MUST exactly equal ${numDays}. (A day_trip still counts as a day spent on that activity).
Definitions for "type":
- "base": The primary destination or a major hub where the traveler stays for an extended period.
- "stop": An intermediate city where the traveler stays overnight (multi-day) on the way to the destination.
- "day_trip": A same-day excursion radiating from the current base (must not exceed 1 day).

CRITICAL RULE: The user's requested endCity (${endCity}) must always be typed 'base' or 'stop', never 'day_trip'. 'day_trip' is only for attractions/excursions that are not the user's actual requested destination.

If the duration in a base is long (e.g., 3+ days), actively suggest popular day trips radiating from that base (e.g., Ajanta or Ellora Caves from Aurangabad) and explicitly type them as "day_trip".
Return ONLY a JSON object exactly matching this schema:
{
  "travel_plan": [
    { "city": "String", "days": Number, "type": "base" | "stop" | "day_trip" }
  ]
}`;

  const response = await getCohereClient().chat({
    model: "command-r-08-2024",
    message: prompt,
    response_format: { type: "json_object" },
    temperature: 0.5
  });

  try {
    const rawJson = JSON.parse(response.text.trim());
    const parsed = routePlanSchema.parse(rawJson);
    return parsed.travel_plan;
  } catch (e) {
    throw new PlannerOutputValidationError('Failed to validate Planner output: ' + e.message, response.text);
  }
}

/**
 * Agent 2: The Critic
 */
async function critiqueRoute(routePlan, startCity, endCity, numDays, totalDistanceKm) {
  // Grounding the Critic in real OSRM data via MCP
  let groundingData = "";
  if (routePlan.length > 1) {
    groundingData += "\\nREAL DRIVING DISTANCES:\\n";
    let prevCity = startCity;
    
    let mcpClient = null;
    let transport = null;
    try {
      transport = new StdioClientTransport({
        command: "node",
        args: [path.join(__dirname, "../mcp-server/index.js")]
      });
      mcpClient = new Client({ name: "orchestrator", version: "1.0.0" }, { capabilities: {} });
      await mcpClient.connect(transport);
      
      for (const stop of routePlan) {
        if (stop.city !== prevCity) {
          const result = await mcpClient.callTool({
            name: "get_driving_distance",
            arguments: { cityA: prevCity, cityB: stop.city }
          });
          if (result.isError) {
             throw new McpToolCallError("Failed to fetch distance via MCP", result.content[0].text);
          }
          const routeInfo = JSON.parse(result.content[0].text);
          groundingData += `- ${prevCity} to ${stop.city}: ${routeInfo.distanceKm}km, ~${routeInfo.durationHrs}hrs\\n`;
        }
        prevCity = stop.city;
      }
    } finally {
      if (transport) {
         try { await transport.close(); } catch (e) {}
      }
    }
  }

  const prompt = `You are a ruthless Travel Critic Agent.
Evaluate this proposed route from ${startCity} to ${endCity} over ${numDays} days.
Route proposed: ${JSON.stringify(routePlan)}
Total distance: ${totalDistanceKm}km
${groundingData}

Criteria for approval:
1. Does the total number of days strictly equal ${numDays}?
2. Are the driving distances realistic based on the REAL DRIVING DISTANCES provided?
3. CRITICAL >600km RULE: If totalDistanceKm > 600, the Planner is FORBIDDEN from adding intermediate bases or stops. It MUST put all days in ${endCity} (as "base") or its surroundings (as "day_trip"). If the Planner adds ANY "base" or "stop" city other than ${endCity}, you MUST REJECT with reason "logistics". If the only "base" or "stop" is ${endCity}, do NOT reject for this rule, even if startCity is absent.
4. Are "day_trip" locations logically close to the base?

Return ONLY a JSON object exactly matching this schema:
{
  "approved": boolean,
  "reason": "distance" | "logistics" | "duration_mismatch" | "other" (only if approved is false),
  "details": "Detailed string explaining the failure" (only if approved is false),
  "suggestedFix": "Concrete suggestion for the Planner" (only if approved is false)
}`;

  const response = await getCohereClient().chat({
    model: "command-r-08-2024",
    message: prompt,
    response_format: { type: "json_object" },
    temperature: 0.1
  });

  try {
    const rawJson = JSON.parse(response.text.trim());
    return criticOutputSchema.parse(rawJson);
  } catch (e) {
    throw new CriticOutputValidationError('Failed to validate Critic output', response.text);
  }
}

/**
 * Main Pipeline
 */
export async function executeAgenticPipeline(socket, params) {
  const { startCity, endCity, numDays, interests, tripId, startDateStr, endDateStr, startDateObj } = params;

  socket.emit('status_update', { message: `🚀 Initializing Multi-Agent Pipeline: ${startCity} → ${endCity} (${numDays} days)`, stage: 'start' });

  // 1. Grounding upfront total distance
  socket.emit('status_update', { message: `🌍 Fetching real routing data between ${startCity} and ${endCity}...` });
  
  let totalDistanceKm = 0;
  
  let mcpClient = null;
  let transport = null;
  try {
    transport = new StdioClientTransport({
      command: "node",
      args: [path.join(__dirname, "../mcp-server/index.js")]
    });
    mcpClient = new Client({ name: "orchestrator", version: "1.0.0" }, { capabilities: {} });
    await mcpClient.connect(transport);
    
    const result = await mcpClient.callTool({
      name: "get_driving_distance",
      arguments: { cityA: startCity, cityB: endCity }
    });
    if (result.isError) throw new McpToolCallError("Failed to fetch total distance via MCP", result.content[0].text);
    const distData = JSON.parse(result.content[0].text);
    totalDistanceKm = distData.distanceKm;
  } finally {
    if (transport) try { await transport.close(); } catch (e) {}
  }
  
  socket.emit('status_update', { message: `📏 Real distance confirmed: ${totalDistanceKm}km` });

  let routePlan = null;
  let isApproved = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 3;
  const attemptHistory = [];
  let criticFeedbackStr = "";

  // --- AGENT LOOP ---
  while (!isApproved && attempts < MAX_ATTEMPTS) {
    attempts++;
    socket.emit('status_update', { message: `🗺️ Planner Agent: Drafting route (Attempt ${attempts})...` });
    
    const startTimePlan = Date.now();
    routePlan = await planRoute(startCity, endCity, numDays, interests, totalDistanceKm, criticFeedbackStr);
    structuredLog({ step: 'Planner Agent', input: { startCity, endCity, totalDistanceKm, criticFeedbackStr }, output: routePlan, latencyMs: Date.now() - startTimePlan });
    
    socket.emit('status_update', { message: `📍 Planner proposed: ${routePlan.map(r => r.city + ' (' + r.days + 'd, ' + (r.type || 'base') + ')').join(' ➔ ')}` });
    attemptHistory.push({ attempt: attempts, proposed: routePlan });

    const endCityNode = routePlan.find(r => r.city.toLowerCase() === endCity.toLowerCase());
    if (endCityNode && endCityNode.type === 'day_trip') {
       const critique = {
          approved: false,
          reason: 'logistics',
          details: `The user's requested destination (${endCity}) was typed as 'day_trip'. This is invalid.`,
          suggestedFix: `The user's requested endCity (${endCity}) must always be typed 'base' or 'stop', never 'day_trip'.`
       };
       criticFeedbackStr = `Reason: ${critique.reason}. Details: ${critique.details}. Fix: ${critique.suggestedFix}`;
       socket.emit('status_update', { message: `❌ Critic Agent: Rejected plan (${critique.reason}). ${critique.suggestedFix} Asking Planner to revise.` });
       attemptHistory[attemptHistory.length - 1].rejection = critique;
       await new Promise(r => setTimeout(r, 1000));
       continue;
    }

    socket.emit('status_update', { message: `🤔 Critic Agent: Evaluating feasibility of route with live OSRM mapping...` });
    const startTimeCritique = Date.now();
    const critique = await critiqueRoute(routePlan, startCity, endCity, numDays, totalDistanceKm);
    structuredLog({ step: 'Critic Agent', input: routePlan, output: critique, latencyMs: Date.now() - startTimeCritique });

    if (critique.approved) {
      isApproved = true;
      socket.emit('status_update', { message: `✅ Critic Agent: Approved route!` });
      attemptHistory[attemptHistory.length - 1].approved = true;
    } else {
      criticFeedbackStr = `Reason: ${critique.reason}. Details: ${critique.details}. Fix: ${critique.suggestedFix}`;
      socket.emit('status_update', { message: `❌ Critic Agent: Rejected plan (${critique.reason}). ${critique.suggestedFix}. Asking Planner to revise.` });
      attemptHistory[attemptHistory.length - 1].rejection = critique;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!isApproved) {
    socket.emit('status_update', { message: `🚨 Critical Failure: Route Planner failed to satisfy Critic after ${MAX_ATTEMPTS} attempts.`, stage: 'error' });
    const err = new RouteApprovalExhaustedError('Critic loop exhausted', attemptHistory);
    structuredLog({ step: 'Agent Loop Exhausted', input: null, error: err });
    throw err;
  }

  // --- DETERMINISTIC SCHEDULING (buildDeterministicSchedule) ---
  socket.emit('status_update', { message: `✨ Constructing Deterministic Schedule: Fetching live API data for all stops...` });

  const finalItinerary = [];
  let dayOffset = 0;
  
  // Global Set for deduplication across the entire itinerary
  const usedVenueIds = new Set();
  let currentBaseCity = startCity;

  for (const stop of routePlan) {
    const city = stop.city;
    const daysInCity = stop.days;
    const isDayTrip = stop.type === 'day_trip';
    if (daysInCity === 0) continue;

    if (!isDayTrip) {
      currentBaseCity = city;
    }

    socket.emit('status_update', { message: `🔍 Fetching Attractions, Restaurants & Weather for ${city} (${isDayTrip ? 'Day Trip from ' + currentBaseCity : 'Base'})...` });

    const cityDates = [];
    for (let i = 0; i < daysInCity; i++) {
      const currentDayNumber = dayOffset + i;
      const dayDate = new Date(startDateObj.getTime() + currentDayNumber * 86400000);
      cityDates.push(dayDate.toISOString().split('T')[0]);
    }

    // Strict Promise.all without swallowing errors
    const [attractionsRaw, restaurantsRaw, weather] = await Promise.all([
      freeDataService.getAttractions(city, 'budget'),
      // For day trips, we might still want local restaurants for lunch/dinner
      freeDataService.getRestaurants(city, 'budget'),
      freeDataService.getWeather(city, cityDates)
    ]);

    // Data Quality Filter
    const attractions = attractionsRaw.filter(a => a.name && a.name !== 'Unnamed' && !usedVenueIds.has(a.id));
    const restaurants = restaurantsRaw.filter(r => r.name && r.name !== 'Unnamed Restaurant' && !usedVenueIds.has(r.id));

    // We need 2 attractions and 1 restaurant per day
    const requiredAttractions = daysInCity * 2;
    const requiredRestaurants = daysInCity;

    if (attractions.length < requiredAttractions) {
      throw new InsufficientVenueDataError(`Not enough unique, valid attractions for ${city}. Need ${requiredAttractions}, found ${attractions.length}.`, city, requiredAttractions - attractions.length);
    }
    if (restaurants.length < requiredRestaurants) {
      throw new InsufficientVenueDataError(`Not enough unique, valid restaurants for ${city}. Need ${requiredRestaurants}, found ${restaurants.length}.`, city, requiredRestaurants - restaurants.length);
    }

    let aIndex = 0;
    let rIndex = 0;

    for (let i = 0; i < daysInCity; i++) {
      const currentDayNumber = dayOffset + i;
      const dayDate = new Date(startDateObj.getTime() + currentDayNumber * 86400000);
      const dateFormatted = dayDate.toISOString().split('T')[0];

      const morningAttraction = attractions[aIndex++];
      const afternoonAttraction = attractions[aIndex++];
      const dinnerRestaurant = restaurants[rIndex++];

      usedVenueIds.add(morningAttraction.id);
      usedVenueIds.add(afternoonAttraction.id);
      usedVenueIds.add(dinnerRestaurant.id);

      let dayTemp = null;
      let dayCondition = 'Forecast unavailable';
      let available = false;
      
      if (weather && weather[dateFormatted]) {
        if (weather[dateFormatted].available) {
          dayTemp = weather[dateFormatted].temp;
          dayCondition = weather[dateFormatted].description;
          dayCondition = dayCondition.charAt(0).toUpperCase() + dayCondition.slice(1);
          available = true;
        } else {
          dayCondition = weather[dateFormatted].description;
        }
      }

      finalItinerary.push({
        day: currentDayNumber + 1,
        date: dateFormatted,
        city: city,
        type: isDayTrip ? 'day_trip' : 'base',
        baseCity: currentBaseCity, // Reference to where they sleep
        weather: { temp: dayTemp, weather: dayCondition, available },
        activities: [
          { time: '09:30 AM', title: `Morning Visit to ${morningAttraction.name}`, notes: morningAttraction.description || `Explore ${morningAttraction.name}.` },
          { time: '02:00 PM', title: `Afternoon at ${afternoonAttraction.name}`, notes: afternoonAttraction.description || `Discover the sights at ${afternoonAttraction.name}.` },
          { time: '07:30 PM', title: `Dinner at ${dinnerRestaurant.name}`, notes: dinnerRestaurant.description || 'Enjoy a delightful local dinner.' }
        ]
      });
    }
    dayOffset += daysInCity;
  }

  const resultPayload = {
    trip_id: tripId,
    client_sid: socket.id,
    start_city: startCity,
    end_city: endCity,
    start_date: startDateStr,
    end_date: endDateStr,
    num_days: numDays,
    transport_mode: 'train_flight',
    itinerary: finalItinerary,
    events: {}
  };

  await new Promise(r => setTimeout(r, 400));
  socket.emit('status_update', { message: '🎉 Deterministic scheduling complete! Sending tailored itinerary...' });
  socket.emit('trip_result', resultPayload);

  // Minimal Persistence (Firestore) - after emitting the trip so failures don't swallow a good result
  try {
    const db = getFirestore();
    await db.collection('trips').doc(tripId).set({
      id: tripId,
      userSocketId: socket.id,
      requestPayload: params,
      finalItinerary,
      createdAt: new Date().toISOString()
    });
    socket.emit('status_update', { message: '💾 Trip securely saved to database.' });
  } catch (err) {
    const dbErr = new DatabaseConnectionError(`Failed to persist trip to Firestore: ${err.message}`, err);
    structuredLog({ step: 'Firestore Persistence', input: { tripId }, error: dbErr });
    socket.emit('status_update', { message: `🚨 Persistence Error: Could not save trip data to database (but trip was delivered successfully).` });
    throw dbErr;
  }
}
