#!/bin/bash

# Start the backend services in the background
echo "Starting backend services..."
cd backend
./start_services.sh &
BACKEND_PID=$!
cd ..

# Start the frontend in a new terminal window
echo "Starting frontend..."
osascript -e "tell app \"Terminal\" to do script \"cd '$(pwd)' && npm run dev\""

# Wait for the backend to be ready
echo "Waiting for backend to start..."
sleep 5

# Open the browser to the frontend
open "http://localhost:5173/plan-trip"

echo "Application is starting up..."
echo "- Frontend will be available at http://localhost:5173"
echo "- Backend server is running on port 3001"
echo "- Press Ctrl+C to stop all services"

trap "kill $BACKEND_PID 2> /dev/null; exit" INT
wait $BACKEND_PID 2>/dev/null
