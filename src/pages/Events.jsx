import React, { useEffect, useMemo, useState } from "react";

const gradientPalettes = [
  "from-emerald-400/40 via-cyan-400/30 to-indigo-500/30",
  "from-fuchsia-400/40 via-purple-500/30 to-sky-500/30",
  "from-amber-400/40 via-rose-500/30 to-purple-600/30",
  "from-blue-400/40 via-indigo-500/30 to-slate-900/20",
  "from-teal-400/40 via-emerald-500/30 to-lime-400/20",
  "from-rose-400/40 via-orange-500/30 to-amber-400/20",
];

const fallbackImages = [
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea",
  "https://images.unsplash.com/photo-1514516430032-7f0c3b80805d",
  "https://images.unsplash.com/photo-1464375117522-1311d6a5b81a",
  "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea",
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7",
];

const formatDateTime = (date, time) => {
  if (!date && !time) return "Schedule TBA";
  const composed = [date, time].filter(Boolean).join(" ");
  const parsed = new Date(composed || date);
  if (Number.isNaN(parsed.getTime())) {
    return composed || "Schedule TBA";
  }
  return parsed.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const parseDateTime = (date, time) => {
  if (!date && !time) return null;
  const composed = [date, time].filter(Boolean).join(" ");
  const parsed = new Date(composed || date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function EventRecommendations() {
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!city.trim()) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        city: city.trim(),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const res = await fetch(
        `http://localhost:3000/api/events?${params.toString()}`
      );
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEndDate((prev) => {
      if (!prev) return prev;
      if (startDate && new Date(prev) < new Date(startDate)) {
        return startDate;
      }
      return prev;
    });
  }, [startDate]);

  const today = new Date().toISOString().split("T")[0];
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const maxDate = nextMonth.toISOString().split("T")[0];

  const vibePalette = useMemo(() => {
    const counts = events.reduce((acc, current) => {
      const key = current.category || "Uncategorized";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [events]);

  const timelineEvents = useMemo(() => {
    return [...events]
      .map((event) => ({
        ...event,
        _dateTime: parseDateTime(event.date, event.time),
      }))
      .sort((a, b) => {
        if (!a._dateTime && !b._dateTime) return 0;
        if (!a._dateTime) return 1;
        if (!b._dateTime) return -1;
        return a._dateTime - b._dateTime;
      })
      .slice(0, 8);
  }, [events]);

  const highlightEvents = useMemo(() => events.slice(0, 6), [events]);

  const heroCity = useMemo(() => {
    if (city.trim()) return city.trim();
    if (events[0]?.location) {
      return events[0].location.split(",")[0];
    }
    return "Your Next Stop";
  }, [city, events]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_60%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(236,72,153,0.25),_transparent_70%)]"
        aria-hidden="true"
      />

      <main className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-8 lg:px-12">
        <section className="mb-12 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="relative overflow-hidden rounded-4xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/75 to-slate-950/60 p-10 shadow-[0_32px_80px_rgba(14,165,233,0.35)]">
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-400/40 via-cyan-400/40 to-indigo-500/40 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-gradient-to-br from-fuchsia-500/40 via-purple-500/40 to-sky-400/40 blur-3xl" />

            <div className="relative space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-white/70">
                Live Culture Radar
              </span>
              <h1 className="text-4xl font-black leading-tight sm:text-5xl">
                Spin up unforgettable nights in {heroCity}.
              </h1>
              <p className="max-w-xl text-sm text-white/70 sm:text-base">
                Stream upcoming concerts, festivals, pop-ups, and underground sessions in real time.
                Tune the filters, lock in your date window, and watch the stage lineup reconfigure instantly.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <label className="md:col-span-2">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                      Anchor City
                    </span>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g., Berlin, Singapore, Austin"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      required
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                      Window Opens
                    </span>
                    <input
                      type="date"
                      value={startDate}
                      min={today}
                      max={maxDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                      Window Ends
                    </span>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || today}
                      max={maxDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={!startDate}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={loading || !city.trim()}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-white px-8 py-3 text-sm font-semibold text-slate-900 shadow-[0_20px_60px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <svg
                          className="h-4 w-4 animate-spin"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Scanning Venues...
                      </>
                    ) : (
                      <>
                        <span>Launch Radar</span>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>

                  {events.length > 0 && (
                    <span className="text-xs uppercase tracking-[0.4em] text-white/50">
                      {events.length} events tuned in
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>

          <aside className="flex flex-col justify-between gap-6 rounded-4xl border border-white/10 bg-white/5 p-8 shadow-[0_28px_60px_rgba(15,23,42,0.35)] backdrop-blur">
            <div>
              <h2 className="text-lg font-semibold uppercase tracking-[0.4em] text-white/70">
                Broadcast Checklist
              </h2>
              <ul className="mt-6 space-y-4 text-sm text-white/70">
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-emerald-300" />
                  Choose the city pulse, then widen the window for a broader sweep of talent.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-cyan-300" />
                  Star events to share with collaborators or pin to your tour itinerary.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-rose-300" />
                  Use the rhythm line for a choreographed daily route across stages.
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-400/20 via-slate-900/40 to-indigo-500/20 p-6 text-sm text-white/80">
              <p className="font-semibold uppercase tracking-[0.3em] text-emerald-100">
                Tip
              </p>
              <p className="mt-2 text-white/80">
                Once you lock the lineup, sync it with your itinerary generator to auto-thread hotels, dining, and downtime between performances.
              </p>
            </div>
          </aside>
        </section>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="relative">
              <div className="h-24 w-24 rounded-full border-4 border-white/20 border-t-emerald-300 animate-spin" />
              <div className="absolute inset-2 rounded-full border border-white/10" />
            </div>
          </div>
        ) : events.length > 0 ? (
          <>
            <section className="grid gap-10 lg:grid-cols-[2fr_1fr]">
              <div className="grid gap-6 sm:grid-cols-2">
                {highlightEvents.map((event, index) => {
                  const gradient = gradientPalettes[index % gradientPalettes.length];
                  const image = event.imageUrl || fallbackImages[index % fallbackImages.length];
                  return (
                    <article
                      key={`${event.title}-${index}`}
                      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-white shadow-[0_26px_70px_rgba(13,148,136,0.25)] transition duration-500 hover:-translate-y-1 hover:border-emerald-300/60"
                    >
                      <div
                        className={`absolute -inset-20 bg-gradient-to-br ${gradient} opacity-40 blur-3xl transition group-hover:opacity-80`}
                        aria-hidden="true"
                      />
                      <div
                        className="absolute inset-0 opacity-30 transition group-hover:opacity-60"
                        style={{
                          backgroundImage: `url(${image})`,
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                        }}
                      />

                      <div className="relative flex h-full flex-col">
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/60">
                          <span>#{String(index + 1).padStart(2, "0")}</span>
                          {event.category && (
                            <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-white/70">
                              {event.category}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-5 text-2xl font-semibold leading-tight">
                          {event.title || "Untitled Event"}
                        </h3>

                        <p className="mt-4 line-clamp-3 text-sm text-white/80">
                          {event.description || "Keep your schedule flexible—this act is all about surprise improv."}
                        </p>

                        <div className="mt-6 space-y-2 text-xs text-white/60">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                            <span>{formatDateTime(event.date, event.time)}</span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-300" />
                              <span>{event.location}</span>
                            </div>
                          )}
                          {event.price && (
                            <div className="flex items-center gap-2 text-emerald-200">
                              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                              <span>{event.price}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-8 flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/60">
                          <span>Swipe right to slot into itinerary</span>
                          <svg
                            className="h-4 w-4 text-white/50 transition group-hover:translate-x-1 group-hover:text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <aside className="relative rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-[0_28px_70px_rgba(59,130,246,0.25)]">
                <div className="absolute left-8 top-16 bottom-16 w-0.5 bg-gradient-to-b from-emerald-400 via-cyan-400 to-indigo-500 opacity-80" />
                <h3 className="mb-6 text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
                  Rhythm Line
                </h3>
                <div className="space-y-6">
                  {timelineEvents.length ? (
                    timelineEvents.map((event, index) => (
                      <div key={`${event.title}-${index}`} className="relative pl-10">
                        <div className="absolute left-2 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-slate-950">
                          <span className="h-2 w-2 rounded-full bg-emerald-300" />
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">
                          {event._dateTime ? event._dateTime.toLocaleDateString("en-US", { weekday: "short" }) : "TBA"}
                        </p>
                        <h4 className="mt-1 text-lg font-semibold text-white">
                          {event.title || "Headline Pending"}
                        </h4>
                        <p className="text-xs text-white/60">
                          {formatDateTime(event.date, event.time)}
                        </p>
                        {event.location && (
                          <p className="mt-1 text-xs text-white/60">{event.location}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white/60">
                      Lock in a city to auto-compose your evening timeline.
                    </p>
                  )}
                </div>
              </aside>
            </section>

            <section className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.35)] backdrop-blur">
                <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
                  Vibe Palette
                </h3>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {vibePalette.map(({ label, total }, index) => (
                    <div
                      key={label}
                      className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-white shadow-[0_18px_45px_rgba(59,130,246,0.25)]"
                    >
                      <div
                        className="absolute -inset-10 bg-gradient-to-br from-emerald-400/20 via-cyan-400/20 to-indigo-500/20 blur-3xl"
                        aria-hidden="true"
                      />
                      <div className="relative">
                        <p className="text-xs uppercase tracking-[0.35em] text-white/60">{String(index + 1).padStart(2, "0")}</p>
                        <p className="mt-3 text-base font-semibold">{label}</p>
                        <p className="mt-1 text-xs text-white/60">{total} spotlight{total === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-300/30 bg-gradient-to-br from-emerald-300/10 via-slate-900/60 to-indigo-500/20 p-6 text-white shadow-[0_24px_60px_rgba(16,185,129,0.3)]">
                <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-100">
                  Crowd Energy Monitor
                </h3>
                <div className="mt-6 space-y-4 text-sm text-white/80">
                  <p>
                    {events.length} events loaded. Toggle between genres, stitch a back-to-back night, or keep the
                    rhythm line aligned with daylight hours.
                  </p>
                  <p>
                    Use this board as an interactive moodboard—pin performances, export to your team, or trigger a
                    compare run straight from the top picks.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="mt-16 rounded-4xl border border-white/10 bg-white/5 p-12 text-center text-white shadow-[0_28px_70px_rgba(59,130,246,0.2)] backdrop-blur">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-white/5">
              <span className="text-3xl">✨</span>
            </div>
            <h2 className="mt-6 text-3xl font-bold">Dial in a city to summon the lineup.</h2>
            <p className="mt-3 text-white/70">
              Well remix your cultural calendar moment by moment, from sunrise yoga raves to midnight improv battles.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs uppercase tracking-[0.4em] text-white/50">
              <span className="rounded-full border border-white/15 px-4 py-2">Jazz Rooftops</span>
              <span className="rounded-full border border-white/15 px-4 py-2">Secret Pop-ups</span>
              <span className="rounded-full border border-white/15 px-4 py-2">Festival Headliners</span>
              <span className="rounded-full border border-white/15 px-4 py-2">Underground Labs</span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
