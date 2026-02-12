# Paige Electron UI

The **Face** tier of Paige — a coaching IDE for junior developers. This is a thin rendering client built with Electron, React, and TypeScript. It communicates with the Paige backend server over WebSocket and never touches the filesystem directly.

## Prerequisites

- **Node.js 20.x LTS** (tested with v20.18.1)
- **npm 9+**
- A running Paige backend server (for full functionality)

## Getting Started

### Install dependencies

```bash
cd electron-ui
npm install
```

`node-pty` (used for the embedded terminal) includes a native addon that compiles during install. On Linux, make sure you have build tools available:

```bash
# Debian/Ubuntu
sudo apt install build-essential python3
```

### Run in development mode

Development requires two processes running simultaneously — the Vite dev server (renderer) and the Electron main process:

**Terminal 1 — Start the Vite dev server:**

```bash
npm run dev
```

This starts the renderer at `http://localhost:5173` with hot module replacement (HMR). Code changes in `renderer/` are reflected instantly without restarting.

**Terminal 2 — Start the Electron app:**

```bash
npm run dev:electron
```

This compiles the main process TypeScript and launches Electron. The main window loads from the Vite dev server. Restart this command after changing files in `src/` (main process code is not hot-reloaded).

### Build for production

```bash
npm run build
```

Compiles the main process (`src/` &rarr; `dist/`) and bundles the renderer (`renderer/` &rarr; `dist/renderer/`).

To package as a distributable Electron app:

```bash
npm run build:electron
```

## Project Structure

```
electron-ui/
  src/                  # Main process (Electron)
    main.ts             #   App entry point, window creation
    preload.ts          #   Context bridge (IPC ↔ renderer)
    ipc/                #   IPC handler registration
    pty/                #   node-pty terminal management
  renderer/             # Renderer process (React)
    index.html          #   HTML entry point
    vite.config.ts      #   Vite bundler config
    src/                #   React app source
  shared/               # Shared TypeScript types
  tests/                # All tests
    unit/               #   Unit tests (Vitest + happy-dom)
    integration/        #   Integration tests
    e2e/                #   E2E tests (Playwright)
  vitest.config.ts      # Vitest test runner config
  playwright.config.ts  # Playwright E2E config
  tsconfig.json         # TypeScript config (renderer + shared)
  tsconfig.main.json    # TypeScript config (main process)
```

## Testing

```bash
npm test                 # Run all unit + integration tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # E2E tests (Playwright, requires display)
npm run test:watch       # Watch mode — re-runs on file changes
npm run test:coverage    # Generate coverage report (text + HTML + LCOV)
```

Unit and integration tests use **Vitest** with **happy-dom** as the browser environment and **@testing-library/react** for component testing.

E2E tests use **Playwright** with Electron support. They require a built app (`npm run build` first) and a display server. In headless CI, E2E tests are scaffolded with `test.skip()`.

## Code Quality

```bash
npm run lint             # Run ESLint (warnings are blockers)
npm run lint:fix         # Auto-fix ESLint issues
npm run format           # Format all files with Prettier
npm run format:check     # Check formatting without writing
npm run typecheck        # Type-check both renderer and main process
```

Pre-commit hooks (husky + lint-staged) automatically lint and format staged files.

## Key Technologies

| Layer         | Technology                    | Purpose                                |
| ------------- | ----------------------------- | -------------------------------------- |
| Framework     | Electron 40                   | Desktop app shell (Chromium + Node.js) |
| UI            | React 19                      | Component library                      |
| Bundler       | Vite 7                        | Fast builds + HMR for renderer         |
| Editor        | Monaco (@monaco-editor/react) | VS Code-based code editor              |
| Terminal      | xterm.js + node-pty           | Embedded terminal emulator             |
| File Tree     | react-arborist                | Virtualized tree (500+ files)          |
| Animation     | Framer Motion                 | Spring-physics UI transitions          |
| Positioning   | @floating-ui/react            | Comment balloon placement              |
| Communication | WebSocket (native)            | Backend server connection              |

## Keyboard Shortcuts (in-app)

| Shortcut         | Action           |
| ---------------- | ---------------- |
| Cmd/Ctrl+R       | Reload renderer  |
| Cmd/Ctrl+Alt+I   | Toggle DevTools  |
| Cmd/Ctrl+S       | Save file        |
| Cmd/Ctrl+W       | Close tab        |
| Cmd/Ctrl+Shift+H | Cycle hint level |

## Architecture Notes

- The **main process** (`src/`) manages the Electron window, PTY sessions, and IPC bridging. It has access to Node.js APIs.
- The **renderer process** (`renderer/`) is a standard React SPA. It communicates with the main process via a context bridge (`preload.ts`) and with the backend server via WebSocket.
- **Shared types** (`shared/`) define the WebSocket protocol and entity types used by both processes.
- The UI contains **no AI logic** — all coaching intelligence lives in the backend server.
