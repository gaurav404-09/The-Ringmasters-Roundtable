import admin from 'firebase-admin';
import 'firebase-admin/storage';

let firebaseApp = null;

const normalizePrivateKey = (key) => {
  if (!key) return key;
  return key.replace(/\\n/g, '\n');
};

const parseServiceAccount = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.private_key) {
      parsed.private_key = normalizePrivateKey(parsed.private_key);
    }
    return parsed;
  } catch (error) {
    console.error('[firebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', error);
    return null;
  }
};

const initializeFirebaseApp = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  let credential = null;

  if (serviceAccountJson) {
    const serviceAccount = parseServiceAccount(serviceAccountJson);
    if (serviceAccount) {
      credential = admin.credential.cert(serviceAccount);
    }
  } else if (projectId && clientEmail && privateKey) {
    credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    });
  }

  if (!credential) {
    return null;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential,
      storageBucket,
    });
    return firebaseApp;
  } catch (error) {
    console.error('[firebaseAdmin] Failed to initialize Firebase Admin SDK:', error);
    return null;
  }
};

export const getFirebaseApp = () => initializeFirebaseApp();

export const getFirestoreClient = () => {
  // Check if Firestore is explicitly disabled to save quota
  const useFirestore = process.env.USE_FIRESTORE !== 'false';
  if (!useFirestore) {
    console.log('[firebaseAdmin] Firestore disabled via USE_FIRESTORE=false, using JSON fallback');
    return null;
  }
  
  const app = initializeFirebaseApp();
  if (!app) return null;
  return admin.firestore(app);
};

export const getFirebaseAuth = () => {
  const app = initializeFirebaseApp();
  if (!app) return null;
  return admin.auth(app);
};

export const getFirebaseStorageBucket = () => {
  const app = initializeFirebaseApp();
  if (!app) return null;
  try {
    return admin.storage(app).bucket();
  } catch (error) {
    console.error('[firebaseAdmin] Failed to access Firebase Storage bucket:', error);
    return null;
  }
};
