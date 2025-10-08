// services/flights.js
// Helper to enforce request timeouts with AbortController
const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

export async function getFlights(
  token,
  origin,
  destination,
  departureDate,
  adults = 1,
  max = 5
) {
  console.log('Starting flight search with params:', { origin, destination, departureDate, adults, max });
  
  if (!origin || !destination || !departureDate) {
    const error = new Error("origin, destination, and departureDate are required");
    console.error('Validation error:', error.message);
    throw error;
  }

  try {
    // Request INR to align with frontend display
    const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departureDate}&adults=${adults}&max=${max}&currencyCode=INR`;
    console.log('Making API request to:', url);

    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      },
      12000 // 12s timeout for flight search
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flight API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Flight API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Raw flight data:', JSON.stringify(data, null, 2));

    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      console.log('No flight data found in response');
      return [];
    }

    // Transform the flight data to match our expected format
    const flights = data.data.map((offer, index) => {
      const itinerary = offer.itineraries?.[0];
      const segment = itinerary?.segments?.[0];
      const price = parseFloat(offer.price?.total) || 0;
      const currency = offer.price?.currency || 'INR';

      // Format duration like "2h 30m"
      const rawDuration = itinerary?.duration || '';
      const formattedDuration = typeof rawDuration === 'string' && rawDuration.startsWith('PT')
        ? rawDuration.replace('PT', '').replace('H', 'h ').replace('M', 'm')
        : (rawDuration || 'N/A');
      
      return {
        type: 'flight',
        provider: segment?.carrierCode || 'Airline',
        from: origin,
        to: destination,
        price: price,
        currency,
        duration: formattedDuration,
        details: {
          airline: segment?.carrierCode || 'N/A',
          flightNumber: `${segment?.carrierCode || ''} ${segment?.number || ''}`.trim(),
          departureTime: segment?.departure?.at?.substring(11, 16) || 'N/A',
          arrivalTime: segment?.arrival?.at?.substring(11, 16) || 'N/A',
          aircraft: segment?.aircraft?.code || 'N/A',
          cabin: offer.travelerPricings?.[0]?.fareOption || 'ECONOMY',
          stops: (itinerary?.segments?.length - 1) || 0
        }
      };
    });

    console.log(`Processed ${flights.length} flights`);
    return flights;
  } catch (error) {
    console.error('Error in getFlights:', error);
    throw error; // Re-throw to be handled by the caller
  }
}
