# Tasks: Backend Server

**Input**: Design documents from `/specs/002-backend-server/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Tests**: Happy path automated tests are REQUIRED per constitution. Each user story phase includes test tasks.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **Checkbox**: Always `- [ ]` (markdown checkbox)
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- **[GIT]**: Git workflow task (branch, commit, push, PR)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

### Git Workflow - Phase Start

- [x] T001 [GIT] Verify on main branch and working tree is clean
- [x] T002 [GIT] Pull latest changes from origin/main
- [x] T003 [GIT] Create feature branch: 002-backend-server

### Project Initialization

- [x] T004 Create project directory structure per plan.md (src/, tests/, specs/)
- [x] T005 [GIT] Commit: initialize project structure
- [x] T006 Initialize Node.js project with package.json (use devs:typescript-dev agent)
- [x] T007 [GIT] Commit: add package.json
- [x] T008 Install core dependencies from plan.md (@modelcontextprotocol/sdk, better-sqlite3, kysely, ws, chokidar, zod, @anthropic-ai/sdk, chromadb)
- [x] T009 [GIT] Commit: add production dependencies
- [x] T010 [P] Install dev dependencies (typescript, @types/node, @types/ws, vitest, @vitest/ui, eslint, prettier, husky, lint-staged)
- [x] T011 [GIT] Commit: add dev dependencies
- [x] T012 Configure TypeScript with strict mode in tsconfig.json (use devs:typescript-dev agent)
- [x] T013 [GIT] Commit: add TypeScript config
- [x] T014 [P] Configure ESLint with @typescript-eslint/recommended-requiring-type-checking (use dev-specialisms:init-local-tooling skill)
- [x] T015 [P] Configure Prettier with consistent style rules (use dev-specialisms:init-local-tooling skill)
- [x] T016 [GIT] Commit: add linting and formatting config
- [x] T017 Configure Vitest with unit/integration/contract test separation in vitest.config.ts
- [x] T018 [GIT] Commit: add Vitest config
- [x] T019 Set up Husky + lint-staged for pre-commit hooks (reject warnings)
- [x] T020 [GIT] Commit: add pre-commit hooks
- [x] T021 Create .env.example template with PORT, PROJECT_DIR, ANTHROPIC_API_KEY, DATA_DIR
- [x] T022 [GIT] Commit: add environment template
- [x] T023 Update .gitignore for Node.js, TypeScript, .env, coverage, dist
- [x] T024 [GIT] Commit: update gitignore

### Phase 1 Completion

- [x] T025 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [x] T026 [GIT] Create/update PR to main with Phase 1 summary
- [x] T027 [GIT] Verify all CI checks pass
- [x] T028 [GIT] Report PR ready status

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Git Workflow - Phase Start

- [x] T029 [GIT] Verify working tree is clean before starting Phase 2
- [x] T030 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [x] T031 Create retro/P2.md for this phase
- [ ] T032 [GIT] Commit: initialize phase 2 retro

### Foundational Infrastructure

- [ ] T033 Create src/types/domain.ts with core type definitions (Session, Plan, Phase, etc.) (use devs:typescript-dev agent)
- [ ] T034 [GIT] Commit: add domain types
- [ ] T035 [P] Create src/config/env.ts with environment validation (use devs:typescript-dev agent)
- [ ] T036 [GIT] Commit: add environment config
- [ ] T037 [P] Create src/database/db.ts with Kysely setup and WAL mode (use devs:typescript-dev agent)
- [ ] T038 [P] Create src/database/migrations/ directory with all 10 table CREATE TABLE IF NOT EXISTS scripts (use devs:typescript-dev agent)
- [ ] T039 [GIT] Commit: add database setup and migrations
- [ ] T040 [P] Create src/logger/action-log.ts with logAction function and EventEmitter (use devs:typescript-dev agent)
- [ ] T041 [P] Create src/logger/api-log.ts with logApiCall function and cost tracking (use devs:typescript-dev agent)
- [ ] T042 [GIT] Commit: add logging infrastructure
- [ ] T043 Create src/types/websocket.ts with 55 WebSocket message type definitions from contracts/websocket.json (use devs:typescript-dev agent)
- [ ] T044 [GIT] Commit: add WebSocket types
- [ ] T045 Create src/types/mcp.ts with MCP tool parameter/return types from contracts/mcp-tools.json (use devs:typescript-dev agent)
- [ ] T046 [GIT] Commit: add MCP types

### Phase 2 Wrap-Up

- [ ] T047 Run /sdd:map incremental for Phase 2 changes
- [ ] T048 [GIT] Commit: update codebase documents for phase 2
- [ ] T049 Review retro/P2.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T050 [GIT] Commit: finalize phase 2 retro

### Phase 2 Completion

- [ ] T051 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T052 [GIT] Create/update PR to main with Phase 2 summary
- [ ] T053 [GIT] Verify all CI checks pass
- [ ] T054 [GIT] Report PR ready status

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Server Foundation & Lifecycle (Priority: P1) 🎯 MVP

**Goal**: Start a single HTTP server serving both MCP (Streamable HTTP) and WebSocket with health monitoring and graceful shutdown

**Independent Test**: Server starts, accepts MCP initialization, accepts WebSocket connection, responds to health check, and shuts down gracefully

### Git Workflow - Phase Start

- [ ] T055 [GIT] Verify working tree is clean before starting Phase 3
- [ ] T056 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T057 [US1] Create retro/P3.md for this phase
- [ ] T058 [GIT] Commit: initialize phase 3 retro

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T059 [P] [US1] Contract test for server startup in tests/contract/server-startup.test.ts (use devs:typescript-dev agent)
- [ ] T060 [P] [US1] Integration test for health endpoint in tests/integration/health.test.ts (use devs:typescript-dev agent)
- [ ] T061 [GIT] Commit: add US1 tests (failing)

### Implementation for User Story 1

- [ ] T062 [US1] Create src/index.ts with HTTP server setup on configurable port (use devs:typescript-dev agent)
- [ ] T063 [GIT] Commit: add HTTP server entry point
- [ ] T064 [US1] Implement GET /health endpoint with uptime tracking in src/index.ts (use devs:typescript-dev agent)
- [ ] T065 [GIT] Commit: add health endpoint
- [ ] T066 [US1] Add SIGINT/SIGTERM handlers for graceful shutdown in src/index.ts (use devs:typescript-dev agent)
- [ ] T067 [GIT] Commit: add graceful shutdown
- [ ] T068 [US1] Verify US1 tests now pass
- [ ] T069 [GIT] Commit: verify US1 complete

### Phase 3 Wrap-Up

- [ ] T070 [US1] Run /sdd:map incremental for Phase 3 changes
- [ ] T071 [GIT] Commit: update codebase documents for phase 3
- [ ] T072 [US1] Review retro/P3.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T073 [GIT] Commit: finalize phase 3 retro

### Phase 3 Completion

- [ ] T074 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T075 [GIT] Create/update PR to main with Phase 3 summary
- [ ] T076 [GIT] Verify all CI checks pass
- [ ] T077 [GIT] Report PR ready status

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - SQLite State Management (Priority: P1)

**Goal**: Initialize SQLite database with typed interfaces, creating all tables on startup for state persistence

**Independent Test**: Fresh database creates all tables. Full session lifecycle round-trips correctly with all foreign key relationships intact.

### Git Workflow - Phase Start

- [ ] T078 [GIT] Verify working tree is clean before starting Phase 4
- [ ] T079 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T080 [US2] Create retro/P4.md for this phase
- [ ] T081 [GIT] Commit: initialize phase 4 retro

### Tests for User Story 2

- [ ] T082 [P] [US2] Integration test for database initialization in tests/integration/database-init.test.ts (use devs:typescript-dev agent)
- [ ] T083 [P] [US2] Integration test for session lifecycle in tests/integration/session-lifecycle.test.ts (use devs:typescript-dev agent)
- [ ] T084 [GIT] Commit: add US2 tests (failing)

### Implementation for User Story 2

- [ ] T085 [P] [US2] Create src/database/queries/sessions.ts with CRUD functions (use devs:typescript-dev agent)
- [ ] T086 [P] [US2] Create src/database/queries/plans.ts with CRUD functions (use devs:typescript-dev agent)
- [ ] T087 [P] [US2] Create src/database/queries/phases.ts with CRUD functions (use devs:typescript-dev agent)
- [ ] T088 [GIT] Commit: add session/plan/phase queries
- [ ] T089 [P] [US2] Create src/database/queries/hints.ts with CRUD functions (use devs:typescript-dev agent)
- [ ] T090 [P] [US2] Create src/database/queries/progress.ts with CRUD functions (use devs:typescript-dev agent)
- [ ] T091 [GIT] Commit: add hint/progress queries
- [ ] T092 [P] [US2] Create src/database/queries/dreyfus.ts with CRUD functions (use devs:typescript-dev agent)
- [ ] T093 [P] [US2] Create src/database/queries/gaps.ts with CRUD functions (use devs:typescript-dev agent)
- [ ] T094 [P] [US2] Create src/database/queries/katas.ts with CRUD functions (use devs:typescript-dev agent)
- [ ] T095 [GIT] Commit: add dreyfus/gap/kata queries
- [ ] T096 [US2] Initialize database on server startup in src/index.ts (use devs:typescript-dev agent)
- [ ] T097 [GIT] Commit: integrate database initialization
- [ ] T098 [US2] Verify US2 tests now pass
- [ ] T099 [GIT] Commit: verify US2 complete

### Phase 4 Wrap-Up

- [ ] T100 [US2] Run /sdd:map incremental for Phase 4 changes
- [ ] T101 [GIT] Commit: update codebase documents for phase 4
- [ ] T102 [US2] Review retro/P4.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T103 [GIT] Commit: finalize phase 4 retro

### Phase 4 Completion

- [ ] T104 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T105 [GIT] Create/update PR to main with Phase 4 summary
- [ ] T106 [GIT] Verify all CI checks pass
- [ ] T107 [GIT] Report PR ready status

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - File System Layer (Priority: P1)

**Goal**: Own all file I/O operations with buffer cache, diff computation, project tree scanning, and filesystem watching

**Independent Test**: Can read files, write files (Electron-only), maintain buffer cache, compute diffs, scan project tree excluding noise directories, and detect filesystem changes. Path traversal attempts are rejected.

### Git Workflow - Phase Start

- [ ] T108 [GIT] Verify working tree is clean before starting Phase 5
- [ ] T109 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T110 [US3] Create retro/P5.md for this phase
- [ ] T111 [GIT] Commit: initialize phase 5 retro

### Tests for User Story 3

- [ ] T112 [P] [US3] Unit test for path traversal rejection in tests/unit/file-system/security.test.ts (use devs:typescript-dev agent)
- [ ] T113 [P] [US3] Integration test for buffer cache in tests/integration/buffer-cache.test.ts (use devs:typescript-dev agent)
- [ ] T114 [P] [US3] Integration test for diff computation in tests/integration/diff.test.ts (use devs:typescript-dev agent)
- [ ] T115 [GIT] Commit: add US3 tests (failing)

### Implementation for User Story 3

- [ ] T116 [P] [US3] Create src/file-system/file-ops.ts with readFile and writeFile with security validation (use devs:typescript-dev agent)
- [ ] T117 [P] [US3] Create src/file-system/buffer-cache.ts with in-memory Map and BufferEntry type (use devs:typescript-dev agent)
- [ ] T118 [GIT] Commit: add file ops and buffer cache
- [ ] T119 [US3] Implement getDiff function with unified diff generation in src/file-system/file-ops.ts (use devs:typescript-dev agent)
- [ ] T120 [GIT] Commit: add diff computation
- [ ] T121 [US3] Create src/file-system/tree.ts with getProjectTree and noise filtering (use devs:typescript-dev agent)
- [ ] T122 [GIT] Commit: add project tree scanning
- [ ] T123 [US3] Create src/file-system/watcher.ts with Chokidar and event emission (use devs:typescript-dev agent)
- [ ] T124 [GIT] Commit: add file system watcher
- [ ] T125 [US3] Verify US3 tests now pass
- [ ] T126 [GIT] Commit: verify US3 complete

### Phase 5 Wrap-Up

- [ ] T127 [US3] Run /sdd:map incremental for Phase 5 changes
- [ ] T128 [GIT] Commit: update codebase documents for phase 5
- [ ] T129 [US3] Review retro/P5.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T130 [GIT] Commit: finalize phase 5 retro

### Phase 5 Completion

- [ ] T131 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T132 [GIT] Create/update PR to main with Phase 5 summary
- [ ] T133 [GIT] Verify all CI checks pass
- [ ] T134 [GIT] Report PR ready status

**Checkpoint**: File system layer complete and independently functional

---

## Phase 6: User Story 4 - Action Logging & Observability (Priority: P1)

**Goal**: Log every significant user action and Claude API call to queryable timelines for Observer signals and budget tracking

**Independent Test**: Actions logged with session_id, type, data, and timestamp. Buffer summaries logged periodically. API calls logged with cost metadata. Actions queryable by session and type.

### Git Workflow - Phase Start

- [ ] T135 [GIT] Verify working tree is clean before starting Phase 6
- [ ] T136 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T137 [US4] Create retro/P6.md for this phase
- [ ] T138 [GIT] Commit: initialize phase 6 retro

### Tests for User Story 4

- [ ] T139 [P] [US4] Integration test for action logging in tests/integration/action-log.test.ts (use devs:typescript-dev agent)
- [ ] T140 [P] [US4] Integration test for buffer summary logging in tests/integration/buffer-summary.test.ts (use devs:typescript-dev agent)
- [ ] T141 [GIT] Commit: add US4 tests (failing)

### Implementation for User Story 4

- [ ] T142 [US4] Implement logAction with 27 action types in src/logger/action-log.ts (use devs:typescript-dev agent)
- [ ] T143 [GIT] Commit: implement action logging
- [ ] T144 [US4] Add EventEmitter for Observer subscriptions in src/logger/action-log.ts (use devs:typescript-dev agent)
- [ ] T145 [GIT] Commit: add Observer event emission
- [ ] T146 [US4] Implement buffer summary timer (30s) with significant change detection in src/logger/action-log.ts (use devs:typescript-dev agent)
- [ ] T147 [GIT] Commit: add buffer summary logging
- [ ] T148 [US4] Implement logApiCall with cost estimation in src/logger/api-log.ts (use devs:typescript-dev agent)
- [ ] T149 [GIT] Commit: add API call logging
- [ ] T150 [US4] Add query functions for action timeline in src/database/queries/actions.ts (use devs:typescript-dev agent)
- [ ] T151 [GIT] Commit: add action queries
- [ ] T152 [US4] Verify US4 tests now pass
- [ ] T153 [GIT] Commit: verify US4 complete

### Phase 6 Wrap-Up

- [ ] T154 [US4] Run /sdd:map incremental for Phase 6 changes
- [ ] T155 [GIT] Commit: update codebase documents for phase 6
- [ ] T156 [US4] Review retro/P6.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T157 [GIT] Commit: finalize phase 6 retro

### Phase 6 Completion

- [ ] T158 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T159 [GIT] Create/update PR to main with Phase 6 summary
- [ ] T160 [GIT] Verify all CI checks pass
- [ ] T161 [GIT] Report PR ready status

**Checkpoint**: Action logging and observability complete

---

## Phase 7: User Story 5 - WebSocket Protocol (Priority: P1)

**Goal**: Implement typed message router dispatching all client→server WebSocket messages to handler functions with broadcast for server→client messages

**Independent Test**: Connection handshake completes. File operations dispatch correctly. Buffer updates process. Malformed JSON and unknown types handled gracefully.

### Git Workflow - Phase Start

- [ ] T162 [GIT] Verify working tree is clean before starting Phase 7
- [ ] T163 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T164 [US5] Create retro/P7.md for this phase
- [ ] T165 [GIT] Commit: initialize phase 7 retro

### Tests for User Story 5

- [ ] T166 [P] [US5] Contract test for WebSocket message types in tests/contract/websocket-protocol.test.ts (use devs:typescript-dev agent)
- [ ] T167 [P] [US5] Integration test for connection handshake in tests/integration/websocket-handshake.test.ts (use devs:typescript-dev agent)
- [ ] T168 [GIT] Commit: add US5 tests (failing)

### Implementation for User Story 5

- [ ] T169 [US5] Create src/websocket/server.ts with WebSocket upgrade on /ws (use devs:typescript-dev agent)
- [ ] T170 [GIT] Commit: add WebSocket server
- [ ] T171 [US5] Create src/websocket/router.ts with message type dispatcher (use devs:typescript-dev agent)
- [ ] T172 [GIT] Commit: add message router
- [ ] T173 [P] [US5] Create src/websocket/handlers/connection.ts for connection:hello (use devs:typescript-dev agent)
- [ ] T174 [P] [US5] Create src/websocket/handlers/file.ts for file:open, file:save (use devs:typescript-dev agent)
- [ ] T175 [P] [US5] Create src/websocket/handlers/buffer.ts for buffer:update (use devs:typescript-dev agent)
- [ ] T176 [GIT] Commit: add core WebSocket handlers
- [ ] T177 [P] [US5] Create src/websocket/handlers/editor.ts for editor:tab_switch (use devs:typescript-dev agent)
- [ ] T178 [P] [US5] Create src/websocket/handlers/hints.ts for hints:level_change (use devs:typescript-dev agent)
- [ ] T179 [P] [US5] Create src/websocket/handlers/user.ts for user:idle_start, user:idle_end (use devs:typescript-dev agent)
- [ ] T180 [GIT] Commit: add additional WebSocket handlers
- [ ] T181 [US5] Implement broadcast function for server→client messages in src/websocket/server.ts (use devs:typescript-dev agent)
- [ ] T182 [GIT] Commit: add broadcast function
- [ ] T183 [US5] Wire file watcher events to broadcast fs:tree_update in src/index.ts (use devs:typescript-dev agent)
- [ ] T184 [GIT] Commit: integrate file watcher broadcasts
- [ ] T185 [US5] Verify US5 tests now pass
- [ ] T186 [GIT] Commit: verify US5 complete

### Phase 7 Wrap-Up

- [ ] T187 [US5] Run /sdd:map incremental for Phase 7 changes
- [ ] T188 [GIT] Commit: update codebase documents for phase 7
- [ ] T189 [US5] Review retro/P7.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T190 [GIT] Commit: finalize phase 7 retro

### Phase 7 Completion

- [ ] T191 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T192 [GIT] Create/update PR to main with Phase 7 summary
- [ ] T193 [GIT] Verify all CI checks pass
- [ ] T194 [GIT] Report PR ready status

**Checkpoint**: WebSocket protocol complete and functional

---

## Phase 8: User Story 6 - MCP Tool Surface (Priority: P1)

**Goal**: Register MCP tools for session lifecycle, reading state/buffers/diffs, and controlling Electron UI

**Independent Test**: All MCP tools registered and callable. Session lifecycle tools work. Read tools return correct data. UI control tools broadcast. No file-write tools exist.

### Git Workflow - Phase Start

- [ ] T195 [GIT] Verify working tree is clean before starting Phase 8
- [ ] T196 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T197 [US6] Create retro/P8.md for this phase
- [ ] T198 [GIT] Commit: initialize phase 8 retro

### Tests for User Story 6

- [ ] T199 [P] [US6] Contract test for MCP tool schemas in tests/contract/mcp-schema.test.ts (use devs:typescript-dev agent)
- [ ] T200 [P] [US6] Integration test for MCP session lifecycle in tests/integration/mcp-lifecycle.test.ts (use devs:typescript-dev agent)
- [ ] T201 [GIT] Commit: add US6 tests (failing)

### Implementation for User Story 6

- [ ] T202 [US6] Create src/mcp/server.ts with Streamable HTTP transport on /mcp (use devs:typescript-dev agent)
- [ ] T203 [GIT] Commit: add MCP server
- [ ] T204 [US6] Create src/mcp/session.ts with active session tracking Map (use devs:typescript-dev agent)
- [ ] T205 [GIT] Commit: add MCP session management
- [ ] T206 [P] [US6] Create src/mcp/tools/lifecycle.ts with paige_start_session and paige_end_session (use devs:typescript-dev agent)
- [ ] T207 [P] [US6] Create src/mcp/tools/read.ts with paige_get_buffer, paige_get_open_files, paige_get_diff, paige_get_session_state (use devs:typescript-dev agent)
- [ ] T208 [GIT] Commit: add MCP read tools
- [ ] T209 [P] [US6] Create src/mcp/tools/ui.ts with paige_open_file, paige_highlight_lines, paige_clear_highlights (use devs:typescript-dev agent)
- [ ] T210 [P] [US6] Add paige_hint_files, paige_clear_hints to src/mcp/tools/ui.ts (use devs:typescript-dev agent)
- [ ] T211 [P] [US6] Add paige_update_phase, paige_show_message, paige_show_issue_context to src/mcp/tools/ui.ts (use devs:typescript-dev agent)
- [ ] T212 [GIT] Commit: add MCP UI control tools
- [ ] T213 [US6] Register all 12 MCP tools in src/mcp/server.ts (use devs:typescript-dev agent)
- [ ] T214 [GIT] Commit: register MCP tools
- [ ] T215 [US6] Integrate MCP server with HTTP server in src/index.ts (use devs:typescript-dev agent)
- [ ] T216 [GIT] Commit: integrate MCP server
- [ ] T217 [US6] Verify US6 tests now pass
- [ ] T218 [GIT] Commit: verify US6 complete

### Phase 8 Wrap-Up

- [ ] T219 [US6] Run /sdd:map incremental for Phase 8 changes
- [ ] T220 [GIT] Commit: update codebase documents for phase 8
- [ ] T221 [US6] Review retro/P8.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T222 [GIT] Commit: finalize phase 8 retro

### Phase 8 Completion

- [ ] T223 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T224 [GIT] Create/update PR to main with Phase 8 summary
- [ ] T225 [GIT] Verify all CI checks pass
- [ ] T226 [GIT] Report PR ready status

**Checkpoint**: All P1 stories complete - MVP is functional

---

## Phase 9: User Story 7 - Claude API Client (Priority: P2)

**Goal**: Unified API client for calling Claude with structured output parsing, logging, retry logic, and cost tracking

**Independent Test**: API calls succeed with structured output validation. Model aliases resolve. Cost tracking logs metadata. Retry logic handles failures. Special stop reasons throw appropriate errors.

### Git Workflow - Phase Start

- [ ] T227 [GIT] Verify working tree is clean before starting Phase 9
- [ ] T228 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T229 [US7] Create retro/P9.md for this phase
- [ ] T230 [GIT] Commit: initialize phase 9 retro

### Tests for User Story 7

- [ ] T231 [P] [US7] Unit test for model alias resolution in tests/unit/api-client/models.test.ts (use devs:typescript-dev agent)
- [ ] T232 [P] [US7] Integration test for API retry logic in tests/integration/api-retry.test.ts (use devs:typescript-dev agent)
- [ ] T233 [GIT] Commit: add US7 tests (failing)

### Implementation for User Story 7

- [ ] T234 [US7] Create src/api-client/models.ts with model alias resolution and pricing tables (use devs:typescript-dev agent)
- [ ] T235 [GIT] Commit: add model resolution
- [ ] T236 [US7] Create src/api-client/claude.ts with callApi function, retry logic, structured outputs (use devs:typescript-dev agent)
- [ ] T237 [GIT] Commit: add Claude API client
- [ ] T238 [US7] Add ApiRefusalError and ApiMaxTokensError custom error classes in src/api-client/claude.ts (use devs:typescript-dev agent)
- [ ] T239 [GIT] Commit: add API error types
- [ ] T240 [US7] Integrate API call logging with logApiCall in src/api-client/claude.ts (use devs:typescript-dev agent)
- [ ] T241 [GIT] Commit: integrate API logging
- [ ] T242 [US7] Verify US7 tests now pass
- [ ] T243 [GIT] Commit: verify US7 complete

### Phase 9 Wrap-Up

- [ ] T244 [US7] Run /sdd:map incremental for Phase 9 changes
- [ ] T245 [GIT] Commit: update codebase documents for phase 9
- [ ] T246 [US7] Review retro/P9.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T247 [GIT] Commit: finalize phase 9 retro

### Phase 9 Completion

- [ ] T248 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T249 [GIT] Create/update PR to main with Phase 9 summary
- [ ] T250 [GIT] Verify all CI checks pass
- [ ] T251 [GIT] Report PR ready status

**Checkpoint**: Claude API client ready for coaching features

---

## Phase 10: User Story 8 - ChromaDB Memory Integration (Priority: P2)

**Goal**: Semantic memory storage and retrieval via ChromaDB with graceful degradation when unavailable

**Independent Test**: Memories stored with content and metadata. Semantic search returns relevant results. Project filtering works. System degrades gracefully when ChromaDB unavailable.

### Git Workflow - Phase Start

- [ ] T252 [GIT] Verify working tree is clean before starting Phase 10
- [ ] T253 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T254 [US8] Create retro/P10.md for this phase
- [ ] T255 [GIT] Commit: initialize phase 10 retro

### Tests for User Story 8

- [ ] T256 [P] [US8] Integration test for memory storage and retrieval in tests/integration/chromadb.test.ts (use devs:typescript-dev agent)
- [ ] T257 [P] [US8] Integration test for graceful degradation in tests/integration/chromadb-degradation.test.ts (use devs:typescript-dev agent)
- [ ] T258 [GIT] Commit: add US8 tests (failing)

### Implementation for User Story 8

- [ ] T259 [US8] Create src/memory/chromadb.ts with ChromaDB client and lazy connection (use devs:typescript-dev agent)
- [ ] T260 [GIT] Commit: add ChromaDB client
- [ ] T261 [US8] Create src/memory/queries.ts with addMemories and queryMemories functions (use devs:typescript-dev agent)
- [ ] T262 [GIT] Commit: add memory queries
- [ ] T263 [US8] Implement isMemoryAvailable() with lazy recovery logic in src/memory/chromadb.ts (use devs:typescript-dev agent)
- [ ] T264 [GIT] Commit: add graceful degradation
- [ ] T265 [US8] Add project filtering to queryMemories in src/memory/queries.ts (use devs:typescript-dev agent)
- [ ] T266 [GIT] Commit: add project filtering
- [ ] T267 [US8] Initialize ChromaDB connection on server startup in src/index.ts (use devs:typescript-dev agent)
- [ ] T268 [GIT] Commit: integrate ChromaDB initialization
- [ ] T269 [US8] Verify US8 tests now pass
- [ ] T270 [GIT] Commit: verify US8 complete

### Phase 10 Wrap-Up

- [ ] T271 [US8] Run /sdd:map incremental for Phase 10 changes
- [ ] T272 [GIT] Commit: update codebase documents for phase 10
- [ ] T273 [US8] Review retro/P10.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T274 [GIT] Commit: finalize phase 10 retro

### Phase 10 Completion

- [ ] T275 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T276 [GIT] Create/update PR to main with Phase 10 summary
- [ ] T277 [GIT] Verify all CI checks pass
- [ ] T278 [GIT] Report PR ready status

**Checkpoint**: Semantic memory ready for coaching pipeline

---

## Phase 11: User Story 9 - Coaching Pipeline (Priority: P2)

**Goal**: Expose MCP tools for running coaching pipeline (issue → plan) and session wrap-up (reflection → gaps → Dreyfus updates)

**Independent Test**: Pipeline takes issue context, queries memories, calls Coach Agent, stores plan/phases/hints. Wrap-up calls 3 agents, stores results, adds memories. Failures handled gracefully.

### Git Workflow - Phase Start

- [ ] T279 [GIT] Verify working tree is clean before starting Phase 11
- [ ] T280 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T281 [US9] Create retro/P11.md for this phase
- [ ] T282 [GIT] Commit: initialize phase 11 retro

### Tests for User Story 9

- [ ] T283 [P] [US9] Integration test for coaching pipeline in tests/integration/coaching-pipeline.test.ts (use devs:typescript-dev agent)
- [ ] T284 [P] [US9] Integration test for session wrap-up in tests/integration/session-wrapup.test.ts (use devs:typescript-dev agent)
- [ ] T285 [GIT] Commit: add US9 tests (failing)

### Implementation for User Story 9

- [ ] T286 [US9] Create src/api-client/schemas.ts with Zod schemas for Coach, Reflection, Gap, Dreyfus agents (use devs:typescript-dev agent)
- [ ] T287 [GIT] Commit: add agent schemas
- [ ] T288 [P] [US9] Create src/coaching/agents/coach.ts with Coach Agent API call (use devs:typescript-dev agent)
- [ ] T289 [P] [US9] Create src/coaching/agents/reflection.ts with Reflection Agent API call (use devs:typescript-dev agent)
- [ ] T290 [P] [US9] Create src/coaching/agents/knowledge-gap.ts with Knowledge Gap Agent API call (use devs:typescript-dev agent)
- [ ] T291 [P] [US9] Create src/coaching/agents/dreyfus.ts with Dreyfus Agent API call (use devs:typescript-dev agent)
- [ ] T292 [GIT] Commit: add agent implementations
- [ ] T293 [US9] Create src/coaching/pipeline.ts with paige_run_coaching_pipeline MCP tool (use devs:typescript-dev agent)
- [ ] T294 [GIT] Commit: add coaching pipeline
- [ ] T295 [US9] Create src/coaching/wrap-up.ts with paige_end_session wrap-up logic (use devs:typescript-dev agent)
- [ ] T296 [GIT] Commit: add session wrap-up
- [ ] T297 [US9] Wire paige_run_coaching_pipeline to MCP tool registry in src/mcp/tools/lifecycle.ts (use devs:typescript-dev agent)
- [ ] T298 [GIT] Commit: register coaching pipeline tool
- [ ] T299 [US9] Wire paige_end_session wrap-up logic to MCP tool in src/mcp/tools/lifecycle.ts (use devs:typescript-dev agent)
- [ ] T300 [GIT] Commit: register wrap-up logic
- [ ] T301 [US9] Verify US9 tests now pass
- [ ] T302 [GIT] Commit: verify US9 complete

### Phase 11 Wrap-Up

- [ ] T303 [US9] Run /sdd:map incremental for Phase 11 changes
- [ ] T304 [GIT] Commit: update codebase documents for phase 11
- [ ] T305 [US9] Review retro/P11.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T306 [GIT] Commit: finalize phase 11 retro

### Phase 11 Completion

- [ ] T307 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T308 [GIT] Create/update PR to main with Phase 11 summary
- [ ] T309 [GIT] Verify all CI checks pass
- [ ] T310 [GIT] Report PR ready status

**Checkpoint**: Coaching pipeline complete

---

## Phase 12: User Story 10 - Observer System (Priority: P2)

**Goal**: Per-session Observer subscribing to action log events, evaluating nudges with triage model, and broadcasting nudges with cooldown suppression

**Independent Test**: Observer starts/stops with session, subscribes to events, triggers triage, delivers nudges, suppresses during cooldown/flow state, respects mute toggle.

### Git Workflow - Phase Start

- [ ] T311 [GIT] Verify working tree is clean before starting Phase 12
- [ ] T312 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T313 [US10] Create retro/P12.md for this phase
- [ ] T314 [GIT] Commit: initialize phase 12 retro

### Tests for User Story 10

- [ ] T315 [P] [US10] Integration test for Observer triage in tests/integration/observer-triage.test.ts (use devs:typescript-dev agent)
- [ ] T316 [P] [US10] Integration test for nudge suppression in tests/integration/observer-suppression.test.ts (use devs:typescript-dev agent)
- [ ] T317 [GIT] Commit: add US10 tests (failing)

### Implementation for User Story 10

- [ ] T318 [US10] Add Triage schema to src/api-client/schemas.ts (use devs:typescript-dev agent)
- [ ] T319 [GIT] Commit: add triage schema
- [ ] T320 [US10] Create src/observer/triage.ts with Haiku triage model wrapper (use devs:typescript-dev agent)
- [ ] T321 [GIT] Commit: add triage model
- [ ] T322 [US10] Create src/observer/observer.ts with Observer class (start, stop, evaluate, suppressionRules) (use devs:typescript-dev agent)
- [ ] T323 [GIT] Commit: add Observer class
- [ ] T324 [US10] Implement flow state detection in src/observer/observer.ts (use devs:typescript-dev agent)
- [ ] T325 [GIT] Commit: add flow state detection
- [ ] T326 [US10] Create src/observer/nudge.ts with nudge delivery via WebSocket broadcast (use devs:typescript-dev agent)
- [ ] T327 [GIT] Commit: add nudge delivery
- [ ] T328 [US10] Wire Observer start to paige_start_session in src/mcp/tools/lifecycle.ts (use devs:typescript-dev agent)
- [ ] T329 [GIT] Commit: integrate Observer start
- [ ] T330 [US10] Wire Observer stop to paige_end_session in src/mcp/tools/lifecycle.ts (use devs:typescript-dev agent)
- [ ] T331 [GIT] Commit: integrate Observer stop
- [ ] T332 [US10] Add observer:mute handler in src/websocket/handlers/observer.ts (use devs:typescript-dev agent)
- [ ] T333 [GIT] Commit: add mute handler
- [ ] T334 [US10] Verify US10 tests now pass
- [ ] T335 [GIT] Commit: verify US10 complete

### Phase 12 Wrap-Up

- [ ] T336 [US10] Run /sdd:map incremental for Phase 12 changes
- [ ] T337 [GIT] Commit: update codebase documents for phase 12
- [ ] T338 [US10] Review retro/P12.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T339 [GIT] Commit: finalize phase 12 retro

### Phase 12 Completion

- [ ] T340 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T341 [GIT] Create/update PR to main with Phase 12 summary
- [ ] T342 [GIT] Verify all CI checks pass
- [ ] T343 [GIT] Report PR ready status

**Checkpoint**: Observer system complete

---

## Phase 13: User Story 11 - UI-Driven API Calls (Priority: P3)

**Goal**: Handle "Explain This" (Dreyfus-aware code explanations) and "Practice Review" (kata solution review with constraint unlocking)

**Independent Test**: "Explain This" returns Dreyfus-aware explanation. "Practice Review" unlocks constraints, persists attempts, and applies same-constraint filtering.

### Git Workflow - Phase Start

- [ ] T344 [GIT] Verify working tree is clean before starting Phase 13
- [ ] T345 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T346 [US11] Create retro/P13.md for this phase
- [ ] T347 [GIT] Commit: initialize phase 13 retro

### Tests for User Story 11

- [ ] T348 [P] [US11] Integration test for Explain This in tests/integration/explain-this.test.ts (use devs:typescript-dev agent)
- [ ] T349 [P] [US11] Integration test for Practice Review in tests/integration/practice-review.test.ts (use devs:typescript-dev agent)
- [ ] T350 [GIT] Commit: add US11 tests (failing)

### Implementation for User Story 11

- [ ] T351 [US11] Add Explain and Review schemas to src/api-client/schemas.ts (use devs:typescript-dev agent)
- [ ] T352 [GIT] Commit: add UI API schemas
- [ ] T353 [US11] Create src/ui-apis/explain.ts with user:explain handler and Dreyfus-aware prompting (use devs:typescript-dev agent)
- [ ] T354 [GIT] Commit: add Explain This
- [ ] T355 [US11] Create src/ui-apis/review.ts with practice:submit_solution handler (use devs:typescript-dev agent)
- [ ] T356 [GIT] Commit: add Practice Review
- [ ] T357 [US11] Implement constraint unlocking logic in src/ui-apis/review.ts (use devs:typescript-dev agent)
- [ ] T358 [GIT] Commit: add constraint unlocking
- [ ] T359 [US11] Implement same-constraint filtering for previous attempts in src/ui-apis/review.ts (use devs:typescript-dev agent)
- [ ] T360 [GIT] Commit: add same-constraint filtering
- [ ] T361 [US11] Wire user:explain handler in src/websocket/handlers/user.ts (use devs:typescript-dev agent)
- [ ] T362 [GIT] Commit: wire Explain This handler
- [ ] T363 [US11] Wire practice:submit_solution handler in src/websocket/handlers/practice.ts (use devs:typescript-dev agent)
- [ ] T364 [GIT] Commit: wire Practice Review handler
- [ ] T365 [US11] Verify US11 tests now pass
- [ ] T366 [GIT] Commit: verify US11 complete

### Phase 13 Wrap-Up

- [ ] T367 [US11] Run /sdd:map incremental for Phase 13 changes
- [ ] T368 [GIT] Commit: update codebase documents for phase 13
- [ ] T369 [US11] Review retro/P13.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T370 [GIT] Commit: finalize phase 13 retro

### Phase 13 Completion

- [ ] T371 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T372 [GIT] Create/update PR to main with Phase 13 summary
- [ ] T373 [GIT] Verify all CI checks pass
- [ ] T374 [GIT] Report PR ready status

**Checkpoint**: UI-driven API calls complete

---

## Phase 14: User Story 12 - Dashboard Data Assembly (Priority: P3)

**Goal**: Handle dashboard:request with 4 progressive flows: immediate state, GitHub issues with suitability assessment, active katas, and web-searched learning materials

**Independent Test**: Dashboard returns immediate data (<100ms). Stats filtered by period. Issues assessed. Learning materials have real URLs. Flows handle failures gracefully.

### Git Workflow - Phase Start

- [ ] T375 [GIT] Verify working tree is clean before starting Phase 14
- [ ] T376 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T377 [US12] Create retro/P14.md for this phase
- [ ] T378 [GIT] Commit: initialize phase 14 retro

### Tests for User Story 12

- [ ] T379 [P] [US12] Integration test for dashboard immediate response in tests/integration/dashboard-immediate.test.ts (use devs:typescript-dev agent)
- [ ] T380 [P] [US12] Integration test for dashboard issues flow in tests/integration/dashboard-issues.test.ts (use devs:typescript-dev agent)
- [ ] T381 [GIT] Commit: add US12 tests (failing)

### Implementation for User Story 12

- [ ] T382 [US12] Add IssueSuitability schema to src/api-client/schemas.ts (use devs:typescript-dev agent)
- [ ] T383 [GIT] Commit: add issue suitability schema
- [ ] T384 [US12] Create src/dashboard/handler.ts with dashboard:request dispatcher (use devs:typescript-dev agent)
- [ ] T385 [GIT] Commit: add dashboard dispatcher
- [ ] T386 [P] [US12] Create src/dashboard/flows/state.ts with Dreyfus + stats assembly (use devs:typescript-dev agent)
- [ ] T387 [P] [US12] Create src/dashboard/flows/issues.ts with GitHub fetch and Haiku suitability assessment (use devs:typescript-dev agent)
- [ ] T388 [GIT] Commit: add dashboard flows (state, issues)
- [ ] T389 [P] [US12] Create src/dashboard/flows/challenges.ts with active kata loading (use devs:typescript-dev agent)
- [ ] T390 [P] [US12] Create src/dashboard/flows/learning.ts with web search for knowledge gaps (use devs:typescript-dev agent)
- [ ] T391 [GIT] Commit: add dashboard flows (challenges, learning)
- [ ] T392 [US12] Wire dashboard:request handler in src/websocket/handlers/dashboard.ts (use devs:typescript-dev agent)
- [ ] T393 [GIT] Commit: wire dashboard handler
- [ ] T394 [US12] Wire dashboard:refresh_issues handler in src/websocket/handlers/dashboard.ts (use devs:typescript-dev agent)
- [ ] T395 [GIT] Commit: wire dashboard refresh handler
- [ ] T396 [US12] Verify US12 tests now pass
- [ ] T397 [GIT] Commit: verify US12 complete

### Phase 14 Wrap-Up

- [ ] T398 [US12] Run /sdd:map incremental for Phase 14 changes
- [ ] T399 [GIT] Commit: update codebase documents for phase 14
- [ ] T400 [US12] Review retro/P14.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T401 [GIT] Commit: finalize phase 14 retro

### Phase 14 Completion

- [ ] T402 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T403 [GIT] Create/update PR to main with Phase 14 summary
- [ ] T404 [GIT] Verify all CI checks pass
- [ ] T405 [GIT] Report PR ready status

**Checkpoint**: All user stories complete

---

## Phase 15: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Git Workflow - Phase Start

- [ ] T406 [GIT] Verify working tree is clean before starting Phase 15
- [ ] T407 [GIT] Pull and rebase on origin/main if needed

### Retro Initialization

- [ ] T408 Create retro/P15.md for this phase
- [ ] T409 [GIT] Commit: initialize phase 15 retro

### Polish Tasks

- [ ] T410 [P] Run quickstart.md validation (verify all setup steps work)
- [ ] T411 [P] Add missing JSDoc comments to public API functions (use devs:typescript-dev agent)
- [ ] T412 [P] Review all error messages for clarity and actionability
- [ ] T413 [GIT] Commit: documentation and error message polish
- [ ] T414 [P] Review logging levels (info vs warn vs error)
- [ ] T415 [P] Add startup banner with ASCII art and version info
- [ ] T416 [GIT] Commit: logging improvements
- [ ] T417 [P] Run full test suite with coverage report
- [ ] T418 [P] Add any missing edge case tests identified in coverage
- [ ] T419 [GIT] Commit: test coverage improvements
- [ ] T420 [P] Performance profiling of hot paths (buffer updates, action logging)
- [ ] T421 [P] Optimize any identified bottlenecks
- [ ] T422 [GIT] Commit: performance optimizations
- [ ] T423 Final code review pass for TypeScript strict mode compliance
- [ ] T424 [GIT] Commit: final strict mode fixes

### Phase 15 Wrap-Up

- [ ] T425 Run /sdd:map incremental for Phase 15 changes
- [ ] T426 [GIT] Commit: update codebase documents for phase 15
- [ ] T427 Review retro/P15.md and extract critical learnings to CLAUDE.md (conservative)
- [ ] T428 [GIT] Commit: finalize phase 15 retro

### Phase 15 Completion

- [ ] T429 [GIT] Push branch to origin (ensure pre-push hooks pass)
- [ ] T430 [GIT] Create/update PR to main with Phase 15 summary
- [ ] T431 [GIT] Verify all CI checks pass
- [ ] T432 [GIT] Report PR ready status

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1-6 (P1, Phases 3-8)**: All depend on Foundational phase completion
  - These are tightly coupled P1 stories that build on each other
  - Recommended order: US1 → US2 → US3 → US4 → US5 → US6
- **User Story 7-10 (P2, Phases 9-12)**: Depend on P1 stories, especially US1-US6
  - US7 (API Client) blocks US9, US10, US11, US12
  - US8 (ChromaDB) blocks US9
  - Can proceed after P1 complete
- **User Story 11-12 (P3, Phases 13-14)**: Depend on US7, optional enhancements
  - Can be implemented in parallel
  - Can be deferred for MVP
- **Polish (Phase 15)**: Depends on all desired user stories being complete

### User Story Dependencies

**P1 Stories (Foundational - Sequential)**:
- US1 → US2 → US3 → US4 → US5 → US6 (build on each other)

**P2 Stories (Intelligence - After P1)**:
- US7: No story dependencies (needs US1 for server)
- US8: No story dependencies (needs US1 for server)
- US9: Depends on US7 + US8
- US10: Depends on US4 + US7

**P3 Stories (Polish - After P2)**:
- US11: Depends on US7 + US2
- US12: Depends on US7 + US2 + US3

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Setup/infrastructure before business logic
- Core implementation before integration
- Verify tests pass before marking story complete

### Parallel Opportunities

- Phase 1 Setup: Tasks T010, T014, T015 can run in parallel
- Phase 2 Foundational: Tasks T035-T036, T037-T038, T040-T041 can run in parallel within their groups
- Within each user story: Most model/handler creation tasks marked [P] can run in parallel
- After P1 complete: US7 and US8 can be worked on in parallel
- After US7 complete: US11 and US12 can be worked on in parallel

---

## Parallel Example: User Story 5

```bash
# Launch WebSocket handler creation in parallel:
Task T173: "Create src/websocket/handlers/connection.ts" (use devs:typescript-dev agent)
Task T174: "Create src/websocket/handlers/file.ts" (use devs:typescript-dev agent)
Task T175: "Create src/websocket/handlers/buffer.ts" (use devs:typescript-dev agent)

# Then launch next batch:
Task T177: "Create src/websocket/handlers/editor.ts" (use devs:typescript-dev agent)
Task T178: "Create src/websocket/handlers/hints.ts" (use devs:typescript-dev agent)
Task T179: "Create src/websocket/handlers/user.ts" (use devs:typescript-dev agent)
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup (T001-T028)
2. Complete Phase 2: Foundational (T029-T054) - CRITICAL
3. Complete Phases 3-8: User Stories 1-6 (T055-T226)
4. **STOP and VALIDATE**: Test all P1 stories work together
5. MVP is functional - can demo core server capabilities

### Incremental Delivery

1. **Foundation** (Phases 1-2) → Project structure ready
2. **P1 Stories** (Phases 3-8) → MVP ready for demo
3. **P2 Stories** (Phases 9-12) → AI intelligence added
4. **P3 Stories** (Phases 13-14) → UX polish complete
5. **Polish** (Phase 15) → Production-ready

Each phase adds value without breaking previous work.

### Parallel Team Strategy

With multiple developers (or agents):

1. Team completes Setup + Foundational together (Phases 1-2)
2. P1 Stories (sequential due to tight coupling):
   - Complete US1-US6 in order
3. P2 Stories (can parallelize after P1):
   - Developer A: US7 (API Client)
   - Developer B: US8 (ChromaDB)
   - Then both work on US9, US10
4. P3 Stories (fully parallel):
   - Developer A: US11 (UI APIs)
   - Developer B: US12 (Dashboard)

---

## Task Summary

**Total Tasks**: 432
- Phase 1 (Setup): 28 tasks
- Phase 2 (Foundational): 26 tasks
- Phase 3 (US1): 23 tasks
- Phase 4 (US2): 30 tasks
- Phase 5 (US3): 27 tasks
- Phase 6 (US4): 27 tasks
- Phase 7 (US5): 33 tasks
- Phase 8 (US6): 32 tasks
- Phase 9 (US7): 25 tasks
- Phase 10 (US8): 27 tasks
- Phase 11 (US9): 32 tasks
- Phase 12 (US10): 33 tasks
- Phase 13 (US11): 31 tasks
- Phase 14 (US12): 31 tasks
- Phase 15 (Polish): 27 tasks

**Git Workflow Tasks**: 105 (branch creation, commits, PRs)
**Test Tasks**: 42 (happy path tests for each story)
**Implementation Tasks**: 285 (actual code)

**Suggested MVP Scope**: Phases 1-8 (P1 stories) = 226 tasks
**Full Feature Scope**: All phases = 432 tasks

---

## Notes

- **[P]** = Parallel-safe (different files, no dependencies)
- **[US#]** = User story label for traceability
- **[GIT]** = Git workflow task
- All tasks follow strict checklist format per constitution
- Git commits after each logical unit of work
- PR created and CI verified at end of each phase
- Tests written first, must fail before implementation
- Agent references guide execution to tech-specific agents
- Retro documentation captures learnings per phase
- Codebase mapping keeps docs accurate during implementation
