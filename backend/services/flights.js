// services/flights.js
export async function getFlights(
    token,
    origin,
    destination,
    departureDate,
    adults = 1,
    max = 3
  ) {
    if (!origin || !destination || !departureDate) {
      throw new Error("origin, destination, and departureDate are required");
    }
  
    const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departureDate}&adults=${adults}&max=${max}`;
  
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  
    // const data = await res.json();
    const data = await res.json();
    if (!res.ok) {
      console.error("Amadeus Flight API Error:", data);
      throw new Error(data?.errors?.[0]?.detail || "Amadeus flight fetch failed");
    }
  
    if (!data.data || data.data.length === 0) {
      return []; // no flights found
    }
  
    return data.data.map((f) => ({
      type: "flight",
      provider: "Amadeus",
      from: origin,
      to: destination,
      price: f.price?.total || 0,
      duration: f.itineraries?.[0]?.duration || "N/A",
      details: { airline: f.validatingAirlineCodes?.[0] || "Unknown" },
    }));
  }
  