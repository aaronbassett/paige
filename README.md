# Paige

**Claude Codes, Paige Pairs.**

An AI coaching tool that teaches junior developers instead of replacing them. Paige can see your code but can't write it — she _has_ to teach.

Built for the [Claude Code Hackathon](https://cerebralvalley.ai/) at Cerebral Valley, February 2026.

---

## The Problem

LLM coding tools are hollowing out the junior developer role. The tasks juniors used to learn on — writing boilerplate, fixing simple bugs, building CRUD — AI does them now.

The data is stark:

- **-20%** employment for software developers aged 22-25 since late 2022 ([Stanford Digital Economy Study](https://digitaleconomy.stanford.edu/))
- **-30%** tech internship postings since 2023, while applications rose 7%
- **-5 junior hires/quarter** at AI-adopting companies — not layoffs, a hiring freeze ([Harvard](https://www.hbs.edu/))
- **7%** of Big Tech hires are new grads, down 25% from 2023
- **70%** of hiring managers believe AI can perform intern-level work

Every senior engineer started as a junior. Without entry-level opportunities, the next generation of skilled professionals will never exist.

## The Solution

Paige is an AI pair programmer that **cannot write code**. This isn't a limitation — it's the entire point.

When you take away AI's ability to just do the work, it has to do something harder: _teach_.

**What Paige does:**

- **Coaches through real GitHub issues** — not toy exercises, your actual backlog
- **Progressive disclosure** — you control how much help you get (off / low / medium / high)
- **Remembers across sessions** — "This is the same pattern as last Tuesday. You've got this."
- **Detects struggle** — notices when you're stuck and reframes the problem before frustration kills momentum
- **Generates practice challenges** — targeted exercises extracted from your actual knowledge gaps

**What Paige cannot do:**

- Write, edit, or create files (enforced at three independent layers)
- Run code on your behalf
- Submit pull requests
- Take any action that shortcuts learning

---

## Quick Start

> [!WARNING]
> **Heads up:** Paige uses your authenticated GitHub account to discover public repos with open issues for coaching. We recommend testing with a dedicated test repo rather than your production repositories.

```bash
# 1. Clone and setup (one-time)
git clone https://github.com/aaronbassett/paige.git
cd paige
./scripts/setup-demo.sh

# 2. Add your Anthropic API key to .env
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env
echo "GITHUB_TOKEN=ghp_xxxxxx" >> .env

# 3. Start everything
overmind start

# 4. Stop everything
overmind quit
```

The Electron app launches automatically. The backend starts at `localhost:3001`.

---

## How Opus 4.6 Powers Paige

Paige uses a multi-model strategy that routes each task to the right level of intelligence:

### The Model Cascade

| Model | Role | Examples |
|-------|------|---------|
| **Opus 4.6** | Complex reasoning via Claude Code | Codebase exploration, conversational coaching, plan generation, code review |
| **Sonnet** | Structured analysis | Coaching pipeline, Dreyfus assessment, knowledge gap extraction, "Explain This" |
| **Haiku** | Binary decisions | Observer triage (nudge or not?), memory filtering, session summarization |

### Every API Call

| Call | Model | SDK | Purpose | Why This Model |
|------|-------|-----|---------|----------------|
| **Planning Agent** | Opus 4.6 | Agent SDK | Multi-turn codebase exploration to produce a phased implementation plan from a GitHub issue (tools: Read, Glob, Grep; up to 30 turns) | Needs complex reasoning across multiple files and tool calls to understand codebase structure |
| **Coach Agent** | Sonnet | Direct | Transform an implementation plan into Dreyfus-aware phased coaching with memory integration | Structured analysis with schema validation; doesn't need tool use |
| **Knowledge Gap Agent** | Sonnet | Direct | Analyze session actions to identify gaps and generate practice kata specifications | Pattern recognition across a session's worth of developer actions |
| **Dreyfus Agent** | Sonnet | Direct | Assess skill levels across skill areas using the 5-stage Dreyfus model | Nuanced evaluation requiring calibrated judgment, not binary |
| **Materials Agent** | Sonnet | Direct | Generate curated learning resources (videos, articles, docs) with verification questions per knowledge gap | Needs to reason about pedagogical relevance and quality |
| **Review Agent** | Sonnet | Direct + tools | Multi-turn code review with file reading and git diff (tools: read_file, git_diff, list_files; up to 20 turns) | Needs tool access to check actual code, but structured feedback doesn't need Opus-level reasoning |
| **Explain This** | Sonnet | Direct | Dreyfus-aware code explanation for selected snippets with phase context | Clear, accurate explanations calibrated to skill level |
| **Practice Review** | Sonnet | Direct | Review kata solution submissions, assign quality scores, unlock progressive constraints | Evaluate code quality and decide difficulty progression |
| **Reflection Agent** | Haiku | Direct | Summarize completed session into searchable memories for ChromaDB | Distillation task — compress, don't reason |
| **Triage Model** | Haiku | Direct | Observer nudge decision: should Paige intervene right now or stay quiet? | Binary yes/no with brief rationale; runs frequently, must be cheap |
| **Nudge Agent** | Haiku | Agent SDK | Generate brief coaching nudge when Observer detects the developer is stuck (tools: Read; max 2 turns) | Short, empathetic message — doesn't need deep analysis |
| **Answer Verification** | Haiku | Direct | Evaluate whether a developer's answer to a learning material question shows genuine understanding | Binary correct/incorrect with brief feedback |
| **Issue Summary** | Haiku | Direct | Summarize GitHub issues with Dreyfus-personalized difficulty assessment (cached 1hr) | Lightweight summarization with simple classification |
| **Commit Suggest** | Haiku | Direct | Generate conventional commit message from git diff and active phase context | Formulaic output from structured input |
| **PR Suggest** | Haiku | Direct | Generate PR title and markdown body from git log and completed phases | Formulaic output from structured input |

**Cost profile:** ~$0.30/session for backend API calls. Haiku handles the high-frequency decisions (pennies each), Sonnet does the structured analysis, Opus is reserved for the one task that genuinely needs multi-turn tool-augmented reasoning.

### Novel Integrations

**4-Agent Coaching Pipeline** — Memory Filter (Haiku) retrieves relevant past sessions, Coach Agent (Sonnet) transforms a plan into scaffolded phases, Knowledge Gap Agent (Sonnet) extracts learning opportunities, and Reflection Agent (Sonnet) updates the developer's skill profile. Opus orchestrates the whole flow.

**Observer System** — A two-tier evaluation model watches the developer work. Haiku runs continuous triage on 27 event types (file opens, edits, phase transitions) and decides whether to intervene. When it does, Opus delivers the coaching nudge through the terminal with full codebase context.

**Agent SDK Integration** — The planning agent uses Claude's Agent SDK to generate structured implementation plans, with Opus doing tool-augmented reasoning over the actual codebase.

**Read-Only Constraint as Creative Forcing Function** — By removing Opus's most powerful capability (code generation), we forced it into a fundamentally different mode: teaching through questions, hints, and pattern recognition rather than solutions.

---

## Pedagogical Framework

Paige isn't just an AI with access restrictions. The coaching approach is grounded in educational research:

**Scaffolding** (Wood, Bruner, Ross 1976) — Guidance is layered. The user completes as much as possible unassisted; Paige only helps with what's beyond their current capability.

**Zone of Proximal Development** (Vygotsky) — Tasks are selected slightly above the developer's current ability, with Paige providing the support structure to bridge the gap.

**Dreyfus Model of Skill Acquisition** — A 5-stage model (Novice &rarr; Advanced Beginner &rarr; Competent &rarr; Proficient &rarr; Expert) drives hint granularity. Novices get prescriptive guidance; Competent developers get directional nudges.

**Adaptive Pacing** — The Observer system detects frustration patterns and intervenes before momentum dies. Sometimes the best coaching is suggesting a break.

---

## Features

### Work Mode

Coach through real GitHub issues with scaffolded guidance:

- **Issue assessment** — Sonnet evaluates issues from your repo for suitability (good fit / stretch / too advanced)
- **Phased coaching** — Issues decomposed into digestible phases with progressive hints
- **"Explain This"** — Select any code, get an explanation in the sidebar without interrupting your flow
- **Code review** — Request a review when you think you're done; Paige checks your work via MCP tools

### Practice Mode

Targeted exercises generated from your actual knowledge gaps:

- **Adaptive challenges** — Generated from gaps identified during coaching sessions
- **Constraint unlocking** — Progressive difficulty (base &rarr; no-libraries &rarr; error-handling &rarr; performance)
- **Non-code challenges** — Documentation reading, architecture Q&A, not just code exercises
- **Review flow** — Submit solutions for Sonnet-powered feedback with follow-up constraints

### Dashboard

A personalized launch screen:

- **Dreyfus Radar** — Spider chart tracking skill progression across the 5-stage Dreyfus model (Novice &rarr; Expert)
- **Stats Bento** — 8 stat cards with period selection (today / week / month)
- **GitHub Issues** — AI-assessed issue recommendations from your actual repositories
- **Practice Challenges** — Outstanding katas with difficulty indicators
- **Learning Materials** — Sonnet-researched resources (docs, articles, videos) matched to your knowledge gaps

### Observer System

Proactive coaching that watches without interrupting:

- **27 tracked event types** — File opens, buffer edits, phase transitions, hint usage, and more
- **Triage model** — Haiku decides in real-time whether a nudge would help or annoy
- **Suppression rules** — Cooldown timers, flow state detection, confidence thresholds, user mute
- **Circuit breaker** — Detects stuck loops and suggests reframing before frustration builds

---

## Project Structure

```
paige/
├── src/                    # Backend server (~23K lines)
│   ├── api-client/         # Claude API (Haiku/Sonnet/Opus routing)
│   ├── coaching/           # 4-agent coaching pipeline
│   ├── database/           # 11 SQLite tables, Kysely migrations
│   ├── file-system/        # Buffer cache, file watcher, tree
│   ├── mcp/                # 15 MCP tools for Claude Code
│   ├── memory/             # ChromaDB semantic memory
│   ├── observer/           # Proactive coaching + triage
│   ├── websocket/          # 51 message types, 23+ handlers
│   └── ...
├── electron-ui/            # Electron desktop app
│   ├── src/                # Main process (PTY, IPC, window)
│   ├── renderer/src/       # React frontend (60+ components)
│   │   ├── views/          # Dashboard, IDE, Challenge, Planning
│   │   ├── components/     # Editor, FileTree, Sidebar, Hints
│   │   └── services/       # WebSocket client
│   └── shared/             # TypeScript contracts
├── docs/planning/          # Architecture & design documents
├── specs/                  # Feature specifications
└── CLAUDE.md               # Project context for Claude Code
```

---

## Why This Matters

The tech industry is running a natural experiment: what happens when you eliminate the junior developer pipeline?

The optimists say AI will create new roles. The pessimists say engineering is dying. But both sides agree on one thing: **if we stop training juniors today, we won't have seniors in five years.**

Baby Boomers are retiring in the largest wave modern tech has seen. The succession crisis isn't hypothetical — it's arithmetic.

Paige is a bet that AI's most valuable role in software development isn't replacing developers. It's growing them.

---

## License

[MIT](./LICENSE)

---

<sub>Built with Claude Opus 4.6 by <a href="https://github.com/aaronbassett">Aaron Bassett</a> at the Cerebral Valley Claude Code Hackathon, February 2026.</sub>
