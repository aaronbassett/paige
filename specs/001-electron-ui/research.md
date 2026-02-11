# Research: Electron UI

**Feature**: 001-electron-ui
**Date**: 2026-02-11
**Purpose**: Resolve technical unknowns and establish best practices for implementation

---

## Research Questions

### 1. Testing Framework Selection (Vitest vs Jest for Electron + React)

**Question**: Which test framework provides best support for Electron two-process architecture + React components?

**Research Findings**:

**Vitest**:
- **Pros**:
  - Native ESM support (modern, no transpilation hacks)
  - Fast (Vite-powered, parallel execution)
  - Jest-compatible API (easy migration)
  - Built-in TypeScript support
  - Better DX (hot module reload for tests)
- **Cons**:
  - Newer (less mature ecosystem for Electron specifically)
  - Electron main process testing requires workarounds (no native Node.js environment isolation)

**Jest**:
- **Pros**:
  - Mature ecosystem with extensive Electron examples
  - `@testing-library/react` well-established
  - Better support for Node.js environment (main process tests)
- **Cons**:
  - CommonJS-first (ESM support experimental)
  - Slower than Vitest (no parallelization out of box)
  - Requires more configuration for TypeScript

**Electron-Specific Considerations**:
- Main process tests need Node.js environment (PTY, IPC handlers)
- Renderer process tests need DOM environment (React components)
- Both frameworks support environment switching via `@jest-environment` or Vitest's `environment` option

**Decision**: **Vitest**

**Rationale**:
1. Modern ESM-first aligns with Vite bundler (already using for renderer)
2. Faster feedback loop critical for hackathon timeline
3. Jest-compatible API means existing React testing patterns work
4. Main process tests can use Vitest's Node environment (minimal overhead)
5. Constitution principle: prefer boring/working over novel — Vitest is established enough (widely adopted, stable 1.x)

**Alternatives Considered**:
- Jest: Rejected due to slower iteration and CommonJS friction
- No tests: Violates constitution (happy path tests required)

---

### 2. End-to-End Testing (Playwright Configuration for Electron)

**Question**: How to configure Playwright for Electron app E2E testing?

**Research Findings**:

Playwright has official Electron support via `electron` launch option:

```typescript
import { test, _electron as electron } from '@playwright/test';

test('launch app', async () => {
  const app = await electron.launch({
    args: ['path/to/main.js']
  });
  const page = await app.firstWindow();
  // ... test interactions
  await app.close();
});
```

**Key Patterns**:
- Launch Electron via `electron.launch()` instead of browser
- Access windows via `app.firstWindow()` or `app.windows()`
- Mock WebSocket backend for isolated E2E tests (no backend dependency)
- Use Page Object Model for maintainability

**Decision**: **Playwright with Electron launch mode**

**Rationale**:
1. Official support from Playwright team
2. Same API as browser testing (familiar)
3. Can mock WebSocket for isolated E2E tests
4. Critical for constitution compliance (happy path tests)

---

### 3. Monaco Editor Best Practices (Decorations, Themes, Performance)

**Question**: How to efficiently manage Monaco decorations, custom themes, and large files?

**Research Findings**:

**Decorations**:
```typescript
// Use decorations API with stable IDs
const decorations = editor.deltaDecorations(
  oldDecorations, // Previous decoration IDs
  [
    {
      range: new monaco.Range(startLine, startColumn, endLine, endColumn),
      options: {
        isWholeLine: true,
        className: 'hint-highlight',
        glyphMarginClassName: 'hint-gutter',
        hoverMessage: { value: 'Hint message' }
      }
    }
  ]
);
```

**Key Patterns**:
- Store decoration IDs for efficient updates (`deltaDecorations` replaces)
- Use `isWholeLine` for line highlights
- `glyphMarginClassName` for gutter markers
- `hoverMessage` for tooltips
- Clear on edit: listen to `onDidChangeModelContent` and check range overlap

**Custom Theme**:
```typescript
monaco.editor.defineTheme('paige-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'd97757' }, // Terracotta
    { token: 'string', foreground: '98c379' }, // Green
    // ... warm palette, no cold hues
  ],
  colors: {
    'editor.background': '#141413',
    'editor.foreground': '#e8e6e0',
    'editorCursor.foreground': '#d97757',
    // ... design tokens
  }
});
```

**Performance** (Large Files):
- Monaco handles large files natively (virtual scrolling, syntax highlighting on-demand)
- No custom optimization needed for MVP (<5MB files)
- Disable minimap to save memory (`minimap: { enabled: false }`)

**Decision**: Use Monaco's built-in decoration API with `deltaDecorations` for efficient updates. Define custom "Paige Dark" theme. Trust Monaco's native large file handling.

**Rationale**: Follows constitution principle VI (leverage existing components). Monaco is battle-tested for large files. No need to reinvent.

---

### 4. xterm.js + node-pty Integration (PTY → IPC → Renderer)

**Question**: How to bridge PTY output from main process to xterm.js in renderer?

**Research Findings**:

**Architecture**:
```
Main Process          IPC Bridge           Renderer Process
    ↓                    ↓                       ↓
node-pty          contextBridge             xterm.js
(spawn PTY)       (preload.ts)          (terminal.write)
```

**Main Process** (src/pty/pty-manager.ts):
```typescript
import pty from 'node-pty';

const shell = pty.spawn('bash', [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env
});

shell.onData((data) => {
  webContents.send('terminal:data', data); // Send to renderer
});

ipcMain.on('terminal:write', (event, data) => {
  shell.write(data); // User input
});

ipcMain.on('terminal:resize', (event, { cols, rows }) => {
  shell.resize(cols, rows);
});
```

**Preload** (src/preload.ts):
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('terminal', {
  onData: (callback) => ipcRenderer.on('terminal:data', (_, data) => callback(data)),
  write: (data) => ipcRenderer.send('terminal:write', data),
  resize: (cols, rows) => ipcRenderer.send('terminal:resize', { cols, rows })
});
```

**Renderer** (renderer/src/components/Terminal/Terminal.tsx):
```typescript
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

const term = new Terminal({ /* theme */ });
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(containerRef.current);

// Bridge PTY output → xterm.js
window.terminal.onData((data) => term.write(data));

// Bridge user input → PTY
term.onData((data) => window.terminal.write(data));

// Resize on container change
const resizeObserver = new ResizeObserver(() => {
  fitAddon.fit();
  window.terminal.resize(term.cols, term.rows);
});
resizeObserver.observe(containerRef.current);
```

**Decision**: Use IPC bridge pattern (PTY in main, xterm.js in renderer, contextBridge for security)

**Rationale**:
1. Follows Electron security best practices (contextBridge, no nodeIntegration)
2. Clean separation: privileged operations in main, UI in renderer
3. Standard pattern from xterm.js + Electron examples

---

### 5. WebSocket Reconnection Strategy (Exponential Backoff)

**Question**: How to implement robust reconnection with exponential backoff?

**Research Findings**:

**Implementation Pattern**:
```typescript
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxBackoff = 30000; // 30s cap
  private baseDelay = 1000; // Start at 1s

  connect() {
    this.ws = new WebSocket('ws://localhost:8080');

    this.ws.onclose = () => {
      const delay = Math.min(
        this.baseDelay * Math.pow(2, this.reconnectAttempts),
        this.maxBackoff
      );

      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect(); // Recursive reconnect
      }, delay);
    };

    this.ws.onopen = () => {
      this.reconnectAttempts = 0; // Reset on success
    };
  }
}
```

**Key Patterns**:
- Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (capped)
- Reset counter on successful connection
- Retry indefinitely (per spec: "retry indefinitely at 30s intervals")
- Show "Reconnecting... (attempt N)" after 5 failures
- Queue in-flight operations (e.g., file saves) during disconnect

**Decision**: Implement singleton WebSocketClient with exponential backoff, capped at 30s, infinite retries.

**Rationale**: Matches spec requirements exactly. Prevents aggressive reconnection that could overload backend.

---

### 6. React + Framer Motion Spring Presets

**Question**: How to implement named spring presets for consistent animations?

**Research Findings**:

**Framer Motion Spring Config**:
```typescript
// Define presets
const springPresets = {
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  expressive: { type: 'spring', stiffness: 170, damping: 20 },
  snappy: { type: 'spring', stiffness: 260, damping: 26 },
  bouncy: { type: 'spring', stiffness: 300, damping: 18 }
};

// Use in components
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={springPresets.expressive}
>
  Content
</motion.div>
```

**Key Patterns**:
- Export presets from `styles/animations.css` as CSS custom properties
- Map to Framer Motion objects in TypeScript
- Use `AnimatePresence` for mount/unmount transitions
- Respect `prefers-reduced-motion` (disable all animations if set)

**Decision**: Define 4 named presets (gentle, expressive, snappy, bouncy) matching spec. Export from centralized config.

**Rationale**: Consistent animation feel across app. Easy to tweak globally. Matches design system specification.

---

## Best Practices Summary

### TypeScript Configuration

**Strict Mode Settings** (tsconfig.json):
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Rationale**: Constitution requires strict mode. Catch errors at compile time.

---

### WebSocket Message Type Safety

**Pattern**:
```typescript
// shared/types/websocket-messages.ts

type MessageType =
  | 'connection:hello'
  | 'buffer:update'
  | 'coaching:message'
  | /* ... 48 more */;

interface BaseMessage {
  type: MessageType;
  payload: unknown;
  id?: string;
  timestamp: number;
}

interface BufferUpdateMessage extends BaseMessage {
  type: 'buffer:update';
  payload: {
    path: string;
    content: string;
  };
}

// Union type for all messages
type WebSocketMessage = BufferUpdateMessage | /* ... other 50 types */;

// Type guard
function isBufferUpdate(msg: WebSocketMessage): msg is BufferUpdateMessage {
  return msg.type === 'buffer:update';
}
```

**Rationale**: 51 message types require strict typing to prevent runtime errors. Union types + type guards provide safety.

---

### Debouncing Strategy

**Pattern**:
```typescript
// services/debouncer.ts
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Usage
const debouncedUpdate = debounce((content: string) => {
  websocket.send({ type: 'buffer:update', payload: { content } });
}, 300);
```

**Debounce Timings** (from spec):
- `buffer:update`: 300ms
- `editor:scroll`: 200ms
- `hints:level_change`: 200ms
- `user:idle_start`: 5000ms

**Rationale**: Reduces WebSocket traffic. Per spec requirements.

---

### File Tree Virtualization

**react-arborist Configuration**:
```typescript
import { Tree } from 'react-arborist';

<Tree
  data={treeData}
  height={containerHeight}
  width="100%"
  rowHeight={24}
  overscanCount={10} // Render 10 extra rows for smooth scroll
  // ... other props
/>
```

**Key Patterns**:
- Virtualization enables 500+ files performant
- Use `overscanCount` to prevent white flash on scroll
- Icons via `vscode-icons` for file type recognition

**Rationale**: Spec requires 500+ files performant. Virtualization is proven solution.

---

### Monaco Editor Configuration

**Recommended Settings**:
```typescript
import Editor from '@monaco-editor/react';

<Editor
  theme="paige-dark"
  options={{
    minimap: { enabled: false },
    lineNumbers: 'on',
    wordWrap: 'off',
    fontSize: 14,
    fontFamily: 'JetBrains Mono, monospace',
    fontLigatures: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderWhitespace: 'selection',
    scrollBeyondLastLine: false,
    automaticLayout: true
  }}
/>
```

**Rationale**: Matches VS Code defaults + design system typography.

---

## Recommendations

### Development Workflow

1. **Start with Component Library** (Story 1):
   - Implement design tokens first (CSS custom properties)
   - Verify animations, colors, typography in isolation
   - Create Storybook or standalone preview page

2. **Build Shell Before Features** (Story 2):
   - Implement App.tsx routing, layout panels
   - Verify transitions work smoothly
   - Mock all child components initially

3. **WebSocket Client Early** (Story 4):
   - Implement message protocol and reconnection logic first
   - Mock backend server for testing (send all 51 message types)
   - Validate type safety before integrating with components

4. **Test as You Go**:
   - Write unit tests for services immediately (debouncer, decorations, hints)
   - Write integration tests after 2-3 components complete
   - E2E tests last (after happy paths work manually)

---

### Technology Stack Summary

| Category | Choice | Rationale |
|----------|--------|-----------|
| **Test Framework** | Vitest | Fast, ESM-native, Jest-compatible |
| **E2E Testing** | Playwright | Official Electron support |
| **Editor Decorations** | Monaco API | Built-in, efficient `deltaDecorations` |
| **Theme** | Custom "Paige Dark" | Warm palette, terracotta accents |
| **Large Files** | Monaco native | Handles >1MB without custom optimization |
| **PTY Integration** | IPC bridge | Security best practice (contextBridge) |
| **Reconnection** | Exponential backoff | 1s → 30s cap, infinite retries |
| **Animations** | Framer Motion | Spring presets, `prefers-reduced-motion` |
| **Type Safety** | Union types + guards | 51 message types strictly typed |
| **Debouncing** | Custom utility | 300ms edits, 200ms scroll |
| **Virtualization** | react-arborist | 500+ files performant |

---

**Phase 0 Complete** ✅

All technical unknowns resolved. Ready to proceed to Phase 1 (Design & Contracts).
