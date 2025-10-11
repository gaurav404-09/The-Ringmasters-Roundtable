import React, { useState } from "react";

const clampRating = (value) => {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(5, value));
};

const parseRatingValue = (rating) => {
  if (rating === null || rating === undefined) return 0;
  if (typeof rating === 'number') return clampRating(rating);
  const match = `${rating}`.match(/\d+(?:\.\d+)?/);
  if (!match) return 0;
  return clampRating(parseFloat(match[0]));
};

const getStarFillAmount = (rating, index) => {
  const diff = clampRating(rating) - index;
  if (diff >= 1) return 1;
  if (diff <= 0) return 0;
  return diff;
};

const derivePriceLevel = (dest) => {
  if (dest?.price) return dest.price;
  const restaurantCount = dest?.restaurants?.length || 0;
  if (restaurantCount >= 12) return '$$$';
  if (restaurantCount >= 6) return '$$';
  if (restaurantCount > 0) return '$';
  return 'N/A';
};

const formatHighlightEntry = (item) => {
  if (!item) return null;
  if (typeof item === 'string') return item;
  const name = item.name || item.title;
  if (!name) return null;
  const type = item.type || item.tags?.tourism || item.cuisine;
  return type ? `${name} · ${type.toString().replace(/_/g, ' ')}` : name;
};

const dedupeList = (items = []) => {
  const seen = new Set();
  const result = [];
  items.forEach((item) => {
    if (!item) return;
    const key = item.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  });
  return result;
};

const normalizeHighlights = (dest) => {
  const provided = Array.isArray(dest?.highlights) ? dest.highlights.map(formatHighlightEntry) : [];
  const attractionHighlights = (Array.isArray(dest?.attractions) ? dest.attractions : [])
    .map(formatHighlightEntry);
  const restaurantHighlights = (Array.isArray(dest?.restaurants) ? dest.restaurants : [])
    .map((r) => formatHighlightEntry({ name: r?.name, type: r?.cuisine ? `${r.cuisine} cuisine` : 'culinary spot' }));

  const combined = [...provided, ...attractionHighlights, ...restaurantHighlights]
    .filter(Boolean)
    .slice(0, 6);

  return dedupeList(combined).slice(0, 4);
};

const normalizeCategories = (dest) => {
  if (dest?.categories) return dest.categories;
  const fallback = dest?.scores || {};
  return {
    food: fallback.food ?? 0,
    culture: fallback.culture ?? 0,
    adventure: fallback.adventure ?? 0,
    nightlife: fallback.nightlife ?? 0,
    shopping: fallback.shopping ?? 0,
  };
};

const deriveProsCons = (dest, ratingValue, avgTempNumeric) => {
  const providedPros = Array.isArray(dest?.pros) ? dest.pros : [];
  const providedCons = Array.isArray(dest?.cons) ? dest.cons : [];

  const attractionCount = dest?.attractions?.length || 0;
  const restaurantCount = dest?.restaurants?.length || 0;

  const inferPros = [];
  const inferCons = [];

  if (ratingValue && ratingValue >= 4.2) {
    inferPros.push('Travelers consistently rate this destination highly');
  } else if (ratingValue && ratingValue <= 3.2) {
    inferCons.push('Overall rating trails popular getaways');
  }

  if (attractionCount >= 20) {
    inferPros.push('Loaded with cultural highlights and attractions');
  } else if (attractionCount <= 3) {
    inferCons.push('Limited landmark spots to explore');
  }

  if (restaurantCount >= 10) {
    inferPros.push('Thriving food scene with plenty of options');
  } else if (restaurantCount > 0 && restaurantCount <= 2) {
    inferCons.push('Dining variety is fairly limited');
  }

  if (Number.isFinite(avgTempNumeric)) {
    if (avgTempNumeric >= 20 && avgTempNumeric <= 28) {
      inferPros.push('Comfortable weather window for outdoor plans');
    } else if (avgTempNumeric > 32) {
      inferCons.push('Expect noticeably hot daytime temperatures');
    } else if (avgTempNumeric < 10) {
      inferCons.push('Chilly climate — pack accordingly');
    }
  }

  if (dest?.weather?.description) {
    const desc = dest.weather.description.toLowerCase();
    if (desc.includes('rain')) {
      inferCons.push('Rain showers likely — build a flexible schedule');
    } else if (desc.includes('clear') || desc.includes('sun')) {
      inferPros.push('Skies look clear for sightseeing');
    }
  }

  const pros = dedupeList([...providedPros, ...inferPros]);
  const cons = dedupeList([...providedCons, ...inferCons]);

  if (pros.length === 0) {
    pros.push('Authentic destination with room to discover hidden gems');
  }
  if (cons.length === 0) {
    cons.push('Further research recommended — limited public data');
  }

  return { pros: pros.slice(0, 6), cons: cons.slice(0, 6) };
};

const normalizeDestination = (dest) => {
  if (!dest) return null;

  const ratingValue = dest.ratingValue ?? parseRatingValue(dest.rating ?? dest.scores?.overall ?? 0);
  const weather = dest.weather || {};
  const avgTempNumeric =
    typeof dest.avgTempValue === 'number'
      ? dest.avgTempValue
      : typeof weather.temp === 'number'
      ? weather.temp
      : Number.isFinite(parseFloat(dest.avgTemp))
      ? parseFloat(dest.avgTemp)
      : null;

  const { pros, cons } = deriveProsCons(dest, ratingValue, avgTempNumeric);
  const rawReviews = dest.reviews ?? (dest.attractions?.length || 0) + (dest.restaurants?.length || 0);
  const reviewsCount = Number.isFinite(Number(rawReviews)) ? Number(rawReviews) : null;

  return {
    ...dest,
    ratingValue,
    ratingDisplay: Number.isFinite(ratingValue) && ratingValue > 0 ? ratingValue.toFixed(2) : dest.rating || 'N/A',
    reviews: reviewsCount !== null ? reviewsCount.toString() : 'N/A',
    reviewsCount,
    price: derivePriceLevel(dest),
    categories: normalizeCategories(dest),
    highlights: normalizeHighlights(dest),
    pros,
    cons,
    avgTemp: avgTempNumeric !== null && !Number.isNaN(avgTempNumeric) ? `${Math.round(avgTempNumeric)}°C` : dest.avgTemp || 'N/A',
    avgTempValue: avgTempNumeric,
    weather: weather && weather.description ? weather : weather?.temp || weather?.description ? weather : null,
  };
};

const Compare = () => {
  const [destinations, setDestinations] = useState({});
  const [destination1Input, setDestination1Input] = useState("");
  const [destination2Input, setDestination2Input] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const quickPairs = [
    {
      id: 'paris-rome',
      label: 'Paris 🇫🇷 vs Rome 🇮🇹',
      destination1: 'Paris, France',
      destination2: 'Rome, Italy',
      badge: 'Art & Cuisine'
    },
    {
      id: 'bali-phuket',
      label: 'Bali 🇮🇩 vs Phuket 🇹🇭',
      destination1: 'Bali, Indonesia',
      destination2: 'Phuket, Thailand',
      badge: 'Tropical Getaways'
    },
    {
      id: 'tokyo-seoul',
      label: 'Tokyo 🇯🇵 vs Seoul 🇰🇷',
      destination1: 'Tokyo, Japan',
      destination2: 'Seoul, South Korea',
      badge: 'City Buzz'
    }
  ];

  const curatedSnapshots = [
    {
      title: 'Budget Breakdown',
      subtitle: 'Average 5-day trip cost',
      items: [
        { city: 'Bali', value: '$780', accent: 'bg-emerald-500/20 text-emerald-600' },
        { city: 'Phuket', value: '$910', accent: 'bg-sky-500/20 text-sky-600' }
      ],
      footer: 'Includes stay, meals, and city experiences.'
    },
    {
      title: 'Best Season Alert',
      subtitle: 'Ideal months to travel',
      items: [
        { city: 'Paris', value: 'Apr – Jun', accent: 'bg-rose-500/20 text-rose-600' },
        { city: 'Rome', value: 'Sep – Oct', accent: 'bg-amber-500/20 text-amber-600' }
      ],
      footer: 'Pleasant weather with lighter tourist rush.'
    },
    {
      title: 'Experience Vibes',
      subtitle: 'What travelers rave about',
      items: [
        { city: 'Tokyo', value: 'Tech, Culture, Street Food', accent: 'bg-indigo-500/20 text-indigo-600' },
        { city: 'Seoul', value: 'Fashion, Cafés, Nightlife', accent: 'bg-purple-500/20 text-purple-600' }
      ],
      footer: 'Source: Travel blogs & community polls.'
    }
  ];

  // Fetch comparison data from backend
  const fetchComparison = async (d1, d2) => {
    if (!d1.trim() || !d2.trim()) {
      setError('Please enter both destinations');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `http://localhost:3000/api/compare`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destination1: d1,
            destination2: d2,
          }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch comparison data');
      }

      const data = await res.json();
      const left = normalizeDestination(data.destination1);
      const right = normalizeDestination(data.destination2);

      setDestinations({
        left,
        right,
      });
      setActiveTab('overview');
    } catch (err) {
      console.error("Error fetching comparison:", err);
      setError(err.message || 'Failed to compare destinations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompare = () => {
    fetchComparison(destination1Input, destination2Input);
  };

  const handleQuickPairSelect = (pair) => {
    setDestination1Input(pair.destination1);
    setDestination2Input(pair.destination2);
    fetchComparison(pair.destination1, pair.destination2);
  };

  // Category comparison with visual bars
  const renderCategoryComparison = () => {
    const left = destinations.left;
    const right = destinations.right;
    
    if (!left || !right || !left.categories || !right.categories) return null;

    const categories = [
      { key: 'food', label: 'Food & Dining', icon: '🍽️', color: 'bg-red-500' },
      { key: 'culture', label: 'Culture & Heritage', icon: '🏛️', color: 'bg-amber-500' },
      { key: 'adventure', label: 'Adventure', icon: '🏔️', color: 'bg-green-500' },
      { key: 'nightlife', label: 'Nightlife', icon: '🌃', color: 'bg-purple-500' },
      { key: 'shopping', label: 'Shopping', icon: '🛍️', color: 'bg-blue-500' },
    ];

    return (
      <div className="space-y-6">
        {categories.map(cat => {
          const leftScore = left.categories[cat.key] || 0;
          const rightScore = right.categories[cat.key] || 0;
          const maxScore = 5;
          const leftPercent = (leftScore / maxScore) * 100;
          const rightPercent = (rightScore / maxScore) * 100;
          const winner = leftScore > rightScore ? 'left' : rightScore > leftScore ? 'right' : 'tie';

          return (
            <div key={cat.key} className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="font-semibold text-gray-700">{cat.label}</span>
                </div>
                <div className="text-sm text-gray-500">
                  {leftScore.toFixed(1)} vs {rightScore.toFixed(1)}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Left destination bar */}
                <div className="flex-1 flex justify-end">
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-full ${cat.color} transition-all duration-500 ${winner === 'left' ? 'opacity-100' : 'opacity-60'}`}
                      style={{ width: `${leftPercent}%`, marginLeft: 'auto' }}
                    ></div>
                  </div>
                </div>

                {/* Winner badge */}
                <div className="w-12 text-center">
                  {winner === 'left' && <span className="text-2xl">👈</span>}
                  {winner === 'right' && <span className="text-2xl">👉</span>}
                  {winner === 'tie' && <span className="text-2xl">🤝</span>}
                </div>

                {/* Right destination bar */}
                <div className="flex-1">
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-full ${cat.color} transition-all duration-500 ${winner === 'right' ? 'opacity-100' : 'opacity-60'}`}
                      style={{ width: `${rightPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const scoreCard = (dest) => {
    if (!dest) {
      return {
        rating: 0,
        categoryTotal: 0,
        venueCount: 0,
        priceIndex: 3,
      };
    }

    const rating = Number.isFinite(dest.ratingValue)
      ? dest.ratingValue
      : parseRatingValue(dest.rating ?? dest.scores?.overall ?? 0);

    const categories = dest.categories || {};
    const categoryTotal = Object.values(categories).reduce((acc, value) => acc + (Number(value) || 0), 0);

    const dataQuality = dest.dataQuality || {};
    const venueCount = Number(dataQuality.attractions || 0) + Number(dataQuality.restaurants || 0);

    const priceMap = { '$': 0, '$$': 1, '$$$': 2 };
    const priceIndex = priceMap[dest.price] ?? 3; // unknown treated as highest cost

    return { rating, categoryTotal, venueCount, priceIndex };
  };

  const getOverallWinner = () => {
    const left = destinations.left;
    const right = destinations.right;

    if (!left || !right) return null;

    const leftCard = scoreCard(left);
    const rightCard = scoreCard(right);

    const ratingDiff = leftCard.rating - rightCard.rating;
    if (Math.abs(ratingDiff) >= 0.05) {
      return ratingDiff > 0 ? 'left' : 'right';
    }

    const categoryDiff = leftCard.categoryTotal - rightCard.categoryTotal;
    if (Math.abs(categoryDiff) >= 0.4) {
      return categoryDiff > 0 ? 'left' : 'right';
    }

    const venueDiff = leftCard.venueCount - rightCard.venueCount;
    if (Math.abs(venueDiff) >= 3) {
      return venueDiff > 0 ? 'left' : 'right';
    }

    const priceDiff = leftCard.priceIndex - rightCard.priceIndex;
    if (priceDiff !== 0) {
      return priceDiff < 0 ? 'left' : 'right';
    }

    return 'tie';
  };

  const getWinnerReason = () => {
    const left = destinations.left;
    const right = destinations.right;
    if (!left || !right) return '';

    const winner = getOverallWinner();
    if (!winner) return '';

    const leftCard = scoreCard(left);
    const rightCard = scoreCard(right);

    const ratingDiff = leftCard.rating - rightCard.rating;
    if (Math.abs(ratingDiff) >= 0.05) {
      const leader = ratingDiff > 0 ? left : right;
      const margin = Math.abs(ratingDiff).toFixed(2);
      return `${leader.name} edges ahead on traveler score by ${margin} points.`;
    }

    const categoryDiff = leftCard.categoryTotal - rightCard.categoryTotal;
    if (Math.abs(categoryDiff) >= 0.4) {
      const leader = categoryDiff > 0 ? left : right;
      const margin = Math.abs(categoryDiff).toFixed(1);
      return `${leader.name} offers richer experiences across food, culture, adventure, nightlife, and shopping (total +${margin}).`;
    }

    const venueDiff = leftCard.venueCount - rightCard.venueCount;
    if (Math.abs(venueDiff) >= 3) {
      const leader = venueDiff > 0 ? left : right;
      return `${leader.name} currently surfaces ${Math.abs(venueDiff)} more verified venues for your plans.`;
    }

    const priceDiff = leftCard.priceIndex - rightCard.priceIndex;
    if (priceDiff !== 0) {
      const leader = priceDiff < 0 ? left : right;
      return `${leader.name} provides stronger value based on the detected price level.`;
    }

    return 'Scores are neck-and-neck across every metric we track.';
  };

  // Render destination card
  const renderDestinationCard = (dest, side) => {
    if (!dest) {
      return (
        <div className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-12 text-white/40 backdrop-blur-xl">
          Awaiting data…
        </div>
      );
    }

    const isWinner = getOverallWinner() === side;
    const ratingValue = Number.isFinite(dest.ratingValue)
      ? dest.ratingValue
      : parseRatingValue(dest.rating ?? dest.scores?.overall ?? 0);
    const ratingLabel = Number.isFinite(ratingValue) && ratingValue > 0
      ? ratingValue.toFixed(2)
      : dest.ratingDisplay || dest.rating || 'N/A';
    const reviewsCount = Number.isFinite(dest.reviewsCount)
      ? dest.reviewsCount
      : (() => {
          const parsed = Number.parseInt(dest.reviews, 10);
          return Number.isNaN(parsed) ? null : parsed;
        })();

    return (
      <div
        className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 text-white backdrop-blur-xl transition-all duration-500 hover:border-white/40 hover:bg-white/10 ${
          isWinner ? 'shadow-[0_30px_80px_rgba(250,204,21,0.35)]' : 'shadow-[0_25px_65px_rgba(15,23,42,0.45)]'
        }`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-60"
          style={{ background: 'radial-gradient(circle at top, rgba(59,130,246,0.45), transparent 55%)' }}
          aria-hidden="true"
        />

        {isWinner && (
          <div className="absolute -right-12 top-6 h-28 w-28 rotate-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-200 text-slate-900 shadow-xl">
            <div className="flex h-full w-full items-center justify-center text-3xl">🏆</div>
          </div>
        )}

        <div className="relative space-y-6">
          <div className="flex items-center justify-between text-sm text-white/60">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 uppercase tracking-[0.35em]">
              {isWinner ? 'CROWNED' : 'CONTENDER'}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <span className="text-white/40">Last updated</span>
              <span className="text-white/70">{dest.lastUpdated ? new Date(dest.lastUpdated).toLocaleDateString() : 'Live'}</span>
            </span>
          </div>

          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">{dest.name}</h2>
            {dest.description && <p className="mt-2 text-sm text-white/70">{dest.description}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="flex items-center gap-2 text-2xl">
              {[...Array(5)].map((_, i) => {
                const fill = getStarFillAmount(ratingValue, i);
                return (
                  <span key={i} className="relative inline-block text-white/10">
                    <span className="text-white/15">★</span>
                    {fill > 0 && (
                      <span
                        className="absolute left-0 top-0 overflow-hidden text-amber-300"
                        style={{ width: `${fill * 100}%` }}
                      >
                        ★
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">Traveler score</p>
              <p className="text-2xl font-bold text-white">{ratingLabel}</p>
              {Number.isFinite(reviewsCount) && reviewsCount > 0 && (
                <p className="text-xs text-white/60">Across {reviewsCount.toLocaleString()} venues</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/30 to-slate-900/30 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">💰</div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Price level</p>
                <p className="text-xl font-semibold text-white">{dest.price}</p>
                <p className="text-xs text-white/60">Estimated from dining & stay density</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/30 to-slate-900/30 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">🌡️</div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Avg climate</p>
                <p className="text-xl font-semibold text-white">{dest.avgTemp}</p>
                <p className="text-xs text-white/60">Powered by live OpenWeather data</p>
              </div>
            </div>
          </div>

          {dest.weather && (
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50">Current weather</p>
                  <p className="mt-1 text-sm capitalize text-white/80">{dest.weather.description}</p>
                </div>
                <span className="text-3xl">☀️</span>
              </div>
              {dest.weather.humidity !== 'N/A' && (
                <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-white/60">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-white/40">Humidity</span>
                    <p className="text-sm font-semibold text-white">{dest.weather.humidity}%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-white/40">Wind</span>
                    <p className="text-sm font-semibold text-white">{dest.weather.windSpeed} m/s</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {dest.highlights && dest.highlights.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/10 p-5">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <span className="text-lg">🌟</span>
                <span className="uppercase tracking-[0.35em]">Signature highlights</span>
              </div>
              <div className="space-y-2 text-sm text-white/80">
                {dest.highlights.slice(0, 4).map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-cyan-300">▹</span>
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-2xl border border-green-400/30 bg-green-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.35em] text-green-200">
                <span>Pros</span>
                <span className="text-lg">↑</span>
              </div>
              <ul className="space-y-2 text-xs text-green-100/80">
                {(dest.pros || []).map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-300">▹</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.35em] text-rose-200">
                <span>Cons</span>
                <span className="text-lg">↓</span>
              </div>
              <ul className="space-y-2 text-xs text-rose-100/80">
                {(dest.cons || []).map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-rose-300">▹</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_60%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(124,58,237,0.2),_transparent_65%)]" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10">
        <div className="flex flex-col items-center text-center text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            Destination Showdown
          </span>
          <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">Compare Worldwide Hotspots in Seconds</h1>
          <p className="mt-4 max-w-2xl text-base text-white/70">
            Discover which city fits your vibe. Blend real-time weather, food scenes, cultural energy, and crowd favorites into a single dazzling dashboard.
          </p>
        </div>

        {/* Input Section */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_35px_80px_rgba(15,23,42,0.45)]">
          <div className="grid grid-cols-1 gap-10 p-8 lg:grid-cols-[1.1fr_auto_1.1fr] lg:items-end">
            <div className="space-y-3">
              <label className="text-sm font-semibold uppercase tracking-[0.35em] text-white/70">
                First Destination
              </label>
              <input
                type="text"
                value={destination1Input}
                onChange={(e) => setDestination1Input(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCompare()}
                placeholder="Paris, France"
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-base text-white shadow-[0_20px_45px_rgba(15,23,42,0.35)] outline-none ring-0 transition focus:border-cyan-400/60 focus:bg-white/15"
              />
            </div>

            <div className="relative flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 text-2xl font-extrabold text-white shadow-[0_18px_35px_rgba(14,165,233,0.35)]">
                VS
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold uppercase tracking-[0.35em] text-white/70">
                Second Destination
              </label>
              <input
                type="text"
                value={destination2Input}
                onChange={(e) => setDestination2Input(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCompare()}
                placeholder="Tokyo, Japan"
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-base text-white shadow-[0_20px_45px_rgba(15,23,42,0.35)] outline-none ring-0 transition focus:border-violet-400/60 focus:bg-white/15"
              />
            </div>
          </div>

          <div className="flex flex-col gap-8 px-8 pb-10">
            <div className="flex flex-col items-center justify-between gap-4 text-sm text-white/70 lg:flex-row">
              <p>Swap between legendary duos instantly or script your own travel duel.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {quickPairs.map((pair) => (
                  <button
                    key={pair.id}
                    onClick={() => handleQuickPairSelect(pair)}
                    className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:bg-white/15 hover:text-white"
                  >
                    <span className="text-white/60 transition group-hover:text-white">✨</span>
                    <span>{pair.label}</span>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] tracking-[0.3em] text-white/70">
                      {pair.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <button
                onClick={handleCompare}
                disabled={isLoading || !destination1Input.trim() || !destination2Input.trim()}
                className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-10 py-4 text-lg font-semibold text-white shadow-[0_25px_55px_rgba(14,165,233,0.35)] transition hover:shadow-[0_32px_70px_rgba(14,165,233,0.45)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <svg className="h-6 w-6 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Summoning insights…</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">🔍</span>
                    <span>Compare Destinations</span>
                  </>
                )}
              </button>

              {error && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <span className="text-lg">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        {(destinations.left || destinations.right) && (
          <div className="mt-16 space-y-12">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_30px_80px_rgba(15,23,42,0.45)]">
              <div className="flex flex-col gap-4 border-b border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-500 text-2xl">🧭</span>
                  <div className="text-left">
                    <h2 className="text-lg font-semibold text-white">Interactive Overview</h2>
                    <p className="text-sm text-white/70">Dive into destination snapshots, scorecards, and curated highlights.</p>
                  </div>
                </div>
                <div className="flex gap-2 rounded-full border border-white/10 bg-white/10 p-1 text-sm text-white/70">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`rounded-full px-4 py-2 transition ${
                      activeTab === 'overview' ? 'bg-white/80 text-slate-900 shadow' : 'hover:bg-white/10'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('categories')}
                    className={`rounded-full px-4 py-2 transition ${
                      activeTab === 'categories' ? 'bg-white/80 text-slate-900 shadow' : 'hover:bg-white/10'
                    }`}
                  >
                    Categories
                  </button>
                </div>
              </div>

              <div className="p-6 lg:p-10">
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    {renderDestinationCard(destinations.left, 'left')}
                    {renderDestinationCard(destinations.right, 'right')}
                  </div>
                )}

                {activeTab === 'categories' && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <h3 className="text-3xl font-semibold text-white">Category Face-off</h3>
                      <p className="mt-2 text-sm text-white/60">Food vibes, cultural richness, nightlife pulse, and more — all benchmarked for your call.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 text-sm text-white/60 lg:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Left Challenger</p>
                        <p className="mt-2 text-lg font-semibold text-white">{destinations.left?.name}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Winner</p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {getOverallWinner() === 'tie' ? 'It’s a tie' : getOverallWinner() === 'left' ? destinations.left?.name : destinations.right?.name}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-right">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Right Challenger</p>
                        <p className="mt-2 text-lg font-semibold text-white">{destinations.right?.name}</p>
                      </div>
                    </div>
                    {renderCategoryComparison()}
                  </div>
                )}
              </div>
            </div>

            {getOverallWinner() && (
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/90 via-orange-500/90 to-rose-500/90 p-10 text-center text-white shadow-[0_35px_90px_rgba(249,115,22,0.35)]">
                {getOverallWinner() === 'tie' ? (
                  <>
                    <div className="text-6xl">🤝</div>
                    <h3 className="mt-4 text-3xl font-bold">It’s a draw!</h3>
                    <p className="mt-2 text-white/80">Both destinations bring magic to the table. Explore categories for deeper clues.</p>
                    {getWinnerReason() && (
                      <p className="mt-2 text-sm text-white/80">{getWinnerReason()}</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-6xl">🏆</div>
                    <h3 className="mt-4 text-3xl font-bold">
                      {getOverallWinner() === 'left' ? destinations.left?.name : destinations.right?.name} Clinches the Spotlight
                    </h3>
                    <p className="mt-2 text-white/80">Crowned after weighing ratings, experience density, venue volume, and value.</p>
                    {getWinnerReason() && (
                      <p className="mt-2 text-sm text-white/80">{getWinnerReason()}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!destinations.left && !destinations.right && !isLoading && (
          <div className="mt-16 space-y-12">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_30px_80px_rgba(15,23,42,0.45)]">
              <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-6 p-10 text-white">
                  <div className="text-6xl">🧳</div>
                  <h3 className="text-3xl font-semibold">Craft the ultimate travel face-off.</h3>
                  <p className="text-white/70">
                    Choose cities, compare the essentials, and get a cinematic briefing that helps your crew decide where to shine next.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">1</div>
                      <div>
                        <p className="text-sm font-semibold text-white">Summon your contenders</p>
                        <p className="text-xs text-white/70">City, country, or region — we’ll pull in detailed intel in seconds.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">2</div>
                      <div>
                        <p className="text-sm font-semibold text-white">Review the showdown tapes</p>
                        <p className="text-xs text-white/70">Ratings, nightlife, weather, and cost snapshots laid out in vibrant panels.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">3</div>
                      <div>
                        <p className="text-sm font-semibold text-white">Share the winning act</p>
                        <p className="text-xs text-white/70">Download highlights or plan the itinerary straight from your dashboard.</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-日本語"></div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60">Quick jump</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quickPairs.map((pair) => (
                        <button
                          key={`${pair.id}-primer`}
                          onClick={() => handleQuickPairSelect(pair)}
                          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:text-white"
                        >
                          {pair.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-10 text-white">
                  <div className="absolute -right-10 top-0 h-52 w-52 rounded-full bg-cyan-300/30 blur-3xl" aria-hidden="true" />
                  <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-amber-300/30 blur-3xl" aria-hidden="true" />
                  <div className="relative space-y-6">
                    <h4 className="text-4xl font-semibold leading-tight">Ringmaster-grade analytics, ready for every tour stop.</h4>
                    <p className="text-white/75">
                      Compare microclimates, dining density, and cultural weight with live data from OpenStreetMap and OpenWeather — tuned for wanderlust strategists.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Data Sources</p>
                        <p className="mt-2 text-lg font-bold">OpenStreetMap + OpenWeather</p>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Refresh Rate</p>
                        <p className="mt-2 text-lg font-bold">Live Fetch</p>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg白/10 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Comparisons</p>
                        <p className="mt-2 text-lg font-bold">Unlimited</p>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Insights</p>
                        <p className="mt-2 text-lg font-bold">Weather · Food · Culture</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-10 rounded-3xl border border白/10 bg-white/5 p-10 text-white backdrop-blur-xl">
              <h3 className="text-3xl font-semibold">Curated snapshots to ignite your planning</h3>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {curatedSnapshots.map((snapshot) => (
                  <div key={snapshot.title} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/10 p-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-white/50">{snapshot.subtitle}</p>
                      <h4 className="mt-2 text-xl font-semibold text-white">{snapshot.title}</h4>
                    </div>
                    <div className="space-y-3">
                      {snapshot.items.map((item) => (
                        <div key={`${snapshot.title}-${item.city}`} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${item.accent} bg-white/10`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{item.city}</span>
                            <span>{item.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-white/70">{snapshot.footer}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-white backdrop-blur-xl">
              <h3 className="text-3xl font-semibold">Try a themed battle royale</h3>
              <div className="mt-6 grid grid-cols-1 gap-8 text-sm text-white/70 md:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-start gap-4">
                  <span className="text-2xl">🏖️</span>
                  <div>
                    <p className="text-base font-semibold text-white">Beach vs. City Escapes</p>
                    <p>See how coastal calm stacks up against skyline thrills before you pack.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-2xl">🥾</span>
                  <div>
                    <p className="text-base font-semibold text-white">Adventure vs. Heritage</p>
                    <p>Balance cliff hikes with museum marathons to match your group’s energy.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-2xl">🍜</span>
                  <div>
                    <p className="text-base font-semibold text-white">Culinary Titans</p>
                    <p>From night markets to Michelin stars, find where your taste buds belong.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <p className="text-base font-semibold text-white">Nightlife Anthems</p>
                    <p>Compare party-friendly districts and after-hours legends around the world.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-2xl">🌿</span>
                  <div>
                    <p className="text-base font-semibold text-white">Eco-Friendly Getaways</p>
                    <p>Surface low-footprint travel picks with deep cultural payoffs.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-2xl">🛍️</span>
                  <div>
                    <p className="text-base font-semibold text-white">Shopping Sprees</p>
                    <p>Stack fashion capitals against artisan markets for a retail-ready showdown.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Compare;
