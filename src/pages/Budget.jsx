
import React, { useState } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

const Planner = () => {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!origin || !destination || !departureDate || !checkIn || !checkOut) {
      toast.error("Please fill all fields");
      return;
    }

    // IMPORTANT: Origin and destination should be IATA codes (3-letter) if you want real flights/hotels.
    setLoading(true);
    setResult(null);

    try {
      const { data } = await axios.get("http://localhost:3000/api/travel", {
        params: {
          origin: origin.trim().toUpperCase(),
          destination: destination.trim().toUpperCase(),
          date: departureDate,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults,
        },
      });
      setResult(data);
      toast.success("Travel data fetched!");
    } catch (err) {
      console.error(
        "Fetch travel error:",
        err?.response?.data || err.message || err
      );
      toast.error("Failed to fetch travel data — check server logs");
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
          <label className="block mb-1 font-semibold">
            Origin (IATA code, e.g., DEL)
          </label>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Enter origin IATA (e.g., DEL)"
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">
            Destination (IATA code, e.g., BOM)
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Enter destination IATA (e.g., BOM)"
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
            min={1}
            onChange={(e) => setAdults(parseInt(e.target.value || "1", 10))}
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
                {result.flights.map((f, i) => (
                  <div
                    key={i}
                    className="bg-white p-4 rounded shadow hover:shadow-lg transition"
                  >
                    <p className="font-semibold">
                      {f.details.airline} ({f.from} → {f.to})
                    </p>
                    <p>Price: ${parseFloat(f.price).toFixed(2)}</p>
                    <p>
                      Duration:{" "}
                      {f.duration
                        ? f.duration
                            .replace("PT", "")
                            .replace("H", "h ")
                            .replace("M", "m")
                        : "-"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p>No flights found</p>
            )}
          </div>

          {/* Hotels */}
          <div>
            <h2 className="text-2xl font-bold mb-2">Hotels</h2>
            {result.hotels?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.hotels.map((h, i) => (
                  <div
                    key={i}
                    className="bg-white p-4 rounded shadow hover:shadow-lg transition"
                  >
                    <p className="font-semibold">{h.details.hotelName}</p>
                    <p>Location: {h.location}</p>
                    <p>Price: ₹{parseFloat(h.price).toFixed(2)}</p>
                    <p>Rating: {h.details.rating || "N/A"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>No hotels found</p>
            )}
          </div>

          {/* Trains */}
          <div>
            <h2 className="text-2xl font-bold mb-2">Trains</h2>
            {result.trains?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.trains?.map((t, i) => (
                  <div
                    key={i}
                    className="bg-white p-4 rounded shadow hover:shadow-lg transition"
                  >
                    <h3 className="font-semibold">
                      {t.details?.trainName || "Unknown"} (
                      {t.details?.trainNumber || "N/A"})
                    </h3>
                    <p>
                      From {t.from} ({t.fromCode}) → {t.to} ({t.toCode})
                    </p>
                    <p>
                      Departure: {t.startTime || "-"} | Arrival:{" "}
                      {t.endTime || "-"}
                    </p>
                    <p>Duration: {t.duration || "-"}</p>
                    {/* <p>Price: {t.price === "-" ? "-" : `₹${t.price}`}</p> */}
                    <p>
                      Running Days:{" "}
                      {Array.isArray(t.details?.runningDays)
                        ? t.details.runningDays.join(", ")
                        : t.details?.runningDays || "-"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p>No trains found</p>
            )}
          </div>

          {/* Cheapest Trip */}
          <div className="bg-green-50 p-4 rounded shadow">
            <h2 className="text-2xl font-bold mb-2">Cheapest Trip</h2>
            {result.cheapestTrip ? (
              <div>
                <p className="font-semibold">
                  Transport: {result.cheapestTrip.transport.provider} -{" "}
                  {result.cheapestTrip.transport.details?.airline ||
                    result.cheapestTrip.transport.details?.trainName ||
                    ""}
                  {" | "}₹{result.cheapestTrip.transport.price}
                </p>
                <p className="font-semibold">
                  Hotel: {result.cheapestTrip.hotel.details.hotelName} | ₹
                  {result.cheapestTrip.hotel.price}
                </p>
                <p className="mt-2 font-bold">
                  Total Cost: ₹
                  {parseFloat(result.cheapestTrip.totalCost).toFixed(2)}
                </p>
              </div>
            ) : (
              <p>No cheapest trip calculated</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Planner;
