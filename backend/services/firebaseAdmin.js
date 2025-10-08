import admin from 'firebase-admin';

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

export const getFirestoreClient = () => {
  if (firebaseApp) {
    return admin.firestore();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

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
    });
    return admin.firestore();
  } catch (error) {
    console.error('[firebaseAdmin] Failed to initialize Firebase Admin SDK:', error);
    return null;
  }
};
