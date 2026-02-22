/**
 * Request Context for Multi-Tenant Support
 *
 * In HTTP mode, each request comes with a Bearer token that is the user's
 * Outline API key. This module manages the mapping between requests and
 * their associated credentials.
 */

interface RequestContext {
  outlineApiKey: string;
  outlineBaseUrl: string;
}

// Map of JSON-RPC request IDs to their context
const contextMap = new Map<string | number, RequestContext>();

// Track the last request ID for automatic context resolution
let lastRequestId: string | number | undefined;

export function setRequestContext(
  requestId: string | number,
  context: RequestContext
): void {
  contextMap.set(requestId, context);
  lastRequestId = requestId;
}

export function getRequestContext(
  requestId?: string | number
): RequestContext | undefined {
  // If no ID provided, use last request ID (for tool handlers)
  const id = requestId !== undefined ? requestId : lastRequestId;
  return id !== undefined ? contextMap.get(id) : undefined;
}

export function clearRequestContext(requestId: string | number): void {
  contextMap.delete(requestId);
  if (lastRequestId === requestId) {
    lastRequestId = undefined;
  }
}

export function hasRequestContext(requestId?: string | number): boolean {
  const id = requestId !== undefined ? requestId : lastRequestId;
  return id !== undefined && contextMap.has(id);
}
