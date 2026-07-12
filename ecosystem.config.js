// PM2 Process Manager Configuration (ESM version)
// Architecture: 3 processes instead of 8
//   - backend      : Node.js Express + Socket.IO API server (port 3001)
//   - langgraph    : Single Python process with LangGraph pipeline + all AI agents
//   - frontend     : Vite dev server (port 5173/5174)
export default {
  apps: [
    // 1. Backend Server
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
      error_file: "./backend/logs/backend-error.log",
      out_file: "./backend/logs/backend-out.log",
      time: true,
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000
    },
    // 2. LangGraph Orchestrator — replaces 6 individual MCP agent processes.
    //    This single process handles: Supervisor, Map, Weather, Itinerary,
    //    Events, Budget, Critic, and the Chat Agent via LangGraph StateGraph.
    {
      name: "langgraph",
      interpreter: "./backend/mcp-ai/venv/bin/python",
      script: "./backend/mcp-ai/langgraph_orchestrator.py",
      watch: [
        "./backend/mcp-ai/langgraph_orchestrator.py",
        "./backend/mcp-ai/graph.py",
        "./backend/mcp-ai/agents",
        "./backend/mcp-ai/rag"
      ],
      error_file: "./logs/langgraph-error.log",
      out_file: "./logs/langgraph-out.log",
      time: true,
      autorestart: true,
      env: {
        PYTHONPATH: "./backend/mcp-ai"
      }
    },
    // 3. Frontend Dev Server
    {
      name: "frontend",
      script: "npm",
      args: "run dev",
      cwd: ".",
      watch: false,
      env: {
        NODE_ENV: "development"
      },
      error_file: "./logs/frontend-error.log",
      out_file: "./logs/frontend-out.log",
      time: true,
      autorestart: true
    }
  ]
};
