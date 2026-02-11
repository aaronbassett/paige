# Discovery State: backend-server

**Updated**: 2026-02-11
**Iteration**: 3
**Phase**: Story Development (Phase 3)

---

## Problem Understanding

### Problem Statement

The Paige backend server is the central nervous system of a three-tier AI coaching application. It must serve two very different consumers simultaneously — Claude Code (via MCP/Streamable HTTP) and an Electron UI (via WebSocket) — while owning all persistent state, all file I/O, all Claude API calls for evaluative/analytical tasks, and a comprehensive action log. It is the single source of truth: if the backend doesn't know about it, it didn't happen.

### Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| **Claude Code Plugin** | The AI coaching personality running in a PTY. Communicates via MCP (SSE). | Call tools to control the UI (highlights, hints, phase updates), read session state, read buffers/diffs, trigger the coaching pipeline |
| **Electron UI** | Thin rendering client (Monaco, xterm.js, file tree). Communicates via WebSocket. | Receive UI commands, push user activity (buffer edits, file opens/saves), request file content, request explanations, submit practice solutions, load dashboard data |
| **Developer (Aaron)** | Solo hackathon developer building and demoing Paige. | Run the server easily, debug quickly, see clear logs, configure for demo scenarios |

### Current State vs. Desired State

**Today (without backend)**: The three tiers don't exist yet. The brainstorm document defines the architecture, MCP tool surface, WebSocket protocol, Claude API call inventory, Observer system, and coaching pipeline — but none of it is implemented. Without the backend, Claude Code has no MCP tools to call, Electron has nothing to connect to, and there is no persistent state.

**Tomorrow (with backend)**: A running Node.js/TypeScript server that accepts MCP connections from Claude Code and WebSocket connections from Electron. It manages sessions, plans, phases, Dreyfus assessments, and knowledge gaps in SQLite. It stores and retrieves semantic memories via ChromaDB (TypeScript SDK, external server). It makes direct Claude API calls for evaluative/analytical tasks (coaching, triage, explanations, gap extraction, etc). It logs every significant action for observability and coaching signal extraction.

### Constraints

- **Timeline**: One-week hackathon, solo developer. KISS and YAGNI apply ruthlessly.
- **Demo-first**: Every feature must be demonstrable in the 3-minute video. Polish what the camera sees.
- **Read-only enforcement**: The MCP surface must NOT expose write-file tools to Claude Code. Only Electron can request file writes via WebSocket. (Constitution Principle I)
- **Three-tier separation**: Backend owns state and logic. Electron renders. Claude Code coaches. No cross-contamination. (Constitution Principle V)
- **ChromaDB is external**: The ChromaDB server runs as a separate process, managed manually. The backend connects via the TypeScript SDK.
- **Coaching pipeline flow**: User prompts Claude Code via xterm.js → Claude Code runs Explore/Plan agents → Claude Code triggers Coach Agent via MCP tool call → Backend makes the Coach API call (Sonnet) and returns phased guidance.
- **TypeScript strict mode**: Non-negotiable per constitution. ESLint/Prettier warnings are blockers.
- **Happy path tests required**: Per constitution. Every user-facing workflow needs automated coverage.

---

## Story Landscape

### Story Status Overview

| # | Story | Priority | Status | Confidence | Blocked By |
|---|-------|----------|--------|------------|------------|
| 1 | Server Foundation & Lifecycle | P1 | ✅ In SPEC | 100% | — |
| 2 | SQLite State Management | P1 | ✅ In SPEC | 100% | 1 |
| 3 | File System Layer | P1 | ✅ In SPEC | 100% | 1 |
| 4 | Action Logging & Observability | P1 | ✅ In SPEC | 100% | 1, 2 |
| 5 | WebSocket Protocol | P1 | ✅ In SPEC | 100% | 1, 3 |
| 6 | MCP Tool Surface | P1 | ✅ In SPEC | 100% | 1, 2, 3 |
| 7 | Claude API Client | P2 | ✅ In SPEC | 100% | 1 |
| 8 | ChromaDB Memory Integration | P2 | ✅ In SPEC | 100% | 7 |
| 9 | Coaching Pipeline (API Calls) | P2 | ✅ In SPEC | 100% | 6, 7, 8 |
| 10 | Observer System | P2 | ✅ In SPEC | 100% | 4, 5, 7 |
| 11 | UI-Driven API Calls | P3 | ✅ In SPEC | 100% | 5, 7 |
| 12 | Dashboard Data Assembly | P3 | ✅ In SPEC | 100% | 2, 5, 8, 11 |

### Story Dependencies

```
Story 1 (Server Foundation)
  ├── Story 2 (SQLite) ─────────────────────┐
  │     └── Story 4 (Action Logging) ←──────┤
  ├── Story 3 (File System)                 │
  │     ├── Story 5 (WebSocket) ────────────┤
  │     └── Story 6 (MCP Tools) ←── 2, 3   │
  └── Story 7 (Claude API Client)           │
        ├── Story 8 (ChromaDB Memory)       │
        ├── Story 9 (Coaching Pipeline) ←── 6, 8
        ├── Story 10 (Observer) ←── 4, 5    │
        ├── Story 11 (UI-Driven APIs) ←── 5 │
        └── Story 12 (Dashboard) ←── 2, 5, 8, 11
```

---

## Completed Stories Summary

| # | Story | Priority | Completed | Key Decisions | Revision Risk |
|---|-------|----------|-----------|---------------|---------------|
| 1 | Server Foundation & Lifecycle | P1 | 2026-02-10 | D5, D6, D7, D9, D10, D12 | Low |
| 2 | SQLite State Management | P1 | 2026-02-11 | D13, D14, D15, D16, D17 | Low |
| 3 | File System Layer | P1 | 2026-02-11 | D18, D19, D20 | Low |
| 4 | Action Logging & Observability | P1 | 2026-02-11 | D21, D22, D23 | Low |
| 5 | WebSocket Protocol | P1 | 2026-02-11 | D24, D25, D26 | Low |
| 6 | MCP Tool Surface | P1 | 2026-02-11 | D27, D28, D29, D30 | Low |
| 7 | Claude API Client | P2 | 2026-02-11 | D31, D32, D33 | Low |
| 8 | ChromaDB Memory Integration | P2 | 2026-02-11 | D34–D42 | Low |
| 9 | Coaching Pipeline (API Calls) | P2 | 2026-02-11 | D43–D53 | Low (Story 5, 6 minor additive revisions) |
| 10 | Observer System | P2 | 2026-02-11 | D54–D64 | Low (Story 4, 5 minor additive revisions) |
| 11 | UI-Driven API Calls | P3 | 2026-02-11 | D65–D76 | Low (Story 4, 5 minor additive revisions) |
| 12 | Dashboard Data Assembly | P3 | 2026-02-11 | D77–D89 | Low (Story 5, 7 minor additive revisions) |

*Full stories in SPEC.md*

---

## In-Progress Story Detail

*No story currently in progress. All 12 stories graduated.*

---

## Watching List

*Items that might affect graduated stories:*

- Story 4 (EC-19): API call failure logging convention (latency_ms=-1) — confirmed compatible with Story 7 design
- Story 4: Additive revision — action log EventEmitter for Observer subscription (D55, Story 10)
- Story 5: Additive revision — 2 new WebSocket message types (coaching:plan_ready, session:completed) from Story 9
- Story 5: Additive revision — 3 new WebSocket message types (observer:nudge_prompt, observer:mute, observer:status) from Story 10
- Story 6: Additive revision — 2 new MCP tools (paige_run_coaching_pipeline, paige_end_session) from Story 9
- Story 4: Additive revision — 2 new action types (explain_completed, review_completed) from Story 11
- Story 5: Additive revision — 2 stub handlers upgraded to Full (user:explain, user:review), 4 new server→client message types (explain:response, explain:error, review:response, review:error) from Story 11
- Story 4: Additive revision — 1 new action type (dashboard_loaded) from Story 12
- Story 5: Additive revision — 2 stub handlers upgraded to Full (dashboard:request, dashboard:refresh_issues), dashboard:stats_period removed (D85), 5 new server→client message types from Story 12
- Story 7: Additive revision — optional `tools` parameter on `callApi<T>()` for connector tools (D83) from Story 12

---

## Glossary

- **MCP**: Model Context Protocol — the communication protocol between Claude Code and the backend (SSE transport)
- **SSE**: Server-Sent Events — the HTTP-based transport layer for MCP
- **PTY**: Pseudo-terminal — the terminal process running Claude Code inside Electron
- **Observer**: Background process that monitors user activity and decides whether Paige should proactively nudge
- **Triage Model**: A fast/cheap model (Haiku) that makes binary nudge/no-nudge decisions for the Observer
- **Coach Agent**: A Sonnet API call that transforms a plan into phased, scaffolded guidance (Dreyfus-aware)
- **Dreyfus Model**: Five-stage skill acquisition model (Novice → Advanced Beginner → Competent → Proficient → Expert) used to calibrate coaching
- **Kata**: A practice exercise generated from identified knowledge gaps
- **ChromaDB**: Vector database for semantic search, used for cross-session memory
- **Buffer Cache**: In-memory store of current editor buffer contents, updated via debounced WebSocket messages from Electron
- **Structured Outputs**: Anthropic API feature (`output_config.format`) that guarantees schema-compliant JSON via constrained decoding

---

## Next Actions

- All 12 stories graduated. Spec ready for final review.
- Run validate-spec.py for integrity check
- User final review and approval
