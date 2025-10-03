export class ItineraryAgent {
    async receiveMessage(message) {
      if (message.type === 'GENERATE_ITINERARY') {
        const { destination, days, interests, startDate, weather, route, budget } = message.payload;
  
        const start = new Date(startDate);
        const itineraryDays = [];
  
        for (let i = 0; i < days; i++) {
          const currentDate = new Date(start);
          currentDate.setDate(start.getDate() + i);
  
          itineraryDays.push({
            id: i + 1,
            date: currentDate.toISOString().split('T')[0],
            title: `Day ${i + 1} in ${destination}`,
            activities: [
              { time: '09:00', title: `Explore ${destination}`, type: 'sightseeing', notes: 'Morning sightseeing', duration: '3h' },
              { time: '12:30', title: `Lunch`, type: 'meal', notes: 'Enjoy local cuisine', duration: '1h 30m' },
              { time: '19:00', title: `Dinner`, type: 'meal', notes: 'Evening meal', duration: '2h' },
            ]
          });
        }
  
        return { type: 'ITINERARY_RESULT', payload: { destination, days: itineraryDays, weather, route, budget }, requestId: message.requestId };
      }
      throw new Error(`ItineraryAgent cannot handle message type ${message.type}`);
    }
  }
  