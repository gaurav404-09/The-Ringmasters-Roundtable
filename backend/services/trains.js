import fetch from 'node-fetch';
import { ensureTrainPrice } from './trainPricing.js';

// ─── eRail response parser (no external dependency) ──────────────────────────
// eRail returns a pipe-delimited text format. Each record is separated by `~`
// and fields within a record are separated by `^`.
// Field order (0-indexed):
//  0: train_no, 1: train_name, 2: from_stn_code, 3: from_stn_name,
//  4: to_stn_code, 5: to_stn_name, 6: from_time, 7: to_time,
//  8: travel_time, 9: running_days (7-char bitmask SMTWTFS starting Wed),
//  10: classes (space-separated), 11: distance_from_to

const parseERailResponse = (raw) => {
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error('eRail returned empty response');
  }

  const records = raw.trim().split('~').filter((r) => r.trim().length > 0);

  if (records.length === 0) {
    throw new Error('eRail returned no train records');
  }

  const trains = [];

  for (const record of records) {
    const fields = record.split('^');
    if (fields.length < 10) continue; // skip malformed lines

    const trainNo = (fields[0] || '').trim();
    const trainName = (fields[1] || '').trim();
    const fromCode = (fields[2] || '').trim().toUpperCase();
    const fromName = (fields[3] || '').trim();
    const toCode = (fields[4] || '').trim().toUpperCase();
    const toName = (fields[5] || '').trim();
    const fromTime = (fields[6] || '').trim();
    const toTime = (fields[7] || '').trim();
    const travelTime = (fields[8] || '').trim();
    const runningDays = (fields[9] || '').trim();
    const classesRaw = (fields[10] || '').trim();
    const distance = parseInt(fields[11] || '0', 10) || 0;

    if (!trainNo || !fromCode || !toCode) continue;

    const classes = classesRaw
      ? classesRaw.split(/\s+/).filter(Boolean)
      : ['SL'];

    trains.push({
      class: classes[0] || 'SL',
      seats_available: null, // real availability not in eRail free tier
      train_base: {
        train_no: trainNo,
        train_name: trainName,
        from_stn_code: fromCode,
        from_stn_name: fromName,
        to_stn_code: toCode,
        to_stn_name: toName,
        from_time: fromTime,
        to_time: toTime,
        travel_time: travelTime,
        classes,
        running_days: runningDays,
        running_days_list: decodeRunningDays(runningDays),
        distance_from_to: distance,
      },
      metadata: {
        source: 'erail',
      },
    });
  }

  if (trains.length === 0) {
    throw new Error(`eRail response parsed but no valid trains found (${records.length} records checked)`);
  }

  return trains;
};

// eRail running_days bitmask starts on Wednesday: W T F S S M T
const ERAIL_DAY_ORDER = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
const DISPLAY_DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const decodeRunningDays = (bitmask) => {
  if (!bitmask || typeof bitmask !== 'string') return DISPLAY_DAY_ORDER;
  return DISPLAY_DAY_ORDER.filter((day) => {
    const erailIdx = ERAIL_DAY_ORDER.indexOf(day);
    return erailIdx !== -1 && bitmask.charAt(erailIdx) === '1';
  });
};

// ─── Date → eRail day-of-week filter ─────────────────────────────────────────
// JS getDay(): 0=Sun,1=Mon,...,6=Sat
// eRail bitmask: 0=Wed,1=Thu,2=Fri,3=Sat,4=Sun,5=Mon,6=Tue
const JS_TO_ERAIL_IDX = [4, 5, 6, 0, 1, 2, 3]; // index by JS day

const filterTrainsByDate = (trains, dateString) => {
  if (!dateString) return trains;
  const d = new Date(`${dateString}T00:00:00`);
  if (isNaN(d.getTime())) return trains;
  const erailIdx = JS_TO_ERAIL_IDX[d.getDay()];
  return trains.filter((t) => {
    const rd = t?.train_base?.running_days;
    return typeof rd === 'string' && rd.length > erailIdx
      ? rd.charAt(erailIdx) === '1'
      : true;
  });
};

// ─── Fetch from eRail ─────────────────────────────────────────────────────────
const DEFAULT_USER_AGENT =
  process.env.TRAIN_USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const fetchTrainsFromERail = async (from, to) => {
  const url = `https://erail.in/rail/getTrains.aspx?Station_From=${encodeURIComponent(from)}&Station_To=${encodeURIComponent(to)}&DataSource=0&Language=0&Cache=true`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    timeout: 10000,
  });

  if (!response.ok) {
    throw new Error(`eRail API responded with HTTP ${response.status} for ${from}→${to}`);
  }

  const raw = await response.text();
  return parseERailResponse(raw);
};

// ─── Public export ────────────────────────────────────────────────────────────
export async function getTrains(from, to, date) {
  const origin = String(from || '').trim().toUpperCase();
  const destination = String(to || '').trim().toUpperCase();

  if (!origin || !destination) {
    throw new Error('getTrains: origin and destination are required');
  }

  console.log(`[${new Date().toISOString()}] Fetching trains from eRail: ${origin} → ${destination}`);

  let trains = await fetchTrainsFromERail(origin, destination);

  if (date) {
    trains = filterTrainsByDate(trains, date);
  }

  if (trains.length === 0) {
    throw new Error(`No trains found on eRail for ${origin} → ${destination}${date ? ` on ${date}` : ''}`);
  }

  console.log(`[Trains] eRail returned ${trains.length} train(s) for ${origin} → ${destination}`);

  const priced = await Promise.all(
    trains.map((train) => ensureTrainPrice(train, { origin, destination }))
  );

  return priced.filter(Boolean);
}
