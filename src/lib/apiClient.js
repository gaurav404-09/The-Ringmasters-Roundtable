import ENV from '../config/env';
import { auth } from '../firebase';

const API_BASE_URL = ENV.API_BASE_URL || 'http://localhost:3000';

async function handleResponse(response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(errorBody.error || response.statusText || 'Request failed');
    error.status = response.status;
    error.details = errorBody;
    throw error;
  }
  return response.json().catch(() => ({}));
}

async function buildAuthHeaders(requireAuth = true) {
  const baseHeaders = {
    'Content-Type': 'application/json',
  };

  if (!requireAuth) {
    return baseHeaders;
  }

  const user = auth.currentUser;
  if (!user) {
    const error = new Error('Authentication required');
    error.status = 401;
    throw error;
  }

  const token = await user.getIdToken();
  return {
    ...baseHeaders,
    Authorization: `Bearer ${token}`,
  };
}

async function authorizedFetch(path, options = {}, requireAuth = true) {
  const headers = await buildAuthHeaders(requireAuth);
  const requestInit = {
    credentials: 'include',
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  };

  return fetch(`${API_BASE_URL}${path}`, requestInit);
}

export async function fetchUserTrips(uid) {
  const response = await authorizedFetch(`/api/users/${encodeURIComponent(uid)}/trips`, {
    method: 'GET',
  });

  return handleResponse(response);
}

export async function updateTripActivity(uid, tripId, itemId, changes) {
  const response = await authorizedFetch(`/api/users/${encodeURIComponent(uid)}/trips/${encodeURIComponent(tripId)}/activities/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ changes }),
  });

  return handleResponse(response);
}

export async function deleteTripActivity(uid, tripId, itemId) {
  const response = await authorizedFetch(`/api/users/${encodeURIComponent(uid)}/trips/${encodeURIComponent(tripId)}/activities/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  });

  return handleResponse(response);
}

export async function addTripActivity(uid, tripId, payload) {
  // payload must include: { dayIdentifier: {...}, activity: {...} }
  const { dayIdentifier, activity } = payload || {};
  const response = await authorizedFetch(`/api/users/${encodeURIComponent(uid)}/trips/${encodeURIComponent(tripId)}/activities`, {
    method: 'POST',
    body: JSON.stringify({ dayIdentifier, activity }),
  });

  return handleResponse(response);
}

export async function searchPlaces(query, limit = 6) {
  const params = new URLSearchParams({ q: query });
  if (limit) {
    params.set('limit', String(limit));
  }

  const response = await fetch(`${API_BASE_URL}/api/places/search?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  return handleResponse(response);
}

export async function saveUserTrip(uid, trip) {
  const response = await authorizedFetch(`/api/users/${encodeURIComponent(uid)}/trips`, {
    method: 'POST',
    body: JSON.stringify({ trip }),
  });

  return handleResponse(response);
}

export async function deleteUserTrip(uid, tripId) {
  const response = await authorizedFetch(`/api/users/${encodeURIComponent(uid)}/trips/${encodeURIComponent(tripId)}`, {
    method: 'DELETE',
  });

  return handleResponse(response);
}

export async function confirmTripItem(uid, tripId, itemId, bookingDetails = {}) {
  const response = await authorizedFetch(`/api/users/${encodeURIComponent(uid)}/trips/${encodeURIComponent(tripId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ itemId, bookingDetails }),
  });

  return handleResponse(response);
}

export async function confirmEntireTrip(uid, tripId, overrides = {}) {
  const response = await authorizedFetch(`/api/users/${encodeURIComponent(uid)}/trips/${encodeURIComponent(tripId)}/confirm-all`, {
    method: 'POST',
    body: JSON.stringify({ overrides }),
  });

  return handleResponse(response);
}
