// Budget.jsx
import React, { useState } from "react";
import api from "../utils/api";
import toast, { Toaster } from "react-hot-toast";
import AutocompleteInput from "../components/AutocompleteInput";
import {
  FiTrendingDown,
  FiCalendar,
  FiMapPin,
  FiUsers,
  FiNavigation,
  FiHome,
  FiClock,
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle
} from "react-icons/fi";
import { Train as LucideTrain } from "lucide-react";

const currencySymbol = (code = "INR") => {
  if (!code) return "₹";
  const upper = code.toUpperCase();
  switch (upper) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "INR":
    default:
      return "₹";
  }
};

const formatCurrency = (amount, code = "INR") => {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return "N/A";
  }
  return `${currencySymbol(code)}${amount.toLocaleString()}`;
};

const Budget = () => {
  const [origin, setOrigin] = useState("");
  const [originIata, setOriginIata] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationIata, setDestinationIata] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState("1");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // City code mapping for common cities (case-insensitive)
  const cityCodeMap = {
    'delhi': 'DEL',
    'mumbai': 'BOM',
    'bombay': 'BOM',
    'bangalore': 'BLR',
    'bengaluru': 'BLR',
    'chennai': 'MAA',
    'kolkata': 'CCU',
    'calcutta': 'CCU',
    'hyderabad': 'HYD',
    'pune': 'PNQ',
    'ahmedabad': 'AMD',
    'goa': 'GOI',
    'kochi': 'COK',
    'cochin': 'COK',
    'jaipur': 'JAI',
    'lucknow': 'LKO',
    'patna': 'PAT',
    'guwahati': 'GAU',
    'chandigarh': 'IXC',
    'amritsar': 'ATQ',
    'varanasi': 'VNS',
    'indore': 'IDR',
    'bhopal': 'BHO',
    'raipur': 'RPR',
    'nagpur': 'NAG',
    'vadodara': 'BDQ',
    'surat': 'STV',
    'rajkot': 'RAJ',
    'bhubaneswar': 'BBI',
    'visakhapatnam': 'VTZ',
    'coimbatore': 'CJB',
    'kozhikode': 'CCJ',
    'mangalore': 'IXE',
    'srinagar': 'SXR',
    'jammu': 'IXJ',
    'leh': 'IXL',
    'shimla': 'SLV',
    'manali': 'KUU',
    'dharamshala': 'DHM',
    'dehradun': 'DED',
    'udaipur': 'UDR',
    'jodhpur': 'JDH',
    'jaisalmer': 'JSA',
    'jabalpur': 'JLR',
    'gwalior': 'GWL',
    'bikaner': 'BKB'
  };

  // Convert input to IATA code
  const getCityCode = (place) => {
    if (!place) return '';
    const str = place.toString().trim();
    const upper = str.toUpperCase();
    
    // If it's already a 3-letter IATA code, use it directly
    if (/^[A-Z]{3}$/.test(upper)) return upper;
    
    // Otherwise map known city names (case-insensitive)
    const lower = str.toLowerCase();
    return cityCodeMap[lower] || upper;
  };

  // Handle origin change
  const handleOriginChange = (value) => {
    setOrigin(value);
    const iataCode = getCityCode(value);
    setOriginIata(iataCode);
  };

  // Handle destination change
  const handleDestinationChange = (value) => {
    setDestination(value);
    const iataCode = getCityCode(value);
    setDestinationIata(iataCode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!origin || !destination || !departureDate || !checkIn || !checkOut) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!originIata || !destinationIata) {
      toast.error("Please select valid cities from the suggestions");
      return;
    }

    const numAdults = Math.max(1, parseInt(adults, 10) || 1);

    setLoading(true);
    setResult(null);

    try {
      console.log("Making API request with params:", {
        origin: originIata,
        destination: destinationIata,
        date: departureDate,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: numAdults
      });

      const response = await api.get("/travel", {
        params: {
          origin: finalOriginIata,
          destination: finalDestinationIata,
          date: departureDate,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults: numAdults
        }
      });

      console.log("API Response:", response);

      if (response.data) {
        const formattedData = {
          flights: Array.isArray(response.data.flights) ? response.data.flights : [],
          hotels: Array.isArray(response.data.hotels) ? response.data.hotels : [],
          trains: Array.isArray(response.data.trains) ? response.data.trains : [],
          cheapestTrip: response.data.cheapestTrip || null
        };

        setResult(formattedData);
        toast.success("Travel data fetched successfully!");
      } else {
        console.error("No data in response");
        toast.error("No data received from server");
      }
    } catch (error) {
      console.error("API Error:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch travel data. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const cheapestTrip = result?.cheapestTrip || null;
  const transport = cheapestTrip?.transport;
  const hotel = cheapestTrip?.hotel;
  const TransportIcon = transport ? (transport.type === "train" ? LucideTrain : FiNavigation) : null;
  const transportTypeLabel = transport
    ? transport.type === "train"
      ? "Train"
      : transport.type === "flight"
        ? "Flight"
        : "Transport"
    : "Transport";
  const routeSummary = `${transport?.from || origin || originIata || "Origin"} → ${
    transport?.to || destination || destinationIata || "Destination"
  }`;
  const classLabel =
    transport?.details?.class ||
    transport?.details?.type ||
    transport?.details?.trainName ||
    (transport?.type === "train" ? "Preferred class" : "Cabin TBD");
  const summaryMetrics = [
    {
      label: "Flights surfaced",
      displayValue: (result?.flights?.length ?? 0).toLocaleString(),
      icon: FiNavigation,
      hint: "Pulled directly from Amadeus in real time."
    },
    {
      label: "Hotels matched",
      displayValue: (result?.hotels?.length ?? 0).toLocaleString(),
      icon: FiHome,
      hint: "Filtered for your stay window within the destination."
    },
    {
      label: "Trains computed",
      displayValue: (result?.trains?.length ?? 0).toLocaleString(),
      icon: LucideTrain,
      hint: "Indian Rail data with guaranteed fallback itineraries."
    },
    {
      label: "Cheapest bundle",
      displayValue: cheapestTrip ? formatCurrency(cheapestTrip.totalCost, cheapestTrip.currency) : "—",
      icon: FiTrendingDown,
      hint: cheapestTrip
        ? "Combined transport and stay estimate."
        : "Run a search to unlock the bundle."
    }
  ];
  const cheapestHighlights = Array.from(
    new Set(
      [
        transport?.duration ? `Travel time is approximately ${transport.duration}.` : null,
        transport?.provider ? `Operated by ${transport.provider}.` : null,
        hotel?.name
          ? `Stay at ${hotel.name}${hotel.location ? ` in ${hotel.location}` : ""}.`
          : null,
        hotel?.price ? `Nightly rate around ${formatCurrency(hotel.price, hotel.currency)}.` : null,
        cheapestTrip
          ? `Bundle total currently at ${formatCurrency(
              cheapestTrip.totalCost,
              cheapestTrip.currency
            )}.`
          : null
      ].filter(Boolean)
    )
  ).slice(0, 4);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_55%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(129,140,248,0.18),_transparent_55%)]"
        aria-hidden="true"
      />
      <Toaster position="top-right" />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
        <header className="max-w-3xl space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-white/60">
            <FiTrendingDown className="h-4 w-4 text-emerald-300" />
            Budget intelligence
          </span>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Plan smarter with live fares and instant savings cues.
          </h1>
          <p className="text-sm text-white/70 sm:text-base">
            Compare flights, trains and stays in real time. The Roundtable concierge orchestrates partner APIs and highlights
            the cheapest itinerary so you can brief your crew with confidence.
          </p>
        </header>

        <section className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_25px_60px_rgba(15,23,42,0.65)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Tune your search</h2>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/60">
                <FiClock className="h-4 w-4 text-emerald-200" />
                Under 10s
              </span>
            </div>
            <p className="mt-2 text-sm text-white/60">
              Set departure and stay details to pull real-time fares across airlines, rail and hotels.
            </p>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                    <FiMapPin className="h-4 w-4 text-emerald-200" />
                    Origin
                  </label>
                  <AutocompleteInput
                    value={origin}
                    onChange={(value) => {
                      setOrigin(value);
                      setOriginIata("");
                    }}
                    onIataCode={(code) => setOriginIata(code)}
                    placeholder="Start typing to select an origin city"
                    variant="dark"
                  />
                  <p className="text-[11px] text-white/50">Select a city from the suggestions to continue.</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                    <FiMapPin className="h-4 w-4 text-sky-200" />
                    Destination
                  </label>
                  <AutocompleteInput
                    value={destination}
                    onChange={(value) => {
                      setDestination(value);
                      setDestinationIata("");
                    }}
                    onIataCode={(code) => setDestinationIata(code)}
                    placeholder="Start typing to select a destination city"
                    variant="dark"
                  />
                  <p className="text-[11px] text-white/50">Pick a suggestion to lock in the right IATA code.</p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                    <FiCalendar className="h-4 w-4 text-emerald-200" />
                    Departure date
                  </label>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full rounded-2xl border border-white/15 bg-slate-900/50 px-4 py-3 text-white shadow-[0_10px_25px_rgba(15,23,42,0.55)] outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                      <FiCalendar className="h-4 w-4 text-sky-200" />
                      Check-in
                    </label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-slate-900/50 px-4 py-3 text-white shadow-[0_10px_25px_rgba(15,23,42,0.55)] outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                      <FiCalendar className="h-4 w-4 text-violet-200" />
                      Check-out
                    </label>
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-slate-900/50 px-4 py-3 text-white shadow-[0_10px_25px_rgba(15,23,42,0.55)] outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                  <FiUsers className="h-4 w-4 text-emerald-200" />
                  Crew size
                </label>
                <input
                  type="number"
                  value={adults}
                  min="1"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^\d+$/.test(value)) {
                      setAdults(value);
                    }
                  }}
                  onBlur={(e) => {
                    if (!e.target.value || isNaN(parseInt(e.target.value, 10)) || parseInt(e.target.value, 10) < 1) {
                      setAdults("1");
                    }
                  }}
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/50 px-4 py-3 text-white shadow-[0_10px_25px_rgba(15,23,42,0.55)] outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-white shadow-[0_25px_60px_rgba(14,165,233,0.45)] transition hover:shadow-[0_28px_75px_rgba(14,165,233,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Fetching best combos…" : "Reveal the deals"}
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_25px_60px_rgba(15,23,42,0.6)] backdrop-blur">
              <div className="flex items-center gap-3 text-white">
                <FiTrendingDown className="h-6 w-6 text-emerald-300" />
                <h3 className="text-xl font-semibold">Why travellers love this budget radar</h3>
              </div>
              <p className="mt-3 text-sm text-white/70">
                We synchronise Amadeus, hotel partners and Indian Rail APIs, then surface the cheapest combination ready for executive briefings.
              </p>
              <ul className="mt-6 space-y-4 text-sm text-white/70">
                <li className="flex items-start gap-3">
                  <FiCheckCircle className="mt-1 h-4 w-4 text-emerald-300" />
                  <span>Live airline pricing with itinerary metadata for easy comparison.</span>
                </li>
                <li className="flex items-start gap-3">
                  <FiCheckCircle className="mt-1 h-4 w-4 text-emerald-300" />
                  <span>Automatic train fallbacks to keep overland routes covered when APIs stall.</span>
                </li>
                <li className="flex items-start gap-3">
                  <FiCheckCircle className="mt-1 h-4 w-4 text-emerald-300" />
                  <span>Hotels aligned to your stay window with amenity callouts and pricing heuristics.</span>
                </li>
              </ul>

              {result ? (
                <div className="mt-7 rounded-2xl border border-emerald-300/40 bg-emerald-300/10 p-5 text-sm text-white/80">
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-100">Freshest deal</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {cheapestTrip ? formatCurrency(cheapestTrip.totalCost, cheapestTrip.currency) : "Search to reveal"}
                  </p>
                  <p className="mt-1 text-xs text-emerald-100/80">{routeSummary}</p>
                </div>
              ) : (
                <div className="mt-7 rounded-2xl border border-white/15 bg-white/10 p-5 text-sm text-white/70">
                  Start a search to let the Roundtable assemble your cheapest verified route.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/10 p-6 text-sm text-white/70 shadow-[0_18px_45px_rgba(15,23,42,0.45)] backdrop-blur">
              <div className="flex items-center gap-3 text-white">
                <FiAlertCircle className="h-5 w-5 text-amber-300" />
                <h4 className="text-base font-semibold">Need an orchestrated show?</h4>
              </div>
              <p className="mt-2">
                Feed these insights into the MCP planner to auto-build a cinematic itinerary with weather, events and day-flow choreography.
              </p>
            </div>
          </div>
        </section>

        {result && (
          <section className="mt-16 space-y-12">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="rounded-3xl border border-emerald-300/35 bg-emerald-400/10 p-8 shadow-[0_30px_80px_rgba(16,185,129,0.25)] backdrop-blur">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/45 bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-100">
                      Cheapest bundle
                    </span>
                    <h2 className="mt-4 text-3xl font-semibold text-white">Best-value route for your dates</h2>
                    <p className="mt-2 text-sm text-emerald-100/80">
                      Handpicked combination across transport and stay so you can share the savings instantly.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-emerald-300/40 bg-emerald-400/15 px-5 py-4 text-right">
                    <span className="text-xs uppercase tracking-[0.3em] text-emerald-100">Total estimate</span>
                    <p className="mt-2 text-4xl font-bold text-white">
                      {cheapestTrip ? formatCurrency(cheapestTrip.totalCost, cheapestTrip.currency) : "—"}
                    </p>
                    <p className="mt-1 text-xs text-emerald-100/80">
                      {transport?.price ? formatCurrency(transport.price, transport.currency) : "—"} travel · {hotel?.price ? formatCurrency(hotel.price, hotel.currency) : "Packed stay"}
                    </p>
                  </div>
                </div>

                {cheapestTrip ? (
                  <div className="mt-8 space-y-6">
                    <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-300/20 text-emerald-100">
                            {TransportIcon && <TransportIcon className="h-6 w-6" />}
                          </div>
                          <div className="space-y-2">
                            <p className="text-lg font-semibold text-white">
                              {transportTypeLabel} · {transport?.provider || "Best available"}
                            </p>
                            <p className="text-sm text-emerald-100/80">
                              {routeSummary}
                              <FiArrowRight className="ml-2 inline h-4 w-4 -translate-y-[2px]" />
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm text-emerald-100/80">
                          <p className="text-xs uppercase tracking-[0.3em]">Fare</p>
                          <p className="mt-1 text-xl font-semibold text-white">
                            {transport?.price ? formatCurrency(transport.price, transport.currency) : "Included"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-3 text-sm text-emerald-100/80">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em]">Departure</p>
                          <p className="mt-1 font-medium text-white">{transport?.departureTime || "Flexible"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em]">Arrival</p>
                          <p className="mt-1 font-medium text-white">{transport?.arrivalTime || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em]">Duration & class</p>
                          <p className="mt-1 font-medium text-white">
                            {(transport?.duration && transport.duration) || "—"} · {classLabel}
                          </p>
                        </div>
                      </div>
                    </div>

                    {hotel && (
                      <div className="rounded-2xl border border-white/20 bg-white/10 p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white">
                            <FiHome className="h-6 w-6" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-lg font-semibold text-white">{hotel.name}</p>
                                <p className="text-sm text-white/70">{hotel.location || destination || destinationIata || "Destination"}</p>
                              </div>
                              <div className="text-right text-sm text-white/70">
                                <p className="text-xs uppercase tracking-[0.3em]">Nightly</p>
                                <p className="mt-1 text-xl font-semibold text-white">
                                  {hotel.price ? formatCurrency(hotel.price, hotel.currency) : "Included"}
                                </p>
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs uppercase tracking-[0.3em] text-white/50">
                              <span>Check-in {hotel.checkIn || checkIn || "—"}</span>
                              <span>Check-out {hotel.checkOut || checkOut || "—"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-6 text-sm text-white/70">
                    Run a search to let the concierge recommend the strongest savings combo.
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_60px_rgba(15,23,42,0.45)] backdrop-blur">
                <h3 className="text-lg font-semibold text-white">Why this pick works</h3>
                <p className="mt-2 text-sm text-white/60">Extracted insights that make this bundle stand out.</p>
                <ul className="mt-5 space-y-4">
                  {cheapestHighlights.length ? (
                    cheapestHighlights.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm text-white/70">
                        <FiCheckCircle className="mt-1 h-4 w-4 text-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="flex items-start gap-3 text-sm text-white/70">
                      <FiAlertCircle className="mt-1 h-4 w-4 text-amber-300" />
                      <span>Search to see how we explain the recommended route.</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.4)] backdrop-blur"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs uppercase tracking-[0.3em] text-white/50">{metric.label}</span>
                    </div>
                    <p className="mt-4 text-2xl font-semibold text-white">{metric.displayValue}</p>
                    <p className="mt-1 text-xs text-white/60">{metric.hint}</p>
                  </div>
                );
              })}
            </div>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-white">Flight discoveries</h2>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/60">
                  <FiNavigation className="h-4 w-4 text-emerald-200" />
                  {(result.flights?.length ?? 0).toLocaleString()} options
                </span>
              </div>
              {result.flights?.length > 0 ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {result.flights.map((flight, i) => (
                    <article
                      key={i}
                      className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.45)] backdrop-blur"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {flight.details?.airline || flight.provider || "Flight"}
                          </h3>
                          <p className="text-sm text-white/60">
                            {flight.from} → {flight.to}
                          </p>
                        </div>
                        {flight.details?.class && (
                          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
                            {flight.details.class}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-white/70">
                        <div className="flex justify-between">
                          <span className="text-white/50">Departure</span>
                          <span className="font-medium text-white">{flight.details?.departureTime || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Arrival</span>
                          <span className="font-medium text-white">{flight.details?.arrivalTime || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Duration</span>
                          <span className="font-medium text-white">{flight.duration || "N/A"}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                        <div>
                          <span className="text-xs uppercase tracking-[0.3em] text-white/50">Price</span>
                          <p className="mt-1 text-lg font-semibold text-emerald-200">
                            {formatCurrency(flight.price, flight.currency)}
                          </p>
                        </div>
                        {flight.details?.flightNumber && (
                          <span className="rounded-full border border-emerald-200/40 bg-emerald-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">
                            {flight.details.flightNumber}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                  <div className="flex items-start gap-3">
                    <FiAlertCircle className="mt-1 h-4 w-4 text-amber-300" />
                    <span>No flights found for this selection. Try changing the dates or airports.</span>
                  </div>
                </div>
              )}
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-white">Hotel options</h2>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/60">
                  <FiHome className="h-4 w-4 text-sky-200" />
                  {(result.hotels?.length ?? 0).toLocaleString()} stays
                </span>
              </div>
              {result.hotels?.length > 0 ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {result.hotels.map((hotelCard, i) => (
                    <article
                      key={i}
                      className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.45)] backdrop-blur"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {hotelCard.details?.hotelName || hotelCard.name || "Hotel"}
                          </h3>
                          <p className="text-sm text-white/60">{hotelCard.location || destination}</p>
                        </div>
                        {hotelCard.details?.rating && (
                          <span className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-amber-200">
                            ⭐ {hotelCard.details.rating}
                          </span>
                        )}
                      </div>

                      {hotelCard.details?.amenities?.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/60">
                          {hotelCard.details.amenities.slice(0, 4).map((amenity, idx) => (
                            <span
                              key={idx}
                              className="rounded-full border border-white/15 bg-white/10 px-2 py-1"
                            >
                              {amenity}
                            </span>
                          ))}
                          {hotelCard.details.amenities.length > 4 && (
                            <span className="text-white/40">+{hotelCard.details.amenities.length - 4} more</span>
                          )}
                        </div>
                      )}

                      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                        <div>
                          <span className="text-xs uppercase tracking-[0.3em] text-white/50">Price per night</span>
                          <p className="mt-1 text-lg font-semibold text-emerald-200">
                            {formatCurrency(hotelCard.price, hotelCard.currency)}
                          </p>
                        </div>
                        <button className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/35 hover:text-white">
                          View deal
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                  <div className="flex items-start gap-3">
                    <FiAlertCircle className="mt-1 h-4 w-4 text-amber-300" />
                    <span>No hotels matched your stay window. Adjust the dates or destination to see fresh options.</span>
                  </div>
                </div>
              )}
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-white">Train coverage</h2>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/60">
                  <LucideTrain className="h-4 w-4 text-violet-200" />
                  {(result.trains?.length ?? 0).toLocaleString()} routes
                </span>
              </div>
              {result.trains?.length > 0 ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {result.trains.map((trainCard, i) => {
                    const details = trainCard.details || {};
                    const seatsAvailable = details.seatsAvailable || 0;
                    const isAvailable = seatsAvailable > 0;
                    return (
                      <article
                        key={i}
                        className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.45)] backdrop-blur"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              {details.trainName || "Train"} {details.trainNumber ? `(${details.trainNumber})` : ""}
                            </h3>
                            <p className="text-sm text-white/60">
                              {trainCard.from} ({trainCard.fromCode || ""}) → {trainCard.to} ({trainCard.toCode || ""})
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${
                              (details.class || "SL").toUpperCase() === "SL"
                                ? "border-purple-200/40 bg-purple-200/10 text-purple-100"
                                : "border-sky-200/40 bg-sky-200/10 text-sky-100"
                            }`}
                          >
                            {details.class || "SL"}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-white/70">
                          <div className="flex justify-between">
                            <span className="text-white/50">Departure</span>
                            <span className="font-medium text-white">{details.departureTime || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Arrival</span>
                            <span className="font-medium text-white">{details.arrivalTime || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Duration</span>
                            <span className="font-medium text-white">{trainCard.duration || "N/A"}</span>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                          <div>
                            <span className="text-xs uppercase tracking-[0.3em] text-white/50">Price</span>
                            <p className="mt-1 text-lg font-semibold text-emerald-200">
                              {formatCurrency(trainCard.price, trainCard.currency)}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${
                              isAvailable
                                ? "border border-emerald-200/40 bg-emerald-200/10 text-emerald-100"
                                : "border border-amber-200/40 bg-amber-200/10 text-amber-100"
                            }`}
                          >
                            {isAvailable ? `${seatsAvailable} seat${seatsAvailable !== 1 ? "s" : ""} left` : "Waitlist"}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                  <div className="flex items-start gap-3">
                    <FiAlertCircle className="mt-1 h-4 w-4 text-amber-300" />
                    <span>No trains available on those dates. Shift the travel day or choose alternate stations.</span>
                  </div>
                </div>
              )}
            </section>
          </section>
        )}
      </main>
    </div>
  );
};

export default Budget;
