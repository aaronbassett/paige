# WebSocket Protocol Contract

**Feature**: 001-electron-ui (Electron UI ↔ Backend)
**Date**: 2026-02-11
**Version**: 1.0.0
**Purpose**: Define all 51 WebSocket message types for Backend ↔ Electron communication

---

## Message Envelope

All messages use consistent envelope structure:

```typescript
interface WebSocketMessage {
  type: MessageType;      // String literal from 51 defined types
  payload: unknown;       // Type-specific payload (see below)
  id?: string;            // Optional request/response correlation ID
  timestamp: number;      // Unix timestamp (milliseconds)
}
```

**Envelope Rules**:
- `type` MUST match one of 51 defined types below
- `payload` shape validated by type (see TypeScript definitions)
- `id` used for request/response pairing (optional, backend-generated)
- `timestamp` MUST be valid Unix epoch (> 0)

---

## Message Types (51 total)

### Server → Client (28 types)

#### Connection Lifecycle (3 types)

**1. `connection:hello`** — Initial handshake from backend
```typescript
{
  type: 'connection:hello',
  payload: {
    serverId: string;       // Backend instance ID
    version: string;        // Protocol version
    capabilities: string[]; // Supported features
  }
}
```

**2. `connection:init`** — Backend ready for commands
```typescript
{
  type: 'connection:init',
  payload: {
    workspacePath: string; // Absolute path to workspace
  }
}
```

**3. `connection:error`** — Connection-level error
```typescript
{
  type: 'connection:error',
  payload: {
    code: string;    // Error code (e.g., 'AUTH_FAILED')
    message: string; // Human-readable error
  }
}
```

---

#### Session Management (3 types)

**4. `session:start`** — New coding session started
```typescript
{
  type: 'session:start',
  payload: {
    sessionId: string;       // UUID
    issueContext: IssueContext; // GitHub issue
    phases: Phase[];         // 5 coaching phases
    initialHintLevel: 0 | 1 | 2 | 3; // Starting level
  }
}
```

**5. `session:restore`** — Restore session after reconnect
```typescript
{
  type: 'session:restore',
  payload: {
    sessionId: string;
    issueContext: IssueContext;
    phases: Phase[];
    openTabs: Array<{
      path: string;
      content: string;
      language: string;
      cursorPosition: { line: number; column: number };
      scrollPosition: { line: number; column: number };
    }>;
    activeTabPath: string;
    hintLevel: 0 | 1 | 2 | 3;
  }
}
```

**6. `session:end`** — Session terminated
```typescript
{
  type: 'session:end',
  payload: {
    sessionId: string;
    reason: 'completed' | 'cancelled' | 'error';
  }
}
```

---

#### Dashboard Data (6 types)

**7. `dashboard:dreyfus`** — Dreyfus model skill levels
```typescript
{
  type: 'dashboard:dreyfus',
  payload: {
    axes: Array<{
      skill: string;        // e.g., 'Debugging', 'Testing'
      level: 1 | 2 | 3 | 4 | 5; // Novice → Expert
    }>;
  }
}
```

**8. `dashboard:stats`** — Coding statistics
```typescript
{
  type: 'dashboard:stats',
  payload: {
    period: 'today' | 'this_week' | 'this_month';
    stats: Array<{
      label: string;  // e.g., 'Issues Resolved'
      value: number;
      change: number; // % change from previous period
    }>;
  }
}
```

**9. `dashboard:in_progress`** — In-progress tasks
```typescript
{
  type: 'dashboard:in_progress',
  payload: {
    tasks: Array<{
      id: string;
      title: string;
      progress: number; // 0-100
      dueDate?: string; // ISO 8601
    }>;
  }
}
```

**10. `dashboard:issues`** — GitHub issues assigned to user
```typescript
{
  type: 'dashboard:issues',
  payload: {
    issues: Array<{
      number: number;
      title: string;
      labels: Array<{ name: string; color: string }>;
      url: string;
    }>;
  }
}
```

**11. `dashboard:challenges`** — Practice challenges
```typescript
{
  type: 'dashboard:challenges',
  payload: {
    challenges: Array<{
      id: string;
      title: string;
      difficulty: 'easy' | 'medium' | 'hard';
      estimatedMinutes: number;
    }>;
  }
}
```

**12. `dashboard:materials`** — Learning materials
```typescript
{
  type: 'dashboard:materials',
  payload: {
    materials: Array<{
      id: string;
      title: string;
      type: 'article' | 'video' | 'tutorial';
      url: string;
    }>;
  }
}
```

---

#### File System (4 types)

**13. `fs:tree`** — Initial file tree
```typescript
{
  type: 'fs:tree',
  payload: {
    root: TreeNode; // Recursive structure
  }
}
```

**14. `fs:tree_update`** — File tree change (add/remove/rename)
```typescript
{
  type: 'fs:tree_update',
  payload: {
    action: 'add' | 'remove' | 'rename';
    path: string;
    newPath?: string; // For rename
    node?: TreeNode;  // For add
  }
}
```

**15. `buffer:content`** — File content response
```typescript
{
  type: 'buffer:content',
  payload: {
    path: string;
    content: string;
    language: string; // Monaco language ID
  }
}
```

**16. `save:ack`** — Save operation completed
```typescript
{
  type: 'save:ack',
  payload: {
    path: string;
    success: boolean;
    error?: string; // If success=false
  }
}
```

---

#### Explorer Hints (2 types)

**17. `explorer:hint_files`** — File tree hints
```typescript
{
  type: 'explorer:hint_files',
  payload: {
    hints: Array<{
      path: string;
      style: 'subtle' | 'obvious' | 'unmissable';
      directories?: string[]; // For 'obvious' style
    }>;
  }
}
```

**18. `explorer:clear_hints`** — Clear all file hints
```typescript
{
  type: 'explorer:clear_hints',
  payload: {}
}
```

---

#### Editor Decorations (2 types)

**19. `editor:decorations`** — Apply Monaco decorations
```typescript
{
  type: 'editor:decorations',
  payload: {
    path: string;
    decorations: Array<{
      type: 'line-highlight' | 'gutter-marker' | 'squiggly';
      range: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
      };
      message?: string; // Hover tooltip
      style: 'hint' | 'error' | 'warning' | 'success';
      level: 0 | 1 | 2 | 3; // Minimum hint level to display
    }>;
  }
}
```

**20. `editor:clear_decorations`** — Clear decorations for file
```typescript
{
  type: 'editor:clear_decorations',
  payload: {
    path: string;
  }
}
```

---

#### Coaching Messages (3 types)

**21. `coaching:message`** — Coaching hint/guidance
```typescript
{
  type: 'coaching:message',
  payload: {
    messageId: string; // UUID for stable reference
    message: string;   // Markdown supported
    type: 'hint' | 'info' | 'success' | 'warning';
    anchor?: {
      path: string;
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
    source: 'coaching' | 'explain' | 'observer';
  }
}
```

**22. `coaching:review_result`** — Review comments from user:review
```typescript
{
  type: 'coaching:review_result',
  payload: {
    scope: 'current' | 'file' | 'last_review' | 'last_phase' | 'issue_start';
    comments: Array<{
      messageId: string;
      path: string;
      range: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
      };
      message: string;
      type: 'hint' | 'info' | 'success' | 'warning';
    }>;
  }
}
```

**23. `coaching:clear`** — Clear coaching messages
```typescript
{
  type: 'coaching:clear',
  payload: {
    messageIds?: string[]; // Specific IDs, or all if omitted
  }
}
```

---

#### Phase Management (1 type)

**24. `phase:transition`** — Phase status change
```typescript
{
  type: 'phase:transition',
  payload: {
    phaseNumber: 1 | 2 | 3 | 4 | 5;
    newStatus: 'pending' | 'active' | 'complete';
  }
}
```

---

#### Observer Nudges (1 type)

**25. `observer:nudge`** — AI coaching nudge (injected into terminal)
```typescript
{
  type: 'observer:nudge',
  payload: {
    message: string; // Injected as PTY stdin
  }
}
```

---

#### Errors (3 types)

**26. `error:file_not_found`** — File operation failed (not found)
```typescript
{
  type: 'error:file_not_found',
  payload: {
    path: string;
    operation: 'open' | 'save' | 'delete';
  }
}
```

**27. `error:permission_denied`** — File operation failed (permission)
```typescript
{
  type: 'error:permission_denied',
  payload: {
    path: string;
    operation: 'open' | 'save' | 'delete';
  }
}
```

**28. `error:general`** — Generic error
```typescript
{
  type: 'error:general',
  payload: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }
}
```

---

### Client → Server (23 types)

#### Connection Lifecycle (1 type)

**29. `connection:ready`** — Client ready to receive data
```typescript
{
  type: 'connection:ready',
  payload: {
    clientVersion: string;
    capabilities: string[];
  }
}
```

---

#### Dashboard Actions (3 types)

**30. `dashboard:stats_period`** — Change stats period
```typescript
{
  type: 'dashboard:stats_period',
  payload: {
    period: 'today' | 'this_week' | 'this_month';
  }
}
```

**31. `dashboard:resume_task`** — Resume in-progress task
```typescript
{
  type: 'dashboard:resume_task',
  payload: {
    taskId: string;
  }
}
```

**32. `dashboard:start_issue`** — Start work on GitHub issue
```typescript
{
  type: 'dashboard:start_issue',
  payload: {
    issueNumber: number;
  }
}
```

---

#### File Operations (3 types)

**33. `file:open`** — Request file content
```typescript
{
  type: 'file:open',
  payload: {
    path: string;
  }
}
```

**34. `file:close`** — Close file tab (notify backend)
```typescript
{
  type: 'file:close',
  payload: {
    path: string;
  }
}
```

**35. `file:save`** — Save file content
```typescript
{
  type: 'file:save',
  payload: {
    path: string;
    content: string;
  }
}
```

---

#### Editor Events (4 types)

**36. `buffer:update`** — File content changed (debounced 300ms)
```typescript
{
  type: 'buffer:update',
  payload: {
    path: string;
    content: string;
    cursorPosition: { line: number; column: number };
  }
}
```

**37. `editor:cursor`** — Cursor position changed
```typescript
{
  type: 'editor:cursor',
  payload: {
    path: string;
    line: number;
    column: number;
  }
}
```

**38. `editor:scroll`** — Editor scrolled (debounced 200ms)
```typescript
{
  type: 'editor:scroll',
  payload: {
    path: string;
    line: number;
    column: number;
  }
}
```

**39. `editor:selection`** — Text selected
```typescript
{
  type: 'editor:selection',
  payload: {
    path: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    text: string;
  }
}
```

---

#### Terminal Events (3 types)

**40. `terminal:ready`** — Terminal ready, send initial size
```typescript
{
  type: 'terminal:ready',
  payload: {
    cols: number;
    rows: number;
  }
}
```

**41. `terminal:input`** — User typed in terminal
```typescript
{
  type: 'terminal:input',
  payload: {
    data: string; // Raw input data
  }
}
```

**42. `terminal:resize`** — Terminal size changed
```typescript
{
  type: 'terminal:resize',
  payload: {
    cols: number;
    rows: number;
  }
}
```

---

#### Hints & Coaching (5 types)

**43. `hints:level_change`** — User changed hint level (debounced 200ms)
```typescript
{
  type: 'hints:level_change',
  payload: {
    level: 0 | 1 | 2 | 3;
  }
}
```

**44. `user:explain`** — User requested explanation (select code → button)
```typescript
{
  type: 'user:explain',
  payload: {
    path: string;
    range: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
    text: string;
  }
}
```

**45. `user:review`** — User requested code review
```typescript
{
  type: 'user:review',
  payload: {
    scope: 'current' | 'file' | 'last_review' | 'last_phase' | 'issue_start';
  }
}
```

**46. `coaching:dismiss`** — User dismissed coaching message
```typescript
{
  type: 'coaching:dismiss',
  payload: {
    messageId: string;
  }
}
```

**47. `coaching:feedback`** — User feedback on coaching message
```typescript
{
  type: 'coaching:feedback',
  payload: {
    messageId: string;
    helpful: boolean;
  }
}
```

---

#### User Activity (3 types)

**48. `user:idle_start`** — User idle for 5s
```typescript
{
  type: 'user:idle_start',
  payload: {
    durationMs: number; // Time since last activity
  }
}
```

**49. `user:idle_end`** — User active again
```typescript
{
  type: 'user:idle_end',
  payload: {}
}
```

**50. `user:navigation`** — View navigation (dashboard ↔ IDE)
```typescript
{
  type: 'user:navigation',
  payload: {
    from: 'dashboard' | 'ide' | 'placeholder';
    to: 'dashboard' | 'ide' | 'placeholder';
  }
}
```

---

#### Phase Actions (1 type)

**51. `phase:expand_step`** — User expanded phase sub-step (accordion)
```typescript
{
  type: 'phase:expand_step',
  payload: {
    phaseNumber: 1 | 2 | 3 | 4 | 5;
    stepIndex: number;
  }
}
```

---

## Message Flow Examples

### Example 1: Connection Handshake

```
Client → Server: connection:ready
Server → Client: connection:hello
Server → Client: connection:init
Server → Client: dashboard:* (6 messages to populate dashboard)
```

### Example 2: Start Issue Session

```
Client → Server: dashboard:start_issue { issueNumber: 42 }
Server → Client: session:start { sessionId, issueContext, phases, initialHintLevel }
Server → Client: fs:tree { root }
Server → Client: phase:transition { phaseNumber: 1, newStatus: 'active' }
```

### Example 3: File Edit Workflow

```
Client → Server: file:open { path: '/src/app.ts' }
Server → Client: buffer:content { path, content, language: 'typescript' }
[User edits, debounced 300ms]
Client → Server: buffer:update { path, content, cursorPosition }
[User presses Cmd+S]
Client → Server: file:save { path, content }
Server → Client: save:ack { path, success: true }
```

### Example 4: Hint Level Change

```
[User drags slider from 1 → 3, debounced 200ms]
Client → Server: hints:level_change { level: 3 }
[Frontend immediately re-renders hints/decorations/glows at level 3]
[Backend records level change in session state]
```

### Example 5: Code Review Flow

```
[User clicks "Review File" in status bar]
Client → Server: user:review { scope: 'file' }
Server → Client: coaching:review_result { scope, comments: [...] }
[Status bar transforms to [◀] 1/7 [▶] [✕]]
[User clicks ▶]
[Frontend navigates to next comment via messageId]
[User clicks ✕]
Client → Server: coaching:dismiss for all review messageIds
```

### Example 6: WebSocket Reconnection

```
[Network interruption, WebSocket closes]
[Frontend shows "Reconnecting... (attempt 1)" after 5 failures]
[Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s cap]
[WebSocket reconnects]
Client → Server: connection:ready
Server → Client: connection:hello
Server → Client: session:restore { sessionId, openTabs, ... }
[Frontend restores tabs, cursor positions, hint level]
```

---

## Protocol Rules

### Debouncing

Frontend MUST debounce high-frequency events:
- `buffer:update`: 300ms
- `editor:scroll`: 200ms
- `hints:level_change`: 200ms
- `user:idle_start`: 5000ms

### Ordering

- Messages MUST be processed in order received
- Backend MAY batch multiple messages in single WebSocket frame
- Frontend MUST handle out-of-order `save:ack` (use `id` for correlation)

### Error Handling

- Unknown message types: Log warning, ignore message
- Invalid payloads: Log error, ignore message
- Never throw exceptions for malformed messages

### Reconnection

- Frontend MUST implement exponential backoff (1s → 30s cap)
- Frontend MUST retry indefinitely (no max attempts)
- Frontend MUST queue in-flight operations during disconnect
- Frontend MUST request `session:restore` on reconnect

### Type Safety

- All messages MUST use TypeScript interfaces
- Frontend MUST validate payloads with type guards at boundary
- Backend MUST validate payloads before processing

---

## TypeScript Definitions

See `shared/types/websocket-messages.ts` for complete type definitions:

```typescript
type MessageType =
  // Server → Client (28)
  | 'connection:hello'
  | 'connection:init'
  | /* ... 26 more */
  // Client → Server (23)
  | 'connection:ready'
  | 'dashboard:start_issue'
  | /* ... 21 more */;

interface BaseMessage {
  type: MessageType;
  payload: unknown;
  id?: string;
  timestamp: number;
}

// Extend for each specific message type
interface ConnectionHelloMessage extends BaseMessage {
  type: 'connection:hello';
  payload: {
    serverId: string;
    version: string;
    capabilities: string[];
  };
}

// Union type for all 51 messages
type WebSocketMessage =
  | ConnectionHelloMessage
  | /* ... 50 more */;
```

---

**Contract Version**: 1.0.0
**Status**: ✅ Complete — All 51 message types defined with payload schemas

---

## Change Log

- **1.0.0** (2026-02-11): Initial contract definition, 51 message types
