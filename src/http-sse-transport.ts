import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
} from '@modelcontextprotocol/sdk/types.js';
import { setRequestContext } from './request-context.js';

export interface HttpSseTransportOptions {
  port: number;
  outlineBaseUrl: string;
  requireAuth?: boolean; // Optional: require MCP_BEARER_TOKEN for additional security
  bearerToken?: string; // Optional: static auth token for MCP access control
  path?: string;
}

/**
 * HTTP SSE Transport for MCP Server
 * Implements Server-Sent Events for MCP communication over HTTP
 * with Bearer token authentication
 */
export class HttpSseTransport implements Transport {
  private app: express.Application;
  private server: any;
  private clients: Map<string, Response> = new Map();
  private pendingRequests: Map<
    string | number,
    (response: JSONRPCResponse) => void
  > = new Map();
  private options: HttpSseTransportOptions;
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;

  constructor(options: HttpSseTransportOptions) {
    this.options = {
      ...options,
      path: options.path || '/mcp',
    };
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Enable CORS
    this.app.use(cors());

    // Parse JSON bodies
    this.app.use(express.json());

    // Bearer token authentication middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Skip auth for health check
      if (req.path === '/health') {
        return next();
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res
          .status(401)
          .json({ error: 'Missing or invalid authorization header' });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Optional: Check against static MCP auth token for additional security
      if (this.options.requireAuth && this.options.bearerToken) {
        if (token !== this.options.bearerToken) {
          res.status(403).json({ error: 'Invalid MCP token' });
          return;
        }
      }

      // Store the bearer token in request for later use
      // In multi-tenant mode, this token is the user's Outline API key
      (req as any).outlineApiKey = token;

      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    // SSE endpoint for receiving messages from server
    this.app.get(this.options.path!, (req: Request, res: Response) => {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Generate client ID
      const clientId = `client-${Date.now()}-${Math.random()}`;
      this.clients.set(clientId, res);

      console.log(`SSE client connected: ${clientId}`);

      // Send initial connection message
      this.sendSSE(res, {
        type: 'connection',
        clientId,
      });

      // Handle client disconnect
      req.on('close', () => {
        console.log(`SSE client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        if (this.clients.size === 0 && this.onclose) {
          this.onclose();
        }
      });
    });

    // POST endpoint for receiving messages from client
    this.app.post(this.options.path!, async (req: Request, res: Response) => {
      try {
        const message = req.body as JSONRPCMessage;

        if (!message || !message.jsonrpc) {
          res.status(400).json({ error: 'Invalid JSON-RPC message' });
          return;
        }

        // Extract Outline API key from request (stored by auth middleware)
        const outlineApiKey = (req as any).outlineApiKey;

        // Store request context for multi-tenant support
        // The Bearer token from Mistral.ai is the user's Outline API key
        if (
          'id' in message &&
          message.id !== null &&
          message.id !== undefined
        ) {
          const requestId = message.id; // Type narrowing
          setRequestContext(requestId, {
            outlineApiKey,
            outlineBaseUrl: this.options.outlineBaseUrl,
          });

          // Setup promise to wait for response
          const responsePromise = new Promise<JSONRPCResponse>(resolve => {
            this.pendingRequests.set(requestId, resolve);
          });

          // Handle message through onmessage callback
          if (this.onmessage) {
            this.onmessage(message);
          }

          // Wait for response with timeout
          const timeout = setTimeout(() => {
            this.pendingRequests.delete(requestId);
            res.status(504).json({
              jsonrpc: '2.0',
              id: requestId,
              error: { code: -32000, message: 'Request timeout' },
            });
          }, 30000); // 30 second timeout

          try {
            const response = await responsePromise;
            clearTimeout(timeout);
            res.status(200).json(response);
          } catch (error) {
            clearTimeout(timeout);
            throw error;
          }
        } else {
          // Notification (no response expected)
          if (this.onmessage) {
            this.onmessage(message);
          }
          res.status(202).json({ received: true });
        }
      } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  private sendSSE(res: Response, data: any): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.options.port, () => {
          console.log(
            `MCP Server listening on http://localhost:${this.options.port}${this.options.path}`
          );
          console.log(
            `Health check available at http://localhost:${this.options.port}/health`
          );
          resolve();
        });

        this.server.on('error', (error: Error) => {
          if (this.onerror) {
            this.onerror(error);
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send a JSON-RPC message
   * In synchronous mode: resolves pending request promises
   * In SSE mode: sends to all connected clients
   */
  async send(message: JSONRPCMessage): Promise<void> {
    // If this is a response to a pending request, resolve it
    if ('id' in message && message.id !== null && message.id !== undefined) {
      const messageId = message.id; // Type narrowing
      if (this.pendingRequests.has(messageId)) {
        const resolve = this.pendingRequests.get(messageId)!;
        this.pendingRequests.delete(messageId);
        resolve(message as JSONRPCResponse);
        return;
      }
    }

    // Otherwise, send via SSE to all connected clients
    const messageStr = JSON.stringify(message);
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.write(`data: ${messageStr}\n\n`);
      } catch (error) {
        console.error(`Error sending to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Close the transport and stop the server
   */
  async close(): Promise<void> {
    return new Promise(resolve => {
      // Close all SSE connections
      for (const [clientId, client] of this.clients.entries()) {
        try {
          client.end();
        } catch (error) {
          console.error(`Error closing client ${clientId}:`, error);
        }
      }
      this.clients.clear();

      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          console.log('MCP Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
