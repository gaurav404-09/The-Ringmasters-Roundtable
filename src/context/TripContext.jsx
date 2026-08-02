import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TripContext = createContext(null);

const STORAGE_KEY = 'ringmaster_active_trip';

/**
 * Shape of activeTrip:
 * {
 *   origin: string,          // e.g. "Delhi"
 *   destination: string,     // e.g. "Goa"
 *   originIata: string,      // e.g. "DEL" (optional)
 *   destinationIata: string, // e.g. "GOI" (optional)
 *   departureDate: string,   // YYYY-MM-DD (optional)
 *   days: number,            // e.g. 5 (optional)
 *   itinerary: Array,        // daily plan (optional)
 *   events: Object,          // by city (optional)
 *   setAt: string,           // ISO timestamp
 * }
 */

export const TripProvider = ({ children }) => {
  const [activeTrip, setActiveTripState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setActiveTrip = useCallback((trip) => {
    const withTimestamp = { ...trip, setAt: new Date().toISOString() };
    setActiveTripState(withTimestamp);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withTimestamp));
    } catch {
      // storage might be unavailable
    }
  }, []);

  const clearTrip = useCallback(() => {
    setActiveTripState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = { activeTrip, setActiveTrip, clearTrip };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
};

export const useTripContext = () => {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTripContext must be used inside <TripProvider>');
  return ctx;
};

export default TripContext;
