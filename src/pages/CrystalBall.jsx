import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../components/ui/button";
import Particles from "../components/particles";
import {
  Sparkles,
  Wand2,
  ArrowLeft,
  Compass,
  Stars,
  Mountain,
  Building2,
  Gauge,
  Feather,
  Landmark,
  Utensils,
  Ship,
} from "lucide-react";
import ENV from "../config/env";

const API_BASE_URL = (ENV?.API_BASE_URL || "").replace(/\/$/, "");
const CRYSTAL_ENDPOINT = API_BASE_URL ? `${API_BASE_URL}/api/discover-destinations` : "/api/discover-destinations";

const QUESTIONS = [
  {
    id: "vibe",
    prompt: "What pulse guides this journey?",
    helper: "Choose the energy that mirrors your current longing.",
    options: [
      {
        value: "adventure",
        title: "Thrill seeker",
        description: "Cliff edges, roaring rapids, and midnight bazaars call your name.",
        Icon: Compass,
      },
      {
        value: "relaxation",
        title: "Serene soul",
        description: "You crave open skies, slow mornings, and languid afternoons.",
        Icon: Feather,
      },
      {
        value: "culture",
        title: "Story collector",
        description: "Museums, markets, and whispered folklore spark your imagination.",
        Icon: Landmark,
      },
    ],
  },
  {
    id: "setting",
    prompt: "What stage should the story unfold upon?",
    helper: "Pick the backdrop that fits the next act.",
    options: [
      {
        value: "city",
        title: "Neon skyline",
        description: "Towering rooftops, indie galleries, and street food fireworks await.",
        Icon: Building2,
      },
      {
        value: "nature",
        title: "Wild horizons",
        description: "Ridges, rainforests, and aurora-kissed waters beckon you closer.",
        Icon: Mountain,
      },
      {
        value: "coast",
        title: "Tidal heartbeat",
        description: "Salt spray, sleepy harbours, and sunset sails steady your compass.",
        Icon: Ship,
      },
    ],
  },
  {
    id: "pace",
    prompt: "How swiftly should the days tumble?",
    helper: "Set the tempo for the troupe.",
    options: [
      {
        value: "slow",
        title: "Lantern stroll",
        description: "Long breakfasts, aimless wanderings, and time to linger.",
        Icon: Feather,
      },
      {
        value: "medium",
        title: "Curated cadence",
        description: "Balanced itineraries with room for serendipity.",
        Icon: Sparkles,
      },
      {
        value: "fast",
        title: "Whirlwind",
        description: "Packed schedules, night trains, and encore after encore.",
        Icon: Gauge,
      },
    ],
  },
];

const getActivityIcon = (activity = "") => {
  const text = activity.toLowerCase();
  if (text.includes("dine") || text.includes("cuisine") || text.includes("food") || text.includes("tea")) {
    return <Utensils className="h-4 w-4" />;
  }
  if (text.includes("sail") || text.includes("cruise") || text.includes("boat") || text.includes("river")) {
    return <Ship className="h-4 w-4" />;
  }
  if (text.includes("temple") || text.includes("museum") || text.includes("palace") || text.includes("shrine")) {
    return <Landmark className="h-4 w-4" />;
  }
  return <Sparkles className="h-4 w-4" />;
};

const CrystalBall = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [answers, setAnswers] = useState({ vibe: "", setting: "", pace: "" });
  const [status, setStatus] = useState("idle");
  const [visions, setVisions] = useState([]);
  const [error, setError] = useState(null);

  const canReveal = Object.values(answers).every(Boolean);
  const isConjuring = status === "loading";
  const hasVisions = status === "success" && visions.length > 0;

  const updateAnswer = (questionId, value) => {
    if (isConjuring) return;
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setStatus("idle");
    setError(null);
  };

  const revealDestinations = async () => {
    if (!canReveal || isConjuring) return;
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch(CRYSTAL_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "The oracle is silent.");
      }

      const data = await response.json();
      const normalised = Array.isArray(data) ? data : [];
      setVisions(normalised);
      setStatus("success");
    } catch (err) {
      console.error("Crystal Ball error", err);
      setVisions([]);
      setStatus("error");
      setError(err.message || "The Crystal Ball is cloudy." );
    }
  };

  const resetAnswers = () => {
    setAnswers({ vibe: "", setting: "", pace: "" });
    setVisions([]);
    setStatus("idle");
    setError(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <Particles
        particleCount={100}
        particleColors={['#ffffff', '#a5b4fc', '#818cf8', '#c7d2fe']}
        speed={0.3}
        particleBaseSize={1.5}
        moveParticlesOnHover={false}
        className="absolute inset-0 -z-10"
      />
      <Particles 
        particleCount={100}
        particleColors={['#ffffff', '#a5b4fc', '#818cf8', '#c7d2fe']}
        speed={0.3}
        particleBaseSize={1.5}
        moveParticlesOnHover={false}
        className="absolute inset-0 -z-10"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(168,85,247,0.1),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_85%,rgba(56,189,248,0.1),transparent_60%)]" />

      <main className="relative z-10 min-h-screen px-6 pb-24 pt-28 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">
                <Stars className="h-3.5 w-3.5 text-cyan-300" /> Divination chamber
              </p>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">The Crystal Ball Awaits</h1>
              <p className="mt-3 max-w-xl text-sm text-white/70 sm:text-base">
                Whisper your intentions, choose the stage, set the tempo. The clairvoyant sphere will surface destinations aligned to your
                troupes heartbeat.
              </p>
            </div>
            <div className="hidden flex-col items-end text-xs text-white/60 sm:flex">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 uppercase tracking-[0.35em]">
                <Compass className="h-3.5 w-3.5 text-violet-300" /> Inspired voyages
              </span>
              <Link
                to="/"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/70 transition hover:border-white/35 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to camp
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              {QUESTIONS.map((question) => (
                <div
                  key={question.id}
                  className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-[0_35px_60px_rgba(15,23,42,0.45)] backdrop-blur"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">{question.prompt}</p>
                  <p className="mt-1 text-[13px] text-white/55">{question.helper}</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {question.options.map(({ value, title, description, Icon }) => {
                      const isActive = answers[question.id] === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateAnswer(question.id, value)}
                          className={`group relative overflow-hidden rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
                            isActive
                              ? "border-cyan-300/70 bg-cyan-400/15 text-white shadow-[0_20px_40px_rgba(56,189,248,0.35)]"
                              : "border-white/10 bg-white/8 text-white/75 hover:border-white/30 hover:text-white"
                          }`}
                        >
                          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-cyan-200/70">
                            <Icon className="h-3.5 w-3.5" /> Oracle cue
                          </span>
                          <span className="mt-2 block font-semibold leading-tight">{title}</span>
                          <span className="mt-1 block text-xs text-white/60">{description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex flex-col gap-4 rounded-3xl border border-white/15 bg-white/10 p-6 shadow-[0_40px_70px_rgba(15,23,42,0.45)] backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Crystal Ball Protocol</p>
                    <p className="mt-1 text-sm text-white/75">
                      Seal your answers, steady your breath, and invite the visions. The orb favors decisive hearts.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={revealDestinations}
                    disabled={!canReveal || isConjuring}
                    className="rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-500 to-cyan-400 px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em] shadow-[0_20px_55px_rgba(168,85,247,0.45)] disabled:cursor-not-allowed disabled:border disabled:border-white/20 disabled:bg-transparent disabled:text-white/50"
                  >
                    {isConjuring ? "Conjuring..." : hasVisions ? "Summon anew" : "Reveal my omens"}
                  </Button>
                </div>
                <div className="flex flex-col gap-2 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
                  <span>A hush falls over the tent as the orb spins. Destinations shimmer into view within breaths.</span>
                  {status === "error" && (
                    <span className="rounded-full border border-rose-400/40 bg-rose-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-rose-100">
                      {error}
                    </span>
                  )}
                </div>
                {hasVisions && (
                  <button
                    type="button"
                    onClick={resetAnswers}
                    className="self-start text-[11px] font-semibold uppercase tracking-[0.35em] text-white/55 underline-offset-4 hover:text-white"
                  >
                    Reset choices
                  </button>
                )}
              </div>
            </div>

            <div className="relative flex flex-col gap-6 rounded-4xl border border-white/15 bg-white/5 p-6 shadow-[0_40px_80px_rgba(14,116,144,0.35)] backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(168,85,247,0.2),transparent_65%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_110%,rgba(56,189,248,0.18),transparent_65%)]" />

              <div className="relative flex flex-col items-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center shadow-[0_35px_70px_rgba(15,23,42,0.55)]">
                <motion.div
                  animate={{ rotate: [0, 4, -4, 0], scale: [1, 1.02, 1, 1.02, 1] }}
                  transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
                  className="relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/50 via-fuchsia-400/40 to-cyan-400/40 shadow-[0_0_60px_rgba(168,85,247,0.45)]"
                >
                  <motion.div
                    animate={{ opacity: [0.65, 0.85, 0.65], scale: [0.95, 1.05, 0.95] }}
                    transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-5 rounded-full bg-gradient-to-br from-cyan-200/45 via-violet-200/25 to-fuchsia-200/30 blur-xl"
                  />
                  <Wand2 className="relative h-10 w-10 text-white/80" />
                </motion.div>
                <p className="mt-5 text-sm font-semibold uppercase tracking-[0.35em] text-white/70">Crystal status</p>
                <p className="mt-2 text-xs text-white/60">
                  {isConjuring
                    ? "The sphere churns, sifting sands of wonder..."
                    : hasVisions
                    ? "Your omens shimmer below."
                    : canReveal
                    ? "Seal the protocol to awaken the vision."
                    : "Answer each prompt to stir the crystal."}
                </p>
              </div>

              <div className="relative grid gap-4">
                <AnimatePresence mode="popLayout">
                  {!hasVisions && !isConjuring && (
                    <motion.div
                      key="placeholder"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.4 }}
                      className="rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 py-8 text-center text-sm text-white/55"
                    >
                      Answer the prompts to let the Crystal Ball compose your map of marvels.
                    </motion.div>
                  )}

                  {isConjuring && (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-center justify-center gap-3 rounded-3xl border border-cyan-300/40 bg-cyan-400/10 px-6 py-8 text-sm text-cyan-100"
                    >
                      <motion.span
                        className="h-2 w-2 rounded-full bg-cyan-200"
                        animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
                      />
                      The orb hums and the curtains quiver...
                    </motion.div>
                  )}

                  {hasVisions && !isConjuring &&
                    visions.map((vision, index) => (
                      <motion.div
                        key={`${vision.name || "vision"}-${index}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.45, delay: index * 0.05 }}
                        className="rounded-3xl border border-white/15 bg-white/12 p-6 shadow-[0_28px_65px_rgba(59,130,246,0.25)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-lg font-semibold text-white">{vision.name || "Uncharted Haven"}</h3>
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
                            <Sparkles className="h-3.5 w-3.5" /> Vision #{index + 1}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-white/75">{vision.description || "The orb whispers of wonders yet unnamed."}</p>
                        <div className="mt-4 space-y-2 text-xs text-white/65">
                          {Array.isArray(vision.preview_activities) && vision.preview_activities.length > 0 ? (
                            vision.preview_activities.map((activity, activityIndex) => (
                              <div key={`${activity}-${activityIndex}`} className="flex items-start gap-2">
                                <span className="mt-0.5 text-cyan-200">{getActivityIcon(activity)}</span>
                                <span>{activity}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-cyan-200">
                                <Sparkles className="h-4 w-4" />
                              </span>
                              <span>The crystal could not glimpse the exact experiences. Ask your planner to refine the path.</span>
                            </div>
                          )}
                        </div>
                        {vision.vibe && (
                          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-100">
                            {vision.vibe}
                          </span>
                        )}
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center gap-4 text-center text-xs text-white/55">
          <p>
            Prefer a grounded plan? Return to the <Link to="/planner" className="text-cyan-200 underline">Trip Planner</Link> when the
            omens fade.
          </p>
          <p className="flex items-center gap-2 text-white/45">
            <Sparkles className="h-3.5 w-3.5" /> Visions refresh with every new answer set.
          </p>
        </div>
      </main>
    </div>
  );
};

export default CrystalBall;