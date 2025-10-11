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

const STATION_NAME_OVERRIDES = {
  NDLS: 'New Delhi',
  CSMT: 'Chhatrapati Shivaji Maharaj Terminus',
  HYB: 'Hyderabad Deccan',
  SBC: 'Bengaluru City',
  MAS: 'Chennai Central',
  HWH: 'Howrah Junction',
  MAO: 'Madgaon',
  ERS: 'Ernakulam Junction',
  PUNE: 'Pune Junction',
  ADI: 'Ahmedabad Junction',
  JP: 'Jaipur Junction',
  BBS: 'Bhubaneswar',
  LKO: 'Lucknow NR',
  PNBE: 'Patna Junction',
  GHY: 'Guwahati'
};

const FALLBACK_DEPARTURE_MINUTES = [420, 780, 1020]; // 07:00, 13:00, 17:00
const FALLBACK_DURATIONS_MINUTES = [960, 1260, 1440]; // 16h, 21h, 24h
const FALLBACK_CLASSES = ['3A', '2A', 'SL'];

const padToTwo = (value) => String(Math.max(0, value)).padStart(2, '0');

const minutesToHHMM = (totalMinutes) => {
  if (!Number.isFinite(totalMinutes)) {
    return '06:00';
  }
  const minutesInDay = 24 * 60;
  const normalised = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalised / 60);
  const minutes = normalised % 60;
  return `${padToTwo(hours)}:${padToTwo(minutes)}`;
};

const addMinutesToTime = (time, minutesToAdd) => {
  if (!time || !/^[0-2]?\d:[0-5]\d$/.test(time)) {
    return minutesToHHMM(minutesToAdd);
  }
  const [hours, minutes] = time.split(':').map((part) => Number(part) || 0);
  const baseMinutes = hours * 60 + minutes;
  return minutesToHHMM(baseMinutes + (Number(minutesToAdd) || 0));
};

const buildFallbackTrain = (index, origin, destination, departureMinutes, durationMinutes) => {
  const departureTime = minutesToHHMM(departureMinutes);
  const travelTime = minutesToHHMM(durationMinutes);
  const arrivalTime = addMinutesToTime(departureTime, durationMinutes);
  const classCode = FALLBACK_CLASSES[index % FALLBACK_CLASSES.length];
  const originName = STATION_NAME_OVERRIDES[origin] || origin;
  const destinationName = STATION_NAME_OVERRIDES[destination] || destination;

  return {
    class: classCode,
    seats_available: 24 + (index * 12),
    train_base: {
      train_no: `FB${padToTwo(index + 1)}${origin.substring(0, 2)}${destination.substring(0, 2)}`.toUpperCase(),
      train_name: `${originName} · ${destinationName} Express ${index + 1}`,
      from_stn_code: origin,
      from_stn_name: originName,
      to_stn_code: destination,
      to_stn_name: destinationName,
      from_time: departureTime,
      to_time: arrivalTime,
      travel_time: travelTime,
      classes: [classCode, 'SL', '3A'],
      running_days: '1111111',
      running_days_list: DISPLAY_DAY_ORDER,
      distance_from_to: 900 + index * 120
    },
    metadata: {
      source: 'fallback',
      generated: true
    }
  };
};

const generateFallbackTrains = async (origin, destination, date) => {
  const baseOptions = FALLBACK_DEPARTURE_MINUTES.map((departure, index) => {
    const duration = FALLBACK_DURATIONS_MINUTES[index % FALLBACK_DURATIONS_MINUTES.length];
    const train = buildFallbackTrain(index, origin, destination, departure, duration);
    if (date) {
      train.metadata.travelDate = date;
    }
    return train;
  });

  const priced = await Promise.all(
    baseOptions.map((train) => ensureTrainPrice(train, { origin, destination }))
  );

  return priced.filter(Boolean);
};

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

  const fallbackWithLog = async (reason, error) => {
    if (error) {
      console.error(`[Trains] Falling back to synthesized data due to ${reason}:`, error.message || error);
    } else {
      console.warn(`[Trains] Falling back to synthesized data: ${reason}`);
    }

    const fallbackTrains = await generateFallbackTrains(origin, destination, date);
    console.log(`[Trains] Returning ${fallbackTrains.length} synthesized train option(s) for ${origin} · ${destination}`);
    return fallbackTrains;
  };

  try {
    console.log(`[${new Date().toISOString()}] Fetching train data from Indian Rail API for ${origin} to ${destination}`);
    let trains = await fetchTrainsFromIndianRail(origin, destination);

    if (date) {
      trains = filterTrainsByDate(trains, date);
    }

    if (!trains.length) {
      return fallbackWithLog('no trains returned from source', null);
    }

    const annotated = trains.map((train) => ({
      ...annotateRunningDays(train),
      metadata: {
        ...(train.metadata || {}),
        source: train.metadata?.source || 'indian-rail-api'
      }
    }));

    const priced = await Promise.all(
      annotated.map((train) => ensureTrainPrice(train, { origin, destination }))
    );

    if (!priced.length) {
      return fallbackWithLog('pricing step returned no trains', null);
    }

    return priced.filter(Boolean);
  } catch (error) {
    return fallbackWithLog('fetch error', error);
  }
}
