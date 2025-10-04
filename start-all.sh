#!/bin/bash

# Create logs directory if it doesn't exist
mkdir -p logs

# Start RabbitMQ if not already running
if ! pgrep -x "rabbitmq-server" > /dev/null; then
    echo "Starting RabbitMQ..."
    /opt/homebrew/sbin/rabbitmq-server -detached
    sleep 5 # Give RabbitMQ time to start
else
    echo "RabbitMQ is already running."
fi

# Install dependencies if needed
echo "Installing Node.js dependencies..."
npm install
cd backend
npm install
cd ..

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2 globally..."
    npm install -g pm2
fi

# Clean up any existing PM2 processes
echo "Cleaning up existing PM2 processes..."
pm2 delete all 2>/dev/null || true

# Start services in the correct order
echo "Starting backend services..."
cd /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend
pm2 start server.js --name "backend" \
  --cwd /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend \
  --watch server.js,services \
  --env NODE_ENV=development,PORT=3001,RABBITMQ_URL=amqp://localhost \
  --log /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/logs/backend.log

# Start Python agents
echo "Starting Python agents..."

# Start Orchestrator
pm2 start /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai/orchestrator_mcp.py \
  --name "orchestrator" \
  --interpreter /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai/venv/bin/python \
  --cwd /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai \
  --env PYTHONPATH=/Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai \
  --log /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/logs/orchestrator.log

# Start Map Agent
pm2 start /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai/map_agent_mcp.py \
  --name "map-agent" \
  --interpreter /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai/venv/bin/python \
  --cwd /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai \
  --env PYTHONPATH=/Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai \
  --log /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/logs/map-agent.log

# Start Weather Agent
pm2 start /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai/weather_agent_mcp.py \
  --name "weather-agent" \
  --interpreter /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai/venv/bin/python \
  --cwd /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai \
  --env PYTHONPATH=/Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai \
  --log /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/logs/weather-agent.log

# Start Itinerary Agent
pm2 start /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai/itinerary_agent_mcp.py \
  --name "itinerary-agent" \
  --interpreter /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai/venv/bin/python \
  --cwd /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai \
  --env PYTHONPATH=/Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai \
  --log /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/logs/itinerary-agent.log

# Start Event Agent
pm2 start /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai/event_agent_mcp.py \
  --name "event-agent" \
  --interpreter /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai/venv/bin/python \
  --cwd /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai \
  --env PYTHONPATH=/Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/backend/mcp-ai \
  --log /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/logs/event-agent.log

# Start Frontend
echo "Starting frontend..."
cd /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable
pm2 start npm --name "frontend" \
  --cwd /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable \
  -- start \
  --env NODE_ENV=development,PORT=5173,VITE_API_URL=http://localhost:3001 \
  --log /Users/gaurav_mishra/Documents/WEbster/The-Ringmasters-Roundtable/logs/frontend.log

# Save the PM2 process list
pm2 save

# Display status
echo "\n=== Service Status ==="
pm2 list

# Show logs for a few seconds to check for errors
echo "\n=== Checking logs (press Ctrl+C to continue) ==="
timeout 5s pm2 logs --lines 20 || true

echo "\n=== All services have been started! ==="
echo "Frontend: http://localhost:5173"
echo "Backend API: http://localhost:3000"
echo ""
echo "To view logs: pm2 logs"
echo "To view logs for a specific service: pm2 logs <service-name>"
echo "To stop all services: pm2 stop all"
echo "To restart all services: pm2 restart all"
echo "To monitor services: pm2 monit"
