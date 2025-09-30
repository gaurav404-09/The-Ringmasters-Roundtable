import React from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";

import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const MapView = ({ routeCoords, origin, destination }) => {
  if (!routeCoords || routeCoords.length === 0) {
    return (
      <div className="bg-gray-200 rounded-xl h-64 md:h-96 flex items-center justify-center text-gray-500">
        🗺️ Enter a route to see it here
      </div>
    );
  }

  return (
    <MapContainer
      center={routeCoords[0]}
      zoom={7}
      className="h-64 md:h-96 w-full rounded-xl"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      />

      {/* Draw the route */}
      <Polyline positions={routeCoords} color="green" weight={5} />

      {/* Markers */}
      <Marker position={routeCoords[0]}>
        <Popup>Start: {origin}</Popup>
      </Marker>
      <Marker position={routeCoords[routeCoords.length - 1]}>
        <Popup>End: {destination}</Popup>
      </Marker>
    </MapContainer>
  );
};

export default MapView;
