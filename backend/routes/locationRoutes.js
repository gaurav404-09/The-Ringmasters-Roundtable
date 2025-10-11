import express from 'express';
import freeDataService from '../services/freeDataService.js';

const router = express.Router();

router.get('/places/search', async (req, res) => {
  const { q, limit } = req.query;

  try {
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    }

    const results = await freeDataService.searchLocations(q.trim(), {
      limit: limit ? Number(limit) : undefined,
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error('[GET /api/places/search] error:', error);
    const status = error.message === 'Query is required for location search' ? 400 : 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to search places' });
  }
});

export default router;
