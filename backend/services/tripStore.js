import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getFirestoreClient } from './firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const STORE_PATH = path.join(DATA_DIR, 'trips.json');

async function ensureStoreFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(STORE_PATH);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(STORE_PATH, JSON.stringify({}, null, 2), 'utf8');
    } else {
      throw error;
    }
  }
}

async function readStore() {
  await ensureStoreFile();
  const content = await fs.readFile(STORE_PATH, 'utf8');
  try {
    return JSON.parse(content || '{}');
  } catch (error) {
    console.warn('[tripStore] Failed to parse store file, resetting.', error);
    return {};
  }
}

async function writeStore(store) {
  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

const FIRESTORE_COLLECTION = 'userTrips';

const nowIsoString = () => new Date().toISOString();

const deriveDayId = (day, fallbackIndex) => day?.id || day?.day || day?.date || `day-${fallbackIndex + 1}`;

const deriveActivityItemId = (dayId, activity, activityIndex) =>
  activity?.itemId || `${dayId}::${activity?.id || activityIndex + 1}`;

const normalizeActivity = (activity, itemId) => ({
  ...activity,
  itemId,
  status: activity?.status || 'suggested',
  bookingDetails: activity?.bookingDetails || null,
});

const mergeBookingDetails = (existingDetails = {}, incomingDetails = {}) => {
  const merged = {
    price: 'TBD',
    ...existingDetails,
    ...incomingDetails,
  };
  if (!merged.price) {
    merged.price = 'TBD';
  }
  return merged;
};

const applyConfirmationToDays = (days, itemId, bookingDetails) => {
  if (!Array.isArray(days)) {
    return { updated: false, days };
  }

  let updated = false;
  const nextDays = days.map((day, dayIndex) => {
    const dayId = deriveDayId(day, dayIndex);
    if (!Array.isArray(day?.activities)) {
      return day;
    }

    const nextActivities = day.activities.map((activity, activityIndex) => {
      const generatedItemId = deriveActivityItemId(dayId, activity, activityIndex);
      const normalized = normalizeActivity(activity, generatedItemId);
      if (generatedItemId === itemId) {
        updated = true;
        return {
          ...normalized,
          status: 'confirmed',
          bookingDetails: mergeBookingDetails(normalized.bookingDetails || {}, bookingDetails),
          confirmedAt: nowIsoString(),
        };
      }
      return normalized;
    });

    return {
      ...day,
      id: day?.id || dayId,
      activities: nextActivities,
    };
  });

  return { updated, days: nextDays };
};

const applyConfirmationToTrip = (trip, itemId, bookingDetails) => {
  let updated = false;
  const nextTrip = { ...trip };

  if (Array.isArray(trip?.itinerary?.days)) {
    const { updated: itineraryUpdated, days } = applyConfirmationToDays(trip.itinerary.days, itemId, bookingDetails);
    if (itineraryUpdated) {
      updated = true;
      nextTrip.itinerary = { ...trip.itinerary, days };
    }
  }

  if (Array.isArray(trip?.result?.itinerary)) {
    const { updated: resultUpdated, days } = applyConfirmationToDays(trip.result.itinerary, itemId, bookingDetails);
    if (resultUpdated) {
      updated = true;
      nextTrip.result = {
        ...trip.result,
        itinerary: days,
      };
    }
  }

  if (Array.isArray(trip?.days)) {
    const { updated: directDaysUpdated, days } = applyConfirmationToDays(trip.days, itemId, bookingDetails);
    if (directDaysUpdated) {
      updated = true;
      nextTrip.days = days;
    }
  }

  if (updated) {
    nextTrip.updatedAt = nowIsoString();
  }

  return { updated, trip: nextTrip };
};

export async function getTripsForUser(uid) {
  if (!uid) {
    throw new Error('Missing user id');
  }

  const firestore = getFirestoreClient();
  if (firestore) {
    const userDocRef = firestore.collection(FIRESTORE_COLLECTION).doc(uid);
    const snapshot = await userDocRef.get();
    const trips = snapshot.exists ? snapshot.data()?.trips || [] : [];
    return trips;
  }

  const store = await readStore();
  return store[uid] || [];
}

export async function saveTripForUser(uid, tripPayload) {
  if (!uid) {
    throw new Error('Missing user id');
  }
  if (!tripPayload || typeof tripPayload !== 'object') {
    throw new Error('Invalid trip payload');
  }

  const now = new Date().toISOString();
  const tripRecord = {
    id: tripPayload.id || uuidv4(),
    createdAt: tripPayload.createdAt || now,
    updatedAt: now,
    ...tripPayload,
  };

  const firestore = getFirestoreClient();
  if (firestore) {
    const userDocRef = firestore.collection(FIRESTORE_COLLECTION).doc(uid);
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userDocRef);
      const existingTrips = snapshot.exists ? snapshot.data()?.trips || [] : [];
      const existingIndex = existingTrips.findIndex((trip) => trip.id === tripRecord.id);
      let nextTrips;
      if (existingIndex >= 0) {
        nextTrips = [...existingTrips];
        nextTrips[existingIndex] = { ...existingTrips[existingIndex], ...tripRecord };
      } else {
        nextTrips = [tripRecord, ...existingTrips];
      }
      transaction.set(userDocRef, { trips: nextTrips }, { merge: true });
    });
    return tripRecord;
  }

  const store = await readStore();
  const userTrips = store[uid] || [];
  const existingIndex = userTrips.findIndex((trip) => trip.id === tripRecord.id);
  if (existingIndex >= 0) {
    userTrips[existingIndex] = { ...userTrips[existingIndex], ...tripRecord };
  } else {
    userTrips.unshift(tripRecord);
  }
  store[uid] = userTrips;
  await writeStore(store);
  return tripRecord;
}

export async function deleteTripForUser(uid, tripId) {
  if (!uid || !tripId) {
    throw new Error('Missing user id or trip id');
  }

  const firestore = getFirestoreClient();
  if (firestore) {
    const userDocRef = firestore.collection(FIRESTORE_COLLECTION).doc(uid);
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userDocRef);
      const existingTrips = snapshot.exists ? snapshot.data()?.trips || [] : [];
      const nextTrips = existingTrips.filter((trip) => trip.id !== tripId);
      transaction.set(userDocRef, { trips: nextTrips }, { merge: true });
    });
    const snapshot = await userDocRef.get();
    return snapshot.exists ? snapshot.data()?.trips || [] : [];
  }

  const store = await readStore();
  const userTrips = store[uid] || [];
  const nextTrips = userTrips.filter((trip) => trip.id !== tripId);
  store[uid] = nextTrips;
  await writeStore(store);
  return nextTrips;
}

export async function confirmTripItemForUser(uid, tripId, itemId, bookingDetails = {}) {
  if (!uid || !tripId || !itemId) {
    throw new Error('Missing required parameters');
  }

  const firestore = getFirestoreClient();
  if (firestore) {
    const userDocRef = firestore.collection(FIRESTORE_COLLECTION).doc(uid);
    let updatedTrip = null;
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userDocRef);
      const existingTrips = snapshot.exists ? snapshot.data()?.trips || [] : [];
      const tripIndex = existingTrips.findIndex((trip) => trip.id === tripId);
      if (tripIndex < 0) {
        throw new Error('Trip not found');
      }

      const currentTrip = existingTrips[tripIndex];
      const { updated, trip: nextTrip } = applyConfirmationToTrip(currentTrip, itemId, bookingDetails);
      if (!updated) {
        throw new Error('Itinerary item not found');
      }

      const nextTrips = [...existingTrips];
      nextTrips[tripIndex] = nextTrip;
      transaction.set(userDocRef, { trips: nextTrips }, { merge: true });
      updatedTrip = nextTrip;
    });

    return updatedTrip;
  }

  const store = await readStore();
  const userTrips = store[uid] || [];
  const tripIndex = userTrips.findIndex((trip) => trip.id === tripId);
  if (tripIndex < 0) {
    throw new Error('Trip not found');
  }

  const currentTrip = userTrips[tripIndex];
  const { updated, trip: nextTrip } = applyConfirmationToTrip(currentTrip, itemId, bookingDetails);
  if (!updated) {
    throw new Error('Itinerary item not found');
  }

  const nextTrips = [...userTrips];
  nextTrips[tripIndex] = nextTrip;
  store[uid] = nextTrips;
  await writeStore(store);
  return nextTrip;
}
