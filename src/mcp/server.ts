// MCP Server — Streamable HTTP transport on /mcp
// TDD stub — will be implemented in Phase 8

import type { Server } from 'node:http';

/** Handle for managing the MCP server lifecycle. */
export interface McpServerHandle {
  /** Close the MCP server and clean up transports. */
  close: () => Promise<void>;
}

/**
 * Creates and attaches the MCP server to the HTTP server.
 * Handles /mcp routes for Streamable HTTP transport.
 */
export function createMcpServer(_httpServer: Server): McpServerHandle {
  return {
    close: () => Promise.resolve(),
  };
}

/** Returns the list of registered MCP tool names. */
export function getRegisteredToolNames(): string[] {
  return [];
}
