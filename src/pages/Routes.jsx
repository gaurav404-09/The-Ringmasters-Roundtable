import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ENV from "../config/env";
import {
  FaRoute,
  FaWalking,
  FaCar,
  FaBicycle,
  FaMapMarkerAlt,
  FaSearchLocation,
} from "react-icons/fa";
import MapView from "../components/MapView.jsx";
import polyline from "@mapbox/polyline";

const formatDistance = (meters) => `${(meters / 1000).toFixed(1)} km`;

const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return hrs > 0 ? `${hrs} hr ${mins} mins` : `${mins} mins`;
};

const RoutesPage = () => {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [travelMode, setTravelMode] = useState("driving");
  const [route, setRoute] = useState(null);
  const [routesData, setRoutesData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
  
    try {
      if (!origin.trim() || !destination.trim()) {
        throw new Error("Please enter both origin and destination");
      }
  
      const params = new URLSearchParams({
        origin: origin.trim(),
        destination: destination.trim(),
        mode: travelMode
      });
  
      const apiUrl = `${ENV.API_BASE_URL}/api/directions?${params}`;
      console.log("Making API request to:", apiUrl);
  
      const res = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        credentials: "include"
      });
  
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${res.status}`);
      }
  
      const data = await res.json();
  
      // ORS response validation
     // Validate server response
if (!data.routes || data.routes.length === 0) {
  throw new Error("No route found");
}

const routeObj = data.routes[0];

// Convert coordinates from [lon, lat] -> [lat, lon] for Leaflet
const coords = routeObj.geometry.coordinates.map(([lon, lat]) => [lat, lon]);


setRoute({
  distance: routeObj.distance,       // meters
  duration: routeObj.duration,       // seconds
  steps: routeObj.steps.map((s) => ({
    instruction: s.instruction,
    distance: s.distance
  })),
  coords
});

setRoutesData(data.routes); // store all routes

  
    } catch (err) {
      console.error("Error fetching directions:", err);
      setError(err.message || "Error fetching directions. Please try again later.");
      setRoute(null);
      setRoutesData(null);
    } finally {
      setLoading(false);
    }
  };
  

  const getTransportIcon = (mode) => {
    switch (mode) {
      case "walking":
        return <FaWalking className="text-2xl" />;
      case "driving":
        return <FaCar className="text-2xl" />;
      case "cycling":
        return <FaBicycle className="text-2xl" />;
      default:
        return <FaRoute className="text-2xl" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-light to-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-dark mb-8">
          Trailblazer's Pathways
        </h1>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden mb-8">
          <div className="p-6 bg-gradient-to-r from-green-600 to-green-700 text-white">
            <h2 className="text-2xl font-bold mb-4">Plan Your Journey</h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaMapMarkerAlt className="text-green-300" />
                  </div>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Starting point"
                    className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-300"
                    required
                  />
                </div>
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearchLocation className="text-green-300" />
                  </div>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Destination"
                    className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-300"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                {["driving", "walking", "cycling"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTravelMode(mode)}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      travelMode === mode
                        ? "bg-white text-green-700 shadow-md"
                        : "bg-white/20 hover:bg-white/30 text-white"
                    }`}
                  >
                    {getTransportIcon(mode)}
                    <span className="ml-2 capitalize">{mode}</span>
                  </button>
                ))}

                <button
                  type="submit"
                  className="ml-auto px-6 py-2 bg-yellow-400 text-gray-900 font-medium rounded-lg hover:bg-yellow-300 transition-colors duration-300 flex items-center"
                >
                  <FaRoute className="mr-2" />
                  Find Route
                </button>
              </div>
            </form>
          </div>

          <div className="p-6">
            {/* Loading & Error Messages */}
            {loading && <p className="text-blue-500 mb-4">Loading...</p>}
            {error && <p className="text-red-500 mb-4">{error}</p>}
            {/* Map Placeholder */}
            <MapView
              routeCoords={route?.coords}
              origin={origin}
              destination={destination}
            />
            {/* Route Summary */}
            {route && (
              <div className="bg-green-50 p-4 rounded-lg mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-lg">Recommended Route</h3>
                    <p className="text-sm text-gray-600">
                      Based on current conditions
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {formatDuration(route.duration)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatDistance(route.distance)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {route && (
              <div className="mt-6 text-center">
                <button
                  onClick={() =>
                    navigate("/trip-summary", {
                      state: {
                        route: {
                          origin,
                          destination,
                          coords: route.coords,
                          distance: route.distance, // meters
                          duration: route.duration, // seconds
                          steps: route.steps,
                        },
                      },
                    })
                  }
                  className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 transition-colors"
                >
                  View Trip Summary
                </button>
              </div>
            )}

            {/* Step-by-step Directions */}
            {route && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">
                  Step-by-step Directions
                </h3>
                <div className="space-y-4">
                  {route.steps.map((step, index) => (
                    <div key={index} className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 mt-1">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{step.instruction}</p>
                        <p className="text-sm text-gray-500">
                          {formatDistance(step.distance)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Alternative Routes */}
            {routesData?.length > 1 && (
              <div>
                <h3 className="text-xl font-semibold mb-4">
                  Alternative Routes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {routesData.slice(1).map((altRoute, index) => {
                    const leg = altRoute.legs[0];
                    return (
                      <div
                        key={index}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="font-medium mb-2">
                          Alternative {index + 1}
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>{leg.duration.text}</span>
                          <span>{leg.distance.text}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-dark mb-4">Travel Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start">
              <div className="bg-green-100 p-3 rounded-full mr-4">
                <FaCar className="text-xl text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold">Best Time to Travel</h4>
                <p className="text-sm text-gray-600">
                  Light traffic expected before 7 AM and after 7 PM.
                </p>
              </div>
            </div>
            {/* <div className="flex items-start">
              <div className="bg-blue-100 p-3 rounded-full mr-4">
                <FaTrain className="text-xl text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold">Public Transport</h4>
                <p className="text-sm text-gray-600">
                  Consider taking the train for a more relaxing journey.
                </p>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoutesPage;
