// Paige Backend Server - Entry point
// Implementation will be added in Phase 3 (US1: Server Foundation & Lifecycle)

import type { Server } from 'node:http';

export const VERSION = '1.0.0';

/** Configuration for the Paige backend server. */
export interface ServerConfig {
  /** TCP port to listen on. Use 0 for OS-assigned port. */
  port: number;
}

/** Handle returned by createServer for lifecycle management. */
export interface ServerHandle {
  /** The underlying Node.js HTTP server instance. */
  server: Server;
  /** Gracefully shuts down the server, closing all connections. */
  close: () => Promise<void>;
}

/**
 * Creates and starts the Paige backend HTTP server.
 *
 * @param config - Server configuration (port, etc.)
 * @returns A promise resolving to a handle with the server and a close function.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- stub; implementation will use await
export async function createServer(_config: ServerConfig): Promise<ServerHandle> {
  // TODO: Implement in Phase 3 (T062-T067)
  throw new Error('createServer is not yet implemented');
}
