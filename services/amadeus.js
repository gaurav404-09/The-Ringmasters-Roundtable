// // import fetch from "node-fetch";
// // import dotenv from "dotenv";

// // dotenv.config();

// // const AMADEUS_KEY = process.env.AMADEUS_CLIENT_ID;
// // const AMADEUS_SECRET = process.env.AMADEUS_CLIENT_SECRET;

// // // Step 1: Get Access Token
// // export async function getToken() {
// //   const res = await fetch(
// //     "https://test.api.amadeus.com/v1/security/oauth2/token",
// //     {
// //       method: "POST",
// //       headers: { "Content-Type": "application/x-www-form-urlencoded" },
// //       body: new URLSearchParams({
// //         grant_type: "client_credentials",
// //         client_id: AMADEUS_KEY,
// //         client_secret: AMADEUS_SECRET,
// //       }),
// //     }
// //   );
// //   const data = await res.json();
// //   return data.access_token;
// // }

// // // Step 2: Get Flights
// // export async function getFlights(origin, destination, date) {
// //   const token = await getToken();
// //   const res = await fetch(
// //     `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${date}&adults=1&max=3`,
// //     { headers: { Authorization: `Bearer ${token}` } }
// //   );
// //   const data = await res.json();
// //   if (!data.data) return [];
// //   return data.data.map((f) => ({
// //     type: "flight",
// //     provider: "Amadeus",
// //     from: origin,
// //     to: destination,
// //     price: f.price.total,
// //     duration: f.itineraries[0].duration,
// //     details: { airline: f.itineraries[0].segments[0].carrierCode },
// //   }));
// // }

// // // Step 3: Get Hotels
// // export async function getHotels(cityCode, checkInDate, checkOutDate) {
// //   const token = await getToken();
// //   try {
// //     // Get hotel IDs
// //     const hotelRes = await fetch(
// //       `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}`,
// //       { headers: { Authorization: `Bearer ${token}` } }
// //     );
// //     const hotelData = await hotelRes.json();
// //     if (!hotelData.data || hotelData.data.length === 0) return [];

// //     const ids = hotelData.data
// //       .slice(0, 3)
// //       .map((h) => h.hotelId)
// //       .join(",");

// //     // Get offers
// //     const offerRes = await fetch(
// //       `https://test.api.amadeus.com/v3/shopping/hotel-offers?hotelIds=${ids}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=1`,
// //       { headers: { Authorization: `Bearer ${token}` } }
// //     );
// //     const offers = await offerRes.json();
// //     if (!offers.data) return [];

// //     return offers.data.map((o) => ({
// //       type: "hotel",
// //       provider: "Amadeus",
// //       location: cityCode,
// //       price: o.offers[0].price.total,
// //       details: { hotelName: o.hotel.name, rating: o.hotel.rating },
// //     }));
// //   } catch (err) {
// //     console.error("Hotel fetch error:", err.message);
// //     return [];
// //   }
// // }

// // services/amadeus.js
// import fetch from "node-fetch";
// if (!globalThis.fetch) globalThis.fetch = fetch;

// const AMADEUS_KEY = process.env.AMADEUS_CLIENT_ID;
// const AMADEUS_SECRET = process.env.AMADEUS_CLIENT_SECRET;

// export async function getToken() {
//   if (!AMADEUS_KEY || !AMADEUS_SECRET) {
//     throw new Error("AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET not set");
//   }

//   const res = await fetch(
//     "https://test.api.amadeus.com/v1/security/oauth2/token",
//     {
//       method: "POST",
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       body: new URLSearchParams({
//         grant_type: "client_credentials",
//         client_id: AMADEUS_KEY,
//         client_secret: AMADEUS_SECRET,
//       }),
//     }
//   );

//   if (!res.ok) {
//     const err = await res.text();
//     throw new Error(`Failed to fetch Amadeus token: ${err}`);
//   }

//   const data = await res.json();
//   return data.access_token;
// }

// export async function getFlights(
//   token,
//   origin,
//   destination,
//   date,
//   adults = 1,
//   max = 3
// ) {
//   if (!token) {
//     return [];
//   }

//   // NOTE: Amadeus expects IATA airport/city codes like DEL, BOM, LON, JFK.
//   // If you pass full city names this will often fail — pass 3-letter codes from UI.
//   const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${encodeURIComponent(
//     origin
//   )}&destinationLocationCode=${encodeURIComponent(
//     destination
//   )}&departureDate=${encodeURIComponent(date)}&adults=${adults}&max=${max}`;

//   const res = await fetch(url, {
//     headers: { Authorization: `Bearer ${token}` },
//   });

//   if (!res.ok) {
//     const err = await res.text().catch(() => "");
//     console.error("Amadeus flights error:", err);
//     return [];
//   }

//   const data = await res.json();
//   if (!data.data || data.data.length === 0) return [];

//   return data.data.map((f) => ({
//     type: "flight",
//     provider: "Amadeus",
//     from: origin,
//     to: destination,
//     price: parseFloat(f.price?.total || 0),
//     duration: f.itineraries?.[0]?.duration || "N/A",
//     details: {
//       airline:
//         f.validatingAirlineCodes?.[0] ||
//         f.itineraries?.[0]?.segments?.[0]?.carrierCode ||
//         "Unknown",
//     },
//   }));
// }

// export async function getHotels(
//   token,
//   cityCode,
//   checkInDate,
//   checkOutDate,
//   adults = 1
// ) {
//   if (!token) {
//     return [];
//   }
//   try {
//     // cityCode should be an IATA city code OR Amadeus city code expected by API.
//     const hotelRes = await fetch(
//       `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${encodeURIComponent(
//         cityCode
//       )}`,
//       { headers: { Authorization: `Bearer ${token}` } }
//     );

//     if (!hotelRes.ok) {
//       const err = await hotelRes.text().catch(() => "");
//       console.error("Amadeus hotel location lookup error:", err);
//       return [];
//     }

//     const hotelData = await hotelRes.json();
//     if (!hotelData.data || hotelData.data.length === 0) return [];

//     const ids = hotelData.data
//       .slice(0, 3)
//       .map((h) => h.hotelId)
//       .join(",");

//     const offerRes = await fetch(
//       `https://test.api.amadeus.com/v3/shopping/hotel-offers?hotelIds=${ids}&checkInDate=${encodeURIComponent(
//         checkInDate
//       )}&checkOutDate=${encodeURIComponent(checkOutDate)}&adults=${adults}`,
//       { headers: { Authorization: `Bearer ${token}` } }
//     );

//     if (!offerRes.ok) {
//       const err = await offerRes.text().catch(() => "");
//       console.error("Amadeus hotel offers error:", err);
//       return [];
//     }

//     const offers = await offerRes.json();
//     if (!offers.data || offers.data.length === 0) return [];

//     return offers.data.map((o) => ({
//       type: "hotel",
//       provider: "Amadeus",
//       location: cityCode,
//       price: parseFloat(o.offers?.[0]?.price?.total || 0),
//       details: {
//         hotelName: o.hotel?.name || "Unknown",
//         rating: o.hotel?.rating,
//       },
//     }));
//   } catch (err) {
//     console.error("Hotel fetch error:", err?.message || err);
//     return [];
//   }
// }

import fetch from "node-fetch";
if (!globalThis.fetch) globalThis.fetch = fetch;

const AMADEUS_KEY = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_SECRET = process.env.AMADEUS_CLIENT_SECRET;

// Fetch Amadeus token
export async function getToken() {
  if (!AMADEUS_KEY || !AMADEUS_SECRET) {
    throw new Error("AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET not set");
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
      const err = await res.text().catch(() => "");
      throw new Error(`Failed to fetch Amadeus token: ${err}`);
    }

    const data = await res.json();
    return data.access_token;
  } catch (err) {
    console.error("Amadeus token error:", err.message || err);
    return null;
  }
}

// Fetch Flights
export async function getFlights(
  token,
  origin,
  destination,
  date,
  adults = 1,
  max = 3
) {
  if (!token) return [];

  // Ensure origin/destination are 3-letter IATA codes
  if (
    !origin ||
    origin.length !== 3 ||
    !destination ||
    destination.length !== 3
  ) {
    console.warn("Skipping Amadeus flight fetch: invalid IATA codes", {
      origin,
      destination,
    });
    return [];
  }

  try {
    const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${encodeURIComponent(
      origin
    )}&destinationLocationCode=${encodeURIComponent(
      destination
    )}&departureDate=${encodeURIComponent(date)}&adults=${adults}&max=${max}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Amadeus flights error:", JSON.stringify(err));
      return [];
    }

    const data = await res.json();
    if (!data.data || data.data.length === 0) return [];

    return data.data.map((f) => ({
      type: "flight",
      provider: "Amadeus",
      from: origin,
      to: destination,
      price: parseFloat(f.price?.total || 0),
      duration: f.itineraries?.[0]?.duration || "N/A",
      details: {
        airline:
          f.validatingAirlineCodes?.[0] ||
          f.itineraries?.[0]?.segments?.[0]?.carrierCode ||
          "Unknown",
      },
    }));
  } catch (err) {
    console.error("Amadeus flights fetch failed:", err.message || err);
    return [];
  }
}

// Fetch Hotels
export async function getHotels(
  token,
  cityCode,
  checkInDate,
  checkOutDate,
  adults = 1
) {
  if (!token) return [];

  try {
    // Step 1: Get hotels by city
    const hotelRes = await fetch(
      `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${encodeURIComponent(
        cityCode
      )}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!hotelRes.ok) {
      const err = await hotelRes.text().catch(() => "");
      console.error("Amadeus hotel location lookup error:", err);
      return [];
    }

    const hotelData = await hotelRes.json();
    if (!hotelData.data || hotelData.data.length === 0) return [];

    // Only take hotel IDs that exist
    const validHotelIds = hotelData.data
      .slice(0, 3) // top 3 hotels
      .map((h) => h.hotelId)
      .filter(Boolean);

    if (validHotelIds.length === 0) return [];

    // Step 2: Fetch hotel offers
    const offerRes = await fetch(
      `https://test.api.amadeus.com/v3/shopping/hotel-offers?hotelIds=${validHotelIds.join(
        ","
      )}&checkInDate=${encodeURIComponent(
        checkInDate
      )}&checkOutDate=${encodeURIComponent(checkOutDate)}&adults=${adults}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!offerRes.ok) {
      const err = await offerRes.text().catch(() => "");
      console.error("Amadeus hotel offers error:", err);
      return [];
    }

    const offers = await offerRes.json();
    if (!offers.data || offers.data.length === 0) return [];

    // Map hotel offers to frontend-friendly format
    return offers.data.map((o) => ({
      type: "hotel",
      provider: "Amadeus",
      location: cityCode,
      price: parseFloat(o.offers?.[0]?.price?.total || 0),
      details: {
        hotelName: o.hotel?.name || "Unknown",
        rating: o.hotel?.rating || "N/A",
      },
    }));
  } catch (err) {
    console.error("Amadeus hotel fetch failed:", err.message || err);
    return [];
  }
}
