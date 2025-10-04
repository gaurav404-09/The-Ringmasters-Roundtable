import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import AutocompleteInput from '../components/AutocompleteInput';
import MapView from '../components/MapView';
import ENV from "../config/env";
import {
  FaRoute,
  FaWalking,
  FaCar,
  FaBicycle,
  FaMapMarkerAlt,
  FaSearchLocation
} from 'react-icons/fa';

const { API_BASE_URL, ORS_API_KEY } = ENV;

const RoutesPage = () => {
  // State management
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [travelMode, setTravelMode] = useState("driving");
  const [route, setRoute] = useState(null);
  const [routesData, setRoutesData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();

  // Handle initial load and location state from navigation
  useEffect(() => {
    if (initialLoad && location.state) {
      const { from, to } = location.state;
      if (from) setOrigin(from);
      if (to) setDestination(to);
      setInitialLoad(false);
    }
  }, [location.state, initialLoad]);

  // Format distance in kilometers
  const formatDistance = (meters) => `${(meters / 1000).toFixed(1)} km`;

  // Format duration in hours and minutes
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return hrs > 0 ? `${hrs} hr ${mins} mins` : `${mins} mins`;
  };

  // Get transport icon based on travel mode
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

  // Handle search form submission
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

      const apiUrl = `${API_BASE_URL}/api/directions?${params}`;
      const res = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-api-key": ORS_API_KEY
        },
        credentials: "include"
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      
      if (!data || !data.geometry?.coordinates || data.geometry.coordinates.length < 2) {
        throw new Error("No valid route could be calculated between these points");
      }

      // Convert coordinates from [lon, lat] -> [lat, lon] for Leaflet
      const coords = data.geometry.coordinates.map(([lon, lat]) => [lat, lon]);

      setRoute({
        distance: data.distance,
        duration: data.duration,
        steps: data.steps || [],
        coords
      });

      setRoutesData([data]);
    } catch (err) {
      console.error("Error fetching directions:", err);
      setError(err.message || "Error fetching directions. Please try again later.");
      setRoute(null);
      setRoutesData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
          Trailblazer's Pathways
        </h1>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden mb-8">
          <div className="p-6 bg-gradient-to-r from-green-600 to-green-700 text-white">
            <h2 className="text-2xl font-bold mb-4">Plan Your Journey</h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-20">
                    <FaMapMarkerAlt className="text-green-300" />
                  </div>
                  <AutocompleteInput
                    value={origin}
                    onChange={setOrigin}
                    placeholder="Starting point"
                    className="pl-10"
                  />
                </div>
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-20">
                    <FaSearchLocation className="text-green-300" />
                  </div>
                  <AutocompleteInput
                    value={destination}
                    onChange={setDestination}
                    placeholder="Destination"
                    className="pl-10"
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
            {loading && <p className="text-blue-500 mb-4">Loading...</p>}
            {error && <p className="text-red-500 mb-4">{error}</p>}
            
            <MapView
              routeCoords={route?.coords}
              origin={origin}
              destination={destination}
            />
            
            {route && (
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                  <div className="mb-4 md:mb-0">
                    <h3 className="font-bold text-xl text-gray-800">Recommended Route</h3>
                    <p className="text-gray-600 mt-1">
                      Based on current traffic conditions
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100 w-full md:w-auto">
                    <div className="flex items-center justify-between">
                      <div className="mr-6">
                        <p className="text-sm text-gray-600">Duration</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatDuration(route.duration)}
                        </p>
                      </div>
                      <div className="h-10 w-px bg-gray-200 mx-4"></div>
                      <div>
                        <p className="text-sm text-gray-600">Distance</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatDistance(route.distance)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {route && (
              <div className="mt-8 text-center">
                <button
                  onClick={() =>
                    navigate("/trip-summary", {
                      state: {
                        route: {
                          origin,
                          destination,
                          coords: route.coords,
                          distance: route.distance,
                          duration: route.duration,
                          steps: route.steps,
                        },
                      },
                    })
                  }
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  View Full Trip Summary →
                </button>
              </div>
            )}

            {route && (
              <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b border-gray-100">
                  Step-by-step Directions
                </h3>
                <div className="space-y-4">
                  {route.steps.map((step, index) => (
                    <div 
                      key={index} 
                      className="flex items-start p-3 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 font-medium flex items-center justify-center mr-4 mt-0.5">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{step.instruction}</p>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <span className="inline-flex items-center">
                            <svg className="mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatDistance(step.distance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
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
          <h3 className="text-xl font-bold text-gray-900 mb-4">Travel Tips</h3>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoutesPage;