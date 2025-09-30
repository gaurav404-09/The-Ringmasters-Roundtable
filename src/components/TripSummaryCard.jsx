import React, { useEffect, useState } from "react";
import MapView from "./MapView";
import dotenv from "dotenv";

dotenv.config();

const WEATHER_API = "https://api.openweathermap.org/data/2.5/weather";
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

const formatDistance = (meters) => `${(meters / 1000).toFixed(1)} km`;

const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return hrs > 0 ? `${hrs} hr ${mins} mins` : `${mins} mins`;
};

const TripSummaryCard = ({
  origin,
  destination,
  routeCoords,
  distance,
  duration,
}) => {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    if (destination) {
      fetch(
        `${WEATHER_API}?q=${destination}&appid=${OPENWEATHER_API_KEY}&units=metric`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.cod === 200) {
            setWeather({
              temp: Math.round(data.main.temp),
              condition: data.weather[0].main,
              icon: data.weather[0].icon,
            });
          }
        })
        .catch(() => setWeather(null));
    }
  }, [destination]);

  if (!routeCoords || routeCoords.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-5xl mx-auto p-6 md:p-8 space-y-6">
      {/* Top Info Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Trip Summary
          </h2>
          <p className="text-gray-600">
            <strong>Origin:</strong> {origin}
          </p>
          <p className="text-gray-600">
            <strong>Destination:</strong> {destination}
          </p>
          <p>
            <strong>Distance:</strong> {formatDistance(distance)}
          </p>
          <p>
            <strong>Duration:</strong> {formatDuration(duration)}
          </p>
        </div>

        {weather && (
          <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-xl shadow-sm">
            <img
              src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
              alt="Weather Icon"
              className="w-14 h-14"
            />
            <div>
              <p className="text-xl font-semibold">{weather.temp}°C</p>
              <p className="text-gray-600">{weather.condition}</p>
            </div>
          </div>
        )}
      </div>

      {/* Map Section */}
      <div className="h-64 md:h-96 rounded-xl overflow-hidden shadow-sm">
        <MapView
          routeCoords={routeCoords}
          origin={origin}
          destination={destination}
        />
      </div>
    </div>
  );
};

export default TripSummaryCard;
