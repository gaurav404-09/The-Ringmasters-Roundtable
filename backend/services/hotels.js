// services/hotels.js
export async function getHotels(
  token,
  cityCode,
  checkInDate,
  checkOutDate,
  adults = 1
) {
  console.log('Starting hotel search with params:', { 
    cityCode, 
    checkInDate, 
    checkOutDate, 
    adults 
  });

  if (!cityCode || !checkInDate || !checkOutDate) {
    const error = new Error("cityCode, checkInDate, and checkOutDate are required");
    console.error('Validation error:', error.message);
    throw error;
  }

  try {
    // Step 1: Get hotel IDs in the city
    console.log('Fetching hotel IDs for city:', cityCode);
    const hotelRes = await fetch(
      `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}`,
      { 
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (!hotelRes.ok) {
      const errorText = await hotelRes.text();
      console.error('Hotel API error (hotel list):', {
        status: hotelRes.status,
        statusText: hotelRes.statusText,
        body: errorText
      });
      throw new Error(`Hotel API error: ${hotelRes.status} ${hotelRes.statusText}`);
    }

    const hotelData = await hotelRes.json();
    console.log('Raw hotel data:', JSON.stringify(hotelData, null, 2));

    if (!hotelData.data || !Array.isArray(hotelData.data) || hotelData.data.length === 0) {
      console.log('No hotels found in the specified city');
      return [];
    }

    // Get top 3 hotels
    const topHotels = hotelData.data.slice(0, 3);
    console.log(`Found ${topHotels.length} hotels, fetching offers...`);

    // Step 2: Fetch hotel offers for those IDs
    const hotelResults = [];
    
    for (const hotel of topHotels) {
      try {
        console.log(`Fetching offers for hotel: ${hotel.hotelId} - ${hotel.name}`);
        const offerRes = await fetch(
          `https://test.api.amadeus.com/v3/shopping/hotel-offers?hotelIds=${hotel.hotelId}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=${adults}`,
          { 
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        if (!offerRes.ok) {
          console.error(`Error fetching offers for hotel ${hotel.hotelId}:`, offerRes.status, offerRes.statusText);
          continue; // Skip to next hotel if there's an error
        }

        const offerData = await offerRes.json();
        
        if (!offerData.data || !Array.isArray(offerData.data) || offerData.data.length === 0) {
          console.log(`No offers found for hotel ${hotel.hotelId}`);
          continue;
        }

        // Get the first offer for this hotel
        const offer = offerData.data[0];
        const price = parseFloat(offer.offers?.[0]?.price?.total || 0);
        
        hotelResults.push({
          type: 'hotel',
          provider: 'Amadeus',
          name: offer.hotel?.name || 'Hotel',
          location: cityCode,
          price: price,
          rating: offer.hotel?.rating || 0,
          details: {
            hotelName: offer.hotel?.name || 'Hotel',
            rating: offer.hotel?.rating || 0,
            address: [
              offer.hotel?.address?.lines?.[0],
              offer.hotel?.address?.cityName,
              offer.hotel?.address?.postalCode,
              offer.hotel?.address?.countryCode
            ].filter(Boolean).join(', '),
            amenities: offer.hotel?.amenities?.map(a => a.toLowerCase().replace(/_/g, ' ')) || [],
            description: offer.hotel?.description?.text || '',
            checkIn: offer.offers?.[0]?.checkIn || '14:00',
            checkOut: offer.offers?.[0]?.checkOut || '12:00',
            roomType: offer.offers?.[0]?.room?.type || 'Standard',
            boardType: offer.offers?.[0]?.boardType || 'Room Only'
          }
        });
      } catch (error) {
        console.error(`Error processing hotel ${hotel.hotelId}:`, error);
        // Continue with next hotel even if one fails
      }
    }

    console.log(`Found ${hotelResults.length} valid hotel offers`);
    return hotelResults;
  } catch (error) {
    console.error('Error in getHotels:', error);
    throw error; // Re-throw to be handled by the caller
  }
}
