// server.js
import "dotenv/config"; // ✅ loads .env immediately
import express from "express";
import cors from "cors";
console.log("Amadeus Key:", process.env.AMADEUS_CLIENT_ID);

// ensure fetch is available globally
if (!globalThis.fetch) globalThis.fetch = fetch;

import { getToken, getFlights, getHotels } from "./services/amadeus.js";
import { getTrains } from "./services/trains.js";
import { findCheapestTrip } from "./services/optimizer.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  })
);

app.use(express.json());

// app.get("/api/travel", async (req, res) => {
//   const {
//     origin,
//     destination,
//     date,
//     checkInDate,
//     checkOutDate,
//     adults = 1,
//   } = req.query;

//   if (!origin || !destination || !date || !checkInDate || !checkOutDate) {
//     return res.status(400).json({ error: "Missing required parameters" });
//   }

//   try {
//     let flights = [];
//     let hotels = [];
//     let trains = [];

//     const amadeusConfigured =
//       process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET;

//     if (amadeusConfigured) {
//       try {
//         const token = await getToken();
//         flights = await getFlights(
//           token,
//           origin,
//           destination,
//           date,
//           parseInt(adults, 10)
//         );
//         hotels = await getHotels(
//           token,
//           destination,
//           checkInDate,
//           checkOutDate,
//           parseInt(adults, 10)
//         );
//       } catch (err) {
//         console.error("Amadeus fetch error:", err?.message || err);
//         // leave flights/hotels as empty arrays (will fall back to mocks below in dev)
//       }
//     } else {
//       console.warn(
//         "AMADEUS keys not set. Server will use mock flights/hotels for development."
//       );
//     }

//     try {
//       trains = await getTrains(origin, destination, date);
//     } catch (err) {
//       console.error("Train service error:", err?.message || err);
//       trains = [];
//     }

//     // development-friendly fallbacks (only used when the real APIs returned nothing)
//     if (flights.length === 0) {
//       flights = [
//         {
//           type: "flight",
//           provider: "Mock",
//           from: origin,
//           to: destination,
//           price: 120.0,
//           duration: "PT2H15M",
//           details: { airline: "MK" },
//         },
//       ];
//     }
//     if (hotels.length === 0) {
//       hotels = [
//         {
//           type: "hotel",
//           provider: "Mock",
//           location: destination,
//           price: 4500,
//           details: { hotelName: "Demo Hotel", rating: 4.2 },
//         },
//       ];
//     }
//     if (trains.length === 0) {
//       trains = [
//         {
//           from: origin,
//           to: destination,
//           fromCode: "XXX",
//           toCode: "YYY",
//           startTime: "09:00",
//           endTime: "12:15",
//           duration: "3h15m",
//           price: 750,
//           details: {
//             trainName: "Mock Express",
//             trainNumber: "M123",
//             runningDays: "Daily",
//           },
//         },
//       ];
//     }

//     const cheapestTrip = findCheapestTrip(flights, trains, hotels);

//     res.json({ flights, hotels, trains, cheapestTrip });
//   } catch (err) {
//     console.error("Error in /api/travel:", err);
//     res.status(500).json({ error: err.message || "Internal server error" });
//   }
// });
app.get("/api/travel", async (req, res) => {
  const {
    origin,
    destination,
    date,
    checkInDate,
    checkOutDate,
    adults = 1,
  } = req.query;

  if (!origin || !destination || !date || !checkInDate || !checkOutDate) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const token = await getToken(); // throws if Amadeus keys missing or network issue

    const [flights, hotels, rawTrains] = await Promise.all([
      getFlights(token, origin, destination, date, parseInt(adults)).catch(
        () => []
      ),
      getHotels(
        token,
        destination,
        checkInDate,
        checkOutDate,
        parseInt(adults)
      ).catch(() => []),
      getTrains(origin, destination, date).catch(() => []),
    ]);
    const formatDuration = (d) => {
      if (!d || d === "-") return "-";
      const parts = d.toString().split(".");
      const hours = parseInt(parts[0], 10);
      const minutes = parts[1]
        ? Math.round(parseFloat("0." + parts[1]) * 60)
        : 0;
      return `${hours}h ${minutes}m`;
    };

    // Map trains to frontend-friendly structure
    const trains = rawTrains.map((t) => {
      const train = t.train_base || {};
      return {
        from: train.from_stn_name || t.from || "-",
        to: train.to_stn_name || t.to || "-",
        fromCode: train.from_stn_code || t.fromCode || "-",
        toCode: train.to_stn_code || t.toCode || "-",
        startTime: train.from_time || t.startTime || "-",
        endTime: train.to_time || t.endTime || "-",
        duration: formatDuration(train.travel_time || t.duration || "-"),

        // price: train.price ?? "-", // show "-" if price missing
        details: {
          trainName: train.train_name || t.details?.trainName || "Unknown",
          trainNumber: train.train_no || t.details?.trainNumber || "N/A",
          runningDays:
            train.running_days
              ?.split("")
              .map((d, i) =>
                d === "1"
                  ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]
                  : null
              )
              .filter(Boolean) || "-", // convert "1111111" to weekdays
        },
      };
    });

    const cheapestTrip =
      flights.length || hotels.length
        ? findCheapestTrip(flights, trains, hotels)
        : null;

    res.json({ flights, hotels, trains, cheapestTrip });
  } catch (err) {
    console.error("Error in /api/travel:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/directions", async (req, res) => {
  const { origin, destination, mode } = req.query;
  const apiKey = process.env.ORS_API_KEY;

  if (!origin || !destination || !mode) {
    return res.status(400).json({
      error:
        "Missing required parameters: origin, destination, and mode are required",
    });
  }

  if (!apiKey) {
    return res.status(400).json({
      error:
        "OpenRouteService API key (ORS_API_KEY) not set in environment. Add ORS_API_KEY to .env",
    });
  }

  try {
    const geocode = async (place) => {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          place
        )}`,
        { headers: { "User-Agent": "CaravanCompass/1.0 (dev@example.com)" } }
      );
      const geoData = await geoRes.json();
      if (!geoData || !geoData[0])
        throw new Error(`Could not geocode: ${place}`);
      return [parseFloat(geoData[0].lon), parseFloat(geoData[0].lat)];
    };

    const [start, end] = await Promise.all([
      geocode(origin),
      geocode(destination),
    ]);

    let profile = "driving-car";
    let avoidFeatures = [];

    if (mode === "driving") {
      profile = "driving-car";
      avoidFeatures = [];
    } else if (mode === "walking") {
      profile = "foot-walking";
      avoidFeatures = [];
    } else if (mode === "cycling") {
      profile = "cycling-regular";
      avoidFeatures = ["ferries"];
    }

    const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json, application/geo+json",
      },
      body: JSON.stringify({
        coordinates: [start, end],
        preference: "recommended",
        units: "km",
        language: "en",
        instructions: true,
        elevation: false,
        options: { avoid_features: avoidFeatures },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenRouteService error:", errorData);
      return res.status(400).json({
        error: errorData.error?.message || "Failed to fetch directions",
      });
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return res
        .status(400)
        .json({ error: "No route could be calculated for the given points" });
    }

    const routeData = data.features.map((f) => {
      const segment = f.properties.segments[0];
      return {
        distance: segment.distance,
        duration: segment.duration,
        steps: segment.steps,
        geometry: f.geometry,
      };
    });

    res.json({ routes: routeData });
  } catch (err) {
    console.error("API fetch error:", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
