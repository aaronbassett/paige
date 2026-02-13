# Paige - Quick Start Guide

**Launch the complete E2E demo with a single command!**

## TL;DR

```bash
# 1. Setup (one-time)
./scripts/setup-demo.sh

# 2. Start everything
overmind start

# 3. Stop everything
overmind quit
```

## What Gets Started

When you run `overmind start`, these services launch automatically:

1. **Backend Server** - Port 3001 (MCP, WebSocket, Health check)
2. **ChromaDB** - Port 8000 (Semantic memory)
3. **Vite Dev Server** - Port 5173 (React HMR)
4. **Electron App** - Desktop application
5. **MCP Inspector** - Port varies (MCP debugging UI)

## Prerequisites

Install these tools first:

```bash
# macOS
brew install overmind pnpm node

# Verify
overmind version
pnpm --version
node --version
```

Optional:
```bash
# For semantic memory (choose one):
# Option 1: Docker (containerized)
brew install docker

# Option 2: Native (via pip)
pip install chromadb

# For GitHub issue recommendations
brew install gh
gh auth login
```

## Setup Steps

### 1. Run Setup Script

```bash
cd /Users/aaronbassett/Projects/paige
./scripts/setup-demo.sh
```

This will:
- Install all dependencies
- Create `.env` file
- Validate configuration
- Run type checks

**Important**: Add your Anthropic API key to `.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get your key from: https://console.anthropic.com/

### 2. Start Services

**Full demo with ChromaDB** (via Docker):
```bash
overmind start
```

**Full demo with ChromaDB** (native, no Docker):
```bash
pip install chromadb  # One-time
overmind start -f Procfile.native
```

**Minimal demo** (without ChromaDB):
```bash
overmind start -f Procfile.minimal
```

### 3. Verify It's Running

Open your browser: http://localhost:3001/health

Expected response:
```json
{"status":"ok","uptime":5.2}
```

The Electron app should launch automatically after ~3 seconds.

### 4. Test MCP Server (Optional)

The MCP Inspector provides a web UI for testing MCP tools and prompts:

1. Check the inspector logs to find the port:
```bash
overmind connect inspector
```

2. Open the inspector in your browser (typically http://localhost:5173 or similar)

3. The inspector is pre-configured to connect to http://localhost:3001/mcp

4. You can test MCP tools like:
   - `read_file` - Read files from the demo project
   - `write_file` - Write files to the demo project
   - `list_directory` - List directory contents
   - And more...

**Note**: The inspector is optional and only needed for MCP debugging. The Electron UI doesn't require it.

## Common Commands

```bash
# Start all services
overmind start

# View logs
overmind connect

# Restart a service
overmind restart backend

# Stop all services
overmind quit

# Check service status
overmind status
```

## Services Overview

| Service | URL | Purpose |
|---------|-----|---------|
| Backend | http://localhost:3001 | API server |
| MCP | http://localhost:3001/mcp | Claude Code plugin |
| WebSocket | ws://localhost:3001/ws | Electron UI connection |
| Vite | http://localhost:5173 | React dev server |
| ChromaDB | http://localhost:8000 | Semantic memory |
| MCP Inspector | Check logs for port | Test MCP tools & prompts |

## Troubleshooting

### "Overmind not found"
```bash
brew install overmind
```

### "Port 3001 already in use"
```bash
lsof -ti:3001 | xargs kill -9
```

### "ChromaDB won't start"
Use minimal mode:
```bash
overmind start -f Procfile.minimal
```

### "Electron won't start"
Check if Vite is running:
```bash
curl http://localhost:5173
```

## Next Steps

See [DEMO.md](./DEMO.md) for:
- Detailed architecture
- Development workflow
- Advanced configuration
- Full troubleshooting guide

## Getting Help

- View logs: `overmind connect`
- Check health: `curl http://localhost:3001/health`
- See full docs: [DEMO.md](./DEMO.md)
