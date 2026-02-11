# Feature Specification: backend-server

**Feature Branch**: `feature/backend-server`
**Created**: 2026-02-10
**Last Updated**: 2026-02-11
**Status**: In Progress
**Version**: 1.0
**Discovery**: See `discovery/` folder for full context

---

## Problem Statement

The Paige backend server is the central nervous system of a three-tier AI coaching application. It must serve two very different consumers simultaneously — Claude Code (via MCP/Streamable HTTP) and an Electron UI (via WebSocket) — while owning all persistent state, all file I/O, all Claude API calls for evaluative/analytical tasks, and a comprehensive action log. It is the single source of truth: if the backend doesn't know about it, it didn't happen.

## Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| **Claude Code Plugin** | The AI coaching personality running in a PTY. Communicates via MCP (Streamable HTTP). | Call tools to control the UI (highlights, hints, phase updates), read session state, read buffers/diffs, trigger the coaching pipeline |
| **Electron UI** | Thin rendering client (Monaco, xterm.js, file tree). Communicates via WebSocket. | Receive UI commands, push user activity (buffer edits, file opens/saves), request file content, request explanations, submit practice solutions, load dashboard data |
| **Developer (Aaron)** | Solo hackathon developer building and demoing Paige. | Run the server easily, debug quickly, see clear logs, configure for demo scenarios |

---

## User Scenarios & Testing

<!--
  Stories are ordered by priority (P1 first).
  Each story is independently testable and delivers standalone value.
  Stories may be revised if later discovery reveals gaps - see REVISIONS.md
-->

### User Story 1 — Server Foundation & Lifecycle (Priority: P1)

**Revision**: v1.0

**As** the backend server, **I** start a single Hono HTTP server that serves both MCP (Streamable HTTP) and WebSocket on one configurable port, **so that** Claude Code and Electron can connect to a single process.

**Packages**:
- `hono` — HTTP framework
- `@hono/node-server` — Node.js adapter for Hono
- `@hono/node-ws` — WebSocket adapter for Hono on Node.js
- `@modelcontextprotocol/server` — McpServer, WebStandardStreamableHTTPServerTransport
- `@modelcontextprotocol/hono` — createMcpHonoApp() helper
- `dotenv` — .env file loading

**Environment Variables**:
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `PROJECT_DIR` | Yes | — | Path to the project being coached on |
| `CHROMADB_URL` | No | `http://localhost:8000` | ChromaDB server URL |
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key for Claude API calls |
| `DATA_DIR` | No | `~/.paige/` | Persistent data directory (SQLite, etc.) |

**Key Decisions**: D5, D6, D7, D9, D10, D12
**Research**: R1, R2

#### Acceptance Scenarios

**Scenario 1.1: Successful startup**
- **Given** all required environment variables are set and `PROJECT_DIR` exists
- **When** the server starts
- **Then** it logs the port, project directory, and a startup confirmation to stdout
- **And** it is ready to accept connections within 2 seconds

**Scenario 1.2: MCP session initialization**
- **Given** the server is running
- **When** Claude Code sends a POST to `/mcp` with an initialize request
- **Then** a new stateful session is created with a UUID session ID
- **And** the response includes the `Mcp-Session-Id` header

**Scenario 1.3: WebSocket connection**
- **Given** the server is running
- **When** Electron connects to `ws://localhost:{PORT}/ws`
- **Then** the WebSocket upgrade succeeds
- **And** the connection is tracked in the server's connection set
- **And** the server can send and receive JSON messages on it

**Scenario 1.4: Health check**
- **Given** the server is running
- **When** any client sends `GET /health`
- **Then** it responds with HTTP 200 and `{ "status": "ok", "uptime": <seconds> }`

**Scenario 1.5: Missing required env var**
- **Given** `PROJECT_DIR` or `ANTHROPIC_API_KEY` is missing or empty
- **When** the server attempts to start
- **Then** it exits with code 1
- **And** the error message names the specific missing variable(s)

**Scenario 1.6: PROJECT_DIR does not exist**
- **Given** `PROJECT_DIR` is set to a path that does not exist on the filesystem
- **When** the server attempts to start
- **Then** it exits with code 1
- **And** the error message states the path does not exist

**Scenario 1.7: DATA_DIR auto-creation**
- **Given** `DATA_DIR` does not exist on the filesystem
- **When** the server starts
- **Then** it creates the directory (and any parent directories) before proceeding

**Scenario 1.8: Graceful shutdown**
- **Given** the server is running with active MCP sessions and WebSocket connections
- **When** the server receives SIGINT or SIGTERM
- **Then** it closes all MCP transports (removing them from the session map)
- **And** closes all WebSocket connections
- **And** logs each shutdown step
- **And** exits with code 0

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-01 | `PORT` already in use | Server fails to bind and exits with Node.js default EADDRINUSE error. No custom handling needed. |
| EC-02 | Multiple Claude Code instances connect simultaneously | Each gets its own MCP session with a unique UUID. No conflict. |
| EC-03 | WebSocket disconnects unexpectedly | `onClose` handler removes connection from tracking. Server continues. |
| EC-04 | `.env` file is missing | `dotenv` silently does nothing. Required vars validated from `process.env` (can be set externally). |
| EC-05 | SIGINT during startup (before server is ready) | Shutdown handler still runs; closes whatever was initialized. |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-001 | Server MUST start a single Hono HTTP server on the port specified by `PORT` (default: 3000). | High |
| FR-002 | Server MUST mount MCP Streamable HTTP transport on `/mcp` using `@modelcontextprotocol/hono`, accepting POST (requests), GET (notifications), and DELETE (session termination). | High |
| FR-003 | Server MUST mount a WebSocket endpoint on `/ws` using `@hono/node-ws`, accepting upgrade requests and tracking active connections. | High |
| FR-004 | Server MUST respond to `GET /health` with HTTP 200 and `{ "status": "ok", "uptime": <number> }`. | High |
| FR-005 | Server MUST validate that `PROJECT_DIR` and `ANTHROPIC_API_KEY` are set and non-empty, exiting with code 1 and a descriptive error if not. | High |
| FR-006 | Server MUST validate that `PROJECT_DIR` exists on the filesystem, exiting with code 1 and a descriptive error if not. | High |
| FR-007 | Server MUST create `DATA_DIR` (default `~/.paige/`) recursively if it does not exist. | High |
| FR-008 | Server MUST handle SIGINT and SIGTERM by closing all MCP transports, all WebSocket connections, and exiting with code 0. | High |
| FR-009 | MCP sessions MUST be stateful with UUID session IDs, tracked in an in-memory Map keyed by session ID. | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-001 | Server starts and is ready to accept connections | Startup completes and logs confirmation within 2 seconds (cold start, no DB). |
| SC-002 | MCP transport accepts initialization | A valid MCP initialize POST to `/mcp` returns a response with a session ID header. |
| SC-003 | WebSocket accepts connection | A WebSocket client can connect to `/ws` and exchange a JSON message. |
| SC-004 | Missing env var detection works | Missing `PROJECT_DIR` causes exit code 1 with variable name in stderr. |
| SC-005 | Graceful shutdown completes cleanly | SIGINT with active connections closes all transports/connections with no dangling handles. |

---

### User Story 2 — SQLite State Management (Priority: P1)

**Revision**: v1.0

**As** the backend server, **I** initialise a SQLite database with Kysely, creating all tables on startup, **so that** sessions, plans, phases, Dreyfus assessments, knowledge gaps, and kata specs can be persisted across sessions.

**Packages**:
- `better-sqlite3` — SQLite driver for Node.js
- `@types/better-sqlite3` — TypeScript types
- `kysely` — Typed query builder

**Key Decisions**: D13, D14, D15, D16, D17

**Schema (8 tables)**:

```
sessions
  ├── plans
  │     └── phases
  │           ├── phase_hints
  │           └── progress_events
  └── knowledge_gaps
        └── kata_specs

dreyfus_assessments (global, no FK)
```

**Table Definitions**:

| Table | Columns |
|-------|---------|
| `sessions` | id (TEXT PK), project_dir, issue_number (INTEGER), issue_title, status (TEXT: active/completed/abandoned), started_at (TEXT ISO8601), ended_at (TEXT ISO8601 nullable) |
| `plans` | id (TEXT PK), session_id (TEXT FK→sessions), raw_plan_text, created_at (TEXT ISO8601) |
| `phases` | id (TEXT PK), plan_id (TEXT FK→plans), number (INTEGER), title, description, status (TEXT: pending/active/complete), hint_level (TEXT), expected_files (TEXT JSON), started_at (TEXT ISO8601 nullable), completed_at (TEXT ISO8601 nullable) |
| `phase_hints` | id (TEXT PK), phase_id (TEXT FK→phases), type (TEXT: file/line), path, start_line (INTEGER nullable), end_line (INTEGER nullable), style, hover_text (TEXT nullable) |
| `dreyfus_assessments` | id (TEXT PK), skill_area (TEXT UNIQUE), stage (TEXT: novice/advanced_beginner/competent/proficient/expert), confidence (REAL), evidence, assessed_at (TEXT ISO8601) |
| `knowledge_gaps` | id (TEXT PK), session_id (TEXT FK→sessions), topic, severity (TEXT: low/medium/high), evidence, related_concepts (TEXT JSON), frequency (INTEGER DEFAULT 1), last_encountered_at (TEXT ISO8601), addressed (INTEGER DEFAULT 0) |
| `kata_specs` | id (TEXT PK), knowledge_gap_id (TEXT FK→knowledge_gaps), title, description, scaffolding_code, instructor_notes, constraints (TEXT JSON), user_attempts (TEXT JSON DEFAULT '[]') |
| `progress_events` | id (TEXT PK), phase_id (TEXT FK→phases), event_type, data (TEXT JSON nullable), created_at (TEXT ISO8601) |

**JSON Column Schemas**:

`kata_specs.constraints`:
```json
[
  {
    "title": "string",
    "description": "string",
    "minLevel": "number (1-10)"
  }
]
```

`kata_specs.user_attempts`:
```json
[
  {
    "code": "string",
    "review": "string | undefined",
    "level": "number (1-10) | undefined",
    "passed": "boolean | undefined",
    "constraints": "Constraint[] | undefined"
  }
]
```

**Practice Mode Flow**: User writes code → API call with description + instructor_notes + attempt (including active constraints) → Claude reviews → returns review + level (1-10) + passed. Higher level unlocks more constraints (those with `minLevel` ≤ user's current level). User activates 0+ constraints per attempt.

#### Acceptance Scenarios

**Scenario 2.1: Fresh database creation**
- **Given** `DATA_DIR/paige.db` does not exist
- **When** the database module initialises
- **Then** it creates the database file and all 8 tables

**Scenario 2.2: Existing database reconnection**
- **Given** `DATA_DIR/paige.db` already exists with all tables and data
- **When** the database module initialises
- **Then** it connects without error and existing data is preserved

**Scenario 2.3: Session CRUD**
- **Given** the database is initialised
- **When** a session is created with project_dir, issue_number, issue_title
- **Then** it is stored with status "active" and started_at set to now
- **And** it can be retrieved by ID with all fields intact

**Scenario 2.4: Plan and phase hierarchy**
- **Given** a session exists
- **When** a plan is created for that session, and phases are created for that plan
- **Then** phases are linked to the plan via FK
- **And** each phase can be queried independently or with its parent plan
- **And** deleting a plan cascades to its phases

**Scenario 2.5: Phase hints**
- **Given** a phase exists
- **When** file hints and line hints are created for it
- **Then** each hint is stored with its metadata (path, line range, style, hover_text)
- **And** hints can be queried by phase_id and filtered by type

**Scenario 2.6: Dreyfus assessments (global)**
- **Given** the database is initialised
- **When** a Dreyfus assessment is created for skill_area "React state management"
- **Then** it is stored with stage, confidence, evidence, and assessed_at
- **And** updating the same skill_area overwrites the existing assessment (UNIQUE constraint)

**Scenario 2.7: Knowledge gaps**
- **Given** a session exists
- **When** knowledge gaps are recorded
- **Then** each gap stores topic, severity, evidence, related_concepts (JSON array)
- **And** gaps can be queried by session_id or globally with filters

**Scenario 2.8: Kata spec creation**
- **Given** a knowledge gap exists
- **When** a kata spec is generated
- **Then** it stores title, description, scaffolding_code, instructor_notes, constraints (JSON), and user_attempts (empty JSON array)

**Scenario 2.9: Kata attempt tracking**
- **Given** a kata spec exists with previous attempts
- **When** a new attempt is added
- **Then** the user_attempts JSON array is appended with the new attempt ({code, review, level, passed, constraints})
- **And** previous attempts are preserved

**Scenario 2.10: Progress events**
- **Given** a phase exists
- **When** progress events are recorded (hint_used, hint_escalated, review_requested, review_passed)
- **Then** each event stores event_type, optional data (JSON), and created_at
- **And** events can be queried by phase_id in chronological order

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-06 | Database file is corrupted | `better-sqlite3` throws on open. Catch, log clear error, exit. No auto-recovery. |
| EC-07 | Concurrent writes (Observer + session) | WAL mode handles this. Enable WAL on connection. |
| EC-08 | FK reference to non-existent parent | SQLite FK constraints reject the insert. Application layer gets a clear error. |
| EC-09 | Duplicate skill_area in dreyfus_assessments | UNIQUE constraint. Use INSERT OR REPLACE for upsert behaviour. |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-010 | Database MUST be stored at `{DATA_DIR}/paige.db` | High |
| FR-011 | All tables MUST be created on startup using `CREATE TABLE IF NOT EXISTS` | High |
| FR-012 | Database MUST use WAL mode for concurrent read/write support | High |
| FR-013 | All database access MUST use Kysely with typed interfaces for each table | High |
| FR-014 | `sessions` table: id (TEXT PK), project_dir, issue_number (INTEGER), issue_title, status, started_at, ended_at | High |
| FR-015 | `plans` table: id (TEXT PK), session_id (FK→sessions), raw_plan_text, created_at | High |
| FR-016 | `phases` table: id (TEXT PK), plan_id (FK→plans), number, title, description, status, hint_level, expected_files (JSON), started_at, completed_at | High |
| FR-017 | `phase_hints` table: id (TEXT PK), phase_id (FK→phases), type, path, start_line, end_line, style, hover_text | High |
| FR-018 | `dreyfus_assessments` table: id (TEXT PK), skill_area (UNIQUE), stage, confidence (REAL), evidence, assessed_at | High |
| FR-019 | `knowledge_gaps` table: id (TEXT PK), session_id (FK→sessions), topic, severity, evidence, related_concepts (JSON), frequency, last_encountered_at, addressed | High |
| FR-020 | `kata_specs` table: id (TEXT PK), knowledge_gap_id (FK→knowledge_gaps), title, description, scaffolding_code, instructor_notes, constraints (JSON), user_attempts (JSON) | High |
| FR-021 | `progress_events` table: id (TEXT PK), phase_id (FK→phases), event_type, data (JSON), created_at | High |
| FR-022 | Database module MUST export typed CRUD functions for each entity | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-006 | Fresh database creates all tables | 10 tables exist after startup (verified by sqlite_master query) — 8 from Story 2, 2 from Story 4 |
| SC-007 | Full session lifecycle round-trips | Create session → plan → phases → hints → progress → gaps → kata, read all back correctly |
| SC-008 | Kysely types match schema | TypeScript compilation passes in strict mode with no type errors |
| SC-009 | WAL mode is active | `PRAGMA journal_mode` returns `wal` |

---

### User Story 3 — File System Layer (Priority: P1)

**Revision**: v1.0

**As** the backend server, **I** own all file I/O operations — reading files, writing files (Electron-only), maintaining an in-memory buffer cache, watching for filesystem changes, computing diffs, and scanning the project tree, **so that** both Claude Code (via MCP) and Electron (via WebSocket) have a single, authoritative source for file state.

**Packages**:
- `chokidar` — Cross-platform file system watcher
- `diff` — Diff computation library
- `@types/diff` — TypeScript types for diff

**Key Decisions**: D18, D19, D20

**Capabilities**:

| Capability | Description | Consumers |
|------------|-------------|-----------|
| File reading | Read files from `PROJECT_DIR`, return content + detected language | MCP tools, WebSocket |
| File writing | Write files to disk (Electron-only, NOT exposed to MCP) | WebSocket only |
| Buffer cache | In-memory `Map<path, BufferEntry>` updated by Electron's debounced `buffer_update` | MCP tools, Observer |
| Diff computation | Unified diff between buffer cache and saved file (via `diff` library) | MCP tools (`paige_get_diff`), `UserPromptSubmit` hook |
| Project tree scan | Recursive directory listing, excluding noise dirs | WebSocket (pushed on session start) |
| File watching | Chokidar watches `PROJECT_DIR` for add/change/unlink events | WebSocket (real-time tree updates) |

**Buffer Cache Structure**:
```typescript
interface BufferEntry {
  content: string;
  cursorPosition: { line: number; column: number };
  dirty: boolean;
  lastUpdated: string; // ISO 8601
}
```

**Security**: All file operations validate that the resolved path is within `PROJECT_DIR`. Path traversal attempts are rejected before any I/O occurs.

#### Acceptance Scenarios

**Scenario 3.1: File read**
- **Given** a valid file path within `PROJECT_DIR`
- **When** `readFile(path)` is called
- **Then** the file content is returned as a string
- **And** a detected language identifier is returned (based on file extension)

**Scenario 3.2: File write (Electron-only)**
- **Given** file content and a valid path within `PROJECT_DIR`
- **When** `writeFile(path, content)` is called from the Electron tier
- **Then** the file is written to disk
- **And** the buffer cache entry is updated with `dirty: false`
- **And** the write is acknowledged

**Scenario 3.3: Buffer cache update**
- **Given** Electron sends a `buffer_update` message with `{ path, content, cursorPosition }`
- **When** the file system layer processes it
- **Then** the buffer cache entry is updated with `{ content, cursorPosition, dirty: true, lastUpdated: <now> }`

**Scenario 3.4: Buffer cache read**
- **Given** a file has been opened and buffer-updated
- **When** `getBuffer(path)` is called
- **Then** the current `BufferEntry` is returned
- **And** if no buffer exists for the path, `null` is returned

**Scenario 3.5: Diff computation**
- **Given** a file exists on disk and has a dirty buffer in the cache
- **When** `getDiff(path)` is called
- **Then** a unified diff string is returned showing the differences
- **And** if the buffer is clean or missing, an empty diff is returned

**Scenario 3.6: Project tree scan**
- **Given** `PROJECT_DIR` exists with files and subdirectories
- **When** `getProjectTree()` is called
- **Then** a recursive directory structure is returned
- **And** common noise directories are excluded (`node_modules`, `.git`, `dist`, `build`, `coverage`)

**Scenario 3.7: File watcher initialization**
- **Given** the server starts with a valid `PROJECT_DIR`
- **When** the file watcher initialises
- **Then** chokidar begins watching for file add, change, and unlink events

**Scenario 3.8: File watcher detects change**
- **Given** the file watcher is running
- **When** a file in `PROJECT_DIR` is created, modified, or deleted externally
- **Then** a file change event is emitted
- **And** the WebSocket layer can consume it to push tree updates to Electron

**Scenario 3.9: Path traversal rejection**
- **Given** a path that resolves outside `PROJECT_DIR` (e.g. `../../etc/passwd`)
- **When** any file operation is attempted with that path
- **Then** it is rejected with a clear error before any I/O occurs

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-10 | Path traversal attempt (`../../etc/passwd`) | Resolved path checked against `PROJECT_DIR`. Rejected with descriptive error. |
| EC-11 | Symlinks pointing outside `PROJECT_DIR` | Resolve real path; reject if outside project boundary. |
| EC-12 | Binary files (images, compiled assets) | Detect via file extension. Skip buffer cache and diff. Flag as binary on read. |
| EC-13 | File deleted while open in editor | Buffer cache retains content. Watcher emits unlink event. Graceful handling on next read/diff. |
| EC-14 | Very large files (>10MB) | No special handling for hackathon. Noted as future concern. |
| EC-15 | Concurrent buffer updates for same file | Last write wins — `Map.set()` is synchronous. |
| EC-16 | File watcher events during shutdown | Watcher closed during graceful shutdown; pending events discarded. |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-023 | All file paths MUST be validated to resolve within `PROJECT_DIR` before any I/O. Reject with descriptive error if path escapes boundary. | High |
| FR-024 | `readFile(path)` MUST return file content (string) and detected language identifier (by extension). | High |
| FR-025 | `writeFile(path, content)` MUST write to disk and set buffer cache `dirty: false`. Electron-initiated only. | High |
| FR-026 | `writeFile` MUST NOT be callable from MCP tools. Read-only enforcement (Constitution Principle I). | High |
| FR-027 | Buffer cache MUST be `Map<string, BufferEntry>` with `{ content, cursorPosition: {line, column}, dirty, lastUpdated }`. | High |
| FR-028 | Buffer cache MUST update on `buffer_update` messages, setting `dirty: true` and `lastUpdated` to ISO 8601 now. | High |
| FR-029 | Buffer cache MUST set `dirty: false` when file is saved via `writeFile`. | High |
| FR-030 | `getBuffer(path)` MUST return current `BufferEntry` or `null`. | High |
| FR-031 | `getDiff(path)` MUST return unified diff between saved file and buffer content. Empty string if clean/missing. | High |
| FR-032 | Diff computation MUST use the `diff` npm library (not git diff or shell commands). | High |
| FR-033 | `getProjectTree()` MUST return recursive directory structure of `PROJECT_DIR`. | High |
| FR-034 | `getProjectTree()` MUST exclude: `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.cache`. | High |
| FR-035 | File watcher MUST use chokidar to watch `PROJECT_DIR` for add, change, and unlink events. | High |
| FR-036 | File watcher MUST emit events consumable by WebSocket layer for tree updates to Electron. | High |
| FR-037 | File watcher MUST be closed during graceful shutdown (Story 1 SIGINT/SIGTERM handler). | High |
| FR-038 | Binary files (detected by extension) MUST be skipped for buffer cache and diff operations. | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-010 | File read works | `readFile` returns content for a known file within `PROJECT_DIR` |
| SC-011 | File write works | `writeFile` writes to disk and sets buffer `dirty: false` |
| SC-012 | Buffer cache tracks state | After `buffer_update`, cache has correct `content`, `cursorPosition`, `dirty`, `lastUpdated` |
| SC-013 | Diff computation works | `getDiff` returns meaningful unified diff for modified buffer |
| SC-014 | Project tree is correct | `getProjectTree` returns expected structure, excludes `node_modules` and `.git` |
| SC-015 | File watcher detects changes | Chokidar detects a newly created file and emits an event |
| SC-016 | Path traversal is rejected | Path resolving outside `PROJECT_DIR` is rejected with clear error |

---

### User Story 4 — Action Logging & Observability (Priority: P1)

**Revision**: v1.0

**As** the backend server, **I** log every significant user action and system event to a queryable timeline, and every Claude API call to a dedicated cost-tracking table, **so that** the Observer has real-time coaching signals, sessions are replayable, and API budget is trackable.

**Packages**: No new packages. Uses existing SQLite/Kysely from Story 2.

**Key Decisions**: D21, D22, D23

**New Tables (2)**:

| Table | Columns |
|-------|---------|
| `action_log` | id (TEXT PK), session_id (TEXT FK→sessions), action_type (TEXT), data (TEXT JSON nullable), created_at (TEXT ISO8601) |
| `api_call_log` | id (TEXT PK), session_id (TEXT FK→sessions), call_type (TEXT), model (TEXT), input_hash (TEXT), latency_ms (INTEGER), input_tokens (INTEGER), output_tokens (INTEGER), cost_estimate (REAL), created_at (TEXT ISO8601) |

**Logging Interface**:
- `logAction(sessionId, actionType, data?)` — inserts into `action_log`
- `logApiCall(sessionId, callType, metadata)` — inserts into `api_call_log`

**Action Types Catalog (24 types)**:

| Category | Action Type | WS Trigger | Data (JSON) | Observer? |
|----------|-------------|------------|-------------|-----------|
| File | `file_open` | `file:open` | `{ path }` | Yes |
| File | `file_save` | `file:save` | `{ path, charCount }` | Yes |
| File | `file_close` | `file:close` | `{ path }` | Yes |
| Buffer | `buffer_summary` | 30s timer | `{ path, editCount, charDelta, charCount }` | Yes |
| Buffer | `buffer_significant_change` | Delta threshold | `{ path, previousCharCount, newCharCount, delta }` | Yes |
| Editor | `tab_switch` | `editor:tab_switch` | `{ fromPath, toPath }` | Yes |
| Editor | `selection` | `editor:selection` | `{ path, range, textLength }` | Yes |
| Hints | `hint_level_change` | `hints:level_change` | `{ level, previousLevel }` | Yes |
| User | `explain_requested` | `user:explain` | `{ path, range }` | Yes |
| User | `review_requested` | `user:review` | `{}` | Yes |
| User | `idle_start` | `user:idle_start` | `{ lastActionTimestamp }` | Yes |
| User | `idle_end` | `user:idle_end` | `{}` | Yes |
| Session | `session_started` | `session:start` | `{ issueNumber }` | No |
| Session | `session_resumed` | `session:resume` | `{ previousSessionId }` | No |
| Session | `session_ended` | `session:end` | `{ status, durationMs }` | No |
| Coaching | `phase_started` | Phase → active | `{ phaseId, phaseNumber, title }` | Yes |
| Coaching | `phase_completed` | Phase → complete | `{ phaseId, phaseNumber, title }` | Yes |
| Coaching | `coaching_message` | Backend sends msg | `{ messageType }` | No |
| Observer | `nudge_sent` | Observer nudges | `{ signal, confidence }` | No |
| Observer | `nudge_suppressed` | Observer suppresses | `{ signal, confidence, reason }` | No |
| Observer | `observer_muted` | `observer:mute` | `{ muted }` | No |
| MCP | `mcp_tool_call` | MCP tool invoked | `{ toolName, sessionId }` | No |
| Visual | `decorations_applied` | Backend sends decorations | `{ path, count }` | No |
| Visual | `file_hints_applied` | Backend sends hints | `{ paths }` | No |

**Skipped** (too noisy, no coaching signal): `editor:scroll`, `terminal:ready`, `terminal:resize`, `explorer:expand_dir`, `explorer:collapse_dir`, `dashboard:request`, `dashboard:stats_period`, `connection:hello`.

**Buffer Update Logging Strategy** (D23):
- **Periodic summaries** (~30s): Timer flushes `buffer_summary` entries for each dirty file with edit count, character delta, and char count. Updates `lastLoggedCharCount`.
- **Significant change detection**: On each `buffer:update`, if `|newCharCount - lastLoggedCharCount|` exceeds >50% change or >500 chars absolute, log `buffer_significant_change` immediately.
- **In-memory state**: `Map<filePath, BufferLogState>` where `BufferLogState = { lastLoggedCharCount, editCountSinceLastLog }`.

#### Acceptance Scenarios

**Scenario 4.1: Action logging**
- **Given** a session is active
- **When** any loggable user action occurs (e.g. `file:open`)
- **Then** a row is inserted into `action_log` with session_id, action_type, JSON data, and ISO 8601 timestamp

**Scenario 4.2: Buffer summary (periodic)**
- **Given** a session is active and the user is editing a file
- **When** 30 seconds elapse since the last buffer summary
- **Then** a `buffer_summary` action is logged for each dirty file
- **And** `lastLoggedCharCount` is updated

**Scenario 4.3: Buffer significant change (immediate)**
- **Given** a session is active and the user is editing
- **When** a `buffer:update` arrives with char count differing from `lastLoggedCharCount` by >50% or >500 chars
- **Then** a `buffer_significant_change` action is logged immediately

**Scenario 4.4: API call logging**
- **Given** a session is active
- **When** a Claude API call completes
- **Then** a row is inserted into `api_call_log` with session_id, call_type, model, input_hash, latency_ms, input_tokens, output_tokens, cost_estimate, and timestamp

**Scenario 4.5: Observer queries recent actions**
- **Given** a session has accumulated actions
- **When** the Observer queries for recent actions
- **Then** it can retrieve the last N actions by session_id, filter by action_type, and compute time-since-last

**Scenario 4.6: Budget aggregation**
- **Given** a session has accumulated API calls
- **When** the dashboard queries for budget data
- **Then** total cost, cost by model, and average latency are computable via SQL aggregations

**Scenario 4.7: Clean buffer no-op**
- **Given** the 30s buffer summary timer fires
- **When** no files are dirty
- **Then** no action is logged

**Scenario 4.8: Session end cleanup**
- **Given** a session ends
- **When** `session_ended` is logged
- **Then** the buffer summary timer for that session is cleared

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-17 | Action logged with no active session | Reject gracefully — log warning, discard. No crash. |
| EC-18 | Buffer summary timer fires during shutdown | Timer cleared during graceful shutdown. |
| EC-19 | API call fails before completion | Log with latency_ms = -1, zero tokens/cost. Failure is a useful signal. |
| EC-20 | Very long session (thousands of actions) | No practical limit for hackathon. SQLite handles this. |
| EC-21 | Rapid-fire actions (fast tab switching) | Each logged individually. Callers debounce, not the logger. |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-039 | `action_log` table: id (TEXT PK), session_id (FK→sessions), action_type, data (JSON nullable), created_at | High |
| FR-040 | `api_call_log` table: id (TEXT PK), session_id (FK→sessions), call_type, model, input_hash, latency_ms (INT), input_tokens (INT), output_tokens (INT), cost_estimate (REAL), created_at | High |
| FR-041 | `logAction(sessionId, actionType, data?)` MUST insert into `action_log` | High |
| FR-042 | `logApiCall(sessionId, callType, metadata)` MUST insert into `api_call_log` | High |
| FR-043 | Buffer summary timer MUST flush every ~30s for dirty files, tracking `lastLoggedCharCount` | High |
| FR-044 | Buffer significant change MUST log immediately when delta exceeds >50% or >500 chars | High |
| FR-045 | Observer MUST be able to query recent actions by session_id and action_type | High |
| FR-046 | Dashboard MUST be able to aggregate `api_call_log` for cost and latency | High |
| FR-047 | Buffer summary timer MUST be cleared on session end and during graceful shutdown | High |
| FR-048 | All 27 action types MUST be supported (24 from Story 4 + explain_completed, review_completed from Story 11 + dashboard_loaded from Story 12) | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-017 | Action logging works | `logAction` inserts row with correct session_id, type, data, timestamp |
| SC-018 | Buffer summary periodic | Timer logs `buffer_summary` for dirty files after 30s |
| SC-019 | Buffer significant change detection | Immediate log when delta threshold exceeded |
| SC-020 | API call logging works | `logApiCall` inserts row with all metadata fields |
| SC-021 | Actions queryable | Recent actions retrievable by session_id and action_type |
| SC-022 | Budget aggregation | `SUM(cost_estimate)` returns correct total for session |

---

### User Story 5 — WebSocket Protocol (Priority: P1)

**Revision**: v1.0

**As** the backend server, **I** implement a typed message router that dispatches all client→server WebSocket messages to handler functions, and provide a broadcast function for server→client messages, **so that** Electron and the backend communicate via a well-defined, type-safe protocol.

**Packages**: No new packages. Uses `@hono/node-ws` from Story 1.

**Key Decisions**: D24, D25, D26

**Architecture**:

```
Electron ──ws──→ JSON parse → Router (Map<type, handler>) → Handler → broadcast() ──ws──→ Electron
                                                              ↓
                                                    File System (Story 3)
                                                    Action Logger (Story 4)
                                                    Database (Story 2)
```

**Message Envelope**:
```typescript
interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  id?: string;        // Optional correlation ID for request/response pairs
  timestamp: number;  // Unix ms
}
```

**Period Type** (for dashboard stats):
```typescript
type Period = "7d" | "30d" | "all";
// "7d" = last 7 days (This Week)
// "30d" = last 30 days (This Month)
// "all" = all time
```

**Handler Context**:
```typescript
interface HandlerContext {
  broadcast: (message: WebSocketMessage) => void;
  fileSystem: FileSystemModule;
  actionLogger: ActionLogger;
  db: Database;
  sessionId?: string;
}
```

**Connection Metadata**:
```typescript
interface ConnectionMeta {
  ws: WSContext;
  version: string;
  platform: string;
  windowSize: { width: number; height: number };
  connectedAt: string; // ISO 8601
}
```

**Handler Implementation Status**:

| Message Type | Handler | Depends On |
|---|---|---|
| `connection:hello` | Full | Story 1 |
| `file:open` | Full | Story 3, 4 |
| `file:save` | Full | Story 3, 4 |
| `file:close` | Full | Story 4 |
| `buffer:update` | Full | Story 3, 4 |
| `editor:tab_switch` | Full | Story 4 |
| `editor:selection` | Full | Story 4 |
| `editor:scroll` | No-op | — |
| `explorer:expand_dir` | No-op | — |
| `explorer:collapse_dir` | No-op | — |
| `hints:level_change` | Full | Story 4 |
| `terminal:ready` | Minimal | Store dims |
| `terminal:resize` | Minimal | Update dims |
| `user:idle_start` | Full | Story 4 |
| `user:idle_end` | Full | Story 4 |
| `session:start` | Stub | Story 2 + later |
| `session:resume` | Stub | Story 2 + later |
| `session:end` | Stub | Story 2 + later |
| `dashboard:request` | Full | Story 12 |
| `dashboard:refresh_issues` | Full | Story 12 |
| `user:explain` | Full | Story 11 |
| `user:review` | Full | Story 11 |
| `observer:mute` | Stub | Story 10 |

#### Acceptance Scenarios

**Scenario 5.1: Connection handshake**
- **Given** Electron connects to `/ws`
- **When** it sends `connection:hello` with `{ version, platform, windowSize }`
- **Then** the server stores connection metadata
- **And** responds with `connection:init` containing `{ sessionId, capabilities, featureFlags }`

**Scenario 5.2: File open dispatch**
- **Given** an established WebSocket connection
- **When** Electron sends `file:open` with `{ path }`
- **Then** the router dispatches to the handler
- **And** handler calls `readFile(path)`, logs `file_open` action
- **And** broadcasts `fs:content` with `{ path, content, language, lineCount }`

**Scenario 5.3: File save dispatch**
- **Given** an established connection
- **When** Electron sends `file:save` with `{ path, content }`
- **Then** handler calls `writeFile(path, content)`, logs `file_save`
- **And** broadcasts `fs:save_ack` with `{ path, success: true, timestamp }`
- **And** on failure, broadcasts `fs:save_error` with `{ path, error }`

**Scenario 5.4: Buffer update dispatch**
- **Given** an established connection
- **When** Electron sends `buffer:update` with `{ path, content, cursorPosition, selections }`
- **Then** handler updates buffer cache (Story 3), updates buffer log state (Story 4)
- **And** checks for significant character delta
- **And** no response is broadcast

**Scenario 5.5: Action-loggable messages**
- **Given** an established connection
- **When** Electron sends any action-loggable message (e.g. `editor:tab_switch`, `hints:level_change`, `user:idle_start`)
- **Then** handler logs the appropriate action type via `logAction`

**Scenario 5.6: File watcher → tree update broadcast**
- **Given** chokidar detects a file change in `PROJECT_DIR`
- **When** the file watcher emits an event
- **Then** the WebSocket layer broadcasts `fs:tree_update` with `{ action, path, newPath? }`

**Scenario 5.7: Stub handler response**
- **Given** an established connection
- **When** Electron sends a message for a stub handler (e.g. `dashboard:request`)
- **Then** handler logs a "not yet implemented" warning
- **And** sends `connection:error` with `{ code: "NOT_IMPLEMENTED", message, context }`

**Scenario 5.8: Unknown message type**
- **Given** an established connection
- **When** Electron sends a message with an unknown type
- **Then** the router logs a warning and ignores it (no crash)

**Scenario 5.9: Broadcast API**
- **Given** the backend needs to push a message (from MCP tool, Observer, or internal event)
- **When** `broadcast(message)` is called
- **Then** the message is JSON-serialized and sent to all connected clients

**Scenario 5.10: Connection disconnect cleanup**
- **Given** a WebSocket connection disconnects
- **When** the `onClose` handler fires
- **Then** connection metadata is removed from the tracking Map

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-22 | Malformed JSON from client | Parse error caught, log warning, send `connection:error`. No crash. |
| EC-23 | Valid type but invalid payload | Handler validates, sends `connection:error` with details. |
| EC-24 | Broadcast with no connected clients | No-op (iterate empty Map). |
| EC-25 | Multiple Electron windows connect | All receive broadcasts (D26). Each stores own metadata. |
| EC-26 | `file:open` for non-existent path | Handler catches readFile error, broadcasts `connection:error`. |
| EC-27 | `file:save` fails (disk full, permissions) | Handler catches error, broadcasts `fs:save_error`. |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-049 | All WebSocket messages MUST be JSON with `{ type: string, payload: object }`. | High |
| FR-050 | TypeScript interfaces MUST be defined for all 55 message types (23 client→server, 32 server→client — includes additive revisions from Stories 9, 10, 11, 12). | High |
| FR-051 | Router MUST be `Map<string, MessageHandler>` dispatching inbound messages. | High |
| FR-052 | Handler signature: `(payload: T, context: HandlerContext) => Promise<void>`. | High |
| FR-053 | `connection:hello` MUST store metadata and respond with `connection:init`. | High |
| FR-054 | `file:open` MUST call readFile, log action, broadcast `fs:content`. | High |
| FR-055 | `file:save` MUST call writeFile, log action, broadcast `fs:save_ack`/`fs:save_error`. | High |
| FR-056 | `buffer:update` MUST update buffer cache, buffer log state, check delta threshold. | High |
| FR-057 | All action-loggable handlers MUST call `logAction`. | High |
| FR-058 | `broadcast(message)` MUST send to all connected clients. | High |
| FR-059 | File watcher events MUST trigger `fs:tree_update` broadcasts. | High |
| FR-060 | Unknown message types MUST be logged and ignored. | High |
| FR-061 | Malformed JSON MUST be caught, logged, and responded to with `connection:error`. | High |
| FR-062 | Stub handlers MUST log warning and send `connection:error` code `NOT_IMPLEMENTED`. | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-023 | Handshake completes | `connection:hello` → `connection:init` with metadata stored |
| SC-024 | File open dispatches | readFile called, action logged, `fs:content` broadcast |
| SC-025 | Buffer update dispatches | Buffer cache and log state updated, no broadcast |
| SC-026 | Broadcast delivers | Message sent to all connected clients |
| SC-027 | Unknown type handled | Logged and ignored, no crash |
| SC-028 | Tree update broadcast | File watcher event triggers `fs:tree_update` |

#### Comprehensive WebSocket Message Catalog

**Total**: 55 message types (23 client→server, 32 server→client)

**Server → Client (32 messages)**:

| Type | Payload Shape | Source Story | Description |
|------|---------------|--------------|-------------|
| `connection:init` | `{ sessionId, capabilities, featureFlags }` | 5 | Handshake response |
| `connection:error` | `{ code, message, context }` | 5 | Backend error notification |
| `dashboard:dreyfus` | `{ skillAreas: [{ name, stage, score }], overallStage }` | 12 | Dreyfus radar data |
| `dashboard:state` | `{ dreyfus, stats, inProgress, issues, challenges, materials }` | 12 | Full dashboard state |
| `dashboard:issues` | `{ issues: [{ number, title, ... }] }` | 12 | GitHub issues |
| `dashboard:issues_error` | `{ error }` | 12 | GitHub fetch failure |
| `fs:tree` | `{ root: TreeNode }` | 5 | Full file tree |
| `fs:tree_update` | `{ action, path, newPath? }` | 5 | Incremental tree change |
| `fs:content` | `{ path, content, language, lineCount }` | 5 | File content response |
| `fs:save_ack` | `{ path, success, timestamp }` | 5 | Save confirmation |
| `fs:save_error` | `{ path, error }` | 5 | Save failure |
| `editor:decorations` | `{ path, decorations: [...] }` | 6 | Paige-controlled decorations |
| `editor:clear_decorations` | `{ path? }` | 6 | Remove decorations |
| `editor:hover_hint` | `{ path, range, hintText }` | 6 | Hover popover content |
| `editor:open_file` | `{ path, content, language, lineCount }` | 6 | MCP-triggered file open |
| `editor:highlight_lines` | `{ path, start, end, style, hoverText? }` | 6 | MCP-triggered line highlights |
| `editor:clear_highlights` | `{ path? }` | 6 | MCP-triggered clear |
| `explorer:hint_files` | `{ hints: [{ path, style, directories? }] }` | 6 | File tree glow triggers |
| `explorer:clear_hints` | `{}` | 6 | Remove all file glows |
| `session:started` | `{ issueContext, phases, hintLevel, openFiles? }` | 9 | Session initialized |
| `session:resumed` | `{ restoredState }` | 9 | Session restored |
| `session:ended` | `{ summary }` | 9 | Session wrap-up |
| `coaching:phase_update` | `{ phase, status, description }` | 6 | Phase state change |
| `coaching:message` | `{ message, type, anchor? }` | 6 | Coaching message |
| `coaching:issue_context` | `{ number, title, summary, labels, url }` | 6 | Issue details |
| `coaching:plan_ready` | `{ planId, phases, memoryConnection, estimatedDifficulty }` | 9 | Pipeline completed |
| `observer:nudge` | `{ signal, confidence, context }` | 10 | Nudge for PTY injection |
| `observer:status` | `{ active, muted, lastEvaluation }` | 10 | Observer state |
| `explain:response` | `{ explanation }` | 11 | Explain This response |
| `review:response` | `{ review, suggestions }` | 11 | Review response |
| `practice:kata_load` | `{ kata, constraints }` | 11 | Practice kata |
| `practice:solution_review` | `{ review, level, passed, constraintsUnlocked }` | 11 | Solution feedback |

**Client → Server (23 messages)**:

| Type | Payload Shape | Source Story | Description |
|------|---------------|--------------|-------------|
| `connection:hello` | `{ version, platform, windowSize }` | 5 | Initial handshake |
| `dashboard:request` | `{ statsPeriod?: Period }` | 12 | Request dashboard data |
| `dashboard:refresh_issues` | `{}` | 12 | Re-fetch GitHub issues |
| `session:start` | `{ issueNumber }` | 9 | User selected issue |
| `session:resume` | `{ sessionId }` | 9 | Resume session |
| `session:end` | `{}` | 9 | End session |
| `file:open` | `{ path }` | 5 | User opened file |
| `file:save` | `{ path, content }` | 5 | User saved file |
| `file:close` | `{ path }` | 5 | User closed tab |
| `buffer:update` | `{ path, content, cursorPosition, selections }` | 5 | Buffer edit |
| `editor:tab_switch` | `{ fromPath, toPath }` | 5 | Tab switched |
| `editor:selection` | `{ path, range, textLength }` | 5 | Selection changed |
| `explorer:expand_dir` | `{ path }` | 5 | Directory expanded |
| `explorer:collapse_dir` | `{ path }` | 5 | Directory collapsed |
| `hints:level_change` | `{ level, previousLevel }` | 5 | Hint slider moved |
| `user:explain` | `{ path, range, selectedText }` | 11 | Explain This |
| `user:review` | `{}` | 11 | Review My Work |
| `user:idle_start` | `{ lastActionTimestamp }` | 10 | User went idle |
| `user:idle_end` | `{}` | 10 | User returned |
| `observer:mute` | `{ muted }` | 10 | Toggle Observer |
| `practice:submit_solution` | `{ kataId, code, activeConstraints }` | 11 | Submit practice |
| `terminal:input` | `{ input }` | 5 | Terminal stdin |
| `terminal:resize` | `{ cols, rows }` | 5 | Terminal resized |

---

### User Story 6 — MCP Tool Surface (Priority: P1)

**Revision**: v1.0

**As** the backend server, **I** register 12 MCP tools that Claude Code calls to read session state, editor buffers, and diffs, and to control the Electron UI (highlights, hints, phase updates, coaching messages), **so that** Paige can coach effectively through a well-defined, typed tool interface.

**Packages**: No new packages. Uses `@modelcontextprotocol/server` from Story 1.

**Key Decisions**: D27, D28, D29, D30

**Tool Catalog (12 tools)**:

*Read tools* — return data directly in MCP response:

| Tool | Input | Output |
|------|-------|--------|
| `paige_get_buffer` | `{ path }` | `BufferEntry \| null` |
| `paige_get_open_files` | `{}` | `{ files: string[] }` |
| `paige_get_diff` | `{ path? }` | `{ diffs: Array<{ path, diff }> }` |
| `paige_get_session_state` | `{ include?: StateItem[] }` | Filtered state snapshot (defaults to all) |

*UI control tools* — broadcast WebSocket message to Electron, return ack:

| Tool | Input | WebSocket Broadcast | Effect |
|------|-------|-------------------|--------|
| `paige_open_file` | `{ path }` | `editor:open_file` | Open/focus file in Monaco |
| `paige_highlight_lines` | `{ path, start, end, style, hoverText? }` | `editor:highlight_lines` | Add line decorations (accumulate) |
| `paige_clear_highlights` | `{ path? }` | `editor:clear_highlights` | Remove decorations (per-file or all) |
| `paige_hint_files` | `{ hints: [{ path, style, directories? }] }` | `explorer:hint_files` | Highlight files in explorer tree (per-file styling) |
| `paige_clear_hints` | `{}` | `explorer:clear_hints` | Remove all tree hints |
| `paige_update_phase` | `{ phase, status }` | `coaching:phase_update` | Update phase in SQLite + broadcast |
| `paige_show_message` | `{ message, type, anchor? }` | `coaching:message` | Display coaching message (toast or anchored comment balloon) |
| `paige_show_issue_context` | `{ number, title, summary, labels, url }` | `coaching:issue_context` | Update issue context panel with full GitHub issue metadata |

**Session Scoping**: Tools assume "the current active session" (D27). One user, one session at a time. Tools requiring session context return an MCP error if no session is active.

**StateItem Enum** (for `paige_get_session_state`):

| Item | Source | Returns |
|------|--------|---------|
| `open_files` | Open files set (Story 6) | `string[]` |
| `buffers` | Buffer cache (Story 3) | `Array<{ path, content, cursorPosition, dirty }>` |
| `diffs` | Diff computation (Story 3) | `Array<{ path, diff }>` |
| `phase` | SQLite phases (Story 2) | `{ id, number, title, status, hintLevel } \| null` |
| `plan` | SQLite plans (Story 2) | `{ id, phases: Array<{ number, title, status }> } \| null` |
| `progress` | SQLite progress_events (Story 2) | `Array<{ eventType, data, createdAt }>` |
| `hints` | SQLite phase_hints (Story 2) | `{ fileHints: [...], lineHints: [...] }` |
| `session` | SQLite sessions (Story 2) | `{ id, projectDir, issueNumber?, issueTitle?, startedAt } \| null` |
| `dreyfus` | SQLite dreyfus_assessments (Story 2) | `Array<{ skillArea, stage, confidence }>` |

**New Backend State**: Open files set (`Set<string>`) updated by `file:open` (add), `file:close` (remove), and `paige_open_file` (add + broadcast) (D29).

**Highlight Behaviour**: Ephemeral + accumulate (D28). Highlights broadcast to Electron but not persisted in SQLite. Multiple `paige_highlight_lines` calls add decorations. `paige_clear_highlights` resets. The coaching pipeline (Story 9) handles persistence via `phase_hints` table separately.

**Action Logging**: Every MCP tool call logged as `mcp_tool_call` (Story 4). Additionally:
- `paige_update_phase` → `phase_started` or `phase_completed`
- `paige_show_message` → `coaching_message`
- `paige_hint_files` → `file_hints_applied`
- `paige_highlight_lines` → `decorations_applied`

**Read-Only Enforcement** (Constitution Principle I, layer 3): The MCP tool surface exposes NO file-write tools. `paige_open_file` reads and broadcasts — it does not write. `paige_update_phase` writes to SQLite (phase status), not the filesystem.

#### Acceptance Scenarios

**Scenario 6.1: Get buffer — file with dirty edits**
- **Given** a file has a dirty buffer in the cache (Story 3)
- **When** Claude Code calls `paige_get_buffer({ path: "src/auth.ts" })`
- **Then** the tool returns `{ path, content, cursorPosition, dirty: true, lastUpdated }`

**Scenario 6.2: Get buffer — no buffer exists**
- **Given** no buffer entry exists for a file
- **When** Claude Code calls `paige_get_buffer({ path: "unknown.ts" })`
- **Then** the tool returns `null`

**Scenario 6.3: Get open files — multi-source tracking**
- **Given** Electron has opened 3 files via `file:open` and Claude Code has opened 1 via `paige_open_file`
- **When** Claude Code calls `paige_get_open_files()`
- **Then** the tool returns all 4 paths

**Scenario 6.4: Get diff — specific file**
- **Given** a file has unsaved buffer edits
- **When** Claude Code calls `paige_get_diff({ path: "src/auth.ts" })`
- **Then** the tool returns `{ diffs: [{ path: "src/auth.ts", diff: "<unified diff>" }] }`

**Scenario 6.5: Get diff — all dirty files**
- **Given** 2 files have dirty buffers and 1 has a clean buffer
- **When** Claude Code calls `paige_get_diff({})` (no path)
- **Then** the tool returns diffs for the 2 dirty files only

**Scenario 6.6: Get session state — filtered**
- **Given** an active session with a plan, phases, and dirty buffers
- **When** Claude Code calls `paige_get_session_state({ include: ["phase", "diffs"] })`
- **Then** the tool returns only the `phase` and `diffs` fields

**Scenario 6.7: Get session state — all items**
- **Given** an active session
- **When** Claude Code calls `paige_get_session_state({})` (no include filter)
- **Then** the tool returns all 9 state items

**Scenario 6.8: Open file**
- **Given** a valid file path within `PROJECT_DIR`
- **When** Claude Code calls `paige_open_file({ path: "src/auth.ts" })`
- **Then** the backend reads the file (Story 3), adds path to open files set, logs `mcp_tool_call` (Story 4), broadcasts `editor:open_file` with `{ path, content, language, lineCount }`, and returns `{ success: true, path }`

**Scenario 6.9: Highlight lines — accumulate**
- **Given** an open file in Electron
- **When** Claude Code calls `paige_highlight_lines` twice with different line ranges
- **Then** both sets of decorations are active (accumulated, not replaced)
- **And** `decorations_applied` and `mcp_tool_call` are logged for each call
- **And** `editor:highlight_lines` is broadcast for each call

**Scenario 6.10: Clear highlights — per-file and all**
- **Given** decorations exist on multiple files
- **When** Claude Code calls `paige_clear_highlights({ path: "src/auth.ts" })`
- **Then** only decorations on `src/auth.ts` are cleared
- **And** calling `paige_clear_highlights({})` clears all decorations on all files

**Scenario 6.11: Hint files**
- **Given** files in the project tree
- **When** Claude Code calls `paige_hint_files({ paths: ["src/auth.ts", "src/handlers/oauth.ts"], style: "suggested" })`
- **Then** `file_hints_applied` and `mcp_tool_call` are logged
- **And** `explorer:hint_files` is broadcast with `{ paths, style }`

**Scenario 6.12: Clear hints**
- **Given** file hints are active in the explorer
- **When** Claude Code calls `paige_clear_hints()`
- **Then** `explorer:clear_hints` is broadcast

**Scenario 6.13: Update phase — activate**
- **Given** an active session with a plan, phase 1 has status "pending"
- **When** Claude Code calls `paige_update_phase({ phase: 1, status: "active" })`
- **Then** the phase row in SQLite is updated with `status: "active"` and `started_at: <now>`
- **And** `phase_started` and `mcp_tool_call` are logged (Story 4)
- **And** `coaching:phase_update` is broadcast with the updated phase data
- **And** the tool returns `{ success: true, phase: { id, number, title, status: "active" } }`

**Scenario 6.14: Update phase — complete**
- **Given** phase 1 has status "active"
- **When** Claude Code calls `paige_update_phase({ phase: 1, status: "complete" })`
- **Then** SQLite is updated with `status: "complete"` and `completed_at: <now>`
- **And** `phase_completed` and `mcp_tool_call` are logged

**Scenario 6.15: Show message**
- **Given** an active session
- **When** Claude Code calls `paige_show_message({ message: "Nice work!", type: "success" })`
- **Then** `coaching_message` and `mcp_tool_call` are logged
- **And** `coaching:message` is broadcast with `{ message, type }`

**Scenario 6.16: Show issue context**
- **Given** an active session
- **When** Claude Code calls `paige_show_issue_context({ title: "Fix OAuth race condition", summary: "..." })`
- **Then** `mcp_tool_call` is logged
- **And** `coaching:issue_context` is broadcast with `{ title, summary }`

**Scenario 6.17: No active session**
- **Given** no session is currently active
- **When** Claude Code calls any tool requiring session context (e.g. `paige_get_session_state`, `paige_update_phase`)
- **Then** the tool returns an MCP error: "No active session"

**Scenario 6.18: Non-existent file**
- **Given** Claude Code calls `paige_open_file` with a path that doesn't exist
- **When** `readFile` (Story 3) throws an error
- **Then** the tool returns an MCP error with the file path and reason
- **And** no WebSocket broadcast is sent

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-28 | `paige_open_file` for file already open in Electron | Broadcast `editor:open_file` anyway — Electron focuses existing tab |
| EC-29 | `paige_open_file` for path outside `PROJECT_DIR` | Story 3's path validation rejects. Tool returns MCP error. |
| EC-30 | `paige_highlight_lines` for file not open in Electron | Broadcast sent. Electron may ignore or queue until file opened. |
| EC-31 | `paige_update_phase` for non-existent phase number | Kysely query returns no match. Tool returns MCP error. |
| EC-32 | `paige_update_phase` for phase already in target status | No-op. Returns success with current state. |
| EC-33 | `paige_get_session_state` with empty include array | Treated as "all items" (same as omitting field). |
| EC-34 | `paige_get_diff` when no files have dirty buffers | Returns `{ diffs: [] }` (empty array, not error). |
| EC-35 | MCP tool called while Electron not connected | Read tools succeed. UI control tools broadcast to empty set (no-op). |
| EC-36 | Rapid successive `paige_highlight_lines` calls | Each processed and broadcast individually. Accumulation correct. |
| EC-37 | `paige_get_session_state` requesting "plan" when no plan exists | Returns `plan: null`. |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-063 | MCP tool surface MUST register all 14 tools on the McpServer instance (Story 1): 12 from Story 6 + 2 from Story 9 | High |
| FR-064 | Read tools MUST return data directly in the MCP tool response | High |
| FR-065 | UI control tools MUST broadcast corresponding WebSocket message AND return ack | High |
| FR-066 | `paige_get_buffer(path)` MUST return `BufferEntry` from Story 3's cache, or `null` | High |
| FR-067 | `paige_get_open_files()` MUST return all paths in the open files set | High |
| FR-068 | Open files set MUST be updated by `file:open` (add), `file:close` (remove), `paige_open_file` (add) | High |
| FR-069 | `paige_get_diff(path?)` MUST return diffs for specified file or all dirty files (Story 3 getDiff) | High |
| FR-070 | `paige_get_session_state({ include? })` MUST return only requested items. Defaults to all 9 if omitted/empty. | High |
| FR-071 | `paige_open_file(path)` MUST read file (Story 3), add to open set, broadcast `editor:open_file` | High |
| FR-072 | `paige_highlight_lines` MUST accumulate. Highlights are ephemeral (not persisted to SQLite). | High |
| FR-073 | `paige_clear_highlights(path?)` MUST clear decorations per-file or all files | High |
| FR-074 | `paige_hint_files(paths, style)` MUST broadcast `explorer:hint_files` | High |
| FR-075 | `paige_clear_hints()` MUST broadcast `explorer:clear_hints` | High |
| FR-076 | `paige_update_phase(phase, status)` MUST update SQLite, set timestamps, log phase action, broadcast | High |
| FR-077 | `paige_show_message(message, type)` MUST log `coaching_message` and broadcast `coaching:message` | High |
| FR-078 | `paige_show_issue_context(title, summary)` MUST broadcast `coaching:issue_context` | High |
| FR-079 | Every MCP tool call MUST be logged as `mcp_tool_call` via Story 4 | High |
| FR-080 | Tools requiring session context MUST return MCP error if no session active | High |
| FR-081 | MCP tool surface MUST NOT expose file-write tools (Constitution Principle I, layer 3) | High |
| FR-082 | 8 new server→client WebSocket message types MUST be defined for UI control broadcasts | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-029 | Buffer read works | `paige_get_buffer` returns correct state for file with unsaved edits |
| SC-030 | Open files tracked | `paige_get_open_files` returns correct set across Electron and MCP sources |
| SC-031 | All diffs returned | `paige_get_diff` with no path returns diffs for all dirty files |
| SC-032 | State filtering works | `paige_get_session_state` with `include: ["phase"]` returns only phase |
| SC-033 | File open works | `paige_open_file` reads file, adds to set, broadcasts `editor:open_file` |
| SC-034 | Highlights accumulate | Two `paige_highlight_lines` calls result in decorations on both ranges |
| SC-035 | Phase update works | `paige_update_phase` updates SQLite, logs action, broadcasts |
| SC-036 | No session error | Tool call with no active session returns MCP error |
| SC-037 | Bad file error | `paige_open_file` for non-existent file returns MCP error, no broadcast |
| SC-038 | All tools registered | All 14 tools callable via MCP POST to `/mcp` (12 Story 6 + 2 Story 9) |

---

### User Story 7 — Claude API Client (Priority: P2)

**Revision**: v1.0

**As** the backend server, **I** provide a typed, generic API client for making Claude API calls with structured output, model selection, cost tracking, and automatic logging, **so that** Stories 8–12 can make evaluative/analytical API calls without reimplementing infrastructure.

**Packages**:
- `@anthropic-ai/sdk` — Official Anthropic TypeScript SDK (auth, retries, types, `zodOutputFormat()` helper)
- `zod` — Runtime schema definition and TypeScript type inference for response schemas

**Key Decisions**: D31, D32, D33

#### Core Function

```typescript
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodSchema } from "zod";

type ModelTier = "haiku" | "sonnet";

interface CallApiOptions<T> {
  callType: string;              // e.g., "coach_agent", "observer_triage"
  model: ModelTier;
  systemPrompt: string;
  userMessage: string;
  responseSchema: ZodSchema<T>;  // Zod schema → zodOutputFormat() → API constraint
  sessionId: string;
  maxTokens?: number;            // default 4096
  tools?: Array<{ type: string; name: string }>;  // Connector tools (e.g., web_search) — D83, Story 12
}

async function callApi<T>(options: CallApiOptions<T>): Promise<T>;
```

**Model Mapping**:

| Tier | Model ID | Input ($/MTok) | Output ($/MTok) |
|------|----------|----------------|-----------------|
| `haiku` | `claude-haiku-4-5-20251001` | 0.80 | 4.00 |
| `sonnet` | `claude-sonnet-4-5-20250929` | 3.00 | 15.00 |

**Flow**:
1. Resolve `ModelTier` → model ID via `MODEL_MAP`
2. Create message via SDK with `output_config: { format: zodOutputFormat(schema) }`
3. Check `stop_reason` — throw on `"refusal"` or `"max_tokens"`
4. Parse `response.content[0].text` as JSON (guaranteed valid by API's constrained decoding)
5. Compute `cost_estimate` from `response.usage` × pricing constants
6. Log to `api_call_log` via `logApiCall()` (Story 4, FR-042)
7. On any error: log failure (latency_ms=-1, zero tokens/cost per EC-19), then throw

**Structured Outputs**: The Anthropic API supports constrained decoding via `output_config.format` with `type: "json_schema"`. The TypeScript SDK provides `zodOutputFormat()` which converts Zod schemas to JSON Schema automatically. This guarantees schema-compliant JSON responses — no validation retries needed.

**Prompt Template Module Convention** (for Stories 8–12):

```typescript
// prompts/coach-agent.ts
import { z } from "zod";

export const SYSTEM_PROMPT = `You are Paige's coaching engine...`;

export const responseSchema = z.object({
  phases: z.array(z.object({ /* ... */ })),
  memory_connection: z.string().nullable(),
  estimated_difficulty: z.string(),
});

export type CoachAgentResponse = z.infer<typeof responseSchema>;

export function assembleUserMessage(plan: PlanOutput, dreyfus: string, memories: Memory[]): string {
  return JSON.stringify({ plan, dreyfus_stage: dreyfus, relevant_memories: memories });
}
```

#### Acceptance Scenarios

**Scenario 7.1: Successful API call with structured output**
- **Given** the server is running and `ANTHROPIC_API_KEY` is valid
- **When** `callApi()` is called with a model tier, system prompt, user message, and Zod response schema
- **Then** the SDK creates a message with `output_config: { format: zodOutputFormat(schema) }`
- **And** the response is valid JSON matching the schema
- **And** the parsed, typed result is returned to the caller

**Scenario 7.2: API call logging on success**
- **Given** a session is active
- **When** `callApi()` completes successfully
- **Then** a row is inserted into `api_call_log` with call_type, model (full ID), input_hash, latency_ms (positive), input_tokens, output_tokens, cost_estimate, and created_at

**Scenario 7.3: API call logging on failure**
- **Given** a session is active
- **When** `callApi()` fails (transport error, refusal, max_tokens)
- **Then** a row is inserted into `api_call_log` with latency_ms = -1, zero tokens, zero cost (per EC-19)
- **And** the error is thrown to the caller

**Scenario 7.4: Model tier resolution — Haiku**
- **Given** `callApi()` is called with `model: "haiku"`
- **Then** the SDK request uses `model: "claude-haiku-4-5-20251001"`

**Scenario 7.5: Model tier resolution — Sonnet**
- **Given** `callApi()` is called with `model: "sonnet"`
- **Then** the SDK request uses `model: "claude-sonnet-4-5-20250929"`

**Scenario 7.6: Cost estimation calculation**
- **Given** an API call returns usage with `input_tokens` and `output_tokens`
- **When** `cost_estimate` is calculated
- **Then** it equals `(input_tokens × input_rate + output_tokens × output_rate) / 1_000_000`
- **Where** rates come from the hardcoded `COST_PER_MILLION_TOKENS` map for the resolved model

**Scenario 7.7: Stop reason — refusal**
- **Given** `callApi()` is called
- **When** the API response has `stop_reason: "refusal"`
- **Then** an `ApiRefusalError` is thrown with the refusal text
- **And** the failure is logged to `api_call_log`

**Scenario 7.8: Stop reason — max_tokens**
- **Given** `callApi()` is called
- **When** the API response has `stop_reason: "max_tokens"`
- **Then** an `ApiMaxTokensError` is thrown indicating truncated response
- **And** the failure is logged to `api_call_log`

**Scenario 7.9: Transport error handling**
- **Given** the Anthropic API is unavailable (network error, 500, 429)
- **When** `callApi()` is called
- **Then** the SDK retries automatically (built-in retry logic)
- **And** if all retries fail, the error propagates
- **And** the failure is logged to `api_call_log`

**Scenario 7.10: Client initialization at startup**
- **Given** `ANTHROPIC_API_KEY` is set in the environment (validated by Story 1, FR-005)
- **When** the server starts
- **Then** a single `Anthropic` client instance is created
- **And** it is reused for all subsequent `callApi()` calls

**Scenario 7.11: Input hash for observability**
- **Given** `callApi()` is called
- **When** the call is logged to `api_call_log`
- **Then** `input_hash` is a SHA-256 hash of the `userMessage`, truncated to 16 hex characters

**Scenario 7.12: Default max_tokens**
- **Given** `callApi()` is called without specifying `maxTokens`
- **Then** the SDK request uses `max_tokens: 4096`

**Scenario 7.13: Custom max_tokens**
- **Given** `callApi()` is called with `maxTokens: 8192`
- **Then** the SDK request uses `max_tokens: 8192`

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-38 | `ANTHROPIC_API_KEY` invalid (401) | SDK throws `AuthenticationError`. Not retried. Logged with latency_ms=-1. |
| EC-39 | API rate limited (429) | SDK retries automatically with backoff. If exhausted, error propagates. Logged. |
| EC-40 | Response `stop_reason: "refusal"` | Throw `ApiRefusalError`. Log failure. Caller handles. |
| EC-41 | Response `stop_reason: "max_tokens"` | Throw `ApiMaxTokensError`. Log failure. Caller may retry with higher maxTokens. |
| EC-42 | Network timeout | SDK handles retry. If exhausted, throw. Log failure. |
| EC-43 | First request latency (grammar compilation) | Structured outputs compile grammar on first use per schema. Cached 24h by API. Subsequent calls faster. Accept as expected. |
| EC-44 | Concurrent `callApi()` calls | Each independent. SDK handles connection pooling. No shared mutable state. |
| EC-45 | Very large response (near max_tokens) | If truncated, `stop_reason: "max_tokens"` triggers error path. |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-083 | `callApi<T>()` MUST accept callType, model (ModelTier), systemPrompt, userMessage, responseSchema (ZodSchema<T>), sessionId, optional maxTokens, and optional tools (connector tools, D83) | High |
| FR-084 | `callApi<T>()` MUST use `output_config: { format: zodOutputFormat(responseSchema) }` for structured output via constrained decoding | High |
| FR-085 | `ModelTier` MUST map `"haiku"` → `"claude-haiku-4-5-20251001"` and `"sonnet"` → `"claude-sonnet-4-5-20250929"` | High |
| FR-086 | Every `callApi()` invocation MUST log to `api_call_log` via `logApiCall()` (Story 4, FR-042) | High |
| FR-087 | `cost_estimate` MUST be computed from `response.usage` tokens × hardcoded per-million-token rates | High |
| FR-088 | `input_hash` MUST be SHA-256 of `userMessage` truncated to 16 hex characters | High |
| FR-089 | On `stop_reason: "refusal"`, `callApi()` MUST throw `ApiRefusalError` and log failure | High |
| FR-090 | On `stop_reason: "max_tokens"`, `callApi()` MUST throw `ApiMaxTokensError` and log failure | High |
| FR-091 | Failed API calls MUST be logged with `latency_ms = -1`, zero tokens, zero cost (per EC-19) | High |
| FR-092 | `callApi()` MUST default `maxTokens` to 4096 if not specified | High |
| FR-093 | A single `Anthropic` client instance MUST be created at startup and reused for all calls | High |
| FR-094 | Prompt template modules MUST export `SYSTEM_PROMPT` (string), `responseSchema` (ZodSchema), `assembleUserMessage()` (function), and inferred response type | High |
| FR-095 | `COST_PER_MILLION_TOKENS` MUST define haiku (input: 0.80, output: 4.00) and sonnet (input: 3.00, output: 15.00) | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-039 | Structured output works | `callApi()` with a Zod schema returns typed, schema-compliant JSON |
| SC-040 | Model resolution works | `"haiku"` and `"sonnet"` resolve to correct model IDs in SDK calls |
| SC-041 | Cost tracking accurate | `cost_estimate` matches manual calculation from token counts × pricing |
| SC-042 | Success logging complete | Successful call writes row with all metadata fields to `api_call_log` |
| SC-043 | Failure logging complete | Failed call writes row with latency_ms=-1, zero tokens/cost |
| SC-044 | Refusal handled | `stop_reason: "refusal"` throws `ApiRefusalError` |
| SC-045 | Max tokens handled | `stop_reason: "max_tokens"` throws `ApiMaxTokensError` |

---

### User Story 8 — ChromaDB Memory Integration (Priority: P2)

**Revision**: v1.0

**As** the backend server, **I** provide a memory module that connects to ChromaDB for storing and querying cross-session coaching memories with semantic search, **so that** Stories 9–12 can recall past issues, patterns, and user progress to deliver contextual coaching.

**Packages**:
- `chromadb` (v3.3.0) — ChromaDB TypeScript SDK

**Key Decisions**: D3, D34, D35, D36, D37, D38, D39, D40, D41, D42

**Environment Variables** (already defined in Story 1):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CHROMADB_URL` | No | `http://localhost:8000` | ChromaDB server URL |

#### Core Module

```typescript
// memory.ts

interface MemoryInput {
  content: string;         // Text to embed and search
  tags: string[];          // Categorical tags (stored as comma-separated string in metadata)
  importance: string;      // "high" | "medium" | "low"
}

interface MemoryMetadata {
  session_id: string;
  project: string;
  created_at: string;      // ISO 8601
  importance: string;
  tags: string;            // Comma-separated (ChromaDB metadata = primitives only)
}

interface MemoryResult {
  id: string;
  content: string;
  metadata: MemoryMetadata;
  distance: number;        // Lower = more similar
}

/** Store one or more memories in ChromaDB */
async function addMemories(params: {
  memories: MemoryInput[];
  sessionId: string;
  project: string;
}): Promise<{ added: number }>;

/** Semantic search for memories related to a query */
async function queryMemories(params: {
  queryText: string;
  nResults?: number;       // Default 10
  project?: string;        // Omit for cross-project recall
}): Promise<MemoryResult[]>;

/** Check if ChromaDB is reachable and the collection exists */
async function isMemoryAvailable(): Promise<boolean>;
```

**Collection**: Single global collection named `paige_memories`, created via `getOrCreateCollection()` at startup (D34, D41).

**Embedding**: Server-side default — ChromaDB's built-in Sentence Transformers embedding. No embedding code in the backend (D35).

**ID Generation**: `mem_{sessionId}_{index}` where index is 0-based within each `addMemories` call.

**Connection Lifecycle** (D39):
1. At startup: create `ChromaClient({ path: CHROMADB_URL })`, call `getOrCreateCollection({ name: "paige_memories" })`
2. On success: log `"ChromaDB connected — collection paige_memories ready"`, set `chromaAvailable = true`
3. On failure: log warning `"ChromaDB unavailable at {url} — memory features disabled"`, set `chromaAvailable = false`
4. On subsequent calls when unavailable: attempt reconnection. On success, flip flag and proceed. On failure, return degraded result.

**Graceful Degradation** (D38):
- `addMemories()` → returns `{ added: 0 }`, logs warning
- `queryMemories()` → returns `[]`, logs warning
- `isMemoryAvailable()` → returns `false`
- No crashes, no retry queues, no circuit breakers

#### Acceptance Scenarios

**Scenario 8.1: Adding memories stores documents with metadata**
- **Given** ChromaDB is available and a session is active
- **When** `addMemories()` is called with 2 memories, a sessionId, and a project
- **Then** 2 documents are added to the `paige_memories` collection
- **And** each document's text is the `content` field
- **And** each document's metadata includes `session_id`, `project`, `created_at` (ISO 8601), `importance`, and `tags` (comma-separated)
- **And** IDs follow the pattern `mem_{sessionId}_0`, `mem_{sessionId}_1`
- **And** `{ added: 2 }` is returned

**Scenario 8.2: Querying memories returns semantically similar results**
- **Given** ChromaDB contains memories about "OAuth callback race condition" and "CSS grid layout"
- **When** `queryMemories({ queryText: "race condition in auth flow" })` is called
- **Then** the OAuth memory is returned with a lower distance than the CSS memory
- **And** each result includes `id`, `content`, `metadata`, and `distance`

**Scenario 8.3: Cross-project recall (no project filter)**
- **Given** memories exist for project "app-alpha" and project "app-beta"
- **When** `queryMemories({ queryText: "useEffect cleanup" })` is called without a `project` filter
- **Then** results from both projects may appear, ranked by semantic similarity

**Scenario 8.4: Project-scoped query**
- **Given** memories exist for project "app-alpha" and project "app-beta"
- **When** `queryMemories({ queryText: "useEffect cleanup", project: "app-alpha" })` is called
- **Then** only memories with `project: "app-alpha"` are returned

**Scenario 8.5: ChromaDB available at startup**
- **Given** ChromaDB is running at `CHROMADB_URL`
- **When** the server starts and initializes the memory module
- **Then** `getOrCreateCollection({ name: "paige_memories" })` succeeds
- **And** a log line confirms connection: `"ChromaDB connected — collection paige_memories ready"`
- **And** `isMemoryAvailable()` returns `true`

**Scenario 8.6: ChromaDB unavailable at startup**
- **Given** ChromaDB is NOT running
- **When** the server starts and initializes the memory module
- **Then** the connection attempt fails
- **And** a warning is logged: `"ChromaDB unavailable at {url} — memory features disabled"`
- **And** the server continues to start successfully (no crash)
- **And** `isMemoryAvailable()` returns `false`

**Scenario 8.7: Degraded addMemories when ChromaDB is down**
- **Given** ChromaDB is unavailable (`chromaAvailable = false`)
- **When** `addMemories()` is called
- **Then** it returns `{ added: 0 }` without throwing
- **And** a warning is logged

**Scenario 8.8: Degraded queryMemories when ChromaDB is down**
- **Given** ChromaDB is unavailable
- **When** `queryMemories()` is called
- **Then** it returns `[]` without throwing
- **And** a warning is logged

**Scenario 8.9: Lazy recovery after ChromaDB becomes available**
- **Given** the server started with ChromaDB unavailable (`chromaAvailable = false`)
- **And** ChromaDB is subsequently started
- **When** `addMemories()` or `queryMemories()` is called
- **Then** the module attempts reconnection
- **And** on success, flips `chromaAvailable = true`, logs recovery, and completes the operation normally

**Scenario 8.10: Default nResults**
- **Given** memories exist in the collection
- **When** `queryMemories({ queryText: "..." })` is called without specifying `nResults`
- **Then** up to 10 results are returned

**Scenario 8.11: Custom nResults**
- **Given** memories exist in the collection
- **When** `queryMemories({ queryText: "...", nResults: 5 })` is called
- **Then** up to 5 results are returned

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-46 | `CHROMADB_URL` misconfigured (wrong host/port) | Same as unavailable — connection fails, warning logged, degraded mode |
| EC-47 | ChromaDB server dies mid-operation | Catch error, log warning, return degraded result. Flip `chromaAvailable = false` |
| EC-48 | `addMemories()` called with empty array | Return `{ added: 0 }` immediately, no ChromaDB call |
| EC-49 | `queryMemories()` called with empty query string | Pass to ChromaDB as-is. Caller's responsibility to provide meaningful queries |
| EC-50 | Tags contain commas | Escape or strip commas before joining. Tags are informational metadata |
| EC-51 | Very large `addMemories` call (50+ memories) | Pass through in single `add()` call. ChromaDB handles batching internally |
| EC-52 | Query returns fewer results than `nResults` | Return whatever ChromaDB returns. No padding |
| EC-53 | Collection deleted externally while server running | Next operation fails, caught by error handler, triggers degraded mode + reconnection on next call |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-096 | Memory module MUST create `ChromaClient({ path: CHROMADB_URL })` at startup | High |
| FR-097 | Memory module MUST call `getOrCreateCollection({ name: "paige_memories" })` at startup | High |
| FR-098 | If ChromaDB is unreachable at startup, MUST log warning and set `chromaAvailable = false` — server continues | High |
| FR-099 | `addMemories(memories, sessionId, project)` MUST store documents with metadata: session_id, project, created_at (ISO 8601), importance, tags (comma-separated) | High |
| FR-100 | `addMemories()` MUST generate IDs as `mem_{sessionId}_{index}` (0-based within call) | High |
| FR-101 | `queryMemories(queryText, nResults?, project?)` MUST use ChromaDB `queryTexts` for semantic search with `nResults` default 10 | High |
| FR-102 | `queryMemories()` MUST support optional `project` filter via ChromaDB `where: { project }` clause | High |
| FR-103 | When ChromaDB is unavailable, `addMemories()` MUST return `{ added: 0 }` and log warning — no throw | High |
| FR-104 | When ChromaDB is unavailable, `queryMemories()` MUST return `[]` and log warning — no throw | High |
| FR-105 | `isMemoryAvailable()` MUST return boolean reflecting current ChromaDB connectivity state | High |
| FR-106 | On ChromaDB operation failure at runtime, MUST flip `chromaAvailable = false` and attempt reconnection on next call | High |
| FR-107 | Tags array MUST be joined as comma-separated string in metadata (ChromaDB metadata supports primitives only) | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-046 | Memories stored correctly | `addMemories()` stores documents with correct content and metadata in `paige_memories` collection |
| SC-047 | Semantic search works | `queryMemories()` returns semantically similar results ranked by distance |
| SC-048 | Cross-project recall works | Query without `project` filter returns results from multiple projects |
| SC-049 | Project filter works | Query with `project` filter returns only matching project's memories |
| SC-050 | Startup connection succeeds | ChromaDB available at startup → log confirms connection, `isMemoryAvailable()` returns true |
| SC-051 | Startup degradation works | ChromaDB unavailable at startup → server starts, warning logged, `isMemoryAvailable()` returns false |
| SC-052 | Runtime degradation works | Operations return degraded results (`[]` / `{ added: 0 }`) when ChromaDB is down |
| SC-053 | Lazy recovery works | ChromaDB started after server → next memory operation reconnects and succeeds |

---

### User Story 9 — Coaching Pipeline (API Calls) (Priority: P2)

**Revision**: v1.0

**As** the backend server, **I** orchestrate the coaching pipeline through two flows — pipeline entry (plan → phased coaching) and session wrap-up (session → gaps, assessments, memories) — using structured Claude API calls via Story 7's `callApi<T>()`, **so that** Paige delivers adaptive, memory-aware coaching and learns from every session.

**Packages**: No new packages — uses `callApi<T>()` (Story 7), `addMemories()`/`queryMemories()` (Story 8), SQLite (Story 2), WebSocket broadcast (Story 5).

**Key Decisions**: D43–D53

#### MCP Tools (2 new tools — additive revision to Story 6)

**`paige_run_coaching_pipeline`** — Triggered by Claude Code after the Plan Agent completes.

```typescript
// Input (MCP tool parameters)
{
  planText: string;          // Markdown plan from Claude Code's Plan Agent
  issueSummary: string;      // Brief issue description
  issueNumber?: number;      // GitHub issue number if available
}

// Output (returned to Claude Code)
{
  planId: string;
  phases: Array<{
    number: number;
    title: string;
    description: string;     // Coaching message for this phase
    hintLevel: string;
  }>;
  memoryConnection: string | null;  // "Similar to X from session Y"
  estimatedDifficulty: string;
}
```

**`paige_end_session`** — Triggered by Claude Code's Stop hook.

```typescript
// Input (MCP tool parameters)
{
  sessionTranscript: string;   // Condensed by Claude Code's Stop hook
}

// Output (returned to Claude Code)
{
  knowledgeGaps: number;       // Count of new gaps identified
  kataSpecs: number;           // Count of new katas generated
  dreyfusUpdates: number;      // Count of assessments updated
  memoriesStored: number;      // Count of memories stored in ChromaDB
  sessionStatus: "completed";
}
```

#### Pipeline Entry Flow (`paige_run_coaching_pipeline`)

```
Claude Code (Plan Agent output)
    │
    ▼
1. Get active session from SQLite
2. Get Dreyfus assessments from SQLite
3. Query ChromaDB: queryMemories({ queryText, nResults: 10 })
    │
    ├── ChromaDB unavailable? → skip to step 5 with empty memories
    │
4. Call Haiku: Memory Retrieval Filtering
    │
    ├── Haiku fails? → skip to step 5 with empty memories (D48)
    │
5. Call Sonnet: Coach Agent (plan + Dreyfus + filtered memories)
    │
    ├── Coach Agent fails? → return MCP error (only non-optional step)
    │
6. Create plan row in SQLite (plans table)
7. Create phase rows in SQLite (phases table)
8. Create phase_hints rows in SQLite (phase_hints table)
9. Log "coaching_pipeline" action (Story 4)
10. Broadcast coaching:plan_ready via WebSocket (D53)
11. Apply first phase hints via editor:highlight_lines + explorer:hint_files
12. Return coaching output to Claude Code
```

#### Session Wrap-up Flow (`paige_end_session`)

```
Claude Code (Stop hook, condensed transcript)
    │
    ▼
1. Get active session from SQLite
2. Get session's action_log, phases, progress_events
    │
    ▼
3. Call Sonnet: Knowledge Gap Extraction ── best-effort (D49)
    │   Store gaps in knowledge_gaps table
    │   Store katas in kata_specs table
    │
4. Call Sonnet: Dreyfus Stage Assessment ── best-effort (D49)
    │   Upsert assessments in dreyfus_assessments table
    │
5. Call Haiku: Memory Summarisation ── best-effort (D49)
    │   Store in ChromaDB via addMemories() (Story 8)
    │
6. Update session status → "completed" in SQLite (always runs)
7. Log "session_end" action (Story 4)
8. Broadcast session:completed via WebSocket
9. Return summary to Claude Code
```

#### Prompt Template Modules (5 modules, Story 7 convention)

**Module 1: `prompts/memory-retrieval-filter.ts`** (Haiku)

```typescript
import { z } from "zod";

export const SYSTEM_PROMPT = `You are a memory relevance filter for an AI coding coach called Paige.
You receive a set of past coaching memories retrieved by semantic search, plus the current issue context.
Your job: determine which memories are genuinely relevant to the current issue and explain HOW to use each one in coaching.
Discard memories that are superficially similar but not actually useful.`;

export const responseSchema = z.object({
  relevant_memories: z.array(z.object({
    content: z.string().describe("The original memory text"),
    relevance: z.enum(["direct", "related", "contextual"]),
    connection: z.string().describe("How this memory connects to the current issue"),
    use_in_coaching: z.string().describe("How the coach should reference this memory"),
  })),
  discarded: z.array(z.object({
    content: z.string(),
    reason: z.string(),
  })),
});

export type MemoryRetrievalFilterResponse = z.infer<typeof responseSchema>;

export function assembleUserMessage(
  issueSummary: string,
  planText: string,
  rawMemories: Array<{ content: string; metadata: Record<string, unknown> }>
): string {
  return JSON.stringify({ issue_summary: issueSummary, plan_summary: planText, candidate_memories: rawMemories });
}
```

**Module 2: `prompts/coach-agent.ts`** (Sonnet)

```typescript
import { z } from "zod";

export const SYSTEM_PROMPT = `You are Paige's coaching engine — the pedagogical core of an AI coding coach.
You transform implementation plans into scaffolded, phased learning experiences.
Adapt guidance granularity to the user's Dreyfus stage: novices need specific line-level hints;
competent developers need directional guidance. Reference relevant memories to build continuity.`;

export const responseSchema = z.object({
  phases: z.array(z.object({
    number: z.number().int().positive(),
    title: z.string(),
    description: z.string().describe("Coaching message explaining what to do and why"),
    expected_files: z.array(z.string()),
    hint_level: z.enum(["none", "file", "region", "line"]),
    hints: z.object({
      file_hints: z.array(z.object({
        path: z.string(),
        style: z.enum(["suggested", "important", "critical"]),
      })),
      line_hints: z.array(z.object({
        path: z.string(),
        start: z.number().int().positive(),
        end: z.number().int().positive(),
        style: z.enum(["hint", "focus", "warning"]),
        hover_text: z.string(),
      })),
    }),
    knowledge_gap_opportunities: z.array(z.string()),
  })),
  memory_connection: z.string().nullable().describe("Cross-session connection, or null"),
  estimated_difficulty: z.enum(["beginner", "intermediate", "advanced"]),
});

export type CoachAgentResponse = z.infer<typeof responseSchema>;

export function assembleUserMessage(
  planText: string,
  dreyfusStage: string,
  relevantMemories: Array<{ content: string; connection: string; use_in_coaching: string }>
): string {
  return JSON.stringify({
    plan: planText,
    dreyfus_stage: dreyfusStage,
    relevant_memories: relevantMemories,
  });
}
```

**Module 3: `prompts/knowledge-gap-extraction.ts`** (Sonnet)

```typescript
import { z } from "zod";

export const SYSTEM_PROMPT = `You are Paige's learning analyst. Analyse a coding coaching session to identify
knowledge gaps — topics where the user struggled, needed excessive hints, or made repeated mistakes.
Generate practice kata specifications targeting those gaps. Be evidence-based: cite observable session data,
not assumptions.`;

export const responseSchema = z.object({
  knowledge_gaps: z.array(z.object({
    topic: z.string(),
    evidence: z.string().describe("Observable evidence from the session"),
    severity: z.enum(["low", "medium", "high"]),
    related_concepts: z.array(z.string()),
  })),
  kata_specs: z.array(z.object({
    title: z.string(),
    description: z.string(),
    scaffolding_code: z.string(),
    test_cases: z.array(z.string()),
    constraints: z.array(z.string()),
    follow_up_constraint: z.string().nullable(),
  })),
  session_summary: z.object({
    phases_completed: z.number().int().min(0),
    total_time_minutes: z.number().min(0),
    hints_used: z.number().int().min(0),
    independent_completions: z.number().int().min(0),
  }),
});

export type KnowledgeGapExtractionResponse = z.infer<typeof responseSchema>;

export function assembleUserMessage(
  actionLog: Array<{ action_type: string; data: unknown; created_at: string }>,
  phases: Array<{ title: string; status: string; hint_level: string }>,
  existingGaps: Array<{ topic: string; frequency: number }>
): string {
  return JSON.stringify({ action_log: actionLog, phases, existing_gaps: existingGaps });
}
```

**Module 4: `prompts/dreyfus-assessment.ts`** (Sonnet)

```typescript
import { z } from "zod";

export const SYSTEM_PROMPT = `You are Paige's skill assessor. Evaluate the user's competency across skill areas
using the Dreyfus model (novice → advanced_beginner → competent → proficient → expert).
Base assessments on accumulated evidence across sessions, not just the latest session.
Recommend how coaching should adapt for each assessed stage.`;

export const responseSchema = z.object({
  assessments: z.array(z.object({
    skill_area: z.string(),
    stage: z.enum(["novice", "advanced_beginner", "competent", "proficient", "expert"]),
    previous_stage: z.enum(["novice", "advanced_beginner", "competent", "proficient", "expert"]).nullable(),
    confidence: z.number().min(0).max(1),
    evidence: z.string().describe("Observable evidence supporting the assessment"),
    recommendation: z.string().describe("How to adjust coaching for this stage"),
  })),
});

export type DreyfusAssessmentResponse = z.infer<typeof responseSchema>;

export function assembleUserMessage(
  accumulatedEvidence: Array<{ skill_area: string; sessions: number; hint_trend: string; completion_rate: number }>,
  currentAssessments: Array<{ skill_area: string; stage: string; confidence: number }>,
  recentSummary: { phases_completed: number; hints_used: number; independent_completions: number }
): string {
  return JSON.stringify({ accumulated_evidence: accumulatedEvidence, current_assessments: currentAssessments, recent_session: recentSummary });
}
```

**Module 5: `prompts/memory-summarisation.ts`** (Haiku)

```typescript
import { z } from "zod";

export const SYSTEM_PROMPT = `You are Paige's memory curator. Summarise a coding coaching session into
concise, searchable memories for future retrieval. Each memory should capture one meaningful insight —
what was worked on, what was learned, what was struggled with, or what the user demonstrated competence in.
Tag memories for semantic search. Only persist what would be useful in a future coaching session.`;

export const responseSchema = z.object({
  memories: z.array(z.object({
    content: z.string().describe("Concise memory text for embedding and future retrieval"),
    tags: z.array(z.string()),
    importance: z.enum(["low", "medium", "high"]),
  })),
});

export type MemorySummarisationResponse = z.infer<typeof responseSchema>;

export function assembleUserMessage(
  sessionTranscript: string,
  issueTitle: string,
  phasesCompleted: Array<{ title: string; description: string }>,
  knowledgeGaps: Array<{ topic: string; severity: string }>
): string {
  return JSON.stringify({ transcript: sessionTranscript, issue: issueTitle, phases: phasesCompleted, gaps: knowledgeGaps });
}
```

#### WebSocket Messages (additive to Story 5)

| Type | Direction | Payload | Trigger |
|------|-----------|---------|---------|
| `coaching:plan_ready` | Server → Client | `{ planId, phases: [{ number, title, description, hintLevel, status }], memoryConnection, estimatedDifficulty }` | Coach Agent completes |
| `session:completed` | Server → Client | `{ sessionId, knowledgeGaps, kataSpecs, dreyfusUpdates, memoriesStored }` | Session wrap-up completes |

#### Acceptance Scenarios

**Scenario 9.1: Full coaching pipeline — happy path**
- **Given** a session is active with Dreyfus assessments and ChromaDB contains relevant memories
- **When** `paige_run_coaching_pipeline` is called with planText and issueSummary
- **Then** ChromaDB is queried for relevant memories (nResults: 10)
- **And** Haiku filters memories for relevance (call logged to api_call_log)
- **And** Sonnet Coach Agent produces phased guidance (call logged to api_call_log)
- **And** plan, phases, and hints are stored in SQLite
- **And** `coaching:plan_ready` is broadcast to Electron
- **And** first phase hints are broadcast via `editor:highlight_lines` and `explorer:hint_files`
- **And** the coaching output is returned to Claude Code

**Scenario 9.2: Coaching pipeline without memories (ChromaDB unavailable)**
- **Given** ChromaDB is unavailable (`isMemoryAvailable()` returns false)
- **When** `paige_run_coaching_pipeline` is called
- **Then** memory retrieval is skipped
- **And** Coach Agent runs with empty `relevant_memories`
- **And** `memory_connection` is null in the output
- **And** the rest of the pipeline completes normally

**Scenario 9.3: Coaching pipeline — memory filtering fails**
- **Given** ChromaDB returns results but Haiku filtering call fails
- **When** the pipeline is processing
- **Then** memory filtering is skipped (D48)
- **And** Coach Agent runs with empty `relevant_memories`
- **And** a warning is logged

**Scenario 9.4: Coaching pipeline — Coach Agent fails**
- **Given** the Sonnet Coach Agent API call fails
- **When** the pipeline is processing
- **Then** the MCP tool returns an error to Claude Code
- **And** no plan/phases are stored in SQLite
- **And** the failure is logged to api_call_log

**Scenario 9.5: Session wrap-up — happy path**
- **Given** a session is active with completed phases and action log entries
- **When** `paige_end_session` is called with a condensed transcript
- **Then** Knowledge Gap Extraction runs (Sonnet, logged)
- **And** new knowledge_gaps and kata_specs are stored in SQLite
- **And** Dreyfus Assessment runs (Sonnet, logged)
- **And** dreyfus_assessments are upserted in SQLite
- **And** Memory Summarisation runs (Haiku, logged)
- **And** memories are stored in ChromaDB via `addMemories()`
- **And** session status is set to "completed"
- **And** `session:completed` is broadcast to Electron
- **And** summary is returned to Claude Code

**Scenario 9.6: Session wrap-up — knowledge gap extraction fails**
- **Given** Knowledge Gap Extraction (Sonnet) fails
- **When** wrap-up is processing
- **Then** the error is logged
- **And** Dreyfus Assessment still runs
- **And** Memory Summarisation still runs
- **And** session status is still set to "completed"
- **And** `knowledgeGaps: 0` and `kataSpecs: 0` in the response

**Scenario 9.7: Session wrap-up — all API calls fail**
- **Given** all three wrap-up API calls fail
- **When** wrap-up is processing
- **Then** all three failures are logged
- **And** session status is still set to "completed"
- **And** response shows zeros for all counts

**Scenario 9.8: Coach Agent output maps to SQLite correctly**
- **Given** Coach Agent returns 3 phases with file and line hints
- **When** results are stored
- **Then** 1 row in `plans` table with the plan metadata
- **And** 3 rows in `phases` table (number, title, description, hint_level, status="pending")
- **And** corresponding rows in `phase_hints` table for each hint

**Scenario 9.9: Knowledge gaps stored correctly**
- **Given** Knowledge Gap Extraction returns 2 gaps and 1 kata spec
- **When** results are stored
- **Then** 2 rows inserted into `knowledge_gaps` table with topic, evidence, severity
- **And** 1 row inserted into `kata_specs` table with title, description, scaffolding_code, test_cases

**Scenario 9.10: Dreyfus assessments upserted correctly**
- **Given** Dreyfus Assessment returns an updated assessment for "React state management"
- **And** an existing assessment exists for that skill_area
- **When** results are stored
- **Then** the existing row in `dreyfus_assessments` is updated (not duplicated)
- **And** the stage, confidence, evidence, and last_updated fields are updated

**Scenario 9.11: Memory summarisation stored correctly**
- **Given** Memory Summarisation returns 2 memories
- **When** results are stored
- **Then** `addMemories()` is called with the 2 memories, session ID, and project
- **And** memories are queryable via `queryMemories()` afterward

**Scenario 9.12: WebSocket broadcast — coaching:plan_ready**
- **Given** Electron is connected via WebSocket
- **When** Coach Agent completes successfully
- **Then** Electron receives `coaching:plan_ready` with planId, phases array, memoryConnection, and estimatedDifficulty

**Scenario 9.13: No active session**
- **Given** no session is active
- **When** `paige_run_coaching_pipeline` or `paige_end_session` is called
- **Then** the MCP tool returns an error: "No active session"

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-54 | Plan text is very long (>10k tokens) | Pass to Coach Agent as-is. maxTokens handles response size. |
| EC-55 | ChromaDB returns 0 memories | Skip retrieval filtering entirely. Coach Agent gets empty memories. |
| EC-56 | Retrieval filtering returns 0 relevant memories | Coach Agent runs with empty memories, memory_connection is null. |
| EC-57 | Coach Agent returns 0 phases | Store empty plan. MCP returns empty phases array. Unusual but not an error. |
| EC-58 | Knowledge Gap Extraction returns 0 gaps | Store nothing in knowledge_gaps. Normal for sessions where user had no struggles. |
| EC-59 | Dreyfus Assessment returns no changes | No upserts. Assessment remains at current stage. |
| EC-60 | Memory Summarisation returns 0 memories | `addMemories()` called with empty array, returns `{ added: 0 }`. Normal. |
| EC-61 | Concurrent coaching pipeline calls | Each independent. Second call creates a new plan. |
| EC-62 | `paige_end_session` called twice for same session | Second call finds session already "completed". No-op for wrap-up steps. |
| EC-63 | Session transcript very large (>50k chars) | Truncate to fit Haiku context window. Claude Code should condense aggressively. |
| EC-64 | Coach Agent returns hint for non-existent file | Store hint as-is. Electron ignores hints for files not in the tree. |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-108 | `paige_run_coaching_pipeline` MCP tool MUST accept planText (string), issueSummary (string), and optional issueNumber (number) | High |
| FR-109 | Pipeline entry MUST query ChromaDB via `queryMemories({ queryText, nResults: 10 })` when available | High |
| FR-110 | Pipeline entry MUST call Haiku for memory retrieval filtering when ChromaDB returns results | High |
| FR-111 | If ChromaDB is unavailable OR Haiku filtering fails, pipeline MUST skip memories entirely and pass empty array to Coach Agent | High |
| FR-112 | Pipeline entry MUST call Sonnet Coach Agent with planText, Dreyfus stage, and filtered memories | High |
| FR-113 | Coach Agent output MUST be stored in SQLite: 1 plan row, N phase rows, M phase_hints rows | High |
| FR-114 | Pipeline entry MUST broadcast `coaching:plan_ready` via WebSocket after Coach Agent completes | High |
| FR-115 | Pipeline entry MUST apply first phase hints via existing `editor:highlight_lines` and `explorer:hint_files` WebSocket messages | High |
| FR-116 | Pipeline entry MUST return coaching output (planId, phases summary, memoryConnection, estimatedDifficulty) to Claude Code | High |
| FR-117 | `paige_end_session` MCP tool MUST accept sessionTranscript (string) | High |
| FR-118 | Session wrap-up MUST call Sonnet for Knowledge Gap Extraction (best-effort — log failure, continue) | High |
| FR-119 | Knowledge gaps MUST be stored in `knowledge_gaps` table; kata specs in `kata_specs` table | High |
| FR-120 | Session wrap-up MUST call Sonnet for Dreyfus Stage Assessment (best-effort) | High |
| FR-121 | Dreyfus assessments MUST be upserted (INSERT OR REPLACE) in `dreyfus_assessments` table | High |
| FR-122 | Session wrap-up MUST call Haiku for Memory Summarisation (best-effort) | High |
| FR-123 | Memory summarisation output MUST be stored in ChromaDB via `addMemories()` (Story 8) | High |
| FR-124 | Session status MUST be set to "completed" regardless of individual wrap-up step failures | High |
| FR-125 | Session wrap-up MUST broadcast `session:completed` via WebSocket | High |
| FR-126 | All 5 API call types MUST use prompt template modules following Story 7 convention (SYSTEM_PROMPT, responseSchema, assembleUserMessage, response type) | High |
| FR-127 | All 5 API calls MUST be logged to `api_call_log` automatically via `callApi()` (Story 7) | High |
| FR-128 | Both MCP tools MUST return MCP error if no active session | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-054 | Full pipeline works | Plan + memories → phased coaching stored in SQLite and broadcast to Electron |
| SC-055 | Pipeline without memories | Coach Agent produces valid output with empty `relevant_memories` |
| SC-056 | Pipeline failure handled | Coach Agent failure returns MCP error, no partial data stored |
| SC-057 | Wrap-up happy path | All 3 API calls succeed, data stored in SQLite + ChromaDB, session completed |
| SC-058 | Wrap-up partial failure | One call fails, remaining calls still execute, session still completed |
| SC-059 | SQLite storage correct | Phases, hints, gaps, katas, assessments all stored with correct foreign keys and data |
| SC-060 | WebSocket broadcasts delivered | `coaching:plan_ready` and `session:completed` received by connected Electron clients |
| SC-061 | Best-effort resilience | All 3 wrap-up calls fail, session still marked "completed" with zero counts |

---

### User Story 10 — Observer System (Priority: P2)

**Revision**: v1.0

**As** the backend server, **I** run a per-session Observer loop that monitors user activity via action log events, assembles context snapshots, calls a Haiku triage model to decide whether Paige should nudge, and delivers nudge prompts to Electron via WebSocket, **so that** Paige can proactively coach without waiting for the user to ask.

**Packages**: No new packages — uses `callApi<T>()` (Story 7), action logging EventEmitter (Story 4), WebSocket broadcast (Story 5), SQLite queries (Story 2).

**Key Decisions**: D54–D64

#### Observer Architecture

```
Action Log EventEmitter (Story 4)
        │
        ▼
┌─────────────────────┐
│  Observer Loop       │  Per-session, event-driven
│  - Trigger filter    │  Checks: cooldown, flow state, mute
│  - Context assembly  │  Reads: actions, phases, Dreyfus, buffers
│  - Triage call       │  Haiku via callApi<T>()
│  - Nudge delivery    │  WebSocket → Electron → PTY
└─────────────────────┘
```

#### Per-Session State (in-memory)

```typescript
interface ObserverState {
  sessionId: string;
  active: boolean;              // true while session is active
  muted: boolean;               // user toggle, default false
  lastNudgeTimestamp: number;    // Date.now() of last nudge sent
  lastEvaluationTimestamp: number;
  lastActivityTimestamp: number; // updated on every action event
  bufferUpdatesSinceLastEval: number;  // reset after each evaluation
  recentActions: Array<{ type: string; timestamp: number }>;  // sliding 60s window
  evaluationInProgress: boolean; // prevents concurrent triage calls
}
```

#### Trigger Events

The Observer evaluates when **any** of these occur (via EventEmitter subscription):

| Trigger | Source Event | Condition |
|---------|-------------|-----------|
| File open | `file_open` action | Always |
| File save | `file_save` action | Always |
| Buffer edit threshold | `buffer_update` action | `bufferUpdatesSinceLastEval >= 5` |
| Phase transition | `phase_started`, `phase_completed` | Always |
| Idle timeout | 30s recurring timer | `now - lastActivityTimestamp > 300_000` (5 min) |

#### Suppression Checks (before calling Haiku)

Evaluated in order. If any passes, the triage call is skipped:

1. **Muted**: `state.muted === true` → skip (no log, silent)
2. **Cooldown**: `now - lastNudgeTimestamp < 120_000` → log `nudge_suppressed` with `reason: "cooldown"`
3. **Flow state**: `recentActions in last 60s > 10` → log `nudge_suppressed` with `reason: "flow_state"`

#### Context Snapshot Assembly

```typescript
interface TriageContext {
  current_phase: {
    number: number;
    title: string;
    description: string;
    expected_files: string[];
  } | null;
  recent_actions: Array<{
    type: string;
    path?: string;
    ago: string;        // human-readable relative time
  }>;                   // last 20 actions
  time_since_last_save: string;
  time_since_last_nudge: string;
  dreyfus_stage: string;
  user_idle: boolean;
}
```

**Data sources**:
- `current_phase`: SQLite `phases` table — active phase for current plan
- `recent_actions`: SQLite `action_log` — last 20 actions for session
- `time_since_last_save`: computed from action_log (last `file_save`)
- `time_since_last_nudge`: from `lastNudgeTimestamp` in Observer state
- `dreyfus_stage`: SQLite `dreyfus_assessments` — most recent, or `"novice"` if none
- `user_idle`: `now - lastActivityTimestamp > 300_000`

#### Prompt Template Module: `prompts/observer-triage.ts`

```typescript
import { z } from "zod";

export const SYSTEM_PROMPT = `You are the Observer — Paige's proactive coaching sensor.
You monitor a junior developer's activity during a guided coding session.
Your ONLY job: decide whether Paige should nudge the user right now.

You receive a context snapshot: current phase expectations, recent user actions, timing data, and Dreyfus stage.

Respond with a binary decision (nudge or don't) plus a signal type if nudging.

Signal types:
- wrong_file: User is actively editing a file not in the phase's expected file list
- scope_drift: User's changes are unrelated to the phase objective
- idle: No user actions for extended period — they may be stuck
- phase_complete: User's work appears to match phase expectations — suggest moving on
- edit_loop: User is repeatedly editing and reverting the same area — possible confusion

Be conservative. When in doubt, don't nudge. A false positive interrupts flow.
Novices get slightly more nudges. Competent developers get left alone unless something is clearly wrong.`;

export const responseSchema = z.object({
  should_nudge: z.boolean(),
  confidence: z.number().min(0).max(1),
  signal: z.enum(["wrong_file", "scope_drift", "idle", "phase_complete", "edit_loop", "no_nudge"]),
  reasoning: z.string().describe("Internal reasoning — logged, not shown to user"),
  suggested_context: z.object({
    current_file: z.string().nullable(),
    expected_file: z.string().nullable(),
    time_in_file: z.string().nullable(),
    phase_description: z.string().nullable(),
  }).describe("Context passed through to nudge prompt for Claude Code"),
});

export type ObserverTriageResponse = z.infer<typeof responseSchema>;

export function assembleUserMessage(context: TriageContext): string {
  return JSON.stringify(context);
}
```

#### Nudge Delivery Flow

1. Triage returns `should_nudge: true` with `confidence >= 0.7`
2. Observer logs `nudge_sent` action with `{ signal, confidence }`
3. Observer broadcasts `observer:nudge` via WebSocket:
   ```json
   {
     "type": "observer:nudge",
     "payload": {
       "signal": "wrong_file",
       "confidence": 0.85,
       "context": {
         "current_file": "src/middleware/auth.ts",
         "expected_file": "src/handlers/oauth.ts",
         "time_in_file": "3m12s",
         "phase_description": "Find and understand the OAuth callback handler"
       }
     }
   }
   ```
4. Electron writes formatted nudge prompt to PTY stdin
5. Claude Code responds as Paige (persona from SessionStart hook)
6. Update `lastNudgeTimestamp`

If `should_nudge: true` but `confidence < 0.7`:
- Log `nudge_suppressed` with `{ signal, confidence, reason: "low_confidence" }`
- No WebSocket message

If `should_nudge: false`:
- No log, no action (cheap no-op)
- Update `lastEvaluationTimestamp`

#### WebSocket Messages (additive to Story 5)

| Type | Direction | Payload | Trigger |
|------|-----------|---------|---------|
| `observer:nudge` | Server → Client | `{ signal: string, confidence: number, context: { current_file, expected_file, time_in_file, phase_description } }` | Triage says nudge |
| `observer:mute` | Client → Server | `{ muted: boolean }` | User toggles mute |
| `observer:status` | Server → Client | `{ active: boolean, muted: boolean, lastEvaluation: string \| null }` | Session start, session end, mute toggle |

#### Observer Lifecycle

1. **Session start** → create `ObserverState`, subscribe to action log EventEmitter, start idle check timer (30s interval), broadcast `observer:status { active: true, muted: false, lastEvaluation: null }`
2. **During session** → process trigger events, run suppression checks, call triage when warranted, deliver nudges
3. **Session end** (`paige_end_session`) → unsubscribe from EventEmitter, clear idle timer, set `active: false`, broadcast `observer:status { active: false, muted: false }`
4. **Mute toggle** → flip `state.muted`, log `observer_muted` action, broadcast `observer:status`

#### Acceptance Scenarios

**Scenario 10.1: Observer starts on session creation**
- **Given** a session is created
- **When** the session becomes active
- **Then** an `ObserverState` is created with `active: true`, `muted: false`
- **And** the Observer subscribes to the action log EventEmitter
- **And** a 30s idle check timer starts
- **And** `observer:status { active: true, muted: false, lastEvaluation: null }` is broadcast to Electron

**Scenario 10.2: Observer stops on session end**
- **Given** the Observer is active for a session
- **When** `paige_end_session` is called
- **Then** the Observer unsubscribes from the EventEmitter
- **And** the idle check timer is cleared
- **And** `observer:status { active: false, muted: false }` is broadcast

**Scenario 10.3: File open triggers evaluation — nudge sent**
- **Given** the Observer is active and unmuted, cooldown has elapsed, user is not in flow state
- **And** the user is editing `src/middleware/auth.ts` but the active phase expects `src/handlers/oauth.ts`
- **When** a `file_open` action is logged
- **Then** the Observer assembles a context snapshot
- **And** calls Haiku via `callApi<T>()` with the observer-triage prompt template
- **And** Haiku returns `{ should_nudge: true, confidence: 0.85, signal: "wrong_file", ... }`
- **And** `nudge_sent` is logged with `{ signal: "wrong_file", confidence: 0.85 }`
- **And** `observer:nudge` is broadcast to Electron with signal, confidence, and context
- **And** `lastNudgeTimestamp` is updated

**Scenario 10.4: Buffer edit threshold triggers evaluation**
- **Given** the Observer is active and `bufferUpdatesSinceLastEval` is 4
- **When** a 5th `buffer_update` action is logged
- **Then** the Observer runs a triage evaluation
- **And** `bufferUpdatesSinceLastEval` resets to 0

**Scenario 10.5: Idle timeout triggers evaluation**
- **Given** the Observer is active and `lastActivityTimestamp` is >5 minutes ago
- **When** the 30s idle check timer fires
- **Then** the Observer assembles a context snapshot with `user_idle: true`
- **And** calls Haiku for triage
- **And** if Haiku returns `{ should_nudge: true, signal: "idle" }` with confidence >= 0.7, a nudge is sent

**Scenario 10.6: Phase transition triggers evaluation**
- **Given** the Observer is active
- **When** a `phase_started` or `phase_completed` action is logged
- **Then** the Observer runs a triage evaluation

**Scenario 10.7: Cooldown suppresses nudge**
- **Given** the Observer sent a nudge 90 seconds ago (`lastNudgeTimestamp` is 90s old)
- **When** a trigger event fires
- **Then** the triage call is skipped
- **And** `nudge_suppressed` is logged with `{ reason: "cooldown" }`

**Scenario 10.8: Flow state suppresses evaluation**
- **Given** the user has performed 12 actions in the last 60 seconds
- **When** a trigger event fires
- **Then** the triage call is skipped
- **And** `nudge_suppressed` is logged with `{ reason: "flow_state" }`

**Scenario 10.9: Low confidence suppresses nudge**
- **Given** a trigger fires and passes suppression checks
- **When** Haiku returns `{ should_nudge: true, confidence: 0.5, signal: "scope_drift" }`
- **Then** the nudge is not sent
- **And** `nudge_suppressed` is logged with `{ signal: "scope_drift", confidence: 0.5, reason: "low_confidence" }`

**Scenario 10.10: Triage returns no nudge**
- **Given** a trigger fires and passes suppression checks
- **When** Haiku returns `{ should_nudge: false, signal: "no_nudge" }`
- **Then** no nudge is sent, no suppression logged
- **And** `lastEvaluationTimestamp` is updated

**Scenario 10.11: User mutes Observer**
- **Given** the Observer is active and unmuted
- **When** Electron sends `observer:mute { muted: true }`
- **Then** `state.muted` is set to `true`
- **And** `observer_muted` action is logged with `{ muted: true }`
- **And** `observer:status { active: true, muted: true }` is broadcast

**Scenario 10.12: User unmutes Observer**
- **Given** the Observer is muted
- **When** Electron sends `observer:mute { muted: false }`
- **Then** `state.muted` is set to `false`
- **And** `observer_muted` action is logged with `{ muted: false }`
- **And** `observer:status { active: true, muted: false }` is broadcast

**Scenario 10.13: Muted Observer ignores triggers**
- **Given** the Observer is muted
- **When** any trigger event fires
- **Then** no triage call is made, no log entry created (silent skip)

**Scenario 10.14: Triage API call fails**
- **Given** a trigger fires and passes suppression checks
- **When** the Haiku `callApi()` fails (network error, etc.)
- **Then** the error is logged to `api_call_log` (via Story 7's failure logging)
- **And** no nudge is sent
- **And** the Observer continues operating (does not crash or stop)

**Scenario 10.15: No active phase — Observer still works**
- **Given** a session is active but no coaching plan has been created yet
- **When** a trigger fires
- **Then** the context snapshot has `current_phase: null`
- **And** the triage model receives null phase context and makes its decision accordingly

**Scenario 10.16: No Dreyfus assessments — defaults to novice**
- **Given** no Dreyfus assessments exist for any skill area
- **When** the context snapshot is assembled
- **Then** `dreyfus_stage` is `"novice"`

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-65 | Observer trigger fires during ongoing triage call | Skip — `evaluationInProgress` flag checked before calling Haiku |
| EC-66 | Session ends while triage call is in-flight | Let call complete, discard result (session no longer active) |
| EC-67 | Haiku returns `should_nudge: true` with signal `"no_nudge"` | Treat as contradictory — don't nudge, log warning |
| EC-68 | Electron disconnected when nudge needs delivery | Broadcast no-ops (Story 5, EC-24). Nudge is lost. Log `nudge_sent` anyway. |
| EC-69 | Very rapid trigger events (burst of file saves) | Suppression checks (cooldown, flow state) prevent excessive evaluation |
| EC-70 | `observer:mute` received when no session active | Ignore — no Observer state to modify. Log warning. |
| EC-71 | Idle timer fires after session ended | Timer cleared on session end. If race condition, check `active` flag and skip. |
| EC-72 | Triage consistently returns low confidence | Normal operation — Observer stays quiet. No escalation mechanism. |
| EC-73 | Multiple phase transitions in quick succession | Each triggers evaluation but cooldown/flow state may suppress. Normal. |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-129 | Observer MUST start when a session becomes active: create state, subscribe to EventEmitter, start idle timer | High |
| FR-130 | Observer MUST stop when session ends: unsubscribe, clear timer, broadcast status | High |
| FR-131 | Observer MUST subscribe to action log EventEmitter for real-time trigger events (D55) | High |
| FR-132 | Trigger events: `file_open`, `file_save` (always), `buffer_update` (threshold 5), `phase_started`/`phase_completed` (always), idle check (30s timer, 5min threshold) | High |
| FR-133 | Suppression check order: muted → cooldown (120s) → flow state (>10 actions in 60s) | High |
| FR-134 | Muted Observer MUST silently skip all triggers (no log) | High |
| FR-135 | Cooldown suppression MUST log `nudge_suppressed` with `reason: "cooldown"` | High |
| FR-136 | Flow state suppression MUST log `nudge_suppressed` with `reason: "flow_state"` | High |
| FR-137 | Context snapshot MUST include: current_phase (or null), last 20 actions, time_since_last_save, time_since_last_nudge, dreyfus_stage, user_idle | High |
| FR-138 | Dreyfus stage MUST default to `"novice"` when no assessments exist | High |
| FR-139 | Triage MUST use `callApi<T>()` with model `"haiku"` and `prompts/observer-triage.ts` template | High |
| FR-140 | If `should_nudge: true` AND `confidence >= 0.7`: log `nudge_sent`, broadcast `observer:nudge`, update `lastNudgeTimestamp` | High |
| FR-141 | If `should_nudge: true` AND `confidence < 0.7`: log `nudge_suppressed` with `reason: "low_confidence"` | High |
| FR-142 | If `should_nudge: false`: no log, update `lastEvaluationTimestamp` only | High |
| FR-143 | `observer:nudge` WebSocket message MUST include signal, confidence, and suggested_context | High |
| FR-144 | `observer:mute` WebSocket handler MUST flip mute state, log `observer_muted` action, broadcast `observer:status` | High |
| FR-145 | `observer:status` MUST be broadcast on session start, session end, and mute toggle | High |
| FR-146 | Triage API call failure MUST NOT crash or stop the Observer — log failure and continue | High |
| FR-147 | `evaluationInProgress` flag MUST prevent concurrent triage calls | High |
| FR-148 | `bufferUpdatesSinceLastEval` counter MUST reset after each evaluation | High |
| FR-149 | Idle check timer (30s interval) MUST be cleared on session end | High |
| FR-150 | Prompt template `prompts/observer-triage.ts` MUST follow Story 7 convention (SYSTEM_PROMPT, responseSchema, assembleUserMessage, response type) | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-062 | Observer starts with session | Session creation results in Observer state, EventEmitter subscription, idle timer, and status broadcast |
| SC-063 | Observer stops with session | `paige_end_session` unsubscribes Observer, clears timer, broadcasts inactive status |
| SC-064 | Trigger → triage works | File open event triggers Haiku call with correct context snapshot |
| SC-065 | Nudge delivered | `should_nudge: true` + confidence >= 0.7 results in `observer:nudge` broadcast |
| SC-066 | Cooldown works | Nudge within 120s of previous nudge is suppressed with logged reason |
| SC-067 | Flow state works | >10 actions in 60s suppresses triage entirely |
| SC-068 | Mute works | `observer:mute { muted: true }` prevents all evaluations; unmute re-enables |
| SC-069 | Low confidence suppressed | `should_nudge: true` with confidence 0.5 is suppressed, not delivered |
| SC-070 | Triage failure resilient | Haiku call failure logged, Observer continues operating |
| SC-071 | Buffer threshold works | 5th buffer_update triggers evaluation, counter resets |

---

### User Story 11 — UI-Driven API Calls (Priority: P3)

**Revision**: v1.0

**As** the backend server, **I** handle two WebSocket-triggered API call flows — "Explain This" (code explanation) and Practice Mode Review (kata evaluation) — using `callApi<T>()` from Story 7, **so that** the Electron UI can offer AI-powered features that bypass the terminal conversation entirely.

**Packages**: No new packages — uses `callApi<T>()` (Story 7), SQLite (Story 2), WebSocket broadcast (Story 5).

**Key Decisions**: D65–D76

#### Architecture

```
Electron UI ──ws──→ Backend ──callApi──→ Sonnet ──→ Backend ──ws──→ Electron UI
                       ↓                              ↓
                    SQLite (Dreyfus,              Action log
                     kata_specs,                  (explain_completed,
                     active phase)                 review_completed)
```

Both flows share the same pattern:
1. Electron sends WebSocket message (user action)
2. Backend enriches with server-side state (Dreyfus stage, session/phase context)
3. Backend calls Sonnet via `callApi<T>()` with one automatic retry on transient failure (D68)
4. Backend logs domain action + broadcasts response to Electron
5. On final failure: broadcasts error message for toast rendering

#### WebSocket Message Types (6 new — additive revision to Story 5)

**Client → Server** (upgrading stubs from Story 5):

```typescript
// user:explain — upgraded from Stub to Full
interface ExplainRequest {
  type: "user:explain";
  payload: {
    path: string;                    // File path
    language: string;                // Language ID (e.g., "typescript")
    selection: {
      startLine: number;
      startCol: number;
      endLine: number;
      endCol: number;
    };
    selectedText: string;            // The highlighted text
    surroundingContext: string;       // ±50 lines around selection
  };
}

// user:review — upgraded from Stub to Full
interface ReviewRequest {
  type: "user:review";
  payload: {
    kataId: string;                  // kata_specs.id from SQLite
    userCode: string;                // User's submitted solution
    activeConstraintTitles: string[]; // Constraints the user opted into
  };
}
```

**Server → Client** (4 new message types):

```typescript
interface ExplainResponse {
  type: "explain:response";
  payload: {
    path: string;                    // Echo back for UI correlation
    explanation: string;
    keyConcepts: string[];
    analogy: string | null;          // Nullable — Sonnet decides when useful (D73)
    relatedFiles: string[] | null;   // Nullable — inferred from imports (D74)
    phaseConnection: string | null;  // "This relates to Phase 2..." or null
  };
}

interface ExplainError {
  type: "explain:error";
  payload: {
    path: string;                    // Echo back for UI correlation
    error: string;                   // Human-readable error message
  };
}

interface ReviewResponse {
  type: "review:response";
  payload: {
    kataId: string;                  // Echo back for UI correlation
    correct: boolean;
    feedback: string;
    level: number;                   // 1-10, user's assessed level on this kata
    passed: boolean;                 // Whether this attempt passes
    followUp: {
      type: "constraint_escalation" | "retry_hint" | "completed";
      constraint?: string;           // New constraint text if escalation
      reason?: string;               // Why this follow-up
    } | null;
    dreyfusSignal: "advancing" | "stable" | "struggling";
    unlockedConstraints: Array<{     // Constraints newly available at this level
      title: string;
      description: string;
      minLevel: number;
    }>;
  };
}

interface ReviewError {
  type: "review:error";
  payload: {
    kataId: string;                  // Echo back for UI correlation
    error: string;                   // Human-readable error message
  };
}
```

#### Flow 1: "Explain This"

```
Electron (user highlights code + clicks Explain)
    │
    ▼
1. Receive user:explain WebSocket message
2. Log explain_requested action (Story 4, already defined)
3. Look up active session from SQLite (if any)
4. Look up Dreyfus assessments from SQLite
    │  → pick most relevant stage by language/topic, default "novice"
5. Look up active phase from SQLite (if session + plan exists)
    │
    ▼
6. Call Sonnet: Explain This
    │  → system prompt includes Dreyfus stage (D70)
    │  → user message includes selectedText, surroundingContext, path, language, phase context
    │
    ├── Transient failure? → retry once (D68)
    ├── Final failure? → log explain_completed (error), broadcast explain:error, return
    │
    ▼
7. Log explain_completed action (D72) with { path, model, latency_ms }
8. Broadcast explain:response to Electron
```

#### Flow 2: Practice Mode Review

```
Electron (user submits kata solution)
    │
    ▼
1. Receive user:review WebSocket message
2. Log review_requested action (Story 4, already defined)
3. Load kata_specs row from SQLite by kataId
    │  → includes description, instructor_notes, constraints, user_attempts
    │
    ├── kata not found? → broadcast review:error, return
    │
4. Load knowledge_gap row via kata's knowledge_gap_id
5. Look up Dreyfus stage for the gap's topic, default "novice"
6. Resolve activeConstraintTitles against kata's constraints array
7. Filter user_attempts to those with matching constraint set (D75)
    │
    ▼
8. Call Sonnet: Practice Review
    │  → system prompt includes Dreyfus stage (D70)
    │  → user message includes kata description, instructor_notes,
    │     active constraints, user code, previous same-constraint attempts
    │
    ├── Transient failure? → retry once (D68)
    ├── Final failure? → log review_completed (error), broadcast review:error, return
    │
    ▼
9.  Append attempt to kata_specs.user_attempts JSON array:
    { code, review: feedback, level, passed, constraints: activeConstraintTitles }
10. Compute unlockedConstraints: constraints where minLevel ≤ new level
     AND not already unlocked at previous level
11. Log review_completed action (D72) with { kataId, level, passed, model, latency_ms }
12. Broadcast review:response to Electron
```

**Note**: Katas are never marked "completed" — users can keep attempting with different approaches and constraint combinations (D71).

#### Prompt Template Modules (2 modules, Story 7 convention)

**Module 1: `prompts/explain-this.ts`** (Sonnet)

```typescript
import { z } from "zod";

export const SYSTEM_PROMPT = `You are Paige's code explanation engine — part of an AI coding coach for junior developers.
You explain code clearly and helpfully, calibrated to the user's skill level.

User's Dreyfus stage: {dreyfus_stage}
- novice/advanced_beginner: Use plain language, provide analogies, explain every concept. Avoid jargon.
- competent: Technical language is fine. Focus on "why" not "what". Skip basics.
- proficient/expert: Be terse and implementation-focused. Emphasise architectural context.

If the user is currently working through a coaching session, connect your explanation to their current task when relevant.`;

export const responseSchema = z.object({
  explanation: z.string().describe("Clear explanation of the selected code"),
  key_concepts: z.array(z.string()).describe("Key concepts the code demonstrates"),
  analogy: z.string().nullable().describe("An analogy to aid understanding, or null if not useful"),
  related_files: z.array(z.string()).nullable().describe("Files related to this code based on visible imports/references, or null"),
  phase_connection: z.string().nullable().describe("How this code relates to the user's current coaching phase, or null"),
});

export type ExplainThisResponse = z.infer<typeof responseSchema>;

export function assembleUserMessage(
  selectedText: string,
  surroundingContext: string,
  path: string,
  language: string,
  phaseContext: { number: number; title: string; description: string } | null
): string {
  return JSON.stringify({
    selected_code: selectedText,
    surrounding_context: surroundingContext,
    file_path: path,
    language,
    current_phase: phaseContext,
  });
}
```

**Module 2: `prompts/practice-review.ts`** (Sonnet)

```typescript
import { z } from "zod";

export const SYSTEM_PROMPT = `You are Paige's practice mode reviewer — part of an AI coding coach for junior developers.
You evaluate kata solutions for correctness and provide pedagogically useful feedback.

User's Dreyfus stage for this topic: {dreyfus_stage}
- novice/advanced_beginner: Be encouraging. Explain what's right before what's wrong. Give specific hints.
- competent: Be direct. Focus on edge cases and code quality.
- proficient/expert: Be concise. Highlight subtle issues. Challenge with harder constraints.

You have access to instructor_notes that the student cannot see — use them to guide your evaluation.
When the student passes, suggest follow-up constraints that push their understanding deeper.
Assess their level (1-10) based on the quality and sophistication of their solution.`;

export const responseSchema = z.object({
  correct: z.boolean().describe("Whether the solution meets the kata requirements"),
  feedback: z.string().describe("Pedagogically useful feedback on the solution"),
  level: z.number().int().min(1).max(10).describe("Assessed skill level 1-10 for this kata"),
  passed: z.boolean().describe("Whether this attempt passes the kata requirements with active constraints"),
  follow_up: z.object({
    type: z.enum(["constraint_escalation", "retry_hint", "completed"]),
    constraint: z.string().optional().describe("New constraint text if type is constraint_escalation"),
    reason: z.string().optional().describe("Why this follow-up is suggested"),
  }).nullable().describe("Suggested next step, or null"),
  dreyfus_signal: z.enum(["advancing", "stable", "struggling"]).describe("Signal about user's skill trajectory"),
});

export type PracticeReviewResponse = z.infer<typeof responseSchema>;

export function assembleUserMessage(
  kataDescription: string,
  instructorNotes: string,
  activeConstraints: Array<{ title: string; description: string }>,
  userCode: string,
  previousAttempts: Array<{ code: string; review?: string; level?: number; passed?: boolean }>
): string {
  return JSON.stringify({
    kata_description: kataDescription,
    instructor_notes: instructorNotes,
    active_constraints: activeConstraints,
    user_code: userCode,
    previous_attempts: previousAttempts,
  });
}
```

#### Action Log Types (2 new — additive revision to Story 4)

| Action Type | Logged Data | Trigger |
|---|---|---|
| `explain_completed` | `{ path, model, latency_ms, success: boolean, error?: string }` | After Explain This API call (success or failure) |
| `review_completed` | `{ kataId, level, passed, model, latency_ms, success: boolean, error?: string }` | After Practice Review API call (success or failure) |

**Note**: `explain_requested` and `review_requested` are already defined in Story 4's action type table (logged when the WebSocket message arrives, before the API call).

#### Retry Behaviour (D68)

Both flows use the same retry pattern:
1. First `callApi()` attempt
2. If transient failure (network error, 429 after SDK exhausts retries, 500): wait 1 second, retry once
3. If second attempt fails OR non-transient error (refusal, max_tokens, auth): fail to user
4. Both attempts are logged to `api_call_log` automatically by `callApi()`

This is implemented as a thin wrapper around `callApi()`, not a modification to `callApi()` itself:

```typescript
async function callApiWithRetry<T>(options: CallApiOptions<T>): Promise<T> {
  try {
    return await callApi(options);
  } catch (error) {
    if (isTransientError(error)) {
      await sleep(1000);
      return await callApi(options);
    }
    throw error;
  }
}
```

#### Acceptance Scenarios

**Scenario 11.1: Explain This — happy path**
- **Given** an active WebSocket connection
- **When** Electron sends `user:explain` with path, language, selection, selectedText, and surroundingContext
- **Then** the backend logs `explain_requested` action
- **And** calls Sonnet with the explain-this prompt template, injecting the user's Dreyfus stage
- **And** broadcasts `explain:response` with explanation, keyConcepts, analogy (or null), relatedFiles (or null), and phaseConnection (or null)
- **And** logs `explain_completed` action with path, model, and latency_ms

**Scenario 11.2: Explain This — with active coaching session**
- **Given** a session is active with a plan and phases
- **When** Electron sends `user:explain`
- **Then** the backend includes the active phase's number, title, and description in the API call
- **And** the response's `phaseConnection` may reference the current phase

**Scenario 11.3: Explain This — no active session**
- **Given** no session is active (or no plan exists)
- **When** Electron sends `user:explain`
- **Then** the backend calls Sonnet with null phase context
- **And** `phaseConnection` in the response is null
- **And** Dreyfus stage defaults to "novice" if no assessments exist

**Scenario 11.4: Explain This — API failure with retry**
- **Given** an active WebSocket connection
- **When** Sonnet call fails with a transient error
- **Then** the backend waits 1 second and retries once
- **And** if the retry succeeds, the response is broadcast normally
- **And** both attempts are logged in `api_call_log`

**Scenario 11.5: Explain This — final failure**
- **Given** an active WebSocket connection
- **When** both the initial call and retry fail (or a non-transient error occurs)
- **Then** the backend broadcasts `explain:error` with a human-readable error message
- **And** logs `explain_completed` with `{ success: false, error: <message> }`

**Scenario 11.6: Practice Review — happy path**
- **Given** a kata_specs row exists in SQLite
- **When** Electron sends `user:review` with kataId, userCode, and activeConstraintTitles
- **Then** the backend loads the kata spec (including instructor_notes) from SQLite
- **And** looks up the Dreyfus stage for the kata's knowledge gap topic
- **And** resolves active constraints against the kata's constraints array
- **And** filters previous attempts to those with matching constraint set (D75)
- **And** calls Sonnet with the practice-review prompt template
- **And** appends the attempt to `kata_specs.user_attempts` JSON array
- **And** broadcasts `review:response` with correct, feedback, level, passed, followUp, dreyfusSignal, and unlockedConstraints

**Scenario 11.7: Practice Review — constraint unlocking**
- **Given** a kata with constraints at minLevel 1, 3, 5, and 7
- **And** the user's previous best level was 2
- **When** the review returns level 5
- **Then** `unlockedConstraints` includes the constraints at minLevel 3 and 5 (newly unlocked)
- **And** does not include the constraint at minLevel 1 (already unlocked)

**Scenario 11.8: Practice Review — multiple submissions**
- **Given** a kata with 2 previous attempts
- **When** the user submits attempt 3
- **Then** the backend sends previous same-constraint attempts to Sonnet for contextual feedback
- **And** appends the new attempt (attempt 3) to the user_attempts array
- **And** all 3 attempts are preserved in the JSON array

**Scenario 11.9: Practice Review — kata not found**
- **Given** a `user:review` message with a kataId that doesn't exist in SQLite
- **When** the handler processes the message
- **Then** it broadcasts `review:error` with "Kata not found"
- **And** does not make an API call

**Scenario 11.10: Practice Review — API failure**
- **Given** a valid kata exists
- **When** the Sonnet call fails after retry
- **Then** the backend broadcasts `review:error` with a human-readable message
- **And** logs `review_completed` with `{ success: false }`
- **And** does NOT append a failed attempt to user_attempts

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-74 | `user:explain` with empty selectedText | Pass to Sonnet as-is — model can still explain from surroundingContext + selection range |
| EC-75 | `user:explain` for binary file | Client shouldn't send this. If received, broadcast `explain:error` with "Cannot explain binary files" |
| EC-76 | `user:review` with empty userCode | Pass to Sonnet — model returns feedback like "No code submitted" |
| EC-77 | `user:review` with constraint titles that don't match any kata constraint | Ignore unmatched titles, proceed with matched constraints only. If none match, proceed with no constraints. |
| EC-78 | Concurrent explain requests | Each processed independently. Multiple `explain:response` messages may arrive. |
| EC-79 | Concurrent review requests for same kata | Each processed independently. Both append to user_attempts. Last-write-wins on JSON update (WAL handles concurrent reads). |
| EC-80 | `user:review` while no session is active | Still works — kata_specs exist globally via knowledge_gaps. Dreyfus defaults to "novice". |
| EC-81 | Very large surroundingContext (>10k chars) | Pass to Sonnet as-is. maxTokens handles response size. |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-151 | `user:explain` handler MUST log `explain_requested`, call Sonnet, log `explain_completed`, broadcast `explain:response` | High |
| FR-152 | `user:explain` handler MUST enrich API call with Dreyfus stage from SQLite (default "novice") | High |
| FR-153 | `user:explain` handler MUST include active phase context when a coaching session with plan exists | High |
| FR-154 | `user:review` handler MUST load kata_specs from SQLite by kataId (including instructor_notes) | High |
| FR-155 | `user:review` handler MUST resolve activeConstraintTitles against kata's constraints array | High |
| FR-156 | `user:review` handler MUST filter user_attempts to same-constraint set before sending to Sonnet | High |
| FR-157 | `user:review` handler MUST append attempt to kata_specs.user_attempts JSON after successful API call | High |
| FR-158 | `user:review` handler MUST compute unlockedConstraints by comparing pre- and post-level against constraint minLevel gates | High |
| FR-159 | Both handlers MUST use `callApiWithRetry()` — one retry on transient failure with 1s delay | High |
| FR-160 | Both handlers MUST broadcast error message type on final failure | High |
| FR-161 | `prompts/explain-this.ts` MUST follow Story 7 convention (SYSTEM_PROMPT, responseSchema, assembleUserMessage, response type) | High |
| FR-162 | `prompts/practice-review.ts` MUST follow Story 7 convention (SYSTEM_PROMPT, responseSchema, assembleUserMessage, response type) | High |
| FR-163 | Dreyfus stage MUST be injected into system prompts as a variable (D70) | High |
| FR-164 | `explain:response` payload MUST include `analogy` as nullable (D73) and `relatedFiles` as nullable (D74) | High |
| FR-165 | `explain_completed` and `review_completed` action types MUST be logged with domain-specific metadata (D72) | High |
| FR-166 | `user:review` with non-existent kataId MUST broadcast `review:error` without making API call | High |
| FR-167 | Failed API calls MUST NOT append attempts to kata_specs.user_attempts | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-072 | Explain This works end-to-end | `user:explain` → Sonnet call → `explain:response` with valid explanation |
| SC-073 | Explain This Dreyfus-aware | Different Dreyfus stages produce noticeably different explanation depths |
| SC-074 | Explain This phase-aware | Active phase context appears in `phaseConnection` when session exists |
| SC-075 | Practice Review works end-to-end | `user:review` → kata loaded → Sonnet call → `review:response` with feedback + level |
| SC-076 | Constraint unlocking works | Level increase from 2→5 unlocks minLevel 3 and 5 constraints in response |
| SC-077 | Attempt history persisted | After 3 submissions, `kata_specs.user_attempts` contains all 3 entries |
| SC-078 | Same-constraint filtering works | Only attempts with matching constraint set sent to Sonnet |
| SC-079 | Retry works | Transient failure on first attempt → retry succeeds → response delivered |
| SC-080 | Error toast works | Final failure → `explain:error` or `review:error` with human-readable message |
| SC-081 | Kata not found handled | Non-existent kataId → `review:error` without API call |

---

### User Story 12 — Dashboard Data Assembly (Priority: P3)

**Revision**: v1.0

**As** the backend server, **I** assemble dashboard data from SQLite queries, GitHub issue assessment (Sonnet + `gh` CLI), and learning materials research (Sonnet + web search), delivering it progressively to Electron, **so that** the user sees a personalized launch screen with stats, curated issues, practice challenges, and learning resources.

**Packages**: No new packages — uses `callApi<T>()` with optional tools (Story 7, D83), `queryMemories()` (Story 8), `callApiWithRetry()` (Story 11), SQLite (Story 2), WebSocket broadcast (Story 5). `gh` CLI invoked via `child_process.execFile`.

**Key Decisions**: D77–D89

#### Architecture

```
Electron ──ws──→ Backend
                    │
                    ├── Immediate: SQLite queries → dashboard:state
                    │
                    └── Parallel (async):
                        ├── gh issue list → ChromaDB query → Sonnet → dashboard:issues
                        └── SQLite knowledge_gaps → Sonnet + web_search → dashboard:materials
```

#### Progressive Loading Flow

```
Electron sends: dashboard:request { statsPeriod?: "7d" | "30d" | "all" }
    │
    ▼
1. Query SQLite: Dreyfus assessments, stats, in-progress sessions, katas
2. Broadcast dashboard:state immediately (no API calls)
    │
    ├── Kick off in parallel (non-blocking):
    │
    │   Flow A: Issue Assessment
    │   3a. Run gh issue list --state open --json ... --limit 50 from PROJECT_DIR (D80)
    │   4a. Query ChromaDB: memories related to issue topics (D84)
    │       ├── ChromaDB unavailable? → skip memories
    │   5a. Call Sonnet: Issue Assessment (issues + Dreyfus + gaps + sessions + memories)
    │       ├── callApiWithRetry (D88)
    │       ├── Success → broadcast dashboard:issues
    │       └── Failure → broadcast dashboard:issues_error
    │
    │   Flow B: Learning Materials
    │   3b. Query SQLite: top 5 unaddressed gaps by severity then frequency (D87)
    │   4b. Call Sonnet + web_search tool: Learning Materials Research (D81)
    │       ├── callApiWithRetry (D88)
    │       ├── Success → broadcast dashboard:materials
    │       └── Failure → broadcast dashboard:materials_error
    │
    ▼
3. Log dashboard_loaded action
```

#### Refresh Flow

```
Electron sends: dashboard:refresh_issues {}
    │
    ▼
1. Run gh issue list (same as Flow A above)
2. Query ChromaDB for memories
3. Call Sonnet: Issue Assessment
4. Broadcast dashboard:issues or dashboard:issues_error
```

Only re-runs issue assessment. Does NOT re-send `dashboard:state` (D82).

#### WebSocket Message Types (7 new — additive revision to Story 5)

**Client → Server** (upgrading stubs / adding new):

```typescript
// dashboard:request — upgraded from Stub to Full
interface DashboardRequest {
  type: "dashboard:request";
  payload: {
    statsPeriod?: "7d" | "30d" | "all";  // Default: "all"
  };
}

// dashboard:refresh_issues — new (replaces dashboard:stats_period stub)
interface DashboardRefreshIssues {
  type: "dashboard:refresh_issues";
  payload: {};
}
```

**Server → Client** (5 new message types):

```typescript
interface DashboardState {
  type: "dashboard:state";
  payload: {
    dreyfus: Array<{
      skillArea: string;
      stage: string;
      confidence: number;
      assessedAt: string;
    }>;
    stats: {
      period: string;
      sessionsCompleted: number;
      totalCoachingMinutes: number;
      issuesWorkedOn: number;
      knowledgeGapsIdentified: number;
      knowledgeGapsAddressed: number;
      hintsUsed: number;
      apiCostTotal: number;
    };
    inProgressSessions: Array<{
      id: string;
      issueNumber: number | null;
      issueTitle: string | null;
      startedAt: string;
    }>;
    katas: Array<{
      id: string;
      title: string;
      topic: string;
      attemptsCount: number;
      bestLevel: number | null;
      constraintCount: number;
    }>;
  };
}

interface DashboardIssues {
  type: "dashboard:issues";
  payload: {
    issues: Array<{
      number: number;
      title: string;
      summary: string;
      suitability: "good_fit" | "stretch" | "too_advanced";
      suitabilityReason: string;
      estimatedDifficulty: "beginner" | "intermediate" | "advanced";
      relevantSkills: string[];
      priorityScore: number;
      priorityFactors: {
        userTagged: boolean;
        similarToRecentWork: boolean;
        addressesKnowledgeGap: boolean;
        teamUrgency: "low" | "medium" | "high";
      };
      learningOpportunities: string[];
    }>;
  };
}

interface DashboardIssuesError {
  type: "dashboard:issues_error";
  payload: {
    error: string;
  };
}

interface DashboardMaterials {
  type: "dashboard:materials";
  payload: {
    recommendations: Array<{
      knowledgeGap: string;
      resources: Array<{
        type: "documentation" | "article" | "video" | "tutorial";
        title: string;
        url: string;
        description: string;
        relevance: "direct" | "deep_dive" | "supplementary";
        estimatedTime: string;
      }>;
      studyOrder: string;
      practiceConnection: string | null;
    }>;
  };
}

interface DashboardMaterialsError {
  type: "dashboard:materials_error";
  payload: {
    error: string;
  };
}
```

#### SQLite Queries for `dashboard:state`

**Dreyfus assessments**: `SELECT * FROM dreyfus_assessments`

**Stats** (filtered by `statsPeriod`):

```sql
-- Sessions completed
SELECT COUNT(*) FROM sessions WHERE status = 'completed' AND ended_at >= :periodStart

-- Total coaching minutes
SELECT SUM((julianday(ended_at) - julianday(started_at)) * 1440) FROM sessions
  WHERE status = 'completed' AND ended_at >= :periodStart

-- Issues worked on
SELECT COUNT(DISTINCT issue_number) FROM sessions
  WHERE issue_number IS NOT NULL AND started_at >= :periodStart

-- Knowledge gaps
SELECT
  COUNT(*) AS identified,
  SUM(CASE WHEN addressed = 1 THEN 1 ELSE 0 END) AS addressed
FROM knowledge_gaps WHERE last_encountered_at >= :periodStart

-- Hints used
SELECT COUNT(*) FROM progress_events pe
  JOIN phases p ON pe.phase_id = p.id
  JOIN plans pl ON p.plan_id = pl.id
  JOIN sessions s ON pl.session_id = s.id
  WHERE pe.event_type = 'hint_used' AND s.started_at >= :periodStart

-- API cost total
SELECT SUM(cost_estimate) FROM api_call_log WHERE created_at >= :periodStart
```

**`periodStart` resolution**: `"7d"` → 7 days ago, `"30d"` → 30 days ago, `"all"` → epoch (no filter).

**In-progress sessions**: `SELECT id, issue_number, issue_title, started_at FROM sessions WHERE status = 'active'`

**Katas**: Load `kata_specs` joined with `knowledge_gaps` (for topic). Compute `attemptsCount` and `bestLevel` from the `user_attempts` JSON array in application code.

#### `gh` CLI Integration

```typescript
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

async function fetchGitHubIssues(projectDir: string): Promise<GitHubIssue[]> {
  const { stdout } = await execFileAsync("gh", [
    "issue", "list",
    "--state", "open",
    "--json", "number,title,body,labels,assignees,comments",
    "--limit", "50",
  ], { cwd: projectDir });
  return JSON.parse(stdout);
}
```

Runs from `PROJECT_DIR` so `gh` infers the repo from git remote (D80).

#### Prompt Template Modules (2 modules, Story 7 convention)

**Module 1: `prompts/issue-assessment.ts`** (Sonnet)

```typescript
import { z } from "zod";

export const SYSTEM_PROMPT = `You are Paige's issue curation engine — part of an AI coding coach for junior developers.
You assess GitHub issues against the user's skill profile and rank them by learning suitability.

Select the top 10 most suitable issues for this user. Prioritise:
1. Issues the user is tagged in or assigned to
2. Issues that address known knowledge gaps
3. Issues similar to recent work (building on momentum)
4. Issues at or slightly above the user's Dreyfus stage

For each selected issue, write a concise summary in Paige's voice — calibrated to the user's level, not raw GitHub prose.

Suitability levels:
- good_fit: Within or slightly above current ability. Recommended.
- stretch: Notably above current ability. Challenging but achievable with effort.
- too_advanced: Significantly beyond current skills. Not recommended yet.`;

export const responseSchema = z.object({
  issues: z.array(z.object({
    number: z.number().int().positive(),
    title: z.string(),
    summary: z.string().describe("Paige-voice digest of the issue"),
    suitability: z.enum(["good_fit", "stretch", "too_advanced"]),
    suitability_reason: z.string(),
    estimated_difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    relevant_skills: z.array(z.string()),
    priority_score: z.number().min(0).max(1),
    priority_factors: z.object({
      user_tagged: z.boolean(),
      similar_to_recent_work: z.boolean(),
      addresses_knowledge_gap: z.boolean(),
      team_urgency: z.enum(["low", "medium", "high"]),
    }),
    learning_opportunities: z.array(z.string()),
  })).max(10),
});

export type IssueAssessmentResponse = z.infer<typeof responseSchema>;

export function assembleUserMessage(
  issues: GitHubIssue[],
  dreyfusAssessments: DreyfusAssessment[],
  recentSessions: Array<{ issueTitle: string | null; completedAt: string }>,
  knowledgeGaps: Array<{ topic: string; severity: string }>,
  memories: Array<{ content: string; connection?: string }>
): string {
  return JSON.stringify({
    github_issues: issues,
    user_dreyfus_stages: dreyfusAssessments,
    recent_sessions: recentSessions,
    knowledge_gaps: knowledgeGaps,
    related_memories: memories,
  });
}
```

**Module 2: `prompts/learning-materials.ts`** (Sonnet + web_search tool)

```typescript
import { z } from "zod";

export const SYSTEM_PROMPT = `You are Paige's learning materials researcher — part of an AI coding coach for junior developers.
You find high-quality learning resources for identified knowledge gaps.

User's overall Dreyfus stage: {dreyfus_stage}

For each knowledge gap, use the web_search tool to find current, relevant resources:
- Official documentation (always include if available)
- Well-known tutorials and articles
- Video explanations from established channels
- Content appropriate for the user's skill level

Provide a study order and connect resources back to available practice katas where relevant.
Prefer resources that are:
- Free and publicly accessible
- From authoritative sources (official docs, well-known authors)
- At the right level for the user's Dreyfus stage`;

export const responseSchema = z.object({
  recommendations: z.array(z.object({
    knowledge_gap: z.string(),
    resources: z.array(z.object({
      type: z.enum(["documentation", "article", "video", "tutorial"]),
      title: z.string(),
      url: z.string().url(),
      description: z.string(),
      relevance: z.enum(["direct", "deep_dive", "supplementary"]),
      estimated_time: z.string(),
    })),
    study_order: z.string().describe("Recommended order to consume resources"),
    practice_connection: z.string().nullable().describe("Link to relevant kata, or null"),
  })),
});

export type LearningMaterialsResponse = z.infer<typeof responseSchema>;

export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
};

export function assembleUserMessage(
  gaps: Array<{ topic: string; severity: string; relatedConcepts: string[]; frequency: number }>,
  techStack: string,
  existingKataTitles: string[]
): string {
  return JSON.stringify({
    knowledge_gaps: gaps,
    tech_stack: techStack,
    available_katas: existingKataTitles,
  });
}
```

#### Additive Revision to Story 7: `callApi` tools parameter (D83)

```typescript
interface CallApiOptions<T> {
  callType: string;
  model: ModelTier;
  systemPrompt: string;
  userMessage: string;
  responseSchema: ZodSchema<T>;
  sessionId: string;
  maxTokens?: number;
  tools?: Array<{ type: string; name: string }>;  // NEW — connector tools (e.g., web_search)
}
```

When `tools` is provided, the SDK includes them in the API request. Server-side connector tools (like `web_search_20250305`) are executed by Anthropic's infrastructure — the backend just passes them through. Structured output still applies to the final response.

#### Action Log Types (1 new — additive revision to Story 4)

| Action Type | Logged Data | Trigger |
|---|---|---|
| `dashboard_loaded` | `{ statsPeriod, issuesLoaded: boolean, materialsLoaded: boolean }` | After all dashboard flows complete (or fail) |

#### Acceptance Scenarios

**Scenario 12.1: Dashboard load — immediate response**
- **Given** an active WebSocket connection
- **When** Electron sends `dashboard:request` with `{ statsPeriod: "7d" }`
- **Then** the backend queries SQLite for Dreyfus assessments, stats (last 7 days), in-progress sessions, and katas
- **And** broadcasts `dashboard:state` immediately

**Scenario 12.2: Dashboard load — progressive issue assessment**
- **Given** `dashboard:request` has been received
- **When** the backend runs `gh issue list` from `PROJECT_DIR` (up to 50 open issues)
- **And** queries ChromaDB for memories related to issue topics
- **And** calls Sonnet with all issue data, Dreyfus stages, recent sessions, knowledge gaps, and related memories
- **Then** Sonnet selects and ranks the top 10 issues by suitability
- **And** the backend broadcasts `dashboard:issues` with the curated list

**Scenario 12.3: Dashboard load — progressive learning materials**
- **Given** `dashboard:request` has been received
- **When** the backend queries top 5 unaddressed knowledge gaps by severity then frequency
- **And** calls Sonnet with the `web_search` tool to find real resources
- **Then** the backend broadcasts `dashboard:materials` with recommendations per gap

**Scenario 12.4: Issue assessment — ChromaDB unavailable**
- **Given** ChromaDB is unavailable
- **When** the issue assessment flow runs
- **Then** it skips the memory query and calls Sonnet with empty memories
- **And** `dashboard:issues` is still broadcast with curated issues

**Scenario 12.5: Issue assessment — gh CLI failure**
- **Given** `gh issue list` fails (auth, no remote, timeout)
- **When** the error is caught
- **Then** the backend broadcasts `dashboard:issues_error` with a human-readable message
- **And** no Sonnet call is made (nothing to assess)

**Scenario 12.6: Issue assessment — API failure**
- **Given** `gh issue list` succeeds
- **When** the Sonnet call fails after retry
- **Then** the backend broadcasts `dashboard:issues_error` with a human-readable message

**Scenario 12.7: Learning materials — API failure**
- **Given** knowledge gaps exist
- **When** the Sonnet call with web search fails after retry
- **Then** the backend broadcasts `dashboard:materials_error` with a human-readable message

**Scenario 12.8: Dashboard refresh issues**
- **Given** a dashboard is already loaded
- **When** Electron sends `dashboard:refresh_issues`
- **Then** the backend re-runs only the issue assessment flow (gh + ChromaDB + Sonnet)
- **And** broadcasts `dashboard:issues` or `dashboard:issues_error`
- **And** does NOT re-send `dashboard:state`

**Scenario 12.9: Dashboard with no data**
- **Given** a fresh install with no sessions, no gaps, no assessments
- **When** Electron sends `dashboard:request`
- **Then** `dashboard:state` contains empty arrays and zero stats
- **And** learning materials call is skipped (no gaps to research)
- **And** issue assessment still runs (issues exist independently)

**Scenario 12.10: Stats period filtering**
- **Given** sessions spanning 30+ days exist
- **When** `dashboard:request` is sent with `statsPeriod: "7d"`
- **Then** `stats` only include data from the last 7 days
- **And** `dreyfus`, `inProgressSessions`, and `katas` are unfiltered (they're current state, not period-bound)

**Scenario 12.11: Dashboard load — parallel execution**
- **Given** `dashboard:request` is received
- **When** both issue assessment and learning materials flows are kicked off
- **Then** they run in parallel (not sequentially)
- **And** each broadcasts independently as it completes
- **And** `dashboard:state` has already been sent before either completes

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-82 | `gh` not installed | `execFile` throws ENOENT. Broadcast `dashboard:issues_error` with "GitHub CLI not found". |
| EC-83 | Project has no GitHub remote | `gh issue list` returns error. Broadcast `dashboard:issues_error` with "No GitHub remote found". |
| EC-84 | Project has 0 open issues | Sonnet receives empty array. Returns empty issues list. `dashboard:issues` with `issues: []`. |
| EC-85 | No knowledge gaps exist | Skip learning materials call entirely. No `dashboard:materials` sent. |
| EC-86 | All knowledge gaps addressed | Same as EC-85 — no unaddressed gaps to research. |
| EC-87 | `web_search` tool returns no results | Sonnet generates best-effort recommendations from training knowledge. URLs may be less reliable. |
| EC-88 | Stats query for period with no data | All counters return 0. `dashboard:state` valid with zero stats. |
| EC-89 | Very long issue bodies | Truncate issue bodies to 2000 chars each before sending to Sonnet. 50 issues × 2000 chars is ~100k tokens. |
| EC-90 | Concurrent `dashboard:request` messages | Each processed independently. May result in duplicate API calls. |
| EC-91 | `dashboard:refresh_issues` while initial load still in progress | Both run independently. Electron receives whichever completes first, then the second. |

#### Functional Requirements

| ID | Requirement | Confidence |
|----|-------------|------------|
| FR-168 | `dashboard:request` handler MUST immediately broadcast `dashboard:state` with SQLite data | High |
| FR-169 | `dashboard:state` MUST include dreyfus assessments, stats (filtered by period), in-progress sessions, and katas | High |
| FR-170 | Stats MUST be filterable by period: "7d", "30d", "all" (default "all") | High |
| FR-171 | Issue assessment MUST run `gh issue list --state open --json ... --limit 50` from `PROJECT_DIR` | High |
| FR-172 | Issue assessment MUST query ChromaDB for related memories (skip if unavailable) | High |
| FR-173 | Issue assessment MUST call Sonnet to select and rank top 10 issues by suitability | High |
| FR-174 | Issue assessment MUST include Dreyfus stages, recent sessions, knowledge gaps, and memories in the API call | High |
| FR-175 | Learning materials MUST query top 5 unaddressed knowledge gaps by severity then frequency | High |
| FR-176 | Learning materials MUST use `callApi<T>()` with `web_search_20250305` tool for real URLs (D81) | High |
| FR-177 | Both async flows MUST run in parallel, not sequentially | High |
| FR-178 | Both async flows MUST use `callApiWithRetry()` (D88) | High |
| FR-179 | Failed async flows MUST broadcast dedicated error messages (`dashboard:issues_error`, `dashboard:materials_error`) | High |
| FR-180 | `dashboard:refresh_issues` MUST re-run only the issue assessment flow, not re-send `dashboard:state` | High |
| FR-181 | `callApi<T>()` MUST accept optional `tools` parameter for connector tools (D83) | High |
| FR-182 | Issue bodies MUST be truncated to 2000 chars before inclusion in API call | High |
| FR-183 | `prompts/issue-assessment.ts` MUST follow Story 7 convention | High |
| FR-184 | `prompts/learning-materials.ts` MUST follow Story 7 convention and export `WEB_SEARCH_TOOL` | High |
| FR-185 | Learning materials call MUST be skipped if no unaddressed knowledge gaps exist | High |
| FR-186 | `dashboard_loaded` action MUST be logged after all dashboard flows complete or fail | High |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-082 | Dashboard immediate response | `dashboard:state` arrives within 100ms of `dashboard:request` |
| SC-083 | Stats filtering works | `statsPeriod: "7d"` returns only last-7-day data |
| SC-084 | Issue assessment works | `dashboard:issues` arrives with curated, ranked issues |
| SC-085 | Issue suitability meaningful | good_fit, stretch, too_advanced ratings match user's Dreyfus stages |
| SC-086 | Learning materials have real URLs | `dashboard:materials` contains web-searched URLs, not hallucinated ones |
| SC-087 | Progressive loading visible | `dashboard:state` arrives before `dashboard:issues` and `dashboard:materials` |
| SC-088 | Issue refresh works | `dashboard:refresh_issues` → updated `dashboard:issues` without full reload |
| SC-089 | ChromaDB degradation works | ChromaDB down → issue assessment still completes with empty memories |
| SC-090 | gh failure handled | `gh` error → `dashboard:issues_error` with readable message |
| SC-091 | Empty dashboard works | Fresh install → valid `dashboard:state` with zeros and empty arrays |

---

## Edge Cases

| ID | Scenario | Handling | Stories Affected |
|----|----------|----------|------------------|
| EC-01 | `PORT` already in use | Server fails to bind with EADDRINUSE error | Story 1 |
| EC-02 | Multiple Claude Code instances connect | Each gets own MCP session with unique UUID | Story 1 |
| EC-03 | WebSocket disconnects unexpectedly | `onClose` removes connection from tracking | Story 1 |
| EC-04 | `.env` file missing | `dotenv` no-op; vars validated from `process.env` | Story 1 |
| EC-05 | SIGINT during startup | Shutdown handler closes whatever was initialized | Story 1 |
| EC-06 | Database file corrupted | Catch error, log, exit. No auto-recovery. | Story 2 |
| EC-07 | Concurrent SQLite writes | WAL mode handles concurrent reads/writes | Story 2 |
| EC-08 | FK reference to non-existent parent | SQLite FK constraint rejects insert | Story 2 |
| EC-09 | Duplicate skill_area in dreyfus_assessments | UNIQUE constraint; use INSERT OR REPLACE | Story 2 |
| EC-10 | Path traversal attempt | Resolved path checked against `PROJECT_DIR`; rejected | Story 3 |
| EC-11 | Symlinks pointing outside `PROJECT_DIR` | Resolve real path; reject if outside boundary | Story 3 |
| EC-12 | Binary files | Detect by extension; skip buffer cache and diff; flag as binary | Story 3 |
| EC-13 | File deleted while open in editor | Buffer cache retains content; watcher emits unlink | Story 3 |
| EC-14 | Very large files (>10MB) | No special handling for hackathon | Story 3 |
| EC-15 | Concurrent buffer updates for same file | Last write wins (`Map.set()` is synchronous) | Story 3 |
| EC-16 | File watcher events during shutdown | Watcher closed; pending events discarded | Story 3 |
| EC-17 | Action logged with no active session | Reject gracefully — log warning, discard | Story 4 |
| EC-18 | Buffer summary timer during shutdown | Timer cleared during graceful shutdown | Story 4 |
| EC-19 | API call fails before completion | Log with latency_ms=-1, zero tokens/cost | Story 4 |
| EC-20 | Very long session (thousands of actions) | No practical limit for hackathon | Story 4 |
| EC-21 | Rapid-fire actions | Each logged individually; callers debounce | Story 4 |
| EC-22 | Malformed JSON from WebSocket client | Parse error caught, log warning, send `connection:error` | Story 5 |
| EC-23 | Valid message type but invalid payload | Handler validates, sends `connection:error` | Story 5 |
| EC-24 | Broadcast with no connected clients | No-op (iterate empty Map) | Story 5 |
| EC-25 | Multiple Electron windows connect | All receive broadcasts | Story 5 |
| EC-26 | `file:open` for non-existent path | Handler catches error, broadcasts `connection:error` | Story 5 |
| EC-27 | `file:save` fails (disk full, permissions) | Handler catches error, broadcasts `fs:save_error` | Story 5 |
| EC-28 | `paige_open_file` for file already open | Broadcast anyway — Electron focuses existing tab | Story 6 |
| EC-29 | `paige_open_file` for path outside `PROJECT_DIR` | Story 3's path validation rejects. MCP error. | Story 6 |
| EC-30 | `paige_highlight_lines` for file not open in Electron | Broadcast sent. Electron may ignore or queue. | Story 6 |
| EC-31 | `paige_update_phase` for non-existent phase | Kysely returns no match. MCP error. | Story 6 |
| EC-32 | `paige_update_phase` for phase already in target status | No-op. Returns success with current state. | Story 6 |
| EC-33 | `paige_get_session_state` with empty include array | Treated as "all items" | Story 6 |
| EC-34 | `paige_get_diff` with no dirty buffers | Returns `{ diffs: [] }` (empty array) | Story 6 |
| EC-35 | MCP tool called while Electron not connected | Read tools succeed. UI control tools no-op broadcast. | Story 6 |
| EC-36 | Rapid successive `paige_highlight_lines` calls | Each processed individually. Accumulation correct. | Story 6 |
| EC-37 | `paige_get_session_state` requesting "plan" with no plan | Returns `plan: null` | Story 6 |
| EC-38 | `ANTHROPIC_API_KEY` invalid (401) | SDK throws `AuthenticationError`. Not retried. Logged with latency_ms=-1. | Story 7 |
| EC-39 | API rate limited (429) | SDK retries with backoff. If exhausted, error propagates. Logged. | Story 7 |
| EC-40 | Response `stop_reason: "refusal"` | Throw `ApiRefusalError`. Log failure. Caller handles. | Story 7 |
| EC-41 | Response `stop_reason: "max_tokens"` | Throw `ApiMaxTokensError`. Log failure. Caller may retry. | Story 7 |
| EC-42 | Network timeout | SDK handles retry. If exhausted, throw. Log failure. | Story 7 |
| EC-43 | First request latency (grammar compilation) | Structured outputs compile grammar on first use. Cached 24h. | Story 7 |
| EC-44 | Concurrent `callApi()` calls | Each independent. SDK handles connection pooling. | Story 7 |
| EC-45 | Very large response (near max_tokens) | If truncated, `stop_reason: "max_tokens"` triggers error path. | Story 7 |
| EC-46 | `CHROMADB_URL` misconfigured (wrong host/port) | Same as unavailable — connection fails, warning logged, degraded mode | Story 8 |
| EC-47 | ChromaDB server dies mid-operation | Catch error, log warning, return degraded result. Flip `chromaAvailable = false` | Story 8 |
| EC-48 | `addMemories()` called with empty array | Return `{ added: 0 }` immediately, no ChromaDB call | Story 8 |
| EC-49 | `queryMemories()` called with empty query string | Pass to ChromaDB as-is. Caller's responsibility to provide meaningful queries | Story 8 |
| EC-50 | Tags contain commas | Escape or strip commas before joining. Tags are informational metadata | Story 8 |
| EC-51 | Very large `addMemories` call (50+ memories) | Pass through in single `add()` call. ChromaDB handles batching internally | Story 8 |
| EC-52 | Query returns fewer results than `nResults` | Return whatever ChromaDB returns. No padding | Story 8 |
| EC-53 | Collection deleted externally while server running | Next operation fails, caught by error handler, triggers degraded mode + reconnection on next call | Story 8 |
| EC-54 | Plan text is very long (>10k tokens) | Pass to Coach Agent as-is. maxTokens handles response size. | Story 9 |
| EC-55 | ChromaDB returns 0 memories | Skip retrieval filtering entirely. Coach Agent gets empty memories. | Story 9 |
| EC-56 | Retrieval filtering returns 0 relevant memories | Coach Agent runs with empty memories, memory_connection is null. | Story 9 |
| EC-57 | Coach Agent returns 0 phases | Store empty plan. MCP returns empty phases array. | Story 9 |
| EC-58 | Knowledge Gap Extraction returns 0 gaps | Store nothing in knowledge_gaps. Normal for struggle-free sessions. | Story 9 |
| EC-59 | Dreyfus Assessment returns no changes | No upserts. Assessment remains at current stage. | Story 9 |
| EC-60 | Memory Summarisation returns 0 memories | `addMemories()` with empty array, returns `{ added: 0 }`. | Story 9 |
| EC-61 | Concurrent coaching pipeline calls | Each independent. Second call creates a new plan. | Story 9 |
| EC-62 | `paige_end_session` called twice for same session | Second call finds session "completed". No-op for wrap-up steps. | Story 9 |
| EC-63 | Session transcript very large (>50k chars) | Truncate to fit Haiku context window. Claude Code should condense aggressively. | Story 9 |
| EC-64 | Coach Agent returns hint for non-existent file | Store hint as-is. Electron ignores hints for missing files. | Story 9 |
| EC-65 | Observer trigger fires during ongoing triage call | Skip — `evaluationInProgress` flag checked before calling Haiku | Story 10 |
| EC-66 | Session ends while triage call is in-flight | Let call complete, discard result (session no longer active) | Story 10 |
| EC-67 | Haiku returns `should_nudge: true` with signal `"no_nudge"` | Treat as contradictory — don't nudge, log warning | Story 10 |
| EC-68 | Electron disconnected when nudge needs delivery | Broadcast no-ops (Story 5, EC-24). Nudge is lost. Log `nudge_sent` anyway. | Story 10 |
| EC-69 | Very rapid trigger events (burst of file saves) | Suppression checks (cooldown, flow state) prevent excessive evaluation | Story 10 |
| EC-70 | `observer:mute` received when no session active | Ignore — no Observer state to modify. Log warning. | Story 10 |
| EC-71 | Idle timer fires after session ended | Timer cleared on session end. If race condition, check `active` flag and skip. | Story 10 |
| EC-72 | Triage consistently returns low confidence | Normal operation — Observer stays quiet. No escalation mechanism. | Story 10 |
| EC-73 | Multiple phase transitions in quick succession | Each triggers evaluation but cooldown/flow state may suppress. Normal. | Story 10 |
| EC-74 | `user:explain` with empty selectedText | Pass to Sonnet as-is — model explains from surroundingContext + range | Story 11 |
| EC-75 | `user:explain` for binary file | Broadcast `explain:error` with "Cannot explain binary files" | Story 11 |
| EC-76 | `user:review` with empty userCode | Pass to Sonnet — model returns "No code submitted" feedback | Story 11 |
| EC-77 | `user:review` with unmatched constraint titles | Ignore unmatched, proceed with matched only. None matched = no constraints. | Story 11 |
| EC-78 | Concurrent explain requests | Each processed independently. Multiple responses may arrive. | Story 11 |
| EC-79 | Concurrent review requests for same kata | Each independent. Both append to user_attempts. WAL handles concurrency. | Story 11 |
| EC-80 | `user:review` while no session active | Still works — katas exist globally. Dreyfus defaults to "novice". | Story 11 |
| EC-81 | Very large surroundingContext (>10k chars) | Pass to Sonnet as-is. maxTokens handles response size. | Story 11 |
| EC-82 | `gh` not installed | `execFile` throws ENOENT. Broadcast `dashboard:issues_error`. | Story 12 |
| EC-83 | Project has no GitHub remote | `gh issue list` errors. Broadcast `dashboard:issues_error`. | Story 12 |
| EC-84 | Project has 0 open issues | Sonnet returns empty list. `dashboard:issues` with `issues: []`. | Story 12 |
| EC-85 | No knowledge gaps exist | Skip learning materials call. No `dashboard:materials` sent. | Story 12 |
| EC-86 | All knowledge gaps addressed | Same as EC-85 — no unaddressed gaps. | Story 12 |
| EC-87 | `web_search` returns no results | Sonnet generates best-effort from training knowledge. | Story 12 |
| EC-88 | Stats query for period with no data | All counters return 0. Valid `dashboard:state`. | Story 12 |
| EC-89 | Very long issue bodies | Truncate to 2000 chars each before Sonnet call. | Story 12 |
| EC-90 | Concurrent `dashboard:request` | Each independent. May duplicate API calls. | Story 12 |
| EC-91 | `dashboard:refresh_issues` during initial load | Both run independently. Electron handles ordering. | Story 12 |

---

## Requirements

### Functional Requirements

| ID | Requirement | Stories | Confidence |
|----|-------------|---------|------------|
| FR-001 | Server MUST start a single Hono HTTP server on `PORT` (default: 3000) | Story 1 | High |
| FR-002 | Server MUST mount MCP Streamable HTTP on `/mcp` (POST, GET, DELETE) | Story 1 | High |
| FR-003 | Server MUST mount WebSocket on `/ws` with connection tracking | Story 1 | High |
| FR-004 | Server MUST respond to `GET /health` with status and uptime | Story 1 | High |
| FR-005 | Server MUST validate required env vars on startup (exit 1 if missing) | Story 1 | High |
| FR-006 | Server MUST validate `PROJECT_DIR` exists on filesystem | Story 1 | High |
| FR-007 | Server MUST create `DATA_DIR` recursively if missing | Story 1 | High |
| FR-008 | Server MUST handle SIGINT/SIGTERM with graceful shutdown | Story 1 | High |
| FR-009 | MCP sessions MUST be stateful with UUID session IDs in a Map | Story 1 | High |
| FR-010 | Database MUST be stored at `{DATA_DIR}/paige.db` | Story 2 | High |
| FR-011 | All tables MUST be created on startup with `CREATE TABLE IF NOT EXISTS` | Story 2 | High |
| FR-012 | Database MUST use WAL mode | Story 2 | High |
| FR-013 | All database access MUST use Kysely with typed interfaces | Story 2 | High |
| FR-014 | `sessions` table schema (see Story 2) | Story 2 | High |
| FR-015 | `plans` table schema (see Story 2) | Story 2 | High |
| FR-016 | `phases` table schema (see Story 2) | Story 2 | High |
| FR-017 | `phase_hints` table schema (see Story 2) | Story 2 | High |
| FR-018 | `dreyfus_assessments` table schema — global, UNIQUE skill_area (see Story 2) | Story 2 | High |
| FR-019 | `knowledge_gaps` table schema (see Story 2) | Story 2 | High |
| FR-020 | `kata_specs` table with constraints JSON and user_attempts JSON (see Story 2) | Story 2 | High |
| FR-021 | `progress_events` table schema (see Story 2) | Story 2 | High |
| FR-022 | Database module MUST export typed CRUD functions for each entity | Story 2 | High |
| FR-023 | All file paths MUST validate to resolve within `PROJECT_DIR` before I/O | Story 3 | High |
| FR-024 | `readFile(path)` MUST return content and detected language | Story 3 | High |
| FR-025 | `writeFile(path, content)` MUST write to disk and set buffer `dirty: false` (Electron-only) | Story 3 | High |
| FR-026 | `writeFile` MUST NOT be callable from MCP tools (read-only enforcement) | Story 3 | High |
| FR-027 | Buffer cache: `Map<string, BufferEntry>` with content, cursorPosition, dirty, lastUpdated | Story 3 | High |
| FR-028 | Buffer cache updates on `buffer_update` messages (dirty: true, lastUpdated: now) | Story 3 | High |
| FR-029 | Buffer cache sets `dirty: false` on `writeFile` | Story 3 | High |
| FR-030 | `getBuffer(path)` returns `BufferEntry` or `null` | Story 3 | High |
| FR-031 | `getDiff(path)` returns unified diff (saved vs buffer). Empty if clean/missing. | Story 3 | High |
| FR-032 | Diff computation uses `diff` npm library | Story 3 | High |
| FR-033 | `getProjectTree()` returns recursive directory structure of `PROJECT_DIR` | Story 3 | High |
| FR-034 | `getProjectTree()` excludes node_modules, .git, dist, build, coverage, .next, .cache | Story 3 | High |
| FR-035 | File watcher uses chokidar for add/change/unlink events | Story 3 | High |
| FR-036 | File watcher emits events consumable by WebSocket layer | Story 3 | High |
| FR-037 | File watcher closed during graceful shutdown | Story 3 | High |
| FR-038 | Binary files skipped for buffer cache and diff operations | Story 3 | High |
| FR-039 | `action_log` table schema (see Story 4) | Story 4 | High |
| FR-040 | `api_call_log` table schema with dedicated cost/latency columns (see Story 4) | Story 4 | High |
| FR-041 | `logAction(sessionId, actionType, data?)` inserts into `action_log` | Story 4 | High |
| FR-042 | `logApiCall(sessionId, callType, metadata)` inserts into `api_call_log` | Story 4 | High |
| FR-043 | Buffer summary timer flushes every ~30s for dirty files | Story 4 | High |
| FR-044 | Buffer significant change logs immediately on >50% or >500 char delta | Story 4 | High |
| FR-045 | Observer can query recent actions by session_id and action_type | Story 4 | High |
| FR-046 | Dashboard can aggregate `api_call_log` for cost and latency | Story 4 | High |
| FR-047 | Buffer summary timer cleared on session end and graceful shutdown | Story 4 | High |
| FR-048 | All 27 action types supported (24 Story 4 + 2 Story 11 + 1 Story 12) | Story 4, 11, 12 | High |
| FR-049 | All WebSocket messages MUST be JSON `{ type, payload }` | Story 5 | High |
| FR-050 | TypeScript interfaces for all 55 message types (23 C→S, 32 S→C; includes Stories 9–12 revisions) | Story 5, 9, 10, 11, 12 | High |
| FR-051 | Router: `Map<string, MessageHandler>` for inbound dispatch | Story 5 | High |
| FR-052 | Handler signature: `(payload, context) => Promise<void>` | Story 5 | High |
| FR-053 | `connection:hello` stores metadata, responds `connection:init` | Story 5 | High |
| FR-054 | `file:open` handler: readFile + logAction + broadcast `fs:content` | Story 5 | High |
| FR-055 | `file:save` handler: writeFile + logAction + broadcast ack/error | Story 5 | High |
| FR-056 | `buffer:update` handler: buffer cache + log state + delta check | Story 5 | High |
| FR-057 | All action-loggable handlers call `logAction` | Story 5 | High |
| FR-058 | `broadcast(message)` sends to all connected clients | Story 5 | High |
| FR-059 | File watcher events trigger `fs:tree_update` broadcasts | Story 5 | High |
| FR-060 | Unknown message types logged and ignored | Story 5 | High |
| FR-061 | Malformed JSON caught, logged, responded with `connection:error` | Story 5 | High |
| FR-062 | Stub handlers log warning, send `NOT_IMPLEMENTED` error | Story 5 | High |
| FR-063 | MCP tool surface MUST register all 14 tools on McpServer instance (12 Story 6 + 2 Story 9) | Story 6, 9 | High |
| FR-064 | Read tools MUST return data directly in MCP tool response | Story 6 | High |
| FR-065 | UI control tools MUST broadcast WebSocket message AND return ack | Story 6 | High |
| FR-066 | `paige_get_buffer(path)` returns `BufferEntry` or `null` from Story 3 cache | Story 6 | High |
| FR-067 | `paige_get_open_files()` returns all paths in open files set | Story 6 | High |
| FR-068 | Open files set updated by `file:open` (add), `file:close` (remove), `paige_open_file` (add) | Story 6 | High |
| FR-069 | `paige_get_diff(path?)` returns diffs for specified file or all dirty files | Story 6 | High |
| FR-070 | `paige_get_session_state({ include? })` returns only requested items, defaults to all 9 | Story 6 | High |
| FR-071 | `paige_open_file(path)` reads file, adds to open set, broadcasts `editor:open_file` | Story 6 | High |
| FR-072 | `paige_highlight_lines` accumulates. Highlights ephemeral (not persisted to SQLite). | Story 6 | High |
| FR-073 | `paige_clear_highlights(path?)` clears decorations per-file or all | Story 6 | High |
| FR-074 | `paige_hint_files(paths, style)` broadcasts `explorer:hint_files` | Story 6 | High |
| FR-075 | `paige_clear_hints()` broadcasts `explorer:clear_hints` | Story 6 | High |
| FR-076 | `paige_update_phase(phase, status)` updates SQLite, sets timestamps, logs, broadcasts | Story 6 | High |
| FR-077 | `paige_show_message(message, type)` logs `coaching_message`, broadcasts `coaching:message` | Story 6 | High |
| FR-078 | `paige_show_issue_context(title, summary)` broadcasts `coaching:issue_context` | Story 6 | High |
| FR-079 | Every MCP tool call logged as `mcp_tool_call` via Story 4 | Story 6 | High |
| FR-080 | Tools requiring session context return MCP error if no session active | Story 6 | High |
| FR-081 | MCP tool surface MUST NOT expose file-write tools (Constitution Principle I) | Story 6 | High |
| FR-082 | 8 new server→client WebSocket message types for UI control broadcasts | Story 6 | High |
| FR-083 | `callApi<T>()` accepts callType, model, systemPrompt, userMessage, responseSchema, sessionId, maxTokens, and optional tools | Story 7, 12 | High |
| FR-084 | `callApi<T>()` uses `output_config: { format: zodOutputFormat(responseSchema) }` for structured output | Story 7 | High |
| FR-085 | `ModelTier` maps `"haiku"` → `"claude-haiku-4-5-20251001"`, `"sonnet"` → `"claude-sonnet-4-5-20250929"` | Story 7 | High |
| FR-086 | Every `callApi()` invocation logs to `api_call_log` via `logApiCall()` (Story 4) | Story 7 | High |
| FR-087 | `cost_estimate` computed from `response.usage` tokens × hardcoded per-million-token rates | Story 7 | High |
| FR-088 | `input_hash` is SHA-256 of `userMessage` truncated to 16 hex characters | Story 7 | High |
| FR-089 | On `stop_reason: "refusal"`, throw `ApiRefusalError` and log failure | Story 7 | High |
| FR-090 | On `stop_reason: "max_tokens"`, throw `ApiMaxTokensError` and log failure | Story 7 | High |
| FR-091 | Failed API calls logged with `latency_ms = -1`, zero tokens, zero cost | Story 7 | High |
| FR-092 | `callApi()` defaults `maxTokens` to 4096 if not specified | Story 7 | High |
| FR-093 | Single `Anthropic` client instance created at startup and reused | Story 7 | High |
| FR-094 | Prompt template modules export `SYSTEM_PROMPT`, `responseSchema`, `assembleUserMessage()`, response type | Story 7 | High |
| FR-095 | `COST_PER_MILLION_TOKENS` defines haiku (0.80/4.00) and sonnet (3.00/15.00) | Story 7 | High |
| FR-096 | Memory module MUST create `ChromaClient({ path: CHROMADB_URL })` at startup | Story 8 | High |
| FR-097 | Memory module MUST call `getOrCreateCollection({ name: "paige_memories" })` at startup | Story 8 | High |
| FR-098 | If ChromaDB is unreachable at startup, MUST log warning and set `chromaAvailable = false` — server continues | Story 8 | High |
| FR-099 | `addMemories(memories, sessionId, project)` MUST store documents with metadata: session_id, project, created_at (ISO 8601), importance, tags (comma-separated) | Story 8 | High |
| FR-100 | `addMemories()` MUST generate IDs as `mem_{sessionId}_{index}` (0-based within call) | Story 8 | High |
| FR-101 | `queryMemories(queryText, nResults?, project?)` MUST use ChromaDB `queryTexts` for semantic search with `nResults` default 10 | Story 8 | High |
| FR-102 | `queryMemories()` MUST support optional `project` filter via ChromaDB `where: { project }` clause | Story 8 | High |
| FR-103 | When ChromaDB is unavailable, `addMemories()` MUST return `{ added: 0 }` and log warning — no throw | Story 8 | High |
| FR-104 | When ChromaDB is unavailable, `queryMemories()` MUST return `[]` and log warning — no throw | Story 8 | High |
| FR-105 | `isMemoryAvailable()` MUST return boolean reflecting current ChromaDB connectivity state | Story 8 | High |
| FR-106 | On ChromaDB operation failure at runtime, MUST flip `chromaAvailable = false` and attempt reconnection on next call | Story 8 | High |
| FR-107 | Tags array MUST be joined as comma-separated string in metadata (ChromaDB metadata supports primitives only) | Story 8 | High |
| FR-108 | `paige_run_coaching_pipeline` MCP tool MUST accept planText, issueSummary, and optional issueNumber | Story 9 | High |
| FR-109 | Pipeline entry MUST query ChromaDB via `queryMemories({ queryText, nResults: 10 })` when available | Story 9 | High |
| FR-110 | Pipeline entry MUST call Haiku for memory retrieval filtering when ChromaDB returns results | Story 9 | High |
| FR-111 | If ChromaDB unavailable OR Haiku filtering fails, MUST skip memories and pass empty array to Coach Agent | Story 9 | High |
| FR-112 | Pipeline entry MUST call Sonnet Coach Agent with planText, Dreyfus stage, and filtered memories | Story 9 | High |
| FR-113 | Coach Agent output MUST be stored in SQLite: 1 plan row, N phase rows, M phase_hints rows | Story 9 | High |
| FR-114 | Pipeline entry MUST broadcast `coaching:plan_ready` via WebSocket after Coach Agent completes | Story 9 | High |
| FR-115 | Pipeline entry MUST apply first phase hints via existing hint/highlight WebSocket messages | Story 9 | High |
| FR-116 | Pipeline entry MUST return coaching output to Claude Code via MCP response | Story 9 | High |
| FR-117 | `paige_end_session` MCP tool MUST accept sessionTranscript (string) | Story 9 | High |
| FR-118 | Session wrap-up MUST call Sonnet for Knowledge Gap Extraction (best-effort) | Story 9 | High |
| FR-119 | Knowledge gaps stored in `knowledge_gaps`; kata specs in `kata_specs` table | Story 9 | High |
| FR-120 | Session wrap-up MUST call Sonnet for Dreyfus Stage Assessment (best-effort) | Story 9 | High |
| FR-121 | Dreyfus assessments MUST be upserted (INSERT OR REPLACE) in `dreyfus_assessments` | Story 9 | High |
| FR-122 | Session wrap-up MUST call Haiku for Memory Summarisation (best-effort) | Story 9 | High |
| FR-123 | Memory summarisation output MUST be stored in ChromaDB via `addMemories()` | Story 9 | High |
| FR-124 | Session status MUST be set to "completed" regardless of individual step failures | Story 9 | High |
| FR-125 | Session wrap-up MUST broadcast `session:completed` via WebSocket | Story 9 | High |
| FR-126 | All 5 API call types MUST use prompt template modules following Story 7 convention | Story 9 | High |
| FR-127 | All 5 API calls MUST be logged to `api_call_log` automatically via `callApi()` | Story 9 | High |
| FR-128 | Both MCP tools MUST return MCP error if no active session | Story 9 | High |
| FR-129 | Observer MUST start when a session becomes active: create state, subscribe to EventEmitter, start idle timer | Story 10 | High |
| FR-130 | Observer MUST stop when session ends: unsubscribe, clear timer, broadcast status | Story 10 | High |
| FR-131 | Observer MUST subscribe to action log EventEmitter for real-time trigger events (D55) | Story 10 | High |
| FR-132 | Trigger events: `file_open`, `file_save` (always), `buffer_update` (threshold 5), `phase_started`/`phase_completed` (always), idle check (30s timer, 5min threshold) | Story 10 | High |
| FR-133 | Suppression check order: muted → cooldown (120s) → flow state (>10 actions in 60s) | Story 10 | High |
| FR-134 | Muted Observer MUST silently skip all triggers (no log) | Story 10 | High |
| FR-135 | Cooldown suppression MUST log `nudge_suppressed` with `reason: "cooldown"` | Story 10 | High |
| FR-136 | Flow state suppression MUST log `nudge_suppressed` with `reason: "flow_state"` | Story 10 | High |
| FR-137 | Context snapshot MUST include: current_phase (or null), last 20 actions, time_since_last_save, time_since_last_nudge, dreyfus_stage, user_idle | Story 10 | High |
| FR-138 | Dreyfus stage MUST default to `"novice"` when no assessments exist | Story 10 | High |
| FR-139 | Triage MUST use `callApi<T>()` with model `"haiku"` and `prompts/observer-triage.ts` template | Story 10 | High |
| FR-140 | If `should_nudge: true` AND `confidence >= 0.7`: log `nudge_sent`, broadcast `observer:nudge`, update `lastNudgeTimestamp` | Story 10 | High |
| FR-141 | If `should_nudge: true` AND `confidence < 0.7`: log `nudge_suppressed` with `reason: "low_confidence"` | Story 10 | High |
| FR-142 | If `should_nudge: false`: no log, update `lastEvaluationTimestamp` only | Story 10 | High |
| FR-143 | `observer:nudge` WebSocket message MUST include signal, confidence, and suggested_context | Story 10 | High |
| FR-144 | `observer:mute` WebSocket handler MUST flip mute state, log `observer_muted` action, broadcast `observer:status` | Story 10 | High |
| FR-145 | `observer:status` MUST be broadcast on session start, session end, and mute toggle | Story 10 | High |
| FR-146 | Triage API call failure MUST NOT crash or stop the Observer — log failure and continue | Story 10 | High |
| FR-147 | `evaluationInProgress` flag MUST prevent concurrent triage calls | Story 10 | High |
| FR-148 | `bufferUpdatesSinceLastEval` counter MUST reset after each evaluation | Story 10 | High |
| FR-149 | Idle check timer (30s interval) MUST be cleared on session end | Story 10 | High |
| FR-150 | Prompt template `prompts/observer-triage.ts` MUST follow Story 7 convention (SYSTEM_PROMPT, responseSchema, assembleUserMessage, response type) | Story 10 | High |
| FR-151 | `user:explain` handler MUST log `explain_requested`, call Sonnet, log `explain_completed`, broadcast `explain:response` | Story 11 | High |
| FR-152 | `user:explain` handler MUST enrich API call with Dreyfus stage from SQLite (default "novice") | Story 11 | High |
| FR-153 | `user:explain` handler MUST include active phase context when coaching session with plan exists | Story 11 | High |
| FR-154 | `user:review` handler MUST load kata_specs from SQLite by kataId (including instructor_notes) | Story 11 | High |
| FR-155 | `user:review` handler MUST resolve activeConstraintTitles against kata's constraints array | Story 11 | High |
| FR-156 | `user:review` handler MUST filter user_attempts to same-constraint set before sending to Sonnet | Story 11 | High |
| FR-157 | `user:review` handler MUST append attempt to kata_specs.user_attempts JSON after successful API call | Story 11 | High |
| FR-158 | `user:review` handler MUST compute unlockedConstraints by comparing pre/post level against constraint minLevel gates | Story 11 | High |
| FR-159 | Both handlers MUST use `callApiWithRetry()` — one retry on transient failure with 1s delay | Story 11 | High |
| FR-160 | Both handlers MUST broadcast error message type on final failure | Story 11 | High |
| FR-161 | `prompts/explain-this.ts` MUST follow Story 7 convention | Story 11 | High |
| FR-162 | `prompts/practice-review.ts` MUST follow Story 7 convention | Story 11 | High |
| FR-163 | Dreyfus stage MUST be injected into system prompts as a variable (D70) | Story 11 | High |
| FR-164 | `explain:response` MUST include `analogy` as nullable (D73) and `relatedFiles` as nullable (D74) | Story 11 | High |
| FR-165 | `explain_completed` and `review_completed` action types MUST be logged with domain-specific metadata | Story 11 | High |
| FR-166 | `user:review` with non-existent kataId MUST broadcast `review:error` without making API call | Story 11 | High |
| FR-167 | Failed API calls MUST NOT append attempts to kata_specs.user_attempts | Story 11 | High |
| FR-168 | `dashboard:request` handler MUST immediately broadcast `dashboard:state` with SQLite data | Story 12 | High |
| FR-169 | `dashboard:state` MUST include dreyfus, stats (filtered), in-progress sessions, katas | Story 12 | High |
| FR-170 | Stats MUST be filterable by period: "7d", "30d", "all" (default "all") | Story 12 | High |
| FR-171 | Issue assessment MUST run `gh issue list --state open --limit 50` from `PROJECT_DIR` | Story 12 | High |
| FR-172 | Issue assessment MUST query ChromaDB for related memories (skip if unavailable) | Story 12 | High |
| FR-173 | Issue assessment MUST call Sonnet to select and rank top 10 issues | Story 12 | High |
| FR-174 | Issue assessment MUST include Dreyfus, sessions, gaps, and memories in API call | Story 12 | High |
| FR-175 | Learning materials MUST query top 5 unaddressed gaps by severity then frequency | Story 12 | High |
| FR-176 | Learning materials MUST use `callApi<T>()` with `web_search_20250305` tool (D81) | Story 12 | High |
| FR-177 | Both async flows MUST run in parallel | Story 12 | High |
| FR-178 | Both async flows MUST use `callApiWithRetry()` (D88) | Story 12 | High |
| FR-179 | Failed flows MUST broadcast `dashboard:issues_error` / `dashboard:materials_error` | Story 12 | High |
| FR-180 | `dashboard:refresh_issues` MUST re-run only issue assessment, not re-send `dashboard:state` | Story 12 | High |
| FR-181 | `callApi<T>()` MUST accept optional `tools` parameter for connector tools (D83) | Story 12, Story 7 | High |
| FR-182 | Issue bodies MUST be truncated to 2000 chars before API call | Story 12 | High |
| FR-183 | `prompts/issue-assessment.ts` MUST follow Story 7 convention | Story 12 | High |
| FR-184 | `prompts/learning-materials.ts` MUST follow Story 7 convention and export `WEB_SEARCH_TOOL` | Story 12 | High |
| FR-185 | Learning materials MUST be skipped if no unaddressed knowledge gaps exist | Story 12 | High |
| FR-186 | `dashboard_loaded` action MUST be logged after all flows complete or fail | Story 12 | High |

### Key Entities

```
sessions ──< plans ──< phases ──< phase_hints
                              ──< progress_events
sessions ──< knowledge_gaps ──< kata_specs
sessions ──< action_log
sessions ──< api_call_log
dreyfus_assessments (global)
```

---

## Success Criteria

| ID | Criterion | Measurement | Stories |
|----|-----------|-------------|---------|
| SC-001 | Server starts within 2 seconds | Startup log within 2s of process launch | Story 1 |
| SC-002 | MCP accepts initialization | POST `/mcp` returns session ID header | Story 1 |
| SC-003 | WebSocket accepts connection | Client connects to `/ws` and exchanges JSON | Story 1 |
| SC-004 | Missing env var detected | Exit code 1 with variable name in stderr | Story 1 |
| SC-005 | Graceful shutdown completes | SIGINT closes all connections, no dangling handles | Story 1 |
| SC-006 | Fresh database creates all tables | 10 tables exist after startup (sqlite_master query) — 8 from Story 2, 2 from Story 4 | Story 2 |
| SC-007 | Full session lifecycle round-trips | Create → read back entire hierarchy correctly | Story 2 |
| SC-008 | Kysely types match schema | TypeScript strict mode compilation passes | Story 2 |
| SC-009 | WAL mode is active | `PRAGMA journal_mode` returns `wal` | Story 2 |
| SC-010 | File read works | `readFile` returns content for known file in `PROJECT_DIR` | Story 3 |
| SC-011 | File write works | `writeFile` writes to disk and sets buffer `dirty: false` | Story 3 |
| SC-012 | Buffer cache tracks state | Correct content, cursorPosition, dirty, lastUpdated after update | Story 3 |
| SC-013 | Diff computation works | `getDiff` returns meaningful unified diff for modified buffer | Story 3 |
| SC-014 | Project tree is correct | `getProjectTree` excludes `node_modules` and `.git` | Story 3 |
| SC-015 | File watcher detects changes | Chokidar detects newly created file and emits event | Story 3 |
| SC-016 | Path traversal rejected | Path outside `PROJECT_DIR` is rejected with clear error | Story 3 |
| SC-017 | Action logging works | `logAction` inserts row with correct fields | Story 4 |
| SC-018 | Buffer summary periodic | Timer logs for dirty files after 30s | Story 4 |
| SC-019 | Buffer significant change detection | Immediate log on delta threshold | Story 4 |
| SC-020 | API call logging works | `logApiCall` inserts with all metadata | Story 4 |
| SC-021 | Actions queryable | Retrievable by session_id and action_type | Story 4 |
| SC-022 | Budget aggregation | `SUM(cost_estimate)` correct for session | Story 4 |
| SC-023 | Handshake completes | `connection:hello` → `connection:init` with metadata stored | Story 5 |
| SC-024 | File open dispatches | readFile called, action logged, `fs:content` broadcast | Story 5 |
| SC-025 | Buffer update dispatches | Buffer cache and log state updated, no broadcast | Story 5 |
| SC-026 | Broadcast delivers | Message sent to all connected clients | Story 5 |
| SC-027 | Unknown type handled | Logged and ignored, no crash | Story 5 |
| SC-028 | Tree update broadcast | File watcher event triggers `fs:tree_update` | Story 5 |
| SC-029 | Buffer read works | `paige_get_buffer` returns correct state for unsaved edits | Story 6 |
| SC-030 | Open files tracked | `paige_get_open_files` correct across Electron and MCP sources | Story 6 |
| SC-031 | All diffs returned | `paige_get_diff` with no path returns all dirty file diffs | Story 6 |
| SC-032 | State filtering works | `paige_get_session_state` with include filter returns only requested | Story 6 |
| SC-033 | File open works | `paige_open_file` reads, adds to set, broadcasts `editor:open_file` | Story 6 |
| SC-034 | Highlights accumulate | Two highlight calls result in decorations on both ranges | Story 6 |
| SC-035 | Phase update works | `paige_update_phase` updates SQLite, logs, broadcasts | Story 6 |
| SC-036 | No session error | Tool call with no active session returns MCP error | Story 6 |
| SC-037 | Bad file error | `paige_open_file` for non-existent file returns MCP error | Story 6 |
| SC-038 | All tools registered | All 14 tools callable via MCP POST to `/mcp` (12 Story 6 + 2 Story 9) | Story 6 |
| SC-039 | Structured output works | `callApi()` with Zod schema returns typed, schema-compliant JSON | Story 7 |
| SC-040 | Model resolution works | `"haiku"` and `"sonnet"` resolve to correct model IDs | Story 7 |
| SC-041 | Cost tracking accurate | `cost_estimate` matches manual calculation from tokens × pricing | Story 7 |
| SC-042 | Success logging complete | Successful call writes row with all metadata to `api_call_log` | Story 7 |
| SC-043 | Failure logging complete | Failed call writes row with latency_ms=-1, zero tokens/cost | Story 7 |
| SC-044 | Refusal handled | `stop_reason: "refusal"` throws `ApiRefusalError` | Story 7 |
| SC-045 | Max tokens handled | `stop_reason: "max_tokens"` throws `ApiMaxTokensError` | Story 7 |
| SC-046 | Memories stored correctly | `addMemories()` stores documents with correct content and metadata in `paige_memories` collection | Story 8 |
| SC-047 | Semantic search works | `queryMemories()` returns semantically similar results ranked by distance | Story 8 |
| SC-048 | Cross-project recall works | Query without `project` filter returns results from multiple projects | Story 8 |
| SC-049 | Project filter works | Query with `project` filter returns only matching project's memories | Story 8 |
| SC-050 | Startup connection succeeds | ChromaDB available at startup → log confirms connection, `isMemoryAvailable()` returns true | Story 8 |
| SC-051 | Startup degradation works | ChromaDB unavailable at startup → server starts, warning logged, `isMemoryAvailable()` returns false | Story 8 |
| SC-052 | Runtime degradation works | Operations return degraded results (`[]` / `{ added: 0 }`) when ChromaDB is down | Story 8 |
| SC-053 | Lazy recovery works | ChromaDB started after server → next memory operation reconnects and succeeds | Story 8 |
| SC-054 | Full pipeline works | Plan + memories → phased coaching stored in SQLite and broadcast to Electron | Story 9 |
| SC-055 | Pipeline without memories | Coach Agent produces valid output with empty `relevant_memories` | Story 9 |
| SC-056 | Pipeline failure handled | Coach Agent failure returns MCP error, no partial data stored | Story 9 |
| SC-057 | Wrap-up happy path | All 3 API calls succeed, data stored in SQLite + ChromaDB, session completed | Story 9 |
| SC-058 | Wrap-up partial failure | One call fails, remaining calls still execute, session still completed | Story 9 |
| SC-059 | SQLite storage correct | Phases, hints, gaps, katas, assessments stored with correct foreign keys | Story 9 |
| SC-060 | WebSocket broadcasts delivered | `coaching:plan_ready` and `session:completed` received by Electron | Story 9 |
| SC-061 | Best-effort resilience | All 3 wrap-up calls fail, session still marked "completed" with zero counts | Story 9 |
| SC-062 | Observer starts with session | Session creation results in Observer state, EventEmitter subscription, idle timer, and status broadcast | Story 10 |
| SC-063 | Observer stops with session | `paige_end_session` unsubscribes Observer, clears timer, broadcasts inactive status | Story 10 |
| SC-064 | Trigger → triage works | File open event triggers Haiku call with correct context snapshot | Story 10 |
| SC-065 | Nudge delivered | `should_nudge: true` + confidence >= 0.7 results in `observer:nudge` broadcast | Story 10 |
| SC-066 | Cooldown works | Nudge within 120s of previous nudge is suppressed with logged reason | Story 10 |
| SC-067 | Flow state works | >10 actions in 60s suppresses triage entirely | Story 10 |
| SC-068 | Mute works | `observer:mute { muted: true }` prevents all evaluations; unmute re-enables | Story 10 |
| SC-069 | Low confidence suppressed | `should_nudge: true` with confidence 0.5 is suppressed, not delivered | Story 10 |
| SC-070 | Triage failure resilient | Haiku call failure logged, Observer continues operating | Story 10 |
| SC-071 | Buffer threshold works | 5th buffer_update triggers evaluation, counter resets | Story 10 |
| SC-072 | Explain This works end-to-end | `user:explain` → Sonnet → `explain:response` with valid explanation | Story 11 |
| SC-073 | Explain This Dreyfus-aware | Different stages produce different explanation depths | Story 11 |
| SC-074 | Explain This phase-aware | Active phase context appears in `phaseConnection` | Story 11 |
| SC-075 | Practice Review works end-to-end | `user:review` → kata loaded → Sonnet → `review:response` | Story 11 |
| SC-076 | Constraint unlocking works | Level 2→5 unlocks minLevel 3 and 5 constraints | Story 11 |
| SC-077 | Attempt history persisted | 3 submissions → 3 entries in user_attempts | Story 11 |
| SC-078 | Same-constraint filtering works | Only matching-constraint attempts sent to Sonnet | Story 11 |
| SC-079 | Retry works | Transient failure → retry succeeds → response delivered | Story 11 |
| SC-080 | Error toast works | Final failure → error message broadcast | Story 11 |
| SC-081 | Kata not found handled | Non-existent kataId → `review:error` without API call | Story 11 |
| SC-082 | Dashboard immediate response | `dashboard:state` arrives within 100ms of request | Story 12 |
| SC-083 | Stats filtering works | `statsPeriod: "7d"` returns only last-7-day data | Story 12 |
| SC-084 | Issue assessment works | `dashboard:issues` with curated, ranked issues | Story 12 |
| SC-085 | Issue suitability meaningful | Ratings match user's Dreyfus stages | Story 12 |
| SC-086 | Learning materials have real URLs | Web-searched URLs, not hallucinated | Story 12 |
| SC-087 | Progressive loading visible | `dashboard:state` before async messages | Story 12 |
| SC-088 | Issue refresh works | `dashboard:refresh_issues` → updated issues without full reload | Story 12 |
| SC-089 | ChromaDB degradation works | Issue assessment completes with empty memories | Story 12 |
| SC-090 | gh failure handled | `dashboard:issues_error` with readable message | Story 12 |
| SC-091 | Empty dashboard works | Fresh install → valid zeros and empty arrays | Story 12 |

---

## Glossary

| Term | Definition |
|------|-----------|
| **MCP** | Model Context Protocol — the communication protocol between Claude Code and the backend (Streamable HTTP transport) |
| **Streamable HTTP** | The current MCP transport layer, replacing deprecated SSE. Uses POST/GET/DELETE on `/mcp`. |
| **PTY** | Pseudo-terminal — the terminal process running Claude Code inside Electron |
| **Observer** | Per-session background process that monitors user activity via action log events and decides whether Paige should proactively nudge |
| **Triage Model** | A fast/cheap model (Haiku) that makes binary nudge/no-nudge decisions for the Observer |
| **Coach Agent** | A Sonnet API call that transforms a plan into phased, scaffolded guidance (Dreyfus-aware) |
| **Dreyfus Model** | Five-stage skill acquisition model (Novice → Advanced Beginner → Competent → Proficient → Expert) used to calibrate coaching |
| **Kata** | A practice exercise generated from identified knowledge gaps, with progressive constraints and level tracking |
| **ChromaDB** | Vector database for semantic search, used for cross-session memory. Runs as an external server. |
| **Buffer Cache** | In-memory `Map<string, BufferEntry>` of current editor buffer contents, updated via debounced WebSocket messages from Electron |
| **Structured Outputs** | Anthropic API feature (`output_config.format`) that guarantees schema-compliant JSON via constrained decoding. Used with `zodOutputFormat()`. |
| **Knowledge Gap** | A topic where the user struggled, needed excessive hints, or made repeated mistakes — identified by the Knowledge Gap Extraction API call |

---

## Appendix: Story Revision History

*Major revisions to graduated stories. Full details in `archive/REVISIONS.md`*

| Date | Story | Type | Change | Reason |
|------|-------|------|--------|--------|
| 2026-02-11 | Story 5 | Additive | +2 WebSocket message types (`coaching:plan_ready`, `session:completed`) | Story 9 coaching pipeline needs to broadcast plan and session data to Electron |
| 2026-02-11 | Story 6 | Additive | +2 MCP tools (`paige_run_coaching_pipeline`, `paige_end_session`) | Story 9 coaching pipeline requires MCP entry points |
| 2026-02-11 | Story 4 | Additive | Action log EventEmitter for Observer subscription | Story 10 Observer needs real-time event stream (D55) |
| 2026-02-11 | Story 5 | Additive | +3 WebSocket message types (`observer:nudge`, `observer:mute`, `observer:status`) | Story 10 Observer system |
| 2026-02-11 | Story 4 | Additive | +2 action types (`explain_completed`, `review_completed`) | Story 11 UI-driven API calls |
| 2026-02-11 | Story 5 | Additive | 2 stub→full upgrades (`user:explain`, `user:review`), +4 server→client types | Story 11 Explain This and Practice Review |
| 2026-02-11 | Story 4 | Additive | +1 action type (`dashboard_loaded`) | Story 12 Dashboard |
| 2026-02-11 | Story 5 | Additive | 2 stub→full upgrades (`dashboard:request`, `dashboard:refresh_issues`), -1 removed (`dashboard:stats_period`, D85), +5 server→client types | Story 12 Dashboard |
| 2026-02-11 | Story 7 | Additive | Optional `tools` parameter on `callApi<T>()` for connector tools | Story 12 Learning Materials needs `web_search` tool (D83) |
