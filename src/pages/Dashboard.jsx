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
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiTrendingUp,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { deleteUserTrip, fetchUserTrips, confirmTripItem } from '../lib/apiClient';
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

const Dashboard = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingItemId, setConfirmingItemId] = useState(null);
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
    const totalDays = trips.reduce((acc, trip) => acc + (fallbackItinerary(trip).length || trip.numDays || 0), 0);
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

  const getActivityStatusStyles = (activity) => {
    if (activity?.status === 'confirmed') {
      return {
        badge: 'bg-emerald-400 text-slate-900',
        card: 'border-emerald-300/80 bg-emerald-300/15 text-emerald-100',
        icon: 'text-emerald-300',
      };
    }
    return {
      badge: 'bg-white/15 text-white/70',
      card: 'border-white/10 bg-white/5 text-white/80',
      icon: 'text-white/70',
    };
  };

  const handleDeleteTrip = async (tripId) => {
    if (!user?.uid) return;
    const confirmed = window.confirm('Remove this saved trip from your dashboard?');
    if (!confirmed) return;
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

  const displayName = user?.displayName || user?.email || 'traveler';

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_60%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(124,58,237,0.22),_transparent_65%)]" aria-hidden="true" />

      <main className="relative mx-auto max-w-7xl px-6 pb-24 pt-24 sm:px-8 lg:px-12">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="overflow-hidden rounded-4xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 p-10 shadow-[0_28px_70px_rgba(15,118,133,0.35)]"
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
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5/95 p-5 backdrop-blur transition hover:-translate-y-1 hover:border-white/30"
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
              transition={{ duration: 0.4, ease: 'easeOut' }}
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

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <section className="space-y-6">
            <div className="flex items-center justify_between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">Saved itineraries</h2>
                <p className="text-sm text-white/60">Replay multi-agent runs, duplicate winning acts, or prune unused drafts.</p>
              </div>
            </div>

            {loadingTrips ? (
              <div className="space-y-4">
                {[1, 2].map((placeholder) => (
                  <div key={placeholder} className="animate-pulse rounded-3xl border border-white/10 bg-white/5 p-6">
                    <div className="h-5 w-40 rounded bg-white/20" />
                    <div className="mt-4 h-3 w-full rounded bg-white/10" />
                    <div className="mt-2 h-3 w-2/3 rounded bg-white/10" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-rose-400/50 bg-rose-500/10 p-6 text-sm text-rose-100">
                {error}
              </div>
            ) : trips.length === 0 ? (
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
            ) : (
              <div className="space-y-6">
                {trips.map((trip) => {
                  const itinerary = fallbackItinerary(trip);
                  const primaryCities = extractCities(trip);
                  const dayCount = itinerary.length || trip.numDays || 0;
                  const lastUpdated = trip.updatedAt || trip.createdAt;

                  return (
                    <motion.div
                      key={trip.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_22px_55px_rgba(15,23,42,0.4)] backdrop-blur"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <h3 className="text-xl font-semibold text-white">{trip.title || `${trip.startCity} → ${trip.endCity}`}</h3>
                          <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                            Saved {formatRelativeTime(lastUpdated)} • {primaryCities.length} cities • {dayCount} days orchestrated
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-white/70">
                            {primaryCities.slice(0, 6).map((city) => (
                              <span key={city} className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                                {city}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteTrip(trip.id)}
                            className="inline-flex items-center justify-center rounded-full border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-rose-400/40 hover:text-rose-200"
                          >
                            <FiTrash2 className="mr-1 text-sm" />
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleTrip(trip.id)}
                            className="inline-flex items-center justify-center rounded-full border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white"
                          >
                            <FiChevronDown
                              className={`mr-1 text-sm transition ${expandedTripId === trip.id ? 'rotate-180' : ''}`}
                            />
                            Details
                          </button>
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {expandedTripId === trip.id && (
                          <motion.div
                            key="trip-details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="mt-5 space-y-6">
                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">Itinerary preview</p>
                                  <div className="mt-3 space-y-3 text-sm text-white/80">
                                    {itinerary.slice(0, 3).map((day, index) => (
                                      <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                        <p className="font-semibold">
                                          Day {day.day || index + 1}: {day.city || day.title || 'Exploration'}
                                        </p>
                                        {Array.isArray(day.activities) && day.activities.length > 0 ? (
                                          <ul className="mt-2 space-y-2 text-xs text-white/60">
                                            {day.activities.slice(0, 3).map((activity, idx) => {
                                              const activityWithId = {
                                                ...activity,
                                                itemId: activity?.itemId || `${day.id || day.day || index + 1}::${activity?.id || idx + 1}`,
                                              };
                                              const styles = getActivityStatusStyles(activityWithId);
                                              const booking = activityWithId.bookingDetails;
                                              const isConfirming = confirmingItemId === `${trip.id}:${activityWithId.itemId}`;

                                              return (
                                                <li
                                                  key={activityWithId.itemId}
                                                  className={`rounded-2xl border px-3 py-3 text-left transition ${styles.card}`}
                                                >
                                                  <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                      <span className={`inline-flex h-2 w-2 rounded-full ${styles.icon}`} />
                                                      <span className="font-semibold text-white">{activityWithId.title}</span>
                                                    </div>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] ${styles.badge}`}>
                                                      {activityWithId.status === 'confirmed' ? 'Confirmed' : 'Suggested'}
                                                    </span>
                                                  </div>
                                                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.3em] text-white/50">
                                                    {activityWithId.time && <span>{activityWithId.time}</span>}
                                                    {activityWithId.location && <span>{activityWithId.location}</span>}
                                                    {activityWithId.type && <span>{activityWithId.type}</span>}
                                                  </div>
                                                  {activityWithId.status === 'confirmed' && booking ? (
                                                    <div className="mt-2 rounded-xl border border-emerald-200/40 bg-emerald-300/10 p-2 text-[11px] text-emerald-50">
                                                      <p className="uppercase tracking-[0.35em] text-emerald-100/80">Booking details</p>
                                                      <div className="mt-1 space-y-1">
                                                        {booking.confirmationNumber && <p>Confirmation: {booking.confirmationNumber}</p>}
                                                        {booking.referenceCode && <p>Reference: {booking.referenceCode}</p>}
                                                        {booking.price && <p>Price: {booking.price}</p>}
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                      <p className="text-xs text-white/60">Lock this in when the traveler confirms.</p>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleConfirmItem(trip, activityWithId)}
                                                        disabled={isConfirming}
                                                        className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-100 transition hover:border-emerald-300/80 hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                                                      >
                                                        {isConfirming ? 'Locking…' : 'Confirm booking'}
                                                      </button>
                                                    </div>
                                                  )}
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        ) : (
                                          <p className="mt-2 text-xs text-white/60">No activity detail provided.</p>
                                        )}
                                      </div>
                                    ))}
                                    {itinerary.length > 3 && (
                                      <p className="text-xs text-white/60">+ {itinerary.length - 3} more day(s) stored in this itinerary.</p>
                                    )}
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">Agent timeline</p>
                                  <div className="mt-3 space-y-2 text-xs text-white/70">
                                    {(trip.orchestrationLogs || []).slice(-6).reverse().map((log, index) => (
                                      <div key={index} className="flex items-start gap-2">
                                        <span className="mt-0.5 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-emerald-300" />
                                        <span>{log}</span>
                                      </div>
                                    ))}
                                    {!trip.orchestrationLogs?.length && (
                                      <p className="text-white/50">No agent logs were captured for this run.</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {trip.result?.events && Object.keys(trip.result.events).length > 0 && (
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">Live events pinned</p>
                                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    {Object.entries(trip.result.events).slice(0, 4).map(([city, events]) => (
                                      <div key={city} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                                        <p className="text-sm font-semibold text-white">{city}</p>
                                        <p className="mt-1">{events.length} curated event(s)</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_55px_rgba(15,23,42,0.4)] backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Recent agent activity</h2>
                <span className="text-xs uppercase tracking-[0.35em] text-white/50">Live log</span>
              </div>
              <div className="mt-4 space-y-3 text-xs text-white/70">
                {activityFeed.length === 0 ? (
                  <p className="text-white/50">Save a trip to see orchestrator updates stream in right here.</p>
                ) : (
                  activityFeed.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-white/80">{entry.message}</p>
                      <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-white/50">
                        <span>{entry.tripTitle}</span>
                        <span>{formatRelativeTime(entry.timestamp)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <NearbyAttractions focus="mixed" limit={5} className="border-white/10 bg-white/5 shadow-[0_18px_45px_rgba(15,23,42,0.4)]" />

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70 shadow-[0_18px_45px_rgba(15,23,42,0.4)] backdrop-blur">
              <h3 className="text-lg font-semibold text-white">How to get more from the Roundtable</h3>
              <ul className="mt-3 space-y-3">
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-cyan-300" />
                  <span>Plan with the orchestrator at least once a week to keep agent models fresh and surface new events.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-cyan-300" />
                  <span>Use the comparison arena before presenting routes to your crew so you can defend every recommendation.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-cyan-300" />
                  <span>Leave notes in your saved trips – the next coordinator will see every insight you captured.</span>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
