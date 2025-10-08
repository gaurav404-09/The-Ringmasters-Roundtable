// services/hotels.js
export async function getHotels(
    token,
    cityCode,
    checkInDate,
    checkOutDate,
    adults = 1
  ) {
    if (!cityCode || !checkInDate || !checkOutDate) {
      throw new Error("cityCode, checkInDate, and checkOutDate are required");
    }
  
    // Step 1: Get hotel IDs in the city
    const hotelRes = await fetch(
      `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  
    const hotelData = await hotelRes.json();
    // const hotelData = await hotelRes.json();
    if (!hotelRes.ok) {
      console.error("Amadeus Hotel City Lookup Error:", hotelData);
      throw new Error(
        hotelData?.errors?.[0]?.detail || "Hotel city lookup failed"
      );
    }
  
    if (!hotelData.data || hotelData.data.length === 0) {
      return []; // no hotels found
    }
  
    const ids = hotelData.data
      .slice(0, 3) // top 3 hotels
      .map((h) => h.hotelId)
      .join(",");
  
    // Step 2: Fetch hotel offers for those IDs
    const offerRes = await fetch(
      `https://test.api.amadeus.com/v3/shopping/hotel-offers?hotelIds=${ids}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=${adults}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  
    const offers = await offerRes.json();
  
    if (!offers.data || offers.data.length === 0) {
      return []; // no offers found
    }
  
    // Step 3: Map offers to your desired format
    return offers.data.map((h) => ({
      type: "hotel",
      provider: "Amadeus",
      location: cityCode,
      price: parseFloat(h.offers[0]?.price?.total || 0),
      details: { hotelName: h.hotel?.name || "Unknown", rating: h.hotel?.rating },
    }));
  }
  