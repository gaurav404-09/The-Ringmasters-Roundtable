import ENV from '../config/env';

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

export async function fetchUserTrips(uid) {
  const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(uid)}/trips`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  return handleResponse(response);
}

export async function saveUserTrip(uid, trip) {
  const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(uid)}/trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ trip }),
  });

  return handleResponse(response);
}

export async function deleteUserTrip(uid, tripId) {
  const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(uid)}/trips/${encodeURIComponent(tripId)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  return handleResponse(response);
}

export async function confirmTripItem(uid, tripId, itemId, bookingDetails = {}) {
  const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(uid)}/trips/${encodeURIComponent(tripId)}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ itemId, bookingDetails }),
  });

  return handleResponse(response);
}

export async function confirmEntireTrip(uid, tripId, overrides = {}) {
  const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(uid)}/trips/${encodeURIComponent(tripId)}/confirm-all`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ overrides }),
  });

  return handleResponse(response);
}
