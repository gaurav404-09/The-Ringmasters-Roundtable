import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import freeDataService from "../services/freeDataService.js";

const server = new Server(
  {
    name: "ringmasters-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_attractions",
        description: "Get attractions for a city",
        inputSchema: {
          type: "object",
          properties: {
            city: { type: "string" },
          },
          required: ["city"],
        },
      },
      {
        name: "get_restaurants",
        description: "Get restaurants for a city",
        inputSchema: {
          type: "object",
          properties: {
            city: { type: "string" },
          },
          required: ["city"],
        },
      },
      {
        name: "get_weather",
        description: "Get weather for a city on specific dates",
        inputSchema: {
          type: "object",
          properties: {
            city: { type: "string" },
            dates: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["city", "dates"],
        },
      },
      {
        name: "get_driving_distance",
        description: "Get driving distance and duration between two cities",
        inputSchema: {
          type: "object",
          properties: {
            cityA: { type: "string" },
            cityB: { type: "string" },
          },
          required: ["cityA", "cityB"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_attractions") {
      const data = await freeDataService.getAttractions(args.city);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }

    if (name === "get_restaurants") {
      const data = await freeDataService.getRestaurants(args.city);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }

    if (name === "get_weather") {
      const data = await freeDataService.getWeather(args.city, args.dates);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }

    if (name === "get_driving_distance") {
      const data = await freeDataService.getDrivingData(args.cityA, args.cityB);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing tool ${name}: ${error.message}`,
        },
      ],
    };
  }
});

// Start the server using stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server is running on stdio");
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
