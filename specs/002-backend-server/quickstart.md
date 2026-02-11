# Quickstart: Backend Server

**Feature**: Backend Server | **Date**: 2026-02-11

## Prerequisites

- Node.js 18+ (check: `node --version`)
- npm or pnpm (recommended: pnpm)
- ChromaDB server running at `localhost:8000` (optional, degrades gracefully)
- GitHub CLI authenticated (optional, for issue fetching): `gh auth login`

## Environment Setup

Create `.env` file in project root:

```bash
# Required
PROJECT_DIR=/absolute/path/to/project
ANTHROPIC_API_KEY=sk-ant-...

# Optional (defaults shown)
PORT=3000
DATA_DIR=~/.paige/
CHROMA_URL=http://localhost:8000
```

**Important**: `PROJECT_DIR` must be an absolute path to an existing directory.

## Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or npm
npm install
```

## Database Initialization

Database is created automatically on first run at `{DATA_DIR}/paige.db`.

To reset the database:

```bash
rm ~/.paige/paige.db
# Restart server to recreate
```

## Start ChromaDB (Optional)

```bash
# Using Docker (recommended)
docker run -p 8000:8000 chromadb/chroma

# Or Python
pip install chromadb
chroma run --host localhost --port 8000
```

**Note**: Server operates normally if ChromaDB is unavailable (memory features disabled).

## Development Mode

```bash
# Start dev server with hot reload
pnpm dev

# Or npm
npm run dev
```

Server logs:
```
[INFO] Paige Backend Server v1.0.0
[INFO] PROJECT_DIR: /Users/aaronbassett/Projects/demo-app
[INFO] DATA_DIR: /Users/aaronbassett/.paige/
[INFO] Database initialized: 10 tables created
[INFO] ChromaDB connected: localhost:8000
[INFO] Server listening on http://localhost:3000
[INFO] MCP endpoint: http://localhost:3000/mcp
[INFO] WebSocket endpoint: ws://localhost:3000/ws
[INFO] Ready to accept connections
```

## Production Mode

```bash
# Build TypeScript
pnpm build

# Run compiled server
pnpm start
```

## Available Commands

### Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot reload |
| `pnpm build` | Compile TypeScript to dist/ |
| `pnpm start` | Run production build |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Run Prettier |
| `pnpm typecheck` | Run TypeScript type checking |

### Testing

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all tests with Vitest |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:unit` | Run unit tests only |
| `pnpm test:integration` | Run integration tests only |
| `pnpm test:contract` | Run contract tests only |
| `pnpm test:coverage` | Generate coverage report |

### Maintenance

| Command | Description |
|---------|-------------|
| `pnpm clean` | Remove dist/ and node_modules/ |
| `pnpm reset-db` | Delete and recreate database |
| `pnpm logs` | Tail server logs (if using process manager) |

## Testing the Server

### 1. Health Check

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","uptime":12.5}
```

### 2. MCP Connection

```bash
# Initialize MCP session
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'

# Expected: Session ID in Mcp-Session-Id header
```

### 3. WebSocket Connection

```bash
# Using websocat (install: cargo install websocat)
websocat ws://localhost:3000/ws

# Send hello message:
{"type":"connection:hello","data":{"version":"1.0.0","platform":"darwin","windowSize":{"width":1920,"height":1080}}}

# Expected: {"type":"connection:init","data":{...}}
```

## Integration with Other Tiers

### Claude Code Plugin

Plugin connects to MCP endpoint at server startup:

```typescript
// In plugin hook
const client = new Client({
  name: 'paige-plugin',
  version: '1.0.0'
}, {
  capabilities: {}
})

const transport = new SSEClientTransport(
  new URL('http://localhost:3000/mcp')
)

await client.connect(transport)
```

### Electron UI

Electron establishes WebSocket on app launch:

```typescript
// In Electron main process
const ws = new WebSocket('ws://localhost:3000/ws')

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'connection:hello',
    data: {
      version: app.getVersion(),
      platform: process.platform,
      windowSize: mainWindow.getBounds()
    }
  }))
})

ws.on('message', (data) => {
  const message = JSON.parse(data)
  // Route to renderer process
  mainWindow.webContents.send('ws-message', message)
})
```

## Project Structure

See [plan.md](./plan.md) for complete project structure.

Key directories:
- `src/` - TypeScript source code
- `tests/` - Unit, integration, and contract tests
- `dist/` - Compiled JavaScript (gitignored)
- `specs/002-backend-server/` - This feature's design documents

## Troubleshooting

### Server won't start

**Problem**: `Error: PROJECT_DIR does not exist`
**Solution**: Set `PROJECT_DIR` to an absolute path of an existing directory.

**Problem**: `Error: Missing required environment variables`
**Solution**: Create `.env` file with `PROJECT_DIR` and `ANTHROPIC_API_KEY`.

### ChromaDB warnings

**Problem**: `[WARN] ChromaDB unavailable, memory features disabled`
**Solution**: Start ChromaDB server or ignore (non-blocking).

### MCP connection fails

**Problem**: Claude Code can't connect to MCP endpoint
**Solution**: Check server is running, verify port is correct, check firewall settings.

### WebSocket connection drops

**Problem**: Electron loses WebSocket connection
**Solution**: Server may have crashed. Check logs for errors. Restart server.

### Tests failing

**Problem**: Integration tests fail with database errors
**Solution**: Reset test database with `rm ~/.paige/test-paige.db` and rerun.

## Next Steps

1. **Run Integration Tests**: Verify all 12 user stories with `pnpm test:integration`
2. **Start ChromaDB**: Optional but recommended for memory features
3. **Connect Claude Code Plugin**: See plugin worktree for setup
4. **Connect Electron UI**: See frontend worktree for setup
5. **Demo Scenario**: Follow `docs/planning/initial-brainstorm.md` demo script

## Resources

- [Feature Specification](./spec.md) - Complete functional requirements
- [Implementation Plan](./plan.md) - Technical architecture and decisions
- [Data Model](./data-model.md) - Database schema and entities
- [Research](./research.md) - Technology decisions and best practices
- [MCP Tools Contract](./contracts/mcp-tools.json) - 12 MCP tool schemas
- [WebSocket Protocol Contract](./contracts/websocket.json) - 55 message types

## Support

- **Constitution**: `.sdd/memory/constitution.md` - Project principles
- **Initial Brainstorm**: `docs/planning/initial-brainstorm.md` - Full architecture vision
- **Backend Discovery**: `docs/planning/backend-discovery/SPEC.md` - Original comprehensive spec (3647 lines)
