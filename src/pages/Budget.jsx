// Budget.jsx
import React, { useState } from "react";
import api from "../utils/api";
import toast, { Toaster } from "react-hot-toast";

const Budget = () => {
  const [origin, setOrigin] = useState("");
  const [originIata, setOriginIata] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationIata, setDestinationIata] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState("1");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!origin || !destination || !departureDate || !checkIn || !checkOut) {
      toast.error("Please fill all required fields");
      return;
    }

    // Validate IATA codes
    if (!originIata || !destinationIata) {
      toast.error("Please select valid cities from the suggestions");
      return;
    }

    // Ensure adults is a valid number
    const numAdults = Math.max(1, parseInt(adults, 10) || 1);

    setLoading(true);
    setResult(null);

    try {
      // Log the request parameters for debugging
      console.log('Making API request with params:', {
        origin: originIata,
        destination: destinationIata,
        date: departureDate,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: numAdults,
      });

      // Use the API utility to make the request
      const response = await api.get('/travel', {
        params: {
          origin: originIata,
          destination: destinationIata,
          date: departureDate,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults: numAdults,
        }
      });

      console.log('API Response:', response);
      
      if (response.data) {
        console.log('Response data:', {
          flights: response.data.flights,
          hotels: response.data.hotels,
          trains: response.data.trains,
          cheapestTrip: response.data.cheapestTrip
        });
        
        // Transform the data to match the expected format
        const formattedData = {
          // Flights data - ensure we always have an array
          flights: Array.isArray(response.data.flights) ? response.data.flights.map(flight => ({
            ...flight,
            from: flight.origin || flight.from || origin,
            to: flight.destination || flight.to || destination,
            price: typeof flight.price === 'number' ? flight.price : 0,
            duration: flight.duration || 'PT0H', // Default to 0 hours if not provided
            details: {
              ...flight.details,
              airline: flight.details?.airline || flight.airline || flight.provider || 'Airline',
              flightNumber: flight.details?.flightNumber || flight.flightNumber || 'N/A',
              departureTime: flight.details?.departureTime || flight.departure || 'N/A',
              arrivalTime: flight.details?.arrivalTime || flight.arrival || 'N/A',
              class: flight.details?.class || flight.class || 'ECONOMY'
            }
          })) : [],
          
          // Hotels data - ensure we always have an array
          hotels: Array.isArray(response.data.hotels) ? response.data.hotels.map(hotel => ({
            ...hotel,
            location: hotel.location || destination,
            price: typeof hotel.price === 'number' ? hotel.price : 0,
            details: {
              ...hotel.details,
              hotelName: hotel.details?.hotelName || hotel.hotelName || hotel.name || 'Hotel',
              rating: hotel.details?.rating || hotel.rating || 0,
              amenities: Array.isArray(hotel.details?.amenities) ? hotel.details.amenities : 
                        Array.isArray(hotel.amenities) ? hotel.amenities : []
            }
          })) : [],
          
          // Trains data - ensure we always have an array
          trains: Array.isArray(response.data.trains) ? response.data.trains.map(train => {
            const details = train.details || {};
            return {
              ...train,
              from: train.origin || train.from || origin,
              to: train.destination || train.to || destination,
              fromCode: train.fromCode || (origin ? origin.substring(0, 3).toUpperCase() : 'N/A'),
              toCode: train.toCode || (destination ? destination.substring(0, 3).toUpperCase() : 'N/A'),
              price: typeof train.price === 'number' ? train.price : 0,
              duration: train.duration || 'PT0H',
              details: {
                ...details,
                trainName: details.trainName || train.trainName || train.name || 'Train',
                trainNumber: details.trainNumber || train.trainNumber || train.number || 'N/A',
                departureTime: details.departureTime || train.departure || 'N/A',
                arrivalTime: details.arrivalTime || train.arrival || 'N/A',
                class: details.class || train.class || 'SL',
                seatsAvailable: typeof details.seatsAvailable === 'number' ? details.seatsAvailable :
                              typeof train.availableSeats === 'number' ? train.availableSeats : 0,
                runningDays: details.runningDays || 'Daily',
                days: typeof details.days === 'number' ? details.days : 0
              }
            };
          }) : [],
          
          cheapestTrip: response.data.cheapestTrip ? {
            transport: {
              type: response.data.cheapestTrip.transportType || 'flight',
              price: response.data.cheapestTrip.transportPrice || 0,
              details: {
                airline: response.data.cheapestTrip.transportName || 'Transport',
                departure: response.data.cheapestTrip.departureTime,
                arrival: response.data.cheapestTrip.arrivalTime
              }
            },
            hotel: {
              name: response.data.cheapestTrip.hotelName || 'Hotel',
              price: response.data.cheapestTrip.hotelPrice || 0,
              location: destination
            },
            totalCost: response.data.cheapestTrip.totalCost || 0
          } : null
        };
        
        setResult(formattedData);
        toast.success("Travel data fetched successfully!");
      } else {
        console.error('No data in response');
        toast.error("No data received from server");
      }
    } catch (error) {
      console.error("API Error:", error);
      const errorMessage = error.response?.data?.message || 
                         error.response?.data?.error || 
                         error.message || 
                         "Failed to fetch travel data. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <Toaster position="top-right" />
      <h1 className="text-3xl font-bold mb-6">Travel Planner</h1>

      {/* Form */}
      <form
        className="bg-white p-6 rounded-lg shadow-md w-full max-w-md space-y-4"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="block mb-1 font-semibold">Origin</label>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Enter origin city"
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">Destination</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Enter destination city"
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">Departure Date</label>
          <input
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block mb-1 font-semibold">Check-in</label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full border border-gray-300 p-2 rounded"
            />
          </div>
          <div className="flex-1">
            <label className="block mb-1 font-semibold">Check-out</label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full border border-gray-300 p-2 rounded"
            />
          </div>
        </div>

        <div>
          <label className="block mb-1 font-semibold">Number of Adults</label>
          <input
            type="number"
            value={adults}
            min="1"
            onChange={(e) => {
              const value = e.target.value;
              // Only update if it's a valid number or empty string
              if (value === '' || /^\d+$/.test(value)) {
                setAdults(value);
              }
            }}
            onBlur={(e) => {
              // Ensure we always have at least 1 adult
              if (!e.target.value || isNaN(parseInt(e.target.value, 10)) || parseInt(e.target.value, 10) < 1) {
                setAdults("1");
              }
            }}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition"
          disabled={loading}
        >
          {loading ? "Fetching..." : "Search Travel"}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className="mt-6 w-full max-w-5xl space-y-6">
          {/* Flights */}
          <div>
            <h2 className="text-2xl font-bold mb-2">Flights</h2>
            {result.flights?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.flights.map((flight, i) => (
                  <div key={i} className="bg-white p-4 rounded shadow hover:shadow-lg transition">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-lg">
                        {flight.details?.airline || 'Flight'}
                      </h3>
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        {flight.details?.class || 'ECONOMY'}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mt-1">
                      {flight.from} ({flight.fromCode || flight.from?.substring(0, 3).toUpperCase()}) → 
                      {flight.to} ({flight.toCode || flight.to?.substring(0, 3).toUpperCase()})
                    </p>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Departure:</span>
                        <span className="font-medium">{flight.details?.departureTime || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Arrival:</span>
                        <span className="font-medium">{flight.details?.arrivalTime || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Duration:</span>
                        <span className="font-medium">
                          {flight.duration ? 
                            flight.duration
                              .replace("PT", "")
                              .replace("H", "h ")
                              .replace("M", "m")
                              .replace(/\s*[hm]\s*$/, "") // Remove trailing 'h' or 'm' if no minutes/hours
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-sm text-gray-500">Price:</span>
                          <span className="ml-2 font-bold text-lg">
                            ₹{typeof flight.price === 'number' ? flight.price.toLocaleString() : 'N/A'}
                          </span>
                        </div>
                        {flight.details?.flightNumber && (
                          <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                            {flight.details.flightNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-4 rounded shadow">
                <p className="text-gray-500">No flights found for this route.</p>
              </div>
            )}
          </div>

          {/* Hotels */}
          <div>
            <h2 className="text-2xl font-bold mb-2">Hotels</h2>
            {result.hotels?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.hotels.map((hotel, i) => (
                  <div key={i} className="bg-white p-4 rounded shadow hover:shadow-lg transition">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-lg">
                        {hotel.details?.hotelName || 'Hotel'}
                      </h3>
                      {hotel.details?.rating && (
                        <span className="flex items-center bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {hotel.details.rating}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-600 text-sm mt-1">
                      {hotel.location || destination}
                    </p>
                    
                    {hotel.details?.amenities?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {hotel.details.amenities.slice(0, 4).map((amenity, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            {amenity}
                          </span>
                        ))}
                        {hotel.details.amenities.length > 4 && (
                          <span className="text-xs text-gray-500">+{hotel.details.amenities.length - 4} more</span>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-sm text-gray-500">Price per night:</span>
                          <span className="ml-2 font-bold text-lg">
                            ₹{typeof hotel.price === 'number' ? hotel.price.toLocaleString() : 'N/A'}
                          </span>
                        </div>
                        <button className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1.5 rounded transition">
                          View Deal
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-4 rounded shadow">
                <p className="text-gray-500">No hotels found in this location.</p>
              </div>
            )}
          </div>

          {/* Trains */}
          <div>
            <h2 className="text-2xl font-bold mb-2">Trains</h2>
            {result.trains?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.trains.map((train, i) => {
                  const details = train.details || {};
                  const seatsAvailable = details.seatsAvailable || 0;
                  const isAvailable = seatsAvailable > 0;
                  
                  return (
                    <div key={i} className="bg-white p-4 rounded shadow hover:shadow-lg transition">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-lg">
                          {details.trainName || 'Train'} {details.trainNumber ? `(${details.trainNumber})` : ''}
                        </h3>
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded ${
                          (details.class || 'SL').toUpperCase() === 'SL' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {details.class || 'SL'}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 text-sm mt-1">
                        {train.from} ({train.fromCode || train.from?.substring(0, 3).toUpperCase()}) → 
                        {train.to} ({train.toCode || train.to?.substring(0, 3).toUpperCase()})
                      </p>
                      
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Departure:</span>
                          <span className="font-medium">{details.departureTime || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Arrival:</span>
                          <span className="font-medium">
                            {details.arrivalTime || 'N/A'}
                            {details.days > 0 && ` (+${details.days} day${details.days > 1 ? 's' : ''})`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Duration:</span>
                          <span className="font-medium">
                            {train.duration ? 
                              train.duration
                                .replace("PT", "")
                                .replace("H", "h ")
                                .replace("M", "m")
                                .replace(/\s*[hm]\s*$/, "")
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-sm text-gray-500">Price:</span>
                            <span className="ml-2 font-bold text-lg">
                              ₹{typeof train.price === 'number' ? train.price.toLocaleString() : 'N/A'}
                            </span>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {isAvailable ? 
                              `${seatsAvailable} seat${seatsAvailable !== 1 ? 's' : ''} left` : 
                              'Waitlist'}
                          </span>
                        </div>
                        
                        <div className="mt-2 flex justify-between items-center text-sm">
                          <div className="text-gray-500">
                            {details.runningDays === 'Daily' ? 'Runs daily' : 
                             details.runningDays ? `Runs: ${details.runningDays}` : 'Check running days'}
                          </div>
                          
                          <button className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white p-4 rounded shadow">
                <p className="text-gray-500">No trains found for this route.</p>
              </div>
            )}
          </div>

          {/* Cheapest Trip */}
          <div className="bg-green-50 p-4 rounded shadow">
            <h2 className="text-2xl font-bold mb-4">Cheapest Trip</h2>
            {result.cheapestTrip ? (
              <div className="space-y-3">
                <div className="bg-white p-3 rounded shadow">
                  <h3 className="font-semibold text-lg mb-2">
                    {result.cheapestTrip.transport?.type === 'flight' ? '✈️ Flight' : '🚆 Train'}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-500">Provider:</div>
                    <div className="font-medium">
                      {result.cheapestTrip.transport?.details?.airline || 
                       result.cheapestTrip.transport?.details?.trainName || 
                       result.cheapestTrip.transportName || 'N/A'}
                    </div>
                    
                    <div className="text-gray-500">From:</div>
                    <div>{result.cheapestTrip.origin || origin || 'N/A'}</div>
                    
                    <div className="text-gray-500">To:</div>
                    <div>{result.cheapestTrip.destination || destination || 'N/A'}</div>
                    
                    <div className="text-gray-500">Departure:</div>
                    <div>{result.cheapestTrip.departureTime || 'N/A'}</div>
                    
                    <div className="text-gray-500">Price:</div>
                    <div className="font-bold">
                      {result.cheapestTrip.transport?.type === 'flight' ? '$' : '₹'}
                      {typeof result.cheapestTrip.transport?.price === 'number' 
                        ? result.cheapestTrip.transport.price.toLocaleString() 
                        : 'N/A'}
                    </div>
                  </div>
                </div>
                
                {result.cheapestTrip.hotel && (
                  <div className="bg-white p-3 rounded shadow">
                    <h3 className="font-semibold text-lg mb-2">🏨 Hotel</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-500">Name:</div>
                      <div className="font-medium">
                        {result.cheapestTrip.hotel.details?.hotelName || 
                         result.cheapestTrip.hotel.name || 'Hotel'}
                      </div>
                      
                      <div className="text-gray-500">Location:</div>
                      <div>{result.cheapestTrip.hotel.location || destination || 'N/A'}</div>
                      
                      <div className="text-gray-500">Check-in:</div>
                      <div>{result.cheapestTrip.hotel.checkIn || 'N/A'}</div>
                      
                      <div className="text-gray-500">Check-out:</div>
                      <div>{result.cheapestTrip.hotel.checkOut || 'N/A'}</div>
                      
                      <div className="text-gray-500">Price per night:</div>
                      <div className="font-bold">
                        ₹{typeof result.cheapestTrip.hotel.price === 'number' 
                          ? result.cheapestTrip.hotel.price.toLocaleString() 
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-blue-50 p-3 rounded shadow border border-blue-100">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Estimated Cost:</span>
                    <span className="text-xl font-bold text-blue-700">
                      {result.cheapestTrip.transport?.type === 'flight' ? '$' : '₹'}
                      {typeof result.cheapestTrip.totalPrice === 'number' 
                        ? result.cheapestTrip.totalPrice.toLocaleString() 
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded shadow">
                <p className="text-gray-500">No cheapest trip calculated. Please check your search criteria.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Budget;
