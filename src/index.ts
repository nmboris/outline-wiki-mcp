#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig, getConfigPath } from './config.js';
import { OutlineClient } from './outline-client.js';
import { registerTools } from './tools.js';
import { registerResources } from './resources.js';
import { HttpSseTransport } from './http-sse-transport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
) as { name: string; version: string };

async function main(): Promise<void> {
  // Load configuration
  const configPath = getConfigPath();
  const config = loadConfig(configPath);

  // Create Outline API client
  const client = new OutlineClient(config);

  // Create MCP server
  const server = new McpServer({
    name: packageJson.name,
    version: packageJson.version,
  });

  // Register tools and resources
  registerTools(server, client);
  registerResources(server, client);

  // Determine transport mode from environment
  const transportMode = process.env.MCP_TRANSPORT || 'stdio';

  if (transportMode === 'http' || transportMode === 'sse') {
    // HTTP SSE transport mode
    const port = parseInt(process.env.MCP_PORT || '3000', 10);
    const bearerToken = process.env.MCP_BEARER_TOKEN;

    if (!bearerToken) {
      throw new Error(
        'MCP_BEARER_TOKEN environment variable is required for HTTP transport mode'
      );
    }

    const transport = new HttpSseTransport({
      port,
      bearerToken,
      path: process.env.MCP_PATH || '/mcp',
    });

    await transport.start();
    await server.connect(transport);

    console.log(`MCP Server running in HTTP SSE mode`);
    console.log(`Authenticate with: Authorization: Bearer ${bearerToken}`);
  } else {
    // Default: stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((error: Error) => {
  console.error('Failed to start outline-wiki-mcp:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
