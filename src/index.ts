// Paige Backend Server - Entry point
// HTTP server with health endpoint, MCP transport, and WebSocket support

import http, { type Server } from 'node:http';
import { join } from 'node:path';
import { loadEnv } from './config/env.js';
import { createDatabase, closeDatabase } from './database/db.js';
import { createFileWatcher, type FileChangeEvent } from './file-system/watcher.js';
import { createMcpServer } from './mcp/server.js';
import { createWebSocketServer, broadcast } from './websocket/server.js';
import type { FsTreeAction } from './types/websocket.js';

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
 * - Validates environment configuration via loadEnv()
 * - Creates an HTTP server with health endpoint
 * - Listens on the configured port
 * - Returns a handle with the server and a graceful close function
 *
 * @param config - Server configuration (port, etc.)
 * @returns A promise resolving to a handle with the server and a close function.
 */
export async function createServer(config: ServerConfig): Promise<ServerHandle> {
  const env = loadEnv();
  const startTime = Date.now();

  // Initialize SQLite database (creates tables on first run)
  const dbPath = join(env.dataDir, 'paige.db');
  await createDatabase(dbPath);

  // eslint-disable-next-line no-console
  console.log(`[server] Database initialized at ${dbPath}`);

  // Create MCP server (tool registration happens lazily per session)
  const mcpHandle = createMcpServer(null as unknown as Server);

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      const uptimeMs = Date.now() - startTime;
      const uptimeSeconds = uptimeMs / 1000;
      const body = JSON.stringify({ status: 'ok', uptime: uptimeSeconds });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
      return;
    }

    // Route /mcp requests to MCP Streamable HTTP transport
    if (req.url?.startsWith('/mcp')) {
      mcpHandle.handleRequest(req, res).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[server] MCP request error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
      return;
    }

    // All other routes/methods: 404
    const body = JSON.stringify({ error: 'Not Found' });
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(body);
  });

  // Attach WebSocket server to handle /ws upgrade requests
  const wsHandle = createWebSocketServer(server);

  // Start file watcher for PROJECT_DIR and wire to WebSocket broadcasts
  const fileWatcher = createFileWatcher(env.projectDir);
  fileWatcher.on('change', (event: FileChangeEvent) => {
    broadcast({
      type: 'fs:tree_update',
      data: {
        action: event.type as FsTreeAction,
        path: event.path,
      },
    });
  });

  // Start watcher in background — don't block server startup
  fileWatcher.start().then(
    () => {
      // eslint-disable-next-line no-console
      console.log('[server] File watcher started');
    },
    (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[server] File watcher failed to start:', err);
    },
  );

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const listeningPort =
    address !== null && typeof address !== 'string' ? address.port : config.port;

  // eslint-disable-next-line no-console
  console.log(`[server] Listening on port ${String(listeningPort)}`);
  // eslint-disable-next-line no-console
  console.log(`[server] Project directory: ${env.projectDir}`);
  // eslint-disable-next-line no-console
  console.log('[server] Paige backend ready');

  const close = async (): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log('[server] Closing file watcher...');
    await fileWatcher.close();

    // eslint-disable-next-line no-console
    console.log('[server] Closing MCP server...');
    await mcpHandle.close();

    // eslint-disable-next-line no-console
    console.log('[server] Closing WebSocket server...');
    wsHandle.close();

    // eslint-disable-next-line no-console
    console.log('[server] Closing HTTP server...');
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // eslint-disable-next-line no-console
    console.log('[server] Closing database...');
    await closeDatabase();

    // eslint-disable-next-line no-console
    console.log('[server] Shutdown complete');
  };

  return { server, close };
}
