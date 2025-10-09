import { useEffect, useState } from 'react';
import { FaPaperPlane, FaStar, FaUsers } from 'react-icons/fa';

const initialState = {
  title: '',
  source: '',
  destination: '',
  tags: '',
  content: '',
  rating: 0,
  publishToCommunity: true,
};

const PostComposer = ({ isOpen, onClose, onSubmit, submitting, prefill = {} }) => {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState(null);

  const prefillSource = prefill?.source || '';
  const prefillDestination = prefill?.destination || '';

  const resetComposer = () => {
    setForm(initialState);
    setError(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRatingChange = (value) => {
    setForm((prev) => ({ ...prev, rating: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and story content are required.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      source: form.source.trim(),
      destination: form.destination.trim(),
      tags: form.tags,
      content: form.content.trim(),
      rating: form.rating,
      publishToCommunity: Boolean(form.publishToCommunity),
    };

    const success = await onSubmit(payload);
    if (success) {
      resetComposer();
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setForm((prev) => ({
      ...prev,
      source: prefillSource || prev.source,
      destination: prefillDestination || prev.destination,
    }));
  }, [prefillSource, prefillDestination, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-xl">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-[0_38px_120px_rgba(15,23,42,0.55)] dark:bg-slate-900">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
        <div className="flex items-center justify-between border-b border-white/10 px-8 py-5">
          <h2 className="text-lg font-semibold uppercase tracking-[0.28em] text-slate-700 dark:text-slate-100">
            Share Your Travel Story
          </h2>
          <button
            onClick={() => {
              resetComposer();
              onClose();
            }}
            className="rounded-full border border-white/20 bg-white/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 transition hover:bg-white/30"
          >
            Close
          </button>
        </div>

        <form className="space-y-6 px-8 py-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Trip Title</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                maxLength={120}
                placeholder="Wanderlust diaries from the hills..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Origin</label>
              <input
                name="source"
                value={form.source}
                onChange={handleChange}
                placeholder="Mumbai, India"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Destination</label>
              <input
                name="destination"
                value={form.destination}
                onChange={handleChange}
                placeholder="Goa, India"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tags</label>
            <input
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="beach, budget travel, family"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
            />
            <p className="text-xs text-slate-400">Separate tags with commas to help others find your story.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Trip Rating</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleRatingChange(value)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                >
                  <FaStar
                    className={
                      value <= form.rating
                        ? 'text-amber-400 drop-shadow-[0_2px_6px_rgba(251,191,36,0.45)]'
                        : 'text-slate-300'
                    }
                    size={22}
                  />
                </button>
              ))}
              <span className="text-xs text-slate-400">
                {form.rating ? `${form.rating} / 5` : 'Tap the stars to rate your experience'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Story</label>
            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              rows={6}
              placeholder="Tell us about the hidden gems, the must-try cuisine, and your travel hacks..."
              className="w-full rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm leading-relaxed text-slate-700 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
            />
          </div>

          <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/70">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Share with community</p>
              <p className="text-xs text-slate-400 dark:text-slate-300">
                Enable to feature this story in the community feed. Turn off to keep it private in your journal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, publishToCommunity: !prev.publishToCommunity }))}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition ${
                form.publishToCommunity
                  ? 'border-emerald-200 bg-emerald-100 text-emerald-600'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
              aria-pressed={form.publishToCommunity}
            >
              <FaUsers className="text-sm" />
              {form.publishToCommunity ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                resetComposer();
                onClose();
              }}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-5 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white shadow-[0_18px_42px_rgba(56,189,248,0.45)] transition hover:shadow-[0_22px_60px_rgba(56,189,248,0.55)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FaPaperPlane className="text-sm" />
              {submitting ? 'Posting...' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostComposer;
