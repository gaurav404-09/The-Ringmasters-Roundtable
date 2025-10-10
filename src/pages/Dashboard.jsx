import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiActivity, 
  FiCalendar, 
  FiChevronDown, 
  FiClock, 
  FiMapPin, 
  FiPlus, 
  FiRefreshCw, 
  FiTrash2,
  FiTrendingUp,
  FiCloud
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { fetchUserTrips, confirmEntireTrip, confirmTripItem, deleteUserTrip } from '../lib/apiClient';

// Helper functions
const formatRelativeTime = (dateString) => {
  if (!dateString) return 'just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const fallbackItinerary = (trip) => {
  return trip?.itinerary || trip?.days || [];
};

const extractCity = (trip) => {
  const cities = [];
  if (trip.startCity) cities.push(trip.startCity);
  if (trip.endCity) cities.push(trip.endCity);
  return cities;
};

const formatDateRange = (start, end) => {
  if (!start || !end) return 'Dates not set';
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
};

const getTripStatusMeta = (status) => {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Confirmed',
        icon: '✓',
        pillClass: 'bg-green-500/20 text-green-400 border-green-500/30'
      };
    case 'live':
      return {
        label: 'Live',
        icon: '●',
        pillClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      };
    case 'completed':
      return {
        label: 'Completed',
        icon: '✓',
        pillClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      };
    default:
      return {
        label: 'Draft',
        icon: '✎',
        pillClass: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      };
  }
};

const quickActions = [
  {
    title: 'Plan New Trip',
    description: 'Create a new travel itinerary',
    icon: FiPlus,
    to: '/planner'
  },
  {
    title: 'Trending',
    description: 'Discover popular destinations',
    icon: FiTrendingUp,
    to: '/trending'
  },
  {
    title: 'Weather',
    description: 'Check destination weather',
    icon: FiCloud,
    to: '/weather'
  }
];

const Dashboard = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingItemId, setConfirmingItemId] = useState(null);
  const [confirmingTripId, setConfirmingTripId] = useState(null);
  const [expandedTripId, setExpandedTripId] = useState(null);

  const loadTrips = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingTrips(true);
    setError(null);
    try {
      const response = await fetchUserTrips(user.uid);
      setTrips(response?.trips || []);
    } catch (err) {
      console.error('Failed to load trips:', err);
      setError(err?.message || 'Failed to load trips');
      toast.error('Unable to load your saved trips right now.');
    } finally {
      setLoadingTrips(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const metrics = useMemo(() => {
    const totalTrips = trips.length;
    const totalDays = trips.reduce(
      (acc, trip) => acc + (fallbackItinerary(trip).length || trip.numDays || 0),
      0,
    );
    const uniqueCities = new Set();
    trips.forEach((trip) => {
      const cities = extractCity(trip);
      cities.forEach((city) => uniqueCities.add(city));
    });
    const mostRecent = trips[0]?.updatedAt || trips[0]?.createdAt;

    return [
      {
        label: 'Trips saved',
        value: totalTrips,
        hint: totalTrips ? 'Stored in your command center' : 'Save a trip to populate metrics',
        icon: FiActivity,
      },
      {
        label: 'Destinations',
        value: uniqueCities.size,
        hint: uniqueCities.size > 0 ? 'Unique cities across itineraries' : 'Add a plan to start mapping cities',
        icon: FiMapPin,
      },
      {
        label: 'Days planned',
        value: totalDays,
        hint: totalDays ? 'Total days across all trips' : 'Start planning your trip',
        icon: FiCalendar,
      },
      {
        label: 'Last updated',
        value: mostRecent ? formatRelativeTime(mostRecent) : '—',
        hint: mostRecent ? new Date(mostRecent).toLocaleString() : 'No trips saved yet',
        icon: FiClock,
      },
    ];
  }, [trips]);
  
  const activityFeed = useMemo(() => {
    const events = [];
    trips.forEach((trip) => {
      const logs = trip.orchestrationLogs || [];
      const latestLogs = logs.slice(-4);
      latestLogs.forEach((message, index) => {
        events.push({
          id: `${trip.id}-${index}`,
          tripTitle: trip.title || `${trip.startCity} → ${trip.endCity}`,
          message,
          timestamp: trip.updatedAt || trip.createdAt,
        });
      });
    });
    return events
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 8);
  }, [trips]);

  const toggleTrip = (tripId) => {
    setExpandedTripId((prev) => (prev === tripId ? null : tripId));
  };

  const decoratedTrips = useMemo(() => {
    const now = Date.now();

    return trips.map((trip) => {
      const baseStatus = trip.status || 'draft';
      const startTime = trip.startDate ? new Date(trip.startDate).getTime() : null;
      const endTime = trip.endDate ? new Date(trip.endDate).getTime() : null;

      let derivedStatus = baseStatus;

      if (Number.isFinite(endTime) && endTime < now) {
        derivedStatus = 'completed';
      } else if (
        Number.isFinite(startTime) &&
        Number.isFinite(endTime) &&
        startTime <= now &&
        now <= endTime
      ) {
        derivedStatus = 'live';
      }

      const isConfirmed = ['confirmed', 'live', 'completed'].includes(derivedStatus);

      return {
        ...trip,
        derivedStatus,
        isConfirmed,
        dateRange: {
          start: trip.startDate,
          end: trip.endDate,
        },
      };
    });
  }, [trips]);

  const backlogTrips = useMemo(
    () => decoratedTrips.filter((trip) => !trip.isConfirmed),
    [decoratedTrips]
  );

  const liveTrips = useMemo(
    () => decoratedTrips.filter((trip) => trip.isConfirmed && trip.derivedStatus === 'live'),
    [decoratedTrips]
  );

  const upcomingTrips = useMemo(
    () =>
      decoratedTrips.filter(
        (trip) => trip.isConfirmed && trip.derivedStatus !== 'live' && trip.derivedStatus !== 'completed'
      ),
    [decoratedTrips]
  );

  const completedTrips = useMemo(
    () => decoratedTrips.filter((trip) => trip.isConfirmed && trip.derivedStatus === 'completed'),
    [decoratedTrips]
  );

  const handleConfirmTrip = async (trip) => {
    if (!user?.uid || !trip?.id) {
      toast.error('Missing information to confirm this trip.');
      return;
    }

    setConfirmingTripId(trip.id);
    try {
      const response = await confirmEntireTrip(user.uid, trip.id);
      if (!response?.success || !response?.trip) {
        throw new Error(response?.error || 'Failed to confirm trip');
      }

      setTrips((prev) => prev.map((existing) => (existing.id === trip.id ? response.trip : existing)));
      toast.success('Trip locked in. All itinerary items are confirmed.');
    } catch (err) {
      console.error('Failed to confirm trip:', err);
      toast.error(err?.message || 'Unable to confirm trip right now.');
    } finally {
      setConfirmingTripId(null);
    }
  };

  const handleConfirmItem = async (trip, activity) => {
    if (!user?.uid || !trip?.id || !activity?.itemId) {
      toast.error('Missing information to confirm this booking.');
      return;
    }

    const itemKey = `${trip.id}:${activity.itemId}`;
    setConfirmingItemId(itemKey);

    try {
      const dummyBookingDetails = {
        confirmationNumber: `CONF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        referenceCode: `PNR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        price: activity?.bookingDetails?.price || 'TBD',
      };

      const response = await confirmTripItem(user.uid, trip.id, activity.itemId, dummyBookingDetails);
      if (!response?.success || !response?.trip) {
        throw new Error(response?.error || 'Failed to confirm itinerary item');
      }

      setTrips((prev) => prev.map((existing) => (existing.id === trip.id ? response.trip : existing)));
      toast.success('Booking locked in. This item is now confirmed.');
    } catch (err) {
      console.error('Failed to confirm itinerary item:', err);
      toast.error(err?.message || 'Unable to confirm booking right now.');
    } finally {
      setConfirmingItemId(null);
    }
  };

  const handleDeleteTrip = async (tripId) => {
    if (!user?.uid) return;
    
    // Note: Using window.confirm for simplicity. A custom modal would be better for production.
    if (window.confirm('Are you sure you want to delete this trip?')) {
      try {
        await deleteUserTrip(user.uid, tripId);
        setTrips(prev => prev.filter(trip => trip.id !== tripId));
        toast.success('Trip deleted successfully');
      } catch (err) {
        console.error('Failed to delete trip:', err);
        toast.error('Failed to delete trip');
      }
    }
  };

  const renderTripCard = (trip, keyPrefix = 'trip', options = {}) => {
    const { showConfirm = !trip.isConfirmed, variant = 'default' } = options;

    const itinerary = fallbackItinerary(trip);
    const primaryCity = extractCity(trip);
    const dayCount = itinerary.length || trip.numDays || 0;
    const lastUpdated = trip.updatedAt || trip.createdAt;
    const statusMeta = getTripStatusMeta(trip.derivedStatus);
    const displayTitle = trip.title || `${trip.startCity} → ${trip.endCity}`;
    const isExpanded = expandedTripId === trip.id;
    const isConfirmingTrip = confirmingTripId === trip.id;
    const cardClasses =
      variant === 'finished'
        ? 'rounded-3xl border border-indigo-400/40 bg-indigo-500/10 p-6 shadow-[0_22px_55px_RGBA(79,70,229,0.35)] backdrop-blur'
        : 'rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_22px_55px_RGBA(15,23,42,0.4)] backdrop-blur';

    const isCompleted = trip.derivedStatus === 'completed';

    return (
      <motion.div
        key={`${keyPrefix}-${trip.id}`}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={cardClasses}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">{displayTitle}</h3>
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">
              Saved {formatRelativeTime(lastUpdated)} • {primaryCity.length} cities • {dayCount} days orchestrated
            </p>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] ${statusMeta.pillClass}`}>
              <span>{statusMeta.icon}</span>
              {statusMeta.label}
            </span>
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">
              {formatDateRange(trip.dateRange?.start, trip.dateRange?.end)}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
            <button
              onClick={() => toggleTrip(trip.id)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label={isExpanded ? 'Collapse trip details' : 'Expand trip details'}
            >
              <FiChevronDown className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            
            {showConfirm && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmTrip(trip);
                }}
                disabled={isConfirmingTrip}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConfirmingTrip ? 'Confirming...' : 'Confirm Trip'}
              </button>
            )}
            {isCompleted && (
              <Link
                to={{
                  pathname: '/community',
                  search: `?openComposer=1&source=${encodeURIComponent(trip.startCity || '')}&destination=${encodeURIComponent(trip.endCity || '')}`,
                }}
                className="inline-flex items-center gap-2 rounded-md border border-emerald-400/50 bg-emerald-400/10 px-3 py-1.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20"
              >
                Share review
              </Link>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTrip(trip.id);
              }}
              className="p-2 text-red-400 hover:text-red-300 transition-colors"
              aria-label="Delete trip"
            >
              <FiTrash2 />
            </button>
          </div>
        </div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 overflow-hidden"
            >
              <div className="pt-4 border-t border-gray-700/50">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Itinerary</h4>
                <div className="space-y-3">
                  {itinerary.length > 0 ? (
                    itinerary.map((day, dayIndex) => (
                      <div key={dayIndex} className="bg-gray-800/50 p-3 rounded-lg">
                        <h5 className="font-medium text-gray-200">Day {dayIndex + 1}</h5>
                        <div className="mt-2 space-y-2">
                          {day.activities?.map((activity, activityIndex) => (
                            <div
                              key={`${dayIndex}-${activityIndex}`}
                              className="flex items-start gap-3 p-2 bg-gray-700/30 rounded-md"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium">{activity.name || 'Untitled Activity'}</p>
                                {activity.time && (
                                  <p className="text-xs text-gray-400">{activity.time}</p>
                                )}
                                {activity.location && (
                                  <p className="text-xs text-gray-400">{activity.location}</p>
                                )}
                              </div>
                              {activity.status === 'pending' && (
                                <button
                                  onClick={() => handleConfirmItem(trip, activity)}
                                  disabled={confirmingItemId === `${trip.id}:${activity.itemId}`}
                                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                                >
                                  {confirmingItemId === `${trip.id}:${activity.itemId}` ? 'Confirming...' : 'Confirm'}
                                </button>
                              )}
                              {activity.status === 'confirmed' && (
                                <span className="text-xs px-2 py-1 bg-green-600/20 text-green-400 rounded">
                                  Confirmed
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 italic">No itinerary items yet</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-red-500 mb-4">Error: {error}</div>
          <button
            onClick={loadTrips}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <FiRefreshCw className="animate-spin" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user?.displayName || 'Traveler'}
          </h1>
          <p className="text-gray-400">Here's what's happening with your trips</p>
        </header>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              to={action.to}
              className="bg-gray-800 hover:bg-gray-700 p-4 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <action.icon className="text-blue-400 text-xl" />
                </div>
                <div>
                  <h3 className="font-medium">{action.title}</h3>
                  <p className="text-sm text-gray-400">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((metric, index) => (
            <div key={index} className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{metric.label}</p>
                  <p className="text-2xl font-bold">{metric.value}</p>
                </div>
                <div className="p-2 bg-gray-700/50 rounded-lg">
                  <metric.icon className="text-blue-400 text-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trips */}
        <div className="space-y-8">
          {/* Pending Confirmation */}
          {backlogTrips.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                Pending Confirmation
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Lock these itineraries first to move them into upcoming, live, or past trips.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {backlogTrips.map(trip => renderTripCard(trip, 'backlog', { variant: 'default' }))}
              </div>
            </section>
          )}

          {/* Live Trips */}
          {liveTrips.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Live Trips
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveTrips.map(trip => renderTripCard(trip, 'live'))}
              </div>
            </section>
          )}

          {/* Upcoming Trips */}
          {upcomingTrips.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4">Upcoming Trips</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingTrips.map(trip => renderTripCard(trip, 'upcoming'))}
              </div>
            </section>
          )}

          {/* Completed Trips */}
          {completedTrips.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4">Past Trips</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedTrips.map(trip => renderTripCard(trip, 'completed', { variant: 'finished' }))}
              </div>
            </section>
          )}

          {trips.length === 0 && !loadingTrips && (
            <div className="text-center py-12 bg-gray-800/50 rounded-lg">
              <h3 className="text-xl font-medium mb-2">No trips found</h3>
              <p className="text-gray-400 mb-6">Start planning your next adventure</p>
              <Link
                to="/planner"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <FiPlus /> Create New Trip
              </Link>
            </div>
          )}
          {loadingTrips && (
            <div className="text-center py-12">
              <FiRefreshCw className="animate-spin text-4xl mx-auto text-blue-500" />
              <p className="mt-4 text-gray-400">Loading your trips...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
