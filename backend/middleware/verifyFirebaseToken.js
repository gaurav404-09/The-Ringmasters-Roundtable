import { getFirebaseAuth } from '../services/firebaseAdmin.js';

const unauthorized = (res, message = 'Unauthorized') =>
  res.status(401).json({ success: false, error: message });

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
      return unauthorized(res, 'Missing bearer token');
    }

    const token = tokenMatch[1];
    const auth = getFirebaseAuth();

    if (!auth) {
      console.error('[verifyFirebaseToken] Firebase Admin not configured properly');
      return res.status(500).json({ success: false, error: 'Auth service unavailable' });
    }

    const decoded = await auth.verifyIdToken(token, true);

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || decoded.email || 'Traveler',
      picture: decoded.picture || null,
    };

    return next();
  } catch (error) {
    console.error('[verifyFirebaseToken] Failed to verify token:', error.message);
    return unauthorized(res, 'Invalid or expired token');
  }
};

export default verifyFirebaseToken;
