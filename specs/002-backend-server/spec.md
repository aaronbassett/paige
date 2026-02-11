# Feature Specification: Backend Server

**Feature Branch**: `002-backend-server`
**Created**: 2026-02-11
**Status**: In Progress
**Version**: 1.0
**Original Spec**: See `docs/planning/backend-discovery/SPEC.md` for full discovery context

## Problem Statement

The Paige backend server is the central nervous system of a three-tier AI coaching application. It must serve two very different consumers simultaneously — Claude Code (via MCP/Streamable HTTP) and an Electron UI (via WebSocket) — while owning all persistent state, all file I/O, all Claude API calls for evaluative/analytical tasks, and a comprehensive action log. It is the single source of truth: if the backend doesn't know about it, it didn't happen.

## Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| **Claude Code Plugin** | The AI coaching personality running in a PTY. Communicates via MCP (Streamable HTTP). | Call tools to control the UI (highlights, hints, phase updates), read session state, read buffers/diffs, trigger the coaching pipeline |
| **Electron UI** | Thin rendering client (Monaco, xterm.js, file tree). Communicates via WebSocket. | Receive UI commands, push user activity (buffer edits, file opens/saves), request file content, request explanations, submit practice solutions, load dashboard data |
| **Developer (Aaron)** | Solo hackathon developer building and demoing Paige. | Run the server easily, debug quickly, see clear logs, configure for demo scenarios |

## Clarifications

### Session 2026-02-11

- Q: What are the allowed values for `hint_level` used in phase tracking and UI controls? → A: off, low, medium, high
- Q: When and how is a backend session created? What is the session initialization flow? → A: Claude Code plugin hooks (SessionStart, SessionEnd) call MCP tools to start/end session on server. Only one session can be active at a time.
- Q: How is user level determined for Practice Mode constraint unlocking? → A: The reviewing AI (Sonnet) assigns a level (1-10) to each attempt. Constraints unlock based on the max level achieved across all attempts for that specific kata.
- Q: What happens if the coaching pipeline is run twice for the same session? → A: Keep all plans with an `is_active` boolean field. Mark old plan as inactive, create new plan as active. This preserves historical coaching plans for analytics.
- Q: How do Observer nudges reach the Claude Code plugin running in the PTY? → A: Backend broadcasts `observer:nudge` via WebSocket to Electron. Electron formats the nudge and writes it to the PTY stdin, injecting it into the Claude Code session.

## Glossary

**MCP Session**: A unique Claude Code PTY connection identified by the `Mcp-Session-Id` header. Multiple MCP sessions may exist across different PTY instances.

**Coaching Session**: An active project-specific session identified by `sessionId` in WebSocket messages. Only one coaching session can be active at a time (enforced by backend state).

**Relationship**: The Claude Code plugin establishes an MCP session to communicate with the backend. This MCP session may initiate or interact with a coaching session, but they are distinct entities. MCP sessions are transport-level; coaching sessions are application-level.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Server Foundation & Lifecycle (Priority: P1)

**As** the backend server, **I** start a single HTTP server that serves both MCP (Streamable HTTP) and WebSocket on one configurable port, **so that** Claude Code and Electron can connect to a single process with reliable startup, health monitoring, and graceful shutdown.

**Why this priority**: Core infrastructure required for all other features. Without a running server, nothing else functions.

**Independent Test**: Server starts, accepts MCP initialization, accepts WebSocket connection, responds to health check, and shuts down gracefully.

**Acceptance Scenarios**:

1. **Given** all required environment variables are set and `PROJECT_DIR` exists, **When** the server starts, **Then** it logs the port, project directory, and a startup confirmation to stdout, **And** it is ready to accept connections within 2 seconds

2. **Given** the server is running, **When** Claude Code sends a POST to `/mcp` with an initialize request, **Then** a new stateful session is created with a UUID session ID, **And** the response includes the `Mcp-Session-Id` header

3. **Given** the server is running, **When** Electron connects to `ws://localhost:{PORT}/ws`, **Then** the WebSocket upgrade succeeds, **And** the connection is tracked, **And** the server can send and receive JSON messages

4. **Given** the server is running, **When** any client sends `GET /health`, **Then** it responds with HTTP 200 and `{ "status": "ok", "uptime": <seconds> }`

5. **Given** `PROJECT_DIR` or `ANTHROPIC_API_KEY` is missing or empty, **When** the server attempts to start, **Then** it exits with code 1, **And** the error message names the specific missing variable(s)

6. **Given** `PROJECT_DIR` is set to a path that does not exist on the filesystem, **When** the server attempts to start, **Then** it exits with code 1, **And** the error message states the path does not exist

7. **Given** `DATA_DIR` does not exist on the filesystem, **When** the server starts, **Then** it creates the directory (and any parent directories) before proceeding

8. **Given** the server is running with active MCP sessions and WebSocket connections, **When** the server receives SIGINT or SIGTERM, **Then** it closes all MCP transports, **And** closes all WebSocket connections, **And** logs each shutdown step, **And** exits with code 0

**Technical Details**: See [Appendix A: Server Foundation](#appendix-a-server-foundation) for packages, environment variables, and edge cases.

---

### User Story 2 — SQLite State Management (Priority: P1)

**As** the backend server, **I** initialize a SQLite database with typed interfaces, creating all tables on startup, **so that** sessions, plans, phases, Dreyfus assessments, knowledge gaps, and kata specs can be persisted across sessions with strong type safety.

**Why this priority**: Single source of truth for all application state. Required for session management, coaching pipeline, and observability.

**Independent Test**: Fresh database creates all tables. Full session lifecycle (create session → plan → phases → hints → progress → gaps → kata) round-trips correctly with all foreign key relationships intact.

**Acceptance Scenarios**:

1. **Given** `DATA_DIR/paige.db` does not exist, **When** the database module initializes, **Then** it creates the database file and all 10 tables

2. **Given** `DATA_DIR/paige.db` already exists with all tables and data, **When** the database module initializes, **Then** it connects without error and existing data is preserved

3. **Given** the database is initialized, **When** a session is created with project_dir, issue_number, issue_title, **Then** it is stored with status "active" and started_at set to now, **And** it can be retrieved by ID with all fields intact

4. **Given** a session exists, **When** a plan is created for that session, and phases are created for that plan, **Then** phases are linked to the plan via foreign key, **And** each phase can be queried independently or with its parent plan, **And** the plan has an `is_active` boolean (default true) to support multiple plan versions per session

5. **Given** a phase exists, **When** file hints and line hints are created for it, **Then** each hint is stored with its metadata (path, line range, style, hover_text), **And** hints can be queried by phase_id and filtered by type

6. **Given** the database is initialized, **When** a Dreyfus assessment is created for skill_area "React state management", **Then** it is stored with stage, confidence, evidence, and assessed_at, **And** updating the same skill_area overwrites the existing assessment (UNIQUE constraint)

7. **Given** a session exists, **When** knowledge gaps are recorded, **Then** each gap stores topic, severity, evidence, related_concepts (JSON array), **And** gaps can be queried by session_id or globally with filters

8. **Given** a knowledge gap exists, **When** a kata spec is generated, **Then** it stores title, description, scaffolding_code, instructor_notes, constraints (JSON), and user_attempts (empty JSON array)

9. **Given** a kata spec exists with previous attempts, **When** a new attempt is added, **Then** the user_attempts JSON array is appended with the new attempt ({code, review, level, passed, constraints}), **And** previous attempts are preserved

10. **Given** a phase exists, **When** progress events are recorded (hint_used, hint_escalated, review_requested, review_passed), **Then** each event stores event_type, optional data (JSON), and created_at, **And** events can be queried by phase_id in chronological order

**Technical Details**: See [Appendix B: Database Schema](#appendix-b-database-schema) for complete table definitions, JSON column schemas, and Practice Mode flow.

---

### User Story 3 — File System Layer (Priority: P1)

**As** the backend server, **I** own all file I/O operations — reading files, writing files (Electron-only), maintaining an in-memory buffer cache, watching for filesystem changes, computing diffs, and scanning the project tree, **so that** both Claude Code (via MCP) and Electron (via WebSocket) have a single, authoritative source for file state.

**Why this priority**: Core read-only enforcement (Constitution Principle I) and unified file state management. Required for MCP tools and WebSocket handlers.

**Independent Test**: Can read files, write files (Electron-only), maintain buffer cache, compute diffs, scan project tree excluding noise directories, and detect filesystem changes via watcher. Path traversal attempts are rejected.

**Acceptance Scenarios**:

1. **Given** a valid file path within `PROJECT_DIR`, **When** `readFile(path)` is called, **Then** the file content is returned as a string, **And** a detected language identifier is returned (based on file extension)

2. **Given** file content and a valid path within `PROJECT_DIR`, **When** `writeFile(path, content)` is called from the Electron tier, **Then** the file is written to disk, **And** the buffer cache entry is updated with `dirty: false`, **And** the write is acknowledged

3. **Given** Electron sends a `buffer_update` message with `{ path, content, cursorPosition }`, **When** the file system layer processes it, **Then** the buffer cache entry is updated with `{ content, cursorPosition, dirty: true, lastUpdated: <now> }`

4. **Given** a file has been opened and buffer-updated, **When** `getBuffer(path)` is called, **Then** the current `BufferEntry` is returned, **And** if no buffer exists for the path, `null` is returned

5. **Given** a file exists on disk and has a dirty buffer in the cache, **When** `getDiff(path)` is called, **Then** a unified diff string is returned showing the differences, **And** if the buffer is clean or missing, an empty diff is returned

6. **Given** `PROJECT_DIR` exists with files and subdirectories, **When** `getProjectTree()` is called, **Then** a recursive directory structure is returned, **And** common noise directories are excluded (`node_modules`, `.git`, `dist`, `build`, `coverage`)

7. **Given** the server starts with a valid `PROJECT_DIR`, **When** the file watcher initializes, **Then** watching begins for file add, change, and unlink events

8. **Given** the file watcher is running, **When** a file in `PROJECT_DIR` is created, modified, or deleted externally, **Then** a file change event is emitted, **And** the WebSocket layer can consume it to push tree updates to Electron

9. **Given** a path that resolves outside `PROJECT_DIR` (e.g. `../../etc/passwd`), **When** any file operation is attempted with that path, **Then** it is rejected with a clear error before any I/O occurs

**Technical Details**: See [Appendix C: File System](#appendix-c-file-system) for buffer cache structure, security validation, and edge cases.

---

### User Story 4 — Action Logging & Observability (Priority: P1)

**As** the backend server, **I** log every significant user action and system event to a queryable timeline, and every Claude API call to a dedicated cost-tracking table, **so that** the Observer has real-time coaching signals, sessions are replayable, and API budget is trackable.

**Why this priority**: Core observability and Observer system foundation. Enables coaching intelligence by providing action history and patterns.

**Independent Test**: Actions are logged with session_id, type, data, and timestamp. Buffer summaries are logged periodically. Buffer significant changes are logged immediately. API calls are logged with cost and token metadata. Actions are queryable by session and type.

**Acceptance Scenarios**:

1. **Given** a session is active, **When** any loggable user action occurs (e.g. `file:open`), **Then** a row is inserted into `action_log` with session_id, action_type, JSON data, and ISO 8601 timestamp

2. **Given** a session is active and the user is editing a file, **When** 30 seconds elapse since the last buffer summary, **Then** a `buffer_summary` action is logged for each dirty file, **And** `lastLoggedCharCount` is updated

3. **Given** a session is active and the user is editing, **When** a `buffer:update` arrives with char count differing from `lastLoggedCharCount` by >50% or >500 chars, **Then** a `buffer_significant_change` action is logged immediately

**Buffer Logging Priority Rules**:
1. **Significant change detection** (>50% or >500 chars): Log `buffer_significant_change` immediately and reset the 30-second timer for that file
2. **Periodic summary** (every 30s): Log `buffer_summary` for ALL dirty files (skip if no dirty files exist)
3. **No duplication**: If a significant change is logged, the next 30s timer does NOT log the same file again unless new edits occur
4. **Counter reset**: The significant change threshold counter resets after each immediate log

4. **Given** a session is active, **When** a Claude API call completes, **Then** a row is inserted into `api_call_log` with session_id, call_type, model, input_hash, latency_ms, input_tokens, output_tokens, cost_estimate, and timestamp

5. **Given** a session has accumulated actions, **When** the Observer queries for recent actions, **Then** it can retrieve the last N actions by session_id, filter by action_type, and compute time-since-last

6. **Given** a session has accumulated API calls, **When** the dashboard queries for budget data, **Then** total cost, cost by model, and average latency are computable via SQL aggregations

7. **Given** the 30s buffer summary timer fires, **When** no files are dirty, **Then** no action is logged

8. **Given** a session ends, **When** `session_ended` is logged, **Then** the buffer summary timer for that session is cleared

**Technical Details**: See [Appendix D: Action Logging](#appendix-d-action-logging) for complete action types catalog (27 types), buffer logging strategy, and EventEmitter for Observer.

---

### User Story 5 — WebSocket Protocol (Priority: P1)

**As** the backend server, **I** implement a typed message router that dispatches all client→server WebSocket messages to handler functions, and provide a broadcast function for server→client messages, **so that** Electron and the backend communicate via a well-defined, type-safe protocol.

**Why this priority**: Communication contract between backend and Electron. Required for all UI interactions and state synchronization.

**Independent Test**: Connection handshake completes. File operations dispatch correctly. Buffer updates are processed. Action-loggable messages trigger logging. File watcher events trigger broadcasts. Malformed JSON and unknown types are handled gracefully.

**Acceptance Scenarios**:

1. **Given** Electron connects to `/ws`, **When** it sends `connection:hello` with `{ version, platform, windowSize }`, **Then** the server stores connection metadata, **And** responds with `connection:init` containing `{ sessionId, capabilities, featureFlags }`

2. **Given** an established WebSocket connection, **When** Electron sends `file:open` with `{ path }`, **Then** the router dispatches to the handler, **And** handler calls `readFile(path)`, logs `file_open` action, **And** broadcasts `fs:content` with `{ path, content, language, lineCount }`

3. **Given** an established connection, **When** Electron sends `file:save` with `{ path, content }`, **Then** handler calls `writeFile(path, content)`, logs `file_save`, **And** broadcasts `fs:save_ack` with `{ path, success: true, timestamp }`, **And** on failure, broadcasts `fs:save_error` with `{ path, error }`

4. **Given** an established connection, **When** Electron sends `buffer:update` with `{ path, content, cursorPosition, selections }`, **Then** handler updates buffer cache, updates buffer log state, **And** checks for significant character delta, **And** no response is broadcast

5. **Given** an established connection, **When** Electron sends any action-loggable message (e.g. `editor:tab_switch`, `hints:level_change`, `user:idle_start`), **Then** handler logs the appropriate action type via `logAction`

6. **Given** chokidar detects a file change in `PROJECT_DIR`, **When** the file watcher emits an event, **Then** the WebSocket layer broadcasts `fs:tree_update` with `{ action, path, newPath? }`

7. **Given** an established connection, **When** Electron sends a message for a stub handler (e.g. initially `dashboard:request`), **Then** handler logs a "not yet implemented" warning, **And** sends `connection:error` with `{ code: "NOT_IMPLEMENTED", message, context }`

8. **Given** an established connection, **When** Electron sends a message with an unknown type, **Then** the router logs a warning and ignores it (no crash)

9. **Given** the backend needs to push a message (from MCP tool, Observer, or internal event), **When** `broadcast(message)` is called, **Then** the message is JSON-serialized and sent to all connected clients

10. **Given** a WebSocket connection disconnects, **When** the `onClose` handler fires, **Then** connection metadata is removed from the tracking Map

**Technical Details**: See [Appendix E: WebSocket Protocol](#appendix-e-websocket-protocol) for comprehensive message catalog (55 types: 23 client→server, 32 server→client), handler architecture, and edge cases.

---

### User Story 6 — MCP Tool Surface (Priority: P1)

**As** the backend server, **I** register MCP tools that Claude Code calls to manage session lifecycle, read session state, editor buffers, and diffs, and to control the Electron UI (highlights, hints, phase updates, coaching messages), **so that** Paige can coach effectively through a well-defined, typed tool interface.

**Why this priority**: API contract for Claude Code plugin. Core read-only enforcement (no write tools exposed). Required for all coaching interactions.

**Session Lifecycle**: Claude Code plugin hooks (SessionStart, SessionEnd) call `paige_start_session` and `paige_end_session` MCP tools. Only one session can be active at a time. The active session is stored in backend state and used by all other MCP tools requiring session context.

**Independent Test**: All MCP tools are registered and callable. Session lifecycle tools create/end sessions correctly. Read tools return correct data. UI control tools broadcast WebSocket messages. No file-write tools exist in MCP surface. All tool calls are logged.

**Acceptance Scenarios**:

1. **Given** a file has a dirty buffer in the cache, **When** Claude Code calls `paige_get_buffer({ path: "src/auth.ts" })`, **Then** the tool returns `{ path, content, cursorPosition, dirty: true, lastUpdated }`

2. **Given** no buffer entry exists for a file, **When** Claude Code calls `paige_get_buffer({ path: "unknown.ts" })`, **Then** the tool returns `null`

3. **Given** Electron has opened 3 files via `file:open` and Claude Code has opened 1 via `paige_open_file`, **When** Claude Code calls `paige_get_open_files()`, **Then** the tool returns all 4 paths

4. **Given** a file has unsaved buffer edits, **When** Claude Code calls `paige_get_diff({ path: "src/auth.ts" })`, **Then** the tool returns `{ diffs: [{ path: "src/auth.ts", diff: "<unified diff>" }] }`

5. **Given** 2 files have dirty buffers and 1 has a clean buffer, **When** Claude Code calls `paige_get_diff({})` (no path), **Then** the tool returns diffs for the 2 dirty files only

6. **Given** an active session with a plan, phases, and dirty buffers, **When** Claude Code calls `paige_get_session_state({ include: ["phase", "diffs"] })`, **Then** the tool returns only the `phase` and `diffs` fields

7. **Given** an active session, **When** Claude Code calls `paige_get_session_state({})` (no include filter), **Then** the tool returns all 9 state items

8. **Given** a valid file path within `PROJECT_DIR`, **When** Claude Code calls `paige_open_file({ path: "src/auth.ts" })`, **Then** the backend reads the file, adds path to open files set, logs `mcp_tool_call`, broadcasts `editor:open_file` with `{ path, content, language, lineCount }`, **And** returns `{ success: true, path }`

9. **Given** an open file in Electron, **When** Claude Code calls `paige_highlight_lines` twice with different line ranges, **Then** both sets of decorations are active (accumulated, not replaced), **And** `decorations_applied` and `mcp_tool_call` are logged for each call, **And** `editor:highlight_lines` is broadcast for each call

10. **Given** decorations exist on multiple files, **When** Claude Code calls `paige_clear_highlights({ path: "src/auth.ts" })`, **Then** only decorations on `src/auth.ts` are cleared, **And** calling `paige_clear_highlights({})` clears all decorations on all files

11. **Given** files in the project tree, **When** Claude Code calls `paige_hint_files({ paths: ["src/auth.ts", "src/handlers/oauth.ts"], style: "suggested" })`, **Then** `file_hints_applied` and `mcp_tool_call` are logged, **And** `explorer:hint_files` is broadcast with `{ paths, style }`

12. **Given** file hints are active in the explorer, **When** Claude Code calls `paige_clear_hints()`, **Then** `explorer:clear_hints` is broadcast

13. **Given** an active session with a plan, phase 1 has status "pending", **When** Claude Code calls `paige_update_phase({ phase: 1, status: "active" })`, **Then** the phase row in SQLite is updated with `status: "active"` and `started_at: <now>`, **And** `phase_started` and `mcp_tool_call` are logged, **And** `coaching:phase_update` is broadcast with the updated phase data, **And** the tool returns `{ success: true, phase: { id, number, title, status: "active" } }`

14. **Given** phase 1 has status "active", **When** Claude Code calls `paige_update_phase({ phase: 1, status: "complete" })`, **Then** SQLite is updated with `status: "complete"` and `completed_at: <now>`, **And** `phase_completed` and `mcp_tool_call` are logged

**Phase Status Lifecycle**:
- Valid transitions: `pending` → `active` → `complete` (one-way, irreversible)
- Constraints: Only one phase per plan can have `status = 'active'` at a time
- Skipping phases is not allowed (a phase must transition to `active` before `complete`)
- Re-activation of completed phases is not permitted
- Phase status is scoped per-plan (different plans for the same session maintain independent phase states)

15. **Given** an active session, **When** Claude Code calls `paige_show_message({ message: "Nice work!", type: "success" })`, **Then** `coaching_message` and `mcp_tool_call` are logged, **And** `coaching:message` is broadcast with `{ message, type }`

16. **Given** an active session, **When** Claude Code calls `paige_show_issue_context({ title: "Fix OAuth race condition", summary: "..." })`, **Then** `mcp_tool_call` is logged, **And** `coaching:issue_context` is broadcast

**Technical Details**: See [Appendix F: MCP Tools](#appendix-f-mcp-tools) for complete tool catalog (12 tools: 4 read, 8 UI control), StateItem enum, session scoping, highlight behavior, and read-only enforcement.

---

### User Story 7 — Claude API Client (Priority: P2)

**As** the backend server, **I** provide a unified API client module for calling Claude (Anthropic API) with automatic structured output parsing, comprehensive logging, retry logic, model resolution, and cost tracking, **so that** all backend features calling Claude (coaching pipeline, Observer, UI-driven) use consistent patterns and full observability.

**Why this priority**: Foundation for all AI-powered features (coaching, Observer, Explain This, Review My Work, dashboard). Required before implementing those features.

**Independent Test**: API calls succeed with structured output validation. Model aliases resolve correctly. Cost tracking logs all metadata. Retry logic handles transient failures. Special stop reasons (refusal, max_tokens) throw appropriate errors.

**Acceptance Scenarios**:

1. **Given** a valid API call with a Zod schema, **When** `callApi()` is invoked, **Then** Claude returns structured JSON matching the schema, **And** the response is parsed and validated, **And** the call is logged to `api_call_log`

2. **Given** a model alias "sonnet" or "haiku", **When** `callApi()` resolves the model, **Then** it maps to the correct full model ID

**Model Resolution**:
- `"sonnet"` → `"claude-opus-4-6"` (most capable, use for complex reasoning)
- `"haiku"` → `"claude-haiku-4-5-20251001"` (fast, use for triage and simple tasks)
- Configurable via environment variable `CLAUDE_MODEL_MAPPING` (JSON object) for future model updates
- Default pricing table (USD per 1M tokens):
  - Opus 4.6: $15 input / $75 output
  - Haiku 4.5: $0.25 input / $1.25 output

3. **Given** a successful API call, **When** the response is logged, **Then** `cost_estimate` is calculated from tokens × pricing, **And** latency_ms is recorded

4. **Given** a transient API failure (5xx, network timeout), **When** retry logic triggers, **Then** it retries up to 3 times with exponential backoff, **And** logs each attempt

5. **Given** the API returns `stop_reason: "refusal"`, **When** `callApi()` processes the response, **Then** it throws `ApiRefusalError` with the refusal message

6. **Given** the API returns `stop_reason: "max_tokens"`, **When** `callApi()` processes the response, **Then** it throws `ApiMaxTokensError`

**API Error Types** (all extend base `ApiError` with `{ message, statusCode?, retryable }`):
- `ApiRefusalError`: Model refused to respond (stop_reason: "refusal"). Not retryable.
- `ApiMaxTokensError`: Response truncated (stop_reason: "max_tokens"). Not retryable. Indicates prompt may need reduction.
- `ApiContentFilterError`: Content policy violation (stop_reason: "content_filter"). Not retryable.
- `ApiRateLimitError`: Rate limit exceeded (HTTP 429). Retryable with backoff.
- `ApiServerError`: Server error (HTTP 5xx). Retryable.
- `ApiNetworkError`: Network timeout or connection failure. Retryable.
- `ApiValidationError`: Structured output failed Zod schema validation. Not retryable. Indicates schema mismatch.

7. **Given** an API call fails after all retries, **When** the error is logged, **Then** `api_call_log` contains `latency_ms: -1`, zero tokens, and zero cost

**Technical Details**: See [Appendix G: Claude API Client](#appendix-g-claude-api-client) for API patterns, model resolution, pricing tables, retry configuration, and error types.

---

### User Story 8 — ChromaDB Memory Integration (Priority: P2)

**As** the backend server, **I** provide semantic memory storage and retrieval via ChromaDB, storing plan reflections, session wrap-ups, and other coaching artifacts across sessions, **so that** Claude can recall relevant past context when coaching and the dashboard can show learning materials.

**Why this priority**: Enables cross-session learning and continuity. Required for coaching pipeline memory connection and dashboard learning materials.

**Independent Test**: Memories are stored with content and metadata. Semantic search returns relevant results. Project filtering works. System degrades gracefully when ChromaDB is unavailable (lazy recovery on reconnect).

**Acceptance Scenarios**:

1. **Given** ChromaDB is available, **When** `addMemories()` is called with documents, **Then** they are stored in the `paige_memories` collection with content and metadata

2. **Given** memories exist in ChromaDB, **When** `queryMemories()` is called with a query text, **Then** it returns semantically similar results ranked by distance

3. **Given** memories exist for multiple projects, **When** `queryMemories()` is called without a `project` filter, **Then** results include memories from all projects

4. **Given** memories exist for multiple projects, **When** `queryMemories()` is called with a `project` filter, **Then** only matching project's memories are returned

5. **Given** ChromaDB is available at startup, **When** the server initializes, **Then** it logs a successful connection, **And** `isMemoryAvailable()` returns `true`

6. **Given** ChromaDB is unavailable at startup, **When** the server initializes, **Then** the server still starts, a warning is logged, **And** `isMemoryAvailable()` returns `false`

7. **Given** ChromaDB is unavailable during runtime, **When** memory operations are called, **Then** they return degraded results (`[]` for queries, `{ added: 0 }` for adds) without crashing

8. **Given** ChromaDB was unavailable but comes online later, **When** the next memory operation is attempted, **Then** it reconnects and succeeds

**Technical Details**: See [Appendix H: ChromaDB Integration](#appendix-h-chromadb-integration) for collection schema, embedding model, metadata structure, degradation behavior, and lazy recovery.

---

### User Story 9 — Coaching Pipeline (API Calls) (Priority: P2)

**As** the backend server, **I** expose two MCP tools — `paige_run_coaching_pipeline` (transforms issue + memories → phased coaching plan) and `paige_end_session` (wraps up session with reflection, knowledge gaps, Dreyfus updates, and memory storage) — **so that** Claude Code can trigger the coaching lifecycle. Note: `paige_end_session` is called by the Claude Code plugin's SessionEnd hook.

**Why this priority**: Core coaching intelligence. Transforms GitHub issues into structured, Dreyfus-aware coaching plans. Captures learning outcomes at session end.

**Independent Test**: Pipeline takes issue context, queries memories, calls Coach Agent, stores plan/phases/hints in SQLite, broadcasts `coaching:plan_ready`. Session wrap-up calls 3 agents (Reflection, Knowledge Gap, Dreyfus), stores results, adds memories, broadcasts `session:completed`. All flows handle failures gracefully.

**Acceptance Scenarios**:

1. **Given** an active session with issue context, **When** `paige_run_coaching_pipeline` is called, **Then** it marks any existing plan as `is_active=false`, queries relevant memories from ChromaDB, calls Coach Agent with issue + memories + Dreyfus stages, **And** stores new plan with `is_active=true`, phases, and hints in SQLite, **And** broadcasts `coaching:plan_ready` with plan data

**Dreyfus Stages Input Schema** (passed to Coach Agent):
```json
{
  "dreyfus_assessments": [
    { "skill_area": "debugging", "stage": "Novice", "confidence": 0.8 },
    { "skill_area": "testing", "stage": "Competent", "confidence": 0.6 },
    { "skill_area": "React state management", "stage": "Advanced Beginner", "confidence": 0.7 }
  ]
}
```
- Source: All rows from `dreyfus_assessments` table (global, not session-scoped)
- Empty array `[]` on first-ever session (no historical assessments)
- Enables Dreyfus-aware coaching (Novices get more guidance, Experts get architectural challenges)

**ChromaDB Memory Query Strategy**:
- Query text: `"{issue.title} {issue.summary}"` (concatenated)
- Filter: `metadata.project_dir == PROJECT_DIR` (project-scoped memories only)
- Limit: Top 5 results by semantic similarity distance
- On first run or ChromaDB unavailable: `relevant_memories = []` (Coach Agent still runs)
- Result format: `[{ id, text, metadata: { session_id, created_at, type } }]`

2. **Given** ChromaDB is unavailable, **When** `paige_run_coaching_pipeline` is called, **Then** Coach Agent is still called with empty `relevant_memories`, **And** it produces a valid coaching plan

3. **Given** Coach Agent fails (API error, schema validation), **When** `paige_run_coaching_pipeline` is called, **Then** it returns an MCP error, **And** no partial data is stored in SQLite

4. **Given** an active session with work completed, **When** `paige_end_session` is called, **Then** it calls Reflection Agent → stores memories, calls Knowledge Gap Agent → stores gaps/katas, calls Dreyfus Agent → updates assessments, **And** marks session status "completed", **And** broadcasts `session:completed`

5. **Given** one of the three wrap-up API calls fails, **When** `paige_end_session` executes, **Then** remaining calls still execute, **And** session is still marked "completed" with partial data

6. **Given** all three wrap-up API calls fail, **When** `paige_end_session` executes, **Then** session is still marked "completed" with zero counts for all stored entities

**Wrap-Up Error Handling & Recovery**:
- **Error Tracking**: A new `session_wrap_up_errors` table stores wrap-up failures:
  ```sql
  CREATE TABLE session_wrap_up_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    agent_name TEXT NOT NULL, -- "reflection" | "knowledge_gap" | "dreyfus"
    error_message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  ```
- **Session Status**: If ANY wrap-up agent fails, session status is marked `"completed_with_errors"` instead of `"completed"`
- **Partial Data**: Successfully completed agents store their data normally (e.g., if Reflection succeeds but Knowledge Gap fails, memories are stored but no gaps/katas)
- **Recovery Mechanism**: Add MCP tool `paige_retry_wrap_up({ sessionId, agent? })` to manually retry failed agents
- **Observability**: All wrap-up errors are logged to `action_log` with type `wrap_up_error` for dashboard visibility

7. **Given** a completed coaching pipeline, **When** the stored data is queried, **Then** phases, hints, gaps, katas, and assessments have correct foreign key relationships

8. **Given** a completed session wrap-up, **When** Electron is connected, **Then** it receives `coaching:plan_ready` and `session:completed` broadcasts with full payload

**Technical Details**: See [Appendix I: Coaching Pipeline](#appendix-i-coaching-pipeline) for Coach Agent schema, Reflection Agent, Knowledge Gap Agent, Dreyfus Agent, memory storage format, and best-effort resilience strategy.

---

### User Story 10 — Observer System (Priority: P2)

**As** the backend server, **I** maintain a per-session Observer that subscribes to real-time action log events, evaluates whether Claude should proactively nudge (using a fast triage model), and broadcasts nudges to the PTY — with cooldown suppression, flow state detection, and mute support, **so that** Paige can intervene when the user is stuck without interrupting flow.

**Why this priority**: Proactive coaching intelligence. Differentiates Paige from reactive tools.

**Independent Test**: Observer starts with session, subscribes to action events, triggers triage on eligible events, delivers nudges when confidence threshold met, suppresses during cooldown and flow state, respects mute toggle, and stops with session end.

**Acceptance Scenarios**:

1. **Given** a session is created, **When** the Observer initializes, **Then** it subscribes to the action log EventEmitter, starts an idle timer, **And** broadcasts `observer:status` with `{ active: true, muted: false }`

2. **Given** a session ends, **When** `paige_end_session` is called, **Then** the Observer unsubscribes from events, clears the idle timer, **And** broadcasts `observer:status` with `{ active: false }`

3. **Given** the Observer is active, **When** a triage-eligible action occurs (e.g. file open, 5th buffer update, 3rd review request), **Then** it captures a context snapshot, calls Haiku with the Triage Model schema, **And** logs the evaluation

**Observer Triage Triggers** (complete list):
- `file:open` — Every file open (detects exploration patterns, opening same file repeatedly)
- `buffer:update` — Every 5th buffer update **within the current phase** (counter resets when phase completes)
- `user_explain_request` — Every 3rd "Explain This" request **globally per session** (never resets, indicates comprehension struggle)
- `phase_completed` — On every phase transition (checkpoint for proactive check-in)

**Triage Trigger State**:
- Stored in-memory per session: `Map<action_type, counter>`
- `buffer:update` counter: Scoped per-phase, resets on `phase_completed` action
- `user_explain_request` counter: Global per session, never resets
- `file:open`: No counter (triggers every occurrence)
- `phase_completed`: No counter (triggers every occurrence)

4. **Given** Haiku returns `{ should_nudge: true, confidence: 0.8, signal: "stuck_on_implementation" }`, **When** no nudge has been sent in the last 120s, **Then** the Observer logs `nudge_sent`, **And** broadcasts `observer:nudge` via WebSocket with `{ signal, confidence, context }`, which Electron receives and injects into the PTY stdin

5. **Given** a nudge was sent 60 seconds ago, **When** the Observer evaluates again and gets `should_nudge: true`, **Then** it logs `nudge_suppressed` with reason "cooldown", **And** no broadcast is sent

6. **Given** >10 actions have occurred in the last 60 seconds (flow state), **When** the Observer receives a new action, **Then** triage is skipped entirely (logged as "flow_state")

**Flow State Detection Algorithm**:
- Trigger condition: **>10 user-initiated actions in rolling 60-second window**
- **User-initiated actions** (counted):
  - `buffer:update`
  - `file:open`
  - `file:save`
  - `editor:tab_switch`
- **System events** (NOT counted):
  - `mcp_tool_call` (MCP tool invocations)
  - `decorations_applied` (hint rendering)
  - `coaching_message` (proactive messages)
- Counter scope: **Session-global** (not per-phase)
- Implementation: Maintain sliding window queue of timestamps for counted actions

7. **Given** Electron sends `observer:mute { muted: true }`, **When** the Observer receives a triage-eligible action, **Then** no evaluation occurs, **And** no nudge is sent

8. **Given** `observer:mute { muted: false }` is sent after being muted, **When** a triage-eligible action occurs, **Then** evaluations resume

9. **Given** Haiku returns `{ should_nudge: true, confidence: 0.5 }`, **When** the Observer processes the response, **Then** it logs `nudge_suppressed` with reason "low_confidence", **And** no broadcast is sent

**Nudge Delivery Confidence Threshold**:
- Minimum confidence: **0.7** (70%)
- Delivery rule: `should_nudge === true AND confidence >= 0.7`
- Suppression rule: If `confidence < 0.7`, log `nudge_suppressed` with `reason: "low_confidence"`
- Rationale: Prevents low-confidence nudges that may interrupt unnecessarily (false positives more disruptive than false negatives)

10. **Given** the Haiku triage call fails, **When** the Observer processes the error, **Then** it logs the failure, **And** continues operating (no crash)

11. **Given** 4 buffer updates have occurred, **When** the 5th buffer update arrives, **Then** the Observer triggers triage, **And** resets the buffer counter to 0

**Technical Details**: See [Appendix J: Observer System](#appendix-j-observer-system) for triage model schema, trigger conditions, suppression rules, flow state detection, and nudge delivery.

---

### User Story 11 — UI-Driven API Calls (Priority: P3)

**As** the backend server, **I** handle two UI-driven features — "Explain This" (Sonnet explains selected code with Dreyfus-aware depth) and "Practice Review" (Sonnet reviews kata solutions with constraint-aware history) — **so that** users can request on-demand explanations and get immediate feedback on practice exercises.

**Why this priority**: User-facing AI features. Completes the Paige UX beyond background coaching.

**Independent Test**: "Explain This" takes selected code, calls Sonnet with Dreyfus context, returns explanation. "Practice Review" loads kata, sends solution + constraints + previous attempts (matching constraints only) to Sonnet, returns review + level + passed, unlocks constraints, persists attempt.

**Acceptance Scenarios**:

1. **Given** a user selects code in Electron and clicks "Explain This", **When** Electron sends `user:explain` with `{ path, range, selectedText }`, **Then** the backend retrieves buffer context, calls Sonnet with Dreyfus stages + phase context, **And** broadcasts `explain:response` with `{ explanation, phaseConnection? }`

2. **Given** Dreyfus stage is "Novice", **When** "Explain This" calls Sonnet, **Then** the explanation includes high-level concepts with analogies

3. **Given** Dreyfus stage is "Expert", **When** "Explain This" calls Sonnet, **Then** the explanation focuses on architecture, trade-offs, and edge cases

4. **Given** an active phase, **When** "Explain This" is called, **Then** the response includes `phaseConnection` showing how the code relates to the current coaching goal

5. **Given** a kata spec exists with no previous attempts, **When** Electron sends `practice:submit_solution` with `{ kataId, code, activeConstraints }`, **Then** the backend calls Sonnet with description + constraints + code, **And** broadcasts `practice:solution_review` with `{ review, level, passed, constraintsUnlocked }`

6. **Given** a user's max level for this kata is 2 (from previous attempts), **When** Sonnet assigns level 5 to their new attempt, **Then** constraints with `minLevel` 3, 4, and 5 are unlocked for future attempts on this kata

**Constraint Unlocking Design** (MVP):
- **Persistence**: Max level is computed dynamically from the `user_attempts` JSON array (no separate table)
- **Computation**: `maxLevel = Math.max(...user_attempts.map(a => a.level))` on each attempt submission
- **Filtering**: Next submission displays constraints where `constraint.minLevel <= maxLevel`
- **Atomicity**: Constraint unlocking and attempt persistence are **transactional**:
  - If Sonnet call succeeds → append to `user_attempts` JSON → update kata row
  - If database write fails → rollback, return error, no partial state
  - Both operations wrapped in SQLite transaction
- **Trade-offs**: This design trades storage efficiency for simplicity (no denormalization). Acceptable for MVP with <100 attempts per kata.
- **Post-MVP**: If kata volume scales, denormalize to `user_kata_progress` table with `(kata_id, max_level_achieved)`.

7. **Given** a kata has 3 previous attempts, **When** a 4th is submitted, **Then** all 4 attempts are persisted in the `user_attempts` JSON array

8. **Given** a kata has attempts with different active constraints, **When** a new attempt is submitted with constraints A+B, **Then** only previous attempts with A+B are sent to Sonnet (same-constraint filtering)

9. **Given** a transient API failure occurs, **When** "Explain This" or "Practice Review" calls Sonnet, **Then** retry logic attempts up to 3 times

10. **Given** all retries fail, **When** the error is final, **Then** an error message is broadcast (`explain:error` or `review:error`) with a user-friendly message

11. **Given** Electron sends `practice:submit_solution` with a non-existent `kataId`, **When** the backend processes the request, **Then** it broadcasts `review:error` without making an API call

**Technical Details**: See [Appendix K: UI-Driven API Calls](#appendix-k-ui-driven-api-calls) for "Explain This" schema, "Practice Review" schema, Dreyfus-aware prompting, constraint unlocking rules, same-constraint filtering, and retry/error handling.

---

### User Story 12 — Dashboard Data Assembly (Priority: P3)

**As** the backend server, **I** handle `dashboard:request` by assembling and broadcasting dashboard data in 4 progressive flows: immediate state (Dreyfus + stats), GitHub issues (with Haiku suitability assessment), in-progress challenges (active katas), and learning materials (web-searched resources for unaddressed knowledge gaps), **so that** the Electron dashboard displays actionable, personalized coaching data.

**Why this priority**: User-facing dashboard. Demonstrates cross-session learning and Dreyfus-aware personalization. Demo-visible feature.

**Independent Test**: Dashboard request returns immediate data (<100ms). Stats are filtered by time period. GitHub issues are fetched, ranked, and assessed for suitability. Active katas are loaded. Learning materials are web-searched (not hallucinated) for knowledge gaps. All flows handle failures gracefully.

**Acceptance Scenarios**:

1. **Given** Electron sends `dashboard:request`, **When** the backend processes it, **Then** it immediately broadcasts `dashboard:state` with Dreyfus data, stats, and empty placeholders, **And** kicks off 3 async flows

2. **Given** `statsPeriod: "7d"` is specified, **When** stats are computed, **Then** only action_log and api_call_log entries from the last 7 days are included

3. **Given** `statsPeriod: "all"` is specified, **When** stats are computed, **Then** all historical data is included

4. **Given** GitHub CLI is available, **When** the issues flow runs, **Then** it fetches open issues, calls Haiku to assess suitability + recommended focus, **And** broadcasts `dashboard:issues` with ranked issues

5. **Given** a user's Dreyfus stages are "Novice" in React and "Competent" in Node.js, **When** Haiku assesses issue suitability, **Then** ratings align with the user's skill levels

6. **Given** knowledge gaps exist with `addressed: false`, **When** the learning materials flow runs, **Then** it web-searches for each gap, **And** broadcasts `dashboard:learning_materials` with real URLs (not hallucinated)

7. **Given** no unaddressed knowledge gaps exist, **When** the learning materials flow runs, **Then** it is skipped, **And** no message is broadcast

8. **Given** all 4 dashboard flows complete or fail, **When** logging occurs, **Then** a `dashboard_loaded` action is logged with flow statuses

9. **Given** Electron sends `dashboard:refresh_issues`, **When** the backend processes it, **Then** it re-fetches and re-assesses GitHub issues, **And** broadcasts updated `dashboard:issues` without reloading full dashboard

10. **Given** ChromaDB is unavailable, **When** the issues flow calls Haiku for suitability, **Then** it still succeeds with empty memories

11. **Given** GitHub CLI fails (not installed, auth failure), **When** the issues flow runs, **Then** it broadcasts `dashboard:issues_error` with a readable message, **And** does not crash

12. **Given** a fresh Paige install with no data, **When** `dashboard:request` is sent, **Then** all stats are zeros, arrays are empty, **And** the response is valid

**Technical Details**: See [Appendix L: Dashboard](#appendix-l-dashboard) for flow architecture, stats aggregation, issue suitability schema, learning materials sources, progressive loading, and error handling.

---

### Edge Cases

See [Appendix M: Comprehensive Edge Cases](#appendix-m-comprehensive-edge-cases) for all 27 edge cases covering:
- Server startup failures
- Database errors
- File system edge cases
- Action logging edge cases
- WebSocket edge cases
- MCP tool edge cases
- API client errors
- ChromaDB degradation
- Observer edge cases
- UI-driven API edge cases
- Dashboard edge cases

## Requirements *(mandatory)*

### Functional Requirements

**Server Foundation (Story 1)**:
- **FR-001**: Server MUST start a single HTTP server on the port specified by `PORT` (default: 3000)
- **FR-002**: Server MUST mount MCP Streamable HTTP transport on `/mcp`, accepting POST (requests), GET (notifications), and DELETE (session termination)
- **FR-003**: Server MUST mount a WebSocket endpoint on `/ws`, accepting upgrade requests and tracking active connections
- **FR-004**: Server MUST respond to `GET /health` with HTTP 200 and `{ "status": "ok", "uptime": <number> }`
- **FR-005**: Server MUST validate that `PROJECT_DIR` and `ANTHROPIC_API_KEY` are set and non-empty, exiting with code 1 and a descriptive error if not
- **FR-006**: Server MUST validate that `PROJECT_DIR` exists on the filesystem, exiting with code 1 and a descriptive error if not
- **FR-007**: Server MUST create `DATA_DIR` (default `~/.paige/`) recursively if it does not exist
- **FR-008**: Server MUST handle SIGINT and SIGTERM by closing all MCP transports, all WebSocket connections, and exiting with code 0
- **FR-009**: MCP sessions MUST be stateful with UUID session IDs, tracked in an in-memory Map keyed by session ID

**Database (Story 2)**:
- **FR-010**: Database MUST be stored at `{DATA_DIR}/paige.db`
- **FR-011**: All tables MUST be created on startup using `CREATE TABLE IF NOT EXISTS`
- **FR-012**: Database MUST use WAL mode for concurrent read/write support
- **FR-013**: All database access MUST use Kysely with typed interfaces for each table
- **FR-014 to FR-022**: Complete table definitions and CRUD functions (see Appendix B)

**File System (Story 3)**:
- **FR-023**: All file paths MUST be validated to resolve within `PROJECT_DIR` before any I/O
- **FR-024 to FR-038**: Complete file system requirements (see Appendix C)

**Action Logging (Story 4)**:
- **FR-039 to FR-048**: Complete logging requirements (see Appendix D)

**WebSocket Protocol (Story 5)**:
- **FR-049 to FR-062**: Complete protocol requirements (see Appendix E)

**MCP Tools (Story 6)**:
- **FR-063 to FR-080**: Complete tool requirements (see Appendix F)

**Claude API Client (Story 7)**:
- **FR-081 to FR-095**: Complete API requirements (see Appendix G)

**ChromaDB Integration (Story 8)**:
- **FR-096 to FR-107**: Complete memory requirements (see Appendix H)

**Coaching Pipeline (Story 9)**:
- **FR-108 to FR-125**: Complete pipeline requirements (see Appendix I)

**Observer System (Story 10)**:
- **FR-126 to FR-145**: Complete Observer requirements (see Appendix J)

**UI-Driven API Calls (Story 11)**:
- **FR-146 to FR-168**: Complete UI API requirements (see Appendix K)

**Dashboard (Story 12)**:
- **FR-169 to FR-186**: Complete dashboard requirements (see Appendix L)

### Key Entities

```
sessions ──< plans ──< phases ──< phase_hints
                              ──< progress_events
sessions ──< knowledge_gaps ──< kata_specs
sessions ──< action_log
sessions ──< api_call_log
dreyfus_assessments (global)
```

**Core Entities**:
- **Session**: Represents a coaching session tied to a GitHub issue. Contains project context, timing, and status.
- **Plan**: A structured, multi-phase coaching plan generated from an issue.
- **Phase**: A discrete coaching step with hints, expected files, and status tracking. Each phase has a `hint_level` field with values: "off", "low", "medium", "high".
- **Phase Hints**: File and line hints for a phase (visual cues in Electron).
- **Progress Events**: Timeline of phase-level events (hint usage, escalations, reviews).
- **Dreyfus Assessments**: Global skill level tracking (Novice → Expert) per skill area.
- **Knowledge Gaps**: Topics where user struggled, with severity and evidence.
- **Kata Specs**: Practice exercises generated from knowledge gaps with progressive constraints.
- **Action Log**: Timeline of all user actions and system events for observability.
- **API Call Log**: Cost tracking and metadata for all Claude API calls.

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Server Foundation**: Server starts within 2 seconds. MCP and WebSocket connections establish successfully. Graceful shutdown completes cleanly.

**Database**: All 10 tables created on fresh start. Full session lifecycle round-trips correctly. WAL mode active.

**File System**: File read/write works. Buffer cache tracks state correctly. Diffs computed accurately. Project tree excludes noise directories. File watcher detects changes. Path traversal rejected.

**Action Logging**: Actions logged with correct metadata. Buffer summaries periodic. Significant changes detected. API calls logged with cost tracking. Actions queryable.

**WebSocket**: Handshake completes. File operations dispatch. Buffer updates process. Broadcasts deliver. Unknown types handled.

**MCP Tools**: All 12 tools registered. Read tools return data. UI tools broadcast. No write tools exposed. Tool calls logged.

**API Client**: Structured outputs work. Model resolution correct. Cost tracking accurate. Retry logic functional. Error types handled.

**ChromaDB**: Memories stored. Semantic search works. Project filtering functional. Degradation graceful. Lazy recovery works.

**Coaching Pipeline**: Full pipeline stores plan in SQLite and broadcasts. Session wrap-up calls 3 agents and stores results. Failures handled gracefully.

**Observer**: Starts/stops with session. Subscribes to events. Triggers triage. Delivers nudges. Suppression rules work. Flow state detected. Mute functional.

**UI-Driven APIs**: Explain This returns Dreyfus-aware explanation. Practice Review unlocks constraints. Attempt history persisted. Retry logic works.

**Dashboard**: Immediate response (<100ms). Stats filtered by period. Issues assessed. Learning materials have real URLs. Progressive loading works. Errors handled.

**Complete success criteria catalog**: See original spec `docs/planning/backend-discovery/SPEC.md` section "Success Criteria" for all 91 detailed success criteria (SC-001 through SC-091).

---

## Appendices

**Note**: Due to the comprehensive nature of the original spec, detailed appendices are preserved in the original discovery document at `docs/planning/backend-discovery/SPEC.md`. Key appendices include:

- **Appendix A**: Server Foundation (packages, environment variables, edge cases)
- **Appendix B**: Database Schema (10 tables, JSON schemas, Practice Mode flow)
- **Appendix C**: File System (buffer cache, capabilities, security, edge cases)
- **Appendix D**: Action Logging (27 action types, buffer strategy, EventEmitter)
- **Appendix E**: WebSocket Protocol (55 message types, handler architecture)
- **Appendix F**: MCP Tools (12 tools, StateItem enum, session scoping)
- **Appendix G**: Claude API Client (patterns, model resolution, pricing, retry)
- **Appendix H**: ChromaDB Integration (schema, degradation, lazy recovery)
- **Appendix I**: Coaching Pipeline (Coach/Reflection/Gap/Dreyfus agents)
- **Appendix J**: Observer System (triage model, triggers, suppression)
- **Appendix K**: UI-Driven APIs (Explain This, Practice Review)
- **Appendix L**: Dashboard (flow architecture, stats, issue suitability)
- **Appendix M**: Comprehensive Edge Cases (all 27 edge cases)

---

## Glossary

| Term | Definition |
|------|-----------|
| **MCP** | Model Context Protocol — communication protocol between Claude Code and backend (Streamable HTTP) |
| **PTY** | Pseudo-terminal — terminal process running Claude Code inside Electron |
| **Observer** | Per-session background process that monitors user activity and decides whether Paige should proactively nudge |
| **Triage Model** | Fast/cheap model (Haiku) that makes binary nudge/no-nudge decisions |
| **Coach Agent** | Sonnet API call that transforms a plan into phased, scaffolded guidance (Dreyfus-aware) |
| **Dreyfus Model** | Five-stage skill acquisition model (Novice → Advanced Beginner → Competent → Proficient → Expert) |
| **Kata** | Practice exercise generated from identified knowledge gaps, with progressive constraints |
| **ChromaDB** | Vector database for semantic search, used for cross-session memory |
| **Buffer Cache** | In-memory Map of current editor buffer contents, updated via debounced WebSocket messages |
| **Structured Outputs** | Anthropic API feature that guarantees schema-compliant JSON via constrained decoding |
| **Knowledge Gap** | Topic where user struggled, needed excessive hints, or made repeated mistakes |

---

## Assumptions

1. **Single User**: Paige is designed for one developer at a time. No multi-tenant support.
2. **Local ChromaDB**: ChromaDB runs as a local server (`localhost:8000`). No cloud deployment.
3. **GitHub CLI**: `gh` CLI is installed and authenticated for issue fetching.
4. **Node.js Environment**: Server runs on Node.js 18+ with TypeScript.
5. **No Production Deployment**: This is a hackathon MVP. No production infrastructure, monitoring, or scaling considerations.
6. **Hackathon Timeframe**: One week, solo developer. Prioritization reflects demo requirements.
7. **Read-Only Plugin**: Claude Code plugin has NO file-write tools. Electron handles all writes.
8. **SQLite Sufficient**: Single-user workload fits within SQLite's capabilities. No need for PostgreSQL.
9. **No Authentication**: No auth layer. Trust relationship between plugin, backend, and Electron.
10. **Happy Path Focus**: Edge cases handled gracefully, but exhaustive error recovery is out of scope.

---

## References

- **Original discovery spec**: `docs/planning/backend-discovery/SPEC.md` (3647 lines, complete technical specifications)
- **Project constitution**: `.sdd/memory/constitution.md` (Paige principles and development standards)
- **Initial brainstorm**: `docs/planning/initial-brainstorm.md` (Full architecture, UI design, coaching pipeline)
- **Frontend/Backend contracts**: `docs/planning/frontend-discovery/SPEC.md`, `docs/planning/plugin-discovery/SPEC.md`
- **Revision history**: See original spec appendix for story revision history
