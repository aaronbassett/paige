<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Modified sections:
  - Development Standards > Testing: "manual testing acceptable" → "happy path automated testing required"
  - Development Standards > Code Style: loose TypeScript → strict mode, warnings are blockers
  - Development Standards > Commit Discipline: no convention → conventional commits with size limits
Added sections: None
Removed sections: None
Templates requiring updates:
  - plan-template.md: ⚠ pending (Constitution Check section needs Paige-specific gates)
  - spec-template.md: ✅ no changes needed
  - tasks-template.md: ✅ no changes needed
Follow-up TODOs: None
-->

# Paige Constitution

> **Claude Codes, Paige Pairs**

## Core Principles

### I. Read-Only Is Sacred (NON-NEGOTIABLE)

The Claude Code plugin (Paige) MUST NOT write, edit, or create files.
This constraint applies exclusively to the AI coaching layer — the Claude
Code plugin and its hooks. The Electron app and backend server handle
user-initiated file operations normally.

Enforcement is layered:

1. **Tool restriction**: The plugin's `allowedTools` strips `Write`,
   `Edit`, and `MultiEdit` from Claude's available tools.
2. **Bash filtering**: The `PreToolUse` hook rejects Bash commands
   matching a write-operation blocklist (redirects, `sed -i`, `mv`,
   `rm`, `mkdir`, `touch`, `git add/commit/push`).
3. **MCP boundary**: The backend's MCP surface exposes no write-file
   tools to Claude Code. Only the Electron client can request file
   writes via WebSocket.

**Rationale**: This is the core differentiator. Paige coaches; the user
codes. If this constraint breaks, the entire value proposition breaks.
Every other principle is negotiable. This one is not.

### II. Demo-First Development

Every implementation decision MUST pass the question: "How does this
look in the 3-minute demo video?"

- If a feature isn't demo-visible, deprioritise it.
- If a feature is demo-visible but half-baked, it's worse than absent.
- Polish what the camera sees. Rough edges behind the scenes are fine.
- The demo script (problem → pitch → work mode → practice mode → vision)
  is the acceptance test for the MVP.

**Rationale**: 30% of hackathon judging is the demo. A working feature
that can't be shown is wasted effort. A polished demo of fewer features
beats a broken demo of many.

### III. KISS

Do the simplest thing that works. If you can't explain a design decision
in one sentence, it's too complex.

- Prefer flat over nested.
- Prefer explicit over clever.
- Prefer boring and working over novel and fragile.
- If it's not needed for the demo, don't build it.

**Rationale**: One-week hackathon, solo developer. Complexity is the
enemy of shipping.

### IV. YAGNI

Build for the demo, not hypothetical production.

- No multi-tenant support.
- No authentication or authorisation.
- No deployment infrastructure.
- No production error monitoring.
- No internationalisation.
- Full Dreyfus assessment automation is out of scope — use heuristics.

**Rationale**: Every feature not in the MVP scope is a feature that
steals time from the features that are.

### V. Three-Tier Separation

The system has exactly three tiers. Each tier has exactly one job:

| Tier | Job | Owns |
|------|-----|------|
| **Claude Code Plugin** | Personality | Coaching persona, read-only enforcement, prompt enrichment |
| **Backend Server** | Brain | State (SQLite, ChromaDB), file I/O, MCP tools, action logging |
| **Electron UI** | Face | Rendering (Monaco, xterm.js, file tree), user interaction |

Rules:

- Electron MUST NOT contain AI logic or own state.
- The plugin MUST NOT access the filesystem directly (beyond Claude
  Code's built-in `Read`, `Glob`, `Grep`).
- The backend MUST NOT render UI.
- Cross-tier communication uses defined protocols only: MCP (SSE) for
  Plugin↔Backend, WebSocket for Backend↔Electron.

**Rationale**: Clean separation enables independent development and
testing of each tier. It also makes the architecture legible to hackathon
judges evaluating depth and execution (20% of judging).

### VI. Leverage Existing Components

Use established libraries for every non-novel component:

| Need | Use | Don't Build |
|------|-----|-------------|
| Code editor | Monaco Editor (`@monaco-editor/react`) | Custom editor |
| Terminal | xterm.js | Custom terminal renderer |
| Structured data | SQLite (`better-sqlite3`) | Custom persistence |
| Semantic search | ChromaDB | Custom vector store |
| AI↔Backend bridge | MCP SDK (`@modelcontextprotocol/sdk`) | Custom RPC |
| Issue tracking | GitHub CLI (`gh`) | Custom issue integration |

**Rationale**: The novel value is in the coaching pipeline and hinting
system, not in reinventing editors or terminals. Use the hackathon time
on what makes Paige unique.

### VII. Contract-Driven Integration

The MCP tool schemas and WebSocket message protocol are the contracts
between tiers. All three tiers MUST be buildable and testable
independently against these contracts.

- MCP tool schemas define what Claude Code can call on the backend.
- WebSocket message types define Backend↔Electron communication.
- Plugin hook specifications define what the plugin injects/intercepts.

Changes to contracts MUST be documented before implementation begins.

**Rationale**: With three independent tiers, the contract is the only
thing preventing integration chaos. Spec-driven development enables
parallel work and confident integration.

### VIII. Backend Is Single Source of Truth

All state, all file I/O, and all logging flows through the backend.

- Electron never reads from or writes to the filesystem directly.
- The backend maintains the canonical buffer cache, file tree, and
  session state.
- If the backend doesn't know about it, it didn't happen.

**Rationale**: Centralised state makes debugging straightforward, enables
the action log (coaching signals for free), and provides the third layer
of read-only enforcement.

### IX. Observable by Default

If data flows through the backend, it gets logged.

- Every file open, edit, and save is recorded.
- Phase transitions, hint usage, and nudge decisions are tracked.
- The data to replay a coaching session exists as a natural byproduct.
- Observability is not an add-on; it's a consequence of the architecture.

**Rationale**: The Observer system (stretch goal) depends on rich action
logs. Even without the Observer, the logs provide debugging context and
coaching signal data that enriches the demo.

### X. Predictable UX

The UI MUST behave the way a developer expects.

- Standard keyboard shortcuts (Cmd+S saves, Cmd+P opens files).
- Monaco editor behaves like VS Code.
- File tree behaves like a file tree.
- Terminal behaves like a terminal.
- No modal dialogs that interrupt flow.
- Hints are additive — they enhance, never obstruct.

**Rationale**: The novel element is Paige's coaching, not the IDE shell.
Developers should feel immediately at home in the editor so they can
focus on learning, not on learning the tool.

## Development Standards

### Testing

Happy path automated tests are REQUIRED. Much of this codebase will be
built by Claude Code with limited human oversight — automated tests are
the safety net that prevents silent regressions.

- Every user-facing workflow MUST have a happy path test that proves
  the feature works end-to-end.
- Tests MUST run and pass before committing.
- Do not pursue coverage metrics — focus on critical paths, not
  percentages.
- If a test is flaky, fix or remove it. Flaky tests erode trust faster
  than no tests.

### Error Handling

Fail fast with human-readable messages. During the hackathon, a clear
`console.error` with context is more valuable than graceful degradation.

- Errors MUST include what failed and where.
- Errors SHOULD suggest what to check next.
- Silent failures are never acceptable — they waste debugging time.

### Code Style

TypeScript strict mode is REQUIRED. Linting and formatting warnings
MUST be treated as blockers — code with warnings MUST NOT be committed.
With limited human review, the tooling is the first line of defence.

- `strict: true` in `tsconfig.json` is non-negotiable.
- All ESLint warnings MUST be resolved before committing.
- All Prettier formatting MUST be applied before committing.
- Prefer `const` over `let`.
- Prefer named exports.
- Prefer async/await over raw promises.
- No `any` types unless explicitly justified with a comment explaining
  why a proper type is not feasible.

### Commit Discipline

Commit early, commit often. Use conventional commits so the human
reviewer can scan commit logs efficiently.

- Format: `type(scope): subject` (e.g., `feat(backend): add MCP server`).
- The entire commit message MUST be under 300 characters.
- Commit bodies MUST NOT exceed 5 bullet points.
- The diff shows what files changed — don't repeat file lists in the
  message. Focus on *why*, not *what*.
- Commit after each logical unit of work, not at end-of-session.

## Governance

This constitution guides all implementation decisions for Paige.
When in doubt, refer to these principles in priority order — Principle I
(Read-Only Is Sacred) always wins.

**Amendment process**: Update this document directly. No formal approval
process needed for a solo project. If a principle proves wrong during
implementation, change it and note why.

**Compliance**: Every PR, code review, or implementation decision should
be checkable against these principles. The Constitution Check section in
implementation plans references these principles as gates.

**Version**: 1.1.0 | **Ratified**: 2026-02-10 | **Last Amended**: 2026-02-10
