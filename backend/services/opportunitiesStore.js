import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getFirestoreClient } from './firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const STORE_PATH = path.join(DATA_DIR, 'opportunities.json');

const DEFAULT_STATUS = 'new';
const COLLECTION_NAME = 'opportunities';
const DEFAULT_AVATAR_URL = process.env.PIP_AVATAR_URL || null;

// Write lock to prevent concurrent write corruption
let writeLock = false;
const queueWrite = async (fn) => {
  // Wait for lock to be released
  while (writeLock) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  writeLock = true;
  try {
    return await fn();
  } finally {
    writeLock = false;
  }
};

const ensureStoreFile = async () => {
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
};

const readStore = async () => {
  await ensureStoreFile();
  const content = await fs.readFile(STORE_PATH, 'utf8').catch(() => '{}');
  try {
    return JSON.parse(content || '{}');
  } catch (error) {
    console.warn('[opportunitiesStore] Failed to parse store file, resetting.', error);
    await fs.writeFile(STORE_PATH, JSON.stringify({}, null, 2), 'utf8');
    return {};
  }
};

const writeStore = async (store) => {
  return queueWrite(async () => {
    await ensureStoreFile();
    // Atomic write: write to temp file then rename
    const tempPath = `${STORE_PATH}.tmp.${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(store, null, 2), 'utf8');
    await fs.rename(tempPath, STORE_PATH);
  });
};

const normalizeOpportunity = (opportunity = {}) => {
  const opportunityId = opportunity.opportunityId || uuidv4();
  return {
    opportunityId,
    userId: opportunity.userId,
    tripId: opportunity.tripId || null,
    status: opportunity.status || DEFAULT_STATUS,
    pipData: {
      title: opportunity.pipData?.title || 'Pip has a tip! 🎪',
      message: opportunity.pipData?.message || 'Check out this travel insight.',
      actionButtonText: opportunity.pipData?.actionButtonText || null,
      avatarUrl: opportunity.pipData?.avatarUrl || DEFAULT_AVATAR_URL,
    },
    createdAt: opportunity.createdAt || new Date().toISOString(),
  };
};

export const createOpportunity = async (opportunity) => {
  const firestore = getFirestoreClient();
  const normalized = normalizeOpportunity(opportunity);

  if (!normalized.userId) {
    throw new Error('Opportunity requires userId');
  }

  if (firestore) {
    const docRef = firestore.collection(COLLECTION_NAME).doc(normalized.opportunityId);
    await docRef.set(normalized, { merge: true });
    return normalized;
  }

  const store = await readStore();
  const userList = store[normalized.userId] || [];
  const exists = userList.some((item) => item.opportunityId === normalized.opportunityId);
  if (!exists) {
    userList.push(normalized);
  }
  store[normalized.userId] = userList;
  await writeStore(store);
  return normalized;
};

export const createOpportunityIfNotExists = async (opportunity, fingerprint) => {
  const firestore = getFirestoreClient();
  const userId = opportunity?.userId;
  if (!userId) {
    return null;
  }
  const normalizedFingerprint = fingerprint || opportunity?.pipData?.message;

  if (firestore) {
    const collectionRef = firestore.collection(COLLECTION_NAME);
    const query = await collectionRef
      .where('userId', '==', userId)
      .where('pipData.message', '==', normalizedFingerprint)
      .limit(1)
      .get();
    if (!query.empty) {
      return null;
    }
    return createOpportunity(opportunity);
  }

  const store = await readStore();
  const userList = store[userId] || [];
  const exists = userList.some((item) => item.pipData?.message === normalizedFingerprint);
  if (exists) {
    return null;
  }
  return createOpportunity(opportunity);
};

// In-memory cache to reduce Firestore reads
const opportunitiesCache = new Map();
const CACHE_TTL_MS = parseInt(process.env.OPPORTUNITIES_CACHE_TTL_MS || '60000', 10); // 60 seconds cache (increased from 30s to reduce quota usage)
const MAX_OPPORTUNITIES_PER_USER = parseInt(process.env.MAX_OPPORTUNITIES_PER_USER || '50', 10); // Limit to prevent excessive reads

// NOTE: Firestore composite index required for this query:
// Collection: opportunities
// Fields: userId (Ascending), status (Ascending), createdAt (Descending)
// Create at: https://console.firebase.google.com/project/_/firestore/indexes

export const getNewOpportunitiesForUser = async (userId) => {
  if (!userId) {
    return [];
  }

  // Check cache first
  const cacheKey = `${userId}:new`;
  const cached = opportunitiesCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.log('[getNewOpportunitiesForUser] Returning cached result for:', userId);
    return cached.data;
  }

  const firestore = getFirestoreClient();
  let result;
  
  if (firestore) {
    const collectionRef = firestore.collection(COLLECTION_NAME);
    const snapshot = await collectionRef
      .where('userId', '==', userId)
      .where('status', '==', DEFAULT_STATUS)
      .orderBy('createdAt', 'desc')
      .limit(MAX_OPPORTUNITIES_PER_USER)
      .get();
    result = snapshot.docs.map((doc) => doc.data());
    console.log(`[getNewOpportunitiesForUser] Fetched from Firestore: ${result.length} opportunities (${snapshot.docs.length} reads used)`);
  } else {
    console.log('[getNewOpportunitiesForUser] Using JSON fallback for userId:', userId);
    const store = await readStore();
    const userList = store[userId] || [];
    result = userList.filter((item) => item.status === DEFAULT_STATUS);
  }

  // Cache the result
  opportunitiesCache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });

  return result;
};

export const markOpportunitySeen = async (userId, opportunityId) => {
  if (!userId || !opportunityId) {
    throw new Error('Missing required parameters');
  }

  const firestore = getFirestoreClient();
  if (firestore) {
    const docRef = firestore.collection(COLLECTION_NAME).doc(opportunityId);
    await docRef.set({ status: 'seen' }, { merge: true });
  } else {
    const store = await readStore();
    const userList = store[userId] || [];
    const nextList = userList.map((item) =>
      item.opportunityId === opportunityId
        ? { ...item, status: 'seen' }
        : item
    );
    store[userId] = nextList;
    await writeStore(store);
  }
  
  // Invalidate cache so next fetch gets fresh data
  const cacheKey = `${userId}:new`;
  opportunitiesCache.delete(cacheKey);
  console.log('[markOpportunitySeen] Cache invalidated for:', userId);
  
  return true;
};

export const deleteOpportunitiesForUser = async (userId) => {
  if (!userId) {
    return;
  }

  const firestore = getFirestoreClient();
  if (firestore) {
    const collectionRef = firestore.collection(COLLECTION_NAME);
    const snapshot = await collectionRef.where('userId', '==', userId).get();
    if (snapshot.empty) {
      return;
    }

    const batch = firestore.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    return;
  }

  const store = await readStore();
  if (store[userId]) {
    delete store[userId];
    await writeStore(store);
  }
};
