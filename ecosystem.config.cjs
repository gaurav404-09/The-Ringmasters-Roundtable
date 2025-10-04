// PM2 Process Manager Configuration
module.exports = {
  apps: [
    // Backend Server - Start this first
    {
      name: "backend",
      script: "server.js",
      cwd: "./backend",
      watch: ["server.js", "services"],
      env: {
        NODE_ENV: "development",
        PORT: 3001,
        RABBITMQ_URL: "amqp://localhost"
      },
      error_file: "./logs/backend-error.log",
      out_file: "./logs/backend-out.log",
      time: true,
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000
    },
    // Python Agents - Start these after backend is ready
    {
      name: "orchestrator",
      interpreter: "./backend/mcp-ai/venv/bin/python",
      script: "./backend/mcp-ai/orchestrator_mcp.py",
      watch: ["./backend/mcp-ai/orchestrator_mcp.py"],
      error_file: "./logs/orchestrator-error.log",
      out_file: "./logs/orchestrator-out.log",
      time: true,
      wait_ready: false,
      autorestart: true,
      env: {
        PYTHONPATH: "./backend/mcp-ai"
      }
    },
    {
      name: "map-agent",
      interpreter: "./backend/mcp-ai/venv/bin/python",
      script: "./backend/mcp-ai/map_agent_mcp.py",
      watch: [
        "./backend/mcp-ai/map_agent_mcp.py",
        "./backend/mcp-ai/map_agent.py"
      ],
      error_file: "./logs/map-agent-error.log",
      out_file: "./logs/map-agent-out.log",
      time: true,
      autorestart: true,
      env: {
        PYTHONPATH: "./backend/mcp-ai"
      }
    },
    {
      name: "weather-agent",
      interpreter: "./backend/mcp-ai/venv/bin/python",
      script: "./backend/mcp-ai/weather_agent_mcp.py",
      watch: [
        "./backend/mcp-ai/weather_agent_mcp.py",
        "./backend/mcp-ai/weather_agent.py"
      ],
      error_file: "./logs/weather-agent-error.log",
      out_file: "./logs/weather-agent-out.log",
      time: true,
      autorestart: true,
      env: {
        PYTHONPATH: "./backend/mcp-ai"
      }
    },
    {
      name: "itinerary-agent",
      interpreter: "./backend/mcp-ai/venv/bin/python",
      script: "./backend/mcp-ai/itinerary_agent_mcp.py",
      watch: [
        "./backend/mcp-ai/itinerary_agent_mcp.py",
        "./backend/mcp-ai/itinerary_agent.py"
      ],
      error_file: "./logs/itinerary-agent-error.log",
      out_file: "./logs/itinerary-agent-out.log",
      time: true,
      autorestart: true,
      env: {
        PYTHONPATH: "./backend/mcp-ai"
      }
    },
    {
      name: "event-agent",
      interpreter: "./backend/mcp-ai/venv/bin/python",
      script: "./backend/mcp-ai/event_agent_mcp.py",
      watch: [
        "./backend/mcp-ai/event_agent_mcp.py",
        "./backend/mcp-ai/event_agent.py"
      ],
      error_file: "./logs/event-agent-error.log",
      out_file: "./logs/event-agent-out.log",
      time: true,
      autorestart: true,
      env: {
        PYTHONPATH: "./backend/mcp-ai"
      }
    },
    // Frontend - Start this last
    {
      name: "frontend",
      script: "npm",
      args: "run dev",
      cwd: ".",
      watch: ["src", "public"],
      env: {
        NODE_ENV: "development",
        PORT: 5173,
        VITE_API_URL: "http://localhost:3001"
      },
      error_file: "./logs/frontend-error.log",
      out_file: "./logs/frontend-out.log",
      time: true,
      wait_ready: true,
      listen_timeout: 10000,
      autorestart: true
    }
  ]
};
