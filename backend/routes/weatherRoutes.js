import express from 'express';
import axios from 'axios';

const router = express.Router();

// Get current weather for a location
router.get('/weather', async (req, res) => {
  try {
    const { q, lat, lon, units = 'metric' } = req.query;

    const apiKey = process.env.OPENWEATHER_API_KEY || process.env.VITE_OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        cod: 500,
        message: 'OpenWeather API key is not configured on the server.'
      });
    }

    const params = {
      appid: apiKey,
      units,
    };

    if (q && q.trim()) {
      params.q = q.trim();
    } else if (lat && lon) {
      params.lat = parseFloat(lat);
      params.lon = parseFloat(lon);
    } else {
      return res.status(400).json({
        cod: 400,
        message: 'Location query (q) or coordinates (lat, lon) must be provided.'
      });
    }

    const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params
    });

    res.json(data);
  } catch (error) {
    console.error('Weather API error:', error);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message || 'Error fetching weather data';
    res.status(status).json({
      cod: status,
      message,
      error: message
    });
  }
});

// Get weather forecast for a location
router.get('/forecast', async (req, res) => {
  try {
    const { q, lat, lon, units = 'metric' } = req.query;

    const apiKey = process.env.OPENWEATHER_API_KEY || process.env.VITE_OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        cod: 500,
        message: 'OpenWeather API key is not configured on the server.'
      });
    }

    const params = {
      appid: apiKey,
      units,
    };

    if (q && q.trim()) {
      params.q = q.trim();
    } else if (lat && lon) {
      params.lat = parseFloat(lat);
      params.lon = parseFloat(lon);
    } else {
      return res.status(400).json({
        cod: 400,
        message: 'Location query (q) or coordinates (lat, lon) must be provided.'
      });
    }

    const { data } = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
      params
    });

    res.json(data);
  } catch (error) {
    console.error('Forecast API error:', error);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message || 'Error fetching forecast data';
    res.status(status).json({
      cod: status,
      message,
      error: message
    });
  }
});

export default router;
