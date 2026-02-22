import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
} from '@modelcontextprotocol/sdk/types.js';

export interface HttpSseTransportOptions {
  port: number;
  bearerToken: string;
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
  private pendingRequests: Map<string, (response: JSONRPCResponse) => void> =
    new Map();
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
      if (token !== this.options.bearerToken) {
        res.status(403).json({ error: 'Invalid token' });
        return;
      }

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
    this.app.post(this.options.path!, (req: Request, res: Response) => {
      try {
        const message = req.body as JSONRPCMessage;

        if (!message || !message.jsonrpc) {
          res.status(400).json({ error: 'Invalid JSON-RPC message' });
          return;
        }

        // Handle message through onmessage callback
        if (this.onmessage) {
          this.onmessage(message);
        }

        res.status(202).json({ received: true });
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
   * Send a JSON-RPC message to all connected clients
   */
  async send(message: JSONRPCMessage): Promise<void> {
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
