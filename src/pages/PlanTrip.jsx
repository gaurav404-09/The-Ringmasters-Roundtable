import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Sparkles, Bot, User, MapPin, CalendarRange, Route, Share2, Send,
  Loader2, ChevronDown, ArrowRight,
} from 'lucide-react';
import ENV from '../config/env';
import { useAuth } from '../context/AuthContext';
import { useTripContext } from '../context/TripContext';
import { useSocket } from '../context/SocketContext';
import { saveUserTrip } from '../lib/apiClient';
import BudgetSummary from '../components/ui/BudgetSummary.jsx';

// ─── Utility helpers ──────────────────────────────────────────────────────────

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

const countEvents = (events = {}) =>
  Object.values(events).reduce((total, cityEvents) => total + (cityEvents?.length || 0), 0);

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Simple markdown renderer for bot messages.
 * Handles **bold**, *italic*, `code`, newlines, and - bullet lists.
 */
const renderMarkdown = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Replace **bold**
    let parts = line.split(/\*\*(.+?)\*\*/g).map((part, j) =>
      j % 2 === 1 ? <strong key={j} className="font-semibold text-white">{part}</strong> : part
    );
    // Replace *italic*
    parts = parts.flatMap((part, j) => {
      if (typeof part !== 'string') return [part];
      return part.split(/\*(.+?)\*/g).map((p, k) =>
        k % 2 === 1 ? <em key={`${j}-${k}`} className="italic text-white/90">{p}</em> : p
      );
    });
    // Bullet list item
    const isBullet = line.trimStart().startsWith('- ');
    return (
      <span key={i}>
        {isBullet && <span className="mr-1 text-emerald-400">•</span>}
        {parts}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
};

/**
 * A single chat bubble, styled differently for user vs bot messages.
 */
const ChatBubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/50">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {msg.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${
          isUser
            ? 'bg-gradient-to-br from-cyan-500 to-blue-600'
            : 'bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-400/30'
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-emerald-300" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-gradient-to-br from-cyan-600 to-blue-700 text-white shadow-[0_8px_24px_rgba(6,182,212,0.35)]'
            : 'rounded-bl-sm border border-white/10 bg-white/5 text-white/90 backdrop-blur'
        }`}
      >
        {isUser ? msg.text : renderMarkdown(msg.text)}
      </div>
    </div>
  );
};

/**
 * Animated typing indicator — shows rotating status phrases so it doesn't look frozen.
 */
const THINKING_PHRASES = [
  'Agent ensemble waking up…',
  'Weather scout checking forecasts…',
  'Budget quartermaster crunching fares…',
  'Route conductor mapping paths…',
  'Events radar scanning venues…',
  'Itinerary architect drafting days…',
  'Critic agent reviewing the plan…',
  'Almost ready — assembling your trip…',
];

const TypingIndicator = ({ planning }) => {
  const [phraseIndex, setPhraseIndex] = React.useState(0);

  React.useEffect(() => {
    if (!planning) return;
    const timer = setInterval(() => setPhraseIndex(i => (i + 1) % THINKING_PHRASES.length), 3500);
    return () => clearInterval(timer);
  }, [planning]);

  return (
    <div className="flex items-end gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-gradient-to-br from-emerald-500/30 to-teal-500/20">
        <Bot className="h-4 w-4 text-emerald-300" />
      </div>
      <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300" />
          </div>
          {planning && (
            <span className="text-[11px] text-emerald-300/80 transition-all duration-500">
              {THINKING_PHRASES[phraseIndex]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Floating agent log panel that appears during trip planning.
 */
const AgentLogPanel = ({ logs, visible, onClose, planning }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!visible || !containerRef.current) return;
    containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs, visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex max-w-sm flex-col gap-3 transition-all duration-500 ease-out">
      <div className="pointer-events-auto overflow-hidden rounded-[24px] border border-white/12 bg-slate-950/90 shadow-[0_32px_90px_rgba(15,118,255,0.4)] backdrop-blur-xl">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-400/15 via-cyan-400/8 to-indigo-500/8" />
          <header className="relative flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/20">
                {planning && <div className="absolute inset-0 animate-ping rounded-xl bg-emerald-400/30" />}
                <Bot className="relative h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Orchestrator relay</p>
                <p className="text-sm font-semibold text-white">
                  {planning ? 'Agents syncing…' : 'Mission log'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/60 transition hover:border-white/30 hover:text-white"
            >
              Close
            </button>
          </header>
        </div>

        <div className="border-t border-white/10">
          <div
            ref={containerRef}
            className="max-h-64 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20"
          >
            {logs?.length ? (
              <ol className="space-y-3">
                {logs.map((log, idx) => (
                  <li key={idx} className="text-xs text-white/80 leading-relaxed">
                    <span className="mr-2 text-emerald-400">›</span>{log}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                Awaiting orchestrator updates…
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-white/10 px-5 py-3">
          <div className="relative w-full overflow-hidden rounded-full bg-white/8">
            <div
              className={`h-1 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 transition-all duration-700 ${
                planning ? 'w-full animate-pulse' : 'w-2/5'
              }`}
            />
          </div>
        </footer>
      </div>
    </div>
  );
};

/**
 * Result summary cards shown after planning completes.
 */
const ResultSummary = ({ result, onReset, transportMode }) => {
  const totalDays = result?.itinerary?.length || 0;
  const cities = useMemo(() => getUniqueCities(result?.itinerary || []), [result]);
  const totalEvents = useMemo(() => countEvents(result?.events || {}), [result]);
  const effectiveMode = transportMode || result?.transport_mode || 'train_flight';
  const transportLabel = effectiveMode === 'driving' ? 'Driving' : 'Train / Flight';

  const cards = [
    {
      icon: <CalendarRange className="h-5 w-5 text-cyan-300" />,
      label: 'Days',
      value: totalDays,
      hint: 'Weather-aware daily flow',
    },
    {
      icon: <MapPin className="h-5 w-5 text-violet-300" />,
      label: 'Cities',
      value: cities.length,
      hint: cities.join(' · ') || 'Awaiting insight',
    },
    {
      icon: <Share2 className="h-5 w-5 text-amber-300" />,
      label: 'Events',
      value: totalEvents,
      hint: totalEvents ? 'Live events found' : 'No events for these dates',
    },
    {
      icon: <Route className="h-5 w-5 text-emerald-300" />,
      label: 'Mode',
      value: transportLabel,
      hint: effectiveMode === 'driving' ? 'Road trip pacing' : 'Budget agent active',
    },
  ];

  return (
    <section className="mt-10 space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_65px_rgba(15,23,42,0.45)] backdrop-blur">
        <div className="flex flex-col gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/60">
              Agent collective report
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Your itinerary is staged and ready.
            </h2>
            <p className="mt-2 text-sm text-white/60">
              The orchestrator coordinated weather, mapping, events, and AI-powered itinerary agents.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white/70">
                  {card.icon}
                  <span className="text-[10px] uppercase tracking-widest text-white/40">{card.label}</span>
                </div>
                <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                <p className="mt-1 text-[11px] text-white/50">{card.hint}</p>
              </div>
            ))}
          </div>

          <button
            onClick={onReset}
            className="self-start rounded-full border border-white/15 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-white/70 transition hover:border-white/35 hover:text-white"
          >
            Plan another trip
          </button>
        </div>
      </div>
    </section>
  );
};

/**
 * Full itinerary showcase — one card per day with activities and events.
 */
const ItineraryShowcase = ({ result, transportMode }) => {
  if (!result?.itinerary?.length) return null;

  const finalDestinationCity = result?.end_city || result?.itinerary?.[result.itinerary.length - 1]?.city;
  const effectiveMode = transportMode || result?.transport_mode || 'train_flight';
  const restrictEventsToDestination = effectiveMode === 'train_flight';
  const displayedDays = restrictEventsToDestination
    ? result.itinerary.filter((day) => day.city === finalDestinationCity)
    : result.itinerary;

  if (!displayedDays.length) return null;

  return (
    <section className="mt-8 space-y-5">
      {displayedDays.map((day, index) => {
        const eventsCity = restrictEventsToDestination ? finalDestinationCity : day.city;
        const localEvents = result.events?.[eventsCity] || [];
        const dayNumber = Number.isFinite(day.day) ? day.day : index + 1;

        return (
          <div
            key={index}
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-white/[0.02] p-6 shadow-[0_20px_55px_rgba(15,23,42,0.35)] backdrop-blur"
          >
            <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-white/40">
                  Day {dayNumber} {day.date ? `· ${day.date}` : ''}
                </span>
                <h3 className="mt-1 text-xl font-semibold text-white">{day.city}</h3>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                {day.weather?.available === false 
                  ? day.weather.weather 
                  : `${day.weather?.temp}°C · ${day.weather?.weather}`}
              </span>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Curated activities</h4>
                <ul className="mt-3 space-y-3">
                  {day.activities.map((activity, activityIndex) => (
                    <li key={activityIndex} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-start sm:gap-4">
                      <span className="w-full rounded-xl bg-white/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-cyan-200 sm:w-28 text-center">
                        {activity.time}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{activity.title}</p>
                        <p className="mt-1 text-xs text-white/60">{activity.notes}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Live local events</h4>
                {localEvents.length ? (
                  <ul className="space-y-3">
                    {localEvents.map((event, eventIndex) => (
                      <li key={eventIndex} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                        {event.imageUrl && (
                          <img
                            src={event.imageUrl}
                            alt={event.title}
                            className="hidden h-16 w-24 rounded-xl object-cover sm:block"
                          />
                        )}
                        <div>
                          <p className="text-xs font-semibold text-white">{event.title}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-white/50">
                            {event.location} · {event.date}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-xs text-white/50">
                    No aligned events found for this day.
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

// ─── Main PlanTrip Page ───────────────────────────────────────────────────────

const INITIAL_MESSAGES = [
  {
    role: 'bot',
    text: "Hi! I'm your AI Travel Concierge. Tell me where you'd like to go — I'll gather the details conversationally and then launch the full multi-agent ensemble to build your itinerary. Where are you planning to travel?",
  },
];

const PlanTrip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeTrip, setActiveTrip } = useTripContext();

  // Chat state
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const socket = useSocket();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Planning & result state
  const [planning, setPlanning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logPanelVisible, setLogPanelVisible] = useState(false);
  const [result, setResult] = useState(null);
  const [tripMeta, setTripMeta] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedTripId, setSavedTripId] = useState(null);
  const resultRef = useRef(null);

  // ── Socket.IO setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Connect error is managed globally now, but we can listen if needed.
    const handleConnectError = (error) => {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: `⚠️ Connection error: ${error.message}. Please refresh the page.` },
      ]);
    };
    
    // Chat reply from the LLM travel concierge
    const handleChatReply = (data) => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: 'bot', text: data.message }]);
    };
    
    // Live status updates during orchestration
    const handleStatusUpdate = (data) => {
      if (!data?.message) return;
      setLogs((prev) => {
        if (prev.includes(data.message)) return prev;
        return [...prev, data.message];
      });

      const isPlanningStart = data.stage === 'start';
      const isPlanningFailure = data.stage === 'error';

      if (isPlanningStart) {
        setPlanning(true);
        setLogPanelVisible(true);
      } else if (isPlanningFailure) {
        setPlanning(false);
        setMessages((prev) => [
          ...prev,
          { role: 'bot', text: '❌ Trip planning encountered an issue. Please try again.' },
        ]);
      }
    };
    
    // Final trip result received
    const handleTripResult = (data) => {
      setIsTyping(false);
      setPlanning(false);
      setResult(data);
      const meta = {
        from: data.start_city || data.startCity || '',
        to: data.end_city || data.endCity || '',
        startDate: data.start_date || data.startDate || '',
        endDate: data.end_date || data.endDate || '',
        numDays: data.num_days || data.numDays || 0,
        transportMode: data.transport_mode || data.transportMode || 'train_flight',
      };
      setTripMeta(meta);
      // ── Persist to global TripContext so all pages auto-populate ──
      setActiveTrip({
        origin: meta.from,
        destination: meta.to,
        departureDate: meta.startDate,
        days: meta.numDays,
        itinerary: data.itinerary || [],
        events: data.events || {},
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: `✅ Your itinerary is ready! I've planned ${data.itinerary?.length || 0} days — scroll down to explore your trip.`,
        },
      ]);
      // Auto-close log panel after a delay
      setTimeout(() => setLogPanelVisible(false), 3000);
      // Smooth scroll to results
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 500);
    };

    socket.on('connect_error', handleConnectError);
    socket.on('chat_reply', handleChatReply);
    socket.on('status_update', handleStatusUpdate);
    socket.on('trip_result', handleTripResult);

    return () => {
      socket.off('connect_error', handleConnectError);
      socket.off('chat_reply', handleChatReply);
      socket.off('status_update', handleStatusUpdate);
      socket.off('trip_result', handleTripResult);
    };
  }, [socket, setActiveTrip]);

  // ── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !socket) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setIsTyping(true);
    socket.emit('chat_message', { text });
    inputRef.current?.focus();
  };

  // ── Save trip ─────────────────────────────────────────────────────────────
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
        title: `${tripMeta.from} → ${tripMeta.to}`,
        startCity: tripMeta.from,
        endCity: tripMeta.to,
        numDays: tripMeta.numDays,
        startDate: tripMeta.startDate,
        endDate: tripMeta.endDate,
        transportMode: tripMeta.transportMode,
        requestedAt: new Date().toISOString(),
        orchestrationLogs: logs,
        result,
      };
      const response = await saveUserTrip(user.uid, payload);
      if (!response?.success || !response?.trip) throw new Error(response?.error || 'Failed to store trip');
      setSavedTripId(response.trip.id || null);
      toast.success('Trip saved to your dashboard.');
    } catch (error) {
      console.error('Error saving trip:', error);
      toast.error(error?.message || 'Could not save trip. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetPlanner = () => {
    setResult(null);
    setPlanning(false);
    setLogs([]);
    setSavedTripId(null);
    setMessages(INITIAL_MESSAGES);
    setTripMeta({});
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Ambient gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(6,182,212,0.18),_transparent_60%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.15),_transparent_60%)]" aria-hidden="true" />

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-10">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-8 space-y-3 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/60">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            The Ringmaster's Roundtable · AI Concierge
          </span>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            Plan your trip with AI
          </h1>
          <p className="mx-auto max-w-xl text-sm text-white/60 sm:text-base">
            Chat with the AI Travel Concierge. It will gather your preferences and then launch the full multi-agent ensemble — map, weather, RAG itinerary, events, budget, and critic — all in one pipeline.
          </p>
        </div>

        {/* ── Active trip context banner ───────────────────────────────── */}
        {activeTrip?.origin && activeTrip?.destination && !result && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/8 px-5 py-3">
            <div className="flex items-center gap-3 text-sm text-cyan-200">
              <MapPin className="h-4 w-4 text-cyan-400" />
              <span>Active trip: <strong>{activeTrip.origin}</strong> → <strong>{activeTrip.destination}</strong></span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[{ label: 'Weather', to: '/weather' }, { label: 'Events', to: '/events' }, { label: 'Budget', to: '/budget' }, { label: 'Routes', to: '/routes' }].map(({ label, to }) => (
                <Link key={to} to={to} className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-200 transition hover:bg-cyan-400/20">
                  {label} <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Chat container ────────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-[0_40px_120px_rgba(15,23,42,0.6)] backdrop-blur-2xl">

          {/* Chat header */}
          <div className="flex items-center gap-4 border-b border-white/10 bg-white/5 px-6 py-4">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/20">
              {planning && <div className="absolute inset-0 animate-ping rounded-2xl bg-emerald-400/25" />}
              <Bot className="relative h-5 w-5 text-emerald-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">AI Travel Concierge</p>
              <p className={`text-[11px] ${planning ? 'text-emerald-400' : 'text-white/40'}`}>
                {planning ? 'Agent ensemble running…' : 'Online · Powered by LangGraph + RAG'}
              </p>
            </div>
            {planning && (
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-300" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                  Planning
                </span>
              </div>
            )}
          </div>

          {/* Messages area */}
          <div className="flex h-[480px] flex-col gap-5 overflow-y-auto px-6 py-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/15">
            {messages.map((msg, idx) => (
              <ChatBubble key={idx} msg={msg} />
            ))}
            {isTyping && <TypingIndicator planning={planning} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-white/10 bg-white/5 px-4 py-4">
            <form id="chat-form" onSubmit={handleSend} className="flex items-center gap-3">
              <input
                ref={inputRef}
                id="chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={planning}
                placeholder={
                  planning
                    ? 'Agents are working on your trip…'
                    : 'Tell me about your trip (e.g. "I want to go from Delhi to Goa for 5 days")'
                }
                className="flex-1 rounded-2xl border border-white/12 bg-black/25 px-5 py-3 text-sm text-white placeholder-white/35 outline-none transition focus:border-cyan-500/60 focus:bg-black/35 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="submit"
                id="chat-send-btn"
                disabled={!input.trim() || !socket || planning}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_8px_24px_rgba(6,182,212,0.4)] transition hover:shadow-[0_8px_30px_rgba(6,182,212,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4 translate-x-0.5" />
              </button>
            </form>

            {/* Suggestion chips */}
            {!planning && !result && messages.length <= 2 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  'Delhi to Goa, 5 days by train',
                  'Mumbai to Jaipur, 3 days driving',
                  'Chennai to Mysore, 4 days, foodie trip',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/60 transition hover:border-white/25 hover:text-white/90"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Scroll nudge when result arrives ───────────────────────── */}
        {result && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => resultRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
            >
              View your itinerary
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Result section ──────────────────────────────────────────── */}
        {result && (
          <div ref={resultRef}>
            {/* Save / dashboard bar */}
            <div className="mt-10 flex flex-col items-start gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Itinerary ready to save</h2>
                <p className="mt-1 text-sm text-white/60">
                  Store this run in your dashboard to revisit, duplicate, or share.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {savedTripId ? (
                  <button
                    id="view-dashboard-btn"
                    onClick={() => navigate('/dashboard')}
                    className="inline-flex items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-400/15 px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-emerald-100 transition hover:bg-emerald-400/25"
                  >
                    View in dashboard
                  </button>
                ) : (
                  <button
                    id="save-trip-btn"
                    disabled={saving}
                    onClick={handleSaveTrip}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-white shadow-[0_18px_45px_rgba(14,165,233,0.4)] transition hover:shadow-[0_20px_55px_rgba(14,165,233,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save to dashboard'}
                  </button>
                )}
                <button
                  id="plan-another-btn"
                  onClick={resetPlanner}
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-white/75 transition hover:border-white/40 hover:text-white"
                >
                  Plan another
                </button>
              </div>
            </div>

            {/* Budget section */}
            {tripMeta.transportMode === 'driving' ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/60 backdrop-blur">
                The Budget Agent is skipped for driving adventures to keep things nimble.
              </div>
            ) : (
              result?.budget && (
                <section className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-100/80">
                        Budget Agent highlights
                      </span>
                      <h2 className="mt-2 text-lg font-semibold text-white">Cheapest picks for this route</h2>
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                      Updated {new Date(result.budget.fetched_at || Date.now()).toLocaleString()}
                    </div>
                  </div>
                  <BudgetSummary budget={result.budget} />
                  {result.budget.notes?.length ? (
                    <ul className="space-y-2 text-xs text-white/55">
                      {result.budget.notes.map((note, idx) => (
                        <li key={idx} className="rounded-xl border border-white/10 bg-white/8 px-4 py-2">
                          {note}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              )
            )}

            <ResultSummary result={result} onReset={resetPlanner} transportMode={tripMeta.transportMode} />
            <ItineraryShowcase result={result} transportMode={tripMeta.transportMode} />
          </div>
        )}
      </main>

      {/* Agent log floating panel */}
      <AgentLogPanel
        logs={logs}
        visible={logPanelVisible}
        planning={planning}
        onClose={() => setLogPanelVisible(false)}
      />
    </div>
  );
};

export default PlanTrip;
