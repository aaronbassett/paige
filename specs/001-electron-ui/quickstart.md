# Quickstart: Electron UI

**Feature**: 001-electron-ui
**Date**: 2026-02-11
**Purpose**: Get started with Electron UI development in <5 minutes

---

## Prerequisites

- **Node.js**: 20.x LTS ([download](https://nodejs.org/))
- **npm**: 10.x (comes with Node.js)
- **Git**: For version control
- **Backend Server**: Running on `localhost:8080` (see backend quickstart)

**Verify Installation**:
```bash
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
```

---

## Installation

```bash
# Clone repository (if not already)
cd /path/to/paige

# Navigate to Electron UI directory
cd electron-ui

# Install dependencies
npm install
```

**Dependencies Installed**:
- Electron 28+ (desktop framework)
- React 18 (UI library)
- TypeScript 5.x (type safety)
- Vite (bundler for renderer process)
- Monaco Editor, xterm.js, react-arborist (UI components)
- Framer Motion, @floating-ui/react (animations, positioning)
- Vitest (testing framework)

---

## Project Structure

```
electron-ui/
├── src/                  # Main process (Electron backend)
│   ├── main.ts           # Entry point
│   ├── preload.ts        # IPC bridge
│   └── pty/              # Terminal PTY management
├── renderer/             # Renderer process (React frontend)
│   ├── src/
│   │   ├── App.tsx       # Root component
│   │   ├── views/        # Dashboard, IDE, Placeholder
│   │   ├── components/   # Editor, Terminal, FileTree, Sidebar
│   │   ├── services/     # WebSocket, state management
│   │   └── styles/       # Design tokens, global CSS
│   └── index.html
├── shared/               # Shared TypeScript types
│   └── types/            # WebSocket messages, entities
└── tests/                # Unit, integration, E2E tests
```

---

## Development Commands

### Start Development

```bash
# Terminal 1: Start backend server (from backend/ directory)
cd ../backend && npm run dev

# Terminal 2: Start Electron UI
npm run dev
```

**What Happens**:
1. Vite dev server starts for renderer (React app with HMR)
2. Electron main process launches with dev tools
3. App window opens, connects to backend WebSocket
4. Dashboard loads with mocked data (if backend not ready)

**Dev Tools**:
- **Renderer**: Right-click → "Inspect Element" (Chromium DevTools)
- **Main Process**: `console.log` output in terminal

---

### Build Production

```bash
npm run build
```

**Output**: `dist/` directory with packaged Electron app
- macOS: `dist/Paige.app`
- Windows: `dist/Paige.exe`
- Linux: `dist/Paige.AppImage`

---

### Run Tests

```bash
# Unit tests (services, utilities)
npm run test:unit

# Integration tests (multi-component workflows)
npm run test:integration

# E2E tests (Playwright, full app)
npm run test:e2e

# All tests
npm test

# Watch mode (re-run on file change)
npm run test:watch

# Coverage report
npm run test:coverage
```

**Test Files**:
- `tests/unit/` — Component + service unit tests
- `tests/integration/` — Multi-component workflows
- `tests/e2e/` — End-to-end Playwright tests

---

### Linting & Formatting

```bash
# Run ESLint
npm run lint

# Fix ESLint issues automatically
npm run lint:fix

# Run Prettier check
npm run format:check

# Format code with Prettier
npm run format

# Run TypeScript type check
npm run typecheck
```

**Pre-Commit Hook** (husky + lint-staged):
- Runs on `git commit`
- Auto-formats staged files
- Runs ESLint on staged files
- Fails commit if errors exist

---

## Key Files

### Configuration

- **`package.json`**: Dependencies, scripts
- **`tsconfig.json`**: TypeScript config (strict mode)
- **`.eslintrc.json`**: ESLint rules
- **`.prettierrc.json`**: Prettier formatting
- **`vite.config.ts`**: Vite bundler config (renderer)
- **`electron-builder.json`**: Electron packaging config

### Entry Points

- **`src/main.ts`**: Electron main process entry
- **`renderer/src/main.tsx`**: React renderer entry
- **`src/preload.ts`**: IPC bridge (security layer)

### Contracts

- **`specs/001-electron-ui/contracts/websocket-protocol.md`**: Backend ↔ Frontend contract (51 message types)

---

## Common Workflows

### 1. Add New React Component

```bash
# Create component file
mkdir renderer/src/components/MyComponent
touch renderer/src/components/MyComponent/MyComponent.tsx

# Component template
cat > renderer/src/components/MyComponent/MyComponent.tsx << 'EOF'
import { FC } from 'react';

interface MyComponentProps {
  // Define props
}

export const MyComponent: FC<MyComponentProps> = (props) => {
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
};
EOF

# Add unit test
touch renderer/src/components/MyComponent/MyComponent.test.tsx
```

---

### 2. Add New WebSocket Message Type

1. Update contract: `specs/001-electron-ui/contracts/websocket-protocol.md`
2. Add TypeScript type: `shared/types/websocket-messages.ts`
3. Add type guard: `shared/types/websocket-messages.ts`
4. Handle in WebSocket client: `renderer/src/services/websocket-client.ts`
5. Add unit test: `tests/unit/services/websocket-client.test.ts`

---

### 3. Add Monaco Editor Decoration

1. Define decoration style: `renderer/src/styles/editor-decorations.css`
2. Update decoration manager: `renderer/src/services/decoration-manager.ts`
3. Map to Monaco options: Use `deltaDecorations` API
4. Test with mock WebSocket message

---

### 4. Debug WebSocket Messages

```typescript
// In renderer/src/services/websocket-client.ts
websocket.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  console.log('[WS →]', msg.type, msg.payload); // Incoming
});

websocket.send(JSON.stringify(message));
console.log('[WS ←]', message.type, message.payload); // Outgoing
```

Enable WebSocket logging in Chrome DevTools:
1. Open DevTools (Right-click → Inspect)
2. Network tab → WS filter
3. Click WebSocket connection → Messages tab

---

### 5. Mock Backend for Isolated Testing

```typescript
// tests/utils/mock-backend.ts
import { WebSocket, WebSocketServer } from 'ws';

export function createMockBackend(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    // Send handshake
    ws.send(JSON.stringify({
      type: 'connection:hello',
      payload: { serverId: 'test', version: '1.0.0', capabilities: [] },
      timestamp: Date.now()
    }));

    // Echo messages back
    ws.on('message', (data) => {
      console.log('Mock backend received:', data.toString());
    });
  });

  return wss;
}
```

---

## Environment Variables

Create `.env` file in `electron-ui/`:

```bash
# Backend WebSocket URL
VITE_BACKEND_WS_URL=ws://localhost:8080

# Enable debug logging
VITE_DEBUG=true

# Mock backend mode (for frontend-only dev)
VITE_MOCK_BACKEND=false
```

**Usage in Code**:
```typescript
const wsUrl = import.meta.env.VITE_BACKEND_WS_URL;
const debug = import.meta.env.VITE_DEBUG === 'true';
```

---

## Troubleshooting

### Issue: Electron window blank on launch

**Solution**:
1. Check terminal for errors (main process logs)
2. Open DevTools (Right-click → Inspect)
3. Check Console tab for errors
4. Verify Vite dev server is running
5. Check WebSocket connection in Network tab

---

### Issue: WebSocket connection fails

**Solution**:
1. Verify backend server is running (`localhost:8080`)
2. Check backend logs for WebSocket errors
3. Test WebSocket with `wscat`:
   ```bash
   npm install -g wscat
   wscat -c ws://localhost:8080
   ```
4. Check firewall blocking localhost:8080

---

### Issue: Monaco Editor not loading

**Solution**:
1. Check browser console for "Cannot find module" errors
2. Verify `@monaco-editor/react` installed: `npm list @monaco-editor/react`
3. Clear Vite cache: `rm -rf node_modules/.vite && npm run dev`
4. Check Monaco CDN fallback in `vite.config.ts`

---

### Issue: Terminal not rendering

**Solution**:
1. Check IPC bridge: Verify `window.terminal` exposed in preload.ts
2. Check PTY spawn: Verify `node-pty` installed (requires native compilation)
3. Check platform: PTY may require different config on Windows
4. Test with simple shell command: `echo "test"`

---

### Issue: Tests failing with "Cannot find module"

**Solution**:
1. Verify test framework installed: `npm list vitest`
2. Check `tsconfig.json` has correct `paths` mapping
3. Clear test cache: `npm run test -- --clearCache`
4. Restart TypeScript server: In VS Code, Cmd+Shift+P → "Restart TS Server"

---

## Keyboard Shortcuts (Development)

### App Shortcuts
- **Cmd+R**: Reload renderer (Chromium reload)
- **Cmd+Opt+I**: Toggle DevTools (renderer)
- **Cmd+Q**: Quit app

### Editor Shortcuts (in Monaco)
- **Cmd+S**: Save file
- **Cmd+W**: Close tab
- **Cmd+P**: Quick open file (if implemented)
- **Cmd+Shift+H**: Cycle hint level
- **Cmd+Shift+[**: Decrease hint level
- **Cmd+Shift+]**: Increase hint level

### Review Navigation
- **◀** button: Previous comment
- **▶** button: Next comment
- **✕** button: Exit review

---

## Next Steps

1. **Read Spec**: See `specs/001-electron-ui/spec.md` for full requirements
2. **Read Contracts**: See `contracts/websocket-protocol.md` for message types
3. **Read Data Model**: See `data-model.md` for entity definitions
4. **Run Tests**: `npm test` to verify setup
5. **Start Coding**: Pick a story from spec.md and implement!

---

## Useful Links

- **Monaco Editor Docs**: https://microsoft.github.io/monaco-editor/
- **xterm.js Docs**: https://xtermjs.org/docs/
- **Framer Motion Docs**: https://www.framer.com/motion/
- **Floating UI Docs**: https://floating-ui.com/
- **Electron Docs**: https://www.electronjs.org/docs/latest/
- **Vitest Docs**: https://vitest.dev/
- **Playwright Docs**: https://playwright.dev/

---

**Questions?** Check `docs/planning/initial-brainstorm.md` for architecture details.

**Status**: ✅ Ready for development
