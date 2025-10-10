// Budget.jsx
import React, { useState } from "react";
import api from "../utils/api";
import toast, { Toaster } from "react-hot-toast";

const currencySymbol = (code = "INR") => {
  if (!code) return "₹";
  const upper = code.toUpperCase();
  switch (upper) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "INR":
    default:
      return "₹";
  }
};

const formatCurrency = (amount, code = "INR") => {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return "N/A";
  }
  return `${currencySymbol(code)}${amount.toLocaleString()}`;
};

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

  // City code mapping for common cities (case-insensitive)
  const cityCodeMap = {
    'delhi': 'DEL',
    'mumbai': 'BOM',
    'bombay': 'BOM',
    'bangalore': 'BLR',
    'bengaluru': 'BLR',
    'chennai': 'MAA',
    'kolkata': 'CCU',
    'calcutta': 'CCU',
    'hyderabad': 'HYD',
    'pune': 'PNQ',
    'ahmedabad': 'AMD',
    'goa': 'GOI',
    'kochi': 'COK',
    'cochin': 'COK',
    'jaipur': 'JAI',
    'lucknow': 'LKO',
    'patna': 'PAT',
    'guwahati': 'GAU',
    'chandigarh': 'IXC',
    'amritsar': 'ATQ',
    'varanasi': 'VNS',
    'indore': 'IDR',
    'bhopal': 'BHO',
    'raipur': 'RPR',
    'nagpur': 'NAG',
    'vadodara': 'BDQ',
    'surat': 'STV',
    'rajkot': 'RAJ',
    'bhubaneswar': 'BBI',
    'visakhapatnam': 'VTZ',
    'coimbatore': 'CJB',
    'kozhikode': 'CCJ',
    'mangalore': 'IXE',
    'srinagar': 'SXR',
    'jammu': 'IXJ',
    'leh': 'IXL',
    'shimla': 'SLV',
    'manali': 'KUU',
    'dharamshala': 'DHM',
    'dehradun': 'DED',
    'udaipur': 'UDR',
    'jodhpur': 'JDH',
    'jaisalmer': 'JSA',
    'jabalpur': 'JLR',
    'gwalior': 'GWL',
    'bikaner': 'BKB'
  };

  // Convert input to IATA code
  const getCityCode = (place) => {
    if (!place) return '';
    const str = place.toString().trim();
    const upper = str.toUpperCase();
    
    // If it's already a 3-letter IATA code, use it directly
    if (/^[A-Z]{3}$/.test(upper)) return upper;
    
    // Otherwise map known city names (case-insensitive)
    const lower = str.toLowerCase();
    return cityCodeMap[lower] || upper;
  };

  // Handle origin change
  const handleOriginChange = (value) => {
    setOrigin(value);
    const iataCode = getCityCode(value);
    setOriginIata(iataCode);
  };

  // Handle destination change
  const handleDestinationChange = (value) => {
    setDestination(value);
    const iataCode = getCityCode(value);
    setDestinationIata(iataCode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!origin || !destination || !departureDate || !checkIn || !checkOut) {
      toast.error("Please fill all required fields");
      return;
    }

    // Ensure we have IATA codes (auto-convert if needed)
    const finalOriginIata = originIata || getCityCode(origin);
    const finalDestinationIata = destinationIata || getCityCode(destination);
    
    if (!finalOriginIata || !finalDestinationIata) {
      toast.error("Please enter valid city names or IATA codes");
      return;
    }

    // Ensure adults is a valid number
    const numAdults = Math.max(1, parseInt(adults, 10) || 1);

    setLoading(true);
    setResult(null);

    try {
      // Log the request parameters for debugging
      console.log('Making API request with params:', {
        origin: finalOriginIata,
        destination: finalDestinationIata,
        date: departureDate,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: numAdults,
      });

      // Use the API utility to make the request
      const response = await api.get('/travel', {
        params: {
          origin: finalOriginIata,
          destination: finalDestinationIata,
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
          flights: Array.isArray(response.data.flights) ? response.data.flights : [],
          hotels: Array.isArray(response.data.hotels) ? response.data.hotels : [],
          trains: Array.isArray(response.data.trains) ? response.data.trains : [],
          cheapestTrip: response.data.cheapestTrip || null
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
            onChange={(e) => handleOriginChange(e.target.value)}
            placeholder="Enter origin city or IATA code (e.g., Delhi or DEL)"
            className="w-full border border-gray-300 p-2 rounded"
          />
          {originIata && originIata !== origin && (
            <p className="text-xs text-gray-500 mt-1">IATA Code: {originIata}</p>
          )}
        </div>

        <div>
          <label className="block mb-1 font-semibold">Destination</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => handleDestinationChange(e.target.value)}
            placeholder="Enter destination city or IATA code (e.g., Mumbai or BOM)"
            className="w-full border border-gray-300 p-2 rounded"
          />
          {destinationIata && destinationIata !== destination && (
            <p className="text-xs text-gray-500 mt-1">IATA Code: {destinationIata}</p>
          )}
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
                        {flight.details?.airline || flight.provider || 'Flight'}
                      </h3>
                      {flight.details?.class && (
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          {flight.details.class}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mt-1">
                      {flight.from} → {flight.to}
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
                          {flight.duration || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex justify_between items-center">
                        <div>
                          <span className="text-sm text-gray-500">Price:</span>
                          <span className="ml-2 font-bold text-lg">{formatCurrency(flight.price, flight.currency)}</span>
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
                        {hotel.details?.hotelName || hotel.name || 'Hotel'}
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
                          <span className="ml-2 font-bold text-lg">{formatCurrency(hotel.price, hotel.currency)}</span>
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
                        {train.from} ({train.fromCode || ''}) → {train.to} ({train.toCode || ''})
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
                          <span className="font-medium">{train.duration || 'N/A'}</span>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-sm text-gray-500">Price:</span>
                            <span className="ml-2 font-bold text-lg">{formatCurrency(train.price, train.currency)}</span>
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
                        {result.cheapestTrip.hotel.name}
                      </div>
                      
                      <div className="text-gray-500">Location:</div>
                      <div>{result.cheapestTrip.hotel.location || destination || 'N/A'}</div>
                      
                      <div className="text-gray-500">Check-in:</div>
                      <div>{result.cheapestTrip.hotel.checkIn || checkIn || 'N/A'}</div>
                      
                      <div className="text-gray-500">Check-out:</div>
                      <div>{result.cheapestTrip.hotel.checkOut || checkOut || 'N/A'}</div>
                      
                      <div className="text-gray-500">Price per night:</div>
                      <div className="font-bold">{formatCurrency(result.cheapestTrip.hotel.price, result.cheapestTrip.hotel.currency)}</div>
                    </div>
                  </div>
                )}
                
                <div className="bg-blue-50 p-3 rounded shadow border border-blue-100">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Estimated Cost:</span>
                    <span className="text-xl font-bold text-blue-700">{formatCurrency(result.cheapestTrip.totalCost, result.cheapestTrip.currency)}</span>
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
