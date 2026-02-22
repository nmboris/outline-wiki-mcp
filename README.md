# Outline Wiki MCP Server

[![npm version](https://img.shields.io/npm/v/outline-wiki-mcp)](https://www.npmjs.com/package/outline-wiki-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)

A [Model Context Protocol](https://modelcontextprotocol.io) server for [Outline](https://www.getoutline.com/) wiki
integration. Enables LLM applications to search, read, create, and manage wiki documents through a standardized
interface.

## Features

- **Full-text Search** - Find documents across your entire wiki
- **Document Management** - Create, read, update, delete, and move documents
- **Collection Organization** - Browse and manage document collections
- **Archive & Restore** - Soft-delete with archive/restore functionality
- **Draft Access** - Work with unpublished drafts
- **Markdown Export** - Export documents as clean markdown
- **MCP Resources** - Browse collections and documents via resource URIs
- **HTTP SSE Transport** - Access via HTTP with Server-Sent Events for Mistral.ai and other platforms
- **Multi-Tenant Support** - Each user provides their own Outline API key
- **Docker Ready** - Easy deployment with Docker and docker-compose for Coolify

## Setup

### Standard Setup (stdio)

For use with Claude Desktop or other MCP clients:

```json
{
  "mcpServers": {
    "outline": {
      "command": "npx",
      "args": ["-y", "outline-wiki-mcp"],
      "env": {
        "OUTLINE_BASE_URL": "https://your-instance.getoutline.com",
        "OUTLINE_API_KEY": "ol_api_xxx"
      }
    }
  }
}
```

### HTTP SSE Setup (for Mistral.ai and others)

For use with Mistral.ai connectors or other HTTP-based MCP clients.

**Multi-Tenant Mode:** Each Mistral.ai user provides their own Outline API key as the Bearer token.

1. **Build the project:**

```bash
bun install
bun run build
```

2. **Configure environment variables:**

Create a `.env` file:

```env
OUTLINE_BASE_URL=https://your-instance.getoutline.com
MCP_TRANSPORT=http
MCP_PORT=3000
MCP_PATH=/mcp
```

**Note:** `OUTLINE_API_KEY` is NOT needed in HTTP mode - each user provides their own API key!

3. **Start the HTTP server:**

```bash
# Bun automatically loads .env file
bun run start:http
```

4. **Configure Mistral.ai:**

Each user configures the connector in Mistral.ai with:

- **Endpoint:** `https://your-domain.com/mcp`
- **Authentication:** Bearer Token
- **Token:** Their personal Outline API key (from Outline Settings → API)

**Environment Variables (HTTP Mode):**

| Variable           | Required | Default | Description                                 |
| ------------------ | -------- | ------- | ------------------------------------------- |
| `OUTLINE_BASE_URL` | Yes      | -       | Your Outline instance URL                   |
| `MCP_TRANSPORT`    | Yes      | `stdio` | Set to `http` for HTTP mode                 |
| `MCP_PORT`         | No       | `3000`  | HTTP server port                            |
| `MCP_PATH`         | No       | `/mcp`  | HTTP endpoint path                          |
| `MCP_REQUIRE_AUTH` | No       | `false` | Enable additional MCP-level auth            |
| `MCP_BEARER_TOKEN` | No\*     | -       | MCP access token (if MCP_REQUIRE_AUTH=true) |

\*Only required when `MCP_REQUIRE_AUTH=true`

**Health Check:**

The HTTP server provides a health check endpoint at `/health` (no authentication required):

```bash
curl http://localhost:3000/health
# Response: {"status":"ok"}
```

Get your API key from Outline > **Settings** > **API** > **Create API Key**.

## Tools

### Document Operations

| Tool                         | Description                             |
| ---------------------------- | --------------------------------------- |
| `outline_search`             | Full-text search across all documents   |
| `outline_get_document`       | Retrieve document content by ID         |
| `outline_list_documents`     | List documents in a collection          |
| `outline_create_document`    | Create a new document                   |
| `outline_update_document`    | Update an existing document             |
| `outline_move_document`      | Move document to a different collection |
| `outline_delete_document`    | Permanently delete a document           |
| `outline_archive_document`   | Archive a document (soft delete)        |
| `outline_unarchive_document` | Restore an archived document            |
| `outline_list_drafts`        | List all unpublished drafts             |
| `outline_export_document`    | Export document as clean markdown       |

### Collection Operations

| Tool                        | Description                  |
| --------------------------- | ---------------------------- |
| `outline_list_collections`  | List all collections         |
| `outline_get_collection`    | Get collection details by ID |
| `outline_create_collection` | Create a new collection      |
| `outline_update_collection` | Update collection properties |
| `outline_delete_collection` | Delete a collection          |

## Resources

Browse your wiki structure using resource URIs:

| URI Pattern                  | Description                       |
| ---------------------------- | --------------------------------- |
| `outline://collections`      | List all collections              |
| `outline://collections/{id}` | Collection details with documents |
| `outline://documents/{id}`   | Document content in markdown      |

## Development

```bash
bun install         # Install dependencies
bun run build       # Compile TypeScript
bun run dev         # Watch mode
bun run test        # Run tests
bun run lint        # Type-check
```

### Local Testing

```bash
OUTLINE_BASE_URL=https://your-instance.getoutline.com \
OUTLINE_API_KEY=ol_api_xxx \
bun dist/index.js
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing guidelines, and commit
conventions.

## Deployment

- **Docker**: See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for Docker and Coolify setup
- **Mistral.ai**: See [MISTRAL_INTEGRATION.md](MISTRAL_INTEGRATION.md) for Mistral.ai integration

## License

MIT - see [LICENSE](LICENSE)

## Links

- [Outline](https://www.getoutline.com/) - Knowledge base for teams
- [Outline API](https://www.getoutline.com/developers) - API reference
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
- [MCP Servers](https://github.com/modelcontextprotocol/servers) - Reference implementations
