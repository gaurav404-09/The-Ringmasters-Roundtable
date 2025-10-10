import React, { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Sparkles, Bot, MapPin, CalendarRange, Route, Share2 } from 'lucide-react';
import ENV from '../config/env';
import { useAuth } from '../context/AuthContext';
import { saveUserTrip } from '../lib/apiClient';

const parseLogEntry = (entry, index) => {
  if (!entry) {
    return {
      id: index,
      actor: 'Orchestrator',
      message: 'Awaiting updates…',
    };
  }

  const delimiterIndex = entry.indexOf(':');
  if (delimiterIndex === -1) {
    return {
      id: index,
      actor: 'Orchestrator',
      message: entry.trim(),
    };
  }

  const actor = entry.slice(0, delimiterIndex).trim();
  const message = entry.slice(delimiterIndex + 1).trim();

  return {
    id: index,
    actor: actor || 'Orchestrator',
    message: message || entry.trim(),
  };
};

const getUniqueCities = (itinerary = []) => {
  const seen = new Set();
  const cities = [];

  itinerary.forEach(({ city }) => {
    if (city && !seen.has(city)) {
      seen.add(city);
      cities.push(city);
    }
  });

  return cities;
};

const countEvents = (events = {}) => {
  return Object.values(events).reduce((total, cityEvents) => total + (cityEvents?.length || 0), 0);
};

const toDateInputValue = (date) => date.toISOString().split('T')[0];

const addDays = (date, amount) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};

const parseISODate = (isoString) => {
  if (!isoString) {
    return null;
  }

  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const calculateDaySpan = (startIso, endIso) => {
  if (!startIso || !endIso) return 1;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 1;
  }
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diffDays + 1;
};

const ResultSummary = ({ result, onReset }) => {
  const totalDays = result?.itinerary?.length || 0;
  const cities = useMemo(() => getUniqueCities(result?.itinerary || []), [result]);
  const totalEvents = useMemo(() => countEvents(result?.events || {}), [result]);

  const summaryCards = [
    {
      icon: <CalendarRange className="h-6 w-6 text-cyan-300" />,
      label: 'Days orchestrated',
      value: totalDays,
      hint: 'Daily flow tailored with weather-aware pacing.',
    },
    {
      icon: <MapPin className="h-6 w-6 text-violet-300" />,
      label: 'Cities in spotlight',
      value: cities.length,
      hint: cities.join(' · ') || 'Awaiting destination insight.',
    },
    {
      icon: <Share2 className="h-6 w-6 text-amber-300" />,
      label: 'Unique events surfaced',
      value: totalEvents,
      hint: totalEvents ? 'Perfect for collaborative planning.' : 'No live events aligned for these dates.',
    },
  ];

  return (
    <section className="mt-12 space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_25px_65px_rgba(15,23,42,0.45)] backdrop-blur">
        <div className="flex flex-col gap-6 text-center sm:text-left">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">
              Agent collective report
            </span>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
              Your itinerary is staged and ready to wow the crowd.
            </h2>
            <p className="mt-3 text-sm text-white/70 sm:text-base">
              The orchestrator synchronized weather, mapping, events, and itinerary agents to produce a cohesive tour plan.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
                <div className="flex items-center gap-3 text-white/80">
                  {card.icon}
                  <span className="text-xs uppercase tracking-[0.3em] text-white/50">{card.label}</span>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">{card.value}</p>
                <p className="mt-2 text-xs text-white/60">{card.hint}</p>
              </div>
            ))}
          </div>

          <button
            onClick={onReset}
            className="self-center rounded-full border border-white/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white/80 transition hover:border-white/35 hover:text-white sm:self-end"
          >
            Plan another trip
          </button>
        </div>
      </div>
    </section>
  );
};

const ItineraryShowcase = ({ result }) => {
  if (!result?.itinerary?.length) {
    return null;
  }

  return (
    <section className="mt-10 space-y-6">
      {result.itinerary.map((day, index) => {
        const localEvents = result.events?.[day.city] || [];

        return (
          <div
            key={index}
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/[0.02] p-6 shadow-[0_25px_60px_rgba(15,23,42,0.4)] backdrop-blur"
          >
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs uppercase tracking-[0.4em] text-white/50">Day {day.day}</span>
                <h3 className="mt-2 text-2xl font-semibold text-white">{day.city}</h3>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
                {day.weather?.temp}°C · {day.weather?.weather}
              </span>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">Curated activities</h4>
                <ul className="mt-4 space-y-4">
                  {day.activities.map((activity, activityIndex) => (
                    <li key={activityIndex} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-start sm:gap-5">
                      <span className="w-full rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200 sm:w-32">
                        {activity.time}
                      </span>
                      <div className="flex-1">
                        <p className="text-base font-semibold text-white">{activity.title}</p>
                        <p className="mt-1 text-sm text-white/70">{activity.notes}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">Live local events</h4>
                {localEvents.length ? (
                  <ul className="space-y-4">
                    {localEvents.map((event, eventIndex) => (
                      <li key={eventIndex} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                        {event.imageUrl && (
                          <img
                            src={event.imageUrl}
                            alt={event.title}
                            className="hidden h-20 w-28 rounded-xl object-cover sm:block"
                          />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-white">{event.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-white/60">
                            {event.location} · {event.date}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm text-white/60">
                    No aligned events were found for this day, but your itinerary remains performance-ready.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
};

const AgentLogPanel = ({ logs }) => {
  if (!logs?.length) {
    return null;
  }

  return (
    <section className="mt-12">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_20px_55px_rgba(15,23,42,0.45)] backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-emerald-300" />
            <h3 className="text-lg font-semibold text-white">Orchestrator timeline</h3>
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">
            {logs.length} status updates
          </span>
        </div>

        <div className="mt-6">
          <ol className="relative space-y-5">
            {logs.map((rawLog, index) => {
              const { actor, message } = parseLogEntry(rawLog, index);
              const isFinal = index === logs.length - 1;

              return (
                <li key={`${actor}-${index}`} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {!isFinal && <span className="mt-2 h-full w-px flex-1 bg-gradient-to-b from-white/30 to-transparent" />}
                  </div>
                  <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">{actor}</p>
                    <p className="mt-2 leading-relaxed text-white/80">{message}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
};

const PlanTrip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [from, setFrom] = useState('Delhi');
  const [to, setTo] = useState('Goa');
  const initialStart = useMemo(() => toDateInputValue(addDays(new Date(), -1)), []);
  const initialEnd = useMemo(() => toDateInputValue(addDays(new Date(), 3)), []);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [days, setDays] = useState(() => calculateDaySpan(initialStart, initialEnd));
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedTripId, setSavedTripId] = useState(null);

  useEffect(() => {
    const socketUrl = ENV.WS_URL;
    const newSocket = io(socketUrl, {
      path: '/socket.io/',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      transports: ['polling', 'websocket'],
      upgrade: true,
      secure: false,
      rejectUnauthorized: false,
    });

    setSocket(newSocket);

    newSocket.on('connect_error', (error) => {
      setLogs((prev) => [...prev, `Connection error: ${error.message}`]);
    });

    newSocket.on('status_update', (data) => {
      if (data?.message) {
        setLogs((prevLogs) => [...prevLogs, data.message]);
      }
    });

    newSocket.on('trip_result', (data) => {
      setResult(data);
      setLogs((prev) => [...prev, 'Orchestrator delivered the final itinerary.']);
      setLoading(false);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    const span = calculateDaySpan(startDate, endDate);
    setDays(span);
  }, [startDate, endDate]);

  const updateEndDateForDays = (startIso, dayCount) => {
    const start = parseISODate(startIso);
    if (!start || !Number.isFinite(dayCount) || dayCount < 1) {
      return;
    }
    const adjusted = toDateInputValue(addDays(start, Math.max(0, dayCount - 1)));
    setEndDate(adjusted);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!socket) {
      alert('Backend server is not connected.');
      return;
    }

    setLoading(true);
    setSavedTripId(null);
    setResult(null);
    setLogs([]);

    socket.emit('plan_trip', {
      start_city: from,
      end_city: to,
      start_date: startDate,
      end_date: endDate,
      num_days: days,
    });
  };

  const resetPlanner = () => {
    setResult(null);
    setLoading(false);
    setLogs([]);
    setSavedTripId(null);
  };

  const handleSaveTrip = async () => {
    if (!result) {
      toast.error('Generate an itinerary before saving.');
      return;
    }

    if (!user?.uid) {
      toast.error('Your session expired. Please sign in again.');
      navigate('/auth', { state: { from: '/planner' } });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: `${from} → ${to}`,
        startCity: from,
        endCity: to,
        numDays: days,
        startDate,
        endDate,
        requestedAt: new Date().toISOString(),
        orchestrationLogs: logs,
        result,
      };

      const response = await saveUserTrip(user.uid, payload);
      if (!response?.success || !response?.trip) {
        throw new Error(response?.error || 'Failed to store trip');
      }

      setSavedTripId(response.trip.id || null);
      toast.success('Trip saved to your dashboard.');
    } catch (error) {
      console.error('Error saving trip:', error);
      toast.error(error?.message || 'Could not save trip. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_60%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(168,85,247,0.2),_transparent_60%)]" aria-hidden="true" />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                The Ringmaster's Roundtable · Agents
              </span>
              <h1 className="text-4xl font-black leading-tight sm:text-5xl">
                Plan cinematic trips with a full ensemble of specialized MCP agents.
              </h1>
              <p className="max-w-2xl text-sm text-white/70 sm:text-base">
                Tell the orchestrator where you want to perform next. Our weather, mapping, itinerary, and events agents exchange data live to build a travel plan that feels like a touring production.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_60px_rgba(15,23,42,0.45)] backdrop-blur">
              {loading ? (
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="h-14 w-14 animate-spin rounded-full border-2 border-white/20 border-t-emerald-300" />
                  <div>
                    <p className="text-base font-semibold text-white">Agents syncing in real time…</p>
                    <p className="mt-2 text-sm text-white/60">
                      The orchestrator is coordinating routes, forecasts, events, and daily flow. Grab coffee—this usually wraps in under a minute.
                    </p>
                  </div>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="grid gap-4 sm:grid-cols-5">
                    <div className="space-y-2 sm:col-span-2">
                      <label htmlFor="from" className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                        Starting city
                      </label>
                      <input
                        id="from"
                        value={from}
                        onChange={(event) => setFrom(event.target.value)}
                        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white shadow-[0_10px_25px_rgba(15,23,42,0.45)] outline-none transition focus:border-cyan-400/60 focus:bg-white/10"
                        placeholder="Delhi"
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label htmlFor="to" className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                        Finale destination
                      </label>
                      <input
                        id="to"
                        value={to}
                        onChange={(event) => setTo(event.target.value)}
                        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white shadow-[0_10px_25px_rgba(15,23,42,0.45)] outline-none transition focus:border-violet-400/60 focus:bg-white/10"
                        placeholder="Goa"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="days" className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                        Number of days
                      </label>
                      <input
                        id="days"
                        type="number"
                        value={days}
                        onChange={(event) => {
                          const next = Math.max(1, parseInt(event.target.value, 10) || 1);
                          setDays(next);
                          updateEndDateForDays(startDate, next);
                        }}
                        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white shadow-[0_10px_25px_rgba(15,23,42,0.45)] outline-none transition focus:border-emerald-400/60 focus:bg-white/10"
                        min="1"
                        max="30"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="start-date" className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                        Departure date
                      </label>
                      <input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(event) => {
                          const value = event.target.value;
                          setStartDate(value);
                          updateEndDateForDays(value, days);
                        }}
                        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white shadow-[0_10px_25px_rgba(15,23,42,0.45)] outline-none transition focus:border-emerald-400/60 focus:bg-white/10"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="end-date" className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                        Return date
                      </label>
                      <input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white shadow-[0_10px_25px_rgba(15,23,42,0.45)] outline-none transition focus:border-emerald-400/60 focus:bg-white/10"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-white shadow-[0_22px_60px_rgba(14,165,233,0.45)] transition hover:shadow-[0_26px_75px_rgba(14,165,233,0.5)]"
                  >
                    Launch the multi-agent ensemble
                  </button>
                </form>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3 text-white/80">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                  <span className="text-xs uppercase tracking-[0.35em] text-white/50">AI ensemble</span>
                </div>
                <p className="mt-3 text-sm text-white/70">
                  Weather, itinerary, mapping, and events agents share data via the orchestrator for a cohesive flow.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3 text-white/80">
                  <Route className="h-5 w-5 text-cyan-300" />
                  <span className="text-xs uppercase tracking-[0.35em] text-white/50">Smart routing</span>
                </div>
                <p className="mt-3 text-sm text-white/70">
                  Each day blends travel pacing with weather-adaptive activities and optional event spotlights.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3 text-white/80">
                  <MapPin className="h-5 w-5 text-violet-300" />
                  <span className="text-xs uppercase tracking-[0.35em] text-white/50">Share-ready</span>
                </div>
                <p className="mt-3 text-sm text-white/70">
                  Exportable cards make it easy to brief stakeholders or rally friends around the chosen cities.
                </p>
              </div>
            </div>
          </div>

          <div className="hidden flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_25px_60px_rgba(15,23,42,0.45)] backdrop-blur lg:flex">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60">
                Need inspiration?
              </span>
              <p className="text-lg font-semibold text-white">
                Try these launch pads:
              </p>
            </div>
            <ul className="space-y-4 text-sm text-white/70">
              <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Pair a coastal headline act with an urban encore. Ex: "Lisbon" to "Barcelona" over 5 nights.
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Explore climate extremes for resilient planning. Ex: "Reykjavík" to "Dubai" in 7 days.
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Keep it local and event-heavy. Ex: "Austin" to "New Orleans" with festival scouting.
              </li>
            </ul>
          </div>
        </section>

        <AgentLogPanel logs={logs} />

        {result && (
          <>
            <div className="mt-10 flex flex-col items-start gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_20px_55px_rgba(15,23,42,0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Itinerary ready to save</h2>
                <p className="mt-1 text-sm text-white/70">
                  Store this run in your dashboard to revisit, duplicate, or share with collaborators.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {savedTripId ? (
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="inline-flex items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400/20 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-100 shadow-[0_18px_45px_rgba(52,211,153,0.25)] transition hover:bg-emerald-400/30"
                  >
                    View in dashboard
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveTrip}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white shadow-[0_22px_55px_rgba(14,165,233,0.4)] transition hover:shadow-[0_26px_70px_rgba(14,165,233,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save to dashboard'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetPlanner}
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40 hover:text-white"
                >
                  Plan another
                </button>
              </div>
            </div>

            <ResultSummary result={result} onReset={resetPlanner} />
            <ItineraryShowcase result={result} />
          </>
        )}
      </main>
    </div>
  );
};

export default PlanTrip;

