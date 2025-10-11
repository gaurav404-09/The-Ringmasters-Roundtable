#!/bin/bash

# Navigate to the mcp-ai directory
cd "$(dirname "$0")/mcp-ai"

# Activate the virtual environment
source venv/bin/activate

# Function to start a service and show its output
start_agent() {
    local name=$1
    local script=$2
    echo "Starting $name..."
    osascript <<EOD
tell application "Terminal"
    do script "cd '$(pwd)' && source venv/bin/activate && python $script"
    set currentTab to the result
    set custom title of currentTab to "$name"
end tell
EOD
    echo "$name started in a new terminal window"
}

# Start RabbitMQ if not running
if ! pgrep -x "rabbitmq-server" > /dev/null; then
    echo "Starting RabbitMQ..."
    brew services start rabbitmq
    sleep 5  # Give RabbitMQ time to start
fi

# Start all agents
start_agent "Orchestrator" "orchestrator_mcp.py"
sleep 2
start_agent "Map Agent" "map_agent_mcp.py"
sleep 1
start_agent "Weather Agent" "weather_agent_mcp.py"
sleep 1
start_agent "Itinerary Agent" "itinerary_agent_mcp.py"
sleep 1
start_agent "Event Agent" "event_agent_mcp.py"
sleep 1
start_agent "Budget Agent" "budget_agent_mcp.py"

echo "All agents started in separate terminal windows."
echo "You can now use the application at http://localhost:5173"
