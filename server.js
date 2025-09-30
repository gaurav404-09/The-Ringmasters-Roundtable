import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Helper function to geocode a location
const geocode = async (place) => {
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}`,
    { headers: { 'User-Agent': 'CaravanCompass/1.0 (your@email.com)' } }
  );
  const geoData = await geoRes.json();
  if (!geoData || !geoData[0]) throw new Error(`Could not geocode: ${place}`);
  return [parseFloat(geoData[0].lon), parseFloat(geoData[0].lat)];
};

// Haversine formula to calculate distance in km
const distanceKm = (start, end) => {
  const [lon1, lat1] = start;
  const [lon2, lat2] = end;
  const R = 6371; // Earth radius
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

app.get("/api/directions", async (req, res) => {
  const { origin, destination, mode } = req.query;
  const apiKey = process.env.ORS_API_KEY;

  if (!origin || !destination || !mode) {
    return res.status(400).json({ error: "Missing required parameters: origin, destination, and mode are required" });
  }

  try {
    console.log(`Fetching route from ${origin} to ${destination} (${mode})`);
    const [start, end] = await Promise.all([geocode(origin), geocode(destination)]);
    console.log('Geocoded coordinates:', { start, end });

    const maxDistance = mode === "walking" ? 50 : mode === "cycling" ? 200 : Infinity;
    const dist = distanceKm(start, end);
    if (dist > maxDistance) {
      return res.status(400).json({ error: `Distance too long for ${mode}. Max allowed is ${maxDistance} km.` });
    }

    let profile = "driving-car";
    let avoidFeatures = [];
    
    if (mode === "driving") {
      profile = "driving-car";
      avoidFeatures = []; // can also include ['highways','tollways','ferries']
    } else if (mode === "walking") {
      profile = "foot-walking";
      avoidFeatures = []; // walking ignores avoid_features
    } else if (mode === "cycling") {
      profile = "cycling-regular";
      avoidFeatures = ['ferries']; // only ferries can be avoided for cycling
    }
    

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
        preference: 'recommended',
        units: 'km',
        language: 'en',
        instructions: true,
        elevation: false,
        options: { avoid_features: avoidFeatures }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenRouteService error:', errorData);
      return res.status(400).json({ error: errorData.error?.message || 'Failed to fetch directions' });
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return res.status(400).json({ error: 'No route could be calculated for the given points' });
    }

    const routeData = data.features.map(f => {
      const segment = f.properties.segments[0];
      return {
        distance: segment.distance,
        duration: segment.duration,
        steps: segment.steps,
        geometry: f.geometry
      };
    });

    console.log('Route response:', {
      distance: routeData[0].distance,
      duration: routeData[0].duration,
      stepsCount: routeData[0].steps.length
    });

    res.json({ routes: routeData });

  } catch (err) {
    console.error("API fetch error:", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
