# Research Log: backend-server

*Chronological record of all research conducted during discovery.*

---

[Research entries will be added as research is conducted]

## R1: MCP TypeScript SDK Hono integration — 2026-02-10

**Purpose**: Understand how to set up MCP server with Hono and Streamable HTTP transport

**Approach**: Read SDK source, README, and examples from modelcontextprotocol/typescript-sdk

**Findings**:
Packages: @modelcontextprotocol/server + @modelcontextprotocol/hono + hono + @hono/node-server. createMcpHonoApp() creates Hono app with JSON parsing and DNS rebinding protection, no routes. Mount MCP on app.all('/mcp', handler). Transport: WebStandardStreamableHTTPServerTransport. Routes: POST (requests), GET (notifications), DELETE (session end). Tool registration uses Zod schemas. WebSocket can coexist on same app via different path.

**Industry Patterns**:
[Patterns not provided]

**Relevant Examples**:
[Examples not provided]

**Implications**:
Brainstorm references to SSE transport are outdated. Use Streamable HTTP. Hono app can host both MCP and WebSocket on same server.

**Stories Informed**: Story 1, Story 6

**Related Questions**: [Questions not specified]

---

## R2: Hono WebSocket for Node.js (@hono/node-ws) — 2026-02-10

**Purpose**: Determine if hono/ws can handle typed JSON messages, connection tracking, and coexist with MCP

**Approach**: Read @hono/node-ws source and README from honojs/middleware repo

**Findings**:
Uses ws (WebSocketServer) under the hood with noServer mode. WSContext provides raw WebSocket access. onOpen/onMessage/onClose/onError lifecycle events. Can send strings (JSON.stringify for typed messages). Connection tracking via onOpen + stored references. Mount on specific path (app.get /ws, upgradeWebSocket(...)). wss property gives access to underlying WebSocketServer. Fully coexists with MCP routes on different paths.

**Industry Patterns**:
Pattern: createNodeWebSocket({app}) returns {injectWebSocket, upgradeWebSocket, wss}. Mount WS route with upgradeWebSocket middleware. After serve(app), call injectWebSocket(server) to hook up upgrade handling.

**Relevant Examples**:
[Examples not provided]

**Implications**:
hono/ws + @hono/node-ws fully meets our requirements. No need for raw ws setup. Additional packages: @hono/node-ws, @hono/node-server.

**Stories Informed**: Story 1, Story 5

**Related Questions**: [Questions not specified]

---
