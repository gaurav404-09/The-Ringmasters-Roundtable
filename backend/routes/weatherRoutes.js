import express from 'express';
import freeDataService from '../services/freeDataService.js';

const router = express.Router();

// Get current weather for a location
router.get('/weather', async (req, res) => {
  try {
    const { q, lat, lon, appid, units = 'metric' } = req.query;
    
    if (!appid) {
      return res.status(400).json({
        cod: 401,
        message: 'Invalid API key. Please provide a valid OpenWeatherMap API key.'
      });
    }

    // Use either city name or coordinates
    let location = q;
    if ((!q || !q.trim()) && (lat && lon)) {
      location = { lat: parseFloat(lat), lon: parseFloat(lon) };
    } else if (!q || !q.trim()) {
      return res.status(400).json({
        cod: 400,
        message: 'Location (q) or coordinates (lat, lon) must be provided'
      });
    }

    // Get weather data from the service
    const weatherData = await freeDataService.getWeather(location);
    
    if (!weatherData) {
      return res.status(404).json({
        cod: 404,
        message: 'Weather data not found for the specified location'
      });
    }

    // Format response to match OpenWeatherMap API format
    const response = {
      coord: {
        lon: weatherData.coordinates?.lon || 0,
        lat: weatherData.coordinates?.lat || 0
      },
      weather: [{
        id: 800, // Default clear sky
        main: weatherData.description?.split(' ')[0] || 'Clear',
        description: weatherData.description || 'clear sky',
        icon: weatherData.icon || '01d'
      }],
      base: 'stations',
      main: {
        temp: weatherData.temp,
        feels_like: weatherData.temp,
        temp_min: weatherData.temp_min || weatherData.temp - 2,
        temp_max: weatherData.temp_max || weatherData.temp + 2,
        pressure: 1015, // Default pressure
        humidity: weatherData.humidity || 50,
        sea_level: 1015,
        grnd_level: 1000
      },
      visibility: 10000, // Default visibility
      wind: {
        speed: weatherData.windSpeed || 0,
        deg: 0,
        gust: 0
      },
      clouds: {
        all: 0
      },
      dt: Math.floor(Date.now() / 1000),
      sys: {
        type: 2,
        id: 2000000 + Math.floor(Math.random() * 1000000),
        country: 'US', // Default country
        sunrise: Math.floor(Date.now() / 1000) - 3600 * 6, // 6 hours ago
        sunset: Math.floor(Date.now() / 1000) + 3600 * 6, // 6 hours from now
        timezone: 0
      },
      timezone: 0,
      id: Math.floor(Math.random() * 1000000),
      name: q || 'Unknown Location',
      cod: 200
    };

    res.json(response);
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({
      cod: 500,
      message: 'Error fetching weather data',
      error: error.message
    });
  }
});

// Get weather forecast for a location
router.get('/forecast', async (req, res) => {
  try {
    const { lat, lon, appid, units = 'metric', cnt = 5 } = req.query;
    
    if (!appid) {
      return res.status(400).json({
        cod: 401,
        message: 'Invalid API key. Please provide a valid OpenWeatherMap API key.'
      });
    }

    if (!lat || !lon) {
      return res.status(400).json({
        cod: 400,
        message: 'Latitude (lat) and longitude (lon) must be provided'
      });
    }

    // Get weather data for the current day
    const weatherData = await freeDataService.getWeather({ 
      lat: parseFloat(lat), 
      lon: parseFloat(lon) 
    });

    if (!weatherData) {
      return res.status(404).json({
        cod: 404,
        message: 'Weather data not found for the specified location'
      });
    }

    // Generate forecast data for the next few days
    const forecast = Array.from({ length: parseInt(cnt) }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      // Vary the temperature slightly for each day
      const tempVariation = Math.sin(i) * 2; // +/- 2 degrees
      const temp = weatherData.temp ? weatherData.temp + tempVariation : 20 + tempVariation;
      
      return {
        dt: Math.floor(date.getTime() / 1000),
        main: {
          temp: temp,
          feels_like: temp - 1,
          temp_min: temp - 2,
          temp_max: temp + 2,
          pressure: 1015,
          sea_level: 1015,
          grnd_level: 1000,
          humidity: weatherData.humidity || 50 + Math.floor(Math.random() * 20),
          temp_kf: 0
        },
        weather: [{
          id: 800,
          main: 'Clear',
          description: 'clear sky',
          icon: '01d'
        }],
        clouds: {
          all: 0
        },
        wind: {
          speed: weatherData.windSpeed || 2 + Math.random() * 3,
          deg: Math.floor(Math.random() * 360),
          gust: 0
        },
        visibility: 10000,
        pop: 0,
        sys: {
          pod: 'd'
        },
        dt_txt: date.toISOString().replace('T', ' ').substring(0, 19)
      };
    });

    const response = {
      cod: '200',
      message: 0,
      cnt: forecast.length,
      list: forecast,
      city: {
        id: Math.floor(Math.random() * 1000000),
        name: 'Unknown Location',
        coord: {
          lat: parseFloat(lat),
          lon: parseFloat(lon)
        },
        country: 'US',
        population: 0,
        timezone: 0,
        sunrise: Math.floor(Date.now() / 1000) - 3600 * 6,
        sunset: Math.floor(Date.now() / 1000) + 3600 * 6
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Forecast API error:', error);
    res.status(500).json({
      cod: 500,
      message: 'Error fetching forecast data',
      error: error.message
    });
  }
});

export default router;
