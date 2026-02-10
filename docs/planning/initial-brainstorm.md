# Paige — Project Planning & Design Document

> **Claude Codes, Paige Pairs**

This document captures the initial planning and brainstorming sessions for Paige, an AI-powered coaching tool for junior developers. It serves as both a record of our design thinking for hackathon judges and as implementation context for Claude Code.

**IMPORTANT:** This is only the initial planning; there will be issues/limitations we have not considered. You are empowered to suggest alternatives to anything suggested below.

---

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Research Findings](#research-findings)
  - [The Junior Developer Crisis](#the-junior-developer-crisis)
  - [Educational Scaffolding](#educational-scaffolding)
  - [The Dreyfus Model of Skill Acquisition](#the-dreyfus-model-of-skill-acquisition)
- [Architecture](#architecture)
  - [Design Philosophy: Plugin-as-Brain, Electron-as-Face](#design-philosophy-plugin-as-brain-electron-as-face)
  - [Communication Model: MCP Server](#communication-model-mcp-server)
  - [MCP Server Surface](#mcp-server-surface)
  - [Electron Application](#electron-application)
  - [Read-Only Enforcement](#read-only-enforcement)
  - [Memory System](#memory-system)
  - [The Coaching Pipeline](#the-coaching-pipeline)
- [UI Design](#ui-design)
  - [Work Mode](#work-mode)
  - [Practice Mode](#practice-mode)
  - [The Hinting System](#the-hinting-system)
- [Work Mode Workflow](#work-mode-workflow)
- [Claude Code Plugin Patterns](#claude-code-plugin-patterns)
- [Technology Stack](#technology-stack)
- [Hackathon Strategy](#hackathon-strategy)
  - [Judging Criteria Alignment](#judging-criteria-alignment)
  - [Demo Script](#demo-script)
  - [MVP Scope](#mvp-scope)
- [Stretch Goals](#stretch-goals)
- [Design Principles](#design-principles)
- [Architecture Amendment: Three-Tier Separation](#architecture-amendment-three-tier-separation)

---

## The Problem

LLM coding tools have been a boon for senior developers, but they're hollowing out the junior role. The tasks juniors used to learn on — writing boilerplate, fixing simple bugs, building CRUD operations — AI does them now. Companies are asking "why hire a junior for $90K when GitHub Copilot costs $10?"

The data is stark:

- Employment for software developers aged 22–25 has declined nearly 20% from its peak in late 2022 (Stanford Digital Economy Study, July 2025).
- Tech internship postings dropped 30% since 2023, while applications rose 7%.
- After late 2022, AI-adopting companies hired five fewer junior workers per quarter — not through layoffs, but through a complete freeze in new hiring (Harvard study).
- New graduates now make up just 7% of Big Tech hires, down 25% from 2023.
- 70% of hiring managers believe AI can perform intern-level work.

This creates a self-fulfilling prophecy: juniors get fewer opportunities to develop expertise, which justifies further reductions in junior hiring.

**Every senior engineer, designer, or manager started out as a junior. Without entry-level opportunities, the next generation of skilled professionals will never exist.**

With Baby Boomers retiring in the largest wave modern tech has seen, eliminating the junior pipeline today guarantees a succession crisis in 5–10 years.

## The Solution

Paige flips the script. Instead of AI that codes *for* your juniors, it's AI that coaches *with* them.

**Core principles:**

- **Read-only by design.** Paige can see your codebase but can't edit it. She has to teach — there's no "fine, I'll just do it for you" escape hatch.
- **Pattern recognition.** She remembers what you've built before and connects new problems to old ones: "This is the same pattern as last week. You've got this."
- **Adaptive pacing.** Paige notices when frustration is building and suggests a change of pace before it kills momentum.
- **Scaffolded learning.** Guidance is layered — the user decides how much help they want at any given time.

---

## Research Findings

### The Junior Developer Crisis

Our research confirmed that the decline in junior developer hiring is a widely recognised industry crisis, not a niche concern. Key findings:

**Employment collapse:** Software developer employment for ages 22–25 dropped ~20% from late 2022 to July 2025. The unemployment rate for this age group (7.4%) is nearly double the national average.

**Internship pipeline broken:** Tech internship postings fell 30% since 2023. Most entry-level jobs now require 2–5 years of experience — experience that used to come from the very internships that are disappearing.

**AI as replacement, not augment:** Senior developers using AI tools show 2.5× greater productivity than juniors using identical tools. This creates a perverse incentive: why invest in training juniors when seniors + AI are cheaper?

**The talent pipeline paradox:** Both optimists and pessimists in the industry agree on one thing — neglecting junior development today will create a severe shortage of mid-level and senior talent within 5–10 years. As one analysis noted: "You're not just making hiring decisions — you're determining whether your organisation will have the senior technical leadership it needs five, seven, ten years from now."

**Vibe coding concerns:** The rise of "vibe coding" (using AI to build applications without understanding the underlying code) is creating a generation of developers who can't debug what they've built. Security researchers warn this creates "a perfect storm of security risks."

### Educational Scaffolding

Scaffolding is the foundational pedagogical framework for Paige's coaching approach. Based on the work of Wood, Bruner, and Ross (1976) and Vygotsky's Zone of Proximal Development (ZPD).

**Core concept:** The teacher helps the student master a task or concept that the student is initially unable to grasp independently. The teacher offers assistance with only those skills that are beyond the student's capability. Of great importance is allowing the student to complete as much of the task as possible, unassisted.

**Key strategies and how they map to Paige:**

| Scaffolding Strategy | Paige Implementation |
|---|---|
| **Decomposition** — Break the task into smaller chunks | Phased work plans; each phase has clear, achievable goals |
| **Prior knowledge activation** — Connect new material to things already known | Cross-session memory: "This is just like that React bug we handled last week" |
| **Progressive disclosure** — Show more detail only when needed | The hinting toggle system; novices get more, experienced users get less |
| **Modelling** — Show how an expert would approach the problem | Paige explains the reasoning behind an approach without writing the code |
| **Fading** — Gradually remove support as competence grows | Hint levels decrease as the user progresses through the Dreyfus stages |
| **Productive failure** — Let students struggle with problems just beyond their reach | Practice mode katas designed to be slightly above current ability |

**Frustration management — the circuit breaker:**

Frequent success is important in scaffolding, especially in helping control frustration levels. When a user is stuck in a loop receiving the same feedback, Paige should:

1. **Reframe** — Explain the concept differently, use a different analogy or approach.
2. **Decompose further** — Break the stuck step into even smaller sub-steps.
3. **Lateral move** — Suggest working on a different part of the issue, then returning.
4. **Increase directness** — Provide a more direct hint (but still not the answer) and flag the knowledge gap for practice mode.

### The Dreyfus Model of Skill Acquisition

The Dreyfus model proposes five stages of skill development: **Novice → Advanced Beginner → Competent → Proficient → Expert**. Most junior developers sit at Novice to Advanced Beginner.

**Critical insight for Paige:** Different stages require fundamentally different types of guidance.

| Dreyfus Stage | Needs | Paige's Approach |
|---|---|---|
| **Novice** | Clear rules, step-by-step instructions, minimal options | Prescriptive: "Go to `src/auth.ts`, look at line 42, the `handleCallback` function needs an error check" |
| **Advanced Beginner** | Guidelines with contextual information, can recognise patterns from examples | Guided: "The state management in this component follows the same pattern as `UserProfile` — take a look at how that one handles side effects" |
| **Competent** | Objectives and context, can determine own approach | Directional: "The auth flow needs to handle token refresh. Think about where in the middleware chain that should happen" |

**Paige should adapt her guidance style based on where the user sits on the Dreyfus scale.** This assessment happens over time through memory — tracking what the user has worked on, what they struggled with, and what they completed independently.

**Communication mismatch warning:** Providing only high-level direction to a novice creates anxiety. Giving detailed instructions to a competent developer creates frustration. Paige must calibrate.

---

## Architecture

### Design Philosophy: Plugin-as-Brain, Electron-as-Face

The intelligence lives in a Claude Code plugin (portable, works standalone in the terminal). The Electron app provides the visual shell — the editor, file tree, terminal, and hinting UI. This separation means:

- The coaching engine is reusable without the Electron app.
- The Electron app is pure presentation — it doesn't contain AI logic.
- The plugin can be developed and tested independently.
- Long-term, the visual layer could be a VS Code extension instead of Electron.

### Communication Model: MCP Server

The Electron app runs a local MCP (Model Context Protocol) server. Claude Code connects to this server, and its tools appear as first-class tools alongside `Read`, `Grep`, `Glob`, etc.

**Why MCP instead of REST/WebSocket:**

- Claude Code speaks MCP natively — tools show up without wrapper hacks.
- Tool restrictions via `allowedTools` in plugin settings work cleanly with MCP tool names.
- Bidirectional: Paige calls MCP tools to control the UI, and reads MCP resources to get editor state.
- Scores points on the "creative use of Opus 4.6" judging criterion — using MCP to bridge AI and a custom IDE is a novel integration.

**Transport:** SSE (HTTP-based). The Electron app's Node process runs a Fastify/Express server. Claude Code connects via URL in `.mcp.json`.

**Hook flow:**

1. **SessionStart** → Injects Paige's coaching persona, scaffolding instructions, and any persisted session state (current issue, phase progress, memory context).
2. **PreToolUse** → Intercepts all tool calls. Blocks `Write`, `Edit`, `MultiEdit`. Allows `Read`, `Glob`, `Grep`. Filters `Bash` commands through a write-operation blocklist. Allows MCP tools.
3. **PostToolUse** → After Bash/Read operations, can track which files the user has been exploring.
4. **UserPromptSubmit** → Enriches every user message with current context: open files in the editor, unsaved buffer contents, diffs vs original, current phase progress.
5. **Stop** → Triggers session wrap-up: generates practice katas based on identified knowledge gaps, updates persistent memory, produces optional manager summary.

### MCP Server Surface

The MCP server runs inside the Electron app's main process and exposes tools for Paige to control the UI.

**Editor Control Tools:**

| Tool | Parameters | Description |
|---|---|---|
| `paige_open_file` | `path: string` | Open a file in the Monaco editor |
| `paige_highlight_lines` | `path: string, start: number, end: number, style: "hint" \| "error" \| "success"` | Add decorations to specific lines |
| `paige_clear_highlights` | `path?: string` | Remove decorations (all or per-file) |
| `paige_get_buffer` | `path: string` | Read the current editor buffer including unsaved edits |
| `paige_get_open_files` | — | List currently open file tabs |

**Tree View Tools:**

| Tool | Parameters | Description |
|---|---|---|
| `paige_hint_files` | `paths: string[], style: "suggested" \| "required"` | Highlight files in the explorer (the "breakable wall" glow) |
| `paige_clear_hints` | — | Remove all tree view hints |

**Session State Tools:**

| Tool | Parameters | Description |
|---|---|---|
| `paige_get_session_state` | — | Returns: open files, buffer contents, diffs, progress, current phase |
| `paige_get_diff` | `path?: string` | Git-style diff of user changes vs original file |
| `paige_show_issue_context` | `title: string, summary: string` | Update the issue context panel |

**Progress Tools:**

| Tool | Parameters | Description |
|---|---|---|
| `paige_update_phase` | `phase: number, status: "pending" \| "active" \| "complete"` | Update phase progress in the UI |
| `paige_show_message` | `message: string, type: "info" \| "hint" \| "success" \| "warning"` | Display coaching message in the Paige panel |

### Electron Application

**Stack:** Electron + React + TypeScript

**Key components (all using existing libraries, no custom implementations):**

| Component | Library | Purpose |
|---|---|---|
| Code editor | Monaco Editor (`@monaco-editor/react`) | Fully scriptable: decorations, hover providers, gutter markers, squiggly lines |
| Terminal | xterm.js (`xterm` + `xterm-addon-fit`) | Renders Claude Code output including rich formatting |
| File tree | A suitable React tree view component | File explorer with customisable node styling for hints |
| MCP server | `@modelcontextprotocol/sdk` + Fastify/Express | SSE transport; exposes tools for Paige |

**Electron process architecture:**

- **Main process:** Runs the MCP server, manages the terminal (pty), handles file system operations.
- **Renderer process:** React app with Monaco, tree view, issue context panel, progress indicators, Paige message panel.
- **IPC bridge:** Main ↔ Renderer communication for MCP tool calls that affect the UI.

### Read-Only Enforcement

Paige must not write files. Enforcement happens at two levels:

**Level 1 — Claude Code tool restrictions:**
The plugin's `allowedTools` setting strips `Write`, `Edit`, and `MultiEdit` from Claude's available tools. Claude literally cannot call them.

**Level 2 — Bash command filtering (best effort):**
The `PreToolUse` hook intercepts all Bash tool calls and rejects those matching a write-operation blocklist:

```python
WRITE_PATTERNS = [
    r'>\s',           # Redirect
    r'>>\s',          # Append redirect
    r'\btee\b',       # tee command
    r'\bsed\s+-i',    # In-place sed
    r'\bdd\b',        # dd command
    r'\bmv\b',        # Move
    r'\bcp\b',        # Copy (debatable — may allow for test setup)
    r'\brm\b',        # Remove
    r'\bmkdir\b',     # Create directory
    r'\btouch\b',     # Create file
    r'\bchmod\b',     # Change permissions
    r'\bgit\s+add',   # Git add
    r'\bgit\s+commit', # Git commit
    r'\bgit\s+push',  # Git push
]
```

This is best effort — a determined user could bypass it, but Paige isn't adversarial. The goal is to prevent the AI from accidentally writing files, not to enforce security boundaries.

**Allowed Bash operations:** `ls`, `cat`, `head`, `tail`, `find`, `git status`, `git log`, `git diff`, `git blame`, `grep`, `wc`, `file`, test runners (`npm test`, `pytest`, `cargo test`), build commands (`npm run build`, etc.).

### Memory System

**SQLite** for structured data:

- Sessions (start time, issue, repo, status)
- Plans (phases, descriptions, hints, completion status)
- Progress tracking (which phases completed, time taken, hints used)
- Dreyfus assessments (skill area, stage, evidence, last updated)
- Knowledge gaps (topic, frequency, last encountered, addressed in practice)

**ChromaDB** for semantic search:

- Past issue descriptions and solutions
- Code patterns encountered and explained
- User's own explanations and understanding (from practice mode text answers)
- Cross-project context for "this is like that bug we fixed last week" recall

**Persistence:** Both databases live in a user-level directory (e.g., `~/.paige/`) so they persist across sessions and projects. The ChromaDB collection is global; SQLite tables are partitioned by project where appropriate.

### The Coaching Pipeline

The coaching pipeline transforms a GitHub issue into scaffolded, phased guidance. It mirrors Claude Code's existing Explore → Plan flow, but adds a coaching layer.

```
GitHub Issue
    │
    ▼
┌─────────────────┐
│  Explore Agent   │  Find relevant files, understand codebase structure
│  (Read-only)     │  Uses: Glob, Grep, Read, Bash(read-only)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Plan Agent     │  Create implementation strategy with steps
│  (Read-only)     │  Uses: Glob, Grep, Read, Bash(read-only)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Coach Agent     │  THE NOVEL LAYER
│  (Paige core)   │  Transforms plan into scaffolded phases:
│                  │  - Determines phase count and granularity
│                  │  - Sets hint levels per phase (Dreyfus-aware)
│                  │  - Creates file hints and line highlights
│                  │  - Writes coaching messages for each phase
│                  │  - Identifies knowledge gap opportunities
│                  │  Uses: Memory (SQLite + ChromaDB), MCP tools
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User works...   │  Edits files in Monaco, talks to Paige in terminal
│                  │  Paige monitors via PostToolUse + UserPromptSubmit
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Review Agent     │  Checks user's work against the plan
│ (Read-only)      │  Reads buffers via MCP, compares to expected changes
│                  │  Provides feedback, suggests corrections
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Session Wrap-up  │  Stop hook triggers:
│                  │  - Update memory with session outcomes
│                  │  - Generate practice katas from knowledge gaps
│                  │  - Optionally produce manager summary
└─────────────────┘
```

---

## UI Design

### Work Mode

The primary interface where a developer works through a real GitHub issue with Paige's coaching.

**Layout components:**

1. **Issue Context Panel** (top bar or sidebar header) — Shows the current issue title, summary, and phase progress. Always visible so the user never loses context.

2. **Monaco Editor** (main area) — Full editor with Paige-controlled decorations:
   - Squiggly underlines for errors Paige has identified.
   - Coloured gutter markers for lines that need attention.
   - Hover providers showing Paige's hints when hovering highlighted lines.
   - Line highlighting for "look here" guidance.

3. **File Tree** (left sidebar) — Standard file explorer with Paige's hinting:
   - Files relevant to the current phase can glow or have a coloured indicator.
   - Directories containing relevant files show a subtle path indicator.
   - Styled like a video game — "breakable walls" that hint without forcing.

4. **Terminal** (bottom panel) — xterm.js running Claude Code with the Paige plugin. This is where the conversational coaching happens. The user talks to Paige here.

5. **Phase Progress** (sidebar or integrated into issue panel) — Visual progress through the current plan's phases. Shows completed, active, and pending phases.

### Practice Mode

A simplified sandbox environment for code katas and exercises generated from the user's knowledge gaps.

**Layout components:**

1. **Challenge Description** — What the user needs to implement, including scaffolding code with function signatures and expected return values.

2. **Editor** — Monaco editor where the user writes their solution.

3. **Run Button + Output** — Executes the code and shows pass/fail results.

4. **Review Flow** — User can request a review from Paige. Paige may:
   - Confirm the solution and offer praise.
   - Add additional constraints ("Now try it without a for loop").
   - Explain a better approach and ask the user to refactor.

5. **Non-Code Challenges** — Some practice items may be conversational:
   - "Read this documentation and explain what `useEffect` does."
   - Multiple-choice quizzes based on documentation.
   - Conversational Q&A where Paige probes understanding.

### The Hinting System

The hinting system is a layered, progressive disclosure mechanism. The user controls how much guidance they receive.

**Levels:**

1. **Hints Off** — No visual guidance. The user explores the codebase independently. Paige's coaching messages in the terminal still provide high-level direction.

2. **File Hints** — Relevant files glow in the tree view. The user knows *where* to look but not *what* to do.

3. **Line Hints** — Within relevant files, specific lines or ranges are highlighted. The user knows *where* and roughly *what* to look at.

4. **Detail Hints** — Hovering highlighted lines shows a popover with Paige's guidance for that specific location. The user gets contextual coaching without switching to the terminal.

**Toggle mechanism:** A simple UI control (button, keyboard shortcut, or slider) lets the user increase or decrease hint levels at any time. This maps directly to the scaffolding concept of "fading" — as the user gains confidence, they reduce hints.

---

## Work Mode Workflow

The work mode workflow centres on the terminal, teaching users to interact via Claude Code's conversational interface.

### 1. Session Start

The user opens Paige and sees a splash screen with available GitHub issues (filtered to issues where they're tagged). They select an issue by talking to Paige:

> "Let's work on issue #7."

### 2. Preparation and Planning

Paige runs the coaching pipeline:

1. **Explore agent** scans the codebase for relevant files and architecture.
2. **Plan agent** creates an implementation strategy.
3. **Coach agent** transforms the plan into phased, scaffolded guidance.

The result is presented to the user:

> "Alright, this is a state management bug in the auth flow. It's actually similar to that race condition we fixed in the UserProfile component last week — same pattern of missing cleanup in a `useEffect`. I've broken this into 3 phases. Phase 1: find and understand the component that handles the OAuth callback. Ready?"

### 3. Interactive Guidance

For each phase:

- Paige provides a coaching message explaining what needs to happen and why.
- If hints are enabled, relevant files glow in the tree view and relevant lines are highlighted in the editor.
- The user works — reading code, making edits, running tests.
- Paige monitors via the `UserPromptSubmit` hook (which injects buffer state, diffs, and open files).

### 4. Review Checkpoints

At any point, the user can ask for a review:

> "I think I've got it. Take a look?"

Paige reads the user's changes via the MCP `paige_get_buffer` and `paige_get_diff` tools, compares against the plan, and provides feedback:

> "Close! You've got the cleanup function in the right place, but you're not clearing the timeout ref. Check line 47 — the `timeoutId` still holds a reference after the component unmounts."

### 5. Circuit Breaker

If the user is stuck:

- **Same feedback loop detected:** Paige reframes the explanation.
- **Continued struggle:** Paige decomposes the phase into smaller steps.
- **Extended struggle:** Paige suggests a lateral move to a different phase.
- **Knowledge gap identified:** Flagged for practice mode; slightly more direct hint provided.

### 6. Session Wrap-Up

When all phases are complete (or the user ends the session):

- Memory is updated with what was worked on, what was learned, what was struggled with.
- Knowledge gaps are recorded.
- Practice katas are generated targeting those gaps.
- Optionally, a manager summary is produced.

---

## Claude Code Plugin Patterns

Our analysis of Anthropic's official Claude Code plugins informed Paige's architecture. Key patterns we're adopting:

### From `learning-output-style`

The Learning plugin is Paige's conceptual ancestor. It uses a `SessionStart` hook to inject instructions that tell Claude to stop implementing everything and instead ask the user to write code at decision points. **Key difference:** It's just prompting — it doesn't actually prevent Claude from writing, has no memory, no adaptive difficulty, and no curriculum. Paige takes this concept and makes it enforceable and intelligent.

### From `hookify`

Hookify demonstrates the exact mechanism for blocking tool usage via `PreToolUse` hooks. Its `rule_engine.py` intercepts tool calls, pattern-matches against them, and returns `permissionDecision: "deny"`. We use this same pattern for read-only enforcement — blocking `Write`, `Edit`, `MultiEdit`, and filtering `Bash` write operations.

### From `code-review`

The Code Review plugin demonstrates multi-agent orchestration: launching parallel subagents with different specialisations, then aggregating results with confidence scoring. Paige's Explore → Plan → Coach pipeline follows the same pattern. The command markdown format with `allowed-tools` restrictions is how we define Paige's slash commands.

### From `explanatory-output-style`

Shows the `SessionStart` hook pattern for injecting persona and behavioural instructions. Our `session-start.sh` follows the same structure but injects Paige's coaching persona, scaffolding framework, Dreyfus model awareness, and current session state.

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Desktop app** | Electron + React + TypeScript | Leverages web dev skills; mature ecosystem for IDE-like apps |
| **Code editor** | Monaco Editor (`@monaco-editor/react`) | VS Code's engine; scriptable decorations, hover providers, gutter markers for free |
| **Terminal** | xterm.js | Proven with Claude Code rendering (validated by Maestro project) |
| **File tree** | React tree view component (TBD) | Must support custom node styling for hints |
| **AI backbone** | Claude Code with Paige plugin | Hooks + commands + agents architecture |
| **AI ↔ UI bridge** | MCP server (SSE transport) | Native Claude Code integration; first-class tool support |
| **Structured data** | SQLite (`better-sqlite3`) | Sessions, plans, progress, Dreyfus assessments |
| **Semantic search** | ChromaDB | Cross-session pattern recall, "this is like last week" memory |
| **Issue tracking** | GitHub CLI (`gh`) | MVP focuses on GitHub issues |

### Rejected Alternatives

- **Tauri/Rust:** Considered for the app shell but rejected — thinner ecosystem, Rust FFI overhead, and the priority is speed of development for a hackathon.
- **VS Code Extension:** Considered but rejected for MVP — the extension API is complex and constraining for the novel UI elements (hinting, custom panels). Better suited for a post-hackathon v2.
- **REST API instead of MCP:** Would work but requires Bash `curl` wrappers for tool calls — fragile, string-parsing-heavy, and doesn't leverage Claude Code's native MCP support.
- **Custom editor component:** Monaco gives us 80% of the "Paige controls the editor" requirements out of the box. Building custom would be a time sink with no benefit.

---

## Hackathon Strategy

### Context

This is a one-week hackathon for the Claude Code Hackathon at Cerebral Valley. Solo developer. Projects are judged asynchronously via a 3-minute demo video, the open source repository, and a 100–200 word summary.

### Judging Criteria Alignment

| Criterion | Weight | How Paige Scores |
|---|---|---|
| **Impact** | 25% | Addresses a documented industry crisis (junior dev talent pipeline collapse). Every data point says this problem is real and worsening. Clear real-world potential. |
| **Opus 4.6 Use** | 25% | Multi-agent coaching pipeline (Explore → Plan → Coach → Review). MCP bridge between AI and custom IDE. Read-only enforcement via hooks. Adaptive Dreyfus-based guidance. Goes well beyond basic integration. |
| **Depth & Execution** | 20% | Grounded in educational research (scaffolding, Dreyfus model). Plugin architecture follows Anthropic's own patterns. Clean separation of concerns. Not just a hack — a thoughtful design. |
| **Demo** | 30% | Visual hinting system is immediately impressive. The "breakable wall" file tree glow is memorable. Seeing Paige refuse to write code and instead coach is a clear "oh, that's different" moment. |

### Demo Script (3 minutes)

1. **0:00–0:30 — The Problem** (voiceover + stats): Junior hiring is collapsing. Every AI coding tool writes code *for* developers. None of them teach.

2. **0:30–0:45 — The Pitch**: Paige flips it. Read-only by design. She coaches, you code. Claude Codes, Paige Pairs.

3. **0:45–2:15 — Work Mode Demo**: Pick a real GitHub issue. Show:
   - Paige analysing the issue and creating a phased plan.
   - The hinting system — files glowing in the tree, lines highlighted in the editor.
   - Cross-session memory: "This is like that bug we fixed last week."
   - The circuit breaker: user gets stuck, Paige reframes.
   - Code review: user asks Paige to check their work.

4. **2:15–2:45 — Practice Mode**: Quick kata generated from the session's knowledge gaps. Show the constraint escalation ("Now try it without a for loop").

5. **2:45–3:00 — The Vision**: Talent pipeline preservation. Open source with enterprise play. "Every senior was once a junior."

### MVP Scope

**In scope for the hackathon:**

- Electron app with Monaco, xterm.js, file tree, issue panel.
- Paige Claude Code plugin with SessionStart, PreToolUse, UserPromptSubmit, and Stop hooks.
- MCP server with editor control, tree view hints, and session state tools.
- Work mode: issue selection → explore → plan → coach → review flow.
- Read-only enforcement (tool restriction + bash filtering).
- Basic hinting system (file glow + line highlighting).
- SQLite for session/plan persistence.
- Basic ChromaDB for cross-session memory.
- GitHub issue integration via `gh` CLI.

**Out of scope for the hackathon:**

- Practice mode (show mockup/partial implementation if time allows).
- Audio TTS/STT.
- Slack integration.
- Manager summaries.
- Multi-tenant / production deployment.
- Full Dreyfus assessment automation (manual/heuristic for demo).
- Git tracking within Paige.
- Polished onboarding flow.

---

## Stretch Goals

Ordered by "nice to have for the demo" priority:

1. **Practice mode** — Even a simplified version (editor + run button + Paige review) would strengthen the demo significantly.
2. **Hint toggle UI** — A visible slider or button that shows hints appearing/disappearing in real-time.
3. **Session summary** — End-of-session output showing what was learned, time per phase, knowledge gaps identified.
4. **Cross-session memory demo** — Explicitly show Paige recalling something from a previous session.
5. **Audio TTS** — Paige explains code via audio while highlighting lines. Compelling demo moment but significant integration effort.

---

## Design Principles

These principles guide all implementation decisions:

1. **KISS** — Keep It Simple, Stupid. If it's not needed for the demo, don't build it.
2. **Principle of Least Astonishment** — The UI should behave the way a developer expects. No surprises.
3. **YAGNI** — You Ain't Gonna Need It. No multi-tenant, no auth, no deployment infrastructure.
4. **Pragmatism over perfection** — "Good" is good enough. We're being judged on the code and the demo, not on 99.999% uptime.
5. **Use existing components** — Monaco, xterm.js, SQLite, ChromaDB. Don't reinvent what's already built.
6. **Plugin-first architecture** — The intelligence lives in the Claude Code plugin. The Electron app is a visual shell. This makes the core portable and testable.
7. **Read-only is sacred** — Paige never writes code. This is the core differentiator. If enforcement breaks, the entire value proposition breaks.

---

## Architecture Amendment: Three-Tier Separation

> This section supersedes the original architecture's assumption that the MCP server lives inside Electron's main process. The following decisions were made during detailed design review and represent a significant improvement in separation of concerns.

### The Problem with the Original Design

The initial brainstorm placed the MCP server inside Electron's main process. While functional, this muddies the "Plugin-as-Brain, Electron-as-Face" philosophy — Electron ends up owning state management (SQLite, ChromaDB), file system access, MCP tool implementations, *and* UI rendering. That's not a thin client; that's a monolith in a trench coat.

### Revised Architecture: Three Independent Tiers

The system is split into three clearly delineated components that communicate via well-defined protocols:

```
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Claude Code     │   MCP   │  Backend Server   │   WS    │  Electron UI     │
│  Plugin          │◄───────►│                   │◄───────►│  (Thin Client)   │
│                  │  (SSE)  │  - MCP tools      │  (WS)   │                  │
│  - Hooks         │         │  - File I/O       │         │  - Monaco editor │
│  - Persona       │         │  - SQLite/Chroma  │         │  - xterm.js      │
│  - Read-only     │         │  - Action logging  │         │  - File tree     │
│    enforcement   │         │  - Observer loop   │         │  - Phase UI      │
│  - Coaching      │         │  - PTY orchestration│        │  - Hint display  │
│    instructions  │         │                   │         │                  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

**Claude Code Plugin** — The personality. Injects Paige's coaching persona, enforces read-only constraints via hooks, and enriches user prompts with session context.

**Backend Server** — The brain stem. Owns all state (SQLite, ChromaDB), all file system access, all MCP tool implementations, and the Observer loop. Single source of truth. Claude Code communicates with it via MCP (SSE transport). Electron communicates with it via WebSocket.

**Electron UI** — The face. A genuinely thin rendering layer. Receives instructions from the backend (open file, highlight lines, update phase) and pushes user activity back (buffer updates, file requests, user actions). Contains no AI logic, no state management, no direct file system access.

### Communication Protocols

```
Claude Code ←→ MCP (SSE) ←→ Backend Server ←→ WebSocket ←→ Electron UI
```

**MCP (SSE):** Claude Code → Backend. Tool calls like `paige_highlight_lines`, `paige_get_buffer`, `paige_update_phase`. These are the tools defined in the [MCP Server Surface](#mcp-server-surface) section — the tool schemas remain the same, they just live on the standalone backend rather than inside Electron.

**WebSocket:** Backend ↔ Electron. Bidirectional. Two categories of messages:

1. **Server → Client (push):** UI updates triggered by MCP tool calls, file tree changes, Observer nudges.
2. **Client → Server (push/request):** Buffer state updates, file open/save requests, user action events.

### File I/O as a Backend Responsibility

All file operations are routed through the backend server. Electron never touches the filesystem directly.

**When the user opens a file:**

1. Electron sends `{ type: "file_open", payload: { path } }` to the backend via WebSocket.
2. Backend reads the file from disk, logs the open event, and responds with `{ type: "file_content", payload: { path, content, language } }`.
3. Electron renders the content in Monaco.

**When the user saves a file:**

1. Electron sends `{ type: "file_save", payload: { path, content } }` to the backend.
2. Backend writes to disk, logs the save event (including a snapshot/diff), and acknowledges.

**When the user edits a buffer (continuous):**

1. Electron debounces Monaco's `onChange` events (~300ms after last keystroke).
2. Sends `{ type: "buffer_update", payload: { path, content, cursorPosition } }` to the backend.
3. Backend updates its in-memory buffer cache. No response needed.

**Why this matters:**

- **Complete action log.** Every file open, edit, and save is recorded. The Review Agent gets a full timeline of user behaviour, not just before/after diffs.
- **Server-side diff computation.** The backend can snapshot file state at phase boundaries and compute diffs without depending on git for in-session tracking.
- **Coaching signals for free.** "User opened 7 files before finding the right one" and "User saved 12 times in Phase 2 but twice in Phase 3" are confidence/struggle indicators that the Observer can use without extra instrumentation.
- **Session replay.** The data to replay an entire coaching session exists as a natural byproduct. Stretch goal, but the infrastructure is free.
- **Third layer of read-only enforcement.** The backend simply doesn't expose a write-file operation to Claude Code's MCP tools — only to the Electron client via WebSocket. Belt, suspenders, and a healthy fear of gravity.

**File tree population:** On session start, the backend scans the project directory and pushes the full tree structure to Electron. It then watches for filesystem changes (`chokidar` or Node's native `fs.watch`) and pushes tree updates as they occur.

### PTY Management: Option B with Server Orchestration

The Electron main process owns the Claude Code PTY via `node-pty`. This is the conventional xterm.js integration pattern and keeps PTY lifecycle management simple.

However, the backend can instruct Electron to nudge the PTY via WebSocket, enabling proactive coaching without requiring the backend to own the subprocess.

```
┌─────────┐  nudge_prompt    ┌─────────┐  pty.write()  ┌─────────────┐
│ Backend │ ───────────────► │Electron │ ────────────► │ Claude Code  │
│ Server  │                  │ (main)  │               │   (PTY)     │
└─────────┘                  └─────────┘               └─────────────┘
                                  ▲                           │
                                  │      pty.onData()         │
                                  └───────────────────────────┘
```

### The Observer: Proactive Coaching via Two-Tier Model Evaluation

The Observer is a background process on the backend that monitors user activity and decides whether Paige should proactively nudge the user. Rather than relying on brittle rules-based pattern matching, the Observer uses a **two-tier model architecture**: a fast, cheap model makes the nudge decision, and if it says yes, the full Paige persona (via Claude Code) delivers the coaching.

#### Why Not Rules-Based?

A rules engine would require hand-tuned thresholds for every scenario and would fail on nuance. "User opened the wrong file and is editing it" (nudge) vs. "User opened a related file to understand context before moving to the right one" (leave them alone) — a regex can't make that call. A small model can.

#### Observer Architecture

```
Action Log + Buffer State + Phase Plan + Dreyfus Stage
                    │
                    ▼
           ┌─────────────────┐
           │  Observer Loop   │  Event-driven with cooldown
           │  Assembles       │
           │  context snapshot │
           └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  Triage Model    │  Haiku / flash-tier
           │  "Should Paige   │  Fast, cheap, structured output
           │   nudge?"        │
           └────────┬────────┘
                    │
               yes / no
                    │
              if yes ▼
           ┌─────────────────┐
           │  Nudge prompt    │  Sent to Electron via WS
           │  assembled from  │  Written to PTY stdin
           │  model's signal  │  Claude Code responds as Paige
           └─────────────────┘
```

The triage model does **not** write the coaching message. It makes a binary decision (nudge or don't) with a confidence score and a signal type. Claude Code's Paige persona — injected at `SessionStart` — handles the actual coaching response. This keeps the Observer cheap and Paige's voice consistent.

#### Triage Model Input

The Observer assembles a tight, structured context snapshot for the triage model:

```json
{
  "current_phase": {
    "number": 1,
    "description": "Find and understand the OAuth callback handler",
    "expected_files": ["src/handlers/oauth.ts"],
    "status": "active"
  },
  "recent_actions": [
    { "type": "file_open", "path": "src/middleware/auth.ts", "ago": "3m12s" },
    { "type": "buffer_update", "path": "src/middleware/auth.ts", "ago": "45s" },
    { "type": "buffer_update", "path": "src/middleware/auth.ts", "ago": "12s" }
  ],
  "time_since_last_save": "4m",
  "time_since_last_nudge": "never",
  "dreyfus_stage": "novice",
  "user_idle": false
}
```

#### Triage Model Output

The model responds with structured output:

```json
{
  "should_nudge": true,
  "confidence": 0.85,
  "signal": "wrong_file",
  "reasoning": "User has been editing middleware/auth.ts for 3+ minutes but the phase expects work in handlers/oauth.ts. No indication they're reading for context — they're actively editing.",
  "suggested_context": {
    "current_file": "src/middleware/auth.ts",
    "expected_file": "src/handlers/oauth.ts",
    "time_in_file": "3m12s"
  }
}
```

The `suggested_context` block is passed through to the nudge prompt that Claude Code receives. The `reasoning` field is logged for observability but not sent to the user.

#### Example Nudge Scenarios

| Signal | Triage Model Reasoning | Paige's Response (via Claude Code) |
|---|---|---|
| `wrong_file` | User actively editing a file not in the phase's expected file list | "Hey, the auth callback lives in `src/handlers/oauth.ts`, not `src/middleware/auth.ts`." |
| `scope_drift` | User's diff is introducing changes unrelated to the phase objective | "Pause — you're refactoring the state management, but the issue is just the cleanup function." |
| `idle` | No user actions for extended period | "Stuck? Want me to break this phase down into smaller steps?" |
| `phase_complete` | User saved, tests pass, changes match phase expectations | "Nice. Phase 2 looks done. Ready for Phase 3?" |
| `edit_loop` | User repeatedly editing and reverting the same lines | Circuit breaker activation — reframe, decompose, or suggest lateral move. |
| `no_nudge` | User opened a related file but is clearly reading, not editing | *Nothing. Leave them alone.* |

#### Observer Trigger Model

The Observer does **not** run on a fixed timer. It is event-driven with a cooldown:

**Trigger events** (any of these cause the Observer to evaluate):

- A file is opened or saved.
- Buffer updates exceed an edit-count threshold since last evaluation.
- User goes idle for >N minutes (configurable, default 5).
- A phase transition occurs.

**Cooldown rules:**

- Minimum 2–3 minutes between nudges (unless urgent).
- If nothing has changed since the last evaluation, skip the model call entirely — don't burn tokens on a no-op.
- Flow state detection: if the user is typing rapidly and saving frequently, suppress evaluation. They're in the zone.
- Dreyfus-aware frequency: Novices get more frequent check-ins. Competent developers get left alone unless something's genuinely wrong.
- User control: a "mute Paige" toggle that suppresses proactive nudges entirely.

#### Cost

Negligible. Haiku-tier models are fractions of a cent per call. Even at worst case (one evaluation every 30 seconds), a one-hour session is ~120 calls — pennies. The event-driven trigger model means real-world usage will be significantly less.

#### Nudge Flow

1. Observer trigger fires.
2. Backend assembles context snapshot.
3. Triage model evaluates: nudge or not.
4. If `should_nudge: true` and confidence exceeds threshold:
   - Backend sends `{ type: "nudge_prompt", payload: { signal, context } }` to Electron via WebSocket.
   - Electron writes the nudge prompt to the PTY's stdin.
   - Claude Code processes it as Paige and responds.
   - Response flows through stdout back to xterm.js (rendered via the thinking block pattern — see below).

### Hidden Nudge UX: The "Thinking Block" Pattern

System nudges and their responses should be visually distinct from user-initiated conversation. The model is Claude's own thinking blocks — collapsed by default, expandable for full transparency.

**Implementation:**

Electron controls the rendering pipeline between the PTY and xterm.js:

```
pty.onData(data) → filterLayer(data) → xterm.write(data)
```

When a system nudge is sent:

1. Electron sets `systemPromptActive = true`.
2. Writes the nudge prompt to PTY stdin.
3. The filter layer **buffers** all PTY output instead of passing it to xterm.js.
4. A "Paige is observing..." indicator appears in the UI.
5. Electron detects that Claude Code has finished responding (idle prompt pattern detection).
6. `systemPromptActive = false`.
7. Buffered content is stored and rendered as a collapsible block in the terminal output stream.
8. Normal rendering resumes.

**Visual treatment:**

```
┌─────────────────────────────────────────┐
│ 🔍 Paige checked in (2 min ago)      ▶ │
└─────────────────────────────────────────┘
```

Expanded:

```
┌─────────────────────────────────────────┐
│ 🔍 Paige checked in (2 min ago)      ▼ │
├─────────────────────────────────────────┤
│ [System] User has been editing          │
│ src/middleware/auth.ts for 3 minutes.   │
│ Expected file: src/handlers/oauth.ts    │
│                                         │
│ [Paige] Hey, I think you might be in   │
│ the wrong place — the OAuth callback    │
│ handler lives in src/handlers/oauth.ts. │
│ The middleware file handles token        │
│ validation, not the callback flow.      │
└─────────────────────────────────────────┘
```

Users who want full transparency can expand every block. Users who just want to code see a quiet breadcrumb and the resulting coaching message (if Paige decides to surface one directly).

### Nudge Prompt Format

The nudge prompt sent to Claude Code is assembled from the triage model's output. It provides structured context signals, and Claude Code's persona instructions (from `SessionStart`) determine how to respond as Paige.

```
[PAIGE_OBSERVER] {
  "signal": "wrong_file",
  "confidence": 0.85,
  "context": {
    "current_file": "src/middleware/auth.ts",
    "expected_file": "src/handlers/oauth.ts",
    "time_in_file": "3m12s",
    "current_phase": 1,
    "phase_description": "Find and understand the OAuth callback handler"
  }
}
```

This separation means the triage model handles the *decision* (should we nudge?) while Paige's personality and coaching style remain consistent through Claude Code's persona layer. The Observer never writes user-facing text — it only provides signals.

### Parallel Development Strategy

The three-tier architecture enables genuinely parallel development. The contract between tiers is the spec — specifically:

1. **MCP Tool Schemas** — What Claude Code can call on the backend. Already mostly defined in the [MCP Server Surface](#mcp-server-surface) section; needs formalisation as JSON schemas.

2. **WebSocket Message Protocol** — The new piece. Typed messages between backend and Electron covering:
   - File operations (open, save, content, tree updates)
   - Buffer state (debounced updates from client)
   - UI commands (highlights, decorations, phase updates, coaching messages)
   - PTY orchestration (nudge_prompt, system state)
   - Session lifecycle (handshake, heartbeat, session start/end)

3. **Plugin Hook Specifications** — What the Claude Code plugin injects/intercepts at each lifecycle point (SessionStart, PreToolUse, PostToolUse, UserPromptSubmit, Stop).

With these specs defined, all three components can be built and tested independently against mocks before integration.

### Impact on MVP Scope

This amendment **does not change** the MVP feature set. The Observer (including the triage model) and hidden nudge UX are stretch goals. For the hackathon:

- The three-tier separation is implemented.
- The backend owns state, file I/O, and MCP tools.
- Electron is a thin client communicating via WebSocket.
- The PTY lives in Electron (Option B).
- The WebSocket protocol supports `nudge_prompt` messages, but the Observer loop and triage model are not active.
- The architecture is explicitly designed to support proactive coaching post-MVP.

### Updated Design Principles

Added to the existing [Design Principles](#design-principles):

8. **Backend is the single source of truth** — All state, all file I/O, all logging flows through the backend. Electron renders. Claude Code coaches. Neither owns data.
9. **Spec-driven development** — The MCP tool schemas and WebSocket message protocol are the contracts. Build to the spec, integrate with confidence.
10. **Observable by default** — Log everything that flows through the backend. Coaching signals, session replay, and debugging all benefit from comprehensive observability. If data flows through the backend, it gets logged.