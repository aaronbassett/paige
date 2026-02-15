# Challenges PoC Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a chat-like challenge view where users solve coding katas with progressive constraints, using a mini Monaco editor as the message input.

**Architecture:** New `ChallengeView` full-screen view in the Electron UI, connected to the existing `practice:submit_solution` backend flow via WebSocket. One new backend WebSocket handler (`challenge:load`) to fetch full kata data. All challenge state is local to the view component.

**Tech Stack:** React 18, Monaco Editor, Framer Motion, WebSocket (existing infrastructure), TypeScript strict mode.

---

### Task 1: Add `challenge:load` WebSocket types to the backend

**Files:**
- Modify: `src/types/websocket.ts`

**Step 1: Add the new data interfaces**

Add these after `PracticeViewPreviousAttemptsData` (around line 212):

```ts
export interface ChallengeLoadData {
  readonly kataId: number;
}

export interface ChallengeLoadedData {
  readonly kataId: number;
  readonly title: string;
  readonly description: string;
  readonly scaffoldingCode: string;
  readonly constraints: readonly { readonly id: string; readonly description: string }[];
}

export interface ChallengeLoadErrorData {
  readonly error: string;
}
```

**Step 2: Add the message interfaces**

Add the client-to-server message interface alongside the other Practice messages (after `PracticeViewPreviousAttemptsMessage`):

```ts
export interface ChallengeLoadMessage {
  readonly type: 'challenge:load';
  readonly data: ChallengeLoadData;
}
```

Add it to the `ClientToServerMessage` union.

Add the server-to-client message interfaces alongside the other Practice messages (after `PracticePreviousAttemptsMessage`):

```ts
export interface ChallengeLoadedMessage {
  readonly type: 'challenge:loaded';
  readonly data: ChallengeLoadedData;
}

export interface ChallengeLoadErrorMessage {
  readonly type: 'challenge:load_error';
  readonly data: ChallengeLoadErrorData;
}
```

Add both to the `ServerToClientMessage` union.

**Step 3: Verify types compile**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/challenges && pnpm typecheck`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add src/types/websocket.ts
git commit -m "feat(ws): add challenge:load WebSocket message types"
```

---

### Task 2: Add `challenge:load` WebSocket handler to the backend

**Files:**
- Create: `src/websocket/handlers/challenge.ts`
- Modify: `src/websocket/router.ts`

**Step 1: Write the test**

Create `tests/unit/challenge-load.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/database/db.js', () => ({
  getDatabase: vi.fn(),
}));
vi.mock('../../src/database/queries/katas.js', () => ({
  getKataById: vi.fn(),
}));
vi.mock('../../src/websocket/server.js', () => ({
  broadcast: vi.fn(),
}));
vi.mock('../../src/mcp/session.js', () => ({
  getActiveSessionId: vi.fn(() => 1),
}));

import { getDatabase } from '../../src/database/db.js';
import { getKataById } from '../../src/database/queries/katas.js';
import { broadcast } from '../../src/websocket/server.js';
import { handleChallengeLoad } from '../../src/websocket/handlers/challenge.js';

describe('handleChallengeLoad', () => {
  const mockWs = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockReturnValue({} as any);
  });

  it('broadcasts challenge:loaded with kata data on success', async () => {
    vi.mocked(getKataById).mockResolvedValue({
      id: 1,
      gap_id: 1,
      title: 'FizzBuzz',
      description: 'Write a FizzBuzz function',
      scaffolding_code: 'function fizzbuzz(n) {}',
      instructor_notes: '',
      constraints: JSON.stringify([
        { id: 'perf', description: 'Must run in O(n)', minLevel: 3 },
        { id: 'no-if', description: 'No if statements', minLevel: 5 },
      ]),
      user_attempts: '[]',
      created_at: '2026-01-01T00:00:00Z',
    });

    await handleChallengeLoad(mockWs, { kataId: 1 }, 'conn-1');

    expect(broadcast).toHaveBeenCalledWith({
      type: 'challenge:loaded',
      data: {
        kataId: 1,
        title: 'FizzBuzz',
        description: 'Write a FizzBuzz function',
        scaffoldingCode: 'function fizzbuzz(n) {}',
        constraints: [
          { id: 'perf', description: 'Must run in O(n)' },
          { id: 'no-if', description: 'No if statements' },
        ],
      },
    });
  });

  it('broadcasts challenge:load_error when kata not found', async () => {
    vi.mocked(getKataById).mockResolvedValue(null);

    await handleChallengeLoad(mockWs, { kataId: 999 }, 'conn-1');

    expect(broadcast).toHaveBeenCalledWith({
      type: 'challenge:load_error',
      data: { error: 'Kata not found (id=999)' },
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/challenges && pnpm vitest run tests/unit/challenge-load.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the handler**

Create `src/websocket/handlers/challenge.ts`:

```ts
import type { WebSocket as WsWebSocket } from 'ws';
import { getDatabase } from '../../database/db.js';
import { getKataById } from '../../database/queries/katas.js';
import { broadcast } from '../server.js';
import type { ChallengeLoadData, KataConstraint } from '../../types/websocket.js';

export async function handleChallengeLoad(
  _ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): Promise<void> {
  const { kataId } = data as ChallengeLoadData;

  const db = getDatabase();
  if (db === null) {
    broadcast({ type: 'challenge:load_error', data: { error: 'Database not initialized' } });
    return;
  }

  const kata = await getKataById(db, kataId);
  if (kata === null) {
    broadcast({ type: 'challenge:load_error', data: { error: `Kata not found (id=${kataId})` } });
    return;
  }

  const allConstraints = JSON.parse(kata.constraints) as KataConstraint[];

  broadcast({
    type: 'challenge:loaded',
    data: {
      kataId: kata.id,
      title: kata.title,
      description: kata.description,
      scaffoldingCode: kata.scaffolding_code,
      constraints: allConstraints.map((c) => ({ id: c.id, description: c.description })),
    },
  });
}
```

Note: `KataConstraint` is imported from `../../types/domain.js`, not `websocket.js`. Adjust the import accordingly — check what's already exported.

**Step 4: Run test to verify it passes**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/challenges && pnpm vitest run tests/unit/challenge-load.test.ts`
Expected: PASS

**Step 5: Register handler in the router**

In `src/websocket/router.ts`:
- Add import: `import { handleChallengeLoad } from './handlers/challenge.js';`
- Add to the `handlers` Map: `['challenge:load', handleChallengeLoad],`

**Step 6: Run typecheck**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/challenges && pnpm typecheck`
Expected: PASS

**Step 7: Commit**

```bash
git add src/websocket/handlers/challenge.ts src/websocket/router.ts tests/unit/challenge-load.test.ts
git commit -m "feat(ws): add challenge:load handler to fetch full kata data"
```

---

### Task 3: Add `challenge` to AppView and wire up navigation

**Files:**
- Modify: `electron-ui/shared/types/entities.ts`
- Modify: `electron-ui/shared/types/websocket-messages.ts`
- Modify: `electron-ui/renderer/src/components/AppShell.tsx`
- Modify: `electron-ui/renderer/src/components/Dashboard/PracticeChallenges.tsx`
- Modify: `electron-ui/renderer/src/views/Dashboard.tsx`

**Step 1: Add `challenge` to AppView**

In `electron-ui/shared/types/entities.ts` line 118, change:

```ts
export type AppView = 'dashboard' | 'ide' | 'planning' | 'placeholder' | 'landing';
```

to:

```ts
export type AppView = 'dashboard' | 'ide' | 'planning' | 'placeholder' | 'landing' | 'challenge';
```

**Step 2: Add challenge WebSocket message types to the Electron shared types**

In `electron-ui/shared/types/websocket-messages.ts`:

Add to `ServerMessageType` (after the `dashboard:` entries):
```ts
| 'challenge:loaded'
| 'challenge:load_error'
```

Add the message interfaces:
```ts
export interface ChallengeLoadedMessage extends BaseMessage {
  type: 'challenge:loaded';
  payload: {
    kataId: number;
    title: string;
    description: string;
    scaffoldingCode: string;
    constraints: Array<{ id: string; description: string }>;
  };
}

export interface ChallengeLoadErrorMessage extends BaseMessage {
  type: 'challenge:load_error';
  payload: {
    error: string;
  };
}
```

Add both to the `ServerMessage` union.

Add to `ClientMessageType`:
```ts
| 'challenge:load'
```

Add the client message interface:
```ts
export interface ChallengeLoadMessage extends BaseMessage {
  type: 'challenge:load';
  payload: {
    kataId: number;
  };
}
```

Add to the `ClientMessage` union.

**Step 3: Update PracticeChallenges to pass kataId**

In `electron-ui/renderer/src/components/Dashboard/PracticeChallenges.tsx`, change the `onChallengeClick` prop type from `() => void` to `(challengeId: string) => void`, and update the click handler to pass `challenge.id`.

**Step 4: Update Dashboard to navigate with kataId**

In `electron-ui/renderer/src/views/Dashboard.tsx`:

Change `handlePlaceholderNav` to a new handler:
```ts
const handleChallengeClick = useCallback(
  (challengeId: string) => {
    onNavigate('challenge', { kataId: Number(challengeId) });
  },
  [onNavigate]
);
```

Pass it to PracticeChallenges: `<PracticeChallenges challenges={challenges} onChallengeClick={handleChallengeClick} />`

Update the `NavigationContext` type and `onNavigate` prop to support `kataId`:
In `AppShell.tsx`, extend the `NavigationContext`:
```ts
interface NavigationContext {
  issueNumber?: number;
  kataId?: number;
}
```

**Step 5: Update AppShell to route to ChallengeView**

In `electron-ui/renderer/src/components/AppShell.tsx`:

Add a `ChallengeView` lazy import (we'll create the component in the next task — for now import a placeholder):
```ts
import { ChallengeView } from '../views/ChallengeView';
```

Add the case in `renderView`:
```ts
case 'challenge':
  return <ChallengeView kataId={navContext.kataId!} onBack={() => handleBack()} />;
```

Update `handleBack` to handle `challenge` → `dashboard`.

Store `navContext` in the `setNavContext` setter (it's currently unused — the setter ignores the value). Fix it by reading from state.

**Step 6: Create a placeholder ChallengeView so the app compiles**

Create `electron-ui/renderer/src/views/ChallengeView.tsx`:

```tsx
interface ChallengeViewProps {
  kataId: number;
  onBack: () => void;
}

export function ChallengeView({ kataId, onBack }: ChallengeViewProps) {
  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <p>Challenge view for kata {kataId}</p>
      <button onClick={onBack}>Back</button>
    </div>
  );
}
```

**Step 7: Verify**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/challenges/electron-ui && npm run typecheck`
Expected: PASS

**Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): add challenge view routing and navigation wiring"
```

---

### Task 4: Build ChallengeHeader component

**Files:**
- Create: `electron-ui/renderer/src/components/Challenge/ChallengeHeader.tsx`

**Step 1: Create the component**

```tsx
interface ChallengeHeaderProps {
  title: string;
  round: number;
  maxRounds: number;
}

export function ChallengeHeader({ title, round, maxRounds }: ChallengeHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-sm) var(--space-md)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        minHeight: '48px',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-h3-size)',
          color: 'var(--text-primary)',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-small-size)',
          color: 'var(--text-secondary)',
        }}
      >
        <span>Round {round}/{maxRounds}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {Array.from({ length: maxRounds }, (_, i) => (
            <div
              key={i}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: i < round ? 'var(--accent-primary)' : 'var(--bg-elevated)',
              }}
            />
          ))}
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Commit**

```bash
git add electron-ui/renderer/src/components/Challenge/ChallengeHeader.tsx
git commit -m "feat(ui): add ChallengeHeader with round indicator"
```

---

### Task 5: Build AiMessage and UserMessage components

**Files:**
- Create: `electron-ui/renderer/src/components/Challenge/AiMessage.tsx`
- Create: `electron-ui/renderer/src/components/Challenge/UserMessage.tsx`

**Step 1: Create AiMessage**

AI messages render text content. Challenge-type messages get an accent left border. Use a simple `<pre>` with `white-space: pre-wrap` for now (PoC — no markdown library needed).

```tsx
import { motion } from 'framer-motion';

interface AiMessageProps {
  content: string;
  type: 'challenge' | 'review';
}

export function AiMessage({ content, type }: AiMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{
        alignSelf: 'flex-start',
        maxWidth: '85%',
        padding: 'var(--space-sm) var(--space-md)',
        background: 'var(--bg-surface)',
        borderRadius: '8px',
        borderLeft: type === 'challenge' ? '3px solid var(--accent-primary)' : 'none',
        fontFamily: 'var(--font-family)',
        fontSize: 'var(--font-body-size)',
        color: 'var(--text-primary)',
        lineHeight: 1.6,
      }}
    >
      <pre
        style={{
          margin: 0,
          fontFamily: 'inherit',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
      </pre>
    </motion.div>
  );
}
```

**Step 2: Create UserMessage**

User messages render submitted code as a read-only Monaco snippet, right-aligned.

```tsx
import { motion } from 'framer-motion';
import MonacoEditor from '@monaco-editor/react';

interface UserMessageProps {
  code: string;
}

export function UserMessage({ code }: UserMessageProps) {
  const lineCount = code.split('\n').length;
  const height = Math.min(Math.max(lineCount * 19, 60), 300);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{
        alignSelf: 'flex-end',
        maxWidth: '85%',
        width: '85%',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <MonacoEditor
        height={height}
        defaultLanguage="typescript"
        value={code}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          folding: false,
          fontSize: 13,
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: { vertical: 'hidden', horizontal: 'auto' },
        }}
      />
    </motion.div>
  );
}
```

**Step 3: Commit**

```bash
git add electron-ui/renderer/src/components/Challenge/AiMessage.tsx electron-ui/renderer/src/components/Challenge/UserMessage.tsx
git commit -m "feat(ui): add AiMessage and UserMessage chat components"
```

---

### Task 6: Build ChatThread component

**Files:**
- Create: `electron-ui/renderer/src/components/Challenge/ChatThread.tsx`

**Step 1: Create ChatThread**

Scrollable container that auto-scrolls to bottom on new messages.

```tsx
import { useRef, useEffect } from 'react';
import { AiMessage } from './AiMessage';
import { UserMessage } from './UserMessage';

export type ChatMessage =
  | { role: 'ai'; content: string; type: 'challenge' | 'review' }
  | { role: 'user'; code: string };

interface ChatThreadProps {
  messages: ChatMessage[];
}

export function ChatThread({ messages }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
      }}
    >
      {messages.map((msg, i) =>
        msg.role === 'ai' ? (
          <AiMessage key={i} content={msg.content} type={msg.type} />
        ) : (
          <UserMessage key={i} code={msg.code} />
        )
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add electron-ui/renderer/src/components/Challenge/ChatThread.tsx
git commit -m "feat(ui): add ChatThread with auto-scroll"
```

---

### Task 7: Build CodeInput component

**Files:**
- Create: `electron-ui/renderer/src/components/Challenge/CodeInput.tsx`

**Step 1: Create CodeInput**

Pinned-to-bottom mini Monaco editor with submit button.

```tsx
import MonacoEditor from '@monaco-editor/react';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

export function CodeInput({ value, onChange, onSubmit, disabled }: CodeInputProps) {
  return (
    <div
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        padding: 'var(--space-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-xs)',
      }}
    >
      <div style={{ height: '200px', borderRadius: '6px', overflow: 'hidden' }}>
        <MonacoEditor
          height="200px"
          defaultLanguage="typescript"
          value={value}
          onChange={(v) => onChange(v ?? '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            fontSize: 13,
            padding: { top: 8, bottom: 8 },
            readOnly: disabled,
            wordWrap: 'on',
          }}
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={disabled}
        style={{
          width: '100%',
          padding: 'var(--space-sm)',
          background: disabled ? 'var(--bg-elevated)' : 'var(--accent-primary)',
          color: disabled ? 'var(--text-muted)' : '#ffffff',
          border: 'none',
          borderRadius: '6px',
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-body-size)',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s ease',
        }}
      >
        {disabled ? 'Reviewing...' : 'Submit Solution'}
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add electron-ui/renderer/src/components/Challenge/CodeInput.tsx
git commit -m "feat(ui): add CodeInput with mini Monaco editor and submit button"
```

---

### Task 8: Build the full ChallengeView with state machine

**Files:**
- Modify: `electron-ui/renderer/src/views/ChallengeView.tsx`

**Step 1: Replace the placeholder with the full implementation**

This is the core component. It orchestrates loading the kata, managing the chat thread state, sending submissions, and handling pass/fail responses.

```tsx
import { useState, useEffect, useCallback } from 'react';
import type {
  ChallengeLoadedMessage,
  ChallengeLoadErrorMessage,
  WebSocketMessage,
} from '@shared/types/websocket-messages';
import { useWebSocket } from '../hooks/useWebSocket';
import { ChallengeHeader } from '../components/Challenge/ChallengeHeader';
import { ChatThread, type ChatMessage } from '../components/Challenge/ChatThread';
import { CodeInput } from '../components/Challenge/CodeInput';

interface ChallengeViewProps {
  kataId: number;
  onBack: () => void;
}

interface KataConstraint {
  id: string;
  description: string;
}

interface KataData {
  title: string;
  description: string;
  scaffoldingCode: string;
  constraints: KataConstraint[];
}

const MAX_ROUNDS = 4;

export function ChallengeView({ kataId, onBack }: ChallengeViewProps) {
  const { send, on } = useWebSocket();

  const [kata, setKata] = useState<KataData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConstraints, setActiveConstraints] = useState<string[]>([]);
  const [round, setRound] = useState(1);
  const [status, setStatus] = useState<'loading' | 'idle' | 'submitting' | 'complete' | 'error'>('loading');
  const [editorValue, setEditorValue] = useState('');

  // Load kata on mount
  useEffect(() => {
    send('challenge:load', { kataId });
  }, [kataId, send]);

  // Listen for challenge:loaded
  useEffect(() => {
    const unsubLoaded = on('challenge:loaded', (msg: WebSocketMessage) => {
      const m = msg as ChallengeLoadedMessage;
      if (m.payload.kataId !== kataId) return;

      const kataData: KataData = {
        title: m.payload.title,
        description: m.payload.description,
        scaffoldingCode: m.payload.scaffoldingCode,
        constraints: m.payload.constraints,
      };

      setKata(kataData);
      setEditorValue(kataData.scaffoldingCode);
      setMessages([
        { role: 'ai', content: kataData.description, type: 'challenge' },
      ]);
      setStatus('idle');
    });

    const unsubError = on('challenge:load_error', (msg: WebSocketMessage) => {
      const m = msg as ChallengeLoadErrorMessage;
      setMessages([{ role: 'ai', content: `Error: ${m.payload.error}`, type: 'review' }]);
      setStatus('error');
    });

    return () => {
      unsubLoaded();
      unsubError();
    };
  }, [kataId, on]);

  // Listen for practice:solution_review
  useEffect(() => {
    const unsub = on('practice:solution_review', (msg: WebSocketMessage) => {
      const data = msg.payload as {
        review: string;
        level: number;
        passed: boolean;
        constraintsUnlocked: string[];
      };

      // Add review message
      setMessages((prev) => [...prev, { role: 'ai', content: data.review, type: 'review' }]);

      if (data.passed) {
        // Check if there are more constraints and more rounds
        setActiveConstraints((prevConstraints) => {
          const nextConstraintIndex = prevConstraints.length;

          setRound((prevRound) => {
            if (!kata) return prevRound;

            if (prevRound >= MAX_ROUNDS || nextConstraintIndex >= kata.constraints.length) {
              // Challenge complete
              setMessages((prev) => [
                ...prev,
                {
                  role: 'ai',
                  content: 'Challenge complete! Great work progressing through all the rounds.',
                  type: 'review',
                },
              ]);
              setStatus('complete');
              return prevRound;
            }

            // Next round: add next constraint
            const nextConstraint = kata.constraints[nextConstraintIndex];
            const newConstraints = [...prevConstraints, nextConstraint.id];

            setMessages((prev) => [
              ...prev,
              {
                role: 'ai',
                content: `Nice work! Now try it again with this added constraint:\n\n> ${nextConstraint.description}`,
                type: 'challenge',
              },
            ]);
            setEditorValue(kata.scaffoldingCode);
            setStatus('idle');

            // Update constraints via return (we're inside setActiveConstraints)
            // This is a workaround — we set constraints here and return them
            setActiveConstraints(newConstraints);
            return prevRound + 1;
          });

          return prevConstraints; // actual update happens above
        });
      } else {
        // Failed — keep same round, re-enable editor with their code
        setStatus('idle');
      }
    });

    const unsubError = on('review:error', (msg: WebSocketMessage) => {
      const data = msg.payload as { error: string };
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: `Review error: ${data.error}. Try submitting again.`, type: 'review' },
      ]);
      setStatus('idle');
    });

    return () => {
      unsub();
      unsubError();
    };
  }, [kata, on]);

  const handleSubmit = useCallback(() => {
    if (status !== 'idle' || !editorValue.trim()) return;

    setStatus('submitting');
    setMessages((prev) => [...prev, { role: 'user', code: editorValue }]);
    send('practice:submit_solution', {
      kataId,
      code: editorValue,
      activeConstraints,
    });
  }, [status, editorValue, kataId, activeConstraints, send]);

  if (status === 'loading') {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-family)',
          color: 'var(--text-secondary)',
        }}
      >
        Loading challenge...
      </div>
    );
  }

  const maxRounds = kata ? Math.min(MAX_ROUNDS, kata.constraints.length + 1) : MAX_ROUNDS;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ChallengeHeader title={kata?.title ?? 'Challenge'} round={round} maxRounds={maxRounds} />
      <ChatThread messages={messages} />
      {status === 'complete' ? (
        <div
          style={{
            padding: 'var(--space-md)',
            textAlign: 'center',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}
        >
          <button
            onClick={onBack}
            style={{
              padding: 'var(--space-sm) var(--space-lg)',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-body-size)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to Dashboard
          </button>
        </div>
      ) : (
        <CodeInput
          value={editorValue}
          onChange={setEditorValue}
          onSubmit={handleSubmit}
          disabled={status === 'submitting'}
        />
      )}
    </div>
  );
}
```

**Important implementation note:** The pass/fail state management above uses nested state setters which is fragile. During implementation, consider refactoring to a `useReducer` if the nested `setActiveConstraints`/`setRound`/`setMessages` pattern causes stale closures. The logic is correct but the implementer should test carefully.

**Step 2: Verify it compiles**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/challenges/electron-ui && npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add electron-ui/renderer/src/views/ChallengeView.tsx
git commit -m "feat(ui): implement ChallengeView with full challenge flow state machine"
```

---

### Task 9: Integration test — manual smoke test

This is a PoC, so the integration test is manual.

**Step 1: Verify backend compiles and tests pass**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/challenges && pnpm typecheck && pnpm test`
Expected: All pass

**Step 2: Verify Electron UI compiles**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/challenges/electron-ui && npm run typecheck`
Expected: PASS

**Step 3: Run lint on changed files**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/challenges && pnpm lint`
Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/challenges/electron-ui && npm run lint`
Expected: PASS (fix any issues)

**Step 4: Final commit if lint fixes were needed**

```bash
git add -A
git commit -m "fix: lint and formatting cleanup"
```

---

## File Summary

### Backend (3 files touched)
| Action | Path |
|--------|------|
| Modify | `src/types/websocket.ts` |
| Create | `src/websocket/handlers/challenge.ts` |
| Modify | `src/websocket/router.ts` |
| Create | `tests/unit/challenge-load.test.ts` |

### Electron UI (10 files touched)
| Action | Path |
|--------|------|
| Modify | `electron-ui/shared/types/entities.ts` |
| Modify | `electron-ui/shared/types/websocket-messages.ts` |
| Modify | `electron-ui/renderer/src/components/AppShell.tsx` |
| Modify | `electron-ui/renderer/src/components/Dashboard/PracticeChallenges.tsx` |
| Modify | `electron-ui/renderer/src/views/Dashboard.tsx` |
| Create | `electron-ui/renderer/src/views/ChallengeView.tsx` |
| Create | `electron-ui/renderer/src/components/Challenge/ChallengeHeader.tsx` |
| Create | `electron-ui/renderer/src/components/Challenge/AiMessage.tsx` |
| Create | `electron-ui/renderer/src/components/Challenge/UserMessage.tsx` |
| Create | `electron-ui/renderer/src/components/Challenge/ChatThread.tsx` |
| Create | `electron-ui/renderer/src/components/Challenge/CodeInput.tsx` |
