import express from 'express';
import {
  getTripsForUser,
  saveTripForUser,
  deleteTripForUser,
  confirmTripItemForUser,
} from '../services/tripStore.js';

const router = express.Router();

router.get('/:uid/trips', async (req, res) => {
  const { uid } = req.params;
  try {
    if (!uid) {
      return res.status(400).json({ error: 'User id is required' });
    }
    const trips = await getTripsForUser(uid);
    res.json({ success: true, trips });
  } catch (error) {
    console.error('[GET /api/users/:uid/trips] error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch trips' });
  }
});

router.post('/:uid/trips', async (req, res) => {
  const { uid } = req.params;
  const { trip } = req.body || {};

  try {
    if (!uid) {
      return res.status(400).json({ error: 'User id is required' });
    }
    if (!trip || typeof trip !== 'object') {
      return res.status(400).json({ error: 'Trip payload is required' });
    }

    const saved = await saveTripForUser(uid, trip);
    res.status(201).json({ success: true, trip: saved });
  } catch (error) {
    console.error('[POST /api/users/:uid/trips] error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to save trip' });
  }
});

router.delete('/:uid/trips/:tripId', async (req, res) => {
  const { uid, tripId } = req.params;
  try {
    if (!uid || !tripId) {
      return res.status(400).json({ error: 'User id and trip id are required' });
    }

    const remaining = await deleteTripForUser(uid, tripId);
    res.json({ success: true, trips: remaining });
  } catch (error) {
    console.error('[DELETE /api/users/:uid/trips/:tripId] error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete trip' });
  }
});

router.post('/:uid/trips/:tripId/confirm', async (req, res) => {
  const { uid, tripId } = req.params;
  const { itemId, bookingDetails } = req.body || {};

  try {
    if (!uid || !tripId || !itemId) {
      return res.status(400).json({ error: 'User id, trip id, and item id are required' });
    }

    const updatedTrip = await confirmTripItemForUser(uid, tripId, itemId, bookingDetails || {});
    res.json({ success: true, trip: updatedTrip });
  } catch (error) {
    console.error('[POST /api/users/:uid/trips/:tripId/confirm] error:', error);
    const status = error.message === 'Trip not found' || error.message === 'Itinerary item not found' ? 404 : 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to confirm itinerary item' });
  }
});

export default router;
