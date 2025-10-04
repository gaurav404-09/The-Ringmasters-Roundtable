#!/bin/bash

# Start RabbitMQ if not already running
if ! pgrep -x "rabbitmq-server" > /dev/null; then
    echo "Starting RabbitMQ..."
    brew services start rabbitmq
    sleep 5  # Give RabbitMQ time to start
fi

# Navigate to the mcp-ai directory
cd "$(dirname "$0")/mcp-ai"

# Activate the virtual environment
source venv/bin/activate

# Function to start a service in a new terminal window
start_service() {
    osascript -e "tell app \"Terminal\" to do script \"cd '$(pwd)' && source venv/bin/activate && python $1"
}

# Start all agents in separate terminal windows
echo "Starting orchestrator and agents..."
start_service "orchestrator_mcp.py"
start_service "map_agent_mcp.py"
start_service "weather_agent_mcp.py"
start_service "itinerary_agent_mcp.py"
start_service "event_agent_mcp.py"

# Start the Node.js server
echo "Starting Node.js server..."
cd ..
nodemon server.js

echo "All services started. You can now access the frontend at http://localhost:5173"
