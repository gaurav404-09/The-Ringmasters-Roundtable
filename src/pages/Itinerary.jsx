import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ENV from '../config/env';

const { API_BASE_URL } = ENV;
import { FaCalendarAlt, FaMapMarkerAlt, FaUtensils, FaBed, FaPlane, FaWalking, FaTrain, FaBus, FaShip, FaShoppingBag, FaLandmark, FaCamera, FaEllipsisH, FaDollarSign, FaPlus, FaRoute } from 'react-icons/fa';
import { BsSunrise, BsSunset } from 'react-icons/bs';
import ItineraryGenerator from '../components/ItineraryGenerator';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { saveUserTrip } from '../lib/apiClient';

const Itinerary = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeDay, setActiveDay] = useState(1);
  const [currentItinerary, setCurrentItinerary] = useState(null);
  const [showGenerator, setShowGenerator] = useState(true);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  // Get current location when component mounts
  useEffect(() => {
    const getLocation = async () => {
      try {
        const position = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
          } else {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          }
        });
        
        const { latitude, longitude } = position.coords;
        setCurrentLocation(`${latitude},${longitude}`);
      } catch (error) {
        console.error('Error getting current location:', error);
        toast.warn('Could not get your current location. You can still get directions by entering your starting point manually.');
      }
    };

    getLocation();
  }, []);

  const handleGetDirections = async () => {
    if (!currentItinerary?.destination) return;
    
    // If we already have the current location, use it
    if (currentLocation) {
      navigate('/routes', {
        state: {
          from: currentLocation,
          to: currentItinerary.destination
        }
      });
      return;
    }
    
    // Otherwise, try to get the current location
    setIsGettingLocation(true);
    
    try {
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser'));
        } else {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        }
      });
      
      const { latitude, longitude } = position.coords;
      const locationString = `${latitude},${longitude}`;
      setCurrentLocation(locationString);
      
      // Navigate to Routes page with location data
      navigate('/routes', {
        state: {
          from: locationString,
          to: currentItinerary.destination
        }
      });
      
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error('Could not get your location. You can still get directions by entering your starting point manually.');
      
      // If location access is denied, still navigate but with only the destination
      navigate('/routes', {
        state: {
          to: currentItinerary.destination
        }
      });
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

    if (!user?.uid || !itinerary) {
      if (!user?.uid) {
        toast.warn('Sign in to save this itinerary to your command center.');
      }
      return;
    }

    try {
      const tripRecord = {
        id: itinerary.id,
        title: `${itinerary.destination} • ${itinerary.duration || `${(itinerary.days || []).length} days`}`,
        destination: itinerary.destination,
        travelers: itinerary.travelers,
        budget: itinerary.budget,
        startDate: request?.startDate,
        endDate: request?.endDate,
        request,
        itinerary,
        generatedAt: generatedAt || new Date().toISOString(),
      };

      const response = await saveUserTrip(user.uid, tripRecord);
      if (response?.success) {
        toast.success('Itinerary saved to your command center.');
      } else if (response?.trip) {
        toast.success('Itinerary saved to your command center.');
      }
    } catch (error) {
      console.error('Failed to save itinerary:', error);
      toast.error('We generated your itinerary but could not save it. Try again later.');
    }
  };
  
  const getActivityIcon = (type) => {
    switch(type) {
      case 'flight':
        return <FaPlane className="text-blue-500" />;
      case 'hotel':
        return <FaBed className="text-purple-500" />;
      case 'meal':
        return <FaUtensils className="text-red-500" />;
      case 'transfer':
        return <FaBus className="text-green-500" />;
      case 'tour':
      case 'sightseeing':
        return <FaCamera className="text-green-600" />;
      case 'activity':
        return <FaWalking className="text-amber-500" />;
      case 'shopping':
        return <FaShoppingBag className="text-pink-500" />;
      case 'boat':
        return <FaShip className="text-blue-500" />;
      default:
        return <FaEllipsisH className="text-gray-500" />;
    }
  };
  
  const getStatusBadge = (status) => {
    if (!status) return null;
    
    const statusStyles = {
      confirmed: 'bg-green-100 text-green-800',
      reserved: 'bg-blue-100 text-blue-800',
      booked: 'bg-purple-100 text-purple-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
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

  if (showGenerator) {
    return <ItineraryGenerator onItineraryGenerated={handleItineraryGenerated} />;
  }

  // Add safety check for selectedDay
  if (!selectedDay) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-light to-gray-100 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Loading Itinerary...</h2>
          <p className="text-gray-600">Please wait while we load your travel plans.</p>
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
              {displayItinerary.destination}
            </h1>
            <p className="text-sm text-white/70">
              {displayItinerary.travelDates} • {displayItinerary.duration} • {displayItinerary.travelers}{' '}
              {displayItinerary.travelers > 1 ? 'Travelers' : 'Traveler'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
            <button
              onClick={handleGetDirections}
              disabled={isGettingLocation}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/15 disabled:opacity-40"
            >
              <FaRoute className="text-sm" />
              {isGettingLocation ? 'Getting Directions...' : 'Get Directions'}
            </button>
            <button
              onClick={() => setShowGenerator(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-[0_18px_38px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5"
            >
              <FaPlus className="text-sm" />
              New Itinerary
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>
        </div>

        {/* Day Selector */}
        <div className="flex overflow-x-auto pb-2 mb-6 -mx-2">
          {displayItinerary.days.map((day) => (
            <button
              key={day.id}
              onClick={() => setActiveDay(day.id)}
              className={`flex flex-col items-center justify-center px-6 py-3 mx-1 rounded-lg border transition-colors ${
                activeDay === day.id
                  ? 'border-emerald-400/80 bg-emerald-400 text-slate-900 shadow-[0_18px_38px_rgba(16,185,129,0.35)]'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white'
              }`}
            >
              <span className="text-sm font-medium">Day {day.id}</span>
              <span className="text-xs mt-1">
                {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </button>
          ))}
        </div>

        {/* Itinerary Card */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_26px_70px_rgba(15,23,42,0.45)] backdrop-blur mb-8">
          <div className="p-6 bg-gradient-to-r from-blue-600/80 via-indigo-600/80 to-slate-900/80 text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h2 className="text-2xl font-bold">Day {selectedDay.id}: {selectedDay.title}</h2>
                <p className="text-blue-100">
                  {new Date(selectedDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="mt-4 md:mt-0 flex space-x-2">
                <button className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                  Add Activity
                </button>
                <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                  <FaEllipsisH />
                </button>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="p-6">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/10"></div>

              {selectedDay.activities.map((activity, index) => (
                <div key={activity.id} className="relative pl-12 pb-6 group">
                  {/* Timeline dot */}
                  <div className="absolute left-0 w-8 h-8 rounded-full border-4 border-emerald-400/70 bg-slate-950 flex items-center justify-center z-10">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/70 shadow-[0_16px_40px_rgba(15,23,42,0.45)] transition-shadow">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          <div className="mt-1 mr-3">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div>
                            <div className="flex items-center">
                              <h3 className="font-medium text-white">{activity.title}</h3>
                              {getStatusBadge(activity.status)}
                            </div>
                            {activity.location && (
                              <div className="flex items-center text-sm text-white/60 mt-1">
                                <FaMapMarkerAlt className="mr-1 text-xs text-white/50" />
                                <span>{activity.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-white">{activity.time}</div>
                          {activity.duration && (
                            <div className="text-xs text-white/60">{activity.duration}</div>
                          )}
                        </div>
                      </div>

                      {activity.notes && (
                        <div className="mt-2 text-sm text-white/70">
                          {activity.notes}
                        </div>
                      )}

                      {/* Additional details */}
                      {(activity.price || activity.bookingRef || activity.includes) && (
                        <div className="mt-3 pt-3 border-t border-white/10 text-sm text-white/70">
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
                              <div className="text-xs font-medium text-white/60 mb-1">INCLUDES:</div>
                              <ul className="space-y-1">
                                {activity.includes.map((item, i) => (
                                  <li key={i} className="flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2"></span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="bg-slate-900/80 px-4 py-2 rounded-b-lg flex justify-end space-x-2">
                      <button className="px-3 py-1 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded">
                        Edit
                      </button>
                      <button className="px-3 py-1 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trip Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.45)] backdrop-blur">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-white">
              <FaBed className="text-emerald-300" />
              Stays & Check-ins
            </h3>
            {accommodations.length > 0 ? (
              <ul className="space-y-3">
                {accommodations.slice(0, 3).map((stay) => (
                  <li key={`${stay.dayId}-${stay.title}`} className="flex items-start">
                    <div className="bg-white/10 p-3 rounded-lg mr-4">
                      <FaBed className="text-emerald-300 text-xl" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{stay.title}</h4>
                      {stay.location && (
                        <p className="text-sm text-white/60">{stay.location}</p>
                      )}
                      <p className="text-xs text-white/50 mt-1">
                        Day {stay.dayId}
                        {stay.time ? ` • ${stay.time}` : ''}
                      </p>
                      {stay.notes && (
                        <p className="text-xs text-white/55 mt-1">{stay.notes}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-white/60">
                We’ll surface your accommodations here as soon as lodging details are added to the plan.
              </p>
            )}
          </div>

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
                Travel segments will appear here when flights, transfers, or local transport are part of your itinerary.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.45)] backdrop-blur">
            <h3 className="font-semibold text-lg mb-3 text-white">Quick Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Days Planned:</span>
                <span className="font-semibold text-white">{quickStats.days}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Activities:</span>
                <span className="font-semibold text-white">{quickStats.activities}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Reservations:</span>
                <span className="font-semibold text-white">{quickStats.reservations}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Dining Spots:</span>
                <span className="font-semibold text-white">{quickStats.dining}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Featured Attractions:</span>
                <span className="font-semibold text-white">{quickStats.attractions}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_18px_45px_rgba(15,23,42,0.45)] backdrop-blur md:col-span-2 xl:col-span-2">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <FaLandmark className="text-indigo-300" />
              Must-Visit Attractions
            </h3>
            {topAttractions.length > 0 ? (
              <ul className="space-y-3">
                {topAttractions.slice(0, 6).map((attraction) => (
                  <li
                    key={`${attraction.dayId}-${attraction.title}`}
                    className="border border-white/10 rounded-lg p-3 bg-slate-950/60"
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
              <p className="text-sm text-white/60">
                Add your interests and we’ll highlight the must-see attractions for each day of your trip right here.
              </p>
            )}
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8 shadow-[0_26px_70px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Trip Map</h2>
            <div className="flex space-x-2">
              <button className="px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 border border-white/15 rounded-lg hover:border-white/40 hover:text-white">
                Day 1
              </button>
              <button className="px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 border border-white/15 rounded-lg hover:border-white/40 hover:text-white">
                Day 2
              </button>
              <button className="px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 border border-white/15 rounded-lg hover:border-white/40 hover:text-white">
                Full Trip
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 h-64 flex items-center justify-center bg-slate-950/70 text-white/40">
            <div className="text-center space-y-2">
              <div className="text-4xl">🗺️</div>
              <p className="text-sm uppercase tracking-[0.35em]">Interactive map placeholder</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Itinerary;
