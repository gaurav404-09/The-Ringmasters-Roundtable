// services/hotels.js
import fetch from 'node-fetch';
import freeDataService from './freeDataService.js';

const DEFAULT_TIMEOUT = 15000;
const MAX_RESULTS = 12;

const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

const buildHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
});

const formatHotelItem = (item, locationLabel) => {
  if (!item) return null;

  const offersArr = Array.isArray(item.offers) ? item.offers : [];
  if (!offersArr.length) {
    console.warn('Hotel item has no offers:', item.hotel?.name || 'Unknown hotel');
    return null;
  }

  const priced = offersArr
    .map((o) => ({
      offer: o,
      price: parseFloat(o?.price?.total || 0),
      currency: typeof o?.price?.currency === 'string' ? o.price.currency : 'INR'
    }))
    .filter((entry) => Number.isFinite(entry.price) && entry.price > 0);

  const selected = priced.length
    ? priced.reduce((min, cur) => (cur.price < min.price ? cur : min), priced[0])
    : {
        offer: offersArr[0],
        price: parseFloat(offersArr[0]?.price?.total || 0) || 0,
        currency: typeof offersArr[0]?.price?.currency === 'string' ? offersArr[0].price.currency : 'INR'
      };

  const offer = selected.offer || offersArr[0];
  const hotelInfo = item.hotel || offer?.hotel || {};
  const price = Number.isFinite(selected.price) && selected.price > 0 ? selected.price : 0;
  const currency = selected.currency || 'INR';

  const addressParts = [
    hotelInfo?.address?.lines?.[0],
    hotelInfo?.address?.cityName,
    hotelInfo?.address?.postalCode,
    hotelInfo?.address?.countryCode
  ].filter(Boolean);

  return {
    type: 'hotel',
    provider: 'Amadeus',
    name: hotelInfo?.name || 'Hotel',
    location: locationLabel || hotelInfo?.address?.cityName || hotelInfo?.address?.countryCode || 'Unknown',
    price,
    currency,
    rating: Number(hotelInfo?.rating) || 0,
    details: {
      hotelName: hotelInfo?.name || 'Hotel',
      rating: Number(hotelInfo?.rating) || 0,
      address: addressParts.join(', '),
      amenities: Array.isArray(hotelInfo?.amenities)
        ? hotelInfo.amenities.map((a) => String(a).toLowerCase().replace(/_/g, ' '))
        : [],
      description: hotelInfo?.description?.text || '',
      checkIn: offer?.checkIn || '14:00',
      checkOut: offer?.checkOut || '12:00',
      roomType: offer?.room?.type || 'Standard',
      boardType: offer?.boardType || 'Room Only'
    }
  };
};

const mapHotels = (data, locationLabel) => (
  (Array.isArray(data) ? data : [])
    .slice(0, MAX_RESULTS)
    .map((item) => formatHotelItem(item, locationLabel))
    .filter(Boolean)
);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const generatePriceFromName = (name = '') => {
  const base = name.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const normalized = clamp(2000 + (base % 6000), 2200, 7800);
  // Round to nearest 50 for a more realistic price presentation
  return Math.round(normalized / 50) * 50;
};

const mapFallbackHotels = (items = [], label = '') => {
  return items.slice(0, MAX_RESULTS).map((hotel) => {
    const name = hotel.name || hotel.hotelName || 'Hotel';
    const priceGuess = hotel.priceLevel === '$'
      ? 2200
      : hotel.priceLevel === '$$$'
        ? 7800
        : 4500;
    const deterministic = generatePriceFromName(name);
    const price = clamp(Math.round((deterministic + priceGuess) / 2), 2000, 8500);

    return {
      type: 'hotel',
      provider: 'OSM',
      name,
      location: label || hotel.city || hotel.coordinates?.lat ? `${hotel.coordinates.lat},${hotel.coordinates.lon}` : 'Unknown',
      price,
      currency: 'INR',
      rating: hotel.rating || 0,
      details: {
        hotelName: name,
        rating: hotel.rating || 0,
        address: hotel.address || label || 'Not available',
        amenities: hotel.amenities || [],
        description: hotel.description || `Stay at ${name} in ${label || 'the destination'}.`,
        checkIn: '13:00',
        checkOut: '11:00',
        roomType: 'Standard',
        boardType: 'Room Only'
      }
    };
  });
};

const fetchFallbackHotels = async (locationHint = '', budget = 'medium') => {
  try {
    if (!locationHint) {
      console.warn('No location hint provided for fallback hotels. Skipping OSM fallback.');
      return [];
    }

    console.warn('Attempting OSM-based hotel fallback for:', locationHint);
    const osmHotels = await freeDataService.getHotels(locationHint, budget);
    if (!Array.isArray(osmHotels) || osmHotels.length === 0) {
      console.warn('OSM fallback returned no hotels.');
      return [];
    }

    const mapped = mapFallbackHotels(osmHotels, locationHint);
    console.log(`Fallback OSM hotels available: ${mapped.length}`);
    return mapped;
  } catch (error) {
    console.error('Error during OSM fallback hotel retrieval:', error);
    return [];
  }
};

const fetchGeoHotels = async (token, keywords, checkInDate, checkOutDate, adults) => {
  try {
    const uniqueKeywords = [...new Set((Array.isArray(keywords) ? keywords : [keywords]).map((k) => (k || '').trim()).filter(Boolean))];

    for (const keyword of uniqueKeywords) {
      console.log(`Attempting geo-based hotel search for keyword: ${keyword}`);
      const locUrl = `https://test.api.amadeus.com/v1/reference-data/locations?subType=CITY,AIRPORT&keyword=${encodeURIComponent(keyword)}&page[limit]=5`;
      const locRes = await fetchWithTimeout(locUrl, { headers: buildHeaders(token) }, DEFAULT_TIMEOUT);

      if (!locRes.ok) {
        const body = await locRes.text();
        console.error('Locations API error:', { status: locRes.status, statusText: locRes.statusText, body });
        continue;
      }

      const locData = await locRes.json();
      const candidates = (locData?.data || []).filter((entry) => entry?.geoCode?.latitude && entry?.geoCode?.longitude);

      if (!candidates.length) {
        console.warn(`No geo-coded locations available for keyword '${keyword}'`);
        continue;
      }

      const preferred = candidates.find((entry) => entry.subType === 'CITY' && entry.iataCode === keyword.toUpperCase()) || candidates[0];
      const { latitude, longitude } = preferred.geoCode;

      const geoUrl = `https://test.api.amadeus.com/v2/shopping/hotel-offers?latitude=${latitude}&longitude=${longitude}&radius=50&radiusUnit=KM&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=${adults}&roomQuantity=1&currency=INR&view=LIGHT`;
      console.log('Fetching geo-based hotel offers:', geoUrl);
      const geoRes = await fetchWithTimeout(geoUrl, { headers: buildHeaders(token) }, DEFAULT_TIMEOUT);

      if (!geoRes.ok) {
        const body = await geoRes.text();
        console.error('Hotel geo offers API error:', { status: geoRes.status, statusText: geoRes.statusText, body });
        continue;
      }

      const geoData = await geoRes.json();
      const label = preferred?.address?.cityName || preferred?.name || keyword;
      const hotels = mapHotels(geoData?.data, label || keyword);
      console.log(`Found ${hotels.length} hotels via geo search for '${keyword}'`);
      if (hotels.length > 0) {
        return hotels;
      }
    }

    return [];
  } catch (error) {
    console.error('Error during geo hotel search:', error);
    return [];
  }
};

const fetchCityHotelsV3 = async (token, cityCode, checkInDate, checkOutDate, adults) => {
  try {
    const url = `https://test.api.amadeus.com/v3/shopping/hotel-offers?cityCode=${cityCode}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=${adults}&roomQuantity=1&currency=INR&page[limit]=25`;
    console.log('Fetching v3 city-level hotel offers:', url);
    const res = await fetchWithTimeout(url, { headers: buildHeaders(token) }, DEFAULT_TIMEOUT);

    if (!res.ok) {
      const body = await res.text();
      console.error('Hotel v3 city offers API error:', { status: res.status, statusText: res.statusText, body });
      return [];
    }

    const data = await res.json();
    const hotels = mapHotels(data?.data, cityCode);
    console.log(`Found ${hotels.length} hotels via v3 city search`);
    return hotels;
  } catch (error) {
    console.error('Error during v3 city hotel search:', error);
    return [];
  }
};

const fetchCityHotelsV2 = async (token, cityCode, checkInDate, checkOutDate, adults) => {
  try {
    const url = `https://test.api.amadeus.com/v2/shopping/hotel-offers?cityCode=${cityCode}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=${adults}&roomQuantity=1&currency=INR&view=LIGHT`;
    console.log('Fetching v2 city-level hotel offers:', url);
    const res = await fetchWithTimeout(url, { headers: buildHeaders(token) }, DEFAULT_TIMEOUT);

    if (!res.ok) {
      const body = await res.text();
      console.error('Hotel v2 city offers API error:', { status: res.status, statusText: res.statusText, body });
      return [];
    }

    const data = await res.json();
    const hotels = mapHotels(data?.data, cityCode);
    console.log(`Found ${hotels.length} hotels via v2 city search`);
    return hotels;
  } catch (error) {
    console.error('Error during v2 city hotel search:', error);
    return [];
  }
};

const fetchHotelsByIds = async (token, cityCode, checkInDate, checkOutDate, adults) => {
  try {
    console.warn('Attempting hotelIds-based search...');
    const listUrl = `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}&page[limit]=20`;
    const listRes = await fetchWithTimeout(listUrl, { headers: buildHeaders(token) }, DEFAULT_TIMEOUT);

    if (!listRes.ok) {
      const body = await listRes.text();
      console.error('Hotel list by city API error:', { status: listRes.status, statusText: listRes.statusText, body });
      return [];
    }

    const listData = await listRes.json();
    const ids = (listData?.data || []).map((item) => item.hotelId).filter(Boolean);

    if (!ids.length) {
      console.warn('No hotel IDs found for city');
      return [];
    }

    const idsParam = encodeURIComponent(ids.slice(0, 25).join(','));
    const offersUrl = `https://test.api.amadeus.com/v3/shopping/hotel-offers?hotelIds=${idsParam}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=${adults}&roomQuantity=1&currency=INR&page[limit]=25`;
    console.log('Fetching hotel offers by hotelIds:', offersUrl);
    const offersRes = await fetchWithTimeout(offersUrl, { headers: buildHeaders(token) }, DEFAULT_TIMEOUT);

    if (!offersRes.ok) {
      const body = await offersRes.text();
      console.error('Hotel offers by hotelIds API error:', { status: offersRes.status, statusText: offersRes.statusText, body });
      return [];
    }

    const offersData = await offersRes.json();
    const hotels = mapHotels(offersData?.data, cityCode);
    console.log(`Found ${hotels.length} hotels via hotelIds search`);
    return hotels;
  } catch (error) {
    console.error('Error during hotelIds search:', error);
    return [];
  }
};

export async function getHotels(token, cityCode, checkInDate, checkOutDate, adults = 1, locationHint = '') {
  console.log('Starting hotel search with params:', { cityCode, locationHint, checkInDate, checkOutDate, adults });

  if (!cityCode || !checkInDate || !checkOutDate) {
    const error = new Error('cityCode, checkInDate, and checkOutDate are required');
    console.error('Validation error:', error.message);
    throw error;
  }

  const keywords = Array.from(new Set([cityCode, locationHint].filter(Boolean)));
  const isIata = /^[A-Z]{3}$/.test((cityCode || '').trim());

  const attempts = [];

  attempts.push({
    label: 'geo-keywords',
    fn: (tok, _code, checkIn, checkOut, adultCount) => fetchGeoHotels(tok, keywords, checkIn, checkOut, adultCount)
  });

  if (isIata) {
    attempts.push({ label: 'v3-city', fn: fetchCityHotelsV3 });
    attempts.push({ label: 'v2-city', fn: fetchCityHotelsV2 });
    attempts.push({ label: 'hotelIds', fn: fetchHotelsByIds });
  } else {
    console.warn('Provided city code is not a valid IATA code. Skipping city-based Amadeus hotel searches.');
  }

  for (const attempt of attempts) {
    try {
      console.log(`\n=== Hotel search attempt: ${attempt.label} ===`);
      const hotels = await attempt.fn(token, cityCode, checkInDate, checkOutDate, adults);
      if (hotels.length > 0) {
        console.log(`Successfully retrieved ${hotels.length} hotels using ${attempt.label}`);
        return hotels;
      }
      console.warn(`No hotels returned from ${attempt.label} search`);
    } catch (error) {
      console.error(`Error in ${attempt.label} hotel search:`, error);
    }
  }

  console.warn('All Amadeus hotel search attempts returned 0 results. Falling back to OSM.');

  const fallbackHotels = await fetchFallbackHotels(locationHint || cityCode);
  if (fallbackHotels.length > 0) {
    return fallbackHotels;
  }

  console.warn('OSM fallback also returned 0 hotels');
  return [];
}
