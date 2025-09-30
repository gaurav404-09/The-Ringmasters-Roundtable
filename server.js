import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 5000;

app.use(cors());

app.get("/api/directions", async (req, res) => {
  const { origin, destination, mode } = req.query;
  const apiKey = process.env.ORS_API_KEY;

  if (!origin || !destination || !mode) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    // First: geocode origin + destination to coordinates
    const geocode = async (place) => {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          place
        )}`
      );
      const geoData = await geoRes.json();
      if (!geoData[0]) throw new Error(`Could not geocode ${place}`);
      return [parseFloat(geoData[0].lon), parseFloat(geoData[0].lat)];
    };

    const start = await geocode(origin);
    const end = await geocode(destination);

    let profile = "driving-car";
    if (mode === "walking") profile = "foot-walking";
    if (mode === "transit") profile = "driving-car";
    if (mode === "cycling") profile = "cycling-regular";

    const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [start, end] }),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("API fetch error:", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
