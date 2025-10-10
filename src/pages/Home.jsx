import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import {
  Navigation,
  MapPin,
  Cloud,
  Calendar,
  Users,
  Sparkles,
  Bot,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import circusHero from '/assets/images/placeholder-circus-hero.jpg';
import NearbyAttractions from '../components/NearbyAttractions.jsx';

const quickActions = [
  {
    title: 'Crystal Ball',
    description: 'Let the mystical orb reveal your perfect destination based on your travel desires.',
    to: '/crystal-ball',
    chip: 'Magical',
    Icon: Sparkles,
  },
  {
    title: 'Launch the trip planner',
    description: 'Hand the brief to the Orchestrator and watch itineraries stream in with live agent updates.',
    to: '/planner',
    chip: 'Multi-agent',
    Icon: Navigation,
  },
  {
    title: 'Compare two destinations',
    description: 'Line up weather, culture, and cost signals side-by-side before you commit.',
    to: '/compare',
    chip: 'Decision-ready',
    Icon: MapPin,
  },
  {
    title: 'Check live weather intelligence',
    description: 'Preview the Sky Gazer dashboard to see how forecasts shape the plan in real time.',
    to: '/weather',
    chip: 'Live data',
    Icon: Cloud,
  },
  {
    title: 'Review the operations dashboard',
    description: 'Monitor itineraries, status updates, and team sync from the command center.',
    to: '/dashboard',
    chip: 'Control room',
    Icon: Calendar,
  },
];

const agentSignals = [
  {
    id: 'weather',
    label: 'Weather agent',
    message: 'Monsoon surge flagged for Goa — pacing adjusted for day 2 activities.',
    detail: 'Synced 2 minutes ago',
    Icon: Cloud,
  },
  {
    id: 'events',
    label: 'Events scout',
    message: 'Jazz under the Stars added to Lisbon night plan for the 9th.',
    detail: 'Updated 5 minutes ago',
    Icon: Sparkles,
  },
  {
    id: 'budget',
    label: 'Quartermaster',
    message: 'Flight swap saved $240 · redistributed to dining budget.',
    detail: 'Refreshed 11 minutes ago',
    Icon: Users,
  },
  {
    id: 'routes',
    label: 'Route conductor',
    message: 'Multi-city transfer locked — transit slotted for 08:30 departure.',
    detail: 'Verified 15 minutes ago',
    Icon: Navigation,
  },
];

const metricBlueprint = [
  { label: 'Active itineraries', suffix: 'in progress', min: 8, max: 16, Icon: Navigation },
  { label: 'Comparisons requested', suffix: 'today', min: 9, max: 18, Icon: MapPin },
  { label: 'Weather lookups', suffix: 'last hour', min: 24, max: 42, Icon: Cloud },
  { label: 'Collaborators online', suffix: 'teams', min: 3, max: 9, Icon: Users },
];

const generateSnapshot = () =>
  metricBlueprint.map(({ min, max, ...rest }) => {
    const value = Math.floor(min + Math.random() * (max - min + 1));
    const delta = Number((Math.random() * 3 - 1.5).toFixed(1));
    return {
      ...rest,
      value,
      delta,
      trend: delta >= 0 ? 'up' : 'down',
    };
  });

const Index = () => {
  const [activeSignalIndex, setActiveSignalIndex] = useState(0);
  const [metrics, setMetrics] = useState(() => generateSnapshot());

  useEffect(() => {
    const ticker = setInterval(
      () => setActiveSignalIndex((prev) => (prev + 1) % agentSignals.length),
      6000,
    );
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    const refresh = setInterval(() => setMetrics(generateSnapshot()), 15000);
    return () => clearInterval(refresh);
  }, []);

  const activeSignal = agentSignals[activeSignalIndex];
  const queuedSignal = agentSignals[(activeSignalIndex + 1) % agentSignals.length];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_60%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(168,85,247,0.18),_transparent_65%)]" aria-hidden="true" />

      <main className="relative z-10">
        <section className="relative flex min-h-[70vh] flex-col items-center justify-center px-6 pb-20 pt-32 sm:px-10 lg:px-16">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div
              className="absolute inset-0 opacity-20"
              style={{ backgroundImage: `url(${circusHero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950 to-slate-950" />
          </div>

          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">
              The Ringmaster's Roundtable
            </span>
            <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl md:text-6xl">
              Coordinate real tours with an ensemble of live travel agents
            </h1>
            <p className="mt-4 text-base text-white/70 sm:text-lg">
              Swap decks of static cards for working modules. Launch planners, compare cities, and monitor updates as agents ship the next act
              of your itinerary.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/planner" aria-label="Launch the trip planner">
                <Button size="lg" className="rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-10 py-3 text-sm font-semibold uppercase tracking-[0.3em] shadow-[0_22px_55px_rgba(14,165,233,0.4)]">
                  Start planning now
                </Button>
              </Link>
              <Link to="/dashboard" aria-label="Open the operations dashboard">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/30 px-10 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white hover:bg-white/10"
                >
                  View the dashboard
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-16 w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-[0_22px_55px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <activeSignal.Icon className="h-6 w-6 text-cyan-200" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">{activeSignal.label}</p>
                  <p className="mt-2 text-sm text-white/80">{activeSignal.message}</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs text-white/60">
                <Bot className="h-4 w-4 text-white/50" />
                <span>{activeSignal.detail}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Next up: {queuedSignal.label}</span>
            </div>
          </div>
        </section>

        <section className="relative px-6 pb-20 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-6xl space-y-10">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">
                Jump straight in
              </span>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Pick an interactive module</h2>
              <p className="mt-3 text-sm text-white/70 sm:text-base">
                Every card opens a working experience — no filler slides, just the tools you need to move the tour forward.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {quickActions.slice(0, 3).map(({ title, description, to, chip, Icon }) => (
                <Link
                  key={title}
                  to={to}
                  className="group relative flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-6 text-left shadow-[0_20px_45px_rgba(15,23,42,0.35)] backdrop-blur transition hover:-translate-y-1 hover:border-white/30 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
                      {chip}
                    </span>
                    <Icon className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div className="mt-6 space-y-3">
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <p className="text-sm text-white/70">{description}</p>
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                    Explore
                    <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-1 group-hover:text-white" />
                  </div>
                </Link>
              ))}
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
              {quickActions.slice(3).map(({ title, description, to, chip, Icon }) => (
                <Link
                  key={title}
                  to={to}
                  className="group relative flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-6 text-left shadow-[0_20px_45px_rgba(15,23,42,0.35)] backdrop-blur transition hover:-translate-y-1 hover:border-white/30 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
                      {chip}
                    </span>
                    <Icon className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div className="mt-6 space-y-3">
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <p className="text-sm text-white/70">{description}</p>
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                    Explore
                    <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-1 group-hover:text-white" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-6 pb-24 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-6xl space-y-10">
            <div className="grid gap-8 lg:grid-cols-[1.25fr_0.85fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_25px_65px_rgba(15,23,42,0.45)] backdrop-blur">
                <div className="flex items-center gap-3">
                  <Bot className="h-6 w-6 text-cyan-200" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Live agent feed</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Orchestrator highlights the latest handoffs</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm text-white/70">
                  Agents post updates as they balance weather alerts, budget moves, and route locks. Share the workspace and watch your crew track
                  the same source of truth.
                </p>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {metrics.map(({ label, suffix, value, delta, trend, Icon }) => {
                    const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight;
                    return (
                      <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-slate-900/40">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                            <Icon className="h-5 w-5 text-cyan-200" />
                          </span>
                          <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${
                            trend === 'up' ? 'border border-emerald-400/60 text-emerald-200' : 'border border-rose-400/60 text-rose-200'
                          }`}>
                            <TrendIcon className="h-3 w-3" />
                            <span>{Math.abs(delta).toFixed(1)}</span>
                          </div>
                        </div>
                        <p className="mt-5 text-3xl font-semibold text-white">{value}</p>
                        <p className="text-xs uppercase tracking-[0.35em] text-white/60">{suffix}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_25px_65px_rgba(15,23,42,0.45)] backdrop-blur">
                <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Agent queue</h3>
                <p className="mt-3 text-sm text-white/70">Who is on deck and what they just shipped.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {agentSignals.map((signal, index) => {
                    const isActive = index === activeSignalIndex;
                    return (
                      <div
                        key={signal.id}
                        className={`flex h-full flex-col justify-between rounded-2xl border p-4 transition ${
                          isActive
                            ? 'border-cyan-300/60 bg-cyan-400/10 shadow-[0_20px_45px_rgba(8,145,178,0.25)]'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                            <signal.Icon className="h-5 w-5 text-cyan-200" />
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/60">{signal.label}</p>
                            <p className="mt-1 text-[13px] leading-snug text-white/75">{signal.message}</p>
                          </div>
                        </div>
                        <p className="mt-4 text-xs text-white/55">{signal.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative px-6 pb-24 sm:px-10 lg:px-16">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1fr]">
            <NearbyAttractions className="order-2 lg:order-1" />
            <div className="order-1 flex flex-col justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/70 to-slate-950/80 p-8 text-white shadow-[0_24px_65px_rgba(15,23,42,0.45)] backdrop-blur lg:order-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">
                Spontaneous excursions
              </span>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Tap into what&apos;s happening right now</h2>
              <p className="mt-3 text-sm text-white/70 sm:text-base">
                The Near Me Now agent scans OpenStreetMap live for coffee spots, scenic pullovers, and cultural hits within walking distance of
                your current coordinates. Give the deck a refresh whenever you touch down in a new neighborhood and the suggestions will pivot with you.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-cyan-300" />
                  <span>Hover over the glowing pin icon to confirm the module status and kick off a fresh scan.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-cyan-300" />
                  <span>Filter signals by focus — coffee, scenic, or mixed — right from the component props when embedding elsewhere.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-cyan-300" />
                  <span>Use the refresh action to re-sync the panel with the latest agent sweep.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="relative px-6 pb-28 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/20 via-violet-500/10 to-slate-900/60 p-10 text-center shadow-[0_30px_80px_rgba(15,23,42,0.45)] backdrop-blur">
            <h2 className="text-3xl font-semibold sm:text-4xl">Bring your crew to the Roundtable</h2>
            <p className="mt-3 text-sm text-white/70 sm:text-base">
              Drop right into an experience where every panel drives action — planning, comparing, syncing. No static slides, just the modules your
              team asks for during live planning sessions.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/planner" aria-label="Open the trip planner">
                <Button size="lg" className="rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-10 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white shadow-[0_22px_55px_rgba(14,165,233,0.4)]">
                  Launch planner
                </Button>
              </Link>
              <Link to="/compare" aria-label="Open the destination comparison tool">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/30 px-10 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white hover:bg-white/10"
                >
                  Compare destinations
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;