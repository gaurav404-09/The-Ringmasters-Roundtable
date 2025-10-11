import ENV from '../config/env';

const API_BASE_URL = ENV.API_BASE_URL || 'http://localhost:3000';

const defaultHeaders = () => ({
  'Content-Type': 'application/json',
});

export const fetchNewOpportunities = async (uid) => {
  if (!uid) {
    return [];
  }

  const response = await fetch(`${API_BASE_URL}/api/opportunities/new?uid=${encodeURIComponent(uid)}`, {
    method: 'GET',
    headers: defaultHeaders(),
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Pip opportunities');
  }

  const body = await response.json();
  return Array.isArray(body?.opportunities) ? body.opportunities : [];
};

export const markOpportunitySeen = async (uid, opportunityId) => {
  if (!uid || !opportunityId) {
    return;
  }

  const response = await fetch(`${API_BASE_URL}/api/opportunities/${encodeURIComponent(opportunityId)}/seen`, {
    method: 'POST',
    headers: defaultHeaders(),
    credentials: 'include',
    body: JSON.stringify({ uid }),
  });

  if (!response.ok) {
    throw new Error('Failed to mark Pip opportunity as seen');
  }
};

export const deleteAllOpportunities = async (uid) => {
  if (!uid) {
    return;
  }

  const response = await fetch(`${API_BASE_URL}/api/opportunities/all`, {
    method: 'DELETE',
    headers: defaultHeaders(),
    credentials: 'include',
    body: JSON.stringify({ uid }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete Pip opportunities');
  }
};
