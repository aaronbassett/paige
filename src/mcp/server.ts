// MCP Server — Streamable HTTP transport on /mcp
// Creates McpServer with all 14 tools, manages per-session transports

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { registerLifecycleTools } from './tools/lifecycle.js';
import { registerReadTools } from './tools/read.js';
import { registerUiTools } from './tools/ui.js';
import { registerCoachingTools } from './tools/coaching.js';

// ── Types ────────────────────────────────────────────────────────────────────

/** Handle for managing the MCP server lifecycle. */
export interface McpServerHandle {
  /** Route an HTTP request to the MCP transport. Returns true if handled. */
  handleRequest: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
  /** Close the MCP server and clean up transports. */
  close: () => Promise<void>;
}

// ── Transport tracking ───────────────────────────────────────────────────────

/** Active transports keyed by session ID. */
const transports = new Map<string, StreamableHTTPServerTransport>();

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates and configures an MCP server with all registered tools.
 * Returns a handle that routes /mcp requests to the appropriate transport.
 *
 * Paige uses stateful sessions — each initialization creates a new transport
 * and McpServer pair, tracked by the session ID returned in the response header.
 */
export function createMcpServer(_httpServer: Server): McpServerHandle {
  const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = req.url ?? '';

    // Only handle /mcp routes
    if (!url.startsWith('/mcp')) {
      return false;
    }

    // Check for existing session
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      // Existing session — delegate to its transport
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return true;
    }

    // No valid session — only POST (initialization) is allowed
    if (req.method !== 'POST') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Request: Missing or invalid session ID' }));
      return true;
    }

    // New session: create transport + server, register tools, connect
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const mcpServer = new McpServer(
      { name: 'paige', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );

    registerLifecycleTools(mcpServer);
    registerReadTools(mcpServer);
    registerUiTools(mcpServer);
    registerCoachingTools(mcpServer);

    await mcpServer.connect(transport);

    // Track the transport by session ID once assigned
    const sid = transport.sessionId;
    if (sid) {
      transports.set(sid, transport);
    }

    // Clean up on close
    transport.onclose = () => {
      const closeSid = transport.sessionId;
      if (closeSid) {
        transports.delete(closeSid);
      }
    };

    // Handle the initial request
    await transport.handleRequest(req, res);

    // The transport may have created a session ID during init — track it
    if (!sid && transport.sessionId) {
      transports.set(transport.sessionId, transport);
    }

    return true;
  };

  const close = async (): Promise<void> => {
    // Close all active transports
    const closePromises = Array.from(transports.values()).map((t) => t.close());
    await Promise.all(closePromises);
    transports.clear();
  };

  return { handleRequest, close };
}

/** Returns the list of registered MCP tool names. */
export function getRegisteredToolNames(): string[] {
  return [
    'paige_start_session',
    'paige_end_session',
    'paige_get_buffer',
    'paige_get_open_files',
    'paige_get_diff',
    'paige_get_session_state',
    'paige_open_file',
    'paige_highlight_lines',
    'paige_clear_highlights',
    'paige_hint_files',
    'paige_clear_hints',
    'paige_update_phase',
    'paige_show_message',
    'paige_show_issue_context',
    'paige_run_coaching_pipeline',
  ];
}
