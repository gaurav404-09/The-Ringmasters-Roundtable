import React, { useMemo, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import {
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaUsers,
  FaDollarSign,
  FaUtensils,
  FaLandmark,
  FaTree,
  FaCamera,
  FaMusic,
  FaShoppingBag,
  FaSpinner,
  FaTimes,
} from 'react-icons/fa';
import ENV from '../config/env';

const { API_BASE_URL } = ENV;

const INTERESTS = [
  { id: 'culture', name: 'Culture & History', icon: FaLandmark },
  { id: 'food', name: 'Food & Dining', icon: FaUtensils },
  { id: 'nature', name: 'Nature & Parks', icon: FaTree },
  { id: 'photography', name: 'Photography', icon: FaCamera },
  { id: 'nightlife', name: 'Nightlife & Entertainment', icon: FaMusic },
  { id: 'shopping', name: 'Shopping', icon: FaShoppingBag },
];

const BUDGET_OPTIONS = [
  { value: 'low', label: 'Budget ($)', description: 'Affordable options' },
  { value: 'medium', label: 'Moderate ($$)', description: 'Balanced comfort' },
  { value: 'high', label: 'Luxury ($$$)', description: 'Premium experiences' },
];

const formatDisplayDate = (value) => {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not set';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const ItineraryGenerator = ({ onItineraryGenerated, onClose }) => {
  const [formData, setFormData] = useState({
    destination: '',
    startDate: '',
    endDate: '',
    travelers: 1,
    budget: 'medium',
    interests: [],
    notes: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const tripLength = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diff = end - start;
    if (Number.isNaN(diff) || diff < 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [formData.startDate, formData.endDate]);

  const selectedBudget = useMemo(
    () => BUDGET_OPTIONS.find((option) => option.value === formData.budget) ?? BUDGET_OPTIONS[1],
    [formData.budget],
  );

  const selectedInterests = useMemo(
    () => INTERESTS.filter((interest) => formData.interests.includes(interest.id)),
    [formData.interests],
  );

  const canSubmit = Boolean(
    formData.destination.trim() &&
      formData.startDate &&
      formData.endDate &&
      tripLength > 0 &&
      formData.travelers > 0,
  );

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleInterest = (interestId) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interestId)
        ? prev.interests.filter((id) => id !== interestId)
        : [...prev.interests, interestId],
    }));
  };

  const validate = () => {
    if (!formData.destination.trim()) {
      setError('Destination is required');
      return false;
    }
    if (!formData.startDate || !formData.endDate) {
      setError('Select your start and end dates');
      return false;
    }
    if (tripLength <= 0) {
      setError('End date must be after start date');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setIsGenerating(true);

    try {
      const requestBody = {
        destination: formData.destination,
        days: tripLength,
        interests: formData.interests,
        startDate: formData.startDate,
        budget: formData.budget,
        travelers: formData.travelers,
        notes: formData.notes,
      };

      const response = await fetch(`${API_BASE_URL}/api/itinerary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = `Request failed (${response.status})`;
        try {
          const errorPayload = await response.json();
          errorMessage = errorPayload.error || errorPayload.message || errorMessage;
        } catch (parseError) {
          console.error('Unable to parse error response', parseError);
        }
        throw new Error(errorMessage);
      }

      const itinerary = await response.json();
      const enriched = {
        itinerary,
        request: requestBody,
        generatedAt: new Date().toISOString(),
      };
      onItineraryGenerated(enriched);
    } catch (err) {
      console.error('Error generating itinerary:', err);
      setError(err.message || 'Unable to generate itinerary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-6">
        <div className="text-center max-w-md w-full">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-3xl animate-pulse" />
            <div className="relative mx-auto h-60 w-60 sm:h-72 sm:w-72">
              <DotLottieReact
                src="https://lottie.host/35ef987b-1078-4aaa-9af3-142e71ee47a6/KPEvndzVkH.lottie"
                loop
                autoplay
                className="h-full w-full"
              />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white">Crafting Your Travel Story</h2>
          <p className="mt-3 text-white/70">Sit tight—your tailored itinerary is on its way.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950/90 py-10 px-4 sm:px-6 lg:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.25),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.25),_transparent_55%)]" />

      <div className="relative z-10 mx-auto max-w-5xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/12 bg-white/10 backdrop-blur-3xl shadow-[0_35px_60px_rgba(15,23,42,0.65)] p-6 sm:p-10 text-white"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Design Your Itinerary</h1>
              <p className="mt-2 text-sm font-medium text-white/70">
                Share a few preferences and we will stitch together a beautiful day-by-day plan.
              </p>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 transition-all hover:bg-white/20"
              >
                <FaTimes className="text-xs" />
                Close
              </button>
            )}
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-rose-300/40 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-8">
              <label className="group flex flex-col rounded-2xl border border-white/15 bg-white/8 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.4)]">
                <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">Destination</span>
                <div className="mt-3 flex items-center gap-3">
                  <FaMapMarkerAlt className="text-lg text-white/70" />
                  <input
                    type="text"
                    placeholder="e.g., Bali, Indonesia"
                    value={formData.destination}
                    onChange={(event) => handleInputChange('destination', event.target.value)}
                    className="w-full bg-transparent text-lg font-semibold text-white placeholder-white/40 focus:outline-none"
                  />
                </div>
              </label>

              <div className="grid gap-4 rounded-2xl border border-white/15 bg-white/8 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.35)] sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">Start Date</span>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <FaCalendarAlt className="text-white/70" />
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(event) => handleInputChange('startDate', event.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-white focus:outline-none"
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">End Date</span>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <FaCalendarAlt className="text-white/70" />
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(event) => handleInputChange('endDate', event.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-white focus:outline-none"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/8 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.35)]">
                  <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">Travelers</span>
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleInputChange('travelers', Math.max(1, formData.travelers - 1))}
                      className="h-12 w-12 rounded-full border border-white/20 bg-white/10 text-2xl font-bold text-white transition hover:bg-white/20"
                      aria-label="Decrease number of travelers"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={formData.travelers}
                      onChange={(event) => handleInputChange('travelers', Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                      className="w-full rounded-full border border-white/15 bg-white/10 py-3 text-center text-lg font-semibold text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleInputChange('travelers', formData.travelers + 1)}
                      className="h-12 w-12 rounded-full border border-white/20 bg-emerald-400 text-2xl font-bold text-slate-900 shadow-[0_15px_35px_rgba(16,185,129,0.45)] transition hover:-translate-y-0.5"
                      aria-label="Increase number of travelers"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/8 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.35)]">
                  <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">Budget Focus</span>
                  <div className="mt-4 grid gap-3">
                    {BUDGET_OPTIONS.map((option) => {
                      const isSelected = option.value === formData.budget;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleInputChange('budget', option.value)}
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? 'border-white/80 bg-white text-slate-900 shadow-[0_18px_45px_rgba(255,255,255,0.45)]'
                              : 'border-white/15 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-sm font-semibold">{option.label}</div>
                          <div className="text-xs text-white/60">{option.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/8 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.35)]">
                <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">Interests</span>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {INTERESTS.map(({ id, name, icon: Icon }) => {
                    const active = formData.interests.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleInterest(id)}
                        className={`flex h-full flex-col items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                          active
                            ? 'border-white/70 bg-white/80 text-slate-900 shadow-[0_18px_45px_rgba(255,255,255,0.45)]'
                            : 'border-white/15 bg-white/5 text-white/80 hover:border-white/35 hover:bg-white/10'
                        }`}
                      >
                        <Icon className={`text-lg ${active ? 'text-slate-900' : 'text-white/70'}`} />
                        <span className="text-sm font-semibold">{name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block rounded-2xl border border-white/15 bg-white/8 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.35)]">
                <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">Notes & Must-dos</span>
                <textarea
                  rows={4}
                  value={formData.notes}
                  onChange={(event) => handleInputChange('notes', event.target.value)}
                  placeholder="Share any must-see spot, dietary need, or vibe you want the trip to have."
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder-white/40 focus:outline-none"
                />
              </label>
            </div>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.35)]">
                <h2 className="text-sm font-semibold uppercase tracking-[0.4em] text-white/60">Trip Overview</h2>
                <div className="mt-4 space-y-4 text-sm text-white/85">
                  <div className="flex items-start gap-3">
                    <FaMapMarkerAlt className="mt-0.5 text-white/60" />
                    <div>
                      <div className="text-xs uppercase text-white/50">Destination</div>
                      <div className="text-sm font-semibold text-white">{formData.destination || 'Waiting for inspo'}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FaCalendarAlt className="mt-0.5 text-white/60" />
                    <div>
                      <div className="text-xs uppercase text-white/50">Dates</div>
                      <div className="text-sm font-semibold text-white">
                        {`${formatDisplayDate(formData.startDate)} → ${formatDisplayDate(formData.endDate)}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FaUsers className="mt-0.5 text-white/60" />
                    <div>
                      <div className="text-xs uppercase text-white/50">Travelers</div>
                      <div className="text-sm font-semibold text-white">{formData.travelers}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FaDollarSign className="mt-0.5 text-white/60" />
                    <div>
                      <div className="text-xs uppercase text-white/50">Budget</div>
                      <div className="text-sm font-semibold text-white">{selectedBudget.label}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FaCalendarAlt className="mt-0.5 text-white/60" />
                    <div>
                      <div className="text-xs uppercase text-white/50">Trip Length</div>
                      <div className="text-sm font-semibold text-white">{tripLength > 0 ? `${tripLength} days` : 'Add your dates'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.35)]">
                <h2 className="text-sm font-semibold uppercase tracking-[0.4em] text-white/60">Interests</h2>
                <div className="mt-4 space-y-2 text-sm text-white/80">
                  {selectedInterests.length > 0 ? (
                    selectedInterests.map(({ id, name }) => (
                      <div key={id} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                        <span>{name}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-white/50">No preferences selected yet.</p>
                  )}
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-medium uppercase tracking-[0.4em] text-white/50">
              {tripLength > 0 ? `${tripLength} DAY BLUEPRINT` : 'SET YOUR DATES TO CALCULATE LENGTH'}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/20"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!canSubmit || isGenerating}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-white px-8 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_18px_38px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? (
                  <>
                    <FaSpinner className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Itinerary'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItineraryGenerator;
