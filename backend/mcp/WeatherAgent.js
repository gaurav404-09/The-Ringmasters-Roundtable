import freeDataService from '../services/freeDataService.js';

export class WeatherAgent {
  async receiveMessage(message) {
    if (message.type === 'GET_WEATHER') {
      const data = await freeDataService.getWeather(message.payload.destination);
      return { type: 'WEATHER_RESULT', payload: data, requestId: message.requestId };
    }
    throw new Error(`WeatherAgent cannot handle message type ${message.type}`);
  }
}
