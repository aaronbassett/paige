#!/usr/bin/env bash
# Paige E2E Demo Setup Script
# Prepares the environment for running the full demo with Overmind

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

# Detect project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
log_info "Project root: $PROJECT_ROOT"

# Check for required tools
log_info "Checking required tools..."

if ! command -v pnpm &> /dev/null; then
  log_error "pnpm not found. Install with: npm install -g pnpm"
  exit 1
fi
log_success "pnpm found"

if ! command -v node &> /dev/null; then
  log_error "Node.js not found. Install from: https://nodejs.org/"
  exit 1
fi
log_success "Node.js found ($(node --version))"

if ! command -v overmind &> /dev/null; then
  log_error "Overmind not found. Install with:"
  echo "  macOS:  brew install overmind"
  echo "  Linux:  See https://github.com/DarthSim/overmind#installation"
  exit 1
fi
log_success "Overmind found"

# Check for optional tools
log_info "Checking optional tools..."

CHROMADB_AVAILABLE=false
if command -v docker &> /dev/null; then
  log_success "Docker found (for ChromaDB via Docker)"
  CHROMADB_AVAILABLE=true
elif command -v chroma &> /dev/null; then
  log_success "ChromaDB CLI found (native installation)"
  CHROMADB_AVAILABLE=true
else
  log_warning "Neither Docker nor ChromaDB CLI found"
  echo "  Install ChromaDB: pip install chromadb"
  echo "  Or install Docker for containerized ChromaDB"
  echo "  Memory features will be disabled without ChromaDB"
fi

if command -v gh &> /dev/null; then
  if gh auth status &> /dev/null; then
    log_success "GitHub CLI authenticated"
  else
    log_warning "GitHub CLI found but not authenticated - run: gh auth login"
  fi
else
  log_warning "GitHub CLI not found - Dashboard issue recommendations unavailable"
fi

# Install backend dependencies
log_info "Installing backend dependencies..."
cd "$PROJECT_ROOT"
if [ ! -d "node_modules" ]; then
  pnpm install
  log_success "Backend dependencies installed"
else
  log_success "Backend dependencies already installed"
fi

# Install Electron UI dependencies
log_info "Installing Electron UI dependencies..."
cd "$PROJECT_ROOT/electron-ui"
if [ ! -d "node_modules" ]; then
  npm install
  log_success "Electron UI dependencies installed"
else
  log_success "Electron UI dependencies already installed"
fi

# Check for .env file
cd "$PROJECT_ROOT"
if [ ! -f ".env" ]; then
  log_warning ".env file not found"
  echo ""
  echo "Creating .env from template..."
  cp .env.example .env

  # Update PROJECT_DIR in .env
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|PROJECT_DIR=/absolute/path/to/project|PROJECT_DIR=$PROJECT_ROOT|g" .env
  else
    sed -i "s|PROJECT_DIR=/absolute/path/to/project|PROJECT_DIR=$PROJECT_ROOT|g" .env
  fi

  log_warning "⚠️  IMPORTANT: Edit .env and add your ANTHROPIC_API_KEY"
  echo ""
  echo "   Get your API key from: https://console.anthropic.com/"
  echo "   Then edit: $PROJECT_ROOT/.env"
  echo ""
  read -p "Press Enter after adding your API key, or Ctrl+C to exit..."
else
  log_success ".env file found"

  # Check if API key is set
  if grep -q "ANTHROPIC_API_KEY=sk-ant-your-key-here" .env || grep -q "ANTHROPIC_API_KEY=sk-ant-\.\.\." .env; then
    log_error "ANTHROPIC_API_KEY not configured in .env"
    echo ""
    echo "   Edit: $PROJECT_ROOT/.env"
    echo "   Get your key from: https://console.anthropic.com/"
    echo ""
    exit 1
  fi
  log_success "ANTHROPIC_API_KEY configured"
fi

# Update .overmind.env with project root
log_info "Updating .overmind.env..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s|PROJECT_ROOT=.*|PROJECT_ROOT=$PROJECT_ROOT|g" .overmind.env
  sed -i '' "s|PROJECT_DIR=.*|PROJECT_DIR=$PROJECT_ROOT|g" .overmind.env
else
  sed -i "s|PROJECT_ROOT=.*|PROJECT_ROOT=$PROJECT_ROOT|g" .overmind.env
  sed -i "s|PROJECT_DIR=.*|PROJECT_DIR=$PROJECT_ROOT|g" .overmind.env
fi

# Copy ANTHROPIC_API_KEY from .env to .overmind.env
API_KEY=$(grep "^ANTHROPIC_API_KEY=" .env | cut -d '=' -f 2-)
if [ -n "$API_KEY" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$API_KEY|g" .overmind.env
  else
    sed -i "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$API_KEY|g" .overmind.env
  fi
  log_success ".overmind.env updated"
fi

# Type check
log_info "Running type checks..."
cd "$PROJECT_ROOT"
if pnpm typecheck; then
  log_success "Backend type check passed"
else
  log_error "Backend type check failed"
  exit 1
fi

cd "$PROJECT_ROOT/electron-ui"
if npm run typecheck; then
  log_success "Electron UI type check passed"
else
  log_error "Electron UI type check failed"
  exit 1
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════════"
log_success "Setup complete! Ready to start demo."
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Start commands:"
echo ""
echo "  ${GREEN}Full demo with ChromaDB (Docker):${NC}"
echo "    cd $PROJECT_ROOT"
echo "    overmind start"
echo ""
echo "  ${GREEN}Full demo with ChromaDB (Native):${NC}"
echo "    pip install chromadb  # One-time setup"
echo "    cd $PROJECT_ROOT"
echo "    overmind start -f Procfile.native"
echo ""
echo "  ${GREEN}Minimal demo (without ChromaDB):${NC}"
echo "    cd $PROJECT_ROOT"
echo "    overmind start -f Procfile.minimal"
echo ""
echo "  ${GREEN}Stop all services:${NC}"
echo "    overmind quit"
echo ""
echo "Services:"
echo "  • Backend Server:  http://localhost:3001 (MCP: /mcp, WebSocket: /ws)"
echo "  • Vite Dev Server: http://localhost:5173 (renderer HMR)"
echo "  • Electron App:    Launches automatically"
echo "  • MCP Inspector:   Check logs for port (optional, for MCP debugging)"
if [[ "$CHROMADB_AVAILABLE" == "true" ]]; then
  echo "  • ChromaDB:        http://localhost:8000 (optional, semantic memory)"
fi
echo ""
echo "Logs:"
echo "  • View all logs:   overmind connect"
echo "  • View specific:   overmind connect backend"
echo "  • Restart service: overmind restart backend"
echo ""
