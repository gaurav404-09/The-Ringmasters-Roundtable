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

const createRandomCode = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const buildDummyBookingDetails = (activity = {}, overrides = {}) => {
  return {
    confirmationNumber: createRandomCode('CONF'),
    referenceCode: createRandomCode('REF'),
    price: activity?.cost ?? overrides?.price ?? 'TBD',
    ...overrides,
  };
};

const confirmActivitiesInDays = (days, overrides = {}) => {
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
      if (normalized.status !== 'confirmed' || !normalized.bookingDetails) {
        updated = true;
      }
      return {
        ...normalized,
        status: 'confirmed',
        bookingDetails: mergeBookingDetails(
          normalized.bookingDetails || {},
          buildDummyBookingDetails(normalized, overrides)
        ),
        confirmedAt: nowIsoString(),
      };
    });

    return {
      ...day,
      id: day?.id || dayId,
      activities: nextActivities,
    };
  });

  return { updated, days: nextDays };
};

const applyFullTripConfirmation = (trip, overrides = {}) => {
  if (!trip || typeof trip !== 'object') {
    return { updated: false, trip };
  }

  const nextTrip = { ...trip };
  let updated = trip.status !== 'confirmed';

  if (Array.isArray(trip?.itinerary?.days)) {
    const { updated: itineraryUpdated, days } = confirmActivitiesInDays(trip.itinerary.days, overrides);
    if (itineraryUpdated) {
      updated = true;
      nextTrip.itinerary = { ...trip.itinerary, days };
    }
  }

  if (Array.isArray(trip?.result?.itinerary)) {
    const { updated: resultUpdated, days } = confirmActivitiesInDays(trip.result.itinerary, overrides);
    if (resultUpdated) {
      updated = true;
      nextTrip.result = { ...trip.result, itinerary: days };
    }
  }

  if (Array.isArray(trip?.days)) {
    const { updated: directDaysUpdated, days } = confirmActivitiesInDays(trip.days, overrides);
    if (directDaysUpdated) {
      updated = true;
      nextTrip.days = days;
    }
  }

  if (!nextTrip.budget) {
    nextTrip.budget = { planned: 'TBD', spent: 0 };
  } else {
    nextTrip.budget = {
      planned: nextTrip.budget.planned ?? 'TBD',
      spent: nextTrip.budget.spent ?? 0,
    };
  }

  if (updated) {
    nextTrip.status = 'confirmed';
    nextTrip.confirmedAt = nowIsoString();
    nextTrip.updatedAt = nowIsoString();
  }

  return { updated, trip: nextTrip };
};

const mutateActivityInDays = (days, itemId, mutator) => {
  if (!Array.isArray(days)) {
    return { updated: false, days, item: null };
  }

  let updated = false;
  let mutatedItem = null;
  const nextDays = days.map((day, dayIndex) => {
    const dayId = deriveDayId(day, dayIndex);
    if (!Array.isArray(day?.activities)) {
      return {
        ...day,
        id: day?.id || dayId,
        activities: day?.activities,
      };
    }

    let dayChanged = false;
    const nextActivities = day.activities.map((activity, activityIndex) => {
      const generatedItemId = deriveActivityItemId(dayId, activity, activityIndex);
      const normalized = normalizeActivity(activity, generatedItemId);
      if (generatedItemId === itemId) {
        updated = true;
        dayChanged = true;
        const mutated = mutator({ ...normalized }, { dayId, dayIndex, activityIndex }) || {};
        const composed = {
          ...normalized,
          ...mutated,
          itemId: generatedItemId,
          status: mutated?.status || normalized.status || 'suggested',
          bookingDetails: mutated?.bookingDetails ?? normalized.bookingDetails ?? null,
        };
        mutatedItem = composed;
        return composed;
      }
      return normalized;
    });

    if (!dayChanged) {
      return {
        ...day,
        id: day?.id || dayId,
        activities: nextActivities,
      };
    }

    return {
      ...day,
      id: day?.id || dayId,
      activities: nextActivities,
    };
  });

  return { updated, days: nextDays, item: mutatedItem };
};

const updateActivityInDays = (days, itemId, changes) =>
  mutateActivityInDays(days, itemId, (activity) => ({ ...activity, ...changes }));

const deleteActivityFromDays = (days, itemId) => {
  if (!Array.isArray(days)) {
    return { updated: false, days, removed: null };
  }

  let removed = null;
  let updated = false;
  const nextDays = days.map((day, dayIndex) => {
    const dayId = deriveDayId(day, dayIndex);
    if (!Array.isArray(day?.activities)) {
      return {
        ...day,
        id: day?.id || dayId,
        activities: day?.activities,
      };
    }

    const nextActivities = [];
    day.activities.forEach((activity, activityIndex) => {
      const generatedItemId = deriveActivityItemId(dayId, activity, activityIndex);
      const normalized = normalizeActivity(activity, generatedItemId);
      if (generatedItemId === itemId) {
        removed = normalized;
        updated = true;
        return;
      }
      nextActivities.push(normalized);
    });

    return {
      ...day,
      id: day?.id || dayId,
      activities: nextActivities,
    };
  });

  return { updated, days: nextDays, removed };
};

const dayMatchesIdentifier = (day, dayIndex, identifier) => {
  if (!identifier) return false;
  const dayId = deriveDayId(day, dayIndex);
  if (identifier === dayId) {
    return true;
  }
  if (typeof identifier === 'object') {
    const { id, dayNumber, date } = identifier;
    if (id && id === dayId) return true;
    if (dayNumber && (day?.day === dayNumber || dayId === `day-${dayNumber}`)) return true;
    if (date && (day?.date === date)) return true;
  }
  if (typeof identifier === 'string' && identifier.startsWith('day-')) {
    return dayId === identifier;
  }
  return false;
};

const addActivityToDays = (days, dayIdentifier, activityData) => {
  if (!Array.isArray(days)) {
    return { updated: false, days, added: null };
  }

  let added = null;
  let updated = false;
  const nextDays = days.map((day, dayIndex) => {
    const dayId = deriveDayId(day, dayIndex);
    const matches = dayMatchesIdentifier(day, dayIndex, dayIdentifier);

    const existingActivities = Array.isArray(day?.activities)
      ? day.activities.map((activity, activityIndex) =>
          normalizeActivity(activity, deriveActivityItemId(dayId, activity, activityIndex)))
      : [];

    if (!matches) {
      return {
        ...day,
        id: day?.id || dayId,
        activities: existingActivities,
      };
    }

    const newActivityIndex = existingActivities.length;
    const newItemId = deriveActivityItemId(dayId, activityData, newActivityIndex);
    const normalizedNew = normalizeActivity(
      {
        ...activityData,
        itemId: newItemId,
        status: activityData?.status || 'suggested',
        bookingDetails: activityData?.bookingDetails || null,
      },
      newItemId,
    );

    updated = true;
    added = normalizedNew;

    return {
      ...day,
      id: day?.id || dayId,
      activities: [...existingActivities, normalizedNew],
    };
  });

  return { updated, days: nextDays, added };
};

const applyActivityUpdateToTrip = (trip, itemId, changes) => {
  const nextTrip = { ...trip };
  let updated = false;
  let updatedItem = null;

  if (Array.isArray(trip?.itinerary?.days)) {
    const { updated: changed, days, item } = updateActivityInDays(trip.itinerary.days, itemId, changes);
    if (changed) {
      updated = true;
      nextTrip.itinerary = { ...trip.itinerary, days };
      if (item) {
        updatedItem = item;
      }
    }
  }

  if (Array.isArray(trip?.result?.itinerary)) {
    const { updated: changed, days, item } = updateActivityInDays(trip.result.itinerary, itemId, changes);
    if (changed) {
      updated = true;
      nextTrip.result = { ...trip.result, itinerary: days };
      if (item) {
        updatedItem = item;
      }
    }
  }

  if (Array.isArray(trip?.days)) {
    const { updated: changed, days } = updateActivityInDays(trip.days, itemId, changes);
    if (changed) {
      updated = true;
      nextTrip.days = days;
    }
  }

  if (updated) {
    nextTrip.updatedAt = nowIsoString();
  }

  return { updated, trip: nextTrip, item: updatedItem };
};

const applyActivityDeletionToTrip = (trip, itemId) => {
  const nextTrip = { ...trip };
  let updated = false;

  if (Array.isArray(trip?.itinerary?.days)) {
    const { updated: changed, days } = deleteActivityFromDays(trip.itinerary.days, itemId);
    if (changed) {
      updated = true;
      nextTrip.itinerary = { ...trip.itinerary, days };
    }
  }

  if (Array.isArray(trip?.result?.itinerary)) {
    const { updated: changed, days } = deleteActivityFromDays(trip.result.itinerary, itemId);
    if (changed) {
      updated = true;
      nextTrip.result = { ...trip.result, itinerary: days };
    }
  }

  if (Array.isArray(trip?.days)) {
    const { updated: changed, days } = deleteActivityFromDays(trip.days, itemId);
    if (changed) {
      updated = true;
      nextTrip.days = days;
    }
  }

  if (updated) {
    nextTrip.updatedAt = nowIsoString();
  }

  return { updated, trip: nextTrip };
};

const applyActivityAdditionToTrip = (trip, dayIdentifier, activityData) => {
  const nextTrip = { ...trip };
  let updated = false;
  let addedItem = null;

  if (Array.isArray(trip?.itinerary?.days)) {
    const { updated: changed, days, added } = addActivityToDays(trip.itinerary.days, dayIdentifier, activityData);
    if (changed) {
      updated = true;
      nextTrip.itinerary = { ...trip.itinerary, days };
      if (added) {
        addedItem = added;
      }
    }
  }

  if (Array.isArray(trip?.result?.itinerary)) {
    const { updated: changed, days, added } = addActivityToDays(trip.result.itinerary, dayIdentifier, activityData);
    if (changed) {
      updated = true;
      nextTrip.result = { ...trip.result, itinerary: days };
      if (added) {
        addedItem = added;
      }
    }
  }

  if (Array.isArray(trip?.days)) {
    const { updated: changed, days } = addActivityToDays(trip.days, dayIdentifier, activityData);
    if (changed) {
      updated = true;
      nextTrip.days = days;
    }
  }

  if (updated) {
    nextTrip.updatedAt = nowIsoString();
  }

  return { updated, trip: nextTrip, item: addedItem };
};

const sanitizeActivityChanges = (changes = {}) => {
  if (!changes || typeof changes !== 'object') {
    return {};
  }

  const allowed = ['title', 'notes', 'time', 'location', 'type', 'status'];
  const normalized = {};
  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(changes, field)) {
      const value = changes[field];
      if (value !== undefined) {
        normalized[field] = value;
      }
    }
  });

  return normalized;
};

const normalizeNewActivityPayload = (activity = {}) => {
  if (!activity || typeof activity !== 'object') {
    return {};
  }

  const normalized = {
    title: activity.title ?? '',
    notes: activity.notes ?? '',
    time: activity.time ?? '09:00',
    location: activity.location ?? '',
    type: activity.type ?? 'activity',
    status: activity.status || 'suggested',
    bookingDetails: activity.bookingDetails ?? null,
  };

  if (!normalized.title || !normalized.title.trim()) {
    throw new Error('Activity title is required');
  }

  return normalized;
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

  tripRecord.status = tripRecord.status || 'draft';
  if (!tripRecord.budget || typeof tripRecord.budget !== 'object') {
    tripRecord.budget = { planned: 'TBD', spent: 0 };
  } else {
    tripRecord.budget = {
      planned: tripRecord.budget.planned ?? 'TBD',
      spent: tripRecord.budget.spent ?? 0,
    };
  }

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

export async function getAllTripsSnapshot() {
  const firestore = getFirestoreClient();
  if (firestore) {
    const snapshot = await firestore.collection(FIRESTORE_COLLECTION).get();
    return snapshot.docs.map((doc) => ({
      uid: doc.id,
      trips: doc.data()?.trips || [],
    }));
  }

  const store = await readStore();
  return Object.entries(store).map(([uid, trips]) => ({ uid, trips }));
}

export async function confirmEntireTripForUser(uid, tripId, overrides = {}) {
  if (!uid || !tripId) {
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
      const { updated, trip: nextTrip } = applyFullTripConfirmation(currentTrip, overrides);
      if (!updated) {
        // even if nothing changed we still return the trip for consistency
        updatedTrip = nextTrip;
        return;
      }

      const nextTrips = [...existingTrips];
      nextTrips[tripIndex] = nextTrip;
      transaction.set(userDocRef, { trips: nextTrips }, { merge: true });
      updatedTrip = nextTrip;
    });

    if (!updatedTrip) {
      throw new Error('Trip not found');
    }

    return updatedTrip;
  }

  const store = await readStore();
  const userTrips = store[uid] || [];
  const tripIndex = userTrips.findIndex((trip) => trip.id === tripId);
  if (tripIndex < 0) {
    throw new Error('Trip not found');
  }

  const currentTrip = userTrips[tripIndex];
  const { trip: nextTrip } = applyFullTripConfirmation(currentTrip, overrides);
  const nextTrips = [...userTrips];
  nextTrips[tripIndex] = nextTrip;
  store[uid] = nextTrips;
  await writeStore(store);
  return nextTrip;
}

export async function updateTripActivity(uid, tripId, itemId, changes = {}) {
  if (!uid || !tripId || !itemId) {
    throw new Error('Missing required parameters');
  }

  const sanitized = sanitizeActivityChanges(changes);
  if (Object.keys(sanitized).length === 0) {
    throw new Error('No valid changes provided');
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
      const { updated, trip: nextTrip } = applyActivityUpdateToTrip(currentTrip, itemId, sanitized);
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
  const { updated, trip: nextTrip } = applyActivityUpdateToTrip(currentTrip, itemId, sanitized);
  if (!updated) {
    throw new Error('Itinerary item not found');
  }

  const nextTrips = [...userTrips];
  nextTrips[tripIndex] = nextTrip;
  store[uid] = nextTrips;
  await writeStore(store);
  return nextTrip;
}

export async function deleteTripActivity(uid, tripId, itemId) {
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
      const { updated, trip: nextTrip } = applyActivityDeletionToTrip(currentTrip, itemId);
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
  const { updated, trip: nextTrip } = applyActivityDeletionToTrip(currentTrip, itemId);
  if (!updated) {
    throw new Error('Itinerary item not found');
  }

  const nextTrips = [...userTrips];
  nextTrips[tripIndex] = nextTrip;
  store[uid] = nextTrips;
  await writeStore(store);
  return nextTrip;
}

export async function addTripActivity(uid, tripId, dayIdentifier, activityPayload) {
  if (!uid || !tripId || !dayIdentifier) {
    throw new Error('Missing required parameters');
  }

  const normalizedActivity = normalizeNewActivityPayload(activityPayload);

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
      const { updated, trip: nextTrip } = applyActivityAdditionToTrip(currentTrip, dayIdentifier, normalizedActivity);
      if (!updated) {
        throw new Error('Unable to add activity to the specified day');
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
  const { updated, trip: nextTrip } = applyActivityAdditionToTrip(currentTrip, dayIdentifier, normalizedActivity);
  if (!updated) {
    throw new Error('Unable to add activity to the specified day');
  }

  const nextTrips = [...userTrips];
  nextTrips[tripIndex] = nextTrip;
  store[uid] = nextTrips;
  await writeStore(store);
  return nextTrip;
}
