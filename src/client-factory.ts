import { OutlineClient } from './outline-client.js';
import { getRequestContext, clearRequestContext } from './request-context.js';
import type { OutlineConfig } from './types.js';

/**
 * Get or create an OutlineClient for the current request
 *
 * In HTTP multi-tenant mode: Creates a new client using the request context
 * (Bearer token = user's Outline API key)
 *
 * In stdio mode: Uses the provided default client
 */
export function getClientForRequest(
  defaultClient: OutlineClient
): OutlineClient {
  // Try to get request context (HTTP multi-tenant mode)
  // Uses last request ID automatically
  const context = getRequestContext();

  if (context) {
    // Create a new client with the user's API key from the Bearer token
    const clientConfig: OutlineConfig = {
      baseUrl: context.outlineBaseUrl,
      apiKey: context.outlineApiKey,
    };
    return new OutlineClient(clientConfig);
  }

  // Fallback to default client (stdio mode or no context)
  return defaultClient;
}
