// Paige Backend Server - Entry point
// HTTP server with health endpoint, MCP transport, and WebSocket support

import http, { type Server } from 'node:http';
import { join, basename } from 'node:path';
import { loadEnv } from './config/env.js';
import { createDatabase, closeDatabase } from './database/db.js';
import { createFileWatcher, type FileChangeEvent } from './file-system/watcher.js';
import { setupLogging, getLogger } from './logger/logtape.js';
import { initializeMemory, closeMemory } from './memory/chromadb.js';
import { createMcpServer } from './mcp/server.js';
import { createWebSocketServer, broadcast } from './websocket/server.js';

const logger = getLogger(['paige', 'server']);

export const VERSION = '1.0.0';

/** Prints the Paige ASCII art banner and version info to stdout. */
function printBanner(): void {
  const banner = `
  ____   _    ___ ____ _____
 |  _ \\ / \\  |_ _/ ___| ____|
 | |_) / _ \\  | | |  _|  _|
 |  __/ ___ \\ | | |_| | |___
 |_| /_/   \\_\\___|\\____|_____|

 v${VERSION} — Claude Codes, Paige Pairs.
`;
  // eslint-disable-next-line no-console
  console.log(banner);
}

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
  // Initialize structured logging before anything else
  await setupLogging();

  const env = loadEnv();
  const startTime = Date.now();

  // Print ASCII banner before any startup work
  printBanner();

  // Initialize SQLite database (creates tables on first run)
  const dbPath = join(env.dataDir, 'paige.db');
  await createDatabase(dbPath);

  // Initialize ChromaDB (lazy — server starts even if ChromaDB is down)
  await initializeMemory(env.chromadbUrl);

  // Create MCP server (tool registration happens lazily per session)
  const mcpHandle = createMcpServer(null as unknown as Server);

  const server = http.createServer((req, res) => {
    // Add CORS headers for MCP Inspector and other browser-based tools
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    };

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      const uptimeMs = Date.now() - startTime;
      const uptimeSeconds = uptimeMs / 1000;
      const body = JSON.stringify({ status: 'ok', uptime: uptimeSeconds });

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(body);
      return;
    }

    // Route /mcp requests to MCP Streamable HTTP transport
    if (req.url?.startsWith('/mcp')) {
      // Add CORS headers before delegating to MCP handler
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      mcpHandle.handleRequest(req, res).catch((err: unknown) => {
        logger.error`MCP request error: ${err}`;
        if (!res.headersSent) {
          res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
      return;
    }

    // All other routes/methods: 404
    const body = JSON.stringify({ error: 'Not Found' });
    res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(body);
  });

  // Attach WebSocket server to handle /ws upgrade requests
  const wsHandle = createWebSocketServer(server);

  // Start file watcher for PROJECT_DIR and wire to WebSocket broadcasts
  // Maps chokidar events (add/change/unlink) to frontend actions (add/remove)
  const fileWatcher = createFileWatcher(env.projectDir);
  fileWatcher.on('change', (event: FileChangeEvent) => {
    // Skip 'change' events — they don't affect tree structure
    if (event.type === 'change') return;

    // Map chokidar 'unlink' to frontend 'remove'
    const action = event.type === 'unlink' ? 'remove' : event.type;

    // Include node data for 'add' so the tree can insert it
    const node =
      action === 'add'
        ? { name: basename(event.path), path: event.path, type: 'file' as const }
        : undefined;

    broadcast({
      type: 'fs:tree_update',
      data: { action, path: event.path, ...(node ? { node } : {}) },
    });
  });

  // Start watcher in background — don't block server startup
  fileWatcher.start().then(
    () => {
      logger.info`File watcher started`;
    },
    (err: unknown) => {
      logger.error`File watcher failed to start: ${err}`;
    },
  );

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, env.host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const listeningPort =
    address !== null && typeof address !== 'string' ? address.port : config.port;

  logger.info`Paige backend ready — host=${env.host} port=${String(listeningPort)} project=${env.projectDir}`;
  logger.info`MCP: http://${env.host}:${String(listeningPort)}/mcp`;
  logger.info`WebSocket: ws://${env.host}:${String(listeningPort)}/ws`;

  const close = async (): Promise<void> => {
    logger.info`Closing file watcher...`;
    await fileWatcher.close();

    logger.info`Closing MCP server...`;
    await mcpHandle.close();

    logger.info`Closing WebSocket server...`;
    wsHandle.close();

    logger.info`Closing HTTP server...`;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    logger.info`Closing ChromaDB...`;
    await closeMemory();

    logger.info`Closing database...`;
    await closeDatabase();

    logger.info`Shutdown complete`;
  };

  return { server, close };
}

// Main execution block - start server when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3001;
  let serverHandle: ServerHandle | null = null;

  createServer({ port })
    .then((handle) => {
      serverHandle = handle;
      logger.info`Press Ctrl+C to stop`;
    })
    .catch((err: unknown) => {
      logger.fatal`Failed to start: ${err}`;
      process.exit(1);
    });

  // Graceful shutdown on SIGINT/SIGTERM
  const shutdown = async (signal: string): Promise<void> => {
    logger.info`Received ${signal}, shutting down gracefully...`;
    if (serverHandle) {
      await serverHandle.close();
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
