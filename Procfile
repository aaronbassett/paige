# Paige E2E Demo - Overmind Process Definition
# Start all services: overmind start
# Start without optional services: overmind start -f Procfile.minimal

# Backend Server (Required)
# Runs on port 3001 with MCP endpoint (/mcp) and WebSocket (/ws)
backend: cd $PROJECT_ROOT && pnpm dev

# ChromaDB (Optional - graceful degradation)
# Semantic memory for cross-session learning
chromadb: docker run --rm -p 8000:8000 chromadb/chroma

# Vite Dev Server (Required for Electron UI)
# Hot module replacement for renderer process
vite: cd $PROJECT_ROOT/electron-ui && npm run dev

# Electron App (Required for UI)
# Wait 3 seconds for Vite to start, then launch Electron
electron: sleep 3 && cd $PROJECT_ROOT/electron-ui && npm run dev:electron

# MCP Inspector (Optional - for testing MCP server)
# Web UI for testing MCP tools and prompts
# Access at: http://localhost:5173 (or the port shown in logs)
# Connects to backend MCP server at http://localhost:3001/mcp
# Note: The inspector provides a UI - configure connection there instead of CLI args
inspector: sleep 4 && npx @modelcontextprotocol/inspector
