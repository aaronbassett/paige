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
- [Architecture Amendment: Claude API Usage Strategy](#architecture-amendment-claude-api-usage-strategy)

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

---

## Architecture Amendment: Claude API Usage Strategy

> This section extends the architecture with a systematic approach to using the Claude API for backend-driven intelligence. Offload evaluative, transformative, and analytical tasks from Claude Code's conversational context to direct API calls made by the backend server.

### The Problem with Claude-Code-for-Everything

The initial brainstorm routes all intelligence through Claude Code's PTY — the Explore, Plan, Coach, and Review agents all run as conversational turns in the terminal. This works, but it has significant drawbacks:

**Context pollution.** Every analytical task (assessing Dreyfus stage, evaluating diffs, generating kata specs) consumes Claude Code's context window. That window is shared with the user's conversation. The more background work Paige does *through* Claude Code, the less room there is for the actual coaching dialogue.

**Model inflexibility.** Claude Code runs on one model (Opus 4.6 for the hackathon). But not every task needs Opus. A nudge/no-nudge binary decision? Haiku. A plan-to-phases transformation? Sonnet. Code explanation for a sidebar panel? Sonnet. We're burning premium tokens on janitor work.

**Architectural coupling.** If every intelligent operation flows through the PTY, the backend is just a dumb pipe. The three-tier architecture promised that the backend is "the brain stem" — but without API calls, it's more like a filing cabinet with delusions of grandeur.

### The Principle: Tools vs. Judgement

The dividing line is clean:

**Claude Code** handles anything that requires **tool access** (Read, Grep, Glob, Bash) or **conversational continuity** (the user is talking to Paige in the terminal).

**API calls** handle anything that is **evaluative**, **transformative**, or **analytical** — tasks where all inputs are already available and the output is structured.

```
Claude Code (PTY)              API Calls (Backend)
─────────────────              ───────────────────
Explore Agent (needs tools)    Coach Agent (plan → phases)
Review Agent (needs context)   Observer triage (nudge decision)
User conversation              "Explain this" (code → explanation)
Delivering nudges              Knowledge gap extraction
Delivering reviews             Dreyfus stage assessment
                               Memory (write + retrieval filtering)
                               Practice mode review
                               GitHub issue assessment
                               Learning materials research
                               Manager summaries
```

If a task needs to `Read` a file, `Grep` a codebase, or run `Bash` commands — it goes through Claude Code. If you can assemble all the inputs into a single prompt and get structured JSON back — it goes through the API.

### API Call Inventory

Each call is described with its trigger, inputs, model tier, and output schema.

#### 1. Observer Triage

Already described in the [Observer section](architecture-amendment.md#the-observer-proactive-coaching-via-two-tier-model-evaluation) of the architecture amendment. Included here for completeness.

- **Trigger:** Observer event loop (file open, save, buffer threshold, idle timeout, phase transition).
- **Model:** Haiku (fractions of a cent per call).
- **Input:** Structured context snapshot — current phase, recent actions, time deltas, Dreyfus stage.
- **Output:** `{ should_nudge, confidence, signal, reasoning, suggested_context }`.
- **Notes:** Binary decision. Does *not* write user-facing text — only provides signals for Claude Code's persona to act on.

#### 2. Coach Agent (Plan-to-Phases Transformation)

The original brainstorm has the Coach Agent as part of the Claude Code pipeline. But its job is fundamentally *transformation*, not conversation: take a plan + Dreyfus stage + memory context, output phased scaffolded guidance with hint metadata. That's a single structured API call.

- **Trigger:** Plan Agent completes (output received from Claude Code's Explore → Plan flow).
- **Model:** Sonnet (needs strong reasoning for pedagogical decisions).
- **Input:**
  - Plan output from Claude Code (implementation strategy, file list, step descriptions).
  - User's Dreyfus stage assessment (from SQLite).
  - Relevant memory context (filtered by API call #6b — validated memories with `connection` and `use_in_coaching` guidance).
  - Scaffolding framework reference (phase granularity guidelines, hint level rules).
- **Output:**
  ```json
  {
    "phases": [
      {
        "number": 1,
        "title": "Find and understand the OAuth callback handler",
        "description": "Coaching message explaining what and why",
        "expected_files": ["src/handlers/oauth.ts"],
        "hint_level": "line",
        "hints": {
          "file_hints": [
            { "path": "src/handlers/oauth.ts", "style": "suggested" }
          ],
          "line_hints": [
            { "path": "src/handlers/oauth.ts", "start": 38, "end": 52, "style": "hint", "hover_text": "The cleanup function should go here" }
          ]
        },
        "knowledge_gap_opportunities": ["useEffect cleanup", "stale closure"]
      }
    ],
    "memory_connection": "Similar to the race condition in UserProfile (session 2025-01-15)",
    "estimated_difficulty": "intermediate"
  }
  ```
- **Notes:** This is the novel coaching layer — the thing that differentiates Paige from a basic planning agent. Pulling it into a dedicated API call with a carefully crafted system prompt means we can iterate on the pedagogical quality independently of the Claude Code plugin.

#### 3. "Explain This" Sidebar

A UI-driven feature: user highlights code in Monaco, clicks "Explain," and gets an explanation in a sidebar panel — without touching the terminal conversation at all.

- **Trigger:** User action in Electron UI (highlight + explain button, or right-click context menu).
- **Model:** Sonnet (needs solid code comprehension; Haiku might underperform on complex code).
- **Input:**
  - Selected code snippet.
  - File path and language.
  - Surrounding context (±50 lines).
  - User's Dreyfus stage (calibrates explanation depth).
- **Output:**
  ```json
  {
    "explanation": "This function handles the OAuth callback by...",
    "key_concepts": ["OAuth 2.0 callback", "token exchange", "error handling"],
    "analogy": "Think of this like a bouncer checking your ID — the callback is the moment you hand over the temporary pass and get a real wristband.",
    "related_files": ["src/middleware/auth.ts", "src/utils/token.ts"]
  }
  ```
- **Notes:** Rendered in a dedicated Electron panel, not the terminal. This is an entirely new interaction surface that doesn't exist in the original brainstorm. It's low-cost, high-value for the demo ("look, Paige explains code without losing her train of thought"), and trivial to implement since it's a stateless API call rendered in a React component.

#### 4. Knowledge Gap Extraction

At session wrap-up, analyse what the user struggled with and generate practice kata specifications.

- **Trigger:** `Stop` hook fires (session end).
- **Model:** Sonnet (analytical reasoning over session data).
- **Input:**
  - Session action log (file opens, saves, edit frequency, time-per-phase).
  - Phase specs and completion status.
  - Hints used (levels requested, frequency of escalation).
  - Review feedback history (issues identified, repeat issues).
  - Existing knowledge gap records (from SQLite — to avoid duplicates).
- **Output:**
  ```json
  {
    "knowledge_gaps": [
      {
        "topic": "useEffect cleanup functions",
        "evidence": "Struggled for 8 minutes on Phase 2, needed 3 hint escalations, review identified same issue twice",
        "severity": "high",
        "related_concepts": ["React lifecycle", "memory leaks", "stale closures"]
      }
    ],
    "kata_specs": [
      {
        "title": "Cleanup Timer in useEffect",
        "description": "Write a component that starts a timer on mount and properly cleans it up on unmount",
        "scaffolding_code": "function TimerComponent() {\n  // TODO: implement\n}",
        "test_cases": ["timer starts on mount", "timer clears on unmount", "no memory leak after unmount"],
        "constraints": [],
        "follow_up_constraint": "Now implement it with useRef instead of a local variable"
      }
    ],
    "session_summary": {
      "phases_completed": 3,
      "total_time": "47m",
      "hints_used": 12,
      "independent_completions": 1
    }
  }
  ```
- **Notes:** This feeds directly into SQLite (knowledge gaps table) and the practice mode system. The kata specs are stored and surfaced when the user enters practice mode.

#### 5. Dreyfus Stage Assessment

Periodic evaluation of the user's skill level across different domains.

- **Trigger:** End of session, or after N sessions in the same skill area.
- **Model:** Sonnet (nuanced judgement required).
- **Input:**
  - Accumulated evidence from SQLite: tasks completed independently, hint frequency by topic, time trends, error patterns.
  - Current Dreyfus assessments (to detect progression or regression).
  - Recent session summaries.
- **Output:**
  ```json
  {
    "assessments": [
      {
        "skill_area": "React state management",
        "stage": "advanced_beginner",
        "previous_stage": "novice",
        "confidence": 0.75,
        "evidence": "Completed 3 state management tasks with decreasing hint usage. Still needs guidance on complex side effects.",
        "recommendation": "Transition to guided hints (pattern-based) instead of prescriptive (line-level)"
      }
    ]
  }
  ```
- **Notes:** This is the feedback loop that makes Paige adaptive. Updated assessments change the Coach Agent's hint calibration and the Observer's nudge frequency. Should absolutely *not* run in Claude Code's context — it's background analytics.

#### 6. Memory Summarisation & Retrieval Filtering

This call serves two directions of the memory system: **writing** (session → ChromaDB) and **reading** (ChromaDB → Coach Agent). Both involve a model deciding what's actually relevant — one for storage, one for retrieval.

**6a. Memory Write — Session Summarisation**

Before storing session data to ChromaDB, generate summaries and decide what's worth persisting.

- **Trigger:** Session wrap-up (after knowledge gap extraction).
- **Model:** Haiku (summarisation is straightforward).
- **Input:**
  - Session transcript (condensed — key exchanges, not every buffer update).
  - Issues worked on.
  - Solutions arrived at.
  - Patterns encountered.
- **Output:**
  ```json
  {
    "memories": [
      {
        "content": "Worked on OAuth callback race condition in auth flow. User learned about useEffect cleanup but still struggles with ref-based cleanup patterns.",
        "tags": ["oauth", "useEffect", "race-condition", "cleanup"],
        "importance": "high"
      },
      {
        "content": "User independently identified the component responsible for token refresh without hints — showing growing familiarity with the auth module structure.",
        "tags": ["auth", "navigation", "independence"],
        "importance": "medium"
      }
    ]
  }
  ```
- **Notes:** These get embedded and stored in ChromaDB. They power the "this is like that bug we fixed last week" recall. Haiku is sufficient because the task is extractive summarisation, not deep reasoning.

**6b. Memory Read — Retrieval Filtering**

Raw ChromaDB semantic search returns results ranked by vector similarity, but similarity ≠ relevance. A query about "OAuth callback cleanup" might pull back memories about OAuth token refresh, OAuth redirect URIs, and an unrelated cleanup function in a different module. A model needs to filter for what's actually useful before we stuff it into the Coach Agent's prompt.

- **Trigger:** Coaching pipeline, after the Plan Agent completes and before the Coach Agent API call (#2).
- **Model:** Haiku (classification/filtering task — does this memory help with this specific issue?).
- **Input:**
  - Current issue summary and plan output.
  - Top N ChromaDB results from semantic search (raw, unfiltered).
  - Current phase context (if mid-session retrieval).
- **Output:**
  ```json
  {
    "relevant_memories": [
      {
        "content": "Worked on OAuth callback race condition in auth flow. User learned about useEffect cleanup but still struggles with ref-based cleanup patterns.",
        "relevance": "direct",
        "connection": "Same component, same pattern — user has prior context here but needs reinforcement on ref cleanup.",
        "use_in_coaching": "Reference this as a callback to prior work. Builds confidence and continuity."
      }
    ],
    "discarded": [
      {
        "content": "User set up OAuth redirect URIs in the dashboard config.",
        "reason": "OAuth-adjacent but unrelated to the code-level cleanup pattern."
      }
    ]
  }
  ```
- **Notes:** This is essentially a RAG refinement step. ChromaDB does the fast, cheap vector lookup. Haiku does the cheap, smart relevance filtering. The Coach Agent (Sonnet) only sees memories that have been validated as genuinely useful. The `connection` and `use_in_coaching` fields give the Coach Agent explicit guidance on *how* to use each memory, not just *that* it exists. The `discarded` array is logged for observability but not forwarded.

#### 7. Practice Mode Code Review

When the user submits a kata solution, evaluate correctness and generate follow-up constraints.

- **Trigger:** User clicks "Submit" / "Review" in practice mode.
- **Model:** Sonnet (needs to evaluate code correctness and generate pedagogically useful follow-ups).
- **Input:**
  - Kata spec (description, scaffolding, test cases, constraints).
  - User's submitted code.
  - User's Dreyfus stage for this topic.
- **Output:**
  ```json
  {
    "correct": true,
    "feedback": "Nice — that's clean and handles the edge cases. The cleanup runs on unmount and the ref prevents stale closures.",
    "follow_up": {
      "type": "constraint_escalation",
      "constraint": "Now try implementing it with AbortController instead of a boolean flag",
      "reason": "AbortController is the modern pattern for cancellable async operations"
    },
    "dreyfus_signal": "advancing"
  }
  ```
- **Notes:** Self-contained evaluation. No file system access, no codebase context. Just the problem + the solution → feedback.

#### 8. GitHub Issue Assessment & Curation

On launch, Paige's dashboard shows a curated list of GitHub issues the user could work on. Rather than dumping a raw issue list, this API call assesses each issue against the user's skill profile and prioritises accordingly.

- **Trigger:** App launch / dashboard load, or periodic refresh.
- **Model:** Sonnet (needs to understand issue descriptions, estimate complexity, and match against user profile).
- **Input:**
  - Raw GitHub issues from `gh` CLI (title, body, labels, assignees, comments).
  - User's Dreyfus stage assessments (from SQLite — per skill area).
  - Recent session history (what they've worked on, what they've completed).
  - Known knowledge gaps (from SQLite).
  - ChromaDB context (similar past issues the user has tackled).
- **Output:**
  ```json
  {
    "issues": [
      {
        "number": 42,
        "title": "Fix OAuth callback race condition",
        "summary": "The OAuth handler doesn't clean up timers on unmount, causing a race condition when users navigate away mid-auth.",
        "suitability": "good_fit",
        "suitability_reason": "Matches your current React lifecycle skill level. Similar to the useEffect cleanup pattern you practised last week, but in a real-world auth context.",
        "estimated_difficulty": "intermediate",
        "relevant_skills": ["React lifecycle", "useEffect cleanup", "OAuth"],
        "priority_score": 0.92,
        "priority_factors": {
          "user_tagged": true,
          "similar_to_recent_work": true,
          "addresses_knowledge_gap": true,
          "team_urgency": "medium"
        },
        "learning_opportunities": ["Real-world race condition debugging", "Auth flow architecture"]
      },
      {
        "number": 37,
        "title": "Refactor database connection pooling",
        "summary": "Connection pool exhaustion under load. Needs investigation and a fix to the pool configuration.",
        "suitability": "stretch",
        "suitability_reason": "You haven't worked with database internals yet. This would be a significant stretch but could open up backend infrastructure skills.",
        "estimated_difficulty": "advanced",
        "relevant_skills": ["Database", "Connection pooling", "Performance"],
        "priority_score": 0.45,
        "priority_factors": {
          "user_tagged": false,
          "similar_to_recent_work": false,
          "addresses_knowledge_gap": false,
          "team_urgency": "low"
        },
        "learning_opportunities": ["Database connection management", "Performance debugging"]
      }
    ]
  }
  ```
- **Notes:** The `suitability` field drives dashboard UI — `good_fit` issues are prominent, `stretch` issues are shown with a "challenge" badge, and `too_advanced` issues are dimmed or hidden. The `priority_factors` breakdown lets the UI show *why* an issue is recommended ("You're tagged in this," "Similar to last week's work"). The `summary` field is a Paige-voice digest, not the raw GitHub issue body — concise, contextualised, and jargon-calibrated to the user's level.

#### 9. Knowledge Gap Learning Materials Research

Paige doesn't just identify what you don't know — she finds resources to help you learn it. This call takes knowledge gaps from SQLite and finds relevant documentation, tutorials, articles, and videos.

- **Trigger:** App launch / dashboard load, or after new knowledge gaps are recorded (post-session).
- **Model:** Sonnet (needs to reason about what resources are appropriate for the user's level and learning style, and generate useful search-oriented output).
- **Input:**
  - Knowledge gaps from SQLite (topic, severity, related concepts, frequency).
  - User's Dreyfus stage for the relevant skill area.
  - Technology stack context (React? Go? Python? What framework versions?).
  - Previously recommended resources (to avoid repeats).
- **Output:**
  ```json
  {
    "recommendations": [
      {
        "knowledge_gap": "useEffect cleanup functions",
        "resources": [
          {
            "type": "documentation",
            "title": "Synchronizing with Effects – React Docs",
            "url": "https://react.dev/learn/synchronizing-with-effects",
            "description": "Official React docs on useEffect, including the cleanup section. Start here.",
            "relevance": "direct",
            "estimated_time": "15 min read"
          },
          {
            "type": "article",
            "title": "A Complete Guide to useEffect",
            "url": "https://overreacted.io/a-complete-guide-to-useeffect/",
            "description": "Dan Abramov's deep dive. More advanced but excellent for understanding the mental model.",
            "relevance": "deep_dive",
            "estimated_time": "45 min read"
          },
          {
            "type": "video",
            "title": "React useEffect Cleanup Explained",
            "url": "https://youtube.com/...",
            "description": "Visual walkthrough of cleanup patterns with timer and subscription examples.",
            "relevance": "supplementary",
            "estimated_time": "12 min watch"
          }
        ],
        "study_order": "Start with the official docs, then try the practice kata. Come back to the article if you want the deeper mental model.",
        "practice_connection": "After reading, try the 'Cleanup Timer in useEffect' kata in practice mode."
      }
    ]
  }
  ```
- **Notes:** The model generates URLs based on its training knowledge — these are well-known, stable resources (official docs, popular blog posts, established YouTube channels). For a production system, you'd want URL validation or a search API integration, but for the hackathon, Sonnet's knowledge of canonical developer resources is reliable enough. The `study_order` field gives Paige a way to sequence the learning path, and `practice_connection` ties resources back to the kata system. The `relevance` field helps the UI group resources: "Start here" → "Go deeper" → "Also helpful."

#### 10. Manager Summary

Stretch goal. Generate a non-technical summary of the session for team leads.

- **Trigger:** Explicit user action or end-of-session option.
- **Model:** Haiku (prose generation from structured data).
- **Input:** Session summary, phases completed, time allocation, skills demonstrated.
- **Output:** Prose paragraph suitable for a stand-up update or 1:1.
- **Notes:** Lowest priority. Include if time allows.

### Model Selection Strategy

Not all tasks are created equal. The API gives us the flexibility to pick the right model for each job:

| Model Tier | Cost | Use Cases |
|---|---|---|
| **Haiku** | Fractions of a cent | Observer triage, memory summarisation, memory retrieval filtering, manager summaries |
| **Sonnet** | Low cents | Coach Agent, "Explain this," knowledge gap extraction, Dreyfus assessment, practice mode review, GitHub issue assessment, learning materials research |
| **Opus** | Reserved for Claude Code | Explore Agent (tool use), Plan Agent (tool use), Review Agent (tool use + codebase context), conversational coaching, nudge delivery |

The principle: use the cheapest model that produces reliable output for the task. Structured JSON output with clear schemas makes smaller models perform well — they don't need to be creative, just precise.

### Backend API Client Architecture

All API calls are made by the backend server. The Electron UI and Claude Code plugin never call the API directly.

```
┌──────────────────────────────────────────────────────┐
│  Backend Server                                      │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ API Client  │  │ Prompt      │  │ Response     │  │
│  │             │  │ Templates   │  │ Validators   │  │
│  │ - Model     │  │             │  │              │  │
│  │   selection │  │ - System    │  │ - Schema     │  │
│  │ - Retry     │  │   prompts   │  │   validation │  │
│  │   logic     │  │ - Input     │  │ - Fallback   │  │
│  │ - Rate      │  │   assembly  │  │   handling   │  │
│  │   limiting  │  │ - JSON mode │  │ - Logging    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                      │
│  Called by:                                           │
│  - Observer loop (triage)                             │
│  - Coaching pipeline (memory retrieval, coach)        │
│  - Session lifecycle (gaps, dreyfus, memory write)    │
│  - WebSocket handlers (explain this, practice review) │
│  - Dashboard loading (issue assessment, materials)    │
└──────────────────────────────────────────────────────┘
```

**Key implementation details:**

- **Single API client instance** with connection pooling and retry logic.
- **Prompt templates** stored as separate files, versioned alongside the backend code. Each API call has a dedicated system prompt and input assembly function.
- **Response validators** that verify structured output against expected JSON schemas. If validation fails, retry once with a "your output was malformed" correction prompt.
- **Logging** — every API call is logged with input hash, model used, latency, token count, and cost estimate. Essential for tracking the $500 budget.

### Cost Estimation

Back-of-envelope for a typical one-hour coaching session (including dashboard load):

| Call | Frequency | Model | Est. Cost |
|---|---|---|---|
| Observer triage | ~20–40 calls | Haiku | ~$0.02 |
| Coach Agent | 1 call | Sonnet | ~$0.03 |
| "Explain this" | 2–3 calls | Sonnet | ~$0.06 |
| Knowledge gap extraction | 1 call | Sonnet | ~$0.03 |
| Dreyfus assessment | 1 call | Sonnet | ~$0.02 |
| Memory summarisation | 1 call | Haiku | ~$0.01 |
| Memory retrieval filtering | 1–2 calls | Haiku | ~$0.01 |
| Practice mode review | 1–3 calls | Sonnet | ~$0.04 |
| GitHub issue assessment | 1 call (on launch) | Sonnet | ~$0.05 |
| Learning materials research | 1 call (on launch) | Sonnet | ~$0.03 |
| **Session total** | | | **~$0.30** |

At ~$0.30 per session, $500 covers roughly **1,650 sessions**. More than enough for development, testing, and demo. Claude Code's own token usage (Opus via the PTY) is separate and covered by the hackathon's Claude Max subscription. Note that the Review Agent now runs through Claude Code as a subagent, so its cost is absorbed into the PTY's Opus token budget rather than appearing here.

### WebSocket Protocol Additions

New message types for API-driven features:

**Electron → Backend:**

| Message Type | Payload | Triggers |
|---|---|---|
| `explain_request` | `{ path, selection: { start, end }, surrounding_context }` | User highlights code + clicks "Explain" |
| `practice_submit` | `{ kata_id, user_code }` | User submits practice mode solution |
| `dashboard_load` | `{ }` | App launch / dashboard navigation |
| `dashboard_refresh_issues` | `{ }` | User pulls to refresh or clicks refresh |

**Backend → Electron:**

| Message Type | Payload | Triggers |
|---|---|---|
| `explain_response` | `{ explanation, key_concepts, analogy, related_files }` | API call completes |
| `practice_review` | `{ correct, feedback, follow_up, dreyfus_signal }` | API call completes |
| `phase_plan` | `{ phases: [...] }` | Coach Agent API call completes |
| `dashboard_state` | `{ dreyfus, stats, in_progress_sessions, issues, katas, learning_materials }` | Dashboard data assembled (may arrive in parts) |
| `dashboard_issues` | `{ issues: [...] }` | GitHub issue assessment API call completes |
| `dashboard_materials` | `{ recommendations: [...] }` | Learning materials API call completes |

### The Dashboard: Where API Calls Meet the User

On launch, before any coaching session begins, Paige presents a dashboard. This is the first thing the user sees, and it's powered almost entirely by API calls and SQLite queries — no Claude Code involvement at all.

**Dashboard components and their data sources:**

| Component | Data Source | API Call? |
|---|---|---|
| Dreyfus stage assessment | SQLite (pre-computed by API call #5) | Read only |
| Session stats & metrics | SQLite aggregate queries | No |
| In-progress sessions | SQLite (incomplete session records) | No |
| Curated issue list | `gh` CLI → API call #8 | Yes |
| Practice challenges | SQLite (kata specs from API call #4) | Read only |
| Learning materials | API call #9 | Yes |

**Dashboard loading flow:**

1. Electron sends `dashboard_load` to backend via WebSocket.
2. Backend immediately responds with `dashboard_state` containing data from SQLite (Dreyfus assessments, stats, in-progress sessions, existing katas) — this is instant, no API calls needed.
3. Backend kicks off two parallel API calls: GitHub issue assessment (#8) and learning materials research (#9).
4. As each completes, backend pushes `dashboard_issues` and `dashboard_materials` to Electron.
5. Electron renders progressively — the dashboard is usable immediately with cached data, and the API-powered sections populate as results arrive.

This progressive loading pattern means the dashboard feels snappy. The user sees their stats and can resume a session instantly. The curated issue list and learning materials trickle in over 2–3 seconds as the API calls complete.

### Impact on Existing Architecture

This amendment **refines** the coaching pipeline but does not change the three-tier separation or MVP feature set.

**What changes:**

- The Coach Agent moves from Claude Code (PTY) to a backend API call. The Review Agent remains in Claude Code as a subagent (it needs codebase-wide context via tools).
- The memory system gains a retrieval filtering step — Haiku validates ChromaDB results before they're fed to the Coach Agent.
- The backend gains an API client module with prompt templates and response validation.
- New WebSocket message types are added for "Explain this," practice mode, and dashboard flows.
- The Observer triage model (already spec'd as an API call) is confirmed and formalised here.
- The dashboard is defined as an API-driven launch screen with progressive loading.
- Two new API calls are added for GitHub issue curation and learning materials research.

**What doesn't change:**

- The Explore, Plan, and Review agents still run through Claude Code (they need tool access and codebase context).
- The PTY architecture, MCP server surface, and read-only enforcement are unchanged.
- The Electron UI remains a thin client — it gains new panels (Explain sidebar, dashboard) but no AI logic.
- Claude Code's persona and hook system are unchanged — it still delivers coaching messages and nudges via the terminal.
- The dashboard is assembled entirely from SQLite + API calls. Claude Code is not involved until the user starts a coaching session.

### Updated Design Principles

Added to the existing [Design Principles](#design-principles):

11. **Right model for the job** — Use Haiku for binary decisions, Sonnet for structured analysis, Opus only for tool-using agents and conversation. Don't burn premium tokens on janitor work.
12. **Context is sacred** — Claude Code's context window is shared with the user's conversation. Anything that doesn't need to be there shouldn't be there. Offload evaluative and analytical work to API calls.
13. **Structured in, structured out** — API calls use JSON schemas for both input and output. This makes smaller models reliable, responses validatable, and prompt templates iterable.