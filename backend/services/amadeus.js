import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const AMADEUS_KEY = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_SECRET = process.env.AMADEUS_CLIENT_SECRET;

// Step 1: Get Access Token
export async function getToken() {
  console.log('\n=== Environment Variables ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('AMADEUS_CLIENT_ID:', process.env.AMADEUS_CLIENT_ID ? '***' + process.env.AMADEUS_CLIENT_ID.slice(-4) : 'MISSING');
  console.log('AMADEUS_CLIENT_SECRET:', process.env.AMADEUS_CLIENT_SECRET ? '***' + process.env.AMADEUS_CLIENT_SECRET.slice(-4) : 'MISSING');
  
  if (!AMADEUS_KEY || !AMADEUS_SECRET) {
    throw new Error('Missing Amadeus API credentials. Please check your .env file');
  }
  
  try {
    const res = await fetch(
      "https://test.api.amadeus.com/v1/security/oauth2/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: AMADEUS_KEY,
          client_secret: AMADEUS_SECRET,
        }),
      }
    );
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Amadeus Token Error:', res.status, errorText);
      throw new Error(`Failed to get Amadeus token: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log('Successfully obtained Amadeus token');
    return data.access_token;
  } catch (error) {
    console.error('Error in getToken:', error);
    throw error;
  }
}


// Import the service functions
import { getFlights as getFlightsService } from './flights.js';
import { getHotels as getHotelsService } from './hotels.js';

// Step 2: Get Flights
export async function getFlights(origin, destination, date) {
  console.log('\n=== Starting flight search ===');
  console.log('Environment Variables:', {
    NODE_ENV: process.env.NODE_ENV,
    AMADEUS_CLIENT_ID: process.env.AMADEUS_CLIENT_ID ? '***' + process.env.AMADEUS_CLIENT_ID.slice(-4) : 'MISSING',
    AMADEUS_CLIENT_SECRET: process.env.AMADEUS_CLIENT_SECRET ? '***' + process.env.AMADEUS_CLIENT_SECRET.slice(-4) : 'MISSING'
  });
  
  try {
    console.log(`\n=== Flight Search Parameters ===`);
    console.log(`Origin: ${origin}`);
    console.log(`Destination: ${destination}`);
    console.log(`Date: ${date}`);
    
    if (!origin || !destination || !date) {
      const error = new Error('Missing required parameters for flight search');
      console.error('Validation Error:', error.message);
      throw error;
    }
    
    // Get authentication token
    console.log('Getting Amadeus token...');
    const token = await getToken();
    
    // Use the flights service to get flight data
    console.log('Calling getFlightsService with:', { origin, destination, date });
    const flights = await getFlightsService(token, origin, destination, date);
    console.log('Received flights data:', JSON.stringify(flights, null, 2));
    
    // Transform the flight data to match the expected format
    const formattedFlights = flights.map(flight => ({
      type: 'flight',
      provider: flight.provider,
      from: flight.from,
      to: flight.to,
      price: parseFloat(flight.price) || 0,
      duration: flight.duration || 'N/A',
      details: {
        airline: flight.details?.airline || 'N/A',
        flightNumber: flight.details?.flightNumber || 'N/A',
        departureTime: flight.details?.departureTime || 'N/A',
        arrivalTime: flight.details?.arrivalTime || 'N/A',
        aircraft: flight.details?.aircraft || 'N/A',
        cabin: flight.details?.cabin || 'ECONOMY'
      }
    }));
    
    /* Uncomment this to enable real API calls
    const token = await getToken();
    console.log(`Fetching flights from ${origin} to ${destination} on ${date}`);
    const res = await fetch(
      `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${date}&adults=1&max=3`,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Amadeus API error: ${res.status} ${res.statusText} - ${errorText}`);
    }
    
    const data = await res.json();
    console.log('Flight API response:', JSON.stringify(data, null, 2));
    
    if (!data.data || !Array.isArray(data.data)) {
      console.warn('No flight data found in response');
      return [];
    }
    
    return data.data.map((f) => ({
      type: "flight",
      provider: "Amadeus",
      from: origin,
      to: destination,
      price: f.price?.total || 'Price not available',
      duration: f.itineraries?.[0]?.duration || 'Duration not available',
      details: { 
        airline: f.itineraries?.[0]?.segments?.[0]?.carrierCode || 'N/A',
        flightNumber: f.itineraries?.[0]?.segments?.[0]?.number || 'N/A',
        departureTime: f.itineraries?.[0]?.segments?.[0]?.departure?.at?.substring(11, 16) || 'N/A',
        arrivalTime: f.itineraries?.[0]?.segments?.slice(-1)[0]?.arrival?.at?.substring(11, 16) || 'N/A'
      },
    }));
    */
  } catch (error) {
    console.error('Error in getFlights:', error);
    console.log('Returning empty flight data');
    return [];
  }
}


// Step 3: Get Hotels
export async function getHotels(cityCode, checkInDate, checkOutDate) {
  try {
    console.log(`Fetching real hotel data for ${cityCode} from ${checkInDate} to ${checkOutDate}`);
    
    // Get authentication token
    const token = await getToken();
    
    // Use the hotels service to get hotel data
    console.log('Calling getHotelsService with:', { cityCode, checkInDate, checkOutDate });
    const hotels = await getHotelsService(token, cityCode, checkInDate, checkOutDate);
    console.log('Received hotels data:', JSON.stringify(hotels, null, 2));
    
    // Transform the hotel data to match the expected format
    const formattedHotels = hotels.map(hotel => ({
      type: 'hotel',
      provider: hotel.provider,
      name: hotel.details?.hotelName || 'Hotel',
      location: hotel.location || cityCode,
      price: parseFloat(hotel.price) || 0,
      rating: hotel.details?.rating || 0,
      details: {
        hotelName: hotel.details?.hotelName || 'Hotel',
        rating: hotel.details?.rating || 0,
        amenities: Array.isArray(hotel.details?.amenities) ? hotel.details.amenities : [],
        checkIn: hotel.details?.checkIn || '14:00',
        checkOut: hotel.details?.checkOut || '12:00',
        address: hotel.details?.address || `${cityCode}, India`
      }
    }));
    
    // First, get city code if not already in IATA format
    let cityIataCode = cityCode;
    if (cityCode.length > 3) {
      // This is a simplified version - in production, you'd want to use Amadeus' reference data API
      cityIataCode = cityCode.slice(0, 3).toUpperCase();
    }
    
    // Format dates to YYYY-MM-DD if needed
    const formatDate = (dateStr) => new Date(dateStr).toISOString().split('T')[0];
    const checkIn = formatDate(checkInDate);
    const checkOut = formatDate(checkOutDate);
    
    console.log(`Calling Amadeus API for hotels in ${cityIataCode} from ${checkIn} to ${checkOut}`);
    
    // First, search for hotels
    const searchResponse = await fetch(
      `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityIataCode}&radius=50&radiusUnit=KM&hotelSource=ALL`,
      { 
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Amadeus hotel search error:', errorText);
      throw new Error(`Failed to search hotels: ${searchResponse.status} ${searchResponse.statusText}`);
    }
    
    const searchData = await searchResponse.json();
    console.log('Amadeus hotel search response:', JSON.stringify(searchData, null, 2));
    
    if (!searchData.data || searchData.data.length === 0) {
      console.warn('No hotels found in the specified location');
      return [];
    }
    
    // For demo, take first 5 hotels
    const hotelsToCheck = searchData.data.slice(0, 5);
    const hotelsWithPrices = [];
    
    // Get pricing for each hotel (simplified - in production, you'd want to batch these)
    for (const hotel of hotelsToCheck) {
      try {
        const priceResponse = await fetch(
          `https://test.api.amadeus.com/v3/shopping/hotel-offers?hotelIds=${hotel.hotelId}&adults=1&checkInDate=${checkIn}&checkOutDate=${checkOut}`,
          { 
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            } 
          }
        );
        
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          if (priceData.data && priceData.data.length > 0) {
            const offer = priceData.data[0].offers[0];
            hotelsWithPrices.push({
              type: 'hotel',
              provider: 'Amadeus',
              location: cityIataCode,
              price: parseFloat(offer.price.total) || 0,
              details: {
                hotelName: hotel.name || 'Hotel',
                rating: Math.min(5, Math.max(3, Math.random() * 2 + 3)).toFixed(1), // Random rating between 3-5
                address: `${hotel.address?.lines?.[0] || ''}, ${cityCode}`.trim(),
                checkIn: '14:00',
                checkOut: '12:00',
                amenities: ['Free WiFi', 'Restaurant', 'Pool'].slice(0, Math.floor(Math.random() * 3) + 1)
              }
            });
          }
        }
      } catch (error) {
        console.error(`Error getting price for hotel ${hotel.hotelId}:`, error);
      }
      
      // Add small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return hotelsWithPrices;
    
    /* Uncomment this to enable real API calls
    const token = await getToken();
    console.log(`Fetching hotels in ${cityCode} from ${checkInDate} to ${checkOutDate}`);
    
    // Get hotel IDs
    const hotelRes = await fetch(
      `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}`,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    
    if (!hotelRes.ok) {
      const errorText = await hotelRes.text();
      throw new Error(`Amadeus hotels API error: ${hotelRes.status} ${hotelRes.statusText} - ${errorText}`);
    }
    
    const hotelData = await hotelRes.json();
    console.log('Hotels API response:', JSON.stringify(hotelData, null, 2));
    
    if (!hotelData.data || !Array.isArray(hotelData.data) || hotelData.data.length === 0) {
      console.warn('No hotel data found in response');
      return [];
    }

    const ids = hotelData.data
      .slice(0, 3)
      .map((h) => h.hotelId)
      .join(",");

    // Get offers
    const offerRes = await fetch(
      `https://test.api.amadeus.com/v3/shopping/hotel-offers?hotelIds=${ids}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=1`,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    
    if (!offerRes.ok) {
      const errorText = await offerRes.text();
      throw new Error(`Amadeus hotel offers API error: ${offerRes.status} ${offerRes.statusText} - ${errorText}`);
    }
    
    const offers = await offerRes.json();
    
    if (!offers.data || !Array.isArray(offers.data)) {
      console.warn('No hotel offers found in response');
      return [];
    }

    return offers.data.map((o) => ({
      type: "hotel",
      provider: "Amadeus",
      location: cityCode,
      price: o.offers?.[0]?.price?.total || 'Price on request',
      details: { 
        hotelName: o.hotel?.name || 'Unknown Hotel', 
        rating: o.hotel?.rating || 0,
        address: o.hotel?.address?.lines?.join(', ') || 'Address not available',
        checkIn: o.hotel?.checkIn?.from || '14:00',
        checkOut: o.hotel?.checkOut?.until || '12:00'
      },
    }));
    */
  } catch (error) {
    console.error('Error fetching hotels:', error);
    // Return mock data in case of error
    return MOCK_HOTELS;
  }
}
