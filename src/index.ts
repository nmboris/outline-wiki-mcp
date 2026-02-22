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
  // Determine transport mode from environment
  const transportMode = process.env.MCP_TRANSPORT || 'stdio';

  let config: any;
  let client: OutlineClient;

  if (transportMode === 'http' || transportMode === 'sse') {
    // HTTP SSE transport mode - Multi-tenant support
    // Each request provides its own Outline API key via Bearer token

    const outlineBaseUrl = process.env.OUTLINE_BASE_URL;
    if (!outlineBaseUrl) {
      throw new Error('OUTLINE_BASE_URL environment variable is required');
    }

    // Create a dummy client for registration (will be replaced per-request)
    client = new OutlineClient({
      baseUrl: outlineBaseUrl,
      apiKey: 'placeholder', // Will be replaced by request-specific token
    });
  } else {
    // stdio mode - Single tenant with static API key
    const configPath = getConfigPath();
    config = loadConfig(configPath);
    client = new OutlineClient(config);
  }

  // Create MCP server
  const server = new McpServer({
    name: packageJson.name,
    version: packageJson.version,
  });

  // Register tools and resources
  registerTools(server, client);
  registerResources(server, client);

  if (transportMode === 'http' || transportMode === 'sse') {
    // HTTP SSE transport mode
    const port = parseInt(process.env.MCP_PORT || '3000', 10);
    const requireAuth = process.env.MCP_REQUIRE_AUTH === 'true';
    const bearerToken = process.env.MCP_BEARER_TOKEN;

    if (requireAuth && !bearerToken) {
      throw new Error(
        'MCP_BEARER_TOKEN environment variable is required when MCP_REQUIRE_AUTH=true'
      );
    }

    const transport = new HttpSseTransport({
      port,
      outlineBaseUrl: process.env.OUTLINE_BASE_URL!,
      requireAuth,
      bearerToken,
      path: process.env.MCP_PATH || '/mcp',
    });

    await transport.start();
    await server.connect(transport);

    console.log(`MCP Server running in HTTP SSE mode (Multi-Tenant)`);
    console.log(`Each request's Bearer token is the user's Outline API key`);
    if (requireAuth) {
      console.log(`Additional MCP authentication enabled`);
    }
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
