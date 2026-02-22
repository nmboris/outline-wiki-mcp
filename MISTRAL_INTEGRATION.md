# Mistral.ai Integration Guide

This guide explains how to use the Outline Wiki MCP Server as a connector in Mistral.ai.

## Overview

The HTTP SSE transport mode allows this MCP server to be used with Mistral.ai's connector system, enabling their AI
agents to search and interact with your Outline wiki.

## Setup Steps

### 1. Deploy the MCP Server

You can deploy the server anywhere that Mistral.ai can reach via HTTP. Options include:

- Local machine (for testing)
- Docker container
- Cloud hosting (AWS, Google Cloud, Azure, etc.)
- Platform-as-a-Service (Railway, Render, Fly.io, etc.)

### 2. Configure Environment Variables

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` - only the base URL is needed:

```env
OUTLINE_BASE_URL=https://your-instance.getoutline.com
MCP_TRANSPORT=http
MCP_PORT=3000
MCP_PATH=/mcp
```

**Important:** Do NOT set `OUTLINE_API_KEY` in the .env file for HTTP mode. Each user will provide their own API key via
the Bearer token.

### 3. Build and Start the Server

```bash
bun install
bun run build
bun run start:http
```

Bun automatically loads your `.env` file - no extra configuration needed!

### 4. Configure Mistral.ai Connector

**Each user** configures the connector in their Mistral.ai account:

1. Navigate to **Connectors** or **Settings** in Mistral.ai
2. Click **Add New Connector**
3. Select **MCP (Model Context Protocol)** as the connector type
4. Configure the connection:
   - **Name:** Outline Wiki
   - **Endpoint URL:** `https://your-domain.com/mcp` (your deployed server)
   - **Authentication Type:** Bearer Token
   - **Token:** Your personal Outline API key

5. Get your Outline API key:
   - Go to your Outline workspace
   - Navigate to **Settings** → **API**
   - Click **Create API Key**
   - Copy the key (starts with `ol_api_`)

6. Save and test the connection

### 5. Test the Integration

Once configured, Mistral.ai agents can use natural language to:

- Search your wiki: "Find documents about project planning"
- Read documents: "Show me the document about API guidelines"
- Create content: "Create a new document in the Engineering collection"
- Manage documents: "Archive the old meeting notes"
- Browse collections: "List all collections in the wiki"

## Available Tools

The following MCP tools are available to Mistral.ai agents:

### Document Operations

- `outline_search` - Full-text search
- `outline_get_document` - Read document by ID
- `outline_list_documents` - List documents in collection
- `outline_create_document` - Create new document
- `outline_update_document` - Update existing document
- `outline_move_document` - Move to different collection
- `outline_delete_document` - Permanently delete
- `outline_archive_document` - Soft delete/archive
- `outline_unarchive_document` - Restore archived document
- `outline_list_drafts` - List unpublished drafts
- `outline_export_document` - Export as markdown

### Collection Operations

- `outline_list_collections` - List all collections
- `outline_get_collection` - Get collection details
- `outline_create_collection` - Create new collection
- `outline_update_collection` - Update collection
- `outline_delete_collection` - Delete collection

## Production Deployment

### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

ENV MCP_TRANSPORT=http
ENV MCP_PORT=3000

EXPOSE 3000

CMD ["bun", "run", "start:http"]
```

Build and run:

```bash
docker build -t outline-mcp .
docker run -p 3000:3000 \
  -e OUTLINE_BASE_URL="https://your-instance.getoutline.com" \
  -e OUTLINE_API_KEY="ol_api_xxx" \
  -e MCP_BEARER_TOKEN="your-token" \
  outline-mcp
```

### Using Environment Variables File

Create `.env` file (never commit this!):

```env
OUTLINE_BASE_URL=https://your-instance.getoutline.com
MCP_TRANSPORT=http
MCP_PORT=3000
```

**Note:** No OUTLINE_API_KEY or MCP_BEARER_TOKEN needed here - users provide their tokens!

### Reverse Proxy / HTTPS

For production, use a reverse proxy (nginx, Caddy, Traefik) to:

- Add HTTPS/TLS encryption
- Handle SSL certificates
- Add rate limiting
- Provide additional security layers

Example nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /mcp {
        proxy_pass http://localhost:3000/mcp;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE specific settings
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

## Monitoring

Check server health:

```bash
curl https://your-domain.com/health
# Expected: {"status":"ok"}
```

Monitor server logs for connection and error information.

## Security Best Practices

1. **Always use HTTPS** in production (never HTTP)
2. **Generate strong Bearer tokens** (32+ random characters)
3. **Rotate tokens regularly** (e.g., every 90 days)
4. **Limit network access** (firewall, security groups)
5. **Monitor access logs** for suspicious activity
6. **Keep dependencies updated** (`bun update`)
7. **Use environment variables** (never hardcode secrets)

## Troubleshooting

### Connection Refused

- Verify server is running: `curl http://localhost:3000/health`
- Check firewall rules
- Verify correct port in configuration

### Authentication Failed

- Verify Bearer token matches on both server and Mistral.ai
- Check for extra spaces or newlines in token
- Ensure `Authorization: Bearer <token>` header format

### Empty Responses

- Verify Outline credentials are correct
- Check Outline API is accessible from server
- Review server logs for API errors

## Support

For issues or questions:

- Check the main [README](../README.md)
- Review [Outline API documentation](https://www.getoutline.com/developers)
- Check [MCP specification](https://modelcontextprotocol.io)
