import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  WiDaySunny,
  WiRain,
  WiCloudy,
  WiDayCloudy,
  WiThunderstorm,
  WiSnow,
  WiMoonAltWaningCrescent6,
  WiFog,
  WiStrongWind,
} from "react-icons/wi";

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

const WEATHER_THEMES = {
  Clear: {
    day: {
      gradient: "from-sky-300 via-sky-400 to-sky-600",
      overlay: "bg-sky-950/55",
      accent: "bg-white/20",
      text: "text-white",
      background:
        "https://images.unsplash.com/photo-1523805009345-7448845a9e53?auto=format&fit=crop&w=2400&q=80",
    },
    night: {
      gradient: "from-indigo-950 via-slate-950 to-black",
      overlay: "bg-black/70",
      accent: "bg-white/12",
      text: "text-slate-100",
      background:
        "https://images.unsplash.com/photo-1527489377706-5bf97e608852?auto=format&fit=crop&w=2400&q=80",
    },
  },
  Clouds: {
    day: {
      gradient: "from-slate-200 via-slate-300 to-slate-500",
      overlay: "bg-slate-900/60",
      accent: "bg-white/18",
      text: "text-slate-900",
      background:
        "https://images.unsplash.com/photo-1477840539360-4a1d23071036?auto=format&fit=crop&w=2400&q=80",
    },
    night: {
      gradient: "from-slate-700 via-slate-900 to-black",
      overlay: "bg-slate-900/70",
      accent: "bg-white/12",
      text: "text-slate-100",
      background:
        "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=2400&q=80",
    },
  },
  Rain: {
    day: {
      gradient: "from-blue-500 via-blue-600 to-slate-800",
      overlay: "bg-blue-950/70",
      accent: "bg-white/16",
      text: "text-blue-50",
      background:
        "https://images.unsplash.com/photo-1509610696553-9243a0f218e5?auto=format&fit=crop&w=2400&q=80",
    },
    night: {
      gradient: "from-slate-900 via-blue-900 to-black",
      overlay: "bg-blue-950/75",
      accent: "bg-white/12",
      text: "text-blue-100",
      background:
        "https://images.unsplash.com/photo-1526676537331-77419d8fcab3?auto=format&fit=crop&w=2400&q=80",
    },
  },
  Thunderstorm: {
    day: {
      gradient: "from-indigo-600 via-purple-700 to-slate-900",
      overlay: "bg-indigo-950/75",
      accent: "bg-white/18",
      text: "text-blue-50",
      background:
        "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=2400&q=80",
    },
    night: {
      gradient: "from-slate-950 via-purple-950 to-black",
      overlay: "bg-black/75",
      accent: "bg-white/12",
      text: "text-indigo-100",
      background:
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=2400&q=80",
    },
  },
  Snow: {
    day: {
      gradient: "from-blue-100 via-blue-200 to-indigo-300",
      overlay: "bg-blue-900/55",
      accent: "bg-white/30",
      text: "text-blue-900",
      background:
        "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=2400&q=80",
    },
    night: {
      gradient: "from-slate-200 via-slate-400 to-indigo-600",
      overlay: "bg-indigo-900/55",
      accent: "bg-white/20",
      text: "text-slate-900",
      background:
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2400&q=80",
    },
  },
  Mist: {
    day: {
      gradient: "from-slate-200 via-slate-300 to-slate-500",
      overlay: "bg-slate-900/55",
      accent: "bg-white/20",
      text: "text-slate-900",
      background:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=80",
    },
    night: {
      gradient: "from-slate-700 via-slate-800 to-black",
      overlay: "bg-black/60",
      accent: "bg-white/14",
      text: "text-slate-200",
      background:
        "https://images.unsplash.com/photo-1482192597420-4817fdd7e8b0?auto=format&fit=crop&w=2400&q=80",
    },
  },
};

const DEFAULT_THEME = WEATHER_THEMES.Clear.day;

const DAY_PARALLAX_ELEMENTS = [
  {
    id: "sun-halo",
    className:
      "pointer-events-none absolute -top-36 right-[-10%] h-[30rem] w-[30rem] rounded-full bg-gradient-to-br from-white/80 via-amber-200/60 to-amber-400/20 blur-3xl opacity-60 mix-blend-screen",
    animate: { rotate: [0, 18, -14, 0], scale: [1.04, 1.1, 1.02, 1.04] },
    transition: { duration: 36, repeat: Infinity, ease: "easeInOut" },
  },
  {
    id: "sun-aura",
    className:
      "pointer-events-none absolute top-20 left-[-18%] h-[20rem] w-[50%] rounded-[45%] bg-white/15 blur-3xl opacity-65",
    animate: { x: [0, 120, 0], opacity: [0.35, 0.65, 0.35] },
    transition: { duration: 42, repeat: Infinity, ease: "easeInOut" },
  },
  {
    id: "day-cloud",
    className:
      "pointer-events-none absolute bottom-[-20%] right-[2%] h-[16rem] w-[50%] rounded-[50%] bg-white/25 blur-3xl opacity-45",
    animate: { x: [0, -160, 0], y: [0, 24, 0] },
    transition: { duration: 50, repeat: Infinity, ease: "easeInOut" },
  },
];

const NIGHT_PARALLAX_ELEMENTS = [
  {
    id: "moon-halo",
    className:
      "pointer-events-none absolute top-10 right-16 h-[22rem] w-[22rem] rounded-full bg-gradient-to-br from-indigo-400/50 via-indigo-900/70 to-transparent blur-3xl opacity-75 mix-blend-screen",
    animate: { rotate: [0, -12, 16, 0], scale: [1, 1.08, 0.98, 1] },
    transition: { duration: 34, repeat: Infinity, ease: "easeInOut" },
  },
  {
    id: "night-mist",
    className:
      "pointer-events-none absolute bottom-[-14%] left-[-10%] h-[22rem] w-[65%] rounded-[55%] bg-slate-200/12 blur-3xl opacity-40",
    animate: { x: [0, 90, 0], opacity: [0.25, 0.5, 0.25] },
    transition: { duration: 38, repeat: Infinity, ease: "easeInOut" },
  },
];

const NIGHT_STARFIELD = [
  { id: "star-1", top: 14, left: 20, size: 0.45, duration: 6, delay: 0.6 },
  { id: "star-2", top: 32, left: 70, size: 0.35, duration: 6.4, delay: 1.2 },
  { id: "star-3", top: 20, left: 82, size: 0.4, duration: 5.6, delay: 0.2 },
  { id: "star-4", top: 46, left: 18, size: 0.32, duration: 7.2, delay: 1.8 },
  { id: "star-5", top: 52, left: 58, size: 0.36, duration: 6.8, delay: 1.1 },
  { id: "star-6", top: 64, left: 80, size: 0.3, duration: 7.4, delay: 0.4 },
  { id: "star-7", top: 38, left: 40, size: 0.28, duration: 6.2, delay: 1.6 },
];

const FORECAST_VARIANTS = [
  {
    card: "bg-gradient-to-br from-white/35 via-white/15 to-transparent border border-white/45",
    accent: "bg-white/70",
  },
  {
    card: "bg-gradient-to-br from-sky-400/25 via-white/10 to-transparent border border-sky-200/35",
    accent: "bg-sky-200/80",
  },
  {
    card: "bg-gradient-to-br from-indigo-400/30 via-white/10 to-transparent border border-indigo-200/40",
    accent: "bg-indigo-200/80",
  },
  {
    card: "bg-gradient-to-br from-amber-300/30 via-white/10 to-transparent border border-amber-200/40",
    accent: "bg-amber-200/80",
  },
  {
    card: "bg-gradient-to-br from-emerald-300/30 via-white/10 to-transparent border border-emerald-200/35",
    accent: "bg-emerald-200/80",
  },
];

const formatUnixTime = (unixSeconds, offsetSeconds = 0) => {
  if (!Number.isFinite(unixSeconds)) return "—";
  const local = new Date((unixSeconds + offsetSeconds) * 1000);
  return local.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const resolveThemeKey = (condition = "Clear") => {
  if (/thunder/i.test(condition)) return "Thunderstorm";
  if (/storm/i.test(condition)) return "Thunderstorm";
  if (/rain|shower/i.test(condition)) return "Rain";
  if (/drizzle/i.test(condition)) return "Rain";
  if (/snow|sleet/i.test(condition)) return "Snow";
  if (/mist|fog|haze|smoke/i.test(condition)) return "Mist";
  if (/cloud/i.test(condition)) return "Clouds";
  return "Clear";
};

const getWeatherIcon = (condition, isDaytime) => {
  const key = resolveThemeKey(condition);
  switch (key) {
    case "Thunderstorm":
      return <WiThunderstorm className="text-5xl text-indigo-200 drop-shadow" />;
    case "Rain":
      return <WiRain className="text-5xl text-blue-200 drop-shadow" />;
    case "Snow":
      return <WiSnow className="text-5xl text-white drop-shadow" />;
    case "Mist":
      return <WiFog className="text-5xl text-slate-200 drop-shadow" />;
    case "Clouds":
      return isDaytime ? (
        <WiDayCloudy className="text-5xl text-slate-200 drop-shadow" />
      ) : (
        <WiCloudy className="text-5xl text-slate-100 drop-shadow" />
      );
    default:
      return isDaytime ? (
        <WiDaySunny className="text-5xl text-amber-200 drop-shadow" />
      ) : (
        <WiMoonAltWaningCrescent6 className="text-5xl text-indigo-100 drop-shadow" />
      );
  }
};

const Weather = () => {
  const [query, setQuery] = useState("Delhi");
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [showClip, setShowClip] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const themeKey = useMemo(() => resolveThemeKey(current?.condition), [
    current?.condition,
  ]);

  const isDaytime = useMemo(() => {
    if (!current?.sunrise || !current?.sunset) return true;
    const now = current.time ?? Math.floor(Date.now() / 1000);
    return now >= current.sunrise && now < current.sunset;
  }, [current?.sunrise, current?.sunset, current?.time]);

  const activeTheme = useMemo(() => {
    const palette = WEATHER_THEMES[themeKey]?.[isDaytime ? "day" : "night"];
    return palette ?? DEFAULT_THEME;
  }, [themeKey, isDaytime]);

  const fetchWeather = async (location) => {
    if (!OPENWEATHER_API_KEY) {
      setError("Missing OpenWeather API key. Add VITE_OPENWEATHER_API_KEY to your env file.");
      return;
    }

    setLoading(true);
    setShowClip(true);
    setError(null);

    try {
      const [currentRes, forecastRes] = await Promise.all([
        fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
            location,
          )}&appid=${OPENWEATHER_API_KEY}&units=metric`,
        ),
        fetch(
          `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
            location,
          )}&appid=${OPENWEATHER_API_KEY}&units=metric`,
        ),
      ]);

      const currentData = await currentRes.json();
      if (currentData.cod !== 200) {
        throw new Error(currentData.message || "Unable to fetch current conditions");
      }

      const forecastData = await forecastRes.json();
      if (forecastData.cod !== "200") {
        throw new Error(forecastData.message || "Unable to fetch forecast");
      }

      const mappedCurrent = {
        location: `${currentData.name}, ${currentData.sys?.country ?? ""}`.trim(),
        temp: Math.round(currentData.main.temp),
        feelsLike: Math.round(currentData.main.feels_like),
        condition: currentData.weather?.[0]?.main ?? "Clear",
        description: currentData.weather?.[0]?.description ?? "",
        humidity: currentData.main.humidity,
        pressure: currentData.main.pressure,
        wind: currentData.wind.speed,
        sunrise: currentData.sys?.sunrise,
        sunset: currentData.sys?.sunset,
        visibility: currentData.visibility,
        time: currentData.dt,
        timezoneOffset: currentData.timezone,
      };

      const middayForecast = [];
      const seenDays = new Set();
      forecastData.list.forEach((entry) => {
        const date = new Date(entry.dt_txt);
        const dayKey = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!seenDays.has(dayKey) && date.getHours() === 12) {
          middayForecast.push({
            day: date.toLocaleDateString("en-US", { weekday: "short" }),
            dateLabel: dayKey,
            temp: Math.round(entry.main.temp),
            condition: entry.weather?.[0]?.main ?? "Clear",
            description: entry.weather?.[0]?.description ?? "",
            wind: entry.wind.speed,
            humidity: entry.main.humidity,
          });
          seenDays.add(dayKey);
        }
      });

      setCurrent(mappedCurrent);
      setForecast(middayForecast.slice(0, 5));
    } catch (err) {
      setError(err.message || "Something went wrong while fetching weather data");
      setCurrent(null);
      setForecast([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    fetchWeather(query.trim());
  };

  const heroIcon = getWeatherIcon(current?.condition, isDaytime);

  useEffect(() => {
    fetchWeather(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showClip) return;
    const timer = setTimeout(() => setShowClip(false), 2200);
    return () => clearTimeout(timer);
  }, [showClip]);

  return (
    <div className={`relative min-h-screen overflow-hidden ${activeTheme.text ?? "text-white"}`}>
      <motion.div
        key={activeTheme.background}
        initial={{ opacity: 0.4, scale: 1.08 }}
        animate={{
          opacity: [0.65, 1, 0.8],
          scale: [1.08, 1.12, 1.08],
          x: [-30, 20, -30],
          y: [-24, 16, -24],
        }}
        transition={{ duration: 48, ease: "easeInOut", repeat: Infinity, repeatDelay: 4 }}
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${activeTheme.background})`, backgroundSize: "120%" }}
      />

      <motion.div
        className={`absolute inset-0 bg-gradient-to-br ${activeTheme.gradient} opacity-90`}
        animate={{ backgroundPosition: ["0% 45%", "100% 55%", "0% 45%"], scale: [1.05, 1.1, 1.05] }}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
        style={{ backgroundSize: "240% 240%" }}
      />

      <motion.div
        className={`absolute inset-0 ${activeTheme.overlay} backdrop-blur-2xl`}
        animate={{ opacity: [0.55, 0.85, 0.55], x: [-18, 18, -18], y: [10, -8, 10] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />

      {isDaytime ? (
        <>
          {DAY_PARALLAX_ELEMENTS.map(({ id, className, animate, transition }) => (
            <motion.div key={id} className={className} animate={animate} transition={transition} />
          ))}
          <motion.div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white/0 mix-blend-screen"
            animate={{ opacity: [0.15, 0.35, 0.15], y: [0, -60, 0] }}
            transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : (
        <>
          {NIGHT_PARALLAX_ELEMENTS.map(({ id, className, animate, transition }) => (
            <motion.div key={id} className={className} animate={animate} transition={transition} />
          ))}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {NIGHT_STARFIELD.map(({ id, top, left, size, duration, delay }) => (
              <motion.span
                key={id}
                className="absolute rounded-full bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.55)]"
                style={{ top: `${top}%`, left: `${left}%`, width: `${size}rem`, height: `${size}rem` }}
                animate={{ opacity: [0.2, 0.85, 0.2], scale: [1, 1.4, 1] }}
                transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
              />
            ))}
          </div>
        </>
      )}

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="px-4 pt-10 sm:px-8 lg:px-14 xl:px-20">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-3xl shadow-[0_35px_60px_rgba(15,23,42,0.55)] md:flex-row md:items-center md:justify-between md:p-9">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Weather</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Sky Gazer's Forecast
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Hyper-realistic conditions, macOS inspired animations, and detailed climate insights tailored to your journey.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3 rounded-full border border-white/25 bg-white/15 px-6 py-3 text-sm text-white/85 focus-within:border-white/60">
                <WiStrongWind className="text-lg text-white/70" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by city or destination"
                  className="w-full bg-transparent font-medium text-white placeholder-white/50 focus:outline-none"
                />
              </div>
              <motion.button
                type="submit"
                whileTap={{ scale: 0.94 }}
                className="relative inline-flex h-[3.25rem] min-w-[11rem] items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-white/90 via-white to-white/75 px-7 py-3 text-sm font-semibold text-slate-900 shadow-[0_20px_46px_rgba(148,163,184,0.35)] transition hover:-translate-y-0.5"
                disabled={loading}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {showClip ? (
                    <motion.div
                      key="clip"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="relative flex h-full w-full items-center justify-center overflow-hidden"
                    >
                      <motion.div
                        className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(255,255,255,0.9),rgba(255,255,255,0)),radial-gradient(circle_at_70%_20%,rgba(125,211,252,0.75),rgba(255,255,255,0)),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.7),rgba(255,255,255,0))]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0.7] }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                      />
                      <div className="relative h-full w-full">
                        <motion.div
                          className="absolute left-[18%] top-[18%] h-7 w-7 rounded-full bg-gradient-to-br from-amber-200 via-yellow-200 to-amber-300 shadow-[0_0_25px_rgba(253,230,138,0.8)]"
                          animate={{ scale: [0.9, 1.05, 0.95], rotate: [0, 12, -10, 0] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <motion.div
                          className="absolute left-[35%] bottom-[22%] h-9 w-14 rounded-full bg-white/80"
                          animate={{ x: [-6, 6, -6] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <motion.div
                          className="absolute left-[55%] bottom-[20%] h-7 w-12 rounded-full bg-white/70"
                          animate={{ x: [6, -6, 6] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                        />
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <motion.span
                            key={`drop-${idx}`}
                            className="absolute left-[50%] h-7 w-[2px] rounded-full bg-sky-500/70"
                            style={{ top: `${40 + idx * 8}%` }}
                            animate={{ y: [0, 18], opacity: [0, 1, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: idx * 0.12, ease: "easeIn" }}
                          />
                        ))}
                        <AnimatePresence>
                          {Math.random() > 0.4 && (
                            <motion.span
                              key="bolt"
                              className="absolute right-[24%] top-[32%] h-10 w-2 skew-x-[-15deg] rounded-full bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-200 opacity-70 shadow-[0_0_15px_rgba(250,204,21,0.7)]"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0, 1, 0] }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.9 }}
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.span
                      key="label"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="relative flex items-center gap-2"
                    >
                      {loading ? "Fetching" : "Update Forecast"}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </form>
          </div>
          {error && (
            <div className="mx-auto mt-4 w-full max-w-6xl rounded-2xl border border-rose-300/40 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}
        </header>

        <main className="flex-1 px-4 pb-16 sm:px-8 lg:px-14 xl:px-20">
          <div className="mx-auto mt-12 grid w-full max-w-7xl gap-10 lg:grid-cols-[1.5fr_0.75fr]">
            <section className="space-y-10">
              <motion.div
                key={current?.location ?? "blank"}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="rounded-3xl border border-white/15 bg-white/10 p-8 text-white backdrop-blur-3xl shadow-[0_25px_60px_rgba(15,23,42,0.45)]"
              >
                {current ? (
                  <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Currently in</p>
                          <h2 className="mt-3 text-4xl font-black tracking-tight">{current.location}</h2>
                          <p className="mt-2 text-sm uppercase tracking-[0.3em] text-white/50">
                            {current.condition} · {current.description}
                          </p>
                        </div>
                        <motion.div
                          key={themeKey}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                          className="flex flex-col items-end"
                        >
                          {heroIcon}
                          <span className="mt-2 text-5xl font-black tracking-tight">
                            {current.temp}°C
                          </span>
                          <span className="text-xs uppercase tracking-[0.4em] text-white/50">
                            feels like {current.feelsLike}°C
                          </span>
                        </motion.div>
                      </div>

                      <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-white/20 via-white/10 to-transparent p-4 shadow-[0_16px_32px_rgba(15,23,42,0.35)]">
                          <p className="text-xs uppercase tracking-[0.35em] text-white/50">Sunrise</p>
                          <p className="mt-2 text-xl font-semibold">
                            {formatUnixTime(current.sunrise, current.timezoneOffset)}
                          </p>
                          <p className="text-xs text-white/60">
                            Sunset at {formatUnixTime(current.sunset, current.timezoneOffset)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-sky-500/20 via-white/10 to-transparent p-4 shadow-[0_16px_32px_rgba(15,23,42,0.35)]">
                          <p className="text-xs uppercase tracking-[0.35em] text-white/50">Airfield</p>
                          <p className="mt-2 text-xl font-semibold">{current.wind.toFixed(1)} m/s</p>
                          <p className="text-xs text-white/60">Humidity {current.humidity}% · Pressure {current.pressure}hPa</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-sky-500/15 via-white/10 to-transparent p-6 shadow-[0_18px_35px_rgba(15,23,42,0.45)]">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-white/55">
                        Micro Forecast
                      </h3>
                      <div className="mt-5 grid gap-4">
                        <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85">
                          <span>Visibility</span>
                          <span>{current.visibility ? `${Math.round(current.visibility / 1000)} km` : "—"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85">
                          <span>Condition</span>
                          <span className="capitalize">{current.description}</span>
                        </div>
                        <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85">
                          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Sunlight window</p>
                          <p className="mt-1">
                            {formatUnixTime(current.sunrise, current.timezoneOffset)} – {formatUnixTime(current.sunset, current.timezoneOffset)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-white/70">
                    Enter a destination to reveal the forecast.
                  </div>
                )}
              </motion.div>

              <motion.section
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="rounded-3xl border border-white/12 bg-white/10 p-6 backdrop-blur-3xl shadow-[0_25px_60px_rgba(15,23,42,0.45)] lg:p-7"
              >
                <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                  5 Day Outlook
                </h3>
                <div className="mt-5 grid gap-5 sm:grid-cols-5">
                  {forecast.map((day, index) => {
                    const themeVariant = FORECAST_VARIANTS[index % FORECAST_VARIANTS.length];
                    return (
                      <motion.div
                        key={day.dateLabel}
                        whileHover={{ y: -10, rotate: 1.2 }}
                        className={`group relative overflow-hidden rounded-[1.65rem] px-5 pb-5 pt-6 text-white shadow-[0_18px_35px_rgba(15,23,42,0.35)] ${themeVariant.card}`}
                      >
                        <motion.span
                          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                          style={{ background: "radial-gradient(circle at top, rgba(255,255,255,0.35), transparent 65%)" }}
                          initial={false}
                          animate={{ opacity: [0.2, 0.35, 0.2] }}
                          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: index * 0.1 }}
                        />
                        <div className="relative flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                          <span>{day.day}</span>
                          <span>{day.dateLabel}</span>
                        </div>
                        <div className={`relative mx-auto mt-4 mb-5 flex h-12 w-12 items-center justify-center rounded-full shadow-[0_10px_25px_rgba(15,23,42,0.35)] ${themeVariant.accent}`}>
                          <div className="scale-75">{getWeatherIcon(day.condition, true)}</div>
                        </div>
                        <p className="relative text-2xl font-semibold">{day.temp}°C</p>
                        <p className="relative mt-1 text-xs capitalize text-white/80">{day.description}</p>
                        <div className="relative mt-4 flex justify-between text-[11px] uppercase tracking-[0.3em] text-white/45">
                          <span>Wind {day.wind.toFixed(1)} m/s</span>
                          <span>Humidity {day.humidity}%</span>
                        </div>
                      </motion.div>
                    );
                  })}
                  {forecast.length === 0 && (
                    <div className="col-span-full py-8 text-center text-sm text-white/70">
                      Forecast data will appear once a location is queried.
                    </div>
                  )}
                </div>
              </motion.section>
            </section>

            <aside className="space-y-7">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="rounded-3xl border border-white/15 bg-gradient-to-br from-white/20 via-white/8 to-transparent p-6 backdrop-blur-3xl shadow-[0_25px_60px_rgba(15,23,42,0.45)]"
              >
                <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                  Travel Tips
                </h3>
                <div className="mt-4 space-y-4 text-sm text-white/80">
                  <div className="relative flex items-start gap-3 rounded-2xl border border-white/15 bg-white/8 p-4">
                    <div className="rounded-full bg-white/25 p-3 text-white">
                      {isDaytime ? (
                        <WiDaySunny className="text-lg" />
                      ) : (
                        <WiMoonAltWaningCrescent6 className="text-lg" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-white">Light & Visibility</p>
                      <p className="text-white/70">
                        Perfect lighting during golden hours. Plan your scenic shots around sunrise and sunset.
                      </p>
                    </div>
                  </div>
                  <div className="relative flex items-start gap-3 rounded-2xl border border-white/15 bg-white/8 p-4">
                    <div className="rounded-full bg-white/25 p-3 text-white">
                      <WiRain className="text-lg" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Bring Layers</p>
                      <p className="text-white/70">
                        Weather can shift rapidly. Breathable layers keep you ready for drizzle or sun.
                      </p>
                    </div>
                  </div>
                  <div className="relative flex items-start gap-3 rounded-2xl border border-white/15 bg-white/8 p-4">
                    <div className="rounded-full bg-white/25 p-3 text-white">
                      <WiStrongWind className="text-lg" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Wind Advisory</p>
                      <p className="text-white/70">
                        Gusty moments expected through the afternoon. Secure hats and lightweight items.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-white/8 to-transparent p-6 backdrop-blur-3xl shadow-[0_25px_60px_rgba(15,23,42,0.45)]"
              >
                <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Key Moments</h3>
                <div className="mt-4 space-y-3 text-sm text-white/80">
                  <div className="flex items-center justify-between">
                    <span>Sunrise</span>
                    <span>{formatUnixTime(current?.sunrise, current?.timezoneOffset)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Sunset</span>
                    <span>{formatUnixTime(current?.sunset, current?.timezoneOffset)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>First Light</span>
                    <span>
                      {current?.sunrise
                        ? formatUnixTime(current.sunrise - 30 * 60, current.timezoneOffset)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last Light</span>
                    <span>
                      {current?.sunset
                        ? formatUnixTime(current.sunset + 30 * 60, current.timezoneOffset)
                        : "—"}
                    </span>
                  </div>
                </div>
              </motion.div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Weather;
