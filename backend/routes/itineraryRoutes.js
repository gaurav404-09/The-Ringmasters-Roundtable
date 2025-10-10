import express from 'express';
import freeDataService from '../services/freeDataService.js';
import CohereItineraryService from '../services/cohereItineraryService.js';

const router = express.Router();
const cohereService = new CohereItineraryService();

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
    console.log(`[${requestId}] User interests: ${interests ? interests.join(', ') : 'None specified'}`);

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
      const breakfastRestaurant = restaurants[(i + 2) % restaurants.length];
      const hotel = hotels[i % Math.max(hotels.length, 1)];

      const usedAttractionIds = new Set(attractionIndices.map((index) => attractions[index]?.id).filter(Boolean));
      const suggestionPool = attractions.filter((place) => !usedAttractionIds.has(place.id));
      const daySuggestions = suggestionPool.slice(0, 4).map(buildSuggestion);

      // Build activities array
      const activities = [];

      // Add check-in activity for first day
      if (i === 0 && hotel) {
        activities.push({
          id: 1,
          time: '14:00',
          title: `Check-in at ${hotel.name || 'Hotel'}`,
          type: 'hotel',
          location: formatLocation(hotel),
          notes: `Hotel check-in. ${hotel.description || 'Settle in and freshen up before exploring.'}`,
          duration: '30m',
          includes: ['Room keys', 'Welcome amenities', 'Hotel orientation'],
          status: 'confirmed'
        });
      }

      // Add breakfast for all days except first (assuming arrival day)
      if (i > 0) {
        activities.push({
          id: activities.length + 1,
          time: '08:00',
          title: `Breakfast at ${breakfastRestaurant.name || 'Hotel Restaurant'}`,
          type: 'meal',
          location: hotel ? formatLocation(hotel) : formatLocation(breakfastRestaurant),
          notes: `Start your day with a hearty ${breakfastRestaurant.cuisine || 'local'} breakfast.`,
          duration: '1h',
          price: breakfastRestaurant.priceLevel || '$',
          includes: ['Continental breakfast', 'Fresh juice', 'Coffee/Tea']
        });

        // Add morning interest-based activities
        if (interests && interests.length > 0) {
          const morningInterests = interests.filter(interest => 
            ['wellness', 'nature', 'photography', 'cultural', 'adventure', 'sports'].includes(interest.toLowerCase())
          );

          if (morningInterests.length > 0) {
            try {
              console.log(`[${requestId}] Generating morning activities for Day ${i + 1} with interests: ${morningInterests.join(', ')}`);
              const morningActivities = await cohereService.generateInterestBasedActivities(
                destination, 
                morningInterests, 
                i + 1, 
                'morning'
              );

              if (morningActivities && morningActivities.length > 0) {
                const morningActivity = morningActivities[0];
                activities.push({
                  id: activities.length + 1,
                  time: morningActivity.time || '09:15',
                  title: morningActivity.title,
                  type: morningActivity.type || 'activity',
                  location: morningActivity.location || formatLocation(morningAttraction),
                  notes: morningActivity.description || 'Morning activity tailored to your interests.',
                  duration: morningActivity.duration || '1h 30m',
                  price: morningActivity.price,
                  includes: morningActivity.includes,
                  interest_category: morningActivity.interest_category,
                  status: 'recommended'
                });
              }
            } catch (error) {
              console.error(`[${requestId}] Error generating morning activities:`, error);
            }
          }
        }
      }

      // Morning activity
      activities.push({
        id: activities.length + 1,
        time: i === 0 ? '16:00' : '09:30', // Later start on arrival day
        title: `Explore ${morningAttraction.name}`,
        type: 'sightseeing',
        location: formatLocation(morningAttraction),
        notes: morningAttraction.description || 'Start the day by soaking in the local highlights.',
        duration: '3h',
      });

      // Lunch
      activities.push({
        id: activities.length + 1,
        time: i === 0 ? '19:00' : '12:30', // Later lunch on arrival day
        title: `Lunch at ${lunchRestaurant.name}`,
        type: 'meal',
        location: formatLocation(lunchRestaurant),
        notes: `${lunchRestaurant.cuisine || 'Local'} cuisine pick for the afternoon.`,
        duration: '1h 30m',
        price: lunchRestaurant.priceLevel || '$$',
      });

      // Only add afternoon activities if not arrival day or if there's time
      if (i > 0) {
        // Generate interest-based activities using AI
        let interestActivities = [];
        if (interests && interests.length > 0) {
          try {
            console.log(`[${requestId}] Generating AI activities for Day ${i + 1} with interests: ${interests.join(', ')}`);
            interestActivities = await cohereService.generateInterestBasedActivities(
              destination, 
              interests, 
              i + 1, 
              'afternoon'
            );
            console.log(`[${requestId}] Generated ${interestActivities.length} AI activities for Day ${i + 1}`);
          } catch (error) {
            console.error(`[${requestId}] Error generating AI activities:`, error);
          }
        }

        // Add AI-generated interest-based activities or fallback to default
        if (interestActivities && interestActivities.length > 0) {
          // Add the first AI-generated activity
          const aiActivity = interestActivities[0];
          activities.push({
            id: activities.length + 1,
            time: aiActivity.time || '15:30',
            title: aiActivity.title,
            type: aiActivity.type || 'activity',
            location: aiActivity.location || formatLocation(afternoonAttraction),
            notes: aiActivity.description || aiActivity.notes || 'AI-generated activity based on your interests.',
            duration: aiActivity.duration || '2h',
            price: aiActivity.price,
            includes: aiActivity.includes,
            interest_category: aiActivity.interest_category,
            status: 'suggested'
          });

          // Add second AI activity if available
          if (interestActivities.length > 1) {
            const secondActivity = interestActivities[1];
            activities.push({
              id: activities.length + 1,
              time: secondActivity.time || '18:00',
              title: secondActivity.title,
              type: secondActivity.type || 'activity',
              location: secondActivity.location || formatLocation(eveningHighlight),
              notes: secondActivity.description || secondActivity.notes || 'Another personalized activity for your interests.',
              duration: secondActivity.duration || '1h 30m',
              price: secondActivity.price,
              includes: secondActivity.includes,
              interest_category: secondActivity.interest_category,
              status: 'suggested'
            });
          } else {
            // Fallback to default evening activity
            activities.push({
              id: activities.length + 1,
              time: '18:00',
              title: `Golden Hour at ${eveningHighlight.name}`,
              type: 'sightseeing',
              location: formatLocation(eveningHighlight),
              notes: eveningHighlight.description || 'Capture sunset moments before dinner.',
              duration: '1h 30m',
            });
          }
        } else {
          // Fallback to default activities if AI generation fails
          activities.push({
            id: activities.length + 1,
            time: '15:30',
            title: `Afternoon at ${afternoonAttraction.name}`,
            type: 'sightseeing',
            location: formatLocation(afternoonAttraction),
            notes: afternoonAttraction.description || 'A perfect mid-day cultural stop.',
            duration: '2h',
          });

          activities.push({
            id: activities.length + 1,
            time: '18:00',
            title: `Golden Hour at ${eveningHighlight.name}`,
            type: 'sightseeing',
            location: formatLocation(eveningHighlight),
            notes: eveningHighlight.description || 'Capture sunset moments before dinner.',
            duration: '1h 30m',
          });
        }
      }

      // Dinner
      activities.push({
        id: activities.length + 1,
        time: '20:00',
        title: `Dinner at ${dinnerRestaurant.name}`,
        type: 'meal',
        location: formatLocation(dinnerRestaurant),
        notes: `${dinnerRestaurant.cuisine || 'Local'} cuisine to wrap up the day.`,
        duration: '2h',
        price: dinnerRestaurant.priceLevel || '$$',
      });

      // Add special interest-based evening activities (nightlife, shopping, etc.)
      if (interests && interests.length > 0 && i > 0) {
        // Check for specific interests that have evening activities
        const eveningInterests = interests.filter(interest => 
          ['nightlife', 'shopping', 'entertainment', 'music', 'cultural'].includes(interest.toLowerCase())
        );

        if (eveningInterests.length > 0) {
          try {
            console.log(`[${requestId}] Generating evening activities for interests: ${eveningInterests.join(', ')}`);
            const eveningActivities = await cohereService.generateInterestBasedActivities(
              destination, 
              eveningInterests, 
              i + 1, 
              'evening'
            );

            if (eveningActivities && eveningActivities.length > 0) {
              const eveningActivity = eveningActivities[0];
              activities.push({
                id: activities.length + 1,
                time: eveningActivity.time || '22:30',
                title: eveningActivity.title,
                type: eveningActivity.type || 'entertainment',
                location: eveningActivity.location || `${destination} Entertainment District`,
                notes: eveningActivity.description || 'Evening activity based on your interests.',
                duration: eveningActivity.duration || '2h',
                price: eveningActivity.price,
                includes: eveningActivity.includes,
                interest_category: eveningActivity.interest_category,
                status: 'optional'
              });
            }
          } catch (error) {
            console.error(`[${requestId}] Error generating evening activities:`, error);
          }
        }
      }

      // Add check-out activity for last day
      if (i === days - 1 && hotel) {
        activities.push({
          id: activities.length + 1,
          time: '11:00',
          title: `Check-out from ${hotel.name || 'Hotel'}`,
          type: 'hotel',
          location: formatLocation(hotel),
          notes: 'Hotel check-out. Collect luggage and prepare for departure.',
          duration: '30m',
          includes: ['Final bill settlement', 'Luggage assistance', 'Transportation arrangement']
        });
      }

      itineraryDays.push({
        id: i + 1,
        date: currentDate.toISOString().split('T')[0],
        title: `Day ${i + 1}: ${i === 0 ? 'Arrival & First Impressions' : i === days - 1 ? 'Final Discoveries & Departure' : 'Discovery & Moments'}`,
        activities,
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
      interests: interests || [],
      days: itineraryDays,
      aiGenerated: interests && interests.length > 0 ? true : false,
      personalizedActivities: interests && interests.length > 0 ? 
        `Activities personalized for: ${interests.join(', ')}` : 
        'Standard itinerary with local attractions'
    };

    console.log(`[${requestId}] ✅ Itinerary generated successfully for ${destination}`);
    res.json(itinerary);
  } catch (error) {
    console.error(`[${requestId}] Error generating itinerary:`, error);
    res.status(500).json({ error: 'Failed to generate itinerary', message: error.message });
  }
});

export default router;
