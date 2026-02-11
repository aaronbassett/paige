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

# Implementation Plan: Backend Server

**Branch**: `002-backend-server` | **Date**: 2026-02-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-backend-server/spec.md`

**Note**: This template is filled in by the `/sdd:plan` command. See plugins/sdd/commands/plan.md for the execution workflow.

## Summary

The Paige backend server is the central nervous system of a three-tier AI coaching application, serving as the single source of truth for all state, file I/O, Claude API calls, and action logging. It simultaneously serves two consumers: Claude Code (via MCP Streamable HTTP) for coaching tool calls, and Electron UI (via WebSocket) for real-time bidirectional communication. The server implements 12 core features spanning server foundation, database state management, file system operations, action logging, WebSocket protocol, MCP tool surface, Claude API client, ChromaDB memory, coaching pipeline, Observer system, UI-driven APIs, and dashboard data assembly.

## Technical Context

**Language/Version**: TypeScript on Node.js 18+
**Primary Dependencies**:
- `@modelcontextprotocol/sdk` (MCP Streamable HTTP transport)
- `better-sqlite3` (SQLite with typed Kysely interface)
- `kysely` (type-safe SQL query builder)
- `ws` (WebSocket server)
- `chokidar` (file system watcher)
- `zod` (runtime schema validation for Claude API structured outputs)
- `@anthropic-ai/sdk` (Claude API client)
- `chromadb` (vector database client for semantic memory)

**Storage**:
- SQLite at `{DATA_DIR}/paige.db` (10 tables: sessions, plans, phases, phase_hints, progress_events, dreyfus_assessments, knowledge_gaps, kata_specs, action_log, api_call_log)
- ChromaDB at `localhost:8000` (paige_memories collection)
- In-memory: buffer cache (Map), open files (Set), WebSocket connections (Map), MCP sessions (Map)

**Testing**: Vitest (fast, ESM-native, TypeScript-first)

**Target Platform**: Node.js 18+ server (macOS for hackathon, cross-platform capable)

**Project Type**: Single backend server (no frontend in this worktree)

**Performance Goals**:
- Server startup: <2 seconds
- MCP tool calls: <50ms (read ops), <200ms (UI broadcasts)
- Dashboard immediate response: <100ms
- WebSocket message latency: <10ms

**Constraints**:
- Single source of truth: Backend owns all state, all file I/O, all logging
- Read-only MCP surface: No file-write tools exposed to Claude Code
- Single-user workload: No multi-tenant support, no horizontal scaling
- WAL mode SQLite: Concurrent reads, serialized writes
- Graceful ChromaDB degradation: Server operates if ChromaDB unavailable

**Scale/Scope**:
- Single developer, single project directory, single active session
- 12 user stories (P1: Stories 1-6, P2: Stories 7-10, P3: Stories 11-12)
- 186 functional requirements (FR-001 through FR-186)
- 91 success criteria (SC-001 through SC-091)
- 27 comprehensive edge cases

## Session Initialization & Enforcement

**Session Lifecycle**:
- Claude Code plugin hooks (SessionStart, SessionEnd) call `paige_start_session` and `paige_end_session` MCP tools
- **Single Active Session Rule**: Only one coaching session can be active at a time (enforced by backend state)

**Initialization Flow**:
1. Claude Code PTY starts → SessionStart hook fires
2. Plugin calls `paige_start_session({ project_dir: PROJECT_DIR })` via MCP
3. Backend validates:
   - `project_dir` exists on filesystem (exit with error if not)
   - No existing active session (exit with error if one exists: "Active session already running. End current session first.")
4. Backend creates session row in SQLite with `status: 'active'`
5. Backend returns session metadata to plugin: `{ sessionId, project_dir, started_at }`
6. Active session ID is stored in backend in-memory state (`Map<sessionId, Session>`)

**Enforcement Mechanisms**:
- **Database Constraint**: No UNIQUE constraint (allows multiple completed sessions). Enforced at application level.
- **Application Validation**: `paige_start_session` checks for existing active session before creating new one
- **Error Handling**: If active session exists, MCP tool returns error: `{ error: "ACTIVE_SESSION_EXISTS", message: "..." }`

**Crash Recovery**:
- If Claude Code PTY crashes, backend session remains `status: 'active'` (orphaned)
- On next `paige_start_session`, plugin can pass `force: true` flag to:
  - Mark orphaned session as `status: 'completed_with_errors'`
  - Create new session
- Alternatively: Add MCP tool `paige_get_active_session()` for plugin to check state on startup

**Design Decision**: Application-level enforcement (not database constraint) provides flexibility for crash recovery and manual session cleanup without breaking database integrity.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principles

| Principle | Status | Evidence/Notes |
|-----------|--------|----------------|
| **I. Read-Only Is Sacred** | ✅ PASS | MCP surface exposes NO file-write tools (spec Story 6, FR-063+). Only Electron can request writes via WebSocket. |
| **II. Demo-First Development** | ✅ PASS | All 12 stories are demo-visible. Prioritization explicit (P1: foundation, P2: intelligence, P3: UX polish). |
| **III. KISS** | ✅ PASS | Flat architecture (HTTP server + SQLite + ChromaDB). No microservices, no complex patterns. Single process. |
| **IV. YAGNI** | ✅ PASS | No auth, no multi-tenant, no deployment, no i18n. Heuristic Dreyfus (not full automation). Hackathon-scoped. |
| **V. Three-Tier Separation** | ✅ PASS | Backend owns state/I/O. Protocols defined (MCP Streamable HTTP, WebSocket). No UI rendering, no direct FS access by plugin. |
| **VI. Leverage Existing Components** | ✅ PASS | Uses all recommended: MCP SDK, better-sqlite3, ChromaDB, gh CLI. No custom implementations of standard components. |
| **VII. Contract-Driven Integration** | ✅ PASS | MCP tool schemas (12 tools, spec Appendix F) and WebSocket message types (55 types, spec Appendix E) fully specified. |
| **VIII. Backend Is Single Source of Truth** | ✅ PASS | Core design principle. All state, file I/O, logging flows through backend. If backend doesn't know it, it didn't happen. |
| **IX. Observable by Default** | ✅ PASS | Action logging (27 types, spec Story 4), API call logging, buffer summaries, EventEmitter for Observer. |
| **X. Predictable UX** | N/A | Backend has no UI. Relevant for Electron tier only. |

### Development Standards

| Standard | Status | Verification Plan |
|----------|--------|-------------------|
| **Testing** | ⚠️ NEEDS VERIFICATION | Phase 0: Select test framework (Vitest). Phase 2: Set up test runner, write 12 happy path tests (one per story). |
| **Error Handling** | ✅ PASS | Spec includes 27 comprehensive edge cases (Appendix M). Fail-fast with context is design pattern throughout. |
| **Code Style** | ⚠️ NEEDS VERIFICATION | Phase 2: Confirm `tsconfig.json` has `strict: true`, set up ESLint + Prettier, configure pre-commit hooks. |
| **Commit Discipline** | ✅ PASS | Using conventional commits per constitution. Format: `type(scope): subject`. Max 300 chars. |

### Summary

**Pre-Phase 0**: 2 warnings require verification/resolution before proceeding:
1. Testing framework selection and happy path test infrastructure
2. TypeScript strict mode + linting + formatting setup

**No blocking violations.** Proceed to Phase 0 research.

## Project Structure

### Documentation (this feature)

```text
specs/002-backend-server/
├── plan.md              # This file (/sdd:plan command output)
├── research.md          # Phase 0 output (/sdd:plan command)
├── data-model.md        # Phase 1 output (/sdd:plan command)
├── quickstart.md        # Phase 1 output (/sdd:plan command)
├── contracts/           # Phase 1 output (/sdd:plan command)
│   ├── mcp-tools.json   # 12 MCP tool schemas
│   └── websocket.json   # 55 WebSocket message types
└── tasks.md             # Phase 2 output (/sdd:tasks command - NOT created by /sdd:plan)
```

### Source Code (repository root)

```text
src/
├── index.ts             # Entry point: HTTP server + MCP + WebSocket
├── config/
│   └── env.ts           # Environment validation (PORT, PROJECT_DIR, ANTHROPIC_API_KEY, DATA_DIR)
├── database/
│   ├── db.ts            # Kysely setup, WAL mode, table type definitions
│   ├── migrations/      # CREATE TABLE IF NOT EXISTS scripts
│   └── queries/         # Typed CRUD functions (sessions, plans, phases, hints, etc.)
├── file-system/
│   ├── buffer-cache.ts  # In-memory Map<path, BufferEntry> | Eviction: on session end, no TTL (persists during session)
│   ├── file-ops.ts      # readFile, writeFile, getDiff
│   ├── watcher.ts       # Chokidar file watching with event emission
│   └── tree.ts          # getProjectTree with noise filtering
├── logger/
│   ├── action-log.ts    # logAction, EventEmitter for Observer, buffer summary logic
│   └── api-log.ts       # logApiCall with cost tracking
├── mcp/
│   ├── server.ts        # MCP Streamable HTTP transport on /mcp
│   ├── tools/           # 12 MCP tool implementations
│   │   ├── lifecycle.ts # paige_start_session, paige_end_session
│   │   ├── read.ts      # paige_get_buffer, paige_get_open_files, paige_get_diff, paige_get_session_state
│   │   └── ui.ts        # paige_open_file, paige_highlight_lines, paige_clear_highlights, paige_hint_files, paige_clear_hints, paige_update_phase, paige_show_message, paige_show_issue_context
│   └── session.ts       # Active session tracking (Map<sessionId, Session>)
├── websocket/
│   ├── server.ts        # WebSocket upgrade on /ws, connection tracking
│   ├── router.ts        # Message type dispatcher to handlers
│   └── handlers/        # 23 client→server message handlers
│       ├── connection.ts  # connection:hello
│       ├── file.ts        # file:open, file:save
│       ├── buffer.ts      # buffer:update
│       ├── editor.ts      # editor:tab_switch, etc.
│       ├── hints.ts       # hints:level_change
│       ├── user.ts        # user:idle_start, user:idle_end, user:explain
│       ├── observer.ts    # observer:mute
│       ├── practice.ts    # practice:submit_solution
│       └── dashboard.ts   # dashboard:request, dashboard:refresh_issues
├── api-client/
│   ├── claude.ts        # Unified callApi with retries, structured outputs, logging
│   ├── schemas.ts       # Zod schemas for Coach, Reflection, Gap, Dreyfus, Triage, Explain, Review, IssueSuitability
│   └── models.ts        # Model alias resolution (sonnet, haiku) + pricing tables
├── memory/
│   ├── chromadb.ts      # ChromaDB client with lazy recovery, isMemoryAvailable
│   └── queries.ts       # addMemories, queryMemories with project filtering
├── coaching/
│   ├── pipeline.ts      # paige_run_coaching_pipeline MCP tool implementation
│   ├── wrap-up.ts       # paige_end_session MCP tool implementation
│   └── agents/          # Agent-specific API call wrappers
│       ├── coach.ts       # Issue → Plan transformation
│       ├── reflection.ts  # Session → Memories
│       ├── knowledge-gap.ts # Session → Gaps + Katas
│       └── dreyfus.ts     # Session → Assessments
├── observer/
│   ├── observer.ts      # Per-session Observer class (start, stop, evaluate, suppressionRules)
│   ├── triage.ts        # Haiku triage model wrapper
│   └── nudge.ts         # Nudge delivery via WebSocket → PTY injection
├── ui-apis/
│   ├── explain.ts       # user:explain handler → Dedicated Sonnet call with Dreyfus-aware prompting (loads assessments, injects into system prompt)
│   └── review.ts        # practice:submit_solution handler → Sonnet with kata context
├── dashboard/
│   ├── handler.ts       # dashboard:request dispatcher (immediate + 3 async flows)
│   └── flows/           # Progressive loading flows
│       ├── state.ts       # Dreyfus + stats
│       ├── issues.ts      # GitHub + Haiku suitability assessment
│       ├── challenges.ts  # Active katas
│       └── learning.ts    # Web-searched learning materials
└── types/
    ├── websocket.ts     # 55 WebSocket message type definitions
    ├── mcp.ts           # MCP tool parameter/return types
    └── domain.ts        # Sessions, Plans, Phases, Hints, Gaps, Katas, Actions

tests/
├── unit/                # Fast, isolated tests (no I/O, mocked dependencies)
│   ├── database/
│   ├── file-system/
│   ├── logger/
│   └── api-client/
├── integration/         # Multi-module tests (real SQLite, real file system)
│   ├── mcp-tools/
│   ├── websocket/
│   └── coaching/
└── contract/            # Protocol conformance tests
    ├── mcp-schema.test.ts      # Validate MCP tool schemas match spec
    └── websocket-protocol.test.ts # Validate WebSocket messages match spec
```

**Structure Decision**: Single backend project structure (Option 1 from template). This worktree contains ONLY the backend server. Frontend (Electron) and plugin (Claude Code) are separate worktrees. Backend is self-contained with all dependencies, state management, and API surfaces (MCP + WebSocket). Structure groups by technical concern (database, file-system, mcp, websocket, etc.) rather than by feature, enabling clear separation of responsibilities and testability.

### Key Implementation Details

**Buffer Cache Eviction Policy** (`src/file-system/buffer-cache.ts`):
- **Creation**: Buffer entries created on first `buffer:update` message from Electron
- **Persistence**: Buffers persist for entire session duration (no TTL, no LRU eviction)
- **Removal**: Cleared on session end (`paige_end_session`) or explicit file close
- **Dirty State**: In-memory only (not persisted to SQLite). On server restart, all buffers reloaded with `dirty: false`
- **Rationale**: Simplicity for MVP. Single-user workload, small file count (<100 concurrent edits). Post-MVP: add LRU eviction if memory pressure observed.

**Explain This Implementation** (`src/ui-apis/explain.ts`):
- **Responsibility**: Dedicated Sonnet API call wrapper (NOT inline in WebSocket handler)
- **Process**:
  1. Load Dreyfus assessments from database
  2. Build Dreyfus-aware system prompt (Novice → high-level concepts, Expert → architecture/trade-offs)
  3. Inject current phase context if active (connects explanation to coaching goal)
  4. Call Sonnet with structured output schema: `{ explanation: string, phaseConnection?: string }`
  5. Log call to `api_call_log` with type `"explain_this"`
- **Rationale**: Separate agent class enables unit testing of Dreyfus prompt injection logic independent of WebSocket handling

**Web Search Service Decision** (`src/dashboard/flows/learning.ts`):
- **Decision**: **DEFERRED to post-MVP** (P3 story, not critical for demo)
- **Alternatives Evaluated**:
  - Option A: `@google/search` (requires API key, reliable)
  - Option B: `bing-search-api-unofficial` (no key, less reliable)
  - Option C: Static learning materials database (hardcoded resources by topic)
- **MVP Approach**: Use **Option C** (static database) to demonstrate feature without external API dependency
- **Implementation**: Create `learning-materials.json` mapping knowledge gap topics → curated resource URLs
- **Future**: Add real web search when API key management infrastructure exists

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**No violations**. All constitution gates passed. Two warnings (testing framework selection, TypeScript strict mode setup) are resolvable during Phase 0 and Phase 2 respectively.

---

## Implementation Phases

### Phase 0: Research & Technology Decisions ✅ COMPLETE

**Output**: `research.md` with 10 research questions resolved

**Key Decisions**:
1. **Testing**: Vitest with 3-tier strategy (unit → integration → contract)
2. **TypeScript**: Full strict mode with `noUncheckedIndexedAccess`
3. **Linting**: ESLint + Prettier with pre-commit hooks
4. **MCP**: Streamable HTTP with stateful sessions
5. **Database**: Kysely + better-sqlite3 with WAL mode
6. **WebSocket**: Discriminated unions with type-safe router
7. **ChromaDB**: Lazy connection with graceful degradation
8. **Errors**: Custom error classes, fail-fast validation
9. **Retries**: Exponential backoff with jitter for transient failures

### Phase 1: Design & Contracts ✅ COMPLETE

**Output**: `data-model.md`, `contracts/`, `quickstart.md`, updated `CLAUDE.md`

**Artifacts Created**:
1. **data-model.md**: 10 database tables with relationships, indexes, and validation rules
2. **contracts/mcp-tools.json**: 12 MCP tool schemas with input/output definitions
3. **contracts/websocket.json**: 55 WebSocket message types (23 client→server, 32 server→client)
4. **quickstart.md**: Setup guide, commands, integration instructions, troubleshooting
5. **CLAUDE.md**: Updated with tech stack, development commands, file structure, recent changes

### Phase 2: Local Development Environment Setup ⏭️ DEFERRED

**Status**: Deferred until implementation begins

**Reason**: No source code exists yet (no `package.json`, no `src/`, no `tests/`). Local development environment setup (Vitest config, tsconfig.json, ESLint, Prettier, pre-commit hooks) will occur during implementation as part of `/sdd:tasks` execution.

**When to Execute**: After running `/sdd:tasks` to generate tasks.md, the first implementation tasks will set up:
- `package.json` with dependencies and scripts
- `tsconfig.json` with strict mode configuration
- `vitest.config.ts` for testing
- `.eslintrc.json` and `.prettierrc.json` for linting/formatting
- `husky` + `lint-staged` for pre-commit hooks
- `.env.example` template for environment variables

**Validation Gates** (to check during implementation):
- [ ] `tsconfig.json` has `strict: true` and `noUncheckedIndexedAccess: true`
- [ ] ESLint configured with `@typescript-eslint/recommended-requiring-type-checking`
- [ ] Prettier configured and integrated with ESLint
- [ ] Pre-commit hooks reject code with warnings
- [ ] Vitest configured for unit/integration/contract test separation
- [ ] 12 happy path tests (one per user story) passing

---

## Next Steps

1. **Generate Tasks**: Run `/sdd:tasks` to create `tasks.md` with dependency-ordered implementation tasks
2. **Begin Implementation**: Execute tasks starting with project setup (package.json, tsconfig, tooling)
3. **Verify Constitution Compliance**: After initial setup, re-check Development Standards gates (strict mode, linting, testing)
4. **Iterative Development**: Implement 12 user stories in priority order (P1 → P2 → P3)
5. **Integration Testing**: Verify each story with its happy path test before proceeding to next
6. **Demo Preparation**: Follow `docs/planning/initial-brainstorm.md` demo script once all P1 stories complete

## Planning History

**2026-02-11** - Initial plan created via `/sdd:plan`
- Pre-Phase: No previous retros found (first feature)
- Phase 0: Research completed (10 questions resolved)
- Phase 1: Design artifacts generated (data model, contracts, quickstart, CLAUDE.md)
- Phase 2: Deferred until implementation begins
- Constitution Check: All principles passed, 2 warnings noted for Phase 2 validation
