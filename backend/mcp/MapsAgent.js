export class MapsAgent {
    async receiveMessage(message) {
      if (message.type === 'GET_ROUTE') {
        const { origin, destination, mode } = message.payload;
  
        const response = await fetch(`http://localhost:3000/api/directions?origin=${origin}&destination=${destination}&mode=${mode}`);
        const routeData = await response.json();
  
        return { type: 'ROUTE_RESULT', payload: routeData, requestId: message.requestId };
      }
      throw new Error(`MapsAgent cannot handle message type ${message.type}`);
    }
  }
  