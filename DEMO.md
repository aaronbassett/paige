# Paige E2E Demo Setup

This guide shows you how to run the complete Paige demo with a single command using Overmind.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Paige Architecture                        │
└─────────────────────────────────────────────────────────────┘

Claude Code Plugin ←─── MCP (SSE) ───→ Backend Server ←─── WebSocket ───→ Electron UI
   (Personality)                          (Brain)                            (Face)

                                             │
                                             ├─► SQLite (State)
                                             ├─► ChromaDB (Memory) [Optional]
                                             ├─► File Watcher
                                             └─► Anthropic API
```

## Prerequisites

### Required Tools

- **Node.js 20.x LTS** - [Download](https://nodejs.org/)
- **pnpm** - Install: `npm install -g pnpm`
- **Overmind** - Process manager
  - macOS: `brew install overmind`
  - Linux: [Installation Guide](https://github.com/DarthSim/overmind#installation)

### Optional Tools

- **ChromaDB** - Semantic memory (optional, graceful degradation)
  - **Option 1 - Native**: `pip install chromadb` (no Docker needed)
  - **Option 2 - Docker**: [Docker Desktop](https://www.docker.com/products/docker-desktop) for containerized ChromaDB
- **GitHub CLI** - For Dashboard issue recommendations (optional)
  - Install: `brew install gh` or [see here](https://cli.github.com/)
  - Authenticate: `gh auth login`

### API Keys

- **Anthropic API Key** (required for AI features)
  - Get from: [console.anthropic.com](https://console.anthropic.com/)
  - Format: `sk-ant-...`

## Quick Start

### 1. Run Setup Script

```bash
cd /Users/aaronbassett/Projects/paige
./scripts/setup-demo.sh
```

The setup script will:
- ✓ Check for required tools (pnpm, node, overmind)
- ✓ Check for optional tools (docker, gh)
- ✓ Install all dependencies (backend + Electron UI)
- ✓ Create `.env` file from template
- ✓ Update `.overmind.env` with your project path
- ✓ Run type checks
- ✓ Validate configuration

**Important**: The script will prompt you to add your `ANTHROPIC_API_KEY` to the `.env` file. Get your key from [console.anthropic.com](https://console.anthropic.com/).

### 2. Start All Services

**Full demo with ChromaDB** (via Docker):
```bash
overmind start
```

**Full demo with ChromaDB** (native, no Docker):
```bash
pip install chromadb  # One-time setup
overmind start -f Procfile.native
```

**Minimal demo** (without ChromaDB):
```bash
overmind start -f Procfile.minimal
```

That's it! The following services will start:
1. **Backend Server** (`localhost:3001`)
2. **ChromaDB** (`localhost:8000`) - if using full demo
3. **Vite Dev Server** (`localhost:5173`)
4. **Electron App** - launches automatically after 3 seconds

## Service Endpoints

| Service | Endpoint | Purpose |
|---------|----------|---------|
| Backend (HTTP) | `http://localhost:3001` | Health check |
| Backend (MCP) | `http://localhost:3001/mcp` | Claude Code Plugin SSE transport |
| Backend (WebSocket) | `ws://localhost:3001/ws` | Electron UI communication |
| Vite Dev Server | `http://localhost:5173` | Renderer hot module replacement |
| ChromaDB | `http://localhost:8000` | Semantic memory (optional) |

## Overmind Commands

### Starting Services

```bash
# Start all services (full demo)
overmind start

# Start minimal services (no ChromaDB)
overmind start -f Procfile.minimal

# Start in foreground (see logs inline)
overmind start -N

# Start specific processes only
overmind start -l backend,vite,electron
```

### Viewing Logs

```bash
# Connect to Overmind console (view all logs)
overmind connect

# Connect to specific process
overmind connect backend
overmind connect electron

# Exit log viewer: Ctrl+B, then D
```

### Managing Services

```bash
# Restart a service
overmind restart backend

# Stop a specific service
overmind stop chromadb

# Stop all services
overmind quit

# Check running processes
overmind status
```

## Process Details

### Backend Server (`backend`)

**Command**: `pnpm dev`
**Entry Point**: `src/index.ts`
**Port**: `3001` (configurable via `PORT` env var)

**Features**:
- MCP Streamable HTTP transport at `/mcp`
- WebSocket server at `/ws`
- Health check endpoint at `/health`
- SQLite database (auto-created at `~/.paige/paige.db`)
- File watcher for `PROJECT_DIR`
- ChromaDB connection with graceful degradation

**Logs**:
```
  ____   _    ___ ____ _____
 |  _ \ / \  |_ _/ ___| ____|
 | |_) / _ \  | | |  _|  _|
 |  __/ ___ \ | | |_| | |___
 |_| /_/   \_\___|\____|_____|

 v1.0.0 — Claude Codes, Paige Pairs.

[server] Paige backend ready
  Host:      127.0.0.1
  Port:      3001
  Project:   /Users/aaronbassett/Projects/paige
  MCP:       http://127.0.0.1:3001/mcp
  WebSocket: ws://127.0.0.1:3001/ws
[server] File watcher started
```

**Environment Variables**:
- `PROJECT_DIR` - Project being coached (default: current directory)
- `ANTHROPIC_API_KEY` - Claude API key (required for AI)
- `HOST` - Bind address (default: `127.0.0.1`)
- `PORT` - Server port (default: `3001`)
- `DATA_DIR` - SQLite location (default: `~/.paige/`)
- `CHROMADB_URL` - ChromaDB endpoint (default: `http://localhost:8000`)

### ChromaDB (`chromadb`)

**Port**: `8000`
**Status**: Optional (backend degrades gracefully)

**Purpose**: Stores semantic memories for cross-session learning.

**Two Ways to Run**:

**Option 1 - Docker** (`Procfile`):
```bash
docker run --rm -p 8000:8000 chromadb/chroma
```

**Option 2 - Native** (`Procfile.native`):
```bash
pip install chromadb  # One-time
chroma run --host localhost --port 8000
```

**Note**: If ChromaDB is unavailable, the backend logs:
```
[memory] ChromaDB unavailable at http://localhost:8000 — memory features disabled
```

Server continues operating normally with memory features disabled.

### Vite Dev Server (`vite`)

**Command**: `npm run dev` (in `electron-ui/`)
**Port**: `5173`
**Purpose**: Hot module replacement for Electron renderer process

**Features**:
- React with Fast Refresh
- TypeScript compilation
- Monaco Editor bundling
- xterm.js and dependencies

**Logs**:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Electron App (`electron`)

**Command**: `npm run dev:electron` (in `electron-ui/`)
**Delay**: 3 second wait for Vite to start
**Entry Point**: `electron-ui/src/main.ts`

**Features**:
- Loads renderer from `http://localhost:5173` (Vite dev server)
- Hot reload for renderer changes (Cmd+R)
- Manual restart needed for main process changes
- PTY terminal support via `node-pty`
- WebSocket connection to backend at `ws://localhost:3001`

**Window**: 1280×800, macOS-style titlebar integration

## Development Workflow

### Making Changes

**Renderer Changes** (React components, styles):
1. Edit files in `electron-ui/renderer/src/`
2. Changes hot-reload automatically in Electron window
3. No restart needed

**Main Process Changes** (Electron backend, IPC):
1. Edit files in `electron-ui/src/`
2. Stop Electron: `overmind stop electron`
3. Restart: `overmind restart electron`

**Backend Changes** (Node.js server):
1. Edit files in `src/`
2. `tsx watch` auto-reloads on file changes
3. No manual restart needed

### Running Tests

**Backend**:
```bash
cd /Users/aaronbassett/Projects/paige
pnpm test           # All tests
pnpm test:unit      # Unit tests only
pnpm test:watch     # Watch mode
```

**Electron UI**:
```bash
cd /Users/aaronbassett/Projects/paige/electron-ui
npm test            # All tests
npm run test:unit   # Unit tests
npm run test:e2e    # Playwright E2E
npm run test:watch  # Watch mode
```

### Type Checking

```bash
# Backend
cd /Users/aaronbassett/Projects/paige
pnpm typecheck

# Electron UI
cd /Users/aaronbassett/Projects/paige/electron-ui
npm run typecheck
```

### Linting & Formatting

```bash
# Backend
pnpm lint
pnpm format

# Electron UI
cd electron-ui
npm run lint
npm run format
```

## Troubleshooting

### "Overmind not found"

**macOS**:
```bash
brew install overmind
```

**Linux**:
See [installation guide](https://github.com/DarthSim/overmind#installation)

### "Port 3001 already in use"

Stop existing backend server:
```bash
lsof -ti:3001 | xargs kill -9
```

Or change port in `.env`:
```bash
PORT=3002
```

### "ChromaDB unavailable"

**If Docker is not running**:
```bash
# Start Docker Desktop (macOS/Windows)
# Or start Docker daemon (Linux)
sudo systemctl start docker
```

**If ChromaDB image not pulled**:
```bash
docker pull chromadb/chroma
```

**If you don't need semantic memory**:
Use minimal Procfile:
```bash
overmind start -f Procfile.minimal
```

### "Electron app won't start"

**Check Vite is running**:
```bash
curl http://localhost:5173
```

**Increase startup delay** in `Procfile`:
```
electron: sleep 5 && cd $PROJECT_ROOT/electron-ui && npm run dev:electron
```

**Check logs**:
```bash
overmind connect electron
```

### "Backend won't start - ANTHROPIC_API_KEY error"

Edit `.env` and add your API key:
```bash
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

Get your key from: [console.anthropic.com](https://console.anthropic.com/)

### "WebSocket connection failed"

**Check backend is running**:
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","uptime":12.5}
```

**Check WebSocket endpoint**:
```bash
wscat -c ws://localhost:3001/ws
# Should connect and stay open
```

**Check Electron UI WebSocket URL** (should be `ws://localhost:3001`):
```bash
grep "ws://localhost" electron-ui/renderer/src/services/websocket-client.ts
```

## Advanced Configuration

### Custom Ports

Edit `.overmind.env`:
```bash
# Backend port
PORT=3002

# ChromaDB port (also update CHROMADB_URL)
CHROMADB_URL=http://localhost:8001
```

Update `Procfile` for ChromaDB:
```
chromadb: docker run --rm -p 8001:8000 chromadb/chroma
```

### Custom Project Directory

Edit `.overmind.env`:
```bash
PROJECT_DIR=/path/to/your/project
```

Backend will watch this directory for file changes.

### SQLite Database Location

Edit `.overmind.env`:
```bash
DATA_DIR=/custom/path/paige-data/
```

Database will be created at: `/custom/path/paige-data/paige.db`

### Running Without Overmind

**Terminal 1 - Backend**:
```bash
cd /Users/aaronbassett/Projects/paige
pnpm dev
```

**Terminal 2 - ChromaDB** (optional):
```bash
docker run --rm -p 8000:8000 chromadb/chroma
```

**Terminal 3 - Vite**:
```bash
cd /Users/aaronbassett/Projects/paige/electron-ui
npm run dev
```

**Terminal 4 - Electron**:
```bash
cd /Users/aaronbassett/Projects/paige/electron-ui
npm run dev:electron
```

## Production Build

```bash
# Build backend
cd /Users/aaronbassett/Projects/paige
pnpm build

# Build and package Electron app
cd /Users/aaronbassett/Projects/paige/electron-ui
npm run build
npm run build:electron
```

Packaged app will be in: `electron-ui/dist/`

## Clean Reset

```bash
# Stop all services
overmind quit

# Delete SQLite database
rm ~/.paige/paige.db

# Delete node_modules (optional)
rm -rf node_modules electron-ui/node_modules

# Reinstall
pnpm install
cd electron-ui && npm install
```

## Getting Help

- **GitHub Issues**: [Report bugs](https://github.com/aaronbassett/paige/issues)
- **Overmind Docs**: [DarthSim/overmind](https://github.com/DarthSim/overmind)
- **Project Docs**: See `docs/planning/initial-brainstorm.md` for architecture

## Quick Reference Card

```bash
# Setup
./scripts/setup-demo.sh

# Start (full)
overmind start

# Start (minimal)
overmind start -f Procfile.minimal

# View logs
overmind connect

# Restart service
overmind restart backend

# Stop all
overmind quit

# Check health
curl http://localhost:3001/health

# View database
sqlite3 ~/.paige/paige.db "SELECT * FROM sessions;"
```
