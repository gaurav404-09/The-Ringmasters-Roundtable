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
    local name=$1
    local script=$2
    echo "Starting $name..."
    osascript <<EOD
tell application "Terminal"
    do script "cd '$PWD' && source venv/bin/activate && python $script"
    set currentTab to the result
    set custom title of currentTab to "$name"
end tell
EOD
    sleep 1
}

# Start all agents in separate terminal windows
echo "Starting orchestrator and agents..."
start_service "Orchestrator" "orchestrator_mcp.py"
start_service "Map Agent" "map_agent_mcp.py"
start_service "Weather Agent" "weather_agent_mcp.py"
start_service "Itinerary Agent" "itinerary_agent_mcp.py"
start_service "Event Agent" "event_agent_mcp.py"

# Start the Node.js server in the current terminal
echo "Starting Node.js server..."
cd ..
nodemon server.js

echo "All services started. You can now access the frontend at http://localhost:5173"
