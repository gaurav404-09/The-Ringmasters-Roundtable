import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import AutocompleteInput from "../components/AutocompleteInput";
import MapView from "../components/MapView";
import ENV from "../config/env";
import {
  FaRoute,
  FaWalking,
  FaCar,
  FaBicycle,
  FaMapMarkerAlt,
  FaSearchLocation,
  FaClock,
  FaRoad,
  FaDirections,
} from "react-icons/fa";

const { API_BASE_URL, ORS_API_KEY } = ENV;

const normalizeLocation = (value) => {
  if (!value) return "";
  const trimmed = value.trim();
  const coordinateMatches = trimmed.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g);
  if (coordinateMatches && coordinateMatches.length > 0) {
    const lastMatch = coordinateMatches[coordinateMatches.length - 1];
    const [latPart, lonPart] = lastMatch.split(",");
    return `${latPart.trim()},${lonPart.trim()}`;
  }
  return trimmed;
};

const MODE_CONFIG = {
  driving: {
    label: "Drive",
    description: "Fastest roads and highways",
    icon: FaCar,
    iconColors: { idle: "text-amber-200", active: "text-white" },
    trailGradient: "from-amber-200/70 via-white/40 to-transparent",
    animation: {
      animate: { x: [0, 5, 0], rotate: [0, -2, 0] },
      transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
    },
  },
  walking: {
    label: "Walk",
    description: "Foot-friendly strolls",
    icon: FaWalking,
    iconColors: { idle: "text-emerald-200", active: "text-white" },
    trailGradient: "from-emerald-200/70 via-white/40 to-transparent",
    animation: {
      animate: { y: [0, -6, 0] },
      transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
    },
  },
  cycling: {
    label: "Cycle",
    description: "Scenic two-wheel rides",
    icon: FaBicycle,
    iconColors: { idle: "text-sky-200", active: "text-white" },
    trailGradient: "from-sky-200/70 via-white/40 to-transparent",
    animation: {
      animate: { rotate: [0, 8, -8, 0] },
      transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
    },
  },
};

const HIGHLIGHT_VARIANTS = [
  "bg-gradient-to-br from-white/25 via-white/10 to-transparent border border-white/40",
  "bg-gradient-to-br from-emerald-400/25 via-white/10 to-transparent border border-emerald-200/40",
  "bg-gradient-to-br from-sky-400/25 via-white/10 to-transparent border border-sky-200/40",
];

const TRAVEL_TIPS = [
  {
    title: "Beat Traffic",
    body: "Depart before 7 AM to glide through the city with minimal congestion.",
    accent: "from-amber-200/80 via-white/30 to-transparent",
    icon: <FaCar className="text-lg" />,
  },
  {
    title: "Stretch Breaks",
    body: "Plan a 10 minute stop every two hours to refresh and refocus.",
    accent: "from-emerald-200/70 via-white/30 to-transparent",
    icon: <FaWalking className="text-lg" />,
  },
  {
    title: "Offline Backup",
    body: "Download your route for offline access before you lose connectivity.",
    accent: "from-sky-200/70 via-white/30 to-transparent",
    icon: <FaDirections className="text-lg" />,
  },
];

const RoutesPage = () => {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [travelMode, setTravelMode] = useState("driving");
  const [route, setRoute] = useState(null);
  const [routesData, setRoutesData] = useState(null);
  const [comparedRoutes, setComparedRoutes] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [modeAnimating, setModeAnimating] = useState(null);
  const [popularDestinations] = useState([
    "Mumbai, India",
    "Delhi, India",
    "Bangalore, India",
    "Hyderabad, India",
    "Chennai, India",
    "Kolkata, India",
    "Pune, India",
    "Jaipur, India",
  ]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [autoSearchPending, setAutoSearchPending] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);
  const [originOverride, setOriginOverride] = useState(null);
  const [destinationOverride, setDestinationOverride] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (initialLoad && location.state) {
      const { from, to } = location.state;
      if (from) setOrigin(from);
      if (to) setDestination(to);
      setInitialLoad(false);
    }
  }, [location.state, initialLoad]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const originParam = params.get("origin");
    const destinationParam = params.get("destination");
    const labelParam = params.get("label");
    const modeParam = params.get("mode");

    if (!originParam && !destinationParam && !labelParam && !modeParam) {
      return;
    }

    if (originParam) {
      setOrigin(`Current location (${originParam})`);
      setOriginOverride(originParam);
    }

    if (destinationParam) {
      setDestination(labelParam ? `${labelParam} (${destinationParam})` : destinationParam);
      setDestinationOverride(destinationParam);
    }

    if (modeParam && MODE_CONFIG[modeParam]) {
      setTravelMode(modeParam);
      setPendingMode(modeParam);
    } else {
      setPendingMode(null);
    }

    setAutoSearchPending(true);
    setInitialLoad(false);
  }, [location.search]);

  const formatDistance = (distance) => {
    if (distance === undefined || distance === null) return "N/A";
    const num = Number(distance);
    if (Number.isNaN(num)) return "N/A";
    return `${num.toFixed(1)} km`;
  };

  const formatDuration = (seconds) => {
    if (seconds === undefined || seconds === null) return "N/A";
    const total = Number(seconds);
    if (Number.isNaN(total)) return "N/A";
    const hrs = Math.floor(total / 3600);
    const mins = Math.round((total % 3600) / 60);
    return hrs > 0 ? `${hrs} hr ${mins} mins` : `${mins} mins`;
  };

  const getTransportIcon = (mode) => {
    switch (mode) {
      case "walking":
        return <FaWalking className="text-2xl" />;
      case "driving":
        return <FaCar className="text-2xl" />;
      case "cycling":
        return <FaBicycle className="text-2xl" />;
      default:
        return <FaRoute className="text-2xl" />;
    }
  };

  const fetchRoute = useCallback(
    async (mode, originValue, destinationValue) => {
      const originParam = normalizeLocation(originValue ?? origin);
      const destinationParam = normalizeLocation(destinationValue ?? destination);

      if (!originParam || !destinationParam) {
        throw new Error("Origin and destination are required for route search");
      }

      const params = new URLSearchParams({
        origin: originParam,
        destination: destinationParam,
        mode,
      });

      const res = await fetch(`${API_BASE_URL}/api/directions?${params}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": ORS_API_KEY,
        },
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (!data || !data.geometry?.coordinates || data.geometry.coordinates.length < 2) {
        throw new Error(`No valid ${mode} route could be calculated`);
      }

      const coords = data.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      const distance = data.distance || 0;
      const duration = data.duration || 0;
      const steps = data.steps || data.properties?.segments?.[0]?.steps || [];

      return {
        ...data,
        coords,
        distance,
        duration,
        steps,
        mode,
      };
    },
    [origin, destination],
  );

  const performRouteSearch = useCallback(
    async (mode, overrides = {}) => {
      setError(null);
      setLoading(true);

      try {
        const data = await fetchRoute(mode, overrides.origin ?? originOverride ?? origin, overrides.destination ?? destinationOverride ?? destination);
        setRoute({
          distance: data.distance,
          duration: data.duration,
          steps: data.steps || [],
          coords: data.coords,
          mode: data.mode,
        });
        setRoutesData([data]);
        return true;
      } catch (err) {
        console.error("Error fetching directions:", err);
        setError(err.message || "Error fetching directions. Please try again later.");
        setRoute(null);
        setRoutesData(null);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchRoute, originOverride, destinationOverride, origin, destination],
  );

  const handleSearch = async (event) => {
    event.preventDefault();
    const normalizedOrigin = normalizeLocation(origin);
    const normalizedDestination = normalizeLocation(destination);

    if (!normalizedOrigin || !normalizedDestination) {
      setError("Please enter both origin and destination");
      return;
    }

    await performRouteSearch(travelMode, {
      origin: normalizedOrigin,
      destination: normalizedDestination,
    });
  };

  const toggleComparison = async () => {
    const nextShowComparison = !showComparison;

    if (nextShowComparison && origin && destination) {
      setLoading(true);
      try {
        const normalizedOrigin = normalizeLocation(origin);
        const normalizedDestination = normalizeLocation(destination);
        if (!normalizedOrigin || !normalizedDestination) {
          throw new Error("Please enter both origin and destination");
        }
        const modes = ["driving", "walking", "cycling"];
        const results = await Promise.all(
          modes.map((mode) =>
            fetchRoute(mode, normalizedOrigin, normalizedDestination).catch((err) => {
              console.error(`Error fetching ${mode} route:`, err);
              return null;
            }),
          ),
        );

        const validResults = results.filter(Boolean);
        if (validResults.length === 0) {
          throw new Error("Could not calculate any routes for comparison");
        }

        const mainRoute = validResults[0];
        setRoute({
          distance: mainRoute.properties?.distance || mainRoute.distance,
          duration: mainRoute.properties?.duration || mainRoute.duration,
          steps: mainRoute.steps || [],
          coords: mainRoute.coords,
          mode: mainRoute.mode,
        });

        setRoutesData(validResults);
        setComparedRoutes(validResults);
        setShowComparison(true);
      } catch (err) {
        console.error("Error in comparison:", err);
        setError(err.message || "Error comparing routes. Please try again.");
        setShowComparison(false);
      } finally {
        setLoading(false);
      }
    } else {
      setShowComparison(false);

      if (routesData && routesData.length > 0) {
        const mainRoute = routesData.find((r) => r.mode === travelMode) || routesData[0];
        if (mainRoute) {
          setRoute({
            distance: mainRoute.properties?.distance || mainRoute.distance,
            duration: mainRoute.properties?.duration || mainRoute.duration,
            steps: mainRoute.steps || [],
            coords: mainRoute.coords,
            mode: mainRoute.mode,
          });
        }
      }
    }
  };

  useEffect(() => {
    if (!autoSearchPending) return;

    const runAutoSearch = async () => {
      const modeToUse = pendingMode || travelMode;
      const resolvedOrigin = originOverride ?? normalizeLocation(origin);
      const resolvedDestination = destinationOverride ?? normalizeLocation(destination);

      if (!resolvedOrigin || !resolvedDestination) {
        setAutoSearchPending(false);
        setPendingMode(null);
        return;
      }

      const success = await performRouteSearch(modeToUse, {
        origin: resolvedOrigin,
        destination: resolvedDestination,
      });

      if (success) {
        if (originOverride) {
          setOrigin(`Current location (${resolvedOrigin})`);
        }
        if (destinationOverride) {
          setDestination(destinationOverride);
        }
      }

      setOriginOverride(null);
      setDestinationOverride(null);
      setAutoSearchPending(false);
      setPendingMode(null);
    };

    runAutoSearch();
  }, [
    autoSearchPending,
    pendingMode,
    travelMode,
    performRouteSearch,
    originOverride,
    destinationOverride,
    origin,
    destination,
  ]);

  const activeModeConfig = MODE_CONFIG[travelMode];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.35),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.25),transparent_55%)]" />

      <div className="relative z-10 px-4 pb-24 pt-12 sm:px-8 lg:px-14 xl:px-20">
        <header>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-3xl shadow-[0_35px_60px_rgba(15,23,42,0.55)] md:flex-row md:items-center md:justify-between md:p-8"
          >
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Routes</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Trailblazer's Pathways
              </h1>
              <p className="mt-3 text-sm text-white/70">
                Craft cinematic journeys with instant route insights, multi-modal comparisons, and a crisp macOS-inspired experience.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {popularDestinations.slice(0, 5).map((city) => (
                  <button
                    key={city}
                    onClick={() => setDestination(city)}
                    className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            <motion.form
              onSubmit={handleSearch}
              className="flex w-full flex-col gap-4 rounded-[1.75rem] border border-white/15 bg-white/10 p-6 text-white backdrop-blur-3xl shadow-[0_25px_45px_rgba(15,23,42,0.45)]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center">
                    <FaMapMarkerAlt className="text-white/60" />
                  </div>
                  <AutocompleteInput
                    value={origin}
                    onChange={setOrigin}
                    placeholder="Where are you now?"
                    className="rounded-full border border-white/20 bg-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-white/50 focus:border-white/50 focus:ring-white/40"
                  />
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center">
                    <FaSearchLocation className="text-white/60" />
                  </div>
                  <AutocompleteInput
                    value={destination}
                    onChange={setDestination}
                    placeholder="Destination magic"
                    className="rounded-full border border-white/20 bg-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-white/50 focus:border-white/50 focus:ring-white/40"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                {Object.entries(MODE_CONFIG).map(([mode, config]) => {
                  const active = travelMode === mode && !showComparison;
                  return (
                    <motion.button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setTravelMode(mode);
                        setModeAnimating(mode);
                        setTimeout(() => setModeAnimating(null), 1200);
                      }}
                      disabled={showComparison}
                      whileTap={{ scale: 0.95, rotate: -1.5 }}
                      className={`group relative flex items-center gap-3 rounded-full border px-4 py-2.5 text-left text-sm transition-all duration-200 ${
                        active
                          ? "border-white/45 bg-white/80 text-slate-900 shadow-[0_22px_45px_rgba(255,255,255,0.45)]"
                          : "border-white/20 bg-white/10 text-white/80 hover:border-white/40 hover:text-white"
                      }`}
                      style={
                        active
                          ? {
                              backgroundImage:
                                "radial-gradient(circle at 10% 10%, rgba(255,255,255,0.9), rgba(255,255,255,0.2)), radial-gradient(circle at 80% 30%, rgba(148,163,184,0.4), rgba(255,255,255,0))",
                            }
                          : undefined
                      }
                    >
                      <span
                        className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full transition ${
                          active ? "bg-slate-900/90" : "bg-white/15"
                        }`}
                      >
                        <motion.span
                          className={`text-lg ${
                            active ? config.iconColors.active : config.iconColors.idle
                          }`}
                          animate={
                            active
                              ? config.animation.animate
                              : modeAnimating === mode
                              ? config.animation.animate
                              : undefined
                          }
                          transition={
                            active || modeAnimating === mode
                              ? config.animation.transition
                              : undefined
                          }
                          key={`${mode}-icon-${active ? "active" : modeAnimating === mode ? "pressed" : "idle"}`}
                        >
                          <config.icon />
                        </motion.span>
                        {active && (
                          <motion.span
                            className={`pointer-events-none absolute inset-x-1 bottom-1 h-1 rounded-full bg-gradient-to-r ${config.trailGradient}`}
                            initial={{ opacity: 0, scaleX: 0.4 }}
                            animate={{ opacity: [0.3, 0.8, 0.3], scaleX: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                          />
                        )}
                      </span>
                      <span className="flex flex-col">
                        <span className={`text-xs uppercase tracking-[0.35em] ${active ? "text-slate-900/70" : "text-white/60"}`}>
                          {config.label}
                        </span>
                        <span className={`text-[11px] ${active ? "text-slate-800/80" : "text-white/50"}`}>
                          {config.description}
                        </span>
                      </span>
                      {active && (
                        <motion.span
                          layoutId="mode-glow"
                          className="pointer-events-none absolute inset-0 rounded-full border border-white/60"
                          transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        />
                      )}
                    </motion.button>
                  );
                })}

                <div className="flex flex-1 flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={toggleComparison}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                      showComparison
                        ? "border-sky-200/60 bg-sky-400/80 text-slate-900 shadow-[0_16px_30px_rgba(56,189,248,0.35)]"
                        : "border-white/20 bg-white/10 text-white/80 hover:border-white/40 hover:text-white"
                    }`}
                  >
                    <FaDirections className="text-sm" />
                    {showComparison ? "Exit Comparison" : "Compare Routes"}
                  </button>
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-300 via-white to-white px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_18px_38px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5"
                    disabled={loading}
                  >
                    <FaRoute className="text-sm" />
                    {loading ? "Finding Routes" : "Find Route"}
                  </motion.button>
                </div>
              </div>
            </motion.form>
          </motion.div>
        </header>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mt-6 w-full max-w-6xl rounded-2xl border border-rose-300/40 bg-rose-500/20 px-4 py-3 text-sm text-rose-100"
          >
            {error}
          </motion.div>
        )}

        <main className="mx-auto mt-12 flex w-full max-w-7xl flex-col gap-10">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr]"
          >
            <div className="space-y-8">
              <div className="rounded-4xl border border-white/15 bg-white/10 p-6 backdrop-blur-3xl shadow-[0_30px_60px_rgba(15,23,42,0.55)]">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold uppercase tracking-[0.35em] text-white/60">Journey Canvas</h2>
                    <p className="mt-1 text-sm text-white/70">
                      Preview your curated route in realtime with ultra-clear cartography.
                    </p>
                  </div>
                  <div className="grid gap-3 rounded-3xl border border-white/15 bg-white/10 p-4 text-sm text-white/80 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                        <FaClock />
                      </span>
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-white/50">Duration</p>
                        <p className="text-sm font-semibold">
                          {route ? formatDuration(route.duration) : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                        <FaRoad />
                      </span>
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-white/50">Distance</p>
                        <p className="text-sm font-semibold">
                          {route ? formatDistance(route.distance) : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 h-[420px] overflow-hidden rounded-[2rem] border border-white/15">
                  <MapView routeCoords={route?.coords} origin={origin} destination={destination} />
                </div>
              </div>

              <AnimatePresence>
                {route && route.steps?.length > 0 && !showComparison && (
                  <motion.div
                    key="step-timeline"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ duration: 0.6 }}
                    className="rounded-4xl border border-white/15 bg-white/8 p-6 backdrop-blur-3xl shadow-[0_30px_60px_rgba(15,23,42,0.45)]"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-white/60">
                        Turn-by-turn Highlights
                      </h3>
                      <span className="text-xs text-white/50">{route.steps.length} segments</span>
                    </div>
                    <div className="mt-5 space-y-4">
                      {route.steps.slice(0, 6).map((step, index) => (
                        <motion.div
                          key={`${step.instruction}-${index}`}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05 }}
                          className={`relative overflow-hidden rounded-3xl px-4 py-4 ${
                            HIGHLIGHT_VARIANTS[index % HIGHLIGHT_VARIANTS.length]
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <p className="flex-1 text-white/85">{step.instruction || "Continue"}</p>
                            <div className="text-xs uppercase tracking-[0.3em] text-white/50">
                              {formatDistance(step.distance)} · {formatDuration(step.duration)}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                      {route.steps.length > 6 && (
                        <div className="text-xs text-white/55">
                          + {route.steps.length - 6} more manoeuvres in full trip summary
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-7">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="rounded-4xl border border-white/15 bg-white/10 p-6 backdrop-blur-3xl shadow-[0_30px_60px_rgba(15,23,42,0.45)]"
              >
                <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-white/60">
                  Route Snapshot
                </h3>
                <p className="mt-2 text-xs text-white/60">
                  A distilled summary of your journey metrics and travel health.
                </p>
                <div className="mt-5 grid gap-4">
                  <div className="flex items-center justify-between rounded-3xl border border-white/15 bg-white/8 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">Mode</span>
                    <span className="text-sm font-semibold uppercase tracking-[0.25em] text-white/80">
                      {route ? route.mode : travelMode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-3xl border border-white/15 bg-white/8 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">Origin</span>
                    <span className="max-w-[60%] truncate text-sm text-white/80">{origin || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-3xl border border-white/15 bg-white/8 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">Destination</span>
                    <span className="max-w-[60%] truncate text-sm text-white/80">{destination || "—"}</span>
                  </div>
                </div>
                {route && (
                  <button
                    onClick={() =>
                      navigate("/trip-summary", {
                        state: {
                          route: {
                            origin,
                            destination,
                            coords: route.coords,
                            distance: route.distance,
                            duration: route.duration,
                            steps: route.steps,
                          },
                        },
                      })
                    }
                    className="mt-6 w-full rounded-full border border-white/20 bg-white/90 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_35px_rgba(148,163,184,0.4)] transition hover:-translate-y-0.5"
                  >
                    Launch Full Trip Summary →
                  </button>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="rounded-4xl border border-white/15 bg-white/8 p-6 backdrop-blur-3xl shadow-[0_30px_60px_rgba(15,23,42,0.45)]"
              >
                <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-white/60">
                  Navigation Toolkit
                </h3>
                <div className="mt-4 space-y-4">
                  {TRAVEL_TIPS.map((tip) => (
                    <div
                      key={tip.title}
                      className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/6 p-4"
                    >
                      <div
                        className={`pointer-events-none absolute inset-0 opacity-60 bg-gradient-to-br ${tip.accent}`}
                      />
                      <div className="relative flex items-start gap-3">
                        <div className="rounded-full bg-white/20 p-3 text-white">{tip.icon}</div>
                        <div>
                          <p className="font-semibold text-white">{tip.title}</p>
                          <p className="text-sm text-white/75">{tip.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.section>

          <AnimatePresence>
            {showComparison && comparedRoutes.length > 0 && (
              <motion.section
                key="comparison"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="rounded-4xl border border-white/15 bg-white/8 p-6 backdrop-blur-3xl shadow-[0_30px_60px_rgba(15,23,42,0.45)]"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-white/60">
                      Multimodal Comparison
                    </h3>
                    <p className="text-xs text-white/60">
                      Tap any route to focus it on the map and update the summary metrics.
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {comparedRoutes.map((r, index) => {
                    const active = route?.mode === r.mode;
                    const variant = HIGHLIGHT_VARIANTS[index % HIGHLIGHT_VARIANTS.length];
                    return (
                      <motion.button
                        key={r.mode}
                        onClick={() =>
                          setRoute({
                            distance: r.properties?.distance || r.distance,
                            duration: r.properties?.duration || r.duration,
                            steps: r.steps || [],
                            coords: r.coords,
                            mode: r.mode,
                          })
                        }
                        whileHover={{ y: -6 }}
                        className={`text-left rounded-3xl px-5 py-5 transition ${variant} ${
                          active ? "shadow-[0_25px_50px_rgba(56,189,248,0.45)]" : "shadow-[0_18px_35px_rgba(15,23,42,0.35)]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {r.mode === "driving"
                                ? "By Car"
                                : r.mode === "walking"
                                ? "Walking"
                                : "By Bicycle"}
                            </p>
                            <p className="text-xs text-white/60">Direct + recommended</p>
                          </div>
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
                            {getTransportIcon(r.mode)}
                          </span>
                        </div>
                        <div className="mt-4 flex justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                          <span>{formatDuration(r.duration)}</span>
                          <span>{formatDistance(r.distance)}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!showComparison && routesData?.length > 1 && (
              <motion.section
                key="alternatives"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="rounded-4xl border border-white/15 bg-white/8 p-6 backdrop-blur-3xl shadow-[0_30px_60px_rgba(15,23,42,0.45)]"
              >
                <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-white/60">
                  Alternative Segments
                </h3>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {routesData.slice(1).map((altRoute, index) => (
                    <div
                      key={index}
                      className={`rounded-3xl border border-white/15 bg-white/10 p-4 shadow-[0_18px_35px_rgba(15,23,42,0.35)] ${
                        HIGHLIGHT_VARIANTS[index % HIGHLIGHT_VARIANTS.length]
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">Alt {index + 1}</p>
                        <span className="text-xs uppercase tracking-[0.3em] text-white/50">{altRoute.mode}</span>
                      </div>
                      <div className="mt-3 flex justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                        <span>{formatDuration(altRoute.duration)}</span>
                        <span>{formatDistance(altRoute.distance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default RoutesPage;
