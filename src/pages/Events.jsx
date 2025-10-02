import React, { useState } from "react";

export default function EventRecommendations() {
  const [city, setCity] = useState("");
  const [dateRange, setDateRange] = useState("next week");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3000/api/events?city=${encodeURIComponent(city)}&dateRange=${encodeURIComponent(dateRange)}`
      );
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error("❌ Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">🎉 Event Recommendations</h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Enter city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="border p-2 rounded w-1/3"
        />
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="this weekend">This Weekend</option>
          <option value="next week">Next Week</option>
          <option value="next month">Next Month</option>
        </select>
        <button
          onClick={fetchEvents}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Search
        </button>
      </div>

      {loading && <p>Loading events...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map((event, i) => (
          <div key={i} className="border rounded-lg p-4 shadow">
            <h3 className="font-bold text-lg">{event.title}</h3>
            <p className="text-gray-600">{event.location}</p>
            <p>{event.date} • {event.time}</p>
            <p className="text-green-700">{event.price}</p>
            <p className="text-sm mt-2">{event.description}</p>
            <span className="inline-block mt-2 text-xs bg-gray-200 px-2 py-1 rounded">
              {event.category}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
