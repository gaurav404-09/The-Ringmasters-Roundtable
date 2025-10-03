import React, { useState } from "react";
import axios from "axios";

const PlanTrip = () => {
  const [formData, setFormData] = useState({
    destination: "",
    origin: "",
    startDate: "",
    days: 1,
    budget: "medium",
    interests: [],
  });

  const [loading, setLoading] = useState(false);
  const [tripData, setTripData] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTripData(null);

    try {
      const response = await axios.post(
        "http://localhost:3000/api/plan-trip-mcp",
        formData
      );
      setTripData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Plan Your Trip</h1>

      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <div>
          <label className="block mb-1 font-medium">Origin</label>
          <input
            type="text"
            name="origin"
            value={formData.origin}
            onChange={handleChange}
            placeholder="Enter starting point"
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Destination</label>
          <input
            type="text"
            name="destination"
            value={formData.destination}
            onChange={handleChange}
            placeholder="Enter destination"
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Start Date</label>
          <input
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Days</label>
          <input
            type="number"
            name="days"
            min="1"
            value={formData.days}
            onChange={handleChange}
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Budget</label>
          <select
            name="budget"
            value={formData.budget}
            onChange={handleChange}
            className="border p-2 w-full"
          >
            <option value="low">Low ($)</option>
            <option value="medium">Medium ($$)</option>
            <option value="high">High ($$$)</option>
          </select>
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 mt-2 rounded"
          disabled={loading}
        >
          {loading ? "Planning..." : "Plan Trip"}
        </button>
      </form>

      {error && <p className="text-red-600">{error}</p>}

      {tripData && (
        <div className="space-y-6">
          {/* Weather Card */}
          <div className="border p-4 rounded shadow">
            <h2 className="font-bold text-xl mb-2">Weather Forecast</h2>
            <p>Temperature: {tripData.weather.temp}°C</p>
            <p>Condition: {tripData.weather.description}</p>
            <p>Humidity: {tripData.weather.humidity}</p>
            <p>Wind Speed: {tripData.weather.windSpeed}</p>
          </div>

          {/* Route Card */}
          <div className="border p-4 rounded shadow">
            <h2 className="font-bold text-xl mb-2">Route Details</h2>
            <p>Distance: {tripData.route.distance.toFixed(2)} km</p>
            <p>Duration: {(tripData.route.duration / 3600).toFixed(1)} hrs</p>
            <h3 className="font-semibold mt-2">Steps:</h3>
            <ol className="list-decimal ml-5">
              {tripData.route.steps.map((step, index) => (
                <li key={index}>
                  {step.instruction} ({(step.distance / 1000).toFixed(2)} km,{" "}
                  {(step.duration / 60).toFixed(0)} min)
                </li>
              ))}
            </ol>
          </div>

          {/* Budget Card */}
          <div className="border p-4 rounded shadow">
            <h2 className="font-bold text-xl mb-2">Estimated Budget</h2>
            <p>
              Estimated Cost: {tripData.budget.estimatedCost} {tripData.budget.budgetLevel}
            </p>
          </div>

          {/* Itinerary Card */}
          <div className="border p-4 rounded shadow">
            <h2 className="font-bold text-xl mb-2">Itinerary</h2>
            {tripData.itinerary.days.map((day) => (
              <div key={day.id} className="mb-4">
                <h3 className="font-semibold">{day.date}: {day.title}</h3>
                <ul className="list-disc ml-5">
                  {day.activities.map((act, idx) => (
                    <li key={idx}>
                      <strong>{act.time}</strong> - {act.title} ({act.duration}) | Notes: {act.notes}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanTrip;
