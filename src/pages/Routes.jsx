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
  const [comparedRoutes, setComparedRoutes] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [popularDestinations] = useState([
    'Mumbai, India',
    'Delhi, India',
    'Bangalore, India',
    'Hyderabad, India',
    'Chennai, India',
    'Kolkata, India',
    'Pune, India',
    'Jaipur, India'
  ]);
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

  // Format distance - API returns distance in kilometers
  const formatDistance = (distance) => {
    if (distance === undefined || distance === null) return 'N/A';
    // Convert to number in case it's a string
    const distanceNum = Number(distance);
    if (isNaN(distanceNum)) return 'N/A';
    return `${distanceNum.toFixed(1)} km`;
  };
  
  // Format duration in hours and minutes with better handling
  const formatDuration = (seconds) => {
    if (seconds === undefined || seconds === null) return 'N/A';
    // Convert to number in case it's a string
    const totalSeconds = Number(seconds);
    if (isNaN(totalSeconds)) return 'N/A';
    
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.round((totalSeconds % 3600) / 60);
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
  // Helper function to fetch a single route
  const fetchRoute = async (mode) => {
    const params = new URLSearchParams({
      origin: origin.trim(),
      destination: destination.trim(),
      mode: mode
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
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    if (!data || !data.geometry?.coordinates || data.geometry.coordinates.length < 2) {
      throw new Error(`No valid ${mode} route could be calculated`);
    }

    // Convert coordinates from [lon, lat] -> [lat, lon] for Leaflet
    const coords = data.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    
    // Extract distance from the API response
    // The API returns distance in kilometers
    let distance = data.distance || 0;
    
    // Extract duration - API returns duration in seconds
    let duration = data.duration || 0;
    
    const steps = data.steps || data.properties?.segments?.[0]?.steps || [];
    
    console.log('Extracted values:', { distance, duration, steps: steps.length });

    return {
      ...data,
      coords,
      distance,
      duration,
      steps,
      mode
    };
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!origin.trim() || !destination.trim()) {
        throw new Error("Please enter both origin and destination");
      }

      // Just fetch the selected travel mode
      const data = await fetchRoute(travelMode);
      
      setRoute({
        distance: data.distance,
        duration: data.duration,
        steps: data.steps || [],
        coords: data.coords,
        mode: data.mode
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

  // Toggle comparison mode
  const toggleComparison = async () => {
    // Toggle the comparison mode
    const newShowComparison = !showComparison;
    
    // If turning on comparison, fetch all route types
    if (newShowComparison && origin && destination) {
      setLoading(true);
      try {
        // Fetch all route types for comparison
        const modes = ["driving", "walking", "cycling"];
        const results = await Promise.all(
          modes.map(mode => 
            fetchRoute(mode).catch(err => {
              console.error(`Error fetching ${mode} route:`, err);
              return null;
            })
          )
        );

        const validResults = results.filter(Boolean);
        
        if (validResults.length === 0) {
          throw new Error("Could not calculate any routes for comparison");
        }

        // Set the first valid route as the main route
        const mainRoute = validResults[0];
        setRoute({
          distance: mainRoute.properties?.distance || mainRoute.distance,
          duration: mainRoute.properties?.duration || mainRoute.duration,
          steps: mainRoute.steps || [],
          coords: mainRoute.coords,
          mode: mainRoute.mode
        });

        // Update state
        setRoutesData(validResults);
        setComparedRoutes(validResults);
        setShowComparison(true);
      } catch (err) {
        console.error("Error in comparison:", err);
        setError(err.message || "Error comparing routes. Please try again.");
        setShowComparison(false);
      } finally {
        setLoading(false);
      }
    } else {
      // If turning off comparison, just update the state
      setShowComparison(false);
      
      // If we have a previous single route, restore it
      if (routesData && routesData.length > 0) {
        // Find the route that matches the current travel mode when exiting comparison
        const mainRoute = routesData.find(r => r.mode === travelMode) || routesData[0];
        if (mainRoute) {
          setRoute({
            distance: mainRoute.properties?.distance || mainRoute.distance,
            duration: mainRoute.properties?.duration || mainRoute.duration,
            steps: mainRoute.steps || [],
            coords: mainRoute.coords,
            mode: mainRoute.mode
          });
        }
      }
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
                      travelMode === mode && !showComparison
                        ? "bg-white text-green-700 shadow-md"
                        : "bg-white/20 hover:bg-white/30 text-white"
                    }`}
                    disabled={showComparison}
                  >
                    {getTransportIcon(mode)}
                    <span className="ml-2 capitalize">
                      {mode}
                      {showComparison && ' (in comparison)'}
                    </span>
                  </button>
                ))}

                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={toggleComparison}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
                      showComparison 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {showComparison ? 'Exit Comparison' : 'Compare Routes'}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-yellow-400 text-gray-900 font-medium rounded-lg hover:bg-yellow-300 transition-colors duration-300 flex items-center"
                  >
                    <FaRoute className="mr-2" />
                    Find Route
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="p-6">
            {loading && <p className="text-blue-500 mb-4">Loading...</p>}
            {error && <p className="text-red-500 mb-4">{error}</p>}
            
            {showComparison && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Popular Destinations</h3>
                <div className="flex flex-wrap gap-2">
                  {popularDestinations.map((city) => (
                    <button
                      key={city}
                      onClick={() => setDestination(city)}
                      className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-200 transition-colors"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <MapView
              routeCoords={route?.coords}
              origin={origin}
              destination={destination}
            />
            
            {showComparison && comparedRoutes.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-6">
                <h3 className="font-bold text-xl text-gray-800 mb-4">Compare Routes</h3>
                <p className="text-gray-600 text-sm mb-4">Click on a route to view it on the map</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {comparedRoutes.map((r) => (
                    <div 
                      key={r.mode}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        route.mode === r.mode 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        setRoute({
                          distance: r.properties?.distance || r.distance,
                          duration: r.properties?.duration || r.duration,
                          steps: r.steps || [],
                          coords: r.coords,
                          mode: r.mode
                        });
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-800 capitalize">
                          {r.mode === 'driving' ? 'By Car' : r.mode === 'walking' ? 'Walking' : 'By Bicycle'}
                        </h4>
                        <div className="p-1 rounded-full bg-green-100">
                          {getTransportIcon(r.mode)}
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Duration:</span>
                          <span className="font-medium">{formatDuration(r.duration)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Distance:</span>
                          <span className="font-medium">{formatDistance(r.distance)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {route && !showComparison && (
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                  <div className="mb-4 md:mb-0">
                    <h3 className="font-bold text-xl text-gray-800">Recommended Route</h3>
                    <p className="text-gray-600 mt-1">
                      {travelMode === 'driving' ? 'Fastest driving route' : 
                       travelMode === 'walking' ? 'Walking route' : 'Bicycle route'}
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
                  className="w-full mt-4 px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-center"
                >
                  View Full Trip Summary →
                </button>
              </div>
            )}
            
            {!showComparison && routesData?.length > 1 && (
              <div className="mt-6">
                <h3 className="text-xl font-semibold mb-4">
                  Alternative Routes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {routesData.slice(1).map((altRoute, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="font-medium mb-2">
                        Alternative {index + 1} ({altRoute.mode})
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{formatDuration(altRoute.duration)}</span>
                        <span>{formatDistance(altRoute.distance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Travel Tips Section */}
            <div className="mt-8 bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Travel Tips</h3>
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
                <div className="flex items-start">
                  <div className="bg-blue-100 p-3 rounded-full mr-4">
                    <FaWalking className="text-xl text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Walking Tips</h4>
                    <p className="text-sm text-gray-600">
                      Wear comfortable shoes and stay hydrated during long walks.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoutesPage;