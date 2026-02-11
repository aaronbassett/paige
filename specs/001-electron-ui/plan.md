<!--
==============================================================================
PLAN TEMPLATE
==============================================================================

PURPOSE:
  Defines technical implementation plans with architecture decisions, file
  structure, and constitution compliance. Bridges specification (WHAT) to
  tasks (HOW).

WHEN USED:
  - By /sdd:plan command when creating implementation plans
  - After spec is created and approved
  - Sets technical context for the entire feature

CUSTOMIZATION:
  - Add project-specific technical context fields
  - Customize complexity tracking for your constitution
  - Add architecture decision sections relevant to your domain
  - Override by creating .sdd/templates/plan-template.md in your repo

LEARN MORE:
  See plugins/sdd/skills/sdd-infrastructure/references/template-guide.md
  for detailed documentation and examples.

==============================================================================
-->

# Implementation Plan: Electron UI

**Branch**: `001-electron-ui` | **Date**: 2026-02-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-electron-ui/spec.md`

**Note**: This template is filled in by the `/sdd:plan` command. See plugins/sdd/commands/plan.md for the execution workflow.

## Summary

Implement the Electron UI for Paige — the entire demo surface and user-facing experience. This is a thin-client desktop application that renders coaching interactions while maintaining strict architectural separation: no AI logic, no filesystem access, no state ownership. All data flows through WebSocket communication with the backend. The UI provides a familiar IDE experience (Monaco Editor, xterm.js terminal, file tree with hint decorations) enhanced by a distinctive warm visual identity (terracotta accents, spring animations, ASCII aesthetic) that makes the coaching system compelling in the 3-minute demo video.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20.x LTS
**Primary Dependencies**:
  - **Electron**: Desktop application framework (Chromium + Node.js)
  - **React 18**: UI rendering with hooks, strict mode
  - **@monaco-editor/react**: Code editor component (VS Code engine)
  - **xterm.js**: Terminal emulator (ANSI colors, PTY via node-pty)
  - **react-arborist**: Virtualized file tree with keyboard navigation
  - **Framer Motion**: Spring physics animations for transitions
  - **@floating-ui/react**: Comment balloon positioning
  - **react-toastify**: Unanchored editor notifications
  - **vscode-icons**: File type icons for tree
  - **WebSocket (native)**: Backend communication (singleton client)

**Storage**: N/A (thin client - backend owns all state via WebSocket)
**Testing**: NEEDS CLARIFICATION (Vitest vs Jest for React + Electron, Playwright for E2E)
**Target Platform**:
  - **Primary**: macOS (hiddenInset titlebar, traffic lights)
  - **Secondary**: Windows/Linux (standard Electron frame)
  - **Runtime**: Electron 28+ (Chromium 120+, Node.js 20)

**Project Type**: Frontend desktop application (Electron + React)
**Performance Goals**:
  - 60fps smooth animations (spring transitions, glow effects)
  - Large file support (>1MB handled natively by Monaco)
  - Virtualized tree rendering (500+ files performant)
  - Debounced WebSocket updates (300ms edits, 200ms scroll)

**Constraints**:
  - **Thin Client**: Zero AI logic, zero filesystem access, zero state ownership
  - **WebSocket-Only**: All backend communication via message protocol (51 types)
  - **Read-Only Enforcement**: Frontend never writes files (architecture principle)
  - **Single Window**: No multi-window, no DnD between windows
  - **Demo-First**: All decisions pass "How does this look in 3-min video?"

**Scale/Scope**:
  - Single user, local development machine
  - 10 user stories (Dashboard, IDE shell, Monaco editor, file tree, terminal, coaching sidebar, hints, WebSocket client, visual identity, placeholder)
  - 51 WebSocket message types (28 server→client, 23 client→server)
  - ~15 React components (App, Dashboard, IDE, Editor, Terminal, FileTree, Sidebar, Hints, etc.)
  - ~8 services (WebSocket, editor state, decoration manager, theme, debouncer, etc.)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS (all gates satisfied or justified)

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| **I. Read-Only Is Sacred** | Electron MUST NOT write, edit, or create files directly | ✅ PASS | Frontend uses WebSocket for all file ops. Backend owns all I/O. |
| **II. Demo-First Development** | Feature must be demo-visible and polished for 3-min video | ✅ PASS | Electron UI IS the entire demo surface. All 10 stories directly visible. |
| **III. KISS** | Design decisions explainable in one sentence | ✅ PASS | Thin client that renders backend data via WebSocket. |
| **V. Three-Tier Separation** | Electron = Face (rendering only, no AI logic, no state) | ✅ PASS | Zero AI logic. State owned by backend. WebSocket for all data. |
| **VI. Leverage Existing Components** | Use established libraries (Monaco, xterm.js, etc.) | ✅ PASS | All major components use battle-tested libraries per spec. |
| **VII. Contract-Driven Integration** | WebSocket message protocol fully defined | ⚠️ PENDING | 51 message types specified in spec. Contracts/ will formalize in Phase 1. |
| **VIII. Backend Is Single Source of Truth** | No frontend state ownership | ✅ PASS | All state via WebSocket. No local cache, no direct filesystem. |
| **X. Predictable UX** | Standard shortcuts, familiar behavior | ✅ PASS | Monaco = VS Code, xterm.js = terminal, standard Cmd+S/W/P shortcuts. |
| **Testing** | Happy path automated tests for all user-facing workflows | ⚠️ PENDING | Test framework TBD in Phase 0 (Vitest vs Jest). Tests written in Phase 3+. |
| **Code Style** | TypeScript strict mode, zero warnings allowed | ✅ PASS | `strict: true` in tsconfig.json. ESLint + Prettier enforced. |
| **Commit Discipline** | Conventional commits, <300 chars, <5 bullets | ✅ PASS | Will follow `feat(ui): subject` format. |

**Pre-Phase 0 Verdict**: ✅ **PROCEED** — Two items pending (WebSocket contracts formalization, test framework selection) are expected outputs of planning phases. No blockers.

**Post-Phase 1 Re-Check**: [To be filled after Phase 1 design artifacts complete]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/sdd:plan command output)
├── research.md          # Phase 0 output (/sdd:plan command)
├── data-model.md        # Phase 1 output (/sdd:plan command)
├── quickstart.md        # Phase 1 output (/sdd:plan command)
├── contracts/           # Phase 1 output (/sdd:plan command)
└── tasks.md             # Phase 2 output (/sdd:tasks command - NOT created by /sdd:plan)
```

### Source Code (repository root)

```text
electron-ui/                      # Electron desktop application
├── src/                          # Main process (Electron backend)
│   ├── main.ts                   # Electron entry point, window creation
│   ├── preload.ts                # IPC bridge (renderer ↔ main)
│   ├── pty/                      # PTY management for terminal
│   │   ├── pty-manager.ts        # Spawn, resize, write to PTY
│   │   └── pty-service.ts        # IPC handlers for terminal
│   └── ipc/                      # IPC handlers
│       └── terminal-handlers.ts  # Terminal IPC (spawn, resize, write)
│
├── renderer/                     # Renderer process (React frontend)
│   ├── src/
│   │   ├── App.tsx               # Root component, routing
│   │   ├── main.tsx              # React entry point
│   │   │
│   │   ├── views/                # Top-level views
│   │   │   ├── Dashboard.tsx     # Home screen with 6 sections
│   │   │   ├── IDE.tsx           # 5-panel workspace layout
│   │   │   └── Placeholder.tsx   # Coming Soon page
│   │   │
│   │   ├── components/           # Reusable React components
│   │   │   ├── AppShell.tsx      # Header + layout wrapper
│   │   │   ├── Editor/           # Monaco editor + tabs
│   │   │   │   ├── Editor.tsx    # Monaco wrapper, decorations
│   │   │   │   ├── EditorTabs.tsx # Tab management, dirty state
│   │   │   │   ├── StatusBar.tsx # Breadcrumb, cursor, Review button
│   │   │   │   └── FloatingExplainButton.tsx # Selection → explain
│   │   │   ├── FileExplorer/     # File tree with hints
│   │   │   │   ├── FileTree.tsx  # react-arborist wrapper
│   │   │   │   └── HintGlow.tsx  # Glow effect component
│   │   │   ├── Terminal/         # xterm.js terminal
│   │   │   │   └── Terminal.tsx  # xterm.js + FitAddon + IPC
│   │   │   ├── Sidebar/          # Coaching sidebar
│   │   │   │   ├── Sidebar.tsx   # Container, collapse logic
│   │   │   │   ├── IssueContext.tsx # Issue card, labels, summary
│   │   │   │   ├── HintSlider.tsx # 4-level slider + illustrations
│   │   │   │   └── PhaseStepper.tsx # Vertical stepper, accordion
│   │   │   ├── Hints/            # Hinting system
│   │   │   │   ├── CommentBalloon.tsx # @floating-ui anchored
│   │   │   │   ├── CollapsedIcon.tsx # Level 0-1 placeholder
│   │   │   │   └── EditorToast.tsx # react-toastify wrapper
│   │   │   └── Dashboard/        # Dashboard sections
│   │   │       ├── DreyfusRadar.tsx # Spider chart
│   │   │       ├── StatsBento.tsx # 6-card grid + period switcher
│   │   │       ├── InProgressTasks.tsx # Task cards
│   │   │       ├── GitHubIssues.tsx # Issue cards, zoom trigger
│   │   │       ├── PracticeChallenges.tsx # Challenge cards
│   │   │       └── LearningMaterials.tsx # Material cards
│   │   │
│   │   ├── services/             # Business logic
│   │   │   ├── websocket-client.ts # Singleton WebSocket, reconnect
│   │   │   ├── editor-state.ts   # Open tabs, dirty tracking
│   │   │   ├── decoration-manager.ts # Monaco decorations by level
│   │   │   ├── hint-manager.ts   # Filter/apply hints by level
│   │   │   ├── review-navigation.ts # Review comment ◀/▶ logic
│   │   │   └── debouncer.ts      # Debounce utilities (300ms, 200ms)
│   │   │
│   │   ├── hooks/                # Custom React hooks
│   │   │   ├── useWebSocket.ts   # WebSocket connection hook
│   │   │   ├── useHintLevel.ts   # Hint level state + slider sync
│   │   │   ├── useKeyboardShortcuts.ts # Cmd+S/W/P/Shift+H/[/]
│   │   │   └── useDebounce.ts    # Generic debounce hook
│   │   │
│   │   ├── styles/               # Global styles + design tokens
│   │   │   ├── design-tokens.css # CSS custom properties (colors, springs)
│   │   │   ├── typography.css    # JetBrains Mono, scale
│   │   │   ├── animations.css    # Spring presets, ASCII treatments
│   │   │   └── global.css        # Resets, base styles
│   │   │
│   │   └── utils/                # Utilities
│   │       ├── message-validator.ts # WebSocket payload validation
│   │       ├── theme.ts          # Monaco theme "Paige Dark"
│   │       └── color-utils.ts    # Auto-contrast for labels
│   │
│   ├── index.html                # HTML entry point
│   └── vite.config.ts            # Vite bundler config
│
├── shared/                       # Shared types (main + renderer)
│   └── types/
│       ├── websocket-messages.ts # 51 message type definitions
│       ├── entities.ts           # Phase, IssueContext, CoachingMessage, etc.
│       └── decorations.ts        # EditorDecoration, ExplorerHint types
│
├── tests/                        # Test suites
│   ├── unit/                     # Component + service unit tests
│   │   ├── services/             # WebSocket, decorations, hints
│   │   └── components/           # React component tests
│   ├── integration/              # Multi-component workflows
│   │   ├── editor-workflow.test.ts # Open → edit → save
│   │   ├── hint-workflow.test.ts # Level change → update UI
│   │   └── review-workflow.test.ts # Review → navigate → dismiss
│   └── e2e/                      # End-to-end Playwright tests
│       ├── dashboard.spec.ts     # Dashboard → IDE zoom
│       ├── editor.spec.ts        # Full editor workflow
│       └── terminal.spec.ts      # Terminal interaction
│
├── assets/                       # Static assets
│   ├── illustrations/            # SVG illustrations (hint levels, placeholder)
│   └── icons/                    # App icons (macOS, Windows, Linux)
│
├── package.json                  # Dependencies, scripts
├── tsconfig.json                 # TypeScript config (strict mode)
├── .eslintrc.json                # ESLint config
├── .prettierrc.json              # Prettier config
└── electron-builder.json         # Electron packaging config
```

**Structure Decision**: **Electron desktop application** with standard two-process architecture:
- **Main process** (`src/`): Electron backend, window management, PTY handling, IPC
- **Renderer process** (`renderer/`): React frontend, Monaco editor, xterm.js, UI components
- **Shared** (`shared/`): TypeScript types shared between processes (WebSocket protocol, entities)

This separates privileged operations (PTY, IPC) from UI rendering, enabling independent testing and clear responsibility boundaries. The renderer is a pure React SPA that communicates with the backend via WebSocket (not IPC—IPC is only for PTY↔terminal bridging).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Status**: ✅ **No violations** — All constitution principles satisfied. No complexity justifications needed.

---

## Implementation Strategies

This section documents key implementation patterns and design decisions for critical subsystems. These strategies resolve ambiguities identified during spec analysis and provide concrete guidance for Phase 3+ implementation.

### WebSocket Correlation Strategy

**Pattern**: Request/Response with Backend-Generated IDs

**Problem**: Multiple async operations (file:open, file:save, user:explain) require correlation between requests and responses to handle out-of-order delivery.

**Solution**:
1. Backend generates UUID v4 `id` field on messages that expect responses
2. Client copies `id` to correlation store: `Map<requestId, {resolve, reject, timeout}>`
3. Client sends request with `id` field
4. Backend includes same `id` in response
5. Client matches response `id` to pending operation, calls resolve/reject

**Message Types Requiring Correlation**:
- `file:open` → `buffer:content` (id required)
- `file:save` → `save:ack` (id required)
- `user:explain` → `coaching:message` (id optional, may be streaming)
- `user:review` → `coaching:review_result` (id required for navigation)

**Implementation**:
```typescript
// websocket-client.ts
class WebSocketClient {
  private correlations = new Map<string, PendingOperation>();

  async send(type: string, payload: any): Promise<any> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.correlations.set(id, { resolve, reject, timeout: setTimeout(() => {
        this.correlations.delete(id);
        reject(new Error(`Request timeout: ${type}`));
      }, 30000) });
      this.ws.send(JSON.stringify({ type, id, ...payload }));
    });
  }

  private handleMessage(msg: WebSocketMessage) {
    if (msg.id && this.correlations.has(msg.id)) {
      const { resolve, timeout } = this.correlations.get(msg.id)!;
      clearTimeout(timeout);
      this.correlations.delete(msg.id);
      resolve(msg);
    } else {
      // Handle broadcast messages (no correlation)
      this.emit(msg.type, msg);
    }
  }
}
```

### PTY Lifecycle Management

**Problem**: Terminal PTY process lifecycle not specified (when to spawn, when to kill, error handling).

**Solution**:
1. **Spawn Trigger**: On `session:start` WebSocket message, main process spawns PTY with shell
2. **Sizing**: FitAddon calculates initial cols/rows, `fit()` called on resize
3. **Input**: User typing and observer nudges both write to PTY stdin (sequential, no special priority)
4. **Persistence**: PTY lives for entire session, survives WebSocket disconnect (user can keep typing)
5. **Termination**: Killed on `session:end` or app quit
6. **Error Handling**:
   - Shell crash → Show "Process exited with code X" in terminal, PTY cannot be respawned until new session
   - Permission denied → Show "Permission denied" toast, terminal read-only

**Implementation** (src/main/pty/pty-manager.ts):
```typescript
class PTYManager {
  private pty: IPty | null = null;

  spawn(shell: string, cwd: string, env: Record<string, string>): void {
    if (this.pty) this.kill();

    try {
      this.pty = spawn(shell, [], { cwd, env, cols: 80, rows: 24 });
      this.pty.onData(data => this.emit('data', data));
      this.pty.onExit(({ exitCode }) => {
        this.emit('exit', exitCode);
        this.pty = null;
      });
    } catch (err) {
      this.emit('error', err.message);
    }
  }

  resize(cols: number, rows: number): void {
    this.pty?.resize(cols, rows);
  }

  write(data: string): void {
    this.pty?.write(data);
  }

  kill(): void {
    this.pty?.kill();
    this.pty = null;
  }
}
```

### Session State Recovery on Reconnect

**Problem**: If user has unsaved edits when WebSocket disconnects, `session:restore` may overwrite local changes.

**Solution**: Merge Strategy with Dirty Tab Detection
1. On disconnect, show toast "Save interrupted, disconnected. Attempting to reconnect..."
2. Track dirty tabs locally: `Map<path, { content, isDirty }>`
3. On reconnect:
   - Send `connection:ready`
   - Check for dirty tabs
   - If dirty tabs exist, send `file:save` for each dirty tab (re-save)
   - Wait for `save:ack` for all dirty tabs
   - Then process `session:restore` from backend (safe to apply now)
4. Restoration order (after dirty tabs saved):
   - (1) Current active tab file content
   - (2) Cursor position
   - (3) Scroll position
   - (4) Hint level
   - (5) Queued operations

**Implementation** (websocket-client.ts):
```typescript
async onReconnect() {
  const dirtyTabs = this.getOpenTabs().filter(t => t.isDirty);

  if (dirtyTabs.length > 0) {
    // Re-save dirty tabs
    await Promise.all(
      dirtyTabs.map(tab => this.send('file:save', { path: tab.path, content: tab.content }))
    );
  }

  // Now safe to restore session
  this.send('connection:ready');
}
```

### Phase Transition Behavior

**Problem**: Unclear if phase transitions block editing or are user-initiated.

**Solution**: Backend-Only, Non-Blocking
- Phase transitions are **backend-initiated only** (no user interaction with phase stepper)
- Triggers: AI coaching decision (not defined for MVP, backend controls)
- Effect:
  - Backend sends `coaching:clear_all` → Frontend clears all coaching balloons and decorations
  - Backend sends `phase:transition` → Frontend updates phase stepper UI (checkmark fills, pulse animation)
  - Backend sends new coaching hints (via `coaching:message`) → Frontend renders at current hint level
  - Review comments persist across phase transitions (not cleared)
- Does NOT block editor or terminal (user can keep working during transition)

**UI Behavior**:
- Phase stepper is read-only display (no click handlers)
- Transition animation: checkmark fills (300ms) → line fills (400ms) → pulse (200ms) → expand next phase (300ms)

### Debouncer Service Design

**Problem**: Multiple debounced events (edits 300ms, scroll 200ms, hint level 200ms) need consistent implementation.

**Solution**: Reusable Debounce Hook + Service

**Implementation**:
```typescript
// renderer/src/utils/debouncer.ts
export const debounce = <T extends any[]>(fn: (...args: T) => void, ms: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: T) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
};

// renderer/src/hooks/useDebounce.ts
export const useDebounce = <T>(value: T, ms: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), ms);
    return () => clearTimeout(handler);
  }, [value, ms]);

  return debouncedValue;
};
```

**Debounce Configuration**:
- `buffer:update`: 300ms trailing, 5s max-wait (force send if >5s continuous typing)
- `editor:scroll`: 200ms trailing, no max-wait
- `hints:level_change`: 200ms trailing, no max-wait
- `user:idle_start`: 5000ms (single timeout)

**Flush Behavior**:
- Auto-flush on `file:save`, `session:end`, window unload
- All debounced operations send immediately before app closes

### Floating UI Middleware Stack

**Problem**: Comment balloon positioning strategy undefined (which middleware, collision handling).

**Solution**: Standard Floating UI Pattern with Shift + Flip + Size

**Implementation** (CommentBalloon.tsx):
```typescript
import { useFloating, flip, shift, size } from '@floating-ui/react';

const { refs, floatingStyles, isPositioned } = useFloating({
  placement: 'right',
  middleware: [
    flip(), // Flip to left if no space on right
    shift({ padding: 8 }), // Shift up/down to avoid overflow
    size({ padding: 8 }) // Shrink if too tall for viewport
  ],
});

// Only render if anchor is visible
if (!isPositioned) return null;
```

**Collision Handling**:
- If multiple balloons would overlap, stack vertically with 8px gaps
- Priority: Oldest balloon wins position, newer balloons stack below
- Arrow: CSS border-trick (no SVG) for simplicity
- Off-screen: Hide balloon if anchor scrolls out of viewport

### Error Handling UI Treatment

**Problem**: Error message types defined but UI treatment not specified.

**Solution**: Error Type → UI Mapping

| Error Type | Toast Color | Duration | Tab Behavior | Action |
|------------|-------------|----------|--------------|--------|
| `error:file_not_found` | Red (#e05252) | 5s | Show red error banner in editor, tab remains open | User can copy/export content, close tab manually |
| `error:permission_denied` | Yellow (#d4a843) | 5s | Show yellow warning banner, tab remains open as read-only | No editing allowed, save button disabled |
| `error:general` | Orange (#d97757) | 3s | No tab changes | Details logged to console for debugging |
| Unknown WebSocket message types | (none) | N/A | Logged to console, ignored | No user-facing error (graceful degradation) |
| Malformed WebSocket payloads | (none) | N/A | Logged with payload sample, ignored | No user-facing error |

**Implementation**:
```typescript
// error-handler.ts
export function handleError(error: ErrorMessage) {
  switch (error.code) {
    case 'file_not_found':
      toast.error(error.message, { duration: 5000 });
      updateTabState(error.path, { error: { code: error.code, message: error.message } });
      break;
    case 'permission_denied':
      toast.warning(error.message, { duration: 5000 });
      updateTabState(error.path, { error: { code: error.code, message: error.message }, readOnly: true });
      break;
    case 'general':
      toast.error(error.message, { duration: 3000 });
      console.error('[Backend Error]', error);
      break;
    default:
      console.warn('[Unknown Error]', error);
  }
}
```

---

## Phase 0: Research Artifacts

**Status**: ✅ **Complete** (2026-02-11)

**Output**: [`research.md`](./research.md)

**Research Completed**:
1. ✅ Test framework selection (Vitest vs Jest) → **Vitest** selected
2. ✅ E2E testing strategy (Playwright with Electron)
3. ✅ Monaco Editor best practices (decorations, themes, performance)
4. ✅ xterm.js + node-pty integration (PTY → IPC → Renderer)
5. ✅ WebSocket reconnection strategy (exponential backoff)
6. ✅ React + Framer Motion spring presets

**Key Decisions**:
- **Vitest** for testing (fast, ESM-native, Jest-compatible)
- **Playwright** for E2E (official Electron support)
- **Monaco deltaDecorations** API for efficient updates
- **IPC bridge** pattern for PTY (contextBridge for security)
- **Exponential backoff** (1s → 30s cap, infinite retries)
- **4 named spring presets** (gentle, expressive, snappy, bouncy)

All technical unknowns from Technical Context resolved. No blockers for Phase 1.

---

## Phase 1: Design Artifacts

**Status**: ✅ **Complete** (2026-02-11)

**Outputs**:
- [`data-model.md`](./data-model.md) — 10 entities with attributes, relationships, state transitions
- [`contracts/websocket-protocol.md`](./contracts/websocket-protocol.md) — 51 WebSocket message types
- [`quickstart.md`](./quickstart.md) — Developer getting started guide
- [`CLAUDE.md`](../../CLAUDE.md) — Updated with tech stack and commands

**Entities Defined** (10 total):
1. WebSocketMessage (envelope)
2. TreeNode (file explorer)
3. Phase (coaching progression)
4. IssueContext (GitHub issue)
5. CoachingMessage (hints/guidance)
6. EditorDecoration (Monaco visuals)
7. ExplorerHint (file tree glow)
8. TabState (editor tabs)
9. SessionState (global session)
10. ReviewComment (review navigation)

**Contracts**:
- 28 server→client message types
- 23 client→server message types
- All payloads fully typed with TypeScript interfaces

**Agent Context Updated**:
- Tech stack documented in CLAUDE.md
- Development commands listed
- Recent changes logged

---

## Phase 2: Development Environment Setup

**Status**: ✅ **Complete** (2026-02-11)

**Approach**: This section documents the tooling strategy. The actual setup is performed in **tasks.md Phase 1 (Setup)** which includes all tooling configuration: TypeScript, ESLint, Prettier, Vitest, husky, lint-staged, and project structure. Phase 1 tasks (T001-T064) implement everything defined here.

### Tooling Strategy

**TypeScript Configuration** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-jsx"
  }
}
```

**ESLint Configuration** (`.eslintrc.json`):
- **Extends**: `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `plugin:react/recommended`, `plugin:react-hooks/recommended`
- **Rules**: Zero warnings allowed (per constitution)
- **Parser**: `@typescript-eslint/parser`

**Prettier Configuration** (`.prettierrc.json`):
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

**Vitest Configuration** (`vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom', // For React component tests
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov']
    }
  }
});
```

**Git Hooks** (husky + lint-staged):
- **Pre-commit**: Run ESLint on staged files, run Prettier, fail if errors
- **Pre-push**: Run tests (unit + integration only, E2E too slow)

**Package Scripts** (`package.json`):
```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"electron .\"",
    "build": "tsc && vite build && electron-builder",
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\"",
    "typecheck": "tsc --noEmit"
  }
}
```

### Dependencies to Install

**Production**:
```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@monaco-editor/react": "^4.6.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "react-arborist": "^3.4.0",
    "framer-motion": "^10.16.0",
    "@floating-ui/react": "^0.26.0",
    "react-toastify": "^9.1.0",
    "vscode-icons-js": "^11.6.1",
    "node-pty": "^1.0.0"
  }
}
```

**Development**:
```json
{
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "electron-builder": "^24.9.0",
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@playwright/test": "^1.40.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "eslint-plugin-react": "^7.33.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "prettier": "^3.1.0",
    "husky": "^8.0.0",
    "lint-staged": "^15.2.0",
    "concurrently": "^8.2.0"
  }
}
```

### Validation Checklist (for implementer)

When setting up the project, run these commands to validate:

1. ✅ **Dependencies installed**: `npm install` succeeds
2. ✅ **TypeScript compiles**: `npm run typecheck` passes with zero errors
3. ✅ **Linting passes**: `npm run lint` shows zero warnings/errors
4. ✅ **Formatting correct**: `npm run format:check` passes
5. ✅ **Tests run**: `npm test` executes (even if no tests yet)
6. ✅ **Dev server starts**: `npm run dev` launches Electron window
7. ✅ **Git hooks work**: `git commit` triggers lint-staged

### Constitution Compliance

- ✅ **TypeScript strict mode**: Enabled (`strict: true`)
- ✅ **Zero warnings**: ESLint configured to treat warnings as errors
- ✅ **Pre-commit hooks**: husky + lint-staged enforces quality
- ✅ **Happy path tests**: Vitest configured and ready for test writing

### Next Steps for Implementation

1. Create `electron-ui/` directory in repository root
2. Run `npm init -y` and install dependencies listed above
3. Create configuration files (`tsconfig.json`, `.eslintrc.json`, etc.)
4. Set up git hooks with `npx husky-init && npm install`
5. Configure lint-staged in `package.json`
6. Validate setup with checklist above
7. Begin Story 1 implementation (Visual Identity & Design System)

---

## Post-Phase 1 Constitution Re-Check

**Status**: ✅ **PASS** — All gates remain satisfied

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| **VII. Contract-Driven Integration** | WebSocket message protocol fully defined | ✅ PASS | 51 message types documented in contracts/ |
| **Testing** | Happy path automated tests for all user-facing workflows | ✅ READY | Vitest configured, tests to be written during implementation |

**Verdict**: ✅ **APPROVED FOR IMPLEMENTATION** — All planning phases complete, no blockers.

---

## Planning History

| Date | Phase | Milestone |
|------|-------|-----------|
| 2026-02-11 | Phase 0 | Research complete (6 questions resolved) |
| 2026-02-11 | Phase 1 | Design artifacts complete (data model, contracts, quickstart) |
| 2026-02-11 | Phase 2 | Dev environment strategy documented |

**Planning Complete**: ✅ Ready for `/sdd:tasks` command to generate implementation tasks.
