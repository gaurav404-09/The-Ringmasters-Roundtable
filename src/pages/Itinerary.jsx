import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ItineraryGenerator from '../components/ItineraryGenerator';
import { 
  Calendar, 
  Plus, 
  MoreHorizontal, 
  Bed, 
  Route,
  RefreshCw, 
  MapPin,
  Clock,
  Info,
  CheckCircle,
  XCircle,
  AlertCircle,
  Camera,
  Utensils,
  Bus,
  Footprints,
  ShoppingBag,
  Ship
} from 'lucide-react';
import { 
  FaMapMarkerAlt, 
  FaRoute, 
  FaCalendarAlt, 
  FaDollarSign, 
  FaLandmark, 
  FaUtensils, 
  FaTree, 
  FaCamera, 
  FaMusic, 
  FaShoppingBag, 
  FaSpinner, 
  FaCheckCircle, 
  FaExclamationCircle,
  FaChevronDown,
  FaTimes
} from 'react-icons/fa';

// --- CALENDAR SYNC CONFIGURATION ---
const API_BASE_URL = "https://api.us.nylas.com/v3";
// Fallbacks for when environment variables are not defined
const FALLBACK_API_KEY = "MOCK_KEY_API_KEY_PLACEHOLDER";
const FALLBACK_GRANT_ID = "MOCK_GRANT_ID_PLACEHOLDER";
const FALLBACK_CALENDAR_ID = "primary";
const FALLBACK_USER_EMAIL = "user@example.com";

// Load credentials from environment/global context or use fallbacks
const API_KEY = typeof __NYLAS_API_KEY !== "undefined" ? __NYLAS_API_KEY : FALLBACK_API_KEY;
const GRANT_ID = typeof __NYLAS_GRANT_ID !== "undefined" ? __NYLAS_GRANT_ID : FALLBACK_GRANT_ID;
const CALENDAR_ID = typeof __NYLAS_CALENDAR_ID !== "undefined" ? __NYLAS_CALENDAR_ID : FALLBACK_CALENDAR_ID;
const USER_EMAIL = typeof __NYLAS_USER_EMAIL !== "undefined" ? __NYLAS_USER_EMAIL : FALLBACK_USER_EMAIL;
const IS_MOCK_MODE = !API_KEY || API_KEY === FALLBACK_API_KEY || !GRANT_ID || GRANT_ID === FALLBACK_GRANT_ID;

// Helper function to convert date and time to Unix timestamp
const getUnixTimestamp = (dateStr, timeStr = '12:00') => {
  if (!dateStr) return Math.floor(Date.now() / 1000);
  
  // Parse the date string (format: "Month Day, Year") and time string (format: "HH:MM AM/PM")
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return Math.floor(Date.now() / 1000);
  
  // Parse time if provided
  if (timeStr) {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    date.setHours(hours, minutes || 0, 0, 0);
  }
  
  return Math.floor(date.getTime() / 1000);
};

// Implements exponential backoff for API retries
const withExponentialBackoff = async (apiCall, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      console.warn(`Attempt ${attempt + 1} failed. Retrying in ${Math.round(delay / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

const Itinerary = () => {
  const location = useLocation();
  const { state } = location;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentItinerary, setCurrentItinerary] = useState(null);
  const [showGenerator, setShowGenerator] = useState(true);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  
  // Calendar sync state
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncingActivityId, setSyncingActivityId] = useState(null);
  const [activeDay, setActiveDay] = useState(null);
  const [itineraryData, setItineraryData] = useState(null);

  // Load itinerary data from location state or API
  useEffect(() => {
    if (state?.itinerary) {
      setItineraryData(state.itinerary);
      setCurrentItinerary(state.itinerary);
      if (state.itinerary.days?.length > 0) {
        setActiveDay(state.itinerary.days[0].id);
      }
    }
  }, [state]);

  // Get current location when component mounts
  useEffect(() => {
    const getLocation = async () => {
      try {
        const position = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser"));
          } else {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          }
        });

        const { latitude, longitude } = position.coords;
        setCurrentLocation(`${latitude},${longitude}`);
      } catch (error) {
        console.error("Error getting current location:", error);
        toast.warn(
          "Could not get your current location. You can still get directions by entering your starting point manually."
        );
      }
    };

    getLocation();
  }, []);

  // Helper to safely parse duration string (e.g., "2h 30m" -> minutes)
  const parseDurationToMinutes = (durationStr) => {
    if (!durationStr) return 60; // Default to 1 hour

    let totalMinutes = 0;
    const parts = durationStr.match(/(\d+h)?\s*(\d+m)?/);

    if (parts) {
      if (parts[1]) {
        totalMinutes += parseInt(parts[1].replace("h", "")) * 60;
      }
      if (parts[2]) {
        totalMinutes += parseInt(parts[2].replace("m", ""));
      }
    }
    return totalMinutes > 0 ? totalMinutes : 60; // Ensure positive duration
  };

  /**
   * Syncs a single activity to the calendar using the Nylas API.
   * @param {object} activity The activity object from the itinerary.
   * @param {string} activityDate The full date string (e.g., "June 15, 2023").
   * @param {boolean} isBulkCall Flag to control UI state setting behavior. <--- ADDED isBulkCall ARGUMENT
   */
  const handleSyncActivityToCalendar = useCallback(
    async (activity, activityDate, isBulkCall = false) => {
      if (!isBulkCall) {
        // Only set these states if this is a single, direct click
        setSyncStatus(null);
        setSyncingActivityId(activity.id);
        setSyncLoading(true);
      }

      const startTimestamp = getUnixTimestamp(activityDate, activity.time);

      // Calculate End Time: Add duration to start time
      const durationMinutes = parseDurationToMinutes(activity.duration);
      const endDate = new Date(
        startTimestamp * 1000 + durationMinutes * 60 * 1000
      );
      const endTimestamp = Math.floor(endDate.getTime() / 1000);

      // Get the current local timezone for the API request
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        "America/Los_Angeles";

      if (startTimestamp >= endTimestamp) {
        const errorMsg = `Time Error: Event duration is zero or negative for activity "${activity.title}".`;
        if (!isBulkCall) {
          setSyncStatus({ type: "error", message: errorMsg });
          setSyncLoading(false);
          setSyncingActivityId(null);
        }
        toast.error(errorMsg);
        return { success: false, message: errorMsg };
      }

      // Use globally defined constants
      const currentApiKey = API_KEY;
      const currentGrantId = GRANT_ID;
      const currentUserEmail = USER_EMAIL;
      const isMock = IS_MOCK_MODE;

      const eventPayload = {
        title: activity.title,
        description: `${activity.notes || "No description."}\n\nLocation: ${
          activity.location || "N/A"
        }\nReference: ${activity.bookingRef || "N/A"}`,
        location: activity.location || "",
        busy: true,
        when: {
          object: "timespan",
          start_time: startTimestamp,
          end_time: endTimestamp,
          start_timezone: timezone,
          end_timezone: timezone,
        },
        // Standard set of reminders for any synced activity
        reminders: {
          popup_reminders: [{ minutes: 30 }], // 30 minutes before
          email_reminders: [{ minutes: 1440 }], // 24 hours before
        },
        participants: [
          {
            email: currentUserEmail,
            name: "Itinerary User",
            status: "yes",
          },
        ],
      };

      const apiCall = async () => {
        if (isMock) {
          console.warn(
            "MOCK MODE: Simulating successful calendar event creation. Update environment variables for LIVE sync."
          );
          await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network latency
          const mockEventId =
            "event-" + crypto.randomUUID().split("-").join("");
          return { data: { id: mockEventId, title: eventPayload.title } };
        }

        console.log(
          `LIVE MODE: Attempting to create event for Grant ID: ${currentGrantId} on Calendar ID: ${CALENDAR_ID}`
        );

        const response = await fetch(
          `${API_BASE_URL}/grants/${currentGrantId}/events?calendar_id=${CALENDAR_ID}&notify_participants=true`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${currentApiKey}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(eventPayload),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Nylas API Error:", errorData);
          // This is the error that occurs when the keys are invalid or lack permission!
          throw new Error(
            errorData.error?.message ||
              `API failed with status ${response.status}`
          );
        }

        return await response.json();
      };

      let syncResult = { success: false, message: "" };

      try {
        const result = await withExponentialBackoff(apiCall);
        syncResult = {
          success: true,
          message: `Synced "${activity.title}" successfully!`,
        };
        toast.success(syncResult.message);
      } catch (error) {
        syncResult = {
          success: false,
          message: `Sync failed for "${activity.title}". Details: ${error.message}`,
        };
        toast.error(syncResult.message);
      } finally {
        if (!isBulkCall) {
          // <--- ONLY UPDATE SINGLE-SYNC STATES IF NOT A BULK CALL
          setSyncLoading(false);
          setSyncingActivityId(null);
          setSyncStatus({
            type: syncResult.success ? "success" : "error",
            message: syncResult.message,
          });
        }
        return syncResult; // Always return result for bulk handler
      }
    },
    [API_KEY, GRANT_ID, USER_EMAIL, CALENDAR_ID, IS_MOCK_MODE]
  ); // Dependencies are necessary for useCallback safety

  /**
   * NEW HANDLER: Iterates through all activities and syncs them sequentially.
   */
  const handleSyncAllActivitiesToCalendar = async () => {
    setSyncingAll(true);
    setSyncStatus(null);
    let successCount = 0;
    let failCount = 0;

    // Flatten all activities into a single list
    const allActivities = displayItinerary.days.flatMap((day) =>
      day.activities.map((activity) => ({
        ...activity,
        activityDate: day.date, // Attach the date to the activity object
      }))
    );

    if (allActivities.length === 0) {
      setSyncStatus({ type: "error", message: "No activities found to sync." });
      setSyncingAll(false);
      return;
    }

    toast.info(`Starting bulk sync of ${allActivities.length} events...`);

    for (const activity of allActivities) {
      // Call the single sync handler with the bulk flag set to true
      const result = await handleSyncActivityToCalendar(
        activity,
        activity.activityDate,
        true
      );

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    const finalMessage = `Bulk Sync Complete: ${successCount} successful, ${failCount} failed.`;
    setSyncStatus({
      type: failCount === 0 ? "success" : "error",
      message: finalMessage,
    });
    setSyncingAll(false);
  };

  const handleGetDirections = async () => {
    if (!currentItinerary?.destination) return;

    // SIMULATED NAVIGATION LOGIC: Replaced 'navigate' with toasts and console logs.
    const destination = currentItinerary.destination;

    // If we already have the current location, use it
    if (currentLocation) {
      console.log(
        `Simulated navigation to /routes from ${currentLocation} to ${destination}`
      );
      toast.info(`Simulating directions from your location to ${destination}.`);
      return;
    }

    // Otherwise, try to get the current location
    setIsGettingLocation(true);

    try {
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser"));
        } else {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        }
      });

      const { latitude, longitude } = position.coords;
      const locationString = `${latitude},${longitude}`;
      setCurrentLocation(locationString);

      // Simulate Navigation to Routes page with location data
      console.log(
        `Simulated navigation to /routes from ${locationString} to ${destination}`
      );
      toast.info(`Simulating directions from your location to ${destination}.`);
    } catch (error) {
      console.error("Error getting location:", error);
      toast.error(
        "Could not get your location. You can still get directions by entering your starting point manually."
      );

      // If location access is denied, still simulate navigation but with only the destination
      console.log(
        `Simulated navigation to /routes with destination only: ${destination}`
      );
      toast.info(
        `Simulating directions lookup for destination: ${destination}.`
      );
    } finally {
      setIsGettingLocation(false);
    }
  };
  
  const displayItinerary = currentItinerary;
  const days = Array.isArray(displayItinerary?.days) ? displayItinerary.days : [];

  const accommodations = useMemo(() => {
    const stays = [];
    const seen = new Set();
    days.forEach((day) => {
      (day.activities || []).forEach((activity) => {
        if (activity?.type === 'hotel' && activity.title) {
          const key = activity.title.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            stays.push({
              title: activity.title,
              location: activity.location,
              notes: activity.notes,
              dayId: day.id,
              time: activity.time,
            });
          }
        }
      });
    });
    return stays;
  }, [days]);

  const topAttractions = useMemo(() => {
    const attractions = [];
    const seen = new Set();
    const attractionTypes = new Set(['sightseeing', 'tour', 'activity']);
    days.forEach((day) => {
      (day.activities || []).forEach((activity) => {
        if (activity?.title && attractionTypes.has(activity.type)) {
          const key = activity.title.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            attractions.push({
              title: activity.title,
              location: activity.location,
              notes: activity.notes,
              dayId: day.id,
              time: activity.time,
            });
          }
        }
      });
    });
    return attractions;
  }, [days]);

  const transportSegments = useMemo(() => {
    const relevantTypes = new Set(['flight', 'transfer', 'boat', 'train', 'bus', 'walking']);
    const segments = [];
    days.forEach((day) => {
      (day.activities || []).forEach((activity) => {
        if (activity?.title && relevantTypes.has(activity.type)) {
          segments.push({
            title: activity.title,
            location: activity.location,
            notes: activity.notes,
            dayId: day.id,
            time: activity.time,
            type: activity.type,
          });
        }
      });
    });
    return segments;
  }, [days]);

  const quickStats = useMemo(() => {
    let activities = 0;
    let reservations = 0;
    let dining = 0;
    days.forEach((day) => {
      (day.activities || []).forEach((activity) => {
        activities += 1;
        if (['reserved', 'booked', 'confirmed'].includes((activity.status || '').toLowerCase())) {
          reservations += 1;
        }
        if (activity.type === 'meal') {
          dining += 1;
        }
      });
    });
    return {
      activities,
      reservations,
      dining,
      attractions: topAttractions.length,
      days: days.length,
    };
  }, [days, topAttractions.length]);

  const selectedDay = days.find(day => day.id === activeDay) || days[0] || null;

  const handleItineraryGenerated = async (payload) => {
    const { itinerary: generatedItinerary, request, generatedAt } = payload || {};
    const itinerary = generatedItinerary || payload;

    setCurrentItinerary(itinerary);
    setShowGenerator(false);
    setActiveDay(1);
  };
  
  const getActivityIcon = (type) => {
    switch (type) {
      case "flight":
        return <Plane className="text-blue-500" />;
      case "hotel":
        return <Bed className="text-purple-500" />;
      case "meal":
        return <Utensils className="text-red-500" />;
      case "transfer":
        return <Bus className="text-green-500" />;
      case "tour":
      case "sightseeing":
        return <Camera className="text-green-600" />;
      case "activity":
        return <Footprints className="text-amber-500" />;
      case "shopping":
        return <ShoppingBag className="text-pink-500" />;
      case "boat":
        return <Ship className="text-blue-500" />;
      default:
        return <MoreHorizontal className="text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    if (!status) return null;

    const statusStyles = {
      confirmed: "bg-green-100 text-green-800",
      reserved: "bg-blue-100 text-blue-800",
      booked: "bg-purple-100 text-purple-800",
      pending: "bg-yellow-100 text-yellow-800",
      cancelled: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
          statusStyles[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatLabel = (value) => {
    if (!value || typeof value !== 'string') return '';
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  // Status indicator component using Lucide React icons
  const SyncStatusIndicator = useMemo(() => {
    if (!syncStatus) return null;

    const Icon = syncStatus.type === "success" ? CheckCircle : XCircle;
    const color =
      syncStatus.type === "success"
        ? "bg-green-100 border-green-400 text-green-700"
        : "bg-red-100 border-red-400 text-red-700";

    return (
      <div
        className={`mt-6 p-3 rounded-xl border flex items-start space-x-3 transition-all ${color} text-sm`}
      >
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p className="font-medium">{syncStatus.message}</p>
      </div>
    );
  }, [syncStatus]);

  if (showGenerator) {
    return (
      <ItineraryGenerator onItineraryGenerated={handleItineraryGenerated} />
    );
  }

  // Add safety check for selectedDay
  if (!selectedDay) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Loading Itinerary...
          </h2>
          <p className="text-gray-600">
            Please wait while we load your travel plans.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.28),_transparent_60%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(236,72,153,0.18),_transparent_65%)]"
        aria-hidden="true"
      />
      <main className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-8 lg:px-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-start mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
              {displayItinerary.destination}
            </h1>
            <p className="text-gray-600">
              {displayItinerary.travelDates} • {displayItinerary.duration} •{" "}
              {displayItinerary.travelers}{" "}
              {displayItinerary.travelers > 1 ? "Travelers" : "Traveler"}
            </p>
            {displayItinerary.aiGenerated && displayItinerary.interests && displayItinerary.interests.length > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-4 py-2 text-sm">
                <span className="text-lg">🤖</span>
                <span className="text-purple-200 font-medium">
                  AI-Personalized for: {displayItinerary.interests.join(', ')}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <button
              onClick={handleGetDirections}
              disabled={isGettingLocation || syncLoading || syncingAll}
              className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Route className="w-4 h-4" />
              {isGettingLocation ? "Getting Directions..." : "Get Directions"}
            </button>

            {/* NEW SYNC ALL BUTTON */}
            <button
              onClick={handleSyncAllActivitiesToCalendar}
              disabled={syncingAll || syncLoading || isGettingLocation}
              className={`px-4 py-2 text-white font-medium rounded-lg transition-colors flex items-center gap-2 ${
                syncingAll
                  ? "bg-orange-400 cursor-not-allowed"
                  : "bg-yellow-600 hover:bg-yellow-700"
              } disabled:opacity-50`}
            >
              {syncingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Bulk Syncing (
                  {
                    displayItinerary.days.flatMap((d) => d.activities).length
                  }{" "}
                  events)...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  Sync All Events
                </>
              )}
            </button>

            <button
              onClick={() => setShowGenerator(true)}
              disabled={syncingAll || syncLoading}
              className="inline-flex items-center gap-2 disabled:opacity-50 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-[0_18px_38px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              New Itinerary
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              disabled={syncingAll || syncLoading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              Print
            </button>
          </div>
        </div>

        {SyncStatusIndicator}

        {/* Day Selector */}
        <div className="flex overflow-x-auto pb-2 mb-6 -mx-2">
          {displayItinerary.days.map((day) => (
            <button
              key={day.id}
              onClick={() => setActiveDay(day.id)}
              disabled={syncingAll || syncLoading}
              className={`flex flex-col items-center justify-center px-6 py-3 mx-1 rounded-lg transition-colors flex-shrink-0 disabled:opacity-70 ${
                activeDay === day.id
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="text-sm font-medium">Day {day.id}</span>
              <span className="text-xs mt-1">
                {new Date(day.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </button>
          ))}
        </div>

        {/* Itinerary Card */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_26px_70px_rgba(15,23,42,0.45)] backdrop-blur mb-8">
          <div className="p-6 bg-gradient-to-r from-blue-600/80 via-indigo-600/80 to-slate-900/80 text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h2 className="text-2xl font-bold">
                  Day {selectedDay.id}: {selectedDay.title}
                </h2>
                <p className="text-blue-100">
                  {new Date(selectedDay.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="mt-4 md:mt-0 flex space-x-2">
                <button className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                  Add Activity
                </button>
                <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="p-6">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

              {selectedDay.activities.map((activity) => (
                <div key={activity.id} className="relative pl-12 pb-6 group">
                  {/* Timeline dot */}
                  <div className="absolute left-0 w-8 h-8 rounded-full border-4 border-emerald-400/70 bg-slate-950 flex items-center justify-center z-10">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  </div>

                  <div className="bg-slate-800/80 rounded-xl border border-white/10 shadow-sm hover:shadow-md transition-shadow backdrop-blur-sm">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          <div className="mt-1 mr-3">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div>
                            <div className="flex items-center">
                              <h3 className="font-medium text-gray-900">
                                {activity.title}
                              </h3>
                              {getStatusBadge(activity.status)}
                              {activity.interest_category && (
                                <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-200 border border-purple-400/30">
                                  🤖 {activity.interest_category}
                                </span>
                              )}
                            </div>
                            {activity.location && (
                              <div className="flex items-center text-sm text-white/60 mt-1">
                                <MapPin className="w-3 h-3 mr-1 text-white/50" />
                                <span>{activity.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">
                            {activity.time}
                          </div>
                          {activity.duration && (
                            <div className="text-xs text-gray-500">
                              {activity.duration}
                            </div>
                          )}
                        </div>
                      </div>

                      {activity.notes && (
                        <div className="mt-2 text-sm text-white/70">
                          {activity.notes}
                        </div>
                      )}

                      {/* Additional details (Price, Booking Ref, Includes) */}
                      {(activity.price ||
                        activity.bookingRef ||
                        activity.includes) && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                          {activity.price && (
                            <div className="flex items-center mb-1">
                              <FaDollarSign className="mr-2 text-white/50" />
                              <span>Price: {activity.price}</span>
                            </div>
                          )}

                          {activity.bookingRef && (
                            <div className="flex items-center mb-1">
                              <span className="text-white/50 mr-2">Ref:</span>
                              <span>{activity.bookingRef}</span>
                            </div>
                          )}

                          {activity.includes && (
                            <div className="mt-2">
                              <div className="text-xs font-medium text-gray-500 mb-1">
                                INCLUDES:
                              </div>
                              <ul className="space-y-1">
                                {activity.includes.map((item, i) => (
                                  <li key={i} className="flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></span>
                                    <span className="text-gray-700">
                                      {item}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="bg-slate-700/50 px-4 py-2 rounded-b-lg flex justify-end space-x-2 border-t border-white/10">
                      {/* NEW SYNC BUTTON */}
                      <button
                        onClick={() =>
                          handleSyncActivityToCalendar(
                            activity,
                            selectedDay.date
                          )
                        }
                        disabled={syncLoading || syncingAll} // Disable if any sync is running
                        className={`px-3 py-1 text-sm rounded transition-colors flex items-center gap-1 ${
                          syncLoading && syncingActivityId === activity.id
                            ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                            : "text-blue-400 hover:bg-slate-700"
                        }`}
                      >
                        {syncLoading && syncingActivityId === activity.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Calendar className="w-4 h-4" />
                            Sync to Calendar
                          </>
                        )}
                      </button>
                      <button className="px-3 py-1 text-sm text-blue-400 hover:bg-slate-700 rounded">
                        Edit
                      </button>
                      <button className="px-3 py-1 text-sm text-white/80 hover:text-white hover:bg-slate-700 rounded">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trip Summary and Map Placeholder sections remain below... */}

        {/* Trip Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Accommodation Card */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-semibold text-lg mb-3">Accommodation</h3>
            <div className="flex items-start">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <Bed className="text-blue-600 text-xl" />
              </div>
              <div>
                <h4 className="font-medium">The Legian Bali</h4>
                <p className="text-sm text-gray-600">
                  4 nights • Ocean View Suite
                </p>
                <p className="text-sm text-gray-600">
                  Check-in: Jun 15 • Check-out: Jun 19
                </p>
              </div>
            </div>
          </div>

          {/* Transport Highlights Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.45)] backdrop-blur">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-white">
              <FaRoute className="text-sky-300" />
              Transport Highlights
            </h3>
            {transportSegments.length > 0 ? (
              <div className="space-y-3">
                {transportSegments.slice(0, 4).map((segment) => (
                  <div key={`${segment.dayId}-${segment.title}`} className="flex items-start">
                    <div className="bg-white/10 p-2 rounded-lg mr-3">
                      {getActivityIcon(segment.type)}
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{segment.title}</h4>
                      {segment.location && (
                        <p className="text-sm text-white/60">{segment.location}</p>
                      )}
                      <p className="text-xs text-white/50 mt-1">
                        Day {segment.dayId}
                        {segment.time ? ` • ${segment.time}` : ''}
                      </p>
                      {segment.notes && (
                        <p className="text-xs text-white/50 mt-1">{segment.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/60">
                No transport information available.
              </p>
            )}
          </div>

          {/* Quick Stats Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.45)] backdrop-blur">
            <h3 className="font-semibold text-lg mb-3 text-white">Quick Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-white/60">Activities:</span>
                <span className="font-medium text-white">{quickStats.activities || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Reservations:</span>
                <span className="font-medium text-white">{quickStats.reservations || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Dining Options:</span>
                <span className="font-medium text-white">{quickStats.dining || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Travel Days:</span>
                <span className="font-medium text-white">{quickStats.days || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Featured Attractions:</span>
                <span className="font-semibold text-white">{quickStats.attractions || 0}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 h-full shadow-[0_18px_45px_rgba(15,23,42,0.45)] backdrop-blur">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <FaLandmark className="text-indigo-300" />
                Must-Visit Attractions
              </h3>
              {topAttractions.length > 0 ? (
                <ul className="space-y-3">
                  {topAttractions.slice(0, 6).map((attraction) => (
                    <li
                      key={`${attraction.dayId}-${attraction.title}`}
                      className="border border-white/10 rounded-lg p-3 bg-slate-950/60 hover:bg-slate-900/80 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{attraction.title}</span>
                        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] uppercase tracking-widest text-white/70">
                          {formatLabel(attraction.type) || 'Attraction'}
                        </span>
                      </div>
                      {attraction.location && (
                        <div className="flex items-center text-xs text-white/60 mt-2">
                          <FaMapMarkerAlt className="mr-1" />
                          <span>{attraction.location}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-white/60">
                        {attraction.time && <span>{attraction.time}</span>}
                      </div>
                      {attraction.notes && (
                        <p className="text-xs text-white/70 mt-2">{attraction.notes}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">🌟</div>
                  <p className="text-sm text-white/60">
                    Add your interests and we'll highlight the must-see attractions for each day of your trip right here.
                  </p>
                  <button 
                    onClick={() => setShowGenerator(true)}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Add Interests
                  </button>
                </div>
              )}
          </div>
        </div>

        {/* Map Section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8 shadow-[0_26px_70px_RGBA(15,23,42,0.45)] backdrop-blur">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Trip Map</h2>
              <p className="text-sm text-white/60 mt-1">Explore your journey on the interactive map</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {displayItinerary.days.slice(0, 3).map((day) => (
                <button 
                  key={`map-day-${day.id}`}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                    activeDay === day.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  Day {day.id}
                </button>
              ))}
              <button className="px-4 py-2 text-sm rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors">
                Full Trip
              </button>
            </div>
          </div>
          
          <div className="relative rounded-xl border-2 border-white/10 h-80 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 to-purple-900/30 flex items-center justify-center">
              <div className="text-center p-6 max-w-md">
                <div className="text-5xl mb-4">🗺️</div>
                <h3 className="text-xl font-bold text-white mb-2">Interactive Map</h3>
                <p className="text-white/70 mb-4">Visualize your itinerary with our interactive map. See all your activities, accommodations, and points of interest in one place.</p>
                <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                  Enable Map
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center text-sm text-white/70">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
              <span>Activities</span>
            </div>
            <div className="flex items-center text-sm text-white/70">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span>Accommodations</span>
            </div>
            <div className="flex items-center text-sm text-white/70">
              <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
              <span>Dining</span>
            </div>
            <div className="flex items-center text-sm text-white/70">
              <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
              <span>Attractions</span>
            </div>
          </div>
        </div>
    </div>
      </main>
    </div>

  );
};
export default Itinerary;
