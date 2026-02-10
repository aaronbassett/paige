# Discovery State: electron-ui

**Updated**: 2026-02-10 21:50 UTC
**Iteration**: 2
**Phase**: Story Development (Phase 3)

---

## Problem Understanding

### Problem Statement
Paige's backend does the heavy intellectual lifting (coaching pipeline, memory, state management), but none of that is visually demonstrable. The Electron UI is the entire demo surface — the only thing hackathon judges see. It must provide a familiar, polished IDE experience that makes the coaching system visible and compelling, while maintaining strict thin-client architecture (no AI logic, no direct filesystem access, no state ownership). The UI needs a distinct Anthropic-adjacent visual identity that signals "this is a Claude-powered tool" without being a clone.

### Personas
| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Demo Viewer / Judge | Hackathon judges evaluating via 3-min video | Immediately grasp what Paige does; be impressed by polish; see coaching in action |
| Junior Developer | The end user; novice-to-competent developer working through issues | Feel at home in a familiar IDE; see coaching hints without obstruction; track progress |
| Solo Builder | Aaron, building this in one week | Implement with existing libraries; minimal custom components; demo-visible polish only |

### Current State vs. Desired State
**Today (without feature)**: The coaching intelligence exists only in terminal text. Judges see a CLI. The hinting system, phase progression, and coaching UI have no visual expression. No way to demonstrate the "breakable wall" file tree glow, line highlights, or adaptive guidance in a compelling way.

**Tomorrow (with feature)**: A polished IDE shell with a dashboard home screen and full IDE workspace. Dashboard showcases the learner's journey (Dreyfus radar, stats, issues, challenges). IDE makes coaching tangible — files glow, lines highlight, phases progress, and the whole environment feels warm, intentional, and distinctly Claude-powered.

### Constraints
- **Thin client**: Electron MUST NOT own state, access filesystem, or contain AI logic (Constitution Principle V, VIII)
- **Read-only sacred**: The UI enables user file edits via backend WebSocket — but Paige/Claude never writes (Principle I)
- **One-week timeline**: Solo developer, hackathon scope (Principle III: KISS, Principle IV: YAGNI)
- **Existing libraries only**: Monaco, xterm.js, React tree component — no custom editor/terminal (Principle VI)
- **Demo-first**: If it's not visible in the 3-min demo, deprioritise it (Principle II)
- **WebSocket only**: All backend communication via WebSocket protocol; no direct file I/O
- **Aesthetic**: Anthropic-adjacent — warm palette, own personality, not a clone
- **Observer in scope**: Terminal filter pipeline and thinking block rendering are MVP-required

---

## Story Landscape

### Story Status Overview
| # | Story | Priority | Status | Confidence | Blocked By |
|---|-------|----------|--------|------------|------------|
| 1 | Visual Identity & Design System | P1 | ✅ In SPEC | 20% | - |
| 2 | App Shell & Navigation | P1 | ✅ In SPEC | 20% | 1 |
| 3 | Dashboard Home Screen | P1 | ✅ In SPEC | 30% | 1, 2, 4 |
| 4 | WebSocket Client | P1 | ✅ In SPEC | 15% | - |
| 5 | Code Editor (Monaco) | P1 | ⏳ Queued | 25% | 1, 2, 4 |
| 6 | File Explorer with Hint Glow | P1 | ⏳ Queued | 20% | 1, 2, 4 |
| 7 | Terminal with Filter Pipeline | P1 | ⏳ Queued | 20% | 1, 2, 4 |
| 8 | Coaching Sidebar (Issue + Phases) | P1 | ⏳ Queued | 20% | 1, 2, 4 |
| 9 | Hinting System | P1 | ⏳ Queued | 15% | 5, 6, 8 |
| 10 | Placeholder / Coming Soon Page | P2 | ⏳ Queued | 40% | 1, 2 |

### Story Dependencies
```
Visual Identity (1) ─────────────────────┐
    │                                    │
    v                                    │
App Shell & Nav (2) ──────────┐          │
    │         │               │          │
    v         v               v          │
Dashboard (3) IDE panels:     Placeholder (10)
    │         ├─ Editor (5)
    │         ├─ Explorer (6)
    │         ├─ Terminal (7)
    │         └─ Sidebar (8)
    │              │
    │              v
    │         Hinting System (9) ←── also depends on Editor (5) + Explorer (6)
    │
    v
WebSocket Client (4) ──→ all interactive stories (3, 5, 6, 7, 8)
```

### Proto-Stories / Emerging Themes
*All proto-stories have crystallized into the 10 stories above.*

---

## Completed Stories Summary

| # | Story | Priority | Completed | Key Decisions | Revision Risk |
|---|-------|----------|-----------|---------------|---------------|
| *No completed stories yet* | - | - | - | - | - |

*Full stories in SPEC.md*

---

## In-Progress Story Detail

### Story 1: Visual Identity & Design System
**Status**: Queued → will move to In Progress next
**Focus**: Establish the Anthropic-adjacent design language as CSS variables, Tailwind config, and reusable primitives

**Known so far**:
- Warm dark palette (#131313 range with olive/brown undertones)
- Anthropic-adjacent terracotta accent (#d97757 family)
- Warm whites for light surfaces (#faf9f5, #f5f4ed)
- Spring-based animations via Framer Motion (expressive defaults)
- Faux-ASCII touches concentrated on coaching panels, ambient everywhere else
- Typography: expressive display type for dashboard, clean body type for IDE

**Open questions**:
- Specific font choices (display + body)
- Exact colour tokens for all states (hint glow, phase states, error/success/warning)
- Animation spring constants (stiffness/damping values)
- Where ASCII art appears specifically
- Grain/texture treatment details

---

## Watching List

*Items that might affect graduated stories:*

[Will be populated as graduated stories accumulate]

---

## Glossary

- **Thin client**: UI that renders state received from elsewhere; owns no data, no business logic
- **Breakable wall**: Video-game-inspired hint where files glow subtly to suggest they're worth exploring
- **Thinking block pattern**: System nudges rendered as collapsible blocks (collapsed by default) to separate proactive coaching from user-initiated conversation
- **Phase**: A step in Paige's scaffolded coaching plan for an issue
- **Hint level**: Progressive disclosure tier: off → file hints → line hints → detail hints
- **Dreyfus radar**: Spider/radar chart visualizing the user's skill levels across multiple areas
- **Skeleton blocks**: Loading-state placeholder UI pattern showing grey animated blocks where content will appear

---

## Next Actions

- Deep-dive Story 1: Visual Identity & Design System
- Resolve open questions on colour tokens, font choices, animation constants
- Develop acceptance scenarios for Story 1
- Queue Story 2 (App Shell) and Story 4 (WebSocket) for development after Story 1 graduates
