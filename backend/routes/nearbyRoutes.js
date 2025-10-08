import express from 'express';
import freeDataService from '../services/freeDataService.js';

const router = express.Router();

const parseNumber = (value, fallback) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

router.get('/nearby', async (req, res) => {
  try {
    const lat = parseNumber(req.query.lat, undefined);
    const lon = parseNumber(req.query.lon, undefined);
    const focus = req.query.focus || 'mixed';
    const radius = parseNumber(req.query.radius, 2000);

    if (lat === undefined || lon === undefined) {
      return res.status(400).json({
        error: 'Latitude (lat) and longitude (lon) query parameters are required'
      });
    }

    const results = await freeDataService.getNearbyPlaces({ lat, lon }, { focus, radius });

    res.json({
      success: true,
      count: results.length,
      suggestions: results.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        description: item.description,
        distanceHint: radius,
        coordinates: item.coordinates,
        address: item.address,
        tags: {
          cuisine: item.tags?.cuisine,
          opening_hours: item.tags?.opening_hours,
          website: item.tags?.website,
          phone: item.tags?.phone
        }
      }))
    });
  } catch (error) {
    console.error('[NearMeNow] Failed to fetch nearby places:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearby suggestions',
      details: error.message
    });
  }
});

export default router;
