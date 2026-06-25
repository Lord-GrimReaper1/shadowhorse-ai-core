const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const { tools, toolHandlers } = require('./tools');
const { resources, handleResourceRead, listResources } = require('./resources');
const { prompts, getPrompt } = require('./prompts');

require('dotenv').config({ path: require('path').join(__dirname, '../..', '.env') });

/**
 * Crossroads MCP Server
 * Exposes AI orchestration tools, resources, and prompts via Model Context Protocol
 */

class CrossroadsMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'crossroads-mcp-server',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools };
    });

    // Call a tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const handler = toolHandlers[name];
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const result = await handler(args || {});
        return result;
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message || String(error)
            }, null, 2)
          }],
          isError: true
        };
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const result = await listResources();
      return result;
    });

    // Read a resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      return await handleResourceRead(uri);
    });

    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return { prompts };
    });

    // Get a prompt with filled arguments
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = getPrompt(name, args || {});
        return result;
      } catch (error) {
        throw new Error(`Error getting prompt ${name}: ${error.message}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Crossroads MCP server running on stdio');
  }
}

// Run the server
const server = new CrossroadsMCPServer();
server.run().catch(console.error);
