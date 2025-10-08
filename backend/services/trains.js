// import fetch from "node-fetch";

// export async function getTrains(from, to, date) {
//   const res = await fetch(
//     `http://localhost:4000/trains/getTrainOn?from=${from}&to=${to}&date=${date}`
//   );
//   const json = await res.json();
//   if (!json.success) return [];
//   return json.data; // keep as array of { train_base: {...} }
// }
// services/trainns.js
import fetch from "node-fetch";
if (!globalThis.fetch) globalThis.fetch = fetch;

const TRAIN_API_BASE_URL = process.env.TRAIN_API_URL || "http://localhost:4000/trains/getTrainOn";

export async function getTrains(from, to, date) {
  if (!from || !to || !date) return [];

  const url = `${TRAIN_API_BASE_URL}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(
    to,
  )}&date=${encodeURIComponent(date)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Train API returned non-OK status", res.status);
      return [];
    }
    const json = await res.json();
    if (!json?.success || !Array.isArray(json.data)) {
      return [];
    }
    return json.data;
  } catch (err) {
    console.error("Error calling local train API:", err?.message || err);
    return [];
  }
}
