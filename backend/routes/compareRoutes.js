import express from 'express';
import freeDataService from '../services/freeDataService.js';

const router = express.Router();

const roundScore = (value, precision = 2) => {
  if (!Number.isFinite(value)) return 0;
  return parseFloat(value.toFixed(precision));
};

const calculateScore = (attractions = [], restaurants = []) => {
  if ((!attractions || attractions.length === 0) && (!restaurants || restaurants.length === 0)) {
    return {
      food: 2.5,
      culture: 2.5,
      adventure: 2.5,
      nightlife: 2.0,
      shopping: 2.5,
      overall: 2.5,
    };
  }

  const maxAttractions = 20;
  const maxRestaurants = 15;

  const attractionScore = Math.min(attractions.length / maxAttractions, 1) * 5;
  const restaurantScore = Math.min(restaurants.length / maxRestaurants, 1) * 5;

  const scores = {
    food: roundScore(restaurantScore),
    culture: roundScore(attractionScore),
    adventure: roundScore((attractionScore * 0.6) + (restaurantScore * 0.4)),
    nightlife: roundScore(restaurantScore * 0.8),
    shopping: roundScore((attractionScore * 0.4) + (restaurantScore * 0.6)),
  };

  const weights = {
    food: 0.2,
    culture: 0.25,
    adventure: 0.25,
    nightlife: 0.15,
    shopping: 0.15,
  };

  scores.overall = roundScore(
    scores.food * weights.food +
    scores.culture * weights.culture +
    scores.adventure * weights.adventure +
    scores.nightlife * weights.nightlife +
    scores.shopping * weights.shopping
  );

  return scores;
};

const generateProsConsWeather = (weather = {}, attractions = [], restaurants = [], destName = '') => {
  const pros = [];
  const cons = [];

  if (attractions.length > 30) {
    pros.push(`Rich in cultural heritage (${attractions.length}+ attractions)`);
  } else if (attractions.length > 10) {
    pros.push('Plenty of things to see and do');
  } else if (attractions.length > 5) {
    pros.push('Good selection of attractions');
  } else if (attractions.length <= 3) {
    cons.push('Limited tourist attractions');
  }

  if (restaurants.length > 8) {
    pros.push('Excellent dining scene');
  } else if (restaurants.length > 5) {
    pros.push('Good variety of restaurants');
  } else if (restaurants.length <= 2) {
    cons.push('Limited dining options');
  }

  if (weather && weather.temp !== undefined) {
    if (weather.temp >= 20 && weather.temp <= 28) {
      pros.push(`Perfect weather (${weather.temp}°C)`);
    } else if (weather.temp > 28 && weather.temp <= 32) {
      pros.push('Warm and sunny climate');
    } else if (weather.temp > 32) {
      cons.push(`Very hot weather (${weather.temp}°C)`);
    } else if (weather.temp < 10) {
      cons.push(`Cold weather (${weather.temp}°C)`);
    } else if (weather.temp >= 10 && weather.temp < 20) {
      pros.push('Cool and comfortable temperature');
    }

    if (weather.description && weather.description.includes('clear')) {
      pros.push('Clear skies for sightseeing');
    } else if (weather.description && weather.description.includes('rain')) {
      cons.push('Rainy conditions');
    }
  }

  if (pros.length === 0) {
    pros.push('Unique travel destination');
    pros.push('Authentic local experience');
  }
  if (cons.length === 0) {
    cons.push('Limited information available');
  }

  return { pros, cons };
};

const fetchDestinationData = async (destination, requestId) => {
  console.log(`[${requestId}] Starting fetchDestinationData for ${destination}`);
  try {
    const [attractions, restaurants, hotels, weather] = await Promise.all([
      freeDataService.getAttractions(destination).catch((err) => {
        console.error(`[${requestId}] Error fetching attractions for ${destination}:`, err.message);
        return [];
      }),
      freeDataService.getRestaurants(destination).catch((err) => {
        console.error(`[${requestId}] Error fetching restaurants for ${destination}:`, err.message);
        return [];
      }),
      freeDataService.getHotels(destination).catch((err) => {
        console.error(`[${requestId}] Error fetching hotels for ${destination}:`, err.message);
        return [];
      }),
      freeDataService.getWeather(destination).catch((err) => {
        console.error(`[${requestId}] Error fetching weather for ${destination}:`, err.message);
        return null;
      }),
    ]);

    console.log(`[${requestId}] Data fetched for ${destination}:`, {
      attractions: attractions?.length || 0,
      restaurants: restaurants?.length || 0,
      hotels: hotels?.length || 0,
      weather: weather ? 'success' : 'failed',
    });

    return {
      name: destination,
      attractions: attractions?.slice(0, 10) || [],
      restaurants: restaurants?.slice(0, 8) || [],
      hotels: hotels?.slice(0, 5) || [],
      weather: weather || { error: 'Weather data unavailable' },
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[${requestId}] Error in fetchDestinationData for ${destination}:`, error);
    return {
      name: destination,
      error: `Failed to fetch data: ${error.message}`,
      lastUpdated: new Date().toISOString(),
    };
  }
};

router.post('/compare', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 8);
  console.log(`\n=== New Compare Request (ID: ${requestId}) ===`);

  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { destination1, destination2 } = req.body;

    if (!destination1 || !destination2) {
      console.error(`[${requestId}] Error: Missing required parameters`);
      return res.status(400).json({
        success: false,
        error: 'Both destinations are required',
        requestId,
      });
    }

    console.log(`[${requestId}] Fetching data for ${destination1} and ${destination2}`);
    console.log(
      `[${requestId}] Environment check - OPENWEATHER_API_KEY: ${process.env.OPENWEATHER_API_KEY ? 'Present' : 'Missing'}`
    );

    let coords1;
    try {
      coords1 = await freeDataService.getCoordinates(destination1);
      console.log(`[${requestId}] Coordinates for ${destination1}:`, coords1);
    } catch (error) {
      console.warn(`[${requestId}] Failed to get coordinates for ${destination1}:`, error.message);
      coords1 = { lat: 0, lon: 0 };
    }

    let coords2;
    try {
      coords2 = await freeDataService.getCoordinates(destination2);
      console.log(`[${requestId}] Coordinates for ${destination2}:`, coords2);
    } catch (error) {
      console.warn(`[${requestId}] Failed to get coordinates for ${destination2}:`, error.message);
      coords2 = { lat: 0, lon: 0 };
    }

    console.log(`[${requestId}] Starting data fetch for both destinations`);
    const results = await Promise.allSettled([
      fetchDestinationData(destination1, requestId),
      fetchDestinationData(destination2, requestId),
    ]);

    const data1 = results[0].status === 'fulfilled' ? results[0].value : { name: destination1, error: 'Failed to fetch data' };
    const data2 = results[1].status === 'fulfilled' ? results[1].value : { name: destination2, error: 'Failed to fetch data' };

    console.log(`[${requestId}] Data fetch completed:`, {
      dest1: { success: results[0].status === 'fulfilled', dataPoints: Object.keys(data1).length },
      dest2: { success: results[1].status === 'fulfilled', dataPoints: Object.keys(data2).length },
    });

    const dest1Scores = calculateScore(data1.attractions || [], data1.restaurants || []);
    const dest2Scores = calculateScore(data2.attractions || [], data2.restaurants || []);

    const dest1ProsCons = generateProsConsWeather(
      data1.weather || {},
      data1.attractions || [],
      data1.restaurants || [],
      destination1,
    );

    const dest2ProsCons = generateProsConsWeather(
      data2.weather || {},
      data2.attractions || [],
      data2.restaurants || [],
      destination2,
    );

    const attractionCount1 = data1.attractions?.length || 0;
    const restaurantCount1 = data1.restaurants?.length || 0;
    const priceLevel1 = restaurantCount1 > 10 ? '$$$' : restaurantCount1 > 5 ? '$$' : restaurantCount1 > 0 ? '$' : 'N/A';

    const attractionCount2 = data2.attractions?.length || 0;
    const restaurantCount2 = data2.restaurants?.length || 0;
    const priceLevel2 = restaurantCount2 > 10 ? '$$$' : restaurantCount2 > 5 ? '$$' : restaurantCount2 > 0 ? '$' : 'N/A';

    const comparisonData = {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      destination1: {
        ...data1,
        coordinates: coords1,
        scores: dest1Scores,
        pros: dest1ProsCons.pros,
        cons: dest1ProsCons.cons,
        rating: dest1Scores.overall.toFixed(2),
        ratingValue: dest1Scores.overall,
        reviews: `${(data1.attractions?.length || 0) + (data1.restaurants?.length || 0)}`,
        description: `Explore ${destination1} with ${(data1.attractions?.length || 0)} attractions and ${(data1.restaurants?.length || 0)} restaurants`,
        price: priceLevel1,
        avgTemp: data1.weather?.temp ? `${Math.round(data1.weather.temp)}°C` : 'N/A',
        weather: data1.weather || { temp: null, description: 'Weather data unavailable', humidity: 'N/A', windSpeed: 'N/A' },
        highlights: data1.attractions?.slice(0, 4).map((a) => a.name).filter((name) => name && name.length > 0) || [],
        dataQuality: {
          attractions: attractionCount1,
          restaurants: restaurantCount1,
          weather: Boolean(data1.weather && !data1.weather.error),
        },
      },
      destination2: {
        ...data2,
        coordinates: coords2,
        scores: dest2Scores,
        pros: dest2ProsCons.pros,
        cons: dest2ProsCons.cons,
        rating: dest2Scores.overall.toFixed(2),
        ratingValue: dest2Scores.overall,
        reviews: `${(data2.attractions?.length || 0) + (data2.restaurants?.length || 0)}`,
        description: `Explore ${destination2} with ${(data2.attractions?.length || 0)} attractions and ${(data2.restaurants?.length || 0)} restaurants`,
        price: priceLevel2,
        avgTemp: data2.weather?.temp ? `${Math.round(data2.weather.temp)}°C` : 'N/A',
        weather: data2.weather || { temp: null, description: 'Weather data unavailable', humidity: 'N/A', windSpeed: 'N/A' },
        highlights: data2.attractions?.slice(0, 4).map((a) => a.name).filter((name) => name && name.length > 0) || [],
        dataQuality: {
          attractions: attractionCount2,
          restaurants: restaurantCount2,
          weather: Boolean(data2.weather && !data2.weather.error),
        },
      },
      comparison: {
        winner: dest1Scores.overall > dest2Scores.overall ? destination1 : destination2,
        scores: {
          [destination1]: dest1Scores.overall,
          [destination2]: dest2Scores.overall,
        },
        winnerScores: dest1Scores.overall > dest2Scores.overall ? dest1Scores : dest2Scores,
        winnerName: dest1Scores.overall > dest2Scores.overall ? destination1 : destination2,
      },
    };

    console.log(`[${requestId}] Comparison data prepared`);
    res.json(comparisonData);
  } catch (error) {
    console.error(`[${requestId}] Error in /api/compare:`, error);
    res.status(500).json({
      success: false,
      requestId,
      error: 'Failed to compare destinations',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

export default router;
