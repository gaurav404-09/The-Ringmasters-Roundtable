import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const AMADEUS_KEY = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_SECRET = process.env.AMADEUS_CLIENT_SECRET;

// Step 1: Get Access Token
async function getToken() {
  const res = await fetch(
    "https://test.api.amadeus.com/v1/security/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: "GFQ3qzqYadIAEHORawajKPsTUqRnJpOX",
        client_secret: "XwyGF4NLqenNNyYf",
      }),
    }
  );
  const data = await res.json();
  return data.access_token;
}

// Step 2: Flights Search
async function getFlights(token) {
  const res = await fetch(
    "https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=DEL&destinationLocationCode=BOM&departureDate=2025-10-10&adults=1&max=3",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  console.log("Flights:", JSON.stringify(data, null, 2));
}

// Step 3: Hotels Search
async function getHotels(token) {
  // 1. Get hotel IDs in Paris
  const hotelRes = await fetch(
    "https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=PAR",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const hotelData = await hotelRes.json();

  if (!hotelData.data || hotelData.data.length === 0) {
    console.error("No hotels found in this city.");
    return;
  }

  const ids = hotelData.data
    .slice(0, 3)
    .map((h) => h.hotelId)
    .join(",");

  // 2. Get hotel offers
  const offerRes = await fetch(
    `https://test.api.amadeus.com/v3/shopping/hotel-offers?hotelIds=${ids}&checkInDate=2025-10-10&checkOutDate=2025-10-12&adults=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const offers = await offerRes.json();
  console.log("Hotel Offers:", JSON.stringify(offers, null, 2));
}

// Runner
(async () => {
  try {
    const token = await getToken();
    console.log("Access Token:", token);

    await getFlights(token);
    await getHotels(token);
  } catch (err) {
    console.error("Error:", err);
  }
})();
