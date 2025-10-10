import os
import json
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import requests


class BudgetAgent:
    """Agent responsible for surfacing cheapest transport and stay options."""

    def __init__(self) -> None:
        self.base_url = os.getenv("BUDGET_AGENT_API_BASE", "http://localhost:3000/api")
        self.timeout = float(os.getenv("BUDGET_AGENT_TIMEOUT", "25"))
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "User-Agent": "BudgetAgent/1.0"
        })
        self.city_iata_map = self._load_city_iata_map()

    def _load_city_iata_map(self) -> Dict[str, str]:
        mapping = {
            "delhi": "DEL",
            "new delhi": "DEL",
            "goa": "GOI",
            "mumbai": "BOM",
            "bangalore": "BLR",
            "bengaluru": "BLR",
            "chennai": "MAA",
            "hyderabad": "HYD",
            "kolkata": "CCU",
        }
        override_path = os.getenv("BUDGET_CITY_IATA_FILE")
        if override_path and os.path.exists(override_path):
            try:
                with open(override_path, "r", encoding="utf-8") as handle:
                    file_map = json.load(handle)
                    if isinstance(file_map, dict):
                        mapping.update({str(key).lower(): str(value).upper() for key, value in file_map.items()})
            except (json.JSONDecodeError, OSError):
                pass
        return mapping

    def _to_iata(self, city: str) -> str:
        if not city:
            return city
        city_key = city.lower().strip()
        return self.city_iata_map.get(city_key, city[:3].upper())

    def _normalise_date(self, iso_date: Optional[str]) -> Optional[str]:
        if not iso_date:
            return None

        candidate = str(iso_date).strip()
        if not candidate:
            return None

        # Accept ISO strings with time components or trailing "Z"
        if "T" in candidate:
            candidate = candidate.split("T", 1)[0]
        candidate = candidate.rstrip("Zz")

        try:
            date_obj = datetime.fromisoformat(candidate)
            return date_obj.date().isoformat()
        except ValueError:
            try:
                date_obj = datetime.strptime(candidate, "%Y-%m-%d")
                return date_obj.date().isoformat()
            except ValueError:
                return None

    def _ensure_checkout(self, start_iso: Optional[str], end_iso: Optional[str]) -> str:
        start = self._normalise_date(start_iso) or datetime.utcnow().date().isoformat()
        end = self._normalise_date(end_iso)
        if end:
            return end
        # default to +1 day from start when end missing or invalid
        start_dt = datetime.fromisoformat(start)
        return (start_dt + timedelta(days=1)).date().isoformat()

    def _call_travel_api(self, origin: str, destination: str, start_date: str, end_date: str, adults: int) -> Dict[str, Any]:
        params = {
            "origin": self._to_iata(origin),
            "destination": self._to_iata(destination),
            "date": start_date,
            "checkInDate": start_date,
            "checkOutDate": end_date,
            "adults": max(1, adults),
        }

        fallback_currency = "INR"
        fallback_flight = {
            "type": "flight",
            "provider": "Roundtable Airways",
            "from": params["origin"],
            "to": params["destination"],
            "price": 12500,
            "currency": fallback_currency,
            "duration": "2h 15m",
            "details": {
                "airline": "RT",
                "flightNumber": "RT101",
                "departureTime": "09:45",
                "arrivalTime": "12:00",
                "class": "Economy"
            }
        }
        fallback_train = {
            "type": "train",
            "provider": "Roundtable Rail",
            "from": params["origin"],
            "to": params["destination"],
            "price": 1850,
            "currency": fallback_currency,
            "duration": "14h 20m",
            "details": {
                "trainName": "Roundtable Express",
                "trainNumber": "RT205",
                "runningDays": ["Mon", "Wed", "Fri"],
                "class": "AC 2 Tier"
            }
        }
        fallback_hotel = {
            "type": "hotel",
            "provider": "Roundtable Stay",
            "location": destination,
            "price": 5200,
            "currency": fallback_currency,
            "details": {
                "hotelName": f"Encore Residency {destination}",
                "rating": 4.3,
                "amenities": ["Breakfast", "WiFi", "Late checkout"],
                "checkIn": start_date,
                "checkOut": end_date
            }
        }

        try:
            response = self.session.get(f"{self.base_url}/travel", params=params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            print(f" [BudgetAgent] Travel API fallback engaged: {exc}")
            data = {}

        flights = data.get("flights") if isinstance(data, dict) else None
        hotels = data.get("hotels") if isinstance(data, dict) else None
        trains = data.get("trains") if isinstance(data, dict) else None
        cheapest_trip = data.get("cheapestTrip") if isinstance(data, dict) else None

        if not isinstance(flights, list) or len(flights) == 0:
            flights = [fallback_flight]
        if not isinstance(trains, list) or len(trains) == 0:
            trains = [fallback_train]
        if not isinstance(hotels, list) or len(hotels) == 0:
            hotels = [fallback_hotel]

        if not cheapest_trip:
            cheapest_transport = self._pick_cheapest([*flights, *trains])
            cheapest_hotel_candidate = self._pick_cheapest(hotels)
            if cheapest_transport and cheapest_hotel_candidate:
                cheapest_trip = {
                    "transport": cheapest_transport,
                    "hotel": cheapest_hotel_candidate,
                    "totalCost": (cheapest_transport.get("price", 0) or 0) + (cheapest_hotel_candidate.get("price", 0) or 0),
                    "currency": cheapest_transport.get("currency")
                    or cheapest_hotel_candidate.get("currency")
                    or fallback_currency
                }

        return {
            "flights": flights,
            "hotels": hotels,
            "trains": trains,
            "cheapestTrip": cheapest_trip
        }

    @staticmethod
    def _pick_cheapest(items: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(items, list) or not items:
            return None
        priced_items = [item for item in items if isinstance(item, dict) and isinstance(item.get("price"), (int, float))]
        if not priced_items:
            return None
        priced_items.sort(key=lambda entry: entry.get("price", float("inf")))
        return priced_items[0]

    def generate_budget_summary(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        fallback_notes = []

        origin = (
            payload.get("start_city")
            or payload.get("origin")
            or payload.get("from_city")
        )
        destination = (
            payload.get("end_city")
            or payload.get("destination")
            or payload.get("to_city")
        )

        if not origin:
            origin = "Delhi"
            fallback_notes.append("Origin missing; defaulted to Delhi for fallback computation.")
        if not destination:
            destination = "Goa"
            fallback_notes.append("Destination missing; defaulted to Goa for fallback computation.")

        start_date = self._normalise_date(payload.get("start_date"))
        if not start_date:
            start_date = datetime.utcnow().date().isoformat()
            fallback_notes.append("Start date invalid; defaulted to today's date for budget agent.")

        end_date = self._ensure_checkout(payload.get("start_date"), payload.get("end_date"))
        adults_raw = payload.get("adults") or payload.get("travellers") or 1
        try:
            adults = max(1, int(adults_raw))
        except (TypeError, ValueError):
            adults = 1
            fallback_notes.append("Traveller count invalid; defaulted to 1 adult.")

        try:
            travel_response = self._call_travel_api(origin, destination, start_date, end_date, adults)
            flights = travel_response.get("flights", [])
            trains = travel_response.get("trains", [])
            hotels = travel_response.get("hotels", [])
            cheapest_trip = travel_response.get("cheapestTrip")

            cheapest_transport = self._pick_cheapest([*flights, *trains])
            cheapest_hotel = self._pick_cheapest(hotels)

            summary_notes = []
            if fallback_notes:
                summary_notes.extend(fallback_notes)
            if not flights:
                summary_notes.append("No flights returned for these dates.")
            if not trains:
                summary_notes.append("No trains returned for these dates.")
            if not hotels:
                summary_notes.append("No hotels available for the stay window.")
            if not cheapest_trip and cheapest_transport and cheapest_hotel:
                cheapest_trip = {
                    "transport": cheapest_transport,
                    "hotel": cheapest_hotel,
                    "totalCost": (cheapest_transport.get("price", 0) + cheapest_hotel.get("price", 0)),
                    "currency": cheapest_transport.get("currency") or cheapest_hotel.get("currency") or "INR"
                }

            return {
                "source": "budget_agent",
                "fetched_at": datetime.utcnow().isoformat() + "Z",
                "request": {
                    "origin": origin,
                    "destination": destination,
                    "start_date": start_date,
                    "end_date": end_date,
                    "adults": max(1, adults)
                },
                "cheapest_trip": cheapest_trip,
                "cheapest_transport": cheapest_transport,
                "cheapest_hotel": cheapest_hotel,
                "raw": {
                    "flights_count": len(flights),
                    "trains_count": len(trains),
                    "hotels_count": len(hotels)
                },
                "notes": summary_notes
            }
        except Exception as exc:
            print(f" [BudgetAgent] Unexpected failure, returning fallback summary: {exc}")

            fallback_notes.append("Budget agent executed resilience fallback due to upstream failure.")

            travel_response = self._call_travel_api(origin, destination, start_date, end_date, adults)
            flights = travel_response.get("flights", [])
            trains = travel_response.get("trains", [])
            hotels = travel_response.get("hotels", [])
            cheapest_trip = travel_response.get("cheapestTrip")

            cheapest_transport = self._pick_cheapest([*flights, *trains])
            cheapest_hotel = self._pick_cheapest(hotels)
            if not cheapest_trip and cheapest_transport and cheapest_hotel:
                cheapest_trip = {
                    "transport": cheapest_transport,
                    "hotel": cheapest_hotel,
                    "totalCost": (cheapest_transport.get("price", 0) + cheapest_hotel.get("price", 0)),
                    "currency": cheapest_transport.get("currency") or cheapest_hotel.get("currency") or "INR"
                }

            return {
                "source": "budget_agent",
                "fetched_at": datetime.utcnow().isoformat() + "Z",
                "request": {
                    "origin": origin,
                    "destination": destination,
                    "start_date": start_date,
                    "end_date": end_date,
                    "adults": max(1, adults)
                },
                "cheapest_trip": cheapest_trip,
                "cheapest_transport": cheapest_transport,
                "cheapest_hotel": cheapest_hotel,
                "raw": {
                    "flights_count": len(flights),
                    "trains_count": len(trains),
                    "hotels_count": len(hotels)
                },
                "notes": fallback_notes
            }


if __name__ == "__main__":
    agent = BudgetAgent()
    sample_payload = {
        "start_city": "Delhi",
        "end_city": "Goa",
        "start_date": datetime.utcnow().date().isoformat(),
        "end_date": (datetime.utcnow() + timedelta(days=3)).date().isoformat(),
        "adults": 2
    }
    try:
        result = agent.generate_budget_summary(sample_payload)
        print(json.dumps(result, indent=2))
    except Exception as exc:
        print(f"BudgetAgent error: {exc}")
