# Terminal & Coaching Panel Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two rendering bugs — the terminal "Unknown message type" error and the coaching panel stuck on "Waiting for session..."

**Architecture:** Backend-only changes. Add missing terminal message types/schemas/handlers to the WebSocket layer, and send a `session:start` message after planning completes so the coaching sidebar populates.

**Tech Stack:** TypeScript, Zod, Vitest, WebSocket handlers

---

### Task 1: Add terminal message types to backend

**Files:**
- Modify: `src/types/websocket.ts:221-227` (after `TerminalCommandData`)
- Modify: `src/types/websocket.ts:724-727` (after `TerminalCommandMessage`)
- Modify: `src/types/websocket.ts:770-798` (`ClientToServerMessage` union)

**Step 1: Add terminal data interfaces**

Add after `TerminalCommandData` (line 223):

```typescript
export interface TerminalReadyData {
  readonly cols: number;
  readonly rows: number;
}

export interface TerminalResizeData {
  readonly cols: number;
  readonly rows: number;
}

export interface TerminalInputData {
  readonly data: string;
}
```

**Step 2: Add terminal message interfaces**

Add after `TerminalCommandMessage` (line 727):

```typescript
export interface TerminalReadyMessage {
  readonly type: 'terminal:ready';
  readonly data: TerminalReadyData;
}

export interface TerminalResizeMessage {
  readonly type: 'terminal:resize';
  readonly data: TerminalResizeData;
}

export interface TerminalInputMessage {
  readonly type: 'terminal:input';
  readonly data: TerminalInputData;
}
```

**Step 3: Add to ClientToServerMessage union**

Add after `TerminalCommandMessage` in the union (line 790):

```typescript
  | TerminalReadyMessage
  | TerminalResizeMessage
  | TerminalInputMessage
```

**Step 4: Run typecheck**

Run: `cd /Users/aaronbassett/Projects/paige && pnpm typecheck`
Expected: PASS (new types are additive)

**Step 5: Commit**

```bash
git add src/types/websocket.ts
git commit -m "feat(ws): add terminal:ready, terminal:resize, terminal:input types"
```

---

### Task 2: Add terminal Zod schemas

**Files:**
- Modify: `src/websocket/schemas.ts:122-124` (after `terminalCommandDataSchema`)
- Modify: `src/websocket/schemas.ts:177-207` (`messageDataSchemas` object)

**Step 1: Write failing test**

Add to `tests/unit/websocket-validation.test.ts`:

```typescript
it('should validate terminal:ready with correct schema', () => {
  const validMessage = {
    type: 'terminal:ready',
    data: { cols: 80, rows: 24 },
  };
  const result = validateClientMessage(validMessage);
  expect(result.type).toBe('terminal:ready');
  expect(result.data).toEqual({ cols: 80, rows: 24 });
});

it('should reject terminal:ready with missing fields', () => {
  const invalidMessage = {
    type: 'terminal:ready',
    data: { cols: 80 },
  };
  expect(() => validateClientMessage(invalidMessage)).toThrow(ZodError);
});

it('should validate terminal:resize with correct schema', () => {
  const validMessage = {
    type: 'terminal:resize',
    data: { cols: 120, rows: 40 },
  };
  const result = validateClientMessage(validMessage);
  expect(result.type).toBe('terminal:resize');
  expect(result.data).toEqual({ cols: 120, rows: 40 });
});

it('should validate terminal:input with correct schema', () => {
  const validMessage = {
    type: 'terminal:input',
    data: { data: 'ls -la\n' },
  };
  const result = validateClientMessage(validMessage);
  expect(result.type).toBe('terminal:input');
  expect(result.data).toEqual({ data: 'ls -la\n' });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/aaronbassett/Projects/paige && pnpm vitest run tests/unit/websocket-validation.test.ts`
Expected: FAIL — `terminal:ready` passes envelope validation but data isn't validated (passes as unknown type)

**Step 3: Add Zod schemas**

Add after `terminalCommandDataSchema` (line 124) in `src/websocket/schemas.ts`:

```typescript
const terminalReadyDataSchema = z.object({
  cols: z.number(),
  rows: z.number(),
});

const terminalResizeDataSchema = z.object({
  cols: z.number(),
  rows: z.number(),
});

const terminalInputDataSchema = z.object({
  data: z.string(),
});
```

Then add to the `messageDataSchemas` object (after the `'terminal:command'` entry):

```typescript
  'terminal:ready': terminalReadyDataSchema,
  'terminal:resize': terminalResizeDataSchema,
  'terminal:input': terminalInputDataSchema,
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/aaronbassett/Projects/paige && pnpm vitest run tests/unit/websocket-validation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/websocket/schemas.ts tests/unit/websocket-validation.test.ts
git commit -m "feat(ws): add Zod schemas for terminal:ready, resize, input"
```

---

### Task 3: Create terminal handler with state tracking

**Files:**
- Create: `src/websocket/handlers/terminal.ts`

**Step 1: Write failing test**

Create `tests/unit/websocket/handlers/terminal.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket as WsWebSocket } from 'ws';

// ── Mock dependencies BEFORE imports ──────────────────────────────────────────

vi.mock('../../../../src/websocket/server.js', () => ({
  sendToClient: vi.fn(),
  broadcast: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  handleTerminalReady,
  handleTerminalResize,
  handleTerminalInput,
  getTerminalState,
} from '../../../../src/websocket/handlers/terminal.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_WS = {} as WsWebSocket;
const CONNECTION_ID = 'conn-terminal-1';

describe('terminal handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleTerminalReady', () => {
    it('should store terminal dimensions and ready state', () => {
      handleTerminalReady(FAKE_WS, { cols: 80, rows: 24 }, CONNECTION_ID);

      const state = getTerminalState(CONNECTION_ID);
      expect(state).toEqual({
        ready: true,
        cols: 80,
        rows: 24,
      });
    });
  });

  describe('handleTerminalResize', () => {
    it('should update terminal dimensions', () => {
      handleTerminalReady(FAKE_WS, { cols: 80, rows: 24 }, CONNECTION_ID);
      handleTerminalResize(FAKE_WS, { cols: 120, rows: 40 }, CONNECTION_ID);

      const state = getTerminalState(CONNECTION_ID);
      expect(state).toEqual({
        ready: true,
        cols: 120,
        rows: 40,
      });
    });
  });

  describe('handleTerminalInput', () => {
    it('should not throw', () => {
      expect(() => {
        handleTerminalInput(FAKE_WS, { data: 'ls\n' }, CONNECTION_ID);
      }).not.toThrow();
    });
  });

  describe('getTerminalState', () => {
    it('should return null for unknown connections', () => {
      expect(getTerminalState('unknown-conn')).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/aaronbassett/Projects/paige && pnpm vitest run tests/unit/websocket/handlers/terminal.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the terminal handler**

Create `src/websocket/handlers/terminal.ts`:

```typescript
/**
 * WebSocket handlers for terminal lifecycle messages.
 *
 * Tracks basic terminal state (ready, dimensions) per connection.
 * The actual PTY runs in the Electron main process — these handlers
 * just let the backend know about terminal status for the Observer.
 */

import type { WebSocket as WsWebSocket } from 'ws';
import type { TerminalReadyData, TerminalResizeData, TerminalInputData } from '../../types/websocket.js';

// ── In-Memory Terminal State ─────────────────────────────────────────────────

interface TerminalState {
  ready: boolean;
  cols: number;
  rows: number;
}

/** Per-connection terminal state. */
const terminalStates = new Map<string, TerminalState>();

// ── Handlers ────────────────────────────────────────────────────────────────

export function handleTerminalReady(
  _ws: WsWebSocket,
  data: unknown,
  connectionId: string,
): void {
  const { cols, rows } = data as TerminalReadyData;
  terminalStates.set(connectionId, { ready: true, cols, rows });
}

export function handleTerminalResize(
  _ws: WsWebSocket,
  data: unknown,
  connectionId: string,
): void {
  const { cols, rows } = data as TerminalResizeData;
  const existing = terminalStates.get(connectionId);
  if (existing) {
    existing.cols = cols;
    existing.rows = rows;
  } else {
    terminalStates.set(connectionId, { ready: true, cols, rows });
  }
}

export function handleTerminalInput(
  _ws: WsWebSocket,
  _data: unknown,
  _connectionId: string,
): void {
  // No-op for basic state tracking.
  // Future: track command patterns for Observer.
}

// ── Query API ───────────────────────────────────────────────────────────────

/** Returns terminal state for a connection, or null if not ready. */
export function getTerminalState(connectionId: string): TerminalState | null {
  return terminalStates.get(connectionId) ?? null;
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/aaronbassett/Projects/paige && pnpm vitest run tests/unit/websocket/handlers/terminal.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/websocket/handlers/terminal.ts tests/unit/websocket/handlers/terminal.test.ts
git commit -m "feat(ws): add terminal handler with basic state tracking"
```

---

### Task 4: Register terminal handlers in the router

**Files:**
- Modify: `src/websocket/router.ts:1-10` (imports)
- Modify: `src/websocket/router.ts:67-102` (handler registry)

**Step 1: Add import**

Add to the imports in `src/websocket/router.ts`:

```typescript
import { handleTerminalReady, handleTerminalResize, handleTerminalInput } from './handlers/terminal.js';
```

**Step 2: Replace the terminal:command stub and add new entries**

In the handlers Map, replace the existing `terminal:command` stub line (97) and add the three new entries:

```typescript
  ['terminal:ready', handleTerminalReady],
  ['terminal:resize', handleTerminalResize],
  ['terminal:input', handleTerminalInput],
  ['terminal:command', notImplementedHandler('terminal:command')],
```

**Step 3: Add terminal messages to SESSION_TOUCH set**

Terminal messages are high-frequency and only need a lightweight session touch. Add to `SESSION_TOUCH` (line 110-114):

```typescript
const SESSION_TOUCH: ReadonlySet<string> = new Set([
  'buffer:update',
  'editor:tab_switch',
  'editor:selection',
  'terminal:input',
  'terminal:resize',
]);
```

Also add `terminal:ready` to `SESSION_EXEMPT` since it fires before session setup:

```typescript
const SESSION_EXEMPT: ReadonlySet<string> = new Set([
  'connection:hello',
  'fs:request_tree',
  'terminal:ready',
]);
```

**Step 4: Run typecheck and full test suite**

Run: `cd /Users/aaronbassett/Projects/paige && pnpm typecheck && pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/websocket/router.ts
git commit -m "feat(ws): register terminal:ready, resize, input handlers in router"
```

---

### Task 5: Send session:start after planning completes

**Files:**
- Modify: `src/websocket/handlers/planning.ts:229-250` (after `planning:complete` send)

**Step 1: Write failing test**

Add to `tests/unit/websocket/handlers/planning.test.ts`. First read the existing test file to find the right spot, then add:

```typescript
it('should send session:start after planning:complete', async () => {
  // Set up the mock to capture the onComplete callback
  const mockRunPlanningAgent = vi.mocked(runPlanningAgent);
  let capturedOnComplete: ((plan: AgentPlanOutput) => void) | null = null;

  mockRunPlanningAgent.mockImplementation(async (input: PlanningAgentInput) => {
    capturedOnComplete = input.callbacks.onComplete;
  });

  // Trigger the handler
  handlePlanningStart(FAKE_WS, makeIssueData(), CONNECTION_ID);

  // Wait for async setup
  await vi.waitFor(() => expect(capturedOnComplete).not.toBeNull());

  // Simulate planning completion
  capturedOnComplete!(makePlanOutput());

  // Wait for the async handlePlanComplete to finish
  await vi.waitFor(() => {
    const calls = vi.mocked(sendToClient).mock.calls;
    return calls.length >= 3; // planning:started + planning:complete + session:start
  });

  const calls = vi.mocked(sendToClient).mock.calls;
  const sessionStartCall = calls.find(
    ([, msg]) => (msg as { type: string }).type === 'session:start',
  );

  expect(sessionStartCall).toBeDefined();
  const msg = sessionStartCall![1] as { type: string; data: unknown };
  expect(msg.type).toBe('session:start');

  const data = msg.data as {
    sessionId: string;
    issueContext: { number: number; title: string };
    phases: unknown[];
    initialHintLevel: number;
  };
  expect(data.sessionId).toBe(CONNECTION_ID);
  expect(data.issueContext.number).toBe(42);
  expect(data.phases).toHaveLength(2);
  expect(data.initialHintLevel).toBe(0);
});
```

Note: You may need to reference existing test helpers (`makeIssueData`, `makePlanOutput`) from the file. Read the full test file to see how `makePlanOutput` builds phases.

**Step 2: Run test to verify it fails**

Run: `cd /Users/aaronbassett/Projects/paige && pnpm vitest run tests/unit/websocket/handlers/planning.test.ts`
Expected: FAIL — session:start message not found in calls

**Step 3: Add session:start send to planning handler**

In `src/websocket/handlers/planning.ts`, in the `handlePlanComplete` function, add after the `sendToClient(connectionId, completeMessage ...)` call (line 250):

```typescript
  // Send session:start so CoachingSidebar populates with issue context + phases
  const sessionStartMessage = {
    type: 'session:start' as const,
    data: {
      sessionId: sessionIdStr,
      issueContext: {
        number: issue.number,
        title: issue.title,
        url: issue.url,
        labels: issue.labels.map((label) => ({ name: label, color: '#6b6960' })),
      },
      phases: phases.map((phase) => ({
        number: phase.number as 1 | 2 | 3 | 4 | 5,
        title: phase.title,
        status: phase.status === 'active' ? 'active' as const : 'pending' as const,
        summary: phase.description,
        steps: phase.tasks.map((task) => ({
          title: task.title,
          description: task.description,
        })),
      })),
      initialHintLevel: 0 as const,
    },
  };
  sendToClient(connectionId, sessionStartMessage as ServerToClientMessage);
```

The `sendToClient` function in `server.ts:192` automatically transforms `{ type, data }` to `{ type, payload, timestamp }` on the wire, which matches what the frontend's `CoachingSidebar` expects via `msg.payload.issueContext` and `msg.payload.phases`.

**Step 4: Run test to verify it passes**

Run: `cd /Users/aaronbassett/Projects/paige && pnpm vitest run tests/unit/websocket/handlers/planning.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/websocket/handlers/planning.ts tests/unit/websocket/handlers/planning.test.ts
git commit -m "feat(ws): send session:start after planning:complete for coaching sidebar"
```

---

### Task 6: Run full test suite and typecheck

**Files:** None (verification only)

**Step 1: Run typecheck**

Run: `cd /Users/aaronbassett/Projects/paige && pnpm typecheck`
Expected: PASS

**Step 2: Run full test suite**

Run: `cd /Users/aaronbassett/Projects/paige && pnpm test`
Expected: PASS

**Step 3: Run lint**

Run: `cd /Users/aaronbassett/Projects/paige && pnpm lint`
Expected: PASS (or only pre-existing warnings)

**Step 4: Commit any lint fixes if needed**

```bash
git add -A
git commit -m "chore: lint fixes for terminal and coaching panel changes"
```
