import express from 'express';
import { findEvents } from '../services/cohereEventService.js';

const router = express.Router();

router.get('/events', async (req, res) => {
  try {
    const { city, category, dateRange } = req.query;

    if (!city) {
      return res.status(400).json({ error: 'City parameter is required' });
    }

    console.log(`Fetching events for city: ${city}, category: ${category}, dateRange: ${dateRange}`);
    const events = await findEvents(city, dateRange, category);

    if (!events || events.length === 0) {
      return res.status(404).json({
        error: 'No events found',
        message: `Could not find any events in ${city}${category ? ' in the ' + category + ' category' : ''}`,
      });
    }

    res.json(events);
  } catch (error) {
    console.error('Error in /api/events:', error);
    res.status(500).json({
      error: 'Failed to fetch events',
      details: error.message,
    });
  }
});

export default router;
