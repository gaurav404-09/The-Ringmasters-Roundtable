import React, { useState } from "react";

const Compare = () => {
  const [destinations, setDestinations] = useState({});
  const [destination1Input, setDestination1Input] = useState("");
  const [destination2Input, setDestination2Input] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

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
      setDestinations({
        left: data.destination1,
        right: data.destination2,
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

  // Overall winner calculation
  const getOverallWinner = () => {
    const left = destinations.left;
    const right = destinations.right;
    
    if (!left || !right) return null;

    const leftRating = parseFloat(left.rating) || 0;
    const rightRating = parseFloat(right.rating) || 0;

    if (leftRating > rightRating) return 'left';
    if (rightRating > leftRating) return 'right';
    return 'tie';
  };

  // Render destination card
  const renderDestinationCard = (dest, side) => {
    if (!dest) return <div className="text-gray-400 text-center py-8">No data</div>;

    const isWinner = getOverallWinner() === side;

    return (
      <div className={`bg-white rounded-xl shadow-lg overflow-hidden transition-all ${isWinner ? 'ring-4 ring-yellow-400' : ''}`}>
        {isWinner && (
          <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-center py-2 font-bold">
            🏆 WINNER 🏆
          </div>
        )}
        
        <div className="p-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">{dest.name}</h2>
          
          {/* Rating */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={`text-xl ${i < Math.floor(parseFloat(dest.rating)) ? 'text-yellow-400' : 'text-gray-300'}`}>
                  ⭐
                </span>
              ))}
            </div>
            <span className="text-lg font-semibold text-gray-700">{dest.rating}</span>
            <span className="text-sm text-gray-500">({dest.reviews} places)</span>
          </div>

          {/* Description */}
          <p className="text-gray-600 mb-4">{dest.description}</p>

          {/* Price & Weather */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-blue-600 font-semibold mb-1">PRICE LEVEL</div>
              <div className="text-2xl font-bold text-blue-700">{dest.price}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-xs text-orange-600 font-semibold mb-1">TEMPERATURE</div>
              <div className="text-2xl font-bold text-orange-700">{dest.avgTemp}</div>
            </div>
          </div>

          {/* Weather Details */}
          {dest.weather && (
            <div className="bg-sky-50 rounded-lg p-3 mb-4">
              <div className="text-sm font-semibold text-sky-900 mb-2">Current Weather</div>
              <div className="flex items-center gap-2 text-sky-700">
                <span className="text-2xl">☀️</span>
                <span className="capitalize">{dest.weather.description}</span>
              </div>
              {dest.weather.humidity !== 'N/A' && (
                <div className="text-xs text-sky-600 mt-1">
                  Humidity: {dest.weather.humidity}% • Wind: {dest.weather.windSpeed} m/s
                </div>
              )}
            </div>
          )}

          {/* Highlights */}
          {dest.highlights && dest.highlights.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-gray-700 mb-2">Top Attractions</h3>
              <div className="space-y-2">
                {dest.highlights.slice(0, 4).map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span className="text-gray-600">{h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pros & Cons */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-600 mb-2 text-sm">PROS</h4>
              <ul className="space-y-1">
                {(dest.pros || []).map((p, i) => (
                  <li key={i} className="flex items-start gap-1 text-xs text-gray-600">
                    <span className="text-green-500">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-600 mb-2 text-sm">CONS</h4>
              <ul className="space-y-1">
                {(dest.cons || []).map((c, i) => (
                  <li key={i} className="flex items-start gap-1 text-xs text-gray-600">
                    <span className="text-red-500">✗</span>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">
          Destination Showdown 🌍
        </h1>
        <p className="text-gray-600 text-center mb-8">Compare two destinations side-by-side</p>

        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
            <div className="md:col-span-3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                First Destination
              </label>
              <input
                type="text"
                value={destination1Input}
                onChange={(e) => setDestination1Input(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCompare()}
                placeholder="e.g., Paris, Tokyo, New York"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex items-center justify-center">
              <div className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-white text-lg font-bold shadow-lg">
                VS
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Second Destination
              </label>
              <input
                type="text"
                value={destination2Input}
                onChange={(e) => setDestination2Input(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCompare()}
                placeholder="e.g., London, Dubai, Mumbai"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={handleCompare}
              disabled={isLoading || !destination1Input.trim() || !destination2Input.trim()}
              className="px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-lg">Comparing...</span>
                </>
              ) : (
                <>
                  <span className="text-2xl">🔍</span>
                  <span className="text-lg">Compare Destinations</span>
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-xl flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results Section */}
        {(destinations.left || destinations.right) && (
          <>
            {/* Tabs */}
            <div className="bg-white rounded-t-2xl shadow-lg overflow-hidden">
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 py-4 px-6 font-semibold transition ${
                    activeTab === 'overview'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  �� Overview
                </button>
                <button
                  onClick={() => setActiveTab('categories')}
                  className={`flex-1 py-4 px-6 font-semibold transition ${
                    activeTab === 'categories'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  📈 Categories
                </button>
              </div>

              <div className="p-6 bg-gradient-to-br from-gray-50 to-white">
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {renderDestinationCard(destinations.left, 'left')}
                    {renderDestinationCard(destinations.right, 'right')}
                  </div>
                )}

                {activeTab === 'categories' && (
                  <div>
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">Category Comparison</h2>
                      <p className="text-gray-600">Head-to-head comparison across different categories</p>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                      <div className="text-center font-bold text-lg text-gray-700">
                        {destinations.left?.name}
                      </div>
                      <div className="text-center font-bold text-lg text-gray-500">
                        Winner
                      </div>
                      <div className="text-center font-bold text-lg text-gray-700">
                        {destinations.right?.name}
                      </div>
                    </div>

                    {renderCategoryComparison()}
                  </div>
                )}
              </div>
            </div>

            {/* Overall Winner Banner */}
            {getOverallWinner() && getOverallWinner() !== 'tie' && (
              <div className="mt-8 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 rounded-2xl shadow-2xl p-8 text-center text-white">
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-3xl font-bold mb-2">
                  {getOverallWinner() === 'left' ? destinations.left?.name : destinations.right?.name} Wins!
                </h2>
                <p className="text-xl opacity-90">
                  Based on overall ratings and available data
                </p>
              </div>
            )}

            {getOverallWinner() === 'tie' && (
              <div className="mt-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl shadow-2xl p-8 text-center text-white">
                <div className="text-6xl mb-4">🤝</div>
                <h2 className="text-3xl font-bold mb-2">
                  It's a Tie!
                </h2>
                <p className="text-xl opacity-90">
                  Both destinations are equally amazing!
                </p>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!destinations.left && !destinations.right && !isLoading && (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <div className="text-8xl mb-6">🌍</div>
            <h3 className="text-2xl font-bold text-gray-700 mb-2">Ready to Compare?</h3>
            <p className="text-gray-500 text-lg">Enter two destinations above to see how they stack up!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Compare;
