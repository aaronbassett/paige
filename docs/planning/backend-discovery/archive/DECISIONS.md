# Decision Log: backend-server

*Chronological record of all decisions made during discovery.*

---

[Decision entries will be added as decisions are made]

## D1: All API call types in scope — 2026-02-10

**Context**: Deciding MVP cut line for backend API calls

**Question**: Which of the 10 brainstormed API call types are in scope?

**Options Considered**:
1. MVP subset only; 2. All 10 API call types

**Decision**: All 10 API call types are in scope — aim for the moon

**Rationale**: Hackathon strategy: build everything, polish what the camera sees

**Implications**:
Larger implementation surface but complete coaching pipeline

**Stories Affected**: [Stories not specified]

**Related Questions**: [Questions not specified]

---

## D2: Claude Code triggers coaching pipeline via MCP — 2026-02-10

**Context**: Deciding where coaching pipeline orchestration lives

**Question**: Who triggers the Explore → Plan → Coach sequence?

**Options Considered**:
1. Backend orchestrates entire pipeline; 2. Claude Code drives Explore/Plan, triggers Coach via MCP; 3. Plugin drives everything

**Decision**: Claude Code runs Explore/Plan (needs tool access), then triggers Coach Agent via MCP tool call. Backend makes the Sonnet API call and returns phased guidance.

**Rationale**: Clean separation: Claude Code handles tool-using agents, backend handles evaluative API calls. User interaction starts and stays in xterm.js — even clicking an issue submits a prompt to Claude Code.

**Implications**:
MCP surface needs a trigger_coaching or similar tool. Backend receives plan output as input, returns phases.

**Stories Affected**: [Stories not specified]

**Related Questions**: [Questions not specified]

---

## D3: ChromaDB stays with TypeScript SDK, manual server — 2026-02-10

**Context**: Deciding whether to keep ChromaDB or simplify memory to SQLite-only

**Question**: Is ChromaDB a hard requirement or can semantic memory be simplified?

**Options Considered**:
1. SQLite-only (simpler); 2. ChromaDB with TypeScript SDK (full semantic search); 3. ChromaDB with Python SDK

**Decision**: Keep ChromaDB. Use the TypeScript SDK (chromadb npm package) for integration. ChromaDB server is started/stopped manually in a separate terminal for the demo.

**Rationale**: Semantic memory (this is like last week) is a key demo moment. TypeScript SDK keeps the stack uniform. Manual server management is acceptable for a hackathon.

**Implications**:
Backend needs ChromaDB connection handling with graceful degradation if server is unreachable. No need for process management infrastructure.

**Stories Affected**: [Stories not specified]

**Related Questions**: [Questions not specified]

---

## D4: 12-story structure with dependency ordering — 2026-02-10

**Context**: Crystallizing proto-themes into numbered stories with priorities

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: 12 stories confirmed: Action Logging is standalone (not cross-cutting), WebSocket before MCP in priority order, Dashboard and UI-Driven API Calls remain separate stories.

**Rationale**: Action Logging has its own schema, interfaces, and testing surface. Keeping Dashboard separate from UI-Driven calls gives clarity on the progressive loading flow vs individual feature API calls.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 1, Story 2, Story 3, Story 4, Story 5, Story 6, Story 7, Story 8, Story 9, Story 10, Story 11, Story 12

**Related Questions**: [Questions not specified]

---

## D5: Single HTTP server with path-based routing — 2026-02-10

**Context**: Deciding whether MCP SSE and WebSocket run on same or separate ports

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Single HTTP server. MCP SSE on one path, WebSocket upgrade on another. One port to configure.

**Rationale**: Simpler configuration, simpler startup, KISS.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 1

**Related Questions**: [Questions not specified]

---

## D6: Hono as HTTP framework for MCP SSE transport — 2026-02-10

**Context**: Choosing HTTP framework — brainstorm said Fastify/Express but MCP SDK now recommends Hono

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Use Hono as the HTTP framework. Current MCP TypeScript SDK recommendation.

**Rationale**: Follow SDK ecosystem recommendations for best compatibility.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 1

**Related Questions**: [Questions not specified]

---

## D7: Environment variables for configuration — 2026-02-10

**Context**: Deciding configuration approach for hackathon

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Use .env file with environment variables. No config files, no CLI arg parsing.

**Rationale**: YAGNI. .env is simple, well-understood, and sufficient for a hackathon.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 1

**Related Questions**: [Questions not specified]

---

## D8: .mcp.json is Claude Plugin responsibility, not backend — 2026-02-10

**Context**: Deciding who owns the .mcp.json that Claude Code reads

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: .mcp.json lives in the Claude Code plugin tier. The backend server does not generate or manage it.

**Rationale**: Three-tier separation: the plugin owns its own configuration for connecting to the backend.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 1, Story 6

**Related Questions**: [Questions not specified]

---

## D9: Streamable HTTP replaces SSE for MCP transport — 2026-02-10

**Context**: Brainstorm says SSE but MCP SDK has deprecated SSE in favour of Streamable HTTP since SDK v1.10.0 (April 2025). The @modelcontextprotocol/hono package uses WebStandardStreamableHTTPServerTransport.

**Question**: Should we use the deprecated SSE transport or the current Streamable HTTP?

**Options Considered**:
1. SSE (deprecated, brainstorm says this); 2. Streamable HTTP (SDK recommended, Hono adapter built for it)

**Decision**: Use Streamable HTTP transport via @modelcontextprotocol/hono. The brainstorm's references to SSE are outdated.

**Rationale**: SDK recommendation. Hono adapter (createMcpHonoApp) is built for Streamable HTTP. SSE is deprecated. Claude Code client supports Streamable HTTP.

**Implications**:
Routes: POST /mcp (requests), GET /mcp (notifications stream), DELETE /mcp (session end). Transport class: WebStandardStreamableHTTPServerTransport. Packages: @modelcontextprotocol/server, @modelcontextprotocol/hono, hono, @hono/node-server.

**Stories Affected**: Story 1, Story 6

**Related Questions**: [Questions not specified]

---

## D10: Stateful MCP sessions — 2026-02-10

**Context**: Choosing between stateless and stateful MCP session management

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Use stateful sessions with session IDs. Associates MCP tool calls with coaching sessions.

**Rationale**: We need to track which session a tool call belongs to for state management and logging.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 1

**Related Questions**: [Questions not specified]

---

## D11: Environment variables for server configuration — 2026-02-10

**Context**: Defining the .env configuration surface

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: PORT (default 3000), PROJECT_DIR (required), CHROMADB_URL (default http://localhost:8000), ANTHROPIC_API_KEY (required), DATA_DIR (default ~/.paige/)

**Rationale**: Minimal set covering all external dependencies. Defaults where sensible, required where not.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 1

**Related Questions**: [Questions not specified]

---

## D12: Use @hono/node-ws for WebSocket — 2026-02-10

**Context**: Choosing between hono/ws (with @hono/node-ws adapter) vs raw ws package

**Question**: Should we use hono/ws or raw ws for the WebSocket server?

**Options Considered**:
1. @hono/node-ws (Hono-native, clean integration); 2. Raw ws package (more control, more boilerplate)

**Decision**: Use @hono/node-ws. Provides full lifecycle control (onOpen/onMessage/onClose/onError), raw WebSocket access, path-based routing, and clean coexistence with MCP routes.

**Rationale**: Meets all requirements (typed JSON messages, connection tracking, broadcast). Integrates natively with Hono app. Less boilerplate than raw ws.

**Implications**:
Additional packages: @hono/node-ws, @hono/node-server. WebSocket upgrade requires injectWebSocket(server) call after serve().

**Stories Affected**: Story 1, Story 5

**Related Questions**: [Questions not specified]

---

## D13: Kysely as query builder for SQLite — 2026-02-11

**Context**: Choosing between raw better-sqlite3, Kysely, or Drizzle for SQLite access

**Question**: ORM or raw SQL?

**Options Considered**:
1. Raw better-sqlite3; 2. Kysely (typed query builder); 3. Drizzle (ORM)

**Decision**: Use Kysely with better-sqlite3 dialect. Typed queries without ORM overhead.

**Rationale**: TypeScript strict mode requires type safety. Kysely gives typed SQL queries without the complexity of a full ORM. Lighter weight than Drizzle for a hackathon.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 2

**Related Questions**: [Questions not specified]

---

## D14: Separate tables for hierarchical data — 2026-02-11

**Context**: Deciding schema granularity for plans/phases and other hierarchical entities

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Use separate tables with foreign keys. Phases get their own table with FK to plans. Same for hints, knowledge gaps, etc.

**Rationale**: Separate tables are more queryable, which benefits the Observer, Dreyfus assessment, and action logging stories that need to query across entities.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 2

**Related Questions**: [Questions not specified]

---

## D15: CREATE TABLE IF NOT EXISTS for schema migration — 2026-02-11

**Context**: Choosing migration strategy for hackathon

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Simple approach: CREATE TABLE IF NOT EXISTS on startup. No migration framework.

**Rationale**: YAGNI. For a hackathon with a single developer, the schema won't change in production. If it changes during development, delete the database file.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 2

**Related Questions**: [Questions not specified]

---

## D16: Kata specs with progressive constraint unlocking — 2026-02-11

**Context**: Redesigning kata_specs table for practice mode. Original brainstorm had test_cases and follow_up_constraint. User designed a richer model with level-gated constraints and tracked user attempts.

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: kata_specs: id, knowledge_gap_id (FK), title, description, scaffolding_code, instructor_notes, constraints (JSON), user_attempts (JSON). Constraints are [{title, description, minLevel}]. User attempts are [{code, review, level, passed, constraints}]. Flow: user writes code → API call with description + instructor_notes + attempt → Claude reviews → returns review + level (1-10) + passed. Higher level unlocks more constraints. User activates 0+ constraints per attempt.

**Rationale**: Progressive difficulty via constraint unlocking. Level 1-10 scale gives fine-grained progression. instructor_notes gives Claude context for reviewing without exposing it to the user. Constraints surface naturally as skill increases.

**Implications**:
Practice mode review API call (Story 11) needs updated schema: input is description + instructor_notes + user attempt (including active constraints), output is review + level + passed. The brainstorm's test_cases and follow_up_constraint are superseded by this model.

**Stories Affected**: Story 2, Story 11

**Related Questions**: [Questions not specified]

---

## D17: Schema scoping and data type conventions — 2026-02-11

**Context**: Four schema design questions: session-to-issue cardinality, Dreyfus scope, JSON columns, timestamp format

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: 1) One session = one issue. 2) Dreyfus assessments are global (no project FK); sessions are project-scoped. 3) JSON columns for arrays that don't need individual querying (expected_files, related_concepts, constraints, user_attempts). 4) ISO 8601 strings for timestamps (debuggability over epoch ints).

**Rationale**: One-to-one session/issue matches the coaching pipeline flow. Global Dreyfus reflects that skills transfer across projects. JSON for arrays is pragmatic in SQLite. ISO timestamps are human-readable in logs and SQLite comparisons still work.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 2

**Related Questions**: [Questions not specified]

---

## D18: Chokidar for file watching (cross-platform) — 2026-02-11

**Context**: Choosing between chokidar and native fs.watch for file system watching

**Question**: chokidar or fs.watch?

**Options Considered**:
1. chokidar (cross-platform, battle-tested); 2. fs.watch (lighter, macOS-only recursive)

**Decision**: Use chokidar. Judges may not be on macOS — need cross-platform support.

**Rationale**: fs.watch recursive only works reliably on macOS. chokidar handles all platforms. Hackathon judges evaluate by cloning the repo.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 3

**Related Questions**: [Questions not specified]

---

## D19: Buffer cache includes cursor position — 2026-02-11

**Context**: Deciding buffer cache structure — simple Map<path, content> vs richer structure

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Buffer cache stores {content, cursorPosition, dirty, lastUpdated} per path. Cursor position tracks where the user is currently editing — useful for Observer context and coaching signals.

**Rationale**: Knowing where the user is editing (not just what file) gives the Observer and coaching pipeline finer-grained signals about user behaviour.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 3, Story 10

**Related Questions**: [Questions not specified]

---

## D20: Diff library instead of git diff — 2026-02-11

**Context**: Choosing how to compute diffs between buffer state and saved files

**Question**: Use a diff npm library or shell out to git diff?

**Options Considered**:
1. diff npm library (portable, no git dependency); 2. git diff (natural for devs, assumes git)

**Decision**: Use a diff library (e.g. diff npm package). No assumption that the project is a git repo.

**Rationale**: Portability. The backend should work with any project directory, not just git repos.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 3

**Related Questions**: [Questions not specified]

---

## D21: Separate action_log table for broad action timeline — 2026-02-11

**Context**: Deciding whether to reuse `progress_events` (phase-scoped) or create a new table for the full action timeline

**Question**: Should action logging share the `progress_events` table or have its own table?

**Options Considered**:
1. Merge into progress_events (simpler, but phase-scoped FK is limiting); 2. Separate `action_log` table with session_id FK (broader scope, works outside phase context)

**Decision**: Separate `action_log` table with `{ id, session_id (FK), action_type, data (JSON), created_at }`. `progress_events` stays for phase-specific tracking. `action_log` captures everything — file_open, file_save, MCP tool calls, nudge decisions, phase transitions, buffer summaries.

**Rationale**: The Observer needs to query recent actions across all phases (and before any phase exists). Phase-scoped FK on progress_events would require nullable FK or awkward workarounds for pre-phase actions.

**Implications**:
New table in schema. Story 2 schema gains a 9th table.

**Stories Affected**: Story 4, Story 2 (additive — new table)

**Related Questions**: [Questions not specified]

---

## D22: Separate api_call_log table for Claude API call tracking — 2026-02-11

**Context**: Deciding where to log Claude API call metadata (model, latency, tokens, cost)

**Question**: Separate table or part of the general action_log?

**Options Considered**:
1. Part of action_log with metadata in JSON column; 2. Separate `api_call_log` table with dedicated columns

**Decision**: Separate `api_call_log` table with dedicated columns: `{ id, session_id (FK), call_type, model, input_hash, latency_ms (INTEGER), input_tokens (INTEGER), output_tokens (INTEGER), cost_estimate (REAL), created_at }`.

**Rationale**: API calls have unique structured fields (latency, tokens, cost) that benefit from typed columns for aggregation queries (e.g. total cost per session, average latency by model). Putting these in JSON would make budget tracking queries awkward.

**Implications**:
10th table in schema. Budget tracking dashboard query is a simple SUM over cost_estimate.

**Stories Affected**: Story 4, Story 7, Story 12

**Related Questions**: [Questions not specified]

---

## D23: Buffer update logging — periodic summaries + significant state changes — 2026-02-11

**Context**: Deciding buffer_update logging granularity. Every 300ms update is too noisy.

**Question**: What buffer activity should be logged?

**Options Considered**:
1. Periodic summaries only (~30s); 2. Significant state changes only (first edit, last edit before save); 3. Both

**Decision**: Both periodic summaries and significant state changes. Periodic: log a `buffer_summary` action every ~30s with edit count and character delta. Significant: log immediately when the character count delta exceeds a threshold (user deleted everything, or pasted a massive change). Track last known character count per file in memory alongside the buffer cache.

**Rationale**: Periodic summaries give the Observer smooth activity signals. Large delta detection catches significant user actions (paste, delete all) that the Observer should react to immediately, not 30s later.

**Implications**:
Buffer cache or a companion Map needs `lastLoggedCharCount` per file. A timer (setInterval ~30s) flushes summaries. Delta threshold (e.g. >50% change or >500 chars) triggers immediate log entry.

**Stories Affected**: Story 4, Story 3 (buffer cache may need companion tracking)

**Related Questions**: What delta threshold is right? Start with >50% change or >500 chars absolute, tune during demo.

---

## D24: Typed message router for WebSocket dispatch — 2026-02-11

**Context**: Choosing how to dispatch 21+ inbound WebSocket message types to handlers

**Question**: Switch statement or typed router?

**Options Considered**:
1. Switch statement (simpler, all in one file); 2. Typed `Map<messageType, handler>` router (cleaner, handlers testable independently)

**Decision**: Typed message router — `Map<string, MessageHandler>`. Each message type maps to a handler function. Handlers are registered at startup. Clean separation, each handler independently testable.

**Rationale**: 21+ inbound types is too many for a switch. Router pattern keeps handlers isolated and makes it easy to add stub handlers for messages that depend on later stories.

**Implications**:
Handler signature: `(payload, context) => Promise<void>` where context provides broadcast(), session state, etc.

**Stories Affected**: Story 5

**Related Questions**: [Questions not specified]

---

## D25: Store connection metadata from WebSocket handshake — 2026-02-11

**Context**: Deciding what to track per WebSocket connection

**Question**: Just the raw WebSocket reference, or metadata too?

**Options Considered**:
1. Raw WebSocket reference only; 2. Store metadata (capabilities, feature flags, window size) from `connection:hello`

**Decision**: Store connection metadata. On `connection:hello`, persist `{ ws, version, platform, windowSize, capabilities, featureFlags }` per connection. Respond with `connection:init` including session ID and server capabilities.

**Rationale**: Feature flags and capabilities are useful for the Observer (e.g. knowing window size helps judge if the user can see hints). Minimal overhead for potentially useful context.

**Implications**:
Connection tracking Map stores metadata objects, not just WebSocket references.

**Stories Affected**: Story 5, Story 1 (refines connection tracking from raw Set to metadata Map)

**Related Questions**: [Questions not specified]

---

## D26: Broadcast-only message sending — 2026-02-11

**Context**: Deciding between broadcast + targeted send vs broadcast-only for outbound WebSocket messages

**Question**: Do we need per-client targeted sends?

**Options Considered**:
1. Both `broadcast(message)` and `send(connectionId, message)`; 2. Broadcast-only

**Decision**: Broadcast-only. Single Electron client assumed for hackathon. All outbound messages go to all connected clients.

**Rationale**: YAGNI. One Electron window, one WebSocket connection. If multiple windows connect, they all get the same state — fine for a demo.

**Implications**:
Simpler API: just `broadcast(message)`. No connection ID tracking needed for sending.

**Stories Affected**: Story 5

**Related Questions**: [Questions not specified]

## D27: Session scoping — assume current active session — 2026-02-11

**Context**: MCP tools need session context. Options: explicit sessionId param, map MCP session to coaching session, or assume single active session.

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Option C: Tools assume the current active session. One user, one session at a time for hackathon. Tools return error if no session active.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 6

**Related Questions**: [Questions not specified]

---

## D28: Highlights ephemeral and accumulate — 2026-02-11

**Context**: paige_highlight_lines could persist to phase_hints SQLite table or be ephemeral broadcasts. Could replace or accumulate.

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Ephemeral + accumulate. Highlights broadcast to Electron but not persisted in SQLite. Multiple calls add decorations. paige_clear_highlights resets. Coaching pipeline (Story 9) handles persistence separately.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 6

**Related Questions**: [Questions not specified]

---

## D29: Open file tracking — new backend state — 2026-02-11

**Context**: paige_get_open_files needs to know which files are open. This data comes from multiple sources (Electron file:open, MCP paige_open_file).

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Backend maintains a Set<string> of open file paths, updated by file:open (add), file:close (remove), and paige_open_file (add + broadcast). New state introduced in Story 6.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 6, Story 5

**Related Questions**: [Questions not specified]

---

## D30: paige_get_session_state — filterable by state item — 2026-02-11

**Context**: paige_get_session_state assembles data from 5+ sources. Could return everything always or accept a filter.

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Accept optional include parameter with StateItem[] enum (9 items). Defaults to all if omitted or empty. Allows Claude Code to request only what it needs.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 6

**Related Questions**: [Questions not specified]

---

## D31: Native structured outputs via output_config.format — 2026-02-11

**Context**: Choosing how to get reliable JSON responses from Claude API calls. Options: prompting ("respond with JSON only") + Zod validation + retry on failure, or native structured outputs via the API's constrained decoding.

**Question**: Prompting + validation or native structured outputs?

**Options Considered**:
1. Prompting + Zod validation + retry on malformed JSON; 2. Native structured outputs (`output_config.format` + `zodOutputFormat()`) — API guarantees schema compliance via constrained decoding

**Decision**: Use native structured outputs. The Anthropic API supports `output_config: { format: { type: "json_schema", schema } }` with constrained decoding. The TypeScript SDK provides `zodOutputFormat()` to convert Zod schemas automatically. No validation retries needed — the API guarantees schema-compliant JSON.

**Rationale**: API-level enforcement is strictly more reliable than prompt-level enforcement. Eliminates an entire error class (malformed JSON). Simpler code — no retry logic for validation failures. SDK has first-class Zod support.

**Implications**:
First request per schema has extra latency (grammar compilation). Cached 24h by API. Some JSON Schema features unsupported (recursive schemas, numerical constraints). SDK transforms Zod schemas automatically.

**Stories Affected**: Story 7, Story 8, Story 9, Story 10, Story 11, Story 12

**Related Questions**: [Questions not specified]

---

## D32: Hardcoded pricing for 2 models — 2026-02-11

**Context**: Choosing how to track API call costs. Options: fetch pricing from remote source (like ccusage/LiteLLM), or hardcode pricing for the two models we use.

**Question**: Remote pricing fetch or hardcoded constants?

**Options Considered**:
1. Fetch from LiteLLM pricing database (remote, handles tiered pricing, supports many providers); 2. Hardcoded constants for haiku and sonnet

**Decision**: Hardcoded pricing constants. Two models (haiku at $0.80/$4.00 per MTok, sonnet at $3.00/$15.00 per MTok). One file, one place to update.

**Rationale**: KISS. We use exactly 2 models. Our API calls are short — none will hit the 200k tiered pricing threshold. Remote fetch adds a dependency and failure mode for zero benefit. Hackathon scope.

**Implications**:
If Anthropic changes pricing, update one constant. If new models added, add to MODEL_MAP and COST_PER_MILLION_TOKENS.

**Stories Affected**: Story 7

**Related Questions**: [Questions not specified]

---

## D33: Generic callApi<T>() function — no registry — 2026-02-11

**Context**: Choosing the extension pattern for API call types. Later stories (8-12) each define their own call types.

**Question**: Registry pattern or generic function?

**Options Considered**:
1. Generic `callApi<T>(options)` — callers bring their own prompt, model, schema; 2. Registry `Map<CallType, CallConfig>` — stories register configs, client dispatches; 3. Per-call-type wrapper functions using shared utility

**Decision**: Generic `callApi<T>()` function. Each caller provides callType, model, systemPrompt, userMessage, responseSchema, sessionId. No registration ceremony.

**Rationale**: KISS. A generic function is the simplest extension point. Each prompt template module (Stories 8-12) assembles its own inputs and calls `callApi()` directly. No intermediate abstraction layer to maintain.

**Implications**:
No central registry of call types. Each story is self-contained. callApi() doesn't know or care what the call types are — it just forwards to the SDK and logs.

**Stories Affected**: Story 7, Story 8, Story 9, Story 10, Story 11, Story 12

**Related Questions**: [Questions not specified]

---

## D34: Single global ChromaDB collection with metadata filtering — 2026-02-11

**Context**: Story 8: Collection design — single vs per-project

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Single collection (e.g. paige_memories) with metadata fields for project, session_id, memory_type. Cross-project recall works naturally via semantic search without metadata filters.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 8

**Related Questions**: [Questions not specified]

---

## D35: Use ChromaDB server-side default embeddings — 2026-02-11

**Context**: Story 8: Embedding strategy — server-side default vs custom embedding function

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Use ChromaDB's built-in default embedding (all-MiniLM-L6-v2 via Sentence Transformers, server-side). No embedding code in the backend. Pass documents as text, ChromaDB embeds them.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 8

**Related Questions**: [Questions not specified]

---

## D36: Story 8 is integration layer; API calls 6a/6b belong to Story 9 — 2026-02-11

**Context**: Story 8: Scope boundary — what this story owns vs Story 9

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Story 8 owns the ChromaDB client module: connection, collection management, add/query/delete operations, health check. The actual Haiku API calls for memory write (6a) and retrieval filtering (6b) belong to Story 9 (Coaching Pipeline).

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 8, Story 9

**Related Questions**: [Questions not specified]

---

## D37: Memory document structure: content as document, metadata for filtering — 2026-02-11

**Context**: Story 8: How memory records map to ChromaDB's add() parameters

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: documents = content string (embedded/searched). metadatas = { session_id, project, created_at, importance, tags (comma-separated string) }. ids = mem_<session_id>_<index> or UUID.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 8

**Related Questions**: [Questions not specified]

---

## D38: ChromaDB is optional infrastructure with empty fallbacks — 2026-02-11

**Context**: Story 8: Graceful degradation when ChromaDB is unreachable (D3 follow-up)

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: ChromaDB is optional. Backend starts fine without it. Queries return empty arrays, writes are silently skipped, warnings logged. Coaching pipeline works without memory context — Coach Agent gets empty relevant_memories array.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 8, Story 9

**Related Questions**: [Questions not specified]

---

## D39: Eager ChromaDB connection at startup with lazy recovery — 2026-02-11

**Context**: Story 8: When to create ChromaDB client and collection

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Create client and getOrCreateCollection() during server init. Log success or warning. Set chromaAvailable flag. If unavailable, retry on next memory operation (not on a timer). No server restart needed for recovery.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 8

**Related Questions**: [Questions not specified]

---

## D40: Memory module API: addMemories, queryMemories, isMemoryAvailable (no delete) — 2026-02-11

**Context**: Story 8: Public API surface of the memory module

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Three exports: addMemories(memories, sessionId, project), queryMemories(queryText, nResults=10, project?), isMemoryAvailable(). No delete for MVP. nResults defaults to 10 (Story 9 Haiku filtering trims further).

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 8

**Related Questions**: [Questions not specified]

---

## D41: Collection name: paige_memories — 2026-02-11

**Context**: Story 8: ChromaDB collection naming

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Single global collection named paige_memories. Created via getOrCreateCollection() at startup.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 8

**Related Questions**: [Questions not specified]

---

## D42: Defer countMemories to Story 12 — 2026-02-11

**Context**: Story 8: Whether to include count operation in memory module now

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Do not add countMemories() to the memory module in Story 8. Defer to Story 12 (Dashboard Data Assembly) when dashboard data needs are concrete.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 8, Story 12

**Related Questions**: [Questions not specified]

---

## D43: Story 9 covers full coaching lifecycle: pipeline entry + session wrap-up — 2026-02-11

**Context**: Story 9: Scope — whether to split pipeline entry and session wrap-up into separate stories

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Keep as one story. Story 9 covers 6 API call types: Coach Agent (#2), Memory Retrieval Filtering (#6b), Knowledge Gap Extraction (#4), Dreyfus Stage Assessment (#5), Memory Write (#6a), and Manager Summary (#10). Two orchestration flows: pipeline entry (MCP-triggered) and session wrap-up (session-end-triggered).

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 9

**Related Questions**: [Questions not specified]

---

## D44: Single MCP tool paige_run_coaching_pipeline orchestrates pipeline entry — 2026-02-11

**Context**: Story 9: How the coaching pipeline is triggered from Claude Code

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: One MCP tool (paige_run_coaching_pipeline) accepts plan output and issue context. Backend orchestrates: Dreyfus lookup → ChromaDB query → Haiku retrieval filtering → Sonnet Coach Agent → SQLite storage → WebSocket broadcast → return result to Claude Code.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 9, Story 6

**Related Questions**: [Questions not specified]

---

## D45: MCP tool paige_end_session orchestrates session wrap-up (no manager summary) — 2026-02-11

**Context**: Story 9: Session wrap-up flow and manager summary inclusion

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: One MCP tool (paige_end_session) accepts session ID and condensed transcript. Backend orchestrates: Knowledge Gap Extraction (Sonnet) → Dreyfus Assessment (Sonnet) → Memory Write (Haiku) → SQLite updates → ChromaDB storage. Manager summary deferred — not in MVP.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 9

**Related Questions**: [Questions not specified]

---

## D46: Plan input as markdown string (Claude Code passes plan text directly) — 2026-02-11

**Context**: Story 9: Format of plan input to the coaching pipeline MCP tool

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: MCP tool accepts planText as a markdown string (not a file path). Claude Code writes plans to markdown files but can pass the content directly. More self-contained — no file I/O dependency in the pipeline. Also accepts issueSummary string.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 9

**Related Questions**: [Questions not specified]

---

## D47: Dreyfus assessment runs every session end — 2026-02-11

**Context**: Story 9: When to trigger Dreyfus stage assessment

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Run Dreyfus assessment at every session end (inside paige_end_session pipeline). Uses accumulated evidence from SQLite across all past sessions, not just current session. Simpler than N-session thresholds and gives the demo a visible progression moment.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 9

**Related Questions**: [Questions not specified]

---

## D48: Pipeline entry: skip memories entirely if filtering fails — 2026-02-11

**Context**: Story 9: What happens when memory retrieval filtering (Haiku) fails during pipeline entry

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: If ChromaDB is unavailable or Haiku retrieval filtering fails, skip memories entirely. Coach Agent runs with empty relevant_memories. Coach Agent (Sonnet) is the only non-optional step — if it fails, pipeline fails.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 9

**Related Questions**: [Questions not specified]

---

## D49: Session wrap-up: best-effort steps, log failures, continue — 2026-02-11

**Context**: Story 9: Error handling for session wrap-up pipeline

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Each wrap-up step (Knowledge Gaps, Dreyfus, Memory Write) runs independently. If one fails, log the error and continue to the next. Session status always set to completed regardless of individual step failures.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 9

**Related Questions**: [Questions not specified]

---

## D50: Full Zod response schemas specified for all 5 API call types — 2026-02-11

**Context**: Story 9: Level of detail for prompt template response schemas

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Spec includes complete Zod schema definitions for all 5 response types: MemoryRetrievalFilterResponse, CoachAgentResponse, KnowledgeGapExtractionResponse, DreyfusAssessmentResponse, MemorySummarisationResponse. These are the contracts between the API calls and the consumers.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 9

**Related Questions**: [Questions not specified]

---

## D51: Manager summary deferred — not in MVP — 2026-02-11

**Context**: Story 9: Whether to include manager summary API call

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Manager summary (API call #10) deferred. Not in MVP scope. Can be added later as another prompt template module if needed.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 9

**Related Questions**: [Questions not specified]

---

## D52: Claude Code condenses session transcript for wrap-up — 2026-02-11

**Context**: Story 9: Who produces the condensed transcript for Memory Write

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Claude Code's Stop hook assembles a condensed summary of key exchanges and passes it as a string to paige_end_session. Backend supplements with its own structured data (action_log, time-per-phase, hint counts) which it already has.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 9

**Related Questions**: [Questions not specified]

---

## D53: New WebSocket message coaching:plan_ready for phase data — 2026-02-11

**Context**: Story 9: How Electron receives the full plan after Coach Agent runs

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: New coaching:plan_ready WebSocket message broadcasts the full plan with all phases after Coach Agent completes. First phase hints applied via existing editor:highlight_lines and explorer:hint_files messages. One new message type additive to Story 5.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Story 9, Story 5

**Related Questions**: [Questions not specified]

---

## D54: Observer lifecycle is per-session — 2026-02-11

**Context**: Observer needs a lifecycle model — global singleton vs per-session

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Per-session: Observer starts when a session becomes active, stops when session ends/completes. No Observer runs without an active session.

**Rationale**: Single-user hackathon app. Per-session avoids orphaned loops and ties Observer state cleanly to session state.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 10

**Related Questions**: [Questions not specified]

---

## D55: Observer subscribes via EventEmitter on action logging — 2026-02-11

**Context**: Observer needs to know when user actions occur — poll vs event-driven

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: EventEmitter pattern: logAction() both writes to SQLite and emits an event. Observer subscribes on session start, unsubscribes on session end.

**Rationale**: Natural Node.js pattern. Real-time triggering with zero polling cost. In-process, simple, no overhead.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 10, Story 4

**Related Questions**: [Questions not specified]

---

## D56: Idle detection via backend lastActivityTimestamp — 2026-02-11

**Context**: Need to detect user idleness for Observer nudge triggers

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Backend tracks lastActivityTimestamp, updated on every action log event. A recurring check (~30s interval) compares now vs last activity. Idle threshold exceeded triggers triage evaluation.

**Rationale**: Simpler than Electron-reported idleness. Backend already receives all action events. Single timer, no cross-tier coordination.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 10

**Related Questions**: [Questions not specified]

---

## D57: Nudge confidence threshold is 0.7 — 2026-02-11

**Context**: Triage model returns confidence score — need a threshold for nudge/suppress decision

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Hardcoded constant NUDGE_CONFIDENCE_THRESHOLD = 0.7. Below threshold: log nudge_suppressed with confidence and reason. No runtime config.

**Rationale**: 0.7 balances responsiveness vs chattiness. Hardcoded is fine for hackathon — no need for dynamic tuning.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 10

**Related Questions**: [Questions not specified]

---

## D58: Nudge cooldown is 120 seconds, absolute — 2026-02-11

**Context**: Need minimum interval between nudges to avoid being annoying

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Track lastNudgeTimestamp in per-session memory. Minimum 120s between nudges. Cooldown is absolute — no urgent override. Suppressed nudges logged as nudge_suppressed with reason: cooldown.

**Rationale**: 2 minutes is reasonable for coaching. No urgent override keeps implementation simple for hackathon.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 10

**Related Questions**: [Questions not specified]

---

## D59: Flow state detection: >10 actions in last 60s suppresses evaluation — 2026-02-11

**Context**: Need to avoid interrupting developers who are clearly productive

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Track recentActionCount (actions in last 60 seconds). If >10, user is in flow state — suppress triage evaluation entirely (don't call Haiku). Log nudge_suppressed with reason: flow_state.

**Rationale**: Simple heuristic that avoids breaking developer flow. 10 actions/min indicates active, productive work. No model call wasted.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 10

**Related Questions**: [Questions not specified]

---

## D60: Buffer edit trigger threshold is 5 updates since last evaluation — 2026-02-11

**Context**: Observer needs a threshold for how many buffer updates trigger a triage evaluation

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: 5 buffer_update actions since last evaluation triggers Observer evaluation. Counter resets after each evaluation. Works alongside other triggers (file open/save, idle, phase transition).

**Rationale**: 5 edits is enough activity to warrant checking without firing on every keystroke. Combined with other triggers, ensures reasonable evaluation frequency.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 10

**Related Questions**: [Questions not specified]

---

## D61: 3 new WebSocket message types for Observer — 2026-02-11

**Context**: Observer needs WebSocket messages for nudge delivery, user mute control, and status

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: 3 new types: observer:nudge_prompt (server→client, signal+confidence+context), observer:mute (client→server, muted boolean), observer:status (server→client, active+muted+lastEvaluation). Additive revision to Story 5.

**Rationale**: Minimal surface. nudge_prompt is the critical delivery mechanism. mute gives user control. status lets Electron show Observer state.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 10, Story 5

**Related Questions**: [Questions not specified]

---

## D62: Mute state stored in memory only, defaults to unmuted — 2026-02-11

**Context**: Where to store the Observer mute toggle — SQLite vs in-memory

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Per-session in-memory boolean. No SQLite column. Defaults to unmuted on session start. observer:mute WebSocket handler flips boolean and logs observer_muted action.

**Rationale**: Ephemeral state that doesn't need persistence. Simplest possible implementation. If session restarts, unmuted is the safe default.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 10

**Related Questions**: [Questions not specified]

---

## D63: Observer triage uses Story 7 prompt template convention — 2026-02-11

**Context**: Observer needs a prompt template for Haiku triage calls

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: New module prompts/observer-triage.ts following Story 7 convention: SYSTEM_PROMPT, responseSchema (Zod), assembleUserMessage(), response type. Schema: { should_nudge, confidence, signal, reasoning, suggested_context }.

**Rationale**: Consistent with all other API call types (Stories 8-9). Structured output via callApi<T>() with constrained decoding.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 10, Story 7

**Related Questions**: [Questions not specified]

---

## D64: No new SQLite tables for Observer — 2026-02-11

**Context**: Does Observer need its own persistence?

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: No new tables. Observer uses existing action_log (read recent actions, write nudge_sent/nudge_suppressed/observer_muted), phases (current phase context), dreyfus_assessments (Dreyfus stage), api_call_log (via callApi). All per-session Observer state is in-memory.

**Rationale**: Everything the Observer needs already exists. Adding tables would violate KISS for zero benefit.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 10

**Related Questions**: [Questions not specified]

---

## D65: Story 11 covers both Explain This and Practice Review — 2026-02-11

**Context**: Deciding whether to split Story 11 into two stories or keep as one

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Keep as single story — both flows share the same pattern (WebSocket in → callApi → WebSocket out) and are independently simple

**Rationale**: Same architectural pattern, small enough to keep together

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11

**Related Questions**: [Questions not specified]

---

## D66: Electron client sends surrounding context for Explain This — 2026-02-11

**Context**: Whether backend should fetch context from buffer cache or client should send it

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Client sends surrounding context to ensure freshness. Backend also receives current plan/phase context if a coaching session is active.

**Rationale**: Client has the most up-to-date buffer state. Adding phase context makes explanations coaching-aware.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11, Story 5

**Related Questions**: [Questions not specified]

---

## D67: Practice Review: client sends kata spec, multiple submissions, update existing kata — 2026-02-11

**Context**: Interaction model for practice mode code review

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Client sends kata spec with submission. Multiple submissions allowed for iterative refinement. Follow-up constraints update the existing kata record, not create a new one.

**Rationale**: Client already has kata spec loaded. Iterative refinement is natural for practice. Updating existing kata keeps the data model clean.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11

**Related Questions**: [Questions not specified]

---

## D68: UI-driven API errors shown as toast with human-readable message, one retry — 2026-02-11

**Context**: Error UX for Explain This and Practice Review API failures

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Backend retries once on transient failure. On final failure, sends error via WebSocket. Electron renders as toast notification with human-readable message.

**Rationale**: Toast is non-intrusive, doesn't break flow. One retry handles transient issues. Human-readable messages help the developer user.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11, Story 5

**Related Questions**: [Questions not specified]

---

## D69: Practice Review: backend loads kata spec from SQLite, not client-sent — 2026-02-11

**Context**: Revised D67 — kata_specs has instructor_notes (secret from client) and leveling system (1-10) with progressive constraint unlocking

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Client sends kataId + userCode + activeConstraintTitles. Backend loads full kata spec from SQLite (including instructor_notes). Backend appends attempt to user_attempts JSON array. Response includes level and newly unlocked constraints.

**Rationale**: instructor_notes must stay server-side. Backend owns state (Constitution VIII). Leveling system requires server-side constraint resolution.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11, Story 2

**Related Questions**: [Questions not specified]

---

## D70: Explain This: single system prompt with Dreyfus stage injected — 2026-02-11

**Context**: Whether to use distinct prompt variants per Dreyfus stage or a single prompt with stage parameter

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Single system prompt with stage injected as a variable. Consistent with Story 9's Coach Agent pattern.

**Rationale**: Simpler, model calibrates tone well from a single instruction. No prompt variant maintenance.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11

**Related Questions**: [Questions not specified]

---

## D71: Practice Review: katas never complete, user can keep attempting — 2026-02-11

**Context**: What happens when all constraints exhausted and kata passed at max level

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Katas are never marked completed. Users can keep making attempts — trying different approaches, combining constraints in new ways. No automatic update to knowledge_gap.addressed.

**Rationale**: Open-ended practice supports deeper learning. Completion/addressed status is a dashboard concern (Story 12), not a review concern.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11

**Related Questions**: [Questions not specified]

---

## D72: Story 11: log explain_completed and review_completed actions alongside api_call_log — 2026-02-11

**Context**: Whether api_call_log from Story 7 is sufficient or Story 11 needs its own action log entries

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Log both: api_call_log captures infrastructure (latency, tokens, cost) automatically via callApi. Action log captures domain events: explain_completed (with latency, model) and review_completed (with level, passed status).

**Rationale**: Different concerns. api_call_log is for cost/performance. Action log is for coaching signals and observability.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11, Story 4

**Related Questions**: [Questions not specified]

---

## D73: Explain This: analogy field is nullable — 2026-02-11

**Context**: Whether the explain response should always include an analogy

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: analogy is nullable in the response schema. Sonnet decides when an analogy adds value. For simple code, forced analogies feel patronising.

**Rationale**: Let the model exercise judgement. Schema uses z.string().nullable().

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11

**Related Questions**: [Questions not specified]

---

## D74: Explain This: relatedFiles is nullable, inferred from code — 2026-02-11

**Context**: Whether relatedFiles should always be present, dropped, or nullable

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: relatedFiles is nullable. Model infers from visible imports/references in the snippet. When no related files are evident, returns null.

**Rationale**: Useful when imports are visible, avoids speculation when they're not.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11

**Related Questions**: [Questions not specified]

---

## D75: Practice Review: include previous attempts with same constraints in prompt — 2026-02-11

**Context**: Whether to send attempt history to the model for contextual feedback

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Include previous attempts that used the same constraint set. Enables contextual feedback ('good improvement' or 'still the same issue'). Attempts with different constraints are excluded to keep prompt focused.

**Rationale**: Same-constraint history gives the model meaningful comparison context without noise from differently-scoped attempts.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11

**Related Questions**: [Questions not specified]

---

## D76: WebSocket response naming: explain:response/error and review:response/error — 2026-02-11

**Context**: Naming convention for server-to-client response messages in Story 11

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Use explain:response, explain:error, review:response, review:error for server→client messages. Follows category:action pattern.

**Rationale**: Consistent, readable, matches existing patterns like fs:content, fs:save_ack.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 11, Story 5

**Related Questions**: [Questions not specified]

---

## D77: Dashboard: backend shells out to gh CLI for raw GitHub issues — 2026-02-11

**Context**: How to get raw GitHub issue data for the issue assessment API call

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Backend shells out to gh issue list --json with relevant fields. Requires gh installed and authenticated on the machine running the backend.

**Rationale**: Pragmatic for hackathon. No GitHub API client to build. gh handles auth. Couples to gh being installed but that's fine for a demo.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12

**Related Questions**: [Questions not specified]

---

## D78: Dashboard: dashboard:request is full load, stats accept optional time filter, manual issue refresh supported — 2026-02-11

**Context**: Dashboard refresh model — what triggers what

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: dashboard:request is the full load trigger on app launch (SQLite immediate + async API calls). It accepts an optional statsPeriod filter. dashboard:refresh_issues triggers just the GitHub issue reassessment. dashboard:stats_period stub in Story 5 is replaced by the optional filter on dashboard:request.

**Rationale**: Single entry point for full load. Optional filter avoids a second message type. Separate issue refresh is useful because gh calls are slow.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12, Story 5

**Related Questions**: [Questions not specified]

---

## D79: Dashboard: Manager Summary out of scope — 2026-02-11

**Context**: Whether to include Manager Summary (brainstorm API call #10, stretch goal) in Story 12

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Out of scope. Manager Summary is a stretch goal that doesn't add demo value proportional to the effort.

**Rationale**: YAGNI. Constitution Principle IV. Focus on what's demo-visible.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12

**Related Questions**: [Questions not specified]

---

## D80: Dashboard: gh issue list infers repo from PROJECT_DIR, open issues only — 2026-02-11

**Context**: How to configure gh CLI for issue fetching

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Run gh issue list without --repo from PROJECT_DIR so it infers the repo from git remote. Open issues only. gh will be installed — no degraded mode needed.

**Rationale**: Simplest approach. Running from PROJECT_DIR means gh auto-discovers the repo. No env var needed.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12

**Related Questions**: [Questions not specified]

---

## D81: Dashboard: learning materials use web search tool for real URLs — 2026-02-11

**Context**: Whether to let Sonnet hallucinate URLs or use web search

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Include Anthropic's web_search tool in the learning materials API call so Sonnet can search for real, current resources rather than generating URLs from training data.

**Rationale**: Real URLs are dramatically better for the demo and for the user. Web search is a server-side connector tool — Anthropic handles execution.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12, Story 7

**Related Questions**: [Questions not specified]

---

## D82: Dashboard: dashboard:refresh_issues only re-runs issue assessment, not full reload — 2026-02-11

**Context**: Whether issue refresh re-sends dashboard:state

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: dashboard:refresh_issues only triggers gh + Sonnet issue assessment. It does not re-query SQLite or re-send dashboard:state. Only sends dashboard:issues on completion.

**Rationale**: Avoids unnecessary work. User just wants fresh issues, not a full dashboard reload.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12

**Related Questions**: [Questions not specified]

---

## D83: callApi: extend with optional tools parameter for connector tools — 2026-02-11

**Context**: Learning materials needs web_search tool, but callApi only supports structured output

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Add optional tools parameter to callApi<T>(). Passed through to SDK. Only used by learning materials call currently. Keeps callApi as single entry point.

**Rationale**: One-line addition. Avoids a separate function for one use case. Tools are optional — existing callers unaffected.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12, Story 7

**Related Questions**: [Questions not specified]

---

## D84: Issue assessment queries ChromaDB for similar past issues — 2026-02-11

**Context**: Whether issue assessment should include ChromaDB context

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Issue assessment queries ChromaDB with issue summaries to find related past coaching memories. Adds 'you worked on something similar' context. ChromaDB unavailable = skip memories (same degradation pattern as Story 9).

**Rationale**: Adds demo value ('Paige remembers your past work'). Follows established ChromaDB degradation pattern.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12, Story 8

**Related Questions**: [Questions not specified]

---

## D85: Remove dashboard:stats_period stub from Story 5 — 2026-02-11

**Context**: dashboard:stats_period is replaced by optional statsPeriod on dashboard:request (D78)

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Remove dashboard:stats_period from Story 5's handler table. Dead message type.

**Rationale**: Folded into dashboard:request. No point keeping a dead stub.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12, Story 5

**Related Questions**: [Questions not specified]

---

## D86: Issue assessment: fetch 50 issues, Sonnet picks top 10 — 2026-02-11

**Context**: How many GitHub issues to fetch and assess

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Fetch up to 50 open issues via gh issue list --limit 50. Send all to Sonnet in one API call. Sonnet selects and ranks the top 10 most suitable for the user.

**Rationale**: Sonnet can evaluate suitability better than a pre-filter. 50 issues fits comfortably in Sonnet's context. Top 10 keeps dashboard scannable.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12

**Related Questions**: [Questions not specified]

---

## D87: Learning materials: top 5 knowledge gaps by severity then frequency — 2026-02-11

**Context**: How many knowledge gaps to include in learning materials research

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Query top 5 unaddressed knowledge gaps from SQLite ordered by severity (high > medium > low) then frequency descending. Keeps response focused and dashboard scannable.

**Rationale**: Focused scope. More than 5 would overwhelm the UI. Severity-first ensures the most impactful gaps get addressed.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12

**Related Questions**: [Questions not specified]

---

## D88: Dashboard API calls use callApiWithRetry (one retry) — 2026-02-11

**Context**: Whether dashboard API calls should retry on failure

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Both dashboard API calls (issue assessment and learning materials) use callApiWithRetry() from Story 11. Issues are important enough to warrant one retry.

**Rationale**: Issues are the main entry point to coaching sessions. A transient failure shouldn't leave the dashboard empty.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12, Story 11

**Related Questions**: [Questions not specified]

---

## D89: Dashboard: dedicated error messages for failed API calls — 2026-02-11

**Context**: How to communicate dashboard API failures to Electron

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Send dashboard:issues_error and dashboard:materials_error with human-readable messages on failure. Electron renders specific 'failed to load' states rather than ambiguously waiting.

**Rationale**: Explicit errors let Electron show retry buttons and clear state. Better UX than a silent timeout.

**Implications**:
[Implications not provided]

**Stories Affected**: Story 12, Story 5

**Related Questions**: [Questions not specified]

---
