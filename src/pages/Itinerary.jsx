import React, { useState } from 'react';
import { FaCalendarAlt, FaMapMarkerAlt, FaUtensils, FaBed, FaPlane, FaWalking, FaTrain, FaBus, FaShip, FaShoppingBag, FaLandmark, FaCamera, FaEllipsisH, FaDollarSign, FaPlus } from 'react-icons/fa';
import { BsSunrise, BsSunset } from 'react-icons/bs';
import ItineraryGenerator from '../components/ItineraryGenerator';

const Itinerary = () => {
  const [activeDay, setActiveDay] = useState(1);
  const [currentItinerary, setCurrentItinerary] = useState(null);
  const [showGenerator, setShowGenerator] = useState(false);
  
  // Mock itinerary data (fallback only)
  const mockItineraryData = {
    destination: 'Bali, Indonesia',
    duration: '5 days',
    travelDates: 'June 15 - 20, 2023',
    travelers: 2,
    budget: '$$$',
    days: [
      {
        id: 1,
        date: 'June 15, 2023',
        title: 'Arrival & Beach Time',
        activities: [
          {
            id: 1,
            time: '14:00',
            title: 'Arrive at Ngurah Rai International Airport',
            type: 'flight',
            icon: <FaPlane className="text-blue-500" />,
            location: 'Denpasar Airport (DPS)',
            notes: 'Flight from Singapore (SIN) to Denpasar (DPS)',
            duration: '2h 30m',
            bookingRef: 'SQ 938',
            status: 'confirmed'
          },
          {
            id: 2,
            time: '15:30',
            title: 'Transfer to Hotel',
            type: 'transfer',
            icon: <FaBus className="text-green-500" />,
            location: 'The Legian Bali',
            notes: 'Private transfer arranged by hotel',
            duration: '30m',
            status: 'confirmed'
          },
          {
            id: 3,
            time: '16:30',
            title: 'Check-in & Relax',
            type: 'hotel',
            icon: <FaBed className="text-purple-500" />,
            location: 'The Legian Bali',
            notes: 'Ocean View Suite with breakfast included',
            bookingRef: 'RES# 4587921',
            status: 'confirmed'
          },
          {
            id: 4,
            time: '18:30',
            title: 'Dinner at La Lucciola',
            type: 'meal',
            icon: <FaUtensils className="text-red-500" />,
            location: 'La Lucciola, Petitenget',
            notes: 'Seaside Italian restaurant with romantic ambiance',
            duration: '2h',
            price: '$$$',
            status: 'reserved',
            reservationTime: '18:30',
            partySize: 2
          },
          {
            id: 5,
            time: '20:30',
            title: 'Evening Walk at Seminyak Beach',
            type: 'activity',
            icon: <FaWalking className="text-amber-500" />,
            location: 'Seminyak Beach',
            notes: 'Watch the sunset and enjoy the beach clubs',
            duration: '1h',
            price: 'Free'
          }
        ]
      },
      {
        id: 2,
        date: 'June 16, 2023',
        title: 'Ubud Cultural Tour',
        activities: [
          {
            id: 1,
            time: '08:00',
            title: 'Breakfast at Hotel',
            type: 'meal',
            icon: <FaUtensils className="text-red-500" />,
            location: 'The Legian Bali',
            notes: 'Complimentary breakfast for hotel guests',
            duration: '1h'
          },
          {
            id: 2,
            time: '09:00',
            title: 'Private Tour to Ubud',
            type: 'tour',
            icon: <FaBus className="text-green-500" />,
            location: 'Ubud',
            notes: 'Private car with English-speaking guide',
            duration: '10h',
            price: '$85',
            includes: ['Hotel pickup/drop-off', 'Entrance fees', 'Bottled water']
          },
          {
            id: 3,
            time: '10:30',
            title: 'Tegallalang Rice Terraces',
            type: 'sightseeing',
            icon: <FaCamera className="text-green-600" />,
            location: 'Tegallalang',
            notes: 'Famous rice terraces with beautiful views',
            duration: '1h 30m',
            price: 'IDR 25,000'
          },
          {
            id: 4,
            time: '12:30',
            title: 'Lunch at Locavore',
            type: 'meal',
            icon: <FaUtensils className="text-red-500" />,
            location: 'Locavore, Ubud',
            notes: 'Award-winning restaurant focusing on local ingredients',
            duration: '1h 30m',
            price: '$$$$',
            status: 'reserved',
            reservationTime: '12:30',
            partySize: 2
          },
          {
            id: 5,
            time: '14:30',
            title: 'Sacred Monkey Forest',
            type: 'sightseeing',
            icon: <FaWalking className="text-amber-500" />,
            location: 'Ubud Monkey Forest',
            notes: 'Sanctuary for long-tailed macaques',
            duration: '1h',
            price: 'IDR 80,000'
          },
          {
            id: 6,
            time: '16:00',
            title: 'Ubud Palace & Market',
            type: 'sightseeing',
            icon: <FaLandmark className="text-blue-500" />,
            location: 'Ubud Center',
            notes: 'Traditional market and historical palace',
            duration: '1h 30m',
            price: 'Free (donation)'
          },
          {
            id: 7,
            time: '19:00',
            title: 'Dinner at Mozaic',
            type: 'meal',
            icon: <FaUtensils className="text-red-500" />,
            location: 'Mozaic, Ubud',
            notes: 'Fine dining with tasting menus',
            duration: '2h',
            price: '$$$$',
            status: 'reserved',
            reservationTime: '19:00',
            partySize: 2
          }
        ]
      },
      {
        id: 3,
        date: 'June 17, 2023',
        title: 'Nusa Penida Island Tour',
        activities: [
          {
            id: 1,
            time: '06:00',
            title: 'Early Breakfast',
            type: 'meal',
            icon: <FaUtensils className="text-red-500" />,
            location: 'The Legian Bali',
            notes: 'Early breakfast before departure',
            duration: '30m'
          },
          {
            id: 2,
            time: '07:00',
            title: 'Transfer to Sanur Port',
            type: 'transfer',
            icon: <FaBus className="text-green-500" />,
            location: 'Sanur',
            notes: 'Shared transfer to port',
            duration: '45m',
            price: 'Included in tour'
          },
          {
            id: 3,
            time: '08:00',
            title: 'Speedboat to Nusa Penida',
            type: 'boat',
            icon: <FaShip className="text-blue-500" />,
            location: 'Sanur to Nusa Penida',
            notes: 'Fast boat crossing',
            duration: '45m',
            operator: 'Scoot Cruises',
            bookingRef: 'SC78945'
          },
          {
            id: 4,
            time: '09:00',
            title: 'West Nusa Penida Tour',
            type: 'tour',
            icon: <FaCamera className="text-green-600" />,
            location: 'Nusa Penida',
            notes: 'Visit Kelingking Beach, Broken Beach, Angel\'s Billabong',
            duration: '8h',
            price: '$75',
            includes: ['Private car', 'Driver/guide', 'Lunch', 'Entrance fees']
          },
          {
            id: 5,
            time: '17:00',
            title: 'Return to Bali',
            type: 'boat',
            icon: <FaShip className="text-blue-500" />,
            location: 'Nusa Penida to Sanur',
            notes: 'Last boat back to mainland',
            duration: '45m'
          },
          {
            id: 6,
            time: '18:30',
            title: 'Dinner at Merah Putih',
            type: 'meal',
            icon: <FaUtensils className="text-red-500" />,
            location: 'Merah Putih, Seminyak',
            notes: 'Modern Indonesian cuisine in a stunning setting',
            duration: '2h',
            price: '$$$',
            status: 'reserved',
            reservationTime: '18:30',
            partySize: 2
          }
        ]
      },
      {
        id: 4,
        date: 'June 18, 2023',
        title: 'Beach Club & Spa Day',
        activities: [
          {
            id: 1,
            time: '08:00',
            title: 'Yoga Session',
            type: 'activity',
            icon: <FaWalking className="text-amber-500" />,
            location: 'The Legian Bali',
            notes: 'Beachfront yoga class',
            duration: '1h',
            price: 'Included in stay'
          },
          {
            id: 2,
            time: '10:00',
            title: 'Spa Treatment',
            type: 'activity',
            icon: <FaBed className="text-purple-500" />,
            location: 'The Legian Spa',
            notes: 'Balinese massage (90 mins)',
            duration: '2h',
            price: 'IDR 1,200,000',
            status: 'booked',
            bookingTime: '10:00'
          },
          {
            id: 3,
            time: '12:30',
            title: 'Lunch at The Restaurant',
            type: 'meal',
            icon: <FaUtensils className="text-red-500" />,
            location: 'The Legian Bali',
            notes: 'Poolside dining',
            duration: '1h 30m',
            price: '$$$'
          },
          {
            id: 4,
            time: '14:00',
            title: 'Beach Club Afternoon',
            type: 'activity',
            icon: <BsSunset className="text-orange-500" />,
            location: 'Potato Head Beach Club',
            notes: 'Daybed reservation',
            duration: '4h',
            price: 'IDR 1,500,000 (minimum spend)',
            status: 'reserved',
            bookingTime: '14:00',
            partySize: 2
          },
          {
            id: 5,
            time: '19:30',
            title: 'Dinner at Metis',
            type: 'meal',
            icon: <FaUtensils className="text-red-500" />,
            location: 'Metis, Seminyak',
            notes: 'French-Mediterranean cuisine in a beautiful garden setting',
            duration: '2h',
            price: '$$$$',
            status: 'reserved',
            reservationTime: '19:30',
            partySize: 2
          }
        ]
      },
      {
        id: 5,
        date: 'June 19, 2023',
        title: 'Departure Day',
        activities: [
          {
            id: 1,
            time: '06:00',
            title: 'Sunrise at Tanah Lot',
            type: 'sightseeing',
            icon: <BsSunrise className="text-yellow-500" />,
            location: 'Tanah Lot Temple',
            notes: 'Famous sea temple, less crowded at sunrise',
            duration: '2h',
            price: 'IDR 60,000'
          },
          {
            id: 2,
            time: '09:00',
            title: 'Breakfast & Check-out',
            type: 'hotel',
            icon: <FaBed className="text-purple-500" />,
            location: 'The Legian Bali',
            notes: 'Late check-out until 12:00',
            duration: '1h'
          },
          {
            id: 3,
            time: '10:00',
            title: 'Last-minute Shopping',
            type: 'shopping',
            icon: <FaShoppingBag className="text-pink-500" />,
            location: 'Seminyak Village',
            notes: 'Boutique shopping in Seminyak',
            duration: '2h',
            price: '$$$'
          },
          {
            id: 4,
            time: '12:30',
            title: 'Lunch at Sea Circus',
            type: 'meal',
            icon: <FaUtensils className="text-red-500" />,
            location: 'Sea Circus, Seminyak',
            notes: 'Vibrant restaurant with international menu',
            duration: '1h 30m',
            price: '$$'
          },
          {
            id: 5,
            time: '14:30',
            title: 'Transfer to Airport',
            type: 'transfer',
            icon: <FaBus className="text-green-500" />,
            location: 'Ngurah Rai International Airport',
            notes: 'Private transfer',
            duration: '30m',
            price: 'IDR 350,000',
            status: 'confirmed'
          },
          {
            id: 6,
            time: '16:30',
            title: 'Flight Departure',
            type: 'flight',
            icon: <FaPlane className="text-blue-500" />,
            location: 'Ngurah Rai International (DPS)',
            notes: 'Flight DPS to SIN',
            duration: '2h 30m',
            airline: 'Singapore Airlines',
            flightNumber: 'SQ 939',
            status: 'confirmed',
            checkIn: 'Online check-in opens 48h before flight'
          }
        ]
      }
    ]
  };
  
  const displayItinerary = currentItinerary || mockItineraryData;
  const selectedDay = displayItinerary.days?.find(day => day.id === activeDay) || displayItinerary.days?.[0];

  const handleItineraryGenerated = (newItinerary) => {
    setCurrentItinerary(newItinerary);
    setShowGenerator(false);
    setActiveDay(1);
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
    <div className="min-h-screen bg-gradient-to-b from-light to-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-dark">
              {displayItinerary.destination}
            </h1>
            <p className="text-gray-600">
              {displayItinerary.travelDates} • {displayItinerary.duration} • {displayItinerary.travelers} {displayItinerary.travelers > 1 ? 'Travelers' : 'Traveler'}
            </p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button 
              onClick={() => setShowGenerator(true)}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <FaPlus className="text-sm" />
              Create New Itinerary
            </button>
            <button className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Print Itinerary
            </button>
          </div>
        </div>
        
        {/* Day Selector */}
        <div className="flex overflow-x-auto pb-2 mb-6 -mx-2">
          {displayItinerary.days.map((day) => (
            <button
              key={day.id}
              onClick={() => setActiveDay(day.id)}
              className={`flex flex-col items-center justify-center px-6 py-3 mx-1 rounded-lg transition-colors ${
                activeDay === day.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
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
        <div className="bg-white rounded-xl shadow-xl overflow-hidden mb-8">
          <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
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
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              
              {selectedDay.activities.map((activity, index) => (
                <div key={activity.id} className="relative pl-12 pb-6 group">
                  {/* Timeline dot */}
                  <div className="absolute left-0 w-8 h-8 rounded-full bg-white border-4 border-blue-500 flex items-center justify-center z-10">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  </div>
                  
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          <div className="mt-1 mr-3">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div>
                            <div className="flex items-center">
                              <h3 className="font-medium text-gray-900">{activity.title}</h3>
                              {getStatusBadge(activity.status)}
                            </div>
                            {activity.location && (
                              <div className="flex items-center text-sm text-gray-500 mt-1">
                                <FaMapMarkerAlt className="mr-1 text-xs" />
                                <span>{activity.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">{activity.time}</div>
                          {activity.duration && (
                            <div className="text-xs text-gray-500">{activity.duration}</div>
                          )}
                        </div>
                      </div>
                      
                      {activity.notes && (
                        <div className="mt-2 text-sm text-gray-600">
                          {activity.notes}
                        </div>
                      )}
                      
                      {/* Additional details */}
                      {(activity.price || activity.bookingRef || activity.includes) && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                          {activity.price && (
                            <div className="flex items-center text-gray-700 mb-1">
                              <FaDollarSign className="mr-2 text-gray-500" />
                              <span>Price: {activity.price}</span>
                            </div>
                          )}
                          
                          {activity.bookingRef && (
                            <div className="flex items-center text-gray-700 mb-1">
                              <span className="text-gray-500 mr-2">Ref:</span>
                              <span>{activity.bookingRef}</span>
                            </div>
                          )}
                          
                          {activity.includes && (
                            <div className="mt-2">
                              <div className="text-xs font-medium text-gray-500 mb-1">INCLUDES:</div>
                              <ul className="space-y-1">
                                {activity.includes.map((item, i) => (
                                  <li key={i} className="flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></span>
                                    <span className="text-gray-700">{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="bg-gray-50 px-4 py-2 rounded-b-lg flex justify-end space-x-2">
                      <button className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded">
                        Edit
                      </button>
                      <button className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-semibold text-lg mb-3">Accommodation</h3>
            <div className="flex items-start">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <FaBed className="text-blue-600 text-xl" />
              </div>
              <div>
                <h4 className="font-medium">The Legian Bali</h4>
                <p className="text-sm text-gray-600">4 nights • Ocean View Suite</p>
                <p className="text-sm text-gray-600">Check-in: Jun 15 • Check-out: Jun 19</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-semibold text-lg mb-3">Transportation</h3>
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="bg-green-100 p-2 rounded-lg mr-3">
                  <FaPlane className="text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">Flight</h4>
                  <p className="text-sm text-gray-600">SIN → DPS • Jun 15</p>
                  <p className="text-sm text-gray-600">SQ 938 • 2h 30m</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-green-100 p-2 rounded-lg mr-3">
                  <FaPlane className="text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">Flight</h4>
                  <p className="text-sm text-gray-600">DPS → SIN • Jun 19</p>
                  <p className="text-sm text-gray-600">SQ 939 • 2h 30m</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-semibold text-lg mb-3">Quick Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Activities:</span>
                <span className="font-medium">12</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reservations:</span>
                <span className="font-medium">5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estimated Cost:</span>
                <span className="font-medium">$2,800</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Distance:</span>
                <span className="font-medium">1,650 km</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Map Placeholder */}
        <div className="bg-white rounded-xl shadow-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Trip Map</h2>
            <div className="flex space-x-2">
              <button className="px-3 py-1 text-sm bg-gray-100 rounded-lg">Day 1</button>
              <button className="px-3 py-1 text-sm bg-gray-100 rounded-lg">Day 2</button>
              <button className="px-3 py-1 text-sm bg-gray-100 rounded-lg">Full Trip</button>
            </div>
          </div>
          <div className="bg-gray-200 rounded-xl h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">🗺️</div>
              <p>Interactive map will be displayed here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Itinerary;
