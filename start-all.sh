#!/bin/bash

# Function to start a command in the background
start_service() {
  local name=$1
  local command=$2
  local logfile="logs/${name}.log"
  
  echo "Starting $name..."
  mkdir -p logs
  # Start the process in the background and redirect output to log file
  nohup bash -c "$command" > "$logfile" 2>&1 &
  # Save the process ID
  echo $! > "logs/${name}.pid"
  echo "$name started. Logs: $logfile"
}

# Clean up function to kill all background processes on script exit
cleanup() {
  echo "Shutting down services..."
  for pidfile in logs/*.pid; do
    if [ -f "$pidfile" ]; then
      kill $(cat "$pidfile") 2>/dev/null || true
      rm "$pidfile"
    fi
  done
  exit 0
}

# Set up trap to call cleanup on script exit
trap cleanup SIGINT SIGTERM

# Create logs directory if it doesn't exist
mkdir -p logs

# Start frontend
start_service "frontend" "cd $(pwd) && npm run dev"

# Start backend
start_service "backend" "cd $(pwd)/backend && PORT=3000 npm start"

# Start MCP agents (opens dedicated Terminal tabs)
if [ -f "backend/start_agents.sh" ]; then
  echo "Launching MCP agents via backend/start_agents.sh..."
  bash backend/start_agents.sh &
  AGENT_PID=$!
  echo $AGENT_PID > "logs/agents_launcher.pid"
  echo "Agents launcher started (PID: $AGENT_PID). Check Terminal for agent tabs."
else
  echo "Warning: backend/start_agents.sh not found. Agents were not started."
fi

echo "All services started in the background."
echo "Frontend: http://localhost:5173"
echo "Backend API: http://localhost:3000"
echo "Check logs/ directory for service logs"
echo "Press Ctrl+C to stop all services"

# Keep the script running
while true; do sleep 1; done
