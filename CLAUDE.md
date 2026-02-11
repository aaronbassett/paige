# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paige is an AI-powered coaching tool for junior developers. Instead of writing code for developers, Paige coaches them through problems. The tagline: "Claude Codes, Paige Pairs."

This is a hackathon project (one-week, solo developer) for the Claude Code Hackathon at Cerebral Valley. Judging is 30% demo, 25% impact, 25% Opus 4.6 use, 20% depth & execution.

## Architecture: Three Tiers

```
Claude Code Plugin ←── MCP (SSE) ──→ Backend Server ←── WebSocket ──→ Electron UI
  (Personality)                        (Brain)                         (Face)
```

**Claude Code Plugin**: Coaching persona, read-only enforcement via hooks, prompt enrichment. Uses SessionStart, PreToolUse, PostToolUse, UserPromptSubmit, and Stop hooks.

**Backend Server**: Node.js/TypeScript. Owns ALL state (SQLite for structured data, ChromaDB for semantic search), all file I/O, all MCP tool implementations, action logging. Single source of truth — if the backend doesn't know about it, it didn't happen.

**Electron UI**: Thin rendering client. React + TypeScript. Monaco Editor for code, xterm.js for terminal, file tree with hint decorations. Communicates with backend via WebSocket only. NEVER touches the filesystem directly. Contains no AI logic.

## Active Technologies

**Feature 001: Electron UI** (Current Work)

**Core Stack**:
- **TypeScript 5.x** (strict mode) — Type safety across main + renderer processes
- **Node.js 20.x LTS** — Runtime for Electron main process
- **Electron 28+** — Desktop application framework (Chromium + Node.js)
- **React 18** — UI library with hooks, strict mode
- **Vite** — Fast bundler for renderer process with HMR

**UI Components**:
- **@monaco-editor/react** — Code editor (VS Code engine)
- **xterm.js** — Terminal emulator with ANSI color support
- **react-arborist** — Virtualized file tree (500+ files performant)
- **vscode-icons** — File type icons for tree
- **Framer Motion** — Spring physics animations (4 named presets)
- **@floating-ui/react** — Comment balloon positioning with collision detection
- **react-toastify** — Unanchored editor notifications

**Backend Communication**:
- **WebSocket (native)** — 51 message types defined in contracts/
- **node-pty** — PTY management for terminal (main process)

**Testing**:
- **Vitest** — Fast test framework (Jest-compatible API, ESM-native)
- **@testing-library/react** — React component testing
- **Playwright** — E2E testing with Electron support

**Development Tools**:
- **ESLint** — Linting (strict, warnings are blockers)
- **Prettier** — Code formatting (auto-applied on commit)
- **husky + lint-staged** — Pre-commit hooks

**Project Structure**:
- `src/` — Main process (Electron backend, PTY, IPC)
- `renderer/` — Renderer process (React frontend, Monaco, xterm.js)
- `shared/` — Shared TypeScript types (WebSocket protocol, entities)
- `tests/` — Unit, integration, E2E tests

---

## Development Commands

**Setup**:
```bash
cd electron-ui
npm install
```

**Development**:
```bash
npm run dev              # Start Electron app with HMR
npm run typecheck        # Run TypeScript type check
```

**Testing**:
```bash
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # E2E tests (Playwright)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

**Code Quality**:
```bash
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format with Prettier
npm run format:check     # Check formatting
```

**Build**:
```bash
npm run build            # Package Electron app
```

**Key Shortcuts** (in app):
- Cmd+R — Reload renderer
- Cmd+Opt+I — Toggle DevTools
- Cmd+S — Save file (Monaco)
- Cmd+W — Close tab (Monaco)
- Cmd+Shift+H — Cycle hint level

---

## Recent Changes

**2026-02-11**: Feature 001 (Electron UI) planning complete
- Defined 51 WebSocket message types (contracts/websocket-protocol.md)
- Created data model with 10 entities (data-model.md)
- Researched test framework (selected Vitest over Jest)
- Established project structure (main + renderer + shared)
- Defined TypeScript strict mode configuration
- Set up development workflow with husky + lint-staged

---

## References

- `docs/planning/initial-brainstorm.md` — Full architecture, research, UI design, coaching pipeline, MCP tool surface, WebSocket protocol, Observer system, demo script (Read when required)
- `specs/001-electron-ui/` — Feature spec, plan, data model, contracts, research, quickstart
- `.sdd/memory/constitution.md` — Project constitution with enforceable principles and development standards (Read at the start of every session)
