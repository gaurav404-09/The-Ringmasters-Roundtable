import express from 'express';
import {
  getTripsForUser,
  saveTripForUser,
  deleteTripForUser,
  confirmTripItemForUser,
  confirmEntireTripForUser,
} from '../services/tripStore.js';
import verifyFirebaseToken from '../middleware/verifyFirebaseToken.js';

const router = express.Router();

router.use(verifyFirebaseToken);

const resolveUid = (req, res) => {
  const authedUid = req.user?.uid;
  if (!authedUid) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return null;
  }

  const { uid: uidParam } = req.params;
  if (uidParam && uidParam !== authedUid) {
    res.status(403).json({ success: false, error: 'Forbidden: uid mismatch' });
    return null;
  }

  return authedUid;
};

router.get('/:uid/trips', async (req, res) => {
  try {
    const uid = resolveUid(req, res);
    if (!uid) return;

    const trips = await getTripsForUser(uid);
    res.json({ success: true, trips });
  } catch (error) {
    console.error('[GET /api/users/:uid/trips] error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch trips' });
  }
});

router.post('/:uid/trips/:tripId/confirm-all', async (req, res) => {
  const { tripId } = req.params;
  const { overrides } = req.body || {};

  try {
    const uid = resolveUid(req, res);
    if (!uid) return;
    if (!tripId) {
      return res.status(400).json({ error: 'Trip id is required' });
    }

    const updatedTrip = await confirmEntireTripForUser(uid, tripId, overrides || {});
    res.json({ success: true, trip: updatedTrip });
  } catch (error) {
    console.error('[POST /api/users/:uid/trips/:tripId/confirm-all] error:', error);
    const status = error.message === 'Trip not found' ? 404 : 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to confirm trip' });
  }
});

router.post('/:uid/trips', async (req, res) => {
  const { trip } = req.body || {};

  try {
    const uid = resolveUid(req, res);
    if (!uid) return;
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
  const { tripId } = req.params;
  try {
    const uid = resolveUid(req, res);
    if (!uid) return;
    if (!tripId) {
      return res.status(400).json({ error: 'Trip id is required' });
    }

    const remaining = await deleteTripForUser(uid, tripId);
    res.json({ success: true, trips: remaining });
  } catch (error) {
    console.error('[DELETE /api/users/:uid/trips/:tripId] error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete trip' });
  }
});

router.post('/:uid/trips/:tripId/confirm', async (req, res) => {
  const { tripId } = req.params;
  const { itemId, bookingDetails } = req.body || {};

  try {
    const uid = resolveUid(req, res);
    if (!uid) return;
    if (!tripId || !itemId) {
      return res.status(400).json({ error: 'Trip id and item id are required' });
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
