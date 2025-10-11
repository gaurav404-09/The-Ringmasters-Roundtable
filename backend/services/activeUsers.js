// Track active users who are currently logged in
const activeUsers = new Set();
const USER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const lastSeenMap = new Map();

export const markUserActive = (userId) => {
  if (!userId) return;
  activeUsers.add(userId);
  lastSeenMap.set(userId, Date.now());
  console.log('[ActiveUsers] User marked active:', userId);
};

export const getActiveUsers = () => {
  const now = Date.now();
  // Remove users who haven't been seen in 5 minutes
  for (const [userId, lastSeen] of lastSeenMap.entries()) {
    if (now - lastSeen > USER_TIMEOUT_MS) {
      activeUsers.delete(userId);
      lastSeenMap.delete(userId);
      console.log('[ActiveUsers] User timed out:', userId);
    }
  }
  return Array.from(activeUsers);
};

export const isUserActive = (userId) => {
  return activeUsers.has(userId);
};

export const clearInactiveUsers = () => {
  const now = Date.now();
  let cleared = 0;
  for (const [userId, lastSeen] of lastSeenMap.entries()) {
    if (now - lastSeen > USER_TIMEOUT_MS) {
      activeUsers.delete(userId);
      lastSeenMap.delete(userId);
      cleared++;
    }
  }
  if (cleared > 0) {
    console.log(`[ActiveUsers] Cleared ${cleared} inactive user(s)`);
  }
  return cleared;
};
