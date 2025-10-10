import { Router } from 'express';
import { getNewOpportunitiesForUser, markOpportunitySeen, deleteOpportunitiesForUser } from '../services/opportunitiesStore.js';
import { markUserActive } from '../services/activeUsers.js';

const router = Router();

const resolveUserId = (req) => {
  if (req.user?.uid) {
    return req.user.uid;
  }
  if (req.query?.uid) {
    return String(req.query.uid);
  }
  if (req.body?.uid) {
    return String(req.body.uid);
  }
  return null;
};

router.get('/new', async (req, res) => {
  try {
    const uid = resolveUserId(req);
    if (!uid) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Mark user as active (for agent to know who's logged in)
    markUserActive(uid);

    // Use the proper store function that handles both Firestore and JSON
    const opportunities = await getNewOpportunitiesForUser(uid);
    res.json({ success: true, opportunities });
  } catch (error) {
    console.error('[GET /api/opportunities/new] error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch opportunities' });
  }
});

router.post('/:id/seen', async (req, res) => {
  try {
    const uid = resolveUserId(req);
    const { id } = req.params;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!id) {
      return res.status(400).json({ success: false, error: 'Opportunity id is required' });
    }

    await markOpportunitySeen(uid, id);
    
    // Invalidate cache so next fetch gets updated data
    opportunitiesCache = null;
    cacheTimestamp = 0;
    
    res.json({ success: true });
  } catch (error) {
    console.error('[POST /api/opportunities/:id/seen] error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update opportunity' });
  }
});

router.delete('/all', async (req, res) => {
  try {
    const uid = resolveUserId(req);
    if (!uid) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    await deleteOpportunitiesForUser(uid);
    res.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/opportunities/all] error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete opportunities' });
  }
});

export default router;
