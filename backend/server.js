const express = require('express');
const cors = require('cors');
const freeDataService = require('./services/freeDataService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

app.post('/api/itinerary', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 8);
  
  try {
    console.log(`\n=== New Itinerary Request (ID: ${requestId}) ===`);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { destination, days, interests, startDate, budget, travelers } = req.body;
    
    if (!destination || !days || !startDate) {
      const errorMsg = 'Missing required fields: destination, days, startDate';
      console.error(`[${requestId}] Error: ${errorMsg}`);
      return res.status(400).json({ 
        error: errorMsg 
      });
    }

    console.log(`[${requestId}] 🎯 Generating ${days}-day itinerary for ${destination}`);
    console.log(`[${requestId}] Interests:`, interests || 'None specified');
    console.log(`[${requestId}] Budget:`, budget || 'Not specified');
    console.log(`[${requestId}] Travelers:`, travelers || 'Not specified');
    console.log(`[${requestId}] Start date:`, startDate);
    
    const startTime = Date.now();
    console.log(`[${requestId}] Starting API calls...`);

    // Fetch data from free APIs
    let attractions = [];
    let restaurants = [];
    let hotels = [];
    let weather = null;

    // Fetch attractions with detailed logging
    try {
      console.log(`[${requestId}] 1/4 Fetching attractions...`);
      const attractionsStartTime = Date.now();
      attractions = await freeDataService.getAttractions(destination, budget);
      const attractionsTime = Date.now() - attractionsStartTime;
      console.log(`[${requestId}] ✓ Attractions: ${attractions?.length || 0} found (${attractionsTime}ms)`);
      if (attractions.length > 0) {
        console.log(`[${requestId}] Sample attractions:`, 
          attractions.slice(0, 3).map(a => ({ name: a.name, type: a.type })));
      }
    } catch (error) {
      console.error(`[${requestId}] ✗ Attractions failed:`, error.message);
      console.error(error.stack);
      attractions = [];
    }
    
    // Fetch restaurants with detailed logging
    try {
      console.log(`[${requestId}] 2/4 Fetching restaurants...`);
      const restaurantsStartTime = Date.now();
      restaurants = await freeDataService.getRestaurants(destination, budget);
      const restaurantsTime = Date.now() - restaurantsStartTime;
      console.log(`[${requestId}] ✓ Restaurants: ${restaurants?.length || 0} found (${restaurantsTime}ms)`);
      if (restaurants.length > 0) {
        console.log(`[${requestId}] Sample restaurants:`, 
          restaurants.slice(0, 3).map(r => ({ name: r.name, cuisine: r.cuisine })));
      }
    } catch (error) {
      console.error(`[${requestId}] ✗ Restaurants failed:`, error.message);
      console.error(error.stack);
      restaurants = [];
    }
    
    // Fetch hotels with detailed logging
    try {
      console.log(`[${requestId}] 3/4 Fetching hotels...`);
      const hotelsStartTime = Date.now();
      hotels = await freeDataService.getHotels(destination, budget);
      const hotelsTime = Date.now() - hotelsStartTime;
      console.log(`[${requestId}] ✓ Hotels: ${hotels?.length || 0} found (${hotelsTime}ms)`);
      if (hotels.length > 0) {
        console.log(`[${requestId}] Sample hotels:`, 
          hotels.slice(0, 3).map(h => ({ name: h.name, price: h.price })));
      }
    } catch (error) {
      console.error(`[${requestId}] ✗ Hotels failed:`, error.message);
      console.error(error.stack);
      hotels = [];
    }

    // Fetch weather with detailed logging
    try {
      console.log(`[${requestId}] 4/4 Fetching weather...`);
      const weatherStartTime = Date.now();
      weather = await freeDataService.getWeather(destination);
      const weatherTime = Date.now() - weatherStartTime;
      console.log(`[${requestId}] ✓ Weather: ${weather?.temperature || 'N/A'}°C, ${weather?.description || 'N/A'} (${weatherTime}ms)`);
    } catch (error) {
      console.error(`[${requestId}] ✗ Weather failed:`, error.message);
      console.error(error.stack);
      weather = { temperature: 'N/A', description: 'Weather unavailable' };
    }
    
    console.log('API Results:');
    console.log(`- Attractions: ${attractions?.length || 0}`);
    console.log(`- Restaurants: ${restaurants?.length || 0}`);
    console.log(`- Hotels: ${hotels?.length || 0}`);

    let itineraryDays = [];
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      
      let dayTitle = '';
      let activities = [];
      
      if (i === 0) {
        dayTitle = 'Arrival & Exploration';
        activities = [
          {
            id: 1,
            time: '14:00',
            title: `Arrive in ${destination}`,
            type: 'flight',
            location: `${destination} Airport`,
            notes: 'Check flight status and arrive 2 hours early',
            duration: '2h',
            status: 'pending'
          },
          {
            id: 2,
            time: '16:00',
            title: 'Check-in to Hotel',
            type: 'hotel',
            location: hotels[0]?.name || `${destination} City Center`,
            notes: hotels[0]?.description || 'Centrally located accommodation',
            duration: '30m',
            status: 'pending'
          }
        ];

        if (attractions.length > 0) {
          activities.push({
            id: 3,
            time: '18:00',
            title: `Visit ${attractions[0].name}`,
            type: 'sightseeing',
            location: attractions[0].location,
            notes: attractions[0].description,
            duration: '2h',
            price: freeDataService.getBudgetSymbol(budget)
          });
        }

        if (restaurants.length > 0) {
          activities.push({
            id: 4,
            time: '20:00',
            title: `Dinner at ${restaurants[0].name}`,
            type: 'meal',
            location: restaurants[0].location,
            notes: `${restaurants[0].cuisine} cuisine`,
            duration: '2h',
            price: restaurants[0].priceRange
          });
        }
      } else if (i === days - 1) {
        dayTitle = 'Departure';
        activities = [
          {
            id: 1,
            time: '10:00',
            title: 'Check-out & Last-minute Shopping',
            type: 'shopping',
            location: 'City Center',
            notes: 'Pick up souvenirs and local products',
            duration: '2h'
          },
          {
            id: 2,
            time: '14:00',
            title: 'Departure',
            type: 'flight',
            location: `${destination} Airport`,
            notes: 'Safe travels!',
            duration: '2h',
            status: 'pending'
          }
        ];
      } else {
        dayTitle = 'Sightseeing & Activities';
        activities = [];

        // Morning attraction
        if (attractions[i % attractions.length]) {
          const attraction = attractions[i % attractions.length];
          activities.push({
            id: 1,
            time: '09:00',
            title: `Visit ${attraction.name}`,
            type: 'sightseeing',
            location: attraction.location,
            notes: attraction.description,
            duration: '3h',
            price: freeDataService.getBudgetSymbol(budget)
          });
        }

        // Lunch
        if (restaurants[(i + 1) % restaurants.length]) {
          const restaurant = restaurants[(i + 1) % restaurants.length];
          activities.push({
            id: 2,
            time: '12:30',
            title: `Lunch at ${restaurant.name}`,
            type: 'meal',
            location: restaurant.location,
            notes: `${restaurant.cuisine} cuisine`,
            duration: '1h 30m',
            price: restaurant.priceRange
          });
        }

        // Afternoon activity
        if (attractions[(i + 1) % attractions.length]) {
          const attraction = attractions[(i + 1) % attractions.length];
          activities.push({
            id: 3,
            time: '15:00',
            title: `Explore ${attraction.name}`,
            type: 'activity',
            location: attraction.location,
            notes: attraction.description,
            duration: '3h',
            price: freeDataService.getBudgetSymbol(budget)
          });
        }

        // Dinner
        if (restaurants[(i + 2) % restaurants.length]) {
          const restaurant = restaurants[(i + 2) % restaurants.length];
          activities.push({
            id: 4,
            time: '19:00',
            title: `Dinner at ${restaurant.name}`,
            type: 'meal',
            location: restaurant.location,
            notes: `${restaurant.cuisine} cuisine`,
            duration: '2h',
            price: restaurant.priceRange
          });
        }
      }
      
      itineraryDays.push({
        id: i + 1,
        date: currentDate.toISOString().split('T')[0],
        title: dayTitle,
        activities
      });
    }

    const itinerary = {
      destination,
      duration: `${days} days`,
      travelDates: `${start.toLocaleDateString()} - ${new Date(start.getTime() + (days - 1) * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
      travelers,
      budget: freeDataService.getBudgetSymbol(budget),
      weather,
      days: itineraryDays,
      summary: {
        attractions: attractions.length,
        restaurants: restaurants.length,
        hotels: hotels.length
      }
    };

    console.log(`✅ Itinerary generated successfully for ${destination}`);
    res.json(itinerary);

  } catch (error) {
    console.error('Error generating itinerary:', error);
    res.status(500).json({ 
      error: 'Failed to generate itinerary',
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
