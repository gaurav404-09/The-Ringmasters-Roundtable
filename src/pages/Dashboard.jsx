import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiActivity,
  FiCalendar,
  FiChevronDown,
  FiClock,
  FiCloud,
  FiEdit2,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import {
  deleteUserTrip,
  fetchUserTrips,
  confirmTripItem,
  confirmEntireTrip,
  updateTripActivity,
  addTripActivity,
} from '../lib/apiClient';
import NearbyAttractions from '../components/NearbyAttractions.jsx';

const quickActions = [
  {
    title: 'Plan a new tour',
    subtitle: 'Open the Orchestrator and stream a fresh itinerary.',
    to: '/planner',
    icon: FiPlus,
    tone: 'from-cyan-500 via-sky-500 to-indigo-500',
  },
  {
    title: 'Compare destinations',
    subtitle: 'Run a head-to-head duel with budgets, vibes, and weather.',
    to: '/compare',
    icon: FiTrendingUp,
    tone: 'from-purple-500 via-violet-500 to-indigo-500',
  },
  {
    title: 'Weather intelligence',
    subtitle: 'Check the Sky Gazer dashboard for live climate signals.',
    to: '/weather',
    icon: FiCloud,
    tone: 'from-emerald-500 via-teal-500 to-cyan-500',
  },
  {
    title: 'Events radar',
    subtitle: 'Scout concerts, festivals, and cultural moments for your dates.',
    to: '/events',
    icon: FiCalendar,
    tone: 'from-amber-500 via-orange-500 to-rose-500',
  },
];

const formatRelativeTime = (isoString) => {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

const fallbackItinerary = (trip) => {
  if (!trip) return [];
  return trip.result?.itinerary || trip.result?.days || [];
};

const extractCities = (trip) => {
  const itinerary = fallbackItinerary(trip);
  const cities = new Set();
  itinerary.forEach((day) => {
    if (day.city) {
      cities.add(day.city);
    }
    if (day.destination) {
      cities.add(day.destination);
    }
  });
  if (trip.startCity) cities.add(trip.startCity);
  if (trip.endCity) cities.add(trip.endCity);
  return [...cities];
};

const parseISODate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addDaysToDate = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getTripDateRange = (trip) => {
  const storedStart = parseISODate(trip?.startDate || trip?.start_date || trip?.result?.start_date);
  const storedEnd = parseISODate(trip?.endDate || trip?.end_date || trip?.result?.end_date);
  if (storedStart && storedEnd) {
    return { start: storedStart, end: storedEnd };
  }

  if (storedStart && Number.isFinite(trip?.numDays)) {
    const end = addDaysToDate(storedStart, Math.max(0, Number(trip.numDays) - 1));
    return { start: storedStart, end };
  }

  return { start: null, end: null };
};

const formatDateRange = (start, end) => {
  if (!start || !end) return 'Dates pending';
  const sameYear = start.getFullYear() === end.getFullYear();
  const options = { month: 'short', day: 'numeric' };
  const startLabel = start.toLocaleDateString(undefined, { ...options, year: sameYear ? undefined : 'numeric' });
  const endLabel = end.toLocaleDateString(undefined, { ...options, year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
};

const isTripLiveNow = (trip) => {
  const { start, end } = getTripDateRange(trip);
  if (!start || !end) return false;
  const now = new Date();
  return now >= start && now <= end;
};

const getDerivedTripStatus = (trip) => {
  const rawStatus = trip?.status || 'draft';
  const { start, end } = getTripDateRange(trip);
  if (start && end) {
    const now = new Date();
    if (now > end) {
      return 'completed';
    }
    if ((rawStatus === 'confirmed' || rawStatus === 'live') && now >= start && now <= end) {
      return 'live';
    }
  }
  return rawStatus;
};

const flattenActivitiesWithSchedule = (trip) => {
  const itinerary = fallbackItinerary(trip);
  const { start } = getTripDateRange(trip);
  if (!start) return [];

  return itinerary.flatMap((day, dayIndex) => {
    if (!Array.isArray(day?.activities)) return [];
    const dayDate = addDaysToDate(start, dayIndex);
    return day.activities.map((activity) => {
      const [hours, minutes] = (activity?.time || '00:00').split(':').map((value) => parseInt(value, 10) || 0);
      const scheduledAt = new Date(dayDate);
      scheduledAt.setHours(hours, minutes, 0, 0);
      return { activity, scheduledAt, dayLabel: day?.date || day?.day || dayIndex + 1, city: day?.city };
    });
  });
};

const getNextConfirmedActivity = (trip) => {
  const now = new Date();
  const activities = flattenActivitiesWithSchedule(trip).filter(({ activity }) => activity?.status === 'confirmed');
  const upcoming = activities
    .filter(({ scheduledAt }) => scheduledAt >= now)
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
  return upcoming[0] || null;
};

const getActivityStatusStyles = (activity) => {
  if (activity?.status === 'confirmed') {
    return {
      badge: 'bg-emerald-400 text-slate-900',
      wrapper: 'border border-emerald-400/60 bg-emerald-400/15 text-emerald-100',
      accent: 'text-emerald-300',
    };
  }
  if (activity?.status === 'pending') {
    return {
      badge: 'bg-amber-300/80 text-slate-900',
      wrapper: 'border border-amber-300/50 bg-amber-300/10 text-amber-100',
      accent: 'text-amber-200',
    };
  }
  return {
    badge: 'bg-white/15 text-white/70',
    wrapper: 'border border-white/10 bg-white/5 text-white/80',
    accent: 'text-white/60',
  };
};

const getTripStatusMeta = (status) => {
  switch (status) {
    case 'live':
      return {
        label: 'Live',
        pillClass: 'bg-cyan-300/20 border border-cyan-300/60 text-cyan-100',
        icon: '🚀',
        variant: 'live',
      };
    case 'confirmed':
      return {
        label: 'Confirmed',
        pillClass: 'bg-emerald-300/20 border border-emerald-300/60 text-emerald-100',
        icon: '🎟️',
        variant: 'default',
      };
    case 'completed':
      return {
        label: 'Completed',
        pillClass: 'bg-indigo-300/20 border border-indigo-300/60 text-indigo-100',
        icon: '🏁',
        variant: 'finished',
      };
    default:
      return {
        label: 'Draft',
        pillClass: 'bg-white/10 border border-white/20 text-white/70',
        icon: '🗂️',
        variant: 'default',
      };
  }
};

const formatActivityTime = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatCitiesLabel = (cities) => {
  if (!cities.length) return 'Destinations pending';
  if (cities.length === 1) return cities[0];
  if (cities.length === 2) return `${cities[0]} • ${cities[1]}`;
  return `${cities[0]} • ${cities[1]} +${cities.length - 2}`;
};

const deriveDayNumber = (day, fallbackIndex) => {
  if (!day) return fallbackIndex + 1;
  const numericDay = Number(day.day);
  if (Number.isFinite(numericDay) && numericDay > 0) {
    return numericDay;
  }
  const numericId = Number(String(day.id || '').replace(/[^0-9]/g, ''));
  if (Number.isFinite(numericId) && numericId > 0) {
    return numericId;
  }
  return fallbackIndex + 1;
};

const buildDayIdentifier = (day, fallbackIndex) => {
  const dayNumber = deriveDayNumber(day, fallbackIndex);
  const identifier = {};
  if (day?.id) {
    identifier.id = day.id;
  }
  if (day?.date) {
    identifier.date = day.date;
  }
  if (Number.isFinite(dayNumber)) {
    identifier.dayNumber = dayNumber;
  }

  if (!Object.keys(identifier).length) {
    identifier.dayNumber = fallbackIndex + 1;
  }

  return { dayNumber, identifier };
};

const editableStatuses = ['suggested', 'pending', 'planned', 'proposed'];

const Dashboard = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingItemId, setConfirmingItemId] = useState(null);
  const [confirmingTripId, setConfirmingTripId] = useState(null);
  const [expandedTripId, setExpandedTripId] = useState(null);
  const [activityEditor, setActivityEditor] = useState(null);
  const [savingActivity, setSavingActivity] = useState(false);

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
      extractCities(trip).forEach((city) => uniqueCities.add(city));
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
        label: 'Destinations covered',
        value: uniqueCities.size,
        hint: uniqueCities.size ? 'Unique cities across itineraries' : 'Add a plan to start mapping cities',
        icon: FiMapPin,
      },
      {
        label: 'Days orchestrated',
        value: totalDays,
        hint: totalDays ? 'Sum of itinerary days crafted' : 'Keep building the tour pipeline',
        icon: FiCalendar,
      },
      {
        label: 'Last update',
        value: mostRecent ? formatRelativeTime(mostRecent) : '—',
        hint: mostRecent ? new Date(mostRecent).toLocaleString() : 'Planner has not saved any runs yet',
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
          tripTitle: trip.title || `${trip.startCity || 'Start'} → ${trip.endCity || 'End'}`,
          message,
          timestamp: trip.updatedAt || trip.createdAt,
        });
      });
    });
    return events
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 8);
  }, [trips]);

  const decoratedTrips = useMemo(
    () =>
      trips.map((trip) => {
        const derivedStatus = getDerivedTripStatus(trip);
        const dateRange = getTripDateRange(trip);
        const nextActivity = derivedStatus === 'live' ? getNextConfirmedActivity(trip) : null;
        return {
          ...trip,
          derivedStatus,
          dateRange,
          nextActivity,
          isLive: derivedStatus === 'live' || isTripLiveNow(trip),
        };
      }),
    [trips],
  );

  const liveTrips = useMemo(
    () => decoratedTrips.filter((trip) => trip.derivedStatus === 'live'),
    [decoratedTrips],
  );

  const upcomingTrips = useMemo(
    () =>
      decoratedTrips.filter(
        (trip) => trip.derivedStatus !== 'live' && trip.derivedStatus !== 'completed',
      ),
    [decoratedTrips],
  );

  const completedTrips = useMemo(
    () => decoratedTrips.filter((trip) => trip.derivedStatus === 'completed'),
    [decoratedTrips],
  );

  const displayName = user?.displayName || user?.email || 'Traveler';

  const toggleTrip = (tripId) => {
    setExpandedTripId((prev) => (prev === tripId ? null : tripId));
  };

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
    const itemId = activity?.itemId || activity?.id;
    if (!user?.uid || !trip?.id || !itemId) {
      toast.error('Missing information to confirm this booking.');
      return;
    }

    const itemKey = `${trip.id}:${itemId}`;
    setConfirmingItemId(itemKey);

    try {
      const dummyBookingDetails = {
        confirmationNumber: `CONF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        referenceCode: `PNR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        price: activity?.bookingDetails?.price || 'TBD',
      };

      const response = await confirmTripItem(user.uid, trip.id, itemId, dummyBookingDetails);
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

    if (!window.confirm('Remove this saved trip from your dashboard?')) {
      return;
    }

    try {
      await deleteUserTrip(user.uid, tripId);
      setTrips((prev) => prev.filter((trip) => trip.id !== tripId));
      if (expandedTripId === tripId) {
        setExpandedTripId(null);
      }
      toast.success('Trip deleted.');
    } catch (err) {
      console.error('Failed to delete trip:', err);
      toast.error(err?.message || 'Unable to delete trip at the moment.');
    }
  };

  const openActivityEditor = (trip, day, dayIndex, activity = null) => {
    if (!trip?.id || !day) return;
    const { identifier, dayNumber } = buildDayIdentifier(day, dayIndex);
    const itemId = activity?.itemId || activity?.id || null;

    setActivityEditor({
      tripId: trip.id,
      dayIdentifier: identifier,
      dayNumber,
      city: day?.city,
      transportMode: trip?.transportMode || trip?.result?.transport_mode,
      activity: activity
        ? {
            itemId,
            title: activity?.title || activity?.name || '',
            time: activity?.time || activity?.slot || '',
            notes: activity?.notes || activity?.description || '',
            location: activity?.location || activity?.venue || '',
            status: activity?.status || 'suggested',
          }
        : {
            itemId: null,
            title: '',
            time: '',
            notes: '',
            location: '',
            status: 'suggested',
          },
    });
  };

  const closeActivityEditor = () => {
    setActivityEditor(null);
  };

  const handleActivityFieldChange = (field, value) => {
    setActivityEditor((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        activity: {
          ...prev.activity,
          [field]: value,
        },
      };
    });
  };

  const handleSaveActivity = async () => {
    if (!activityEditor || !user?.uid) return;
    const { tripId, activity, dayIdentifier } = activityEditor;
    const isEdit = Boolean(activity?.itemId);

    if (!activity?.title?.trim()) {
      toast.error('Activity title is required.');
      return;
    }

    const normalizedStatus = (activity.status || '').toLowerCase();
    const cleanPayload = {
      title: activity.title.trim(),
      time: activity.time?.trim() || '',
      notes: activity.notes?.trim() || '',
      location: activity.location?.trim() || '',
      status: editableStatuses.includes(normalizedStatus) ? normalizedStatus : 'suggested',
    };

    setSavingActivity(true);
    try {
      let response;
      if (isEdit) {
        response = await updateTripActivity(user.uid, tripId, activity.itemId, cleanPayload);
      } else {
        response = await addTripActivity(user.uid, tripId, {
          dayIdentifier,
          activity: cleanPayload,
        });
      }

      if (!response?.success || !response?.trip) {
        throw new Error(response?.error || 'Failed to save activity');
      }

      setTrips((prev) => prev.map((existing) => (existing.id === tripId ? response.trip : existing)));
      toast.success(isEdit ? 'Activity updated.' : 'Activity added to itinerary.');
      closeActivityEditor();
    } catch (err) {
      console.error('Failed to save activity:', err);
      toast.error(err?.message || 'Unable to save activity right now.');
    } finally {
      setSavingActivity(false);
    }
  };

  const renderTripCard = (trip, keyPrefix = 'trip', options = {}) => {
    const { variant: variantOverride, showConfirm = trip.derivedStatus !== 'confirmed' && trip.derivedStatus !== 'live' } = options;

    const itinerary = fallbackItinerary(trip);
    const cities = extractCities(trip);
    const statusMeta = getTripStatusMeta(trip.derivedStatus);
    const variant = variantOverride || statusMeta.variant || 'default';
    const nextActivity = trip.nextActivity;
    const isExpanded = expandedTripId === trip.id;
    const isConfirmingTrip = confirmingTripId === trip.id;
    const dayCount = itinerary.length || trip.numDays || 0;
    const lastUpdated = trip.updatedAt || trip.createdAt;
    const displayTitle = trip.title || `${trip.startCity || 'Origin'} → ${trip.endCity || 'Destination'}`;
    const eventsByCity = trip?.result?.events || trip?.events || {};

    const baseClasses = {
      live: 'rounded-3xl border border-cyan-400/40 bg-white/5 p-6 shadow-[0_25px_70px_rgba(14,165,233,0.35)] backdrop-blur',
      finished: 'rounded-3xl border border-indigo-400/40 bg-indigo-500/10 p-6 shadow-[0_22px_60px_rgba(79,70,229,0.35)] backdrop-blur',
      default: 'rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.35)] backdrop-blur',
    };

    return (
      <motion.article
        key={`${keyPrefix}-${trip.id}`}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={baseClasses[variant] || baseClasses.default}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">{displayTitle}</h3>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              {formatDateRange(trip.dateRange?.start, trip.dateRange?.end)} • {formatCitiesLabel(cities)} • {dayCount} days orchestrated
            </p>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] ${statusMeta.pillClass}`}>
              <span>{statusMeta.icon}</span>
              {statusMeta.label}
            </span>
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">
              Updated {formatRelativeTime(lastUpdated)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
            <button
              type="button"
              onClick={() => toggleTrip(trip.id)}
              className="group inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
              aria-label={isExpanded ? 'Collapse trip details' : 'Expand trip details'}
            >
              View details
              <FiChevronDown className={`transform transition-transform group-hover:translate-y-0.5 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {showConfirm && (
              <button
                type="button"
                onClick={() => handleConfirmTrip(trip)}
                disabled={isConfirmingTrip}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConfirmingTrip ? 'Confirming…' : 'Confirm trip'}
              </button>
            )}

            {trip.derivedStatus === 'completed' && (
              <Link
                to={{
                  pathname: '/community',
                  search: `?openComposer=1&source=${encodeURIComponent(trip.startCity || '')}&destination=${encodeURIComponent(trip.endCity || '')}`,
                }}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:bg-emerald-400/10"
              >
                Share review
              </Link>
            )}

            <button
              type="button"
              onClick={() => handleDeleteTrip(trip.id)}
              className="inline-flex items-center gap-2 rounded-full border border-red-400/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-red-300 transition hover:border-red-300/80 hover:text-red-200"
            >
              <FiTrash2 />
              Remove
            </button>
          </div>
        </div>

        {nextActivity && (
          <div className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">Next confirmed act</p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <span className="text-base font-semibold text-white">{nextActivity.activity?.title || nextActivity.activity?.name || 'Pending confirmation'}</span>
              <span className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                {formatActivityTime(nextActivity.scheduledAt)}
              </span>
              {nextActivity.city && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/40 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-emerald-100">
                  <FiMapPin />
                  {nextActivity.city}
                </span>
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 overflow-hidden"
            >
              <div className="pt-4 border-t border-white/10">
                <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">Itinerary breakdown</h4>
                <div className="mt-4 space-y-4">
                  {itinerary.length > 0 ? (
                    itinerary.map((day, dayIndex) => (
                      <div key={dayIndex} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white/90">Day {dayIndex + 1}</p>
                            {day?.city && (
                              <p className="text-xs uppercase tracking-[0.3em] text-white/50">{day.city}</p>
                            )}
                          </div>
                          {day?.weather && (
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/70">
                              {day.weather.temp}°C · {day.weather.weather}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_minmax(0,0.8fr)]">
                          <div className="space-y-3">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Agent-selected activities</p>
                            {day.activities?.length ? (
                              day.activities.map((activity, activityIndex) => {
                                const itemId = activity?.itemId || activity?.id || `${dayIndex}-${activityIndex}`;
                                const itemKey = `${trip.id}:${itemId}`;
                                const isConfirmingItem = confirmingItemId === itemKey;
                                const styles = getActivityStatusStyles(activity);
                                const notes = activity?.notes || activity?.description;

                                return (
                                  <div
                                    key={itemId}
                                    className={`flex flex-col gap-3 rounded-2xl p-3 transition ${styles.wrapper}`}
                                  >
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <p className="text-sm font-semibold text-white">{activity?.title || activity?.name || 'Untitled activity'}</p>
                                        {(activity?.time || activity?.slot) && (
                                          <p className={`text-xs uppercase tracking-[0.3em] ${styles.accent}`}>
                                            {activity?.time || activity?.slot}
                                          </p>
                                        )}
                                        {(activity?.location || activity?.venue) && (
                                          <p className="text-xs text-white/60">
                                            {activity?.location || activity?.venue}
                                          </p>
                                        )}
                                        {notes && (
                                          <p className="mt-2 text-xs text-white/70">{notes}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 self-start sm:self-auto">
                                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] ${styles.badge}`}>
                                          {activity?.status === 'confirmed' ? 'Confirmed' : activity?.status || 'Proposed'}
                                        </span>
                                        {activity?.status !== 'confirmed' && (
                                          <button
                                            type="button"
                                            onClick={() => openActivityEditor(trip, day, dayIndex, activity)}
                                            className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                                          >
                                            <FiEdit2 className="text-xs" />
                                            Edit
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {activity?.status === 'pending' && (
                                      <button
                                        type="button"
                                        onClick={() => handleConfirmItem(trip, activity)}
                                        disabled={isConfirmingItem}
                                        className="inline-flex w-max items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {isConfirmingItem ? 'Confirming…' : 'Confirm booking'}
                                      </button>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-sm text-white/60 italic">No curated activities for this day.</p>
                            )}
                            {trip.derivedStatus !== 'confirmed' && (
                              <button
                                type="button"
                                onClick={() => openActivityEditor(trip, day, dayIndex, null)}
                                className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                              >
                                <FiPlus className="text-sm" />
                                Add custom activity
                              </button>
                            )}
                          </div>

                          <div className="space-y-3">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Live events feed</p>
                            {(() => {
                              const events = Array.isArray(eventsByCity?.[day?.city]) ? eventsByCity[day.city] : [];
                              if (!events.length) {
                                return (
                                  <p className="text-sm text-white/60 italic">
                                    No live events were synced for this city.
                                  </p>
                                );
                              }

                              return events.map((event, eventIndex) => (
                                <div
                                  key={`${day?.city || 'city'}-${eventIndex}`}
                                  className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/80"
                                >
                                  <p className="font-semibold text-white">{event.title || event.name}</p>
                                  {(event.date || event.time) && (
                                    <p className="text-xs text-white/60">{event.date || event.time}</p>
                                  )}
                                  {event.location && (
                                    <p className="text-xs text-white/60">{event.location}</p>
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white/60 italic">No itinerary items yet.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_60%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(124,58,237,0.22),_transparent_65%)]" aria-hidden="true" />

      <main className="relative mx-auto max-w-7xl px-6 pb-24 pt-24 sm:px-8 lg:px-12">
        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 p-10 shadow-[0_28px_70px_rgba(15,118,133,0.35)]"
        >
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">
                Operations command center
              </span>
              <h1 className="text-4xl font-black leading-tight sm:text-5xl">
                Welcome back, {displayName}. Time to orchestrate the next headline tour.
              </h1>
              <p className="text-sm text-white/70 sm:text-base">
                Monitor every saved itinerary, replay agent handoffs, and jump back into planning without sifting through static slides.
                Everything below is live and ready for action.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/planner"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white shadow-[0_22px_55px_rgba(14,165,233,0.4)] transition hover:shadow-[0_26px_70px_rgba(14,165,233,0.45)]"
                >
                  <FiPlus className="text-base" />
                  Plan another trip
                </Link>
                <button
                  type="button"
                  onClick={loadTrips}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white"
                  disabled={loadingTrips}
                >
                  <FiRefreshCw className={`text-base ${loadingTrips ? 'animate-spin' : ''}`} />
                  {loadingTrips ? 'Refreshing' : 'Refresh data'}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {quickActions.map(({ title, subtitle, to, icon: Icon, tone }) => (
                <Link
                  key={title}
                  to={to}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:-translate-y-1 hover:border-white/30"
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone} opacity-40 blur-3xl transition group-hover:opacity-60`} aria-hidden="true" />
                  <div className="relative flex flex-col gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white">
                      <Icon className="text-lg" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white">{title}</h3>
                      <p className="mt-1 text-xs text-white/70">{subtitle}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, hint, icon: Icon }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.35)] backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white">
                  <Icon className="text-lg" />
                </span>
                <span className="text-xs uppercase tracking-[0.35em] text-white/50">{label}</span>
              </div>
              <p className="mt-5 text-3xl font-semibold text-white">{value}</p>
              <p className="mt-2 text-xs text-white/60">{hint}</p>
            </motion.div>
          ))}
        </section>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.65fr_minmax(320px,0.85fr)]">
          <section className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Saved itineraries</h2>
                <p className="text-sm text-white/60">Replay multi-agent runs, duplicate winning acts, or prune unused drafts.</p>
              </div>
            </div>

            {error && (
              <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={loadTrips}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-rose-100 transition hover:border-rose-100/60"
                  >
                    <FiRefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </div>
              </div>
            )}

            {loadingTrips && (
              <div className="space-y-4">
                {[0, 1].map((placeholder) => (
                  <div key={placeholder} className="animate-pulse rounded-3xl border border-white/10 bg-white/5 p-6">
                    <div className="h-5 w-40 rounded bg-white/20" />
                    <div className="mt-4 h-3 w-full rounded bg-white/10" />
                    <div className="mt-2 h-3 w-2/3 rounded bg-white/10" />
                  </div>
                ))}
              </div>
            )}

            {!loadingTrips && trips.length === 0 && !error && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white/70">
                <h3 className="text-lg font-semibold text-white">No saved trips yet</h3>
                <p className="mt-2 text-sm">
                  Run the planner to generate your first itinerary and it will appear here with full agent context.
                </p>
                <Link
                  to="/planner"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white shadow-[0_22px_55px_rgba(14,165,233,0.4)]"
                >
                  <FiPlus className="text-base" />
                  Launch planner
                </Link>
              </div>
            )}

            {!loadingTrips && trips.length > 0 && (
              <div className="space-y-6">
                {liveTrips.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      <h3 className="text-lg font-semibold text-white">Live tours in motion</h3>
                    </div>
                    <div className="space-y-4">
                      {liveTrips.map((trip) => renderTripCard(trip, 'live', { variant: 'live', showConfirm: trip.derivedStatus !== 'live' }))}
                    </div>
                  </div>
                )}

                {upcomingTrips.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Upcoming itineraries</h3>
                    <div className="space-y-4">
                      {upcomingTrips.map((trip) => renderTripCard(trip, 'upcoming'))}
                    </div>
                  </div>
                )}

                {completedTrips.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Past productions</h3>
                    <div className="space-y-4">
                      {completedTrips.map((trip) => renderTripCard(trip, 'completed', { variant: 'finished', showConfirm: false }))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">Multi-agent trail</p>
                  <h3 className="text-lg font-semibold text-white">Orchestrator activity feed</h3>
                </div>
                <button
                  type="button"
                  onClick={loadTrips}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                >
                  <FiRefreshCw className="h-3.5 w-3.5" />
                  Sync
                </button>
              </div>
              <div className="mt-6 space-y-4">
                {activityFeed.length > 0 ? (
                  activityFeed.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm text-white/75 shadow-inner shadow-slate-900/40"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-white/90">{event.tripTitle}</p>
                        <span className="text-xs uppercase tracking-[0.3em] text-white/50">
                          {formatRelativeTime(event.timestamp)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/70">{event.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/60">No orchestration logs yet. Run the planner or confirm bookings to see real-time agent updates.</p>
                )}
              </div>
            </section>

            <NearbyAttractions focus="mixed" limit={5} />
          </aside>
        </div>
      </main>

      <AnimatePresence>
        {activityEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          >
            <div
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={savingActivity ? undefined : closeActivityEditor}
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-900/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.65)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50">Customise itinerary</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {activityEditor.city ? `${activityEditor.city}` : 'Itinerary day'}
                  </h2>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/45">
                    Day {activityEditor.dayNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={savingActivity ? undefined : closeActivityEditor}
                  className="rounded-full border border-white/15 p-2 text-white/70 transition hover:border-white/35 hover:text-white"
                  aria-label="Close activity editor"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              <form
                className="mt-6 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSaveActivity();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                      Activity title
                    </label>
                    <input
                      value={activityEditor.activity.title}
                      onChange={(event) => handleActivityFieldChange('title', event.target.value)}
                      placeholder="Sunset cruise"
                      className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60 focus:bg-white/10"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                      Start time
                    </label>
                    <input
                      type="time"
                      value={activityEditor.activity.time}
                      onChange={(event) => handleActivityFieldChange('time', event.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:bg-white/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                    Location / venue
                  </label>
                  <input
                    value={activityEditor.activity.location}
                    onChange={(event) => handleActivityFieldChange('location', event.target.value)}
                    placeholder="Baga Beach"
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400/60 focus:bg-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                    Notes / description
                  </label>
                  <textarea
                    value={activityEditor.activity.notes}
                    onChange={(event) => handleActivityFieldChange('notes', event.target.value)}
                    rows={4}
                    placeholder="Add crew callouts, booking hints, or what to pack."
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60 focus:bg-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                    Status
                  </label>
                  <select
                    value={activityEditor.activity.status}
                    onChange={(event) => handleActivityFieldChange('status', event.target.value)}
                    className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:bg-white/10"
                  >
                    {editableStatuses.map((option) => (
                      <option key={option} value={option} className="bg-slate-900 text-white">
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={savingActivity ? undefined : closeActivityEditor}
                    className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingActivity}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-[0_18px_45px_rgba(14,165,233,0.35)] transition hover:shadow-[0_24px_60px_rgba(14,165,233,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingActivity ? 'Saving…' : activityEditor.activity.itemId ? 'Save changes' : 'Add activity'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
