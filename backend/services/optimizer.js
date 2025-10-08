export function findCheapestTrip(flights = [], trains = [], hotels = []) {
  try {
    const options = [];
    const validFlights = Array.isArray(flights) ? flights : [];
    const validTrains = Array.isArray(trains) ? trains : [];
    const validHotels = Array.isArray(hotels) ? hotels : [];

    // If no hotels are available, just return the cheapest transport
    if (validHotels.length === 0) {
      const allTransports = [...validFlights, ...validTrains]
        .filter(t => t && typeof t.price === 'number')
        .sort((a, b) => a.price - b.price);
      return allTransports[0] || null;
    }

    // If no transports are available, return the cheapest hotel
    if (validFlights.length === 0 && validTrains.length === 0) {
      return validHotels
        .filter(h => h && typeof h.price === 'number')
        .sort((a, b) => a.price - b.price)[0] || null;
    }

    // Generate all possible combinations of transport and hotel
    [...validFlights, ...validTrains].forEach(transport => {
      if (!transport || typeof transport.price !== 'number') return;
      
      validHotels.forEach(hotel => {
        if (!hotel || typeof hotel.price !== 'number') return;
        options.push({
          transport,
          hotel,
          totalCost: transport.price + hotel.price
        });
      });
    });

    // Sort by total cost and return the cheapest option
    return options.sort((a, b) => a.totalCost - b.totalCost)[0] || null;
  } catch (error) {
    console.error('Error in findCheapestTrip:', error);
    return null;
  }
}
