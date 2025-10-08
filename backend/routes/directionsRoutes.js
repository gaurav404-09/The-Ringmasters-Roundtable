import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

const geocode = async (place) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`
    );
    const data = await response.json();
    if (!data || data.length === 0) {
      throw new Error('Location not found');
    }
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error('Failed to geocode location');
  }
};

router.get('/directions', async (req, res) => {
  const { origin, destination, mode } = req.query;
  const apiKey = process.env.VITE_ORS_API_KEY || process.env.ORS_API_KEY;

  if (!origin || !destination || !mode) {
    return res.status(400).json({ error: 'Missing required parameters: origin, destination, and mode are required' });
  }

  try {
    console.log(`Fetching route from ${origin} to ${destination} via ${mode}`);

    let start;
    let end;
    try {
      [start, end] = await Promise.all([
        geocode(origin),
        geocode(destination),
      ]);
    } catch (error) {
      return res.status(400).json({ error: `Failed to geocode locations: ${error.message}` });
    }

    if (!start || !end || !Array.isArray(start) || !Array.isArray(end)) {
      return res.status(500).json({ error: 'Invalid geocoding response' });
    }

    let profile = 'driving-car';
    if (mode === 'walking') profile = 'foot-walking';
    else if (mode === 'cycling') profile = 'cycling-regular';

    const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json',
      },
      body: JSON.stringify({
        coordinates: [start, end],
        units: 'km',
        language: 'en',
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
        details: errorData,
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
          mode: profile,
        },
      });
    }

    const routeData = data.features[0];
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
          hasSegments: data.features?.[0]?.properties?.segments?.length > 0,
        },
      });
    }

    res.json({
      distance: segment.distance,
      duration: segment.duration,
      steps: segment.steps.map((step) => ({
        distance: step.distance,
        duration: step.duration,
        instruction: step.instruction,
        name: step.name || 'Unnamed road',
      })),
      geometry: routeData.geometry,
    });
  } catch (error) {
    console.error('Directions error:', error);
    res.status(500).json({
      error: 'Failed to calculate route',
      message: error.message,
    });
  }
});

export default router;
