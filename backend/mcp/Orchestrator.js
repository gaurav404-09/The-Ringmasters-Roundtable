import { WeatherAgent } from './WeatherAgent.js';
import { MapsAgent } from './MapsAgent.js';
import { BudgetAgent } from './BudgetAgent.js';
import { ItineraryAgent } from './ItineraryAgent.js';

export class Orchestrator {
  constructor() {
    this.weatherAgent = new WeatherAgent();
    this.mapsAgent = new MapsAgent();
    this.budgetAgent = new BudgetAgent();
    this.itineraryAgent = new ItineraryAgent();
  }

  async planTrip(request) {
    const requestId = Math.random().toString(36).substring(2, 8);

    // Weather
    const weather = await this.weatherAgent.receiveMessage({ type: 'GET_WEATHER', payload: request, requestId });

    // Route
    const route = await this.mapsAgent.receiveMessage({
      type: 'GET_ROUTE',
      payload: { origin: request.origin || 'Current Location', destination: request.destination, mode: 'driving' },
      requestId
    });

    // Budget
    const budget = await this.budgetAgent.receiveMessage({
      type: 'GET_BUDGET',
      payload: { route: route.payload, budget: request.budget || 'medium' },
      requestId
    });

    // Itinerary
    const itinerary = await this.itineraryAgent.receiveMessage({
      type: 'GENERATE_ITINERARY',
      payload: { ...request, weather: weather.payload, route: route.payload, budget: budget.payload },
      requestId
    });

    return { weather: weather.payload, route: route.payload, budget: budget.payload, itinerary: itinerary.payload };
  }
}
