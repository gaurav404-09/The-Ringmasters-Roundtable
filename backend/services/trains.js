import fetch from 'node-fetch';
import { ensureTrainPrice } from './trainPricing.js';

let prettify;

try {
  const moduleUrl = new URL('../../indian-rail-api/indian-rail-api/utils/prettify.js', import.meta.url);
  const module = await import(moduleUrl.href);
  const Prettify = module?.default || module?.Prettify || module;
  if (typeof Prettify !== 'function') {
    throw new Error('indian-rail-api prettify export is not a constructor');
  }
  prettify = new Prettify();
  console.log('[Trains] Loaded indian-rail-api prettify parser');
} catch (error) {
  console.error('[Trains] Unable to load indian-rail-api prettify parser:', error);
}

const ERAIL_DAY_ORDER = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
const DISPLAY_DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_USER_AGENT =
  process.env.TRAIN_USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const normaliseStationCode = (value) => {
  if (!value) return '';
  return String(value).trim().toUpperCase();
};

const getERailDayIndexForDate = (dateString) => {
  if (!dateString) return null;
  const parsed = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const jsDay = parsed.getDay(); // 0 (Sun) - 6 (Sat)
  return jsDay <= 2 ? jsDay + 4 : jsDay - 3;
};

const filterTrainsByDate = (trains, dateString) => {
  const dayIndex = getERailDayIndexForDate(dateString);
  if (dayIndex === null) {
    return trains;
  }
  return trains.filter((train) => {
    const runningDays = train?.train_base?.running_days;
    return typeof runningDays === 'string' && runningDays.length > dayIndex
      ? runningDays.charAt(dayIndex) === '1'
      : true;
  });
};

const annotateRunningDays = (train) => {
  const runningDays = train?.train_base?.running_days;
  if (!runningDays || typeof runningDays !== 'string') {
    return train;
  }

  const days = DISPLAY_DAY_ORDER.filter((day) => {
    const erailIndex = ERAIL_DAY_ORDER.indexOf(day);
    if (erailIndex === -1) {
      return false;
    }
    return runningDays.charAt(erailIndex) === '1';
  });

  return {
    ...train,
    train_base: {
      ...train.train_base,
      running_days_list: days
    }
  };
};

const fetchTrainsFromIndianRail = async (from, to) => {
  if (!prettify) {
    throw new Error('indian-rail-api prettify parser is not available');
  }
  const url = `https://erail.in/rail/getTrains.aspx?Station_From=${encodeURIComponent(from)}&Station_To=${encodeURIComponent(to)}&DataSource=0&Language=0&Cache=true`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`Indian Rail API responded with status ${response.status}`);
  }

  const raw = await response.text();
  const parsed = prettify.BetweenStation(raw);

  if (!parsed?.success || !Array.isArray(parsed.data)) {
    const reason = parsed?.data || 'Unknown error while parsing train data';
    throw new Error(`Failed to parse train data: ${reason}`);
  }

  return parsed.data;
};

export async function getTrains(from, to, date) {
  const origin = normaliseStationCode(from);
  const destination = normaliseStationCode(to);

  if (!origin || !destination) {
    console.warn('getTrains called without valid origin/destination', { from, to });
    return [];
  }

  try {
    console.log(`[${new Date().toISOString()}] Fetching train data from Indian Rail API for ${origin} to ${destination}`);
    let trains = await fetchTrainsFromIndianRail(origin, destination);

    if (date) {
      trains = filterTrainsByDate(trains, date);
    }

    if (!trains.length) {
      console.warn(`[${new Date().toISOString()}] No trains found for ${origin} to ${destination}`);
      return [];
    }

    const annotated = trains.map((train) => ({
      ...annotateRunningDays(train),
      metadata: {
        source: 'indian-rail-api',
        fetchedAt: new Date().toISOString()
      }
    }));

    const priced = await Promise.all(
      annotated.map((train) => ensureTrainPrice(train, { origin, destination }))
    );

    return priced.filter(Boolean);
  } catch (error) {
    console.error('Error in getTrains:', error);
    throw error;
  }
}
