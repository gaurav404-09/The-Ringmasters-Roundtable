import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import ENV from '../config/env';

// --- Helper Components for UI ---

const ItineraryCard = ({ result }) => {
  if (!result || !result.itinerary) return null;

  return (
    <div className="mt-8">
      <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">Your Generated Trip Plan</h2>
      {result.itinerary.map((day, index) => (
        <div key={index} className="mb-6 bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h3 className="text-xl font-bold text-indigo-700">Day {day.day}: {day.city}</h3>
            <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {day.weather.temp}°C, {day.weather.weather}
            </span>
          </div>
          
          <div className="mb-4">
            <h4 className="font-semibold text-gray-700 mb-2">Activities</h4>
            <ul className="space-y-3">
              {day.activities.map((activity, aIndex) => (
                <li key={aIndex} className="flex items-start">
                  <span className="bg-indigo-100 text-indigo-800 text-sm font-semibold mr-4 px-3 py-1 rounded-full whitespace-nowrap">{activity.time}</span>
                  <div>
                    <p className="font-medium text-gray-900">{activity.title}</p>
                    <p className="text-gray-500 text-sm">{activity.notes}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {result.events[day.city] && result.events[day.city].length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 pt-4 border-t">Local Events in {day.city}</h4>
              <ul className="space-y-4">
                {result.events[day.city].map((event, eIndex) => (
                  <li key={eIndex} className="flex items-center">
                    <img src={event.imageUrl} alt={event.title} className="w-28 h-20 rounded-lg mr-4 object-cover shadow-md" />
                    <div>
                      <p className="font-semibold text-gray-900">{event.title}</p>
                      <p className="text-gray-500 text-sm">{event.location} on {event.date}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const LogDisplay = ({ logs }) => (
  <div className="mt-6 bg-gray-900 text-white font-mono text-sm p-4 rounded-lg shadow-inner max-h-60 overflow-y-auto">
    <p className="text-gray-400 pb-2 border-b border-gray-700">Orchestrator Logs:</p>
    {logs.map((log, index) => (
      <p key={index} className="whitespace-pre-wrap animate-pulse-fast">&gt; {log}</p>
    ))}
  </div>
);


// --- Main App Component ---

const PlanTrip = () => {
  const [from, setFrom] = useState('Delhi');
  const [to, setTo] = useState('Goa');
  const [days, setDays] = useState(5);
  
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    // Use the WebSocket URL from environment configuration
    const socketUrl = ENV.WS_URL;
    
    console.log('Attempting to connect to WebSocket server at:', socketUrl);
    
    const newSocket = io(socketUrl, {
      path: '/socket.io/',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      transports: ['polling', 'websocket'],
      upgrade: true,
      secure: false,
      rejectUnauthorized: false
    });
    
    setSocket(newSocket);
    
    // Log connection status
    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server with ID:', newSocket.id);
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Connection Error:', error);
      console.error('Error details:', {
        message: error.message,
        description: error.description,
        context: error.context
      });
      setLogs(prev => [...prev, `Connection error: ${error.message}`]);
    });
    
    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // The disconnection was initiated by the server, you need to reconnect manually
        newSocket.connect();
      }
    });
    
    // Handle reconnection attempts
    newSocket.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnection attempt ${attempt}`);
    });
    
    newSocket.on('reconnect_failed', () => {
      console.error('Failed to reconnect to the server');
      setLogs(prev => [...prev, 'Failed to reconnect to the server']);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // The disconnection was initiated by the server, you need to reconnect manually
        newSocket.connect();
      }
    });

    newSocket.on('status_update', (data) => {
      console.log('Status:', data.message);
      // This is how we display the orchestrator's print statements
      setLogs(prevLogs => [...prevLogs, data.message]);
    });

    newSocket.on('trip_result', (data) => {
      console.log('Final trip result received:', data);
      setResult(data);
      setLoading(false);
    });

    // Clean up the connection when the component unmounts.
    return () => {
      newSocket.off('connect');
      newSocket.off('connect_error');
      newSocket.off('disconnect');
      newSocket.off('status_update');
      newSocket.off('trip_result');
      newSocket.close();
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!socket) {
      alert('Backend server is not connected.');
      return;
    }

    // Reset previous results and start loading
    setLoading(true);
    setResult(null);
    setLogs([]);
    
    const tripRequest = {
      start_city: from,
      end_city: to,
      num_days: days,
    };
    
    // Send the request to the server, which will forward it to the orchestrator
    socket.emit('plan_trip', tripRequest);
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900">Multi-Agent Trip Planner</h1>
          <p className="text-lg text-gray-500 mt-2">Powered by the Ringmaster's Roundtable AI</p>
        </header>

        {!loading && !result && (
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <form onSubmit={handleSubmit}>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="from" className="block text-sm font-medium text-gray-700">From</label>
                  <input
                    type="text"
                    id="from"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="to" className="block text-sm font-medium text-gray-700">To</label>
                  <input
                    type="text"
                    id="to"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="days" className="block text-sm font-medium text-gray-700">Days</label>
                  <input
                    type="number"
                    id="days"
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value, 10))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    min="1"
                    max="15"
                    required
                  />
                </div>
              </div>
              <div className="mt-8 text-center">
                <button type="submit" className="w-full md:w-auto bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  Generate My AI Itinerary
                </button>
              </div>
            </form>
          </div>
        )}

        {loading && (
          <div className="text-center bg-white p-8 rounded-xl shadow-lg border">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-semibold">Your AI agents are collaborating...</p>
            <LogDisplay logs={logs} />
          </div>
        )}
        
        {result && (
            <div>
                 <ItineraryCard result={result} />
                 <div className="text-center mt-8">
                     <button 
                        onClick={() => { setResult(null); setLoading(false); }}
                        className="bg-gray-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-700 transition-colors">
                        Plan Another Trip
                    </button>
                 </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default PlanTrip;

