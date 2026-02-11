# Data Model: Electron UI

**Feature**: 001-electron-ui
**Date**: 2026-02-11
**Purpose**: Define all entities, their attributes, relationships, and state transitions

---

## Entity Definitions

### 1. WebSocketMessage (Envelope)

**Purpose**: Standardized message envelope for all client↔server communication

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `MessageType` | Yes | String literal union (51 types) |
| `payload` | `unknown` | Yes | Type-specific payload (validated by type guards) |
| `id` | `string` | No | Request/response correlation ID |
| `timestamp` | `number` | Yes | Unix timestamp (milliseconds) |

**Message Types** (28 server→client, 23 client→server):
- See `contracts/websocket-protocol.md` for full enumeration

**Validation Rules**:
- `type` MUST match one of 51 defined types
- `payload` shape validated by type guards per message type
- `timestamp` MUST be valid Unix epoch (> 0)

**State Transitions**: N/A (envelope only)

**Relationships**:
- Used by: WebSocketClient service
- Contains: Type-specific payload entities

---

### 2. TreeNode (File Explorer)

**Purpose**: Hierarchical file tree structure

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | File or directory name |
| `path` | `string` | Yes | Absolute path |
| `type` | `'file' \| 'directory'` | Yes | Node type |
| `children` | `TreeNode[]` | No | Child nodes (directories only) |

**Validation Rules**:
- `name` MUST NOT be empty
- `path` MUST be absolute (start with `/`)
- `type='directory'` MUST have `children` array (can be empty)
- `type='file'` MUST NOT have `children`

**State Transitions**: N/A (immutable, replaced by backend via `fs:tree_update`)

**Relationships**:
- Parent: TreeNode (self-referential)
- Referenced by: ExplorerHint (via `path`)

---

### 3. Phase (Coaching Progression)

**Purpose**: Coaching progression stage in sidebar stepper

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `number` | `1..5` | Yes | Phase number (1-5) |
| `title` | `string` | Yes | Phase name (max 50 chars) |
| `status` | `'pending' \| 'active' \| 'complete'` | Yes | Current state |
| `summary` | `string` | No | AI-generated summary (max 150 chars) |
| `steps` | `PhaseStep[]` | No | Sub-steps (shown at hint level 2+) |

**PhaseStep Sub-Entity**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | Yes | Step name (max 40 chars) |
| `description` | `string` | No | Step description (max 100 chars) |

**Validation Rules**:
- `number` MUST be 1-5
- Only one phase can have `status='active'` at a time
- `status='complete'` phases MUST have lower `number` than active phase
- `status='pending'` phases MUST have higher `number` than active phase
- `title` MUST NOT exceed 50 chars
- `summary` (if present) MUST NOT exceed 150 chars

**State Transitions**:
```
pending → active   (backend sends phase:transition)
active → complete  (backend sends phase:transition)
```

**Relationships**:
- Displayed in: Sidebar PhaseStepper component
- Visibility controlled by: User hint level (0=title only, 1=title+summary, 2=title+summary+steps, 3=full accordion)

---

### 4. IssueContext (GitHub Issue)

**Purpose**: GitHub issue metadata displayed in sidebar

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `number` | `number` | Yes | GitHub issue number |
| `title` | `string` | Yes | Issue title (truncated at 2 lines) |
| `summary` | `string` | No | AI-generated summary (max 250 chars) |
| `labels` | `IssueLabel[]` | No | Array of labels (can be empty) |
| `url` | `string` | Yes | GitHub issue URL |

**IssueLabel Sub-Entity**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Label text |
| `color` | `string` | Yes | Hex color (e.g., `#d97757`) |

**Validation Rules**:
- `number` MUST be positive integer
- `summary` (if present) MUST NOT exceed 250 chars (frontend truncates with ellipsis)
- `labels[].color` MUST be valid hex color (6 digits)
- `url` MUST start with `https://github.com/`

**State Transitions**: N/A (immutable, set on session start)

**Relationships**:
- Displayed in: Sidebar IssueContext component
- Referenced by: Dashboard GitHubIssues (issue card click → session start)

---

### 5. CoachingMessage (Hints/Guidance)

**Purpose**: Coaching hint or guidance from backend, rendered as balloon or toast

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messageId` | `string` (UUID) | Yes | Unique ID (backend-generated, stable reference) |
| `message` | `string` | Yes | Coaching content (markdown supported) |
| `type` | `'hint' \| 'info' \| 'success' \| 'warning'` | Yes | Visual style (border color) |
| `anchor` | `CodeAnchor` | No | Optional code location (if anchored) |
| `source` | `'coaching' \| 'explain' \| 'observer'` | Yes | Origin of message |

**CodeAnchor Sub-Entity**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `string` | Yes | File path |
| `startLine` | `number` | Yes | Start line (1-indexed) |
| `startColumn` | `number` | Yes | Start column (1-indexed) |
| `endLine` | `number` | Yes | End line (1-indexed) |
| `endColumn` | `number` | Yes | End column (1-indexed) |

**Validation Rules**:
- `messageId` MUST be valid UUID v4
- `message` MUST NOT be empty
- If `anchor` present:
  - `startLine` MUST be ≤ `endLine`
  - If `startLine == endLine`: `startColumn` MUST be ≤ `endColumn`
- `source='explain'` or `source='observer'` MUST render full balloon regardless of hint level

**Rendering Logic** (by hint level):
| Level | Source=`coaching` | Source=`explain`/`observer` |
|-------|-------------------|----------------------------|
| 0-1   | Collapsed icon    | Full balloon               |
| 2-3   | Full balloon      | Full balloon               |

**State Transitions**:
```
received → displayed (filtered by hint level)
displayed → dismissed (on code edit overlap or user close)
```

**Auto-Dismissal** (absolute range overlap):
- If user edits code and `edit.line` in `[startLine, endLine]` with column check on boundaries
- Balloon and associated decorations dismissed immediately

**Relationships**:
- Rendered by: CommentBalloon (anchored) or EditorToast (unanchored)
- Associated with: EditorDecoration (same `path` and `range`)
- Referenced by: Review navigation (via `messageId`)

---

### 6. EditorDecoration (Monaco Visual)

**Purpose**: Monaco editor visual decoration (highlight, gutter, squiggly, hover)

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Monaco decoration ID (from `deltaDecorations`) |
| `type` | `'line-highlight' \| 'gutter-marker' \| 'squiggly'` | Yes | Visual type |
| `range` | `CodeRange` | Yes | Code location |
| `message` | `string` | No | Hover tooltip (optional) |
| `style` | `'hint' \| 'error' \| 'warning' \| 'success'` | Yes | Color/icon style |
| `level` | `0..3` | Yes | Minimum hint level to display |

**CodeRange Sub-Entity**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `startLine` | `number` | Yes | Start line (1-indexed) |
| `startColumn` | `number` | Yes | Start column (1-indexed) |
| `endLine` | `number` | Yes | End line (1-indexed) |
| `endColumn` | `number` | Yes | End column (1-indexed) |

**Validation Rules**:
- `level` MUST be 0-3
- `range.startLine` MUST be ≤ `range.endLine`
- If same line: `startColumn` MUST be ≤ `endColumn`
- Backend controls all decorations (frontend never generates)

**Monaco Mapping** (by `type` + `style`):
| Type | Style | Monaco Options |
|------|-------|----------------|
| `line-highlight` | `hint` | `className: 'hint-highlight'`, `isWholeLine: true` |
| `line-highlight` | `error` | `className: 'error-highlight'`, `isWholeLine: true` |
| `gutter-marker` | `hint` | `glyphMarginClassName: 'hint-gutter'` (terracotta dot) |
| `gutter-marker` | `error` | `glyphMarginClassName: 'error-gutter'` (red dot) |
| `squiggly` | `warning` | `className: 'warning-squiggly'` (yellow underline) |

**State Transitions**:
```
received → applied (filtered by hint level)
applied → removed (on hint level change below threshold OR code edit overlap)
```

**Auto-Dismissal** (same as CoachingMessage):
- If user edits code and overlap detected
- Uses `deltaDecorations([oldIds], [])` to clear

**Relationships**:
- Associated with: CoachingMessage (same `path` and `range`)
- Managed by: decoration-manager service
- Rendered in: Monaco Editor

---

### 7. ExplorerHint (File Tree Glow)

**Purpose**: File tree glow guidance at three intensity levels

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `string` | Yes | Absolute file path |
| `style` | `'subtle' \| 'obvious' \| 'unmissable'` | Yes | Intensity level (maps to hint levels 1/2/3) |
| `directories` | `string[]` | No | Explicit directory paths to glow (for `obvious` style) |

**Validation Rules**:
- `path` MUST match existing TreeNode
- `style='subtle'`: File only glows, no directories
- `style='obvious'`: File + backend-specified directories glow
- `style='unmissable'`: File + ALL ancestors glow with intensity gradient
- Backend MUST send `directories` array for `style='obvious'`

**Glow Animation** (Framer Motion):
```typescript
// Baseline breathing
animate={{ opacity: [0.6, 1, 0.6] }}
transition={{
  duration: 2,
  repeat: Infinity,
  ease: 'easeInOut'
}}
```

**Intensity Gradient** (for `unmissable`):
| Distance from File | Opacity | Stiffness | Damping |
|--------------------|---------|-----------|---------|
| 0 (file itself)    | 1.0     | 120       | 14      |
| 1 (parent dir)     | 0.9     | 140       | 16      |
| 2 (grandparent)    | 0.7     | 160       | 18      |
| 3+ (ancestors)     | 0.5     | 180       | 20      |

**Auto-Expand**:
- `subtle`: No expand
- `obvious`: Top-level directory only
- `unmissable`: Full path to file

**State Transitions**:
```
received → applied (filtered by hint level)
applied → removed (on hint level change OR clear command)
```

**Conflict Resolution**:
- Multiple hints same file: Latest hint set wins
- Multiple hints same directory (different intensities): Highest intensity wins

**Relationships**:
- References: TreeNode (via `path`)
- Managed by: hint-manager service
- Rendered in: FileTree component with HintGlow

---

### 8. TabState (Editor Tab)

**Purpose**: Open file tab in editor with dirty state

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `string` | Yes | Absolute file path |
| `language` | `string` | Yes | Monaco language ID (e.g., `typescript`, `python`) |
| `isDirty` | `boolean` | Yes | Unsaved changes exist |
| `icon` | `string` | Yes | vscode-icons class name |
| `cursorPosition` | `CursorPosition` | No | Last cursor position |

**CursorPosition Sub-Entity**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `line` | `number` | Yes | Line number (1-indexed) |
| `column` | `number` | Yes | Column number (1-indexed) |

**Validation Rules**:
- `path` MUST be unique across open tabs
- `language` MUST be valid Monaco language ID
- Dirty tab MUST show dot (replaces close X), hover shows X

**State Transitions**:
```
opened → active (on tab click or file open)
active → inactive (on different tab click)
active + edited → dirty (on buffer:update debounced)
dirty + saved → clean (on save:ack received)
clean → closed (on Cmd+W immediate)
dirty → prompt → [saved|discarded|cancelled] (on Cmd+W)
```

**Tab Management**:
- Opening already-open file: Switch to existing tab (no duplicate)
- Overflow (>10 tabs): Horizontal scroll with fade indicators
- Close all: Close from left to right, prompt on each dirty

**Relationships**:
- Managed by: editor-state service
- Rendered in: EditorTabs component
- Cursor synced via: `editor:cursor` WebSocket message

---

### 9. SessionState (Global Session)

**Purpose**: Global session context (auto-restored on reconnect)

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | `string` (UUID) | Yes | Backend-generated session ID |
| `issueContext` | `IssueContext` | Yes | Current GitHub issue |
| `phases` | `Phase[]` | Yes | Coaching phases (1-5) |
| `currentView` | `'dashboard' \| 'ide' \| 'placeholder'` | Yes | Active view |
| `openTabs` | `TabState[]` | Yes | Open editor tabs |
| `activeTabPath` | `string` | No | Path of active tab |
| `hintLevel` | `0..3` | Yes | Current hint level (slider position) |

**Validation Rules**:
- `sessionId` MUST be valid UUID v4
- `phases` MUST have exactly 5 elements with `number` 1-5
- Only one phase can have `status='active'`
- `activeTabPath` (if present) MUST match one of `openTabs[].path`

**State Transitions**:
```
dashboard → ide (issue card click, backend sends session:start)
ide → dashboard (back navigation, backend sends session:end)
connected → disconnected (WebSocket close)
disconnected → reconnected (WebSocket open, auto-restore state)
```

**Auto-Restore** (on reconnect):
- Backend sends full session state via `session:restore`
- Frontend applies: open tabs, active tab, cursor positions, hint level, scroll positions

**Relationships**:
- Contains: IssueContext, Phase[], TabState[]
- Managed by: WebSocketClient + session state service
- Restored via: `session:restore` WebSocket message

---

### 10. ReviewComment (Review Navigation)

**Purpose**: Code review comment for ◀/▶ navigation

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messageId` | `string` (UUID) | Yes | Stable reference (from CoachingMessage) |
| `path` | `string` | Yes | File path |
| `range` | `CodeRange` | Yes | Code location |
| `message` | `string` | Yes | Comment content |
| `type` | `'hint' \| 'info' \| 'success' \| 'warning'` | Yes | Visual style |

**Validation Rules**:
- `messageId` MUST match existing CoachingMessage
- Comments ordered by: (1) `path` alphabetical, (2) `range.startLine` ascending

**State Transitions**:
```
review_start → navigating (status bar shows [◀] N/M [▶] [✕])
navigating → focused (◀/▶ scrolls to comment, emphasizes balloon)
navigating → exited (✕ click, dismisses all review comments)
```

**Cross-File Navigation**:
- If next comment in different file: Auto-switch tab
- If tab not open: Open tab, then navigate
- If file deleted: Skip to next comment

**Lifecycle**:
- New review: Replace previous (old comments dismissed)
- Phase transition: Review persists (new hints layer)
- Tab closed: Counter adjusts, ◀/▶ skip, exit if all tabs gone
- Session end: Review exits

**Relationships**:
- References: CoachingMessage (via `messageId`)
- Managed by: review-navigation service
- Rendered in: Status bar navigation controls

---

## Entity Relationships Diagram

```
SessionState
├── IssueContext
│   └── IssueLabel[]
├── Phase[]
│   └── PhaseStep[]
└── TabState[]
    └── CursorPosition

WebSocketMessage
└── payload (varies by type)

CoachingMessage
├── CodeAnchor
└── rendered as CommentBalloon or EditorToast

EditorDecoration
└── CodeRange
    └── rendered in Monaco Editor

ExplorerHint
└── references TreeNode (via path)
    └── rendered with HintGlow

ReviewComment
├── references CoachingMessage (via messageId)
└── CodeRange
```

---

## State Management Strategy

**No Redux/MobX/Zustand** — Simple React Context + Hooks:

1. **WebSocketContext**: WebSocket connection, message handlers
2. **SessionContext**: SessionState, issue, phases
3. **EditorContext**: Open tabs, active tab, decorations
4. **HintContext**: Hint level, filtered hints, review navigation

**Services** (singleton, imported directly):
- `websocket-client.ts`: WebSocket connection, reconnection
- `editor-state.ts`: Tab management, dirty tracking
- `decoration-manager.ts`: Monaco decorations by level
- `hint-manager.ts`: Filter/apply hints by level
- `review-navigation.ts`: Review comment ◀/▶ logic

**Rationale**: KISS principle. No state library overhead for single-user local app. React Context sufficient for prop drilling avoidance.

---

## Persistence Strategy

**Zero Local Persistence** (thin client):
- No localStorage, no IndexedDB, no files
- All state from backend via WebSocket
- Session restored on reconnect by backend
- Browser refresh → reconnect → session:restore

**Rationale**: Constitution principle VIII (Backend Is Single Source of Truth). Frontend never owns state.

---

## Validation Strategy

**Message Validation** (TypeScript + Runtime):
```typescript
// Type guard example
function isCoachingMessage(msg: WebSocketMessage): msg is CoachingMessage {
  return msg.type === 'coaching:message' &&
         typeof msg.payload.messageId === 'string' &&
         typeof msg.payload.message === 'string' &&
         ['hint', 'info', 'success', 'warning'].includes(msg.payload.type);
}

// Use at WebSocket boundary
websocket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (isCoachingMessage(msg)) {
    // Type-safe access to msg.payload
  } else {
    console.error('Invalid message:', msg);
  }
};
```

**Validation Rules**:
- All WebSocket payloads validated at boundary with type guards
- Invalid messages logged and ignored (per spec: "unknown types logged/ignored")
- No exceptions thrown for malformed messages (fail gracefully)

---

**Phase 1: Data Model Complete** ✅

All entities defined with attributes, relationships, state transitions, and validation rules. Ready to proceed to contracts generation.
