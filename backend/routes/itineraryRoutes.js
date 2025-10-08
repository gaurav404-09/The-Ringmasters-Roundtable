import express from 'express';
import freeDataService from '../services/freeDataService.js';

const router = express.Router();

router.post('/itinerary', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 8);
  console.log(`\n=== New Itinerary Request (ID: ${requestId}) ===`);
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { destination, days, interests, startDate, budget, travelers } = req.body;

    if (!destination || !days || !startDate) {
      const errorMsg = 'Missing required fields: destination, days, and startDate';
      console.error(`[${requestId}] Error: ${errorMsg}`);
      return res.status(400).json({ error: errorMsg });
    }

    console.log(`[${requestId}] Fetching data for ${days}-day trip to ${destination}`);

    const [attractions, restaurants, hotels, weather] = await Promise.all([
      freeDataService.getAttractions(destination, budget),
      freeDataService.getRestaurants(destination, budget),
      freeDataService.getHotels(destination, budget),
      freeDataService.getWeather(destination),
    ]);

    console.log(
      `[${requestId}] Data fetched: ${attractions.length} attractions, ${restaurants.length} restaurants, ${hotels.length} hotels.`
    );

    if (attractions.length === 0) {
      attractions.push({
        name: `${destination} City Center`,
        description: 'Explore the city center',
        coordinates: { lat: 0, lon: 0 },
      });
    }
    if (restaurants.length === 0) {
      restaurants.push({
        name: 'Local Restaurant',
        cuisine: 'Local',
        description: 'Try local cuisine',
        priceLevel: '$$',
        coordinates: { lat: 0, lon: 0 },
      });
    }

    const itineraryDays = [];
    const start = new Date(startDate);

    const formatLocation = (item) => {
      if (item?.coordinates && typeof item.coordinates.lat === 'number' && typeof item.coordinates.lon === 'number') {
        return `${item.coordinates.lat.toFixed(4)}, ${item.coordinates.lon.toFixed(4)}`;
      }
      return destination;
    };

    const buildSuggestion = (place) => ({
      title: place.name,
      summary: place.description || 'Worth adding to your plans if time allows.',
      location: formatLocation(place),
      type: place.type || 'attraction',
    });

    for (let i = 0; i < days; i += 1) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);

      const attractionIndices = [
        (i * 3) % attractions.length,
        (i * 3 + 1) % attractions.length,
        (i * 3 + 2) % attractions.length,
      ];
      const morningAttraction = attractions[attractionIndices[0]];
      const afternoonAttraction = attractions[attractionIndices[1]];
      const eveningHighlight = attractions[attractionIndices[2]];

      const lunchRestaurant = restaurants[i % restaurants.length];
      const dinnerRestaurant = restaurants[(i + 1) % restaurants.length];

      const usedAttractionIds = new Set(attractionIndices.map((index) => attractions[index]?.id).filter(Boolean));
      const suggestionPool = attractions.filter((place) => !usedAttractionIds.has(place.id));
      const daySuggestions = suggestionPool.slice(0, 4).map(buildSuggestion);

      itineraryDays.push({
        id: i + 1,
        date: currentDate.toISOString().split('T')[0],
        title: `Day ${i + 1}: Discovery & Moments`,
        activities: [
          {
            id: 1,
            time: '09:00',
            title: `Explore ${morningAttraction.name}`,
            type: 'sightseeing',
            location: formatLocation(morningAttraction),
            notes: morningAttraction.description || 'Start the day by soaking in the local highlights.',
            duration: '3h',
          },
          {
            id: 2,
            time: '12:30',
            title: `Lunch at ${lunchRestaurant.name}`,
            type: 'meal',
            location: formatLocation(lunchRestaurant),
            notes: `${lunchRestaurant.cuisine || 'Local'} cuisine pick for the afternoon.`,
            duration: '1h 30m',
            price: lunchRestaurant.priceLevel || '$$',
          },
          {
            id: 3,
            time: '15:30',
            title: `Afternoon at ${afternoonAttraction.name}`,
            type: 'sightseeing',
            location: formatLocation(afternoonAttraction),
            notes: afternoonAttraction.description || 'A perfect mid-day cultural stop.',
            duration: '2h',
          },
          {
            id: 4,
            time: '18:00',
            title: `Golden Hour at ${eveningHighlight.name}`,
            type: 'sightseeing',
            location: formatLocation(eveningHighlight),
            notes: eveningHighlight.description || 'Capture sunset moments before dinner.',
            duration: '1h 30m',
          },
          {
            id: 5,
            time: '20:00',
            title: `Dinner at ${dinnerRestaurant.name}`,
            type: 'meal',
            location: formatLocation(dinnerRestaurant),
            notes: `${dinnerRestaurant.cuisine || 'Local'} cuisine to wrap up the day.`,
            duration: '2h',
            price: dinnerRestaurant.priceLevel || '$$',
          },
        ],
        suggestions: daySuggestions,
      });
    }

    const itinerary = {
      destination,
      duration: `${days} days`,
      travelDates: `${start.toLocaleDateString()} - ${new Date(
        start.getTime() + (days - 1) * 24 * 60 * 60 * 1000
      ).toLocaleDateString()}`,
      travelers,
      budget: freeDataService.getBudgetSymbol(budget),
      weather,
      days: itineraryDays,
    };

    console.log(`[${requestId}] ✅ Itinerary generated successfully for ${destination}`);
    res.json(itinerary);
  } catch (error) {
    console.error(`[${requestId}] Error generating itinerary:`, error);
    res.status(500).json({ error: 'Failed to generate itinerary', message: error.message });
  }
});

export default router;
