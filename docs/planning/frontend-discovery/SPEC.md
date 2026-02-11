# Feature Specification: electron-ui

**Feature Branch**: `feature/electron-ui`
**Created**: 2026-02-10
**Last Updated**: 2026-02-11 (REV-9: Story 7 terminal approach revised)
**Status**: Complete (10/10 stories graduated)
**Discovery**: See `discovery/` folder for full context

---

## Problem Statement

Paige's backend does the heavy intellectual lifting (coaching pipeline, memory, state management), but none of that is visually demonstrable. The Electron UI is the entire demo surface — the only thing hackathon judges see. It must provide a familiar, polished IDE experience that makes the coaching system visible and compelling, while maintaining strict thin-client architecture (no AI logic, no direct filesystem access, no state ownership). The UI needs a distinct Anthropic-adjacent visual identity that signals "this is a Claude-powered tool" without being a clone.

## Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Demo Viewer / Judge | Hackathon judges evaluating via 3-min video | Immediately grasp what Paige does; be impressed by polish; see coaching in action |
| Junior Developer | The end user; novice-to-competent developer working through issues | Feel at home in a familiar IDE; see coaching hints without obstruction; track progress |
| Solo Builder | Aaron, building this in one week | Implement with existing libraries; minimal custom components; demo-visible polish only |

---

## User Scenarios & Testing

<!--
  Stories are ordered by priority (P1 first).
  Each story is independently testable and delivers standalone value.
  Stories may be revised if later discovery reveals gaps - see REVISIONS.md
-->

### Story 1: Visual Identity & Design System [P1] ✅

**As a** developer opening Paige for the first time,
**I want** the interface to feel warm, distinctive, and professionally crafted,
**So that** I immediately sense this is a thoughtful, Claude-powered coaching tool — not a generic IDE wrapper.

**Priority**: P1 — Foundation; every other story inherits from this.
**Dependencies**: None.

#### Design Tokens

**Colour Palette**

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#1a1a18` | App background (warm black, olive undertone) |
| `--bg-surface` | `#252523` | Panel/card backgrounds |
| `--bg-elevated` | `#30302e` | Hover states, active panels, dropdowns |
| `--bg-inset` | `#141413` | Recessed areas: terminal, code editor |
| `--accent-primary` | `#d97757` | Primary accent — terracotta |
| `--accent-warm` | `#e8956a` | Lighter terracotta for hover, glows |
| `--accent-deep` | `#b85c3a` | Darker terracotta for pressed states |
| `--text-primary` | `#faf9f5` | Primary text (parchment white) |
| `--text-secondary` | `#a8a69e` | Secondary text, labels, metadata |
| `--text-muted` | `#6b6960` | Disabled text, subtle details |
| `--hint-glow` | `rgba(217,119,87,0.4)` | Breathing glow on hinted files |
| `--phase-pending` | `#6b6960` | Pending phase indicators |
| `--phase-active` | `#d97757` | Active phase — terracotta pulse |
| `--phase-complete` | `#7cb87c` | Completed phases — warm green |
| `--status-error` | `#e05252` | Error squiggles, failed states |
| `--status-warning` | `#d4a843` | Warning decorations |
| `--status-success` | `#7cb87c` | Success confirmations |
| `--status-info` | `#6b9bd2` | Info messages, neutral highlights |
| `--border-subtle` | `#30302e` | Panel borders, dividers |
| `--border-active` | `rgba(217,119,87,0.6)` | Active/focused panel borders |

**Typography**

| Level | Font | Size | Weight | Line Height | Usage |
|-------|------|------|--------|-------------|-------|
| Display | JetBrains Mono | 48-64px | 700 | 1.2 | Dashboard headers, splash |
| H1 | JetBrains Mono | 32px | 700 | 1.3 | Page sections |
| H2 | JetBrains Mono | 24px | 600 | 1.3 | Panel headers, issue titles |
| H3 | JetBrains Mono | 18px | 600 | 1.4 | Phase titles, subheads |
| Body | JetBrains Mono | 14px | 400 | 1.6 | Content, descriptions |
| Small | JetBrains Mono | 12px | 500 | 1.4 | Metadata, timestamps, stats |
| Code | Monaco default | 14px | 400 | 1.5 | Editor content |

**Spring Animation Presets**

| Preset | Stiffness | Damping | Use Case |
|--------|-----------|---------|----------|
| `expressive` | 260 | 20 | Page transitions, dashboard entrance |
| `standard` | 300 | 28 | Panel collapse/expand, hover, tabs |
| `gentle` | 120 | 14 | Breathing glow on hinted files (loop) |
| `snappy` | 400 | 35 | Button clicks, toggles, micro-interactions |

**ASCII Treatments**

| Treatment | Application | Implementation |
|-----------|-------------|----------------|
| Figlet headers | Dashboard section titles, splash screen | `figlet` npm package, terracotta colour |
| Scanline overlay | Coaching sidebar background, phase cards | CSS `repeating-linear-gradient`, 2px lines at 3% opacity |
| Dot matrix accents | Panel borders, section dividers, backgrounds | CSS `radial-gradient` dots, 8px grid, 8% opacity |

**Background Texture**
- Subtle noise overlay on `--bg-base` via SVG filter texture
- Opacity: 3-5% — felt more than seen

#### Acceptance Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 1.1 | Open any Paige view | All backgrounds use warm black/olive tones, never pure #000 or #fff |
| 1.2 | View text at all hierarchy levels | JetBrains Mono renders at correct sizes/weights with proper contrast |
| 1.3 | Hover over an interactive element | Spring animation with `standard` preset (stiffness: 300, damping: 28) |
| 1.4 | View the coaching sidebar | Scanline overlay visible as subtle horizontal lines |
| 1.5 | View any panel background | Dot matrix pattern visible at low opacity when looking closely |
| 1.6 | View the dashboard | Figlet ASCII art renders for section headers in terracotta |
| 1.7 | View the app background | Subtle noise texture present, not distracting |
| 1.8 | Inspect any terracotta accent | Colour matches `#d97757` (primary), `#e8956a` (hover), `#b85c3a` (pressed) |

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| E1.1 | JetBrains Mono fails to load from Google Fonts | Fallback to system monospace (`monospace` generic family) |
| E1.2 | User has system-level forced high contrast mode | Respect OS accessibility settings; colours degrade gracefully |
| E1.3 | Animation preference: reduced motion | Check `prefers-reduced-motion` media query; disable spring animations, use instant transitions |

#### Requirements

| ID | Requirement |
|----|-------------|
| R1.1 | All colour values MUST be defined as CSS custom properties in a single theme file |
| R1.2 | All spring presets MUST be defined as named constants exported from a single animation config |
| R1.3 | Framer Motion MUST be used for all spring-based animations |
| R1.4 | The `prefers-reduced-motion` media query MUST be respected for all animations |
| R1.5 | JetBrains Mono MUST be loaded from Google Fonts with weights 400, 500, 600, 700 |
| R1.6 | No colour value MUST appear as a raw hex literal outside the theme file |
| R1.7 | ASCII treatments (scanline, dot matrix) MUST be implemented via CSS only (no images, no canvas) |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC1.1 | Design tokens are centralised | 0 raw hex colour literals outside theme file |
| SC1.2 | Animation system is consistent | All animated elements use named spring presets |
| SC1.3 | Accessibility: reduced motion | All animations disabled when `prefers-reduced-motion: reduce` is active |
| SC1.4 | Visual identity is cohesive | Design preview HTML (`discovery/design-preview.html`) matches implemented output |

### Story 2: App Shell & Navigation [P1] ✅

**As a** developer launching Paige,
**I want** a responsive app shell that smoothly transitions between a dashboard home and an IDE workspace,
**So that** I can navigate between learning overview and active coding without losing context.

**Priority**: P1 — Container for all other views.
**Dependencies**: Story 1 (Visual Identity).

#### Layout Architecture

**Three Views**
1. **Dashboard** — Full-screen home view (Story 3 details content)
2. **IDE** — Five-panel workspace layout
3. **Placeholder** — Lightweight "Coming Soon" page for unbuilt features (Story 10)

**Header Bar** (shared across both views)
- Height: 48px fixed
- Contents: Paige logo/wordmark (left), back/home button (visible in IDE view only)
- Background: `--bg-surface`
- Border bottom: `--border-subtle`

**Electron Window**
- `titleBarStyle: 'hiddenInset'` on macOS
- Header accounts for traffic light inset (~70px left padding on macOS)
- Back/home button visible in IDE and Placeholder views

**IDE Panel Layout** (fixed proportions, no drag resize)

```
┌─────────────────────────────────────────────────────────┐
│  Header: 48px — Logo + Back                             │
├────────┬──────────────────────────┬─────────────────────┤
│  File  │  Code Editor (tabs)      │  Coaching Sidebar   │
│  Explr │                          │  - Issue Context    │
│        │                          │  - Hint Slider      │
│ 220px  │       flex (remaining)   │  - Phase Stepper    │
│        │                          │       280px         │
│        ├──────────────────────────┤                     │
│        │  Status Bar: 32px        │                     │
├────────┴──────────────────────────┴─────────────────────┤
│  Claude Code Terminal                         30% height│
└─────────────────────────────────────────────────────────┘
```

- Left sidebar: 220px fixed width
- Right sidebar: 280px fixed width
- Editor + terminal column: remaining width (flex)
- Editor (including 32px status bar): 70% of column height
- Terminal: 30% of column height
- Terminal spans full width below all three columns
- Status bar sits at bottom of editor area, above terminal (see Story 5)

**Sidebar Collapse**
- Each sidebar has a small toggle icon at its top edge
- Collapse animation: `standard` spring preset (stiffness: 300, damping: 28)
- Collapsed state: thin vertical rail (~32px) showing only the toggle icon to reopen
- When left sidebar collapses: editor + terminal gain 188px width
- When right sidebar collapses: editor + terminal gain 248px width

**View Transitions**
- Dashboard → IDE: **Zoom transition** — clicking an issue card on the dashboard triggers a zoom where the card expands to fill the screen, morphing into the IDE layout. Uses `expressive` spring preset.
- IDE → Dashboard: Back button in header triggers reverse zoom (IDE contracts back to card position). Uses `expressive` spring preset.

#### Acceptance Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 2.1 | Launch Paige | Dashboard view loads as the home screen. Header shows Paige logo, no back button. |
| 2.2 | Click an issue on dashboard | Zoom transition animates the issue card expanding into the full IDE layout. Header shows back button. |
| 2.3 | Click back button in IDE | Reverse zoom contracts IDE back to dashboard. Back button disappears. |
| 2.4 | View IDE layout | Five panels render at correct proportions: 220px / flex / 280px, 70/30 editor/terminal. |
| 2.5 | Click left sidebar toggle | Sidebar collapses to 32px rail with spring animation. Editor expands to fill space. |
| 2.6 | Click right sidebar toggle | Sidebar collapses to 32px rail. Editor expands. |
| 2.7 | Click collapsed rail toggle | Sidebar expands back to full width with spring animation. |
| 2.8 | Both sidebars collapsed | Editor + terminal take full width minus two 32px rails. |
| 2.9 | macOS traffic lights | Visible and functional, overlaying the header content with proper left padding. |

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| E2.1 | Window resized very narrow (<800px) | Sidebars auto-collapse; editor takes full width |
| E2.2 | Window resized very short (<500px) | Terminal panel hides; editor takes full height below header |
| E2.3 | Zoom transition interrupted (rapid clicks) | Debounce navigation; ignore clicks during active transition |
| E2.4 | Non-macOS platform | Skip `hiddenInset` title bar; use standard frame with custom header inside |

#### Requirements

| ID | Requirement |
|----|-------------|
| R2.1 | App MUST have three view states: Dashboard, IDE, and Placeholder |
| R2.2 | Header MUST be 48px and persist across both views |
| R2.3 | IDE layout MUST use CSS Grid with fixed column/row proportions (no JavaScript-based sizing) |
| R2.4 | Sidebar collapse MUST use Framer Motion with the `standard` spring preset |
| R2.5 | View transitions MUST use Framer Motion with the `expressive` spring preset |
| R2.6 | Collapsed sidebar rail MUST be exactly 32px wide |
| R2.7 | Electron MUST use `titleBarStyle: 'hiddenInset'` on macOS |
| R2.8 | Navigation clicks MUST be debounced during active transitions |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC2.1 | Layout proportions match spec | Panel widths measure 220px / flex / 280px at 1440px window width |
| SC2.2 | Transitions feel smooth | Zoom in/out completes without jank at 60fps |
| SC2.3 | Sidebars collapse correctly | Collapsed width is 32px; expanded width is original value |
| SC2.4 | Cross-platform window | App renders correctly on macOS with `hiddenInset` title bar |

### Story 3: Dashboard Home Screen [P1] ✅

**As a** junior developer opening Paige,
**I want** a dashboard showing my learning journey, available work, and progress at a glance,
**So that** I can pick up where I left off, choose what to work on next, and see my growth.

**Priority**: P1 — First thing judges and users see.
**Dependencies**: Story 1 (Visual Identity), Story 2 (App Shell), Story 4 (WebSocket).

#### Dashboard Layout

Two-column grid using **golden ratio proportions** (~38:62 / 62:38). Scrollable page. All data provided by backend via WebSocket.

```
┌───────────────────────────────────────────────────────┐
│  Header (48px) — Story 2                              │
├─────────────── Row 1 ─────────────────────────────────┤
│  Dreyfus Radar Chart       │  Stats & Metrics         │
│  + Progression Summary     │  (mini bento grid)       │
│          38%               │        62%               │
├─────────────── Row 2 (hidden if empty) ───────────────┤
│  In-Progress Tasks         │  Practice Challenges     │
│                            │                          │
│          62%               │        38%               │
├─────────────── Row 3-4 ───────────────────────────────┤
│  GitHub Issues             │  (gap)                   │
│  (tall — scrollable list   ├──────────────────────────┤
│   of rich cards)           │  Learning Materials      │
│          62%               │        38%               │
└────────────────────────────┴──────────────────────────┘
```

**Row 1**: Dreyfus radar (38%) + Stats bento (62%)
**Row 2**: In-progress tasks (62%) + Practice challenges (38%) — **hidden entirely when no tasks in progress**
**Row 3-4**: GitHub issues (62%, tall) + Learning materials (38%, bottom-aligned)

Each section has a figlet-rendered header in terracotta.

#### Section Details

**1. Dreyfus Radar Chart (38%, Row 1)**
- Spider/radar chart showing competence across skill areas (e.g., React, Testing, Git, State Management, Error Handling)
- Current overall stage label below (e.g., "Advanced Beginner")
- Data from backend; axes and values backend-determined
- Scanline overlay on card background

**2. Stats & Metrics Bento (62%, Row 1)**
- Mini bento grid of compact stat cards, each showing a number + label
- Stats: issues completed, time spent, hints used, streak (consecutive days), phases completed, practice challenges completed
- **Time period switcher** in top-right corner: `this week | this month | all time` — pill-style toggle buttons
- No Dreyfus data here (separate section)
- Dot matrix background on cards

**3. In-Progress Tasks (62%, Row 2)**
- List of sessions the user started but didn't complete
- Each item shows: issue title, phase progress (e.g., "Phase 2/4"), time since last session
- Click resumes the session (zoom transition into IDE at last state)
- **Hidden entirely** when no in-progress tasks exist (row collapses, layout adjusts)

**4. Practice Challenges (38%, Row 2)**
- List of practice katas generated from knowledge gaps
- Each shows: challenge title, difficulty indicator, related skill area
- Click navigates to placeholder page (Story 10)

**5. GitHub Issues (62%, Row 3-4)**
- Scrollable list of available issues from the user's assigned/tagged GitHub issues
- **Rich cards**: terracotta left border, issue `#number`, title (H3), description snippet (2 lines max), label pills (coloured), age/date
- Click triggers **zoom transition** (Story 2) — the card expands into the IDE layout
- This is the primary action surface of the dashboard

**6. Learning Materials (38%, Row 3-4)**
- Curated resources (docs, articles, videos) targeting identified knowledge gaps
- Each item: title, source type icon (doc/article/video), related skill area
- Data from backend
- Click navigates to placeholder page (Story 10)

#### Acceptance Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 3.1 | Launch Paige with backend connected | Dashboard renders all 6 sections with data from backend |
| 3.2 | View Dreyfus radar | Spider chart renders with axes, values, and overall stage label |
| 3.3 | View stats bento | 6 stat cards in mini bento grid. Default period: "this week" |
| 3.4 | Switch stats period | Click "this month" → stats update from backend. Active pill highlights in terracotta. |
| 3.5 | Have in-progress tasks | Row 2 visible with task cards showing resume context |
| 3.6 | No in-progress tasks | Row 2 hidden entirely. Rows 3-4 shift up. No empty state message. |
| 3.7 | Click a GitHub issue card | Zoom transition begins. Card expands to fill screen, morphs into IDE. |
| 3.8 | Click resume on in-progress task | Zoom transition into IDE at the session's last state |
| 3.9 | Click a practice challenge | Navigate to placeholder page (Story 10) |
| 3.10 | Click a learning material | Navigate to placeholder page (Story 10) |
| 3.11 | View section headers | Figlet ASCII art renders in terracotta for each section title |
| 3.12 | Scroll the dashboard | Page scrolls smoothly. GitHub issues section is tall enough to show 5+ cards. |

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| E3.1 | Backend not connected / no data | Dashboard shows skeleton loading blocks across all sections |
| E3.2 | No GitHub issues available | Issues section shows "No issues assigned. Check your GitHub repository." |
| E3.3 | Radar chart has only 1-2 skill areas | Chart degrades gracefully (bar chart or simple display instead of radar) |
| E3.4 | Stats all zero (new user) | Show zeros with warm onboarding message: "Your journey starts here" |
| E3.5 | Very long issue titles | Truncate with ellipsis after 2 lines |
| E3.6 | Many issues (20+) | Virtual scrolling or paginated list within the issues section |

#### Requirements

| ID | Requirement |
|----|-------------|
| R3.1 | Dashboard layout MUST use golden ratio proportions (38:62 / 62:38) |
| R3.2 | All section data MUST come from backend via WebSocket |
| R3.3 | In-progress tasks row MUST be hidden when empty (not collapsed with empty state) |
| R3.4 | Stats time period switcher MUST support three periods: this week, this month, all time |
| R3.5 | GitHub issue cards MUST be the zoom-transition origin for Story 2 |
| R3.6 | Practice challenge and learning material clicks MUST navigate to Story 10 placeholder |
| R3.7 | Each section MUST have a figlet-rendered header |
| R3.8 | Dreyfus radar MUST render as a spider/radar chart |
| R3.9 | Dashboard MUST be scrollable (not viewport-constrained) |
| R3.10 | Skeleton loading state MUST display while awaiting backend data |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC3.1 | All 6 sections render with data | Each section shows content from backend WebSocket messages |
| SC3.2 | Golden ratio layout | Column widths measure 38:62 (row 1) and 62:38 (rows 2-4) |
| SC3.3 | Zoom transition works | Clicking an issue card triggers smooth zoom into IDE view |
| SC3.4 | Stats period switching | All three period options load different data from backend |
| SC3.5 | Empty state handling | In-progress row hidden when empty; skeleton blocks shown when loading |

### Story 4: WebSocket Client [P1] ✅

**As the** Electron UI (thin client),
**I need** a reliable WebSocket connection to the backend server,
**So that** all state, file I/O, and coaching data flows through the single source of truth.

**Priority**: P1 — Every interactive story depends on this.
**Dependencies**: None (can be built in parallel with Story 1).

#### Connection Lifecycle

1. **Connect**: On app launch, connect to `ws://localhost:{PORT}` (port from Electron config or env)
2. **Handshake**: Client sends `connection:hello` with version, platform, window size
3. **Init**: Server responds with `connection:init` containing session ID and capabilities
4. **Active**: Bidirectional message flow
5. **Disconnect**: On close, show reconnecting indicator
6. **Reconnect**: Exponential backoff (1s → 2s → 4s → 8s → 16s → max 30s). Reset backoff on successful connect. Re-send `connection:hello` on reconnect to restore state.

#### Message Protocol

All messages follow a consistent envelope:

```typescript
interface WebSocketMessage {
  type: string;       // e.g., "file:open", "editor:decorations"
  payload: unknown;   // Message-specific data
  id?: string;        // Optional correlation ID for request/response pairs
  timestamp: number;  // Unix ms
}

// Period type for dashboard stats
type Period = "7d" | "30d" | "all";
// "7d" = last 7 days (displayed as "This Week" in UI)
// "30d" = last 30 days (displayed as "This Month" in UI)
// "all" = all time (displayed as "All Time" in UI)
```

#### Server → Client Messages (32 types)

**Connection**

| Type | Payload | Description |
|------|---------|-------------|
| `connection:init` | `{ sessionId, capabilities, featureFlags }` | Handshake response |
| `connection:error` | `{ code, message, context }` | Backend error notification |

**Dashboard**

| Type | Payload | Description |
|------|---------|-------------|
| `dashboard:dreyfus` | `{ skillAreas: [{ name, stage, score }], overallStage }` | Dreyfus radar data |
| `dashboard:stats` | `{ period, stats: [{ key, value, label }] }` | Stats for requested period |
| `dashboard:issues` | `{ issues: [{ number, title, description, labels: [{ name, color }], age, url, readiness?, confidence? }] }` | GitHub issues list with full metadata |
| `dashboard:in_progress` | `{ sessions: [{ id, issueTitle, phase, totalPhases, lastActive }] }` | Resumable sessions |
| `dashboard:challenges` | `{ challenges: [{ id, title, difficulty, skillArea }] }` | Practice challenges |
| `dashboard:materials` | `{ materials: [{ id, title, type, skillArea, url }] }` | Learning materials |

**File System**

| Type | Payload | Description |
|------|---------|-------------|
| `fs:tree` | `{ root: TreeNode }` | Full file tree on session start |
| `fs:tree_update` | `{ action, path, newPath? }` | Incremental tree change |
| `fs:content` | `{ path, content, language, lineCount }` | File content response |
| `fs:save_ack` | `{ path, success, timestamp }` | Save confirmation |
| `fs:save_error` | `{ path, error }` | Save failure |

**Editor**

| Type | Payload | Description |
|------|---------|-------------|
| `editor:decorations` | `{ path, decorations: [{ type, range, message?, style }] }` | Paige-controlled decorations |
| `editor:clear_decorations` | `{ path? }` | Remove decorations (all or per-file) |
| `editor:hover_hint` | `{ path, range, hintText }` | Hover popover content |

**Explorer**

| Type | Payload | Description |
|------|---------|-------------|
| `explorer:hint_files` | `{ hints: [{ path, style: 'subtle' \| 'obvious' \| 'unmissable', directories?: string[] }] }` | File tree glow triggers (per-file style + optional directory glow list) |
| `explorer:clear_hints` | `{}` | Remove all file glows |

**Session**

| Type | Payload | Description |
|------|---------|-------------|
| `session:started` | `{ issueContext: IssueContext, phases: Phase[], hintLevel, openFiles? }` | Session initialised (see Story 8 for IssueContext and Phase interfaces) |
| `session:resumed` | `{ restoredState }` | Session restored from previous |
| `session:ended` | `{ summary }` | Session wrap-up data |

**Coaching**

| Type | Payload | Description |
|------|---------|-------------|
| `coaching:phase_update` | `{ phase, status, description }` | Phase state change |
| `coaching:message` | `{ message, type, anchor?: { path, range } }` | Coaching message (anchored = comment balloon, unanchored = editor toast) |
| `coaching:issue_context` | `{ number, title, summary, labels: [{ name, color }], url }` | Current issue details (number + url for link, label colors for pills) |

**Observer**

| Type | Payload | Description |
|------|---------|-------------|
| `observer:nudge` | `{ signal, confidence, context }` | Nudge for PTY injection |
| `observer:status` | `{ active, muted, lastEvaluation }` | Observer state (active, mute toggle, last eval timestamp) |

**Explain & Review (Story 11)**

| Type | Payload | Description |
|------|---------|-------------|
| `explain:response` | `{ explanation }` | Sonnet-generated explanation for selected code |
| `review:response` | `{ review, suggestions }` | Sonnet-generated review of current work |

**Practice Mode (Story 12)**

| Type | Payload | Description |
|------|---------|-------------|
| `dashboard:state` | `{ dreyfus, stats, inProgress, issues, challenges, materials }` | Full dashboard state (consolidates all dashboard data) |
| `dashboard:issues_error` | `{ error }` | GitHub issue fetch failed |
| `practice:kata_load` | `{ kata: { id, title, description, scaffoldingCode, instructorNotes }, constraints: [{ title, description, minLevel }] }` | Practice kata with available constraints |
| `practice:solution_review` | `{ review, level, passed, constraintsUnlocked: [{ title, description, minLevel }] }` | Solution feedback with unlocked constraints |

#### Client → Server Messages (23 types)

**Connection**

| Type | Payload | Description |
|------|---------|-------------|
| `connection:hello` | `{ version, platform, windowSize }` | Initial handshake |

**Dashboard**

| Type | Payload | Description |
|------|---------|-------------|
| `dashboard:request` | `{ statsPeriod?: Period }` | Request all dashboard data with optional stats period filter |
| `dashboard:stats_period` | `{ period: Period }` | Switch stats time period |
| `dashboard:refresh_issues` | `{}` | Re-fetch GitHub issues from repository |

**Session**

| Type | Payload | Description |
|------|---------|-------------|
| `session:start` | `{ issueNumber }` | User selected an issue |
| `session:resume` | `{ sessionId }` | User resuming a session |
| `session:end` | `{}` | User navigated back to dashboard |

**File**

| Type | Payload | Description |
|------|---------|-------------|
| `file:open` | `{ path }` | User opening a file |
| `file:save` | `{ path, content }` | User saving a file |
| `file:close` | `{ path }` | User closed a tab |

**Buffer**

| Type | Payload | Description |
|------|---------|-------------|
| `buffer:update` | `{ path, content, cursorPosition, selections }` | Debounced editor changes (300ms) |

**Editor**

| Type | Payload | Description |
|------|---------|-------------|
| `editor:tab_switch` | `{ fromPath, toPath }` | User switched active tab |
| `editor:selection` | `{ path, range, selectedText }` | User selected code |
| `editor:scroll` | `{ path, visibleRange }` | User scrolled (debounced) |

**Explorer**

| Type | Payload | Description |
|------|---------|-------------|
| `explorer:expand_dir` | `{ path }` | User expanded directory |
| `explorer:collapse_dir` | `{ path }` | User collapsed directory |

**Hints**

| Type | Payload | Description |
|------|---------|-------------|
| `hints:level_change` | `{ level }` | User toggled hint level |

**Terminal**

| Type | Payload | Description |
|------|---------|-------------|
| `terminal:ready` | `{ cols, rows }` | xterm.js initialized |
| `terminal:resize` | `{ cols, rows }` | Terminal dimensions changed |

**User Action**

| Type | Payload | Description |
|------|---------|-------------|
| `user:explain` | `{ path, range, selectedText }` | "Explain this" context action |
| `user:review` | `{}` | "Review my work" request |
| `user:idle_start` | `{ lastActionTimestamp }` | User went idle |
| `user:idle_end` | `{}` | User resumed activity |

**Observer**

| Type | Payload | Description |
|------|---------|-------------|
| `observer:mute` | `{ muted }` | User toggled mute Paige |

**Practice (Story 12)**

| Type | Payload | Description |
|------|---------|-------------|
| `practice:submit_solution` | `{ kataId, code, activeConstraints: string[] }` | Submit practice kata solution for review |

#### Debouncing Rules

| Event Source | Debounce Interval | Rationale |
|--------------|-------------------|-----------|
| `buffer:update` | 300ms | Avoid flooding backend with per-keystroke updates |
| `editor:scroll` | 200ms | Scroll events fire rapidly; Observer needs trends not ticks |
| `user:idle_start` | 5000ms (5s) | Only report idle after sustained inactivity |

#### Reconnection

- Strategy: exponential backoff (1s, 2s, 4s, 8s, 16s, cap at 30s)
- Reset backoff timer on successful connection
- UI indicator: subtle banner at top of viewport — `--bg-elevated` background, `--text-secondary` text: "Reconnecting..."
- On reconnect: re-send `connection:hello`, backend responds with current state
- If in IDE view: backend re-sends `session:started` (or `session:resumed`) with full state
- If on dashboard: backend re-sends dashboard data messages

#### Acceptance Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 4.1 | App launches | WebSocket connects, handshake completes, `connection:init` received |
| 4.2 | Backend sends dashboard data | Dashboard sections populate as each message arrives |
| 4.3 | User opens file | `file:open` sent, `fs:content` received, editor populated |
| 4.4 | User edits code | `buffer:update` sent after 300ms debounce with content + cursor |
| 4.5 | User saves file | `file:save` sent, `fs:save_ack` received |
| 4.6 | Backend disconnects | "Reconnecting..." indicator appears. Backoff retry begins. |
| 4.7 | Reconnect succeeds | Indicator disappears. State restored. Backoff resets. |
| 4.8 | Paige sends decorations | `editor:decorations` received, Monaco renders highlights |
| 4.9 | Observer nudge arrives | `observer:nudge` received, injected into PTY |
| 4.10 | User goes idle 5s | `user:idle_start` sent to backend for Observer |
| 4.11 | Multiple rapid messages | Messages processed in order, UI remains responsive |

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| E4.1 | Backend not running on app launch | Retry with backoff; show "Connecting to Paige..." on dashboard |
| E4.2 | Message with unknown type received | Log warning, ignore message, do not crash |
| E4.3 | Message payload fails validation | Log error with context, ignore message |
| E4.4 | WebSocket buffer fills (slow consumer) | Backend should handle backpressure; client processes as fast as possible |
| E4.5 | Very large file content (>1MB) | Accept and pass to Monaco; Monaco handles large files natively |
| E4.6 | Rapid reconnect/disconnect cycles | Cap retry at 30s, show persistent error after 5 failed attempts |

#### Requirements

| ID | Requirement |
|----|-------------|
| R4.1 | All UI↔Backend communication MUST use WebSocket (no REST, no direct file I/O) |
| R4.2 | All messages MUST follow the `{ type, payload, id?, timestamp }` envelope |
| R4.3 | Message types MUST be TypeScript string literal unions (compile-time safety) |
| R4.4 | `buffer:update` MUST be debounced at 300ms |
| R4.5 | `editor:scroll` MUST be debounced at 200ms |
| R4.6 | `user:idle_start` MUST fire after 5000ms of inactivity |
| R4.7 | Reconnection MUST use exponential backoff capped at 30s |
| R4.8 | Unknown message types MUST be logged and ignored (no crash) |
| R4.9 | Message handlers MUST be registered per-type (no giant switch statement) |
| R4.10 | WebSocket client MUST be a singleton service shared across all components |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC4.1 | Type safety | All 48 message types have TypeScript interfaces; no `any` in message handling |
| SC4.2 | Reconnection works | Disconnect → reconnect → state restored within backoff window |
| SC4.3 | Debouncing correct | `buffer:update` fires max once per 300ms under continuous typing |
| SC4.4 | No data loss | File save → ack round-trip completes; no silent failures |

### Story 5: Code Editor (Monaco) [P1] ✅

**As a** developer working on an issue in Paige,
**I want** a familiar, responsive code editor with tabs, syntax highlighting, and Paige-controlled decorations,
**So that** I can read and edit code comfortably while seeing coaching hints directly in my workspace.

**Priority**: P1 — The primary workspace surface; where the user spends most of their time.
**Dependencies**: Story 1 (Visual Identity), Story 2 (App Shell), Story 4 (WebSocket).

#### Tab System

- Horizontal tab strip at top of editor area
- Each tab shows: language icon (by file extension) + filename + close button (X)
- Active tab: terracotta bottom border (`--accent-primary`), `--bg-surface` background
- Inactive tabs: `--bg-base` background, `--text-secondary` text
- Dirty (unsaved) state: dot indicator replaces the close icon (dot uses `--accent-primary`); hovering the dot reveals the close X
- Closing a dirty tab: confirmation prompt ("Save changes to {filename}?" — Save / Don't Save / Cancel)
- Tab overflow: horizontal scroll with subtle fade indicators at edges
- No drag reorder, no tab context menu (KISS)
- Clicking a file already open in a tab switches to that tab (no duplicate tabs)

#### Monaco Configuration

- Library: `@monaco-editor/react`
- No minimap
- Line numbers: on
- Word wrap: off (standard code editing)
- Bracket matching: on (Monaco default)
- Auto-indent: on (Monaco default)
- Cursor style: line, blinking
- Cursor color: `--accent-primary` (#d97757)
- Scrollbar: styled to match warm palette (thin, `--bg-elevated` thumb)
- Font: Monaco default (inherits from system/Monaco — 14px, as per Story 1)

#### Custom Monaco Theme: "Paige Dark"

**Editor Chrome**

| Element | Monaco Token | Value |
|---------|-------------|-------|
| Background | `editor.background` | `--bg-inset` (#141413) |
| Foreground | `editor.foreground` | `--text-primary` (#faf9f5) |
| Line numbers | `editorLineNumber.foreground` | `--text-muted` (#6b6960) |
| Active line number | `editorLineNumber.activeForeground` | `--text-secondary` (#a8a69e) |
| Cursor | `editorCursor.foreground` | `--accent-primary` (#d97757) |
| Selection | `editor.selectionBackground` | rgba(217,119,87,0.25) |
| Find match | `editor.findMatchHighlightBackground` | rgba(217,119,87,0.3) |
| Current line | `editor.lineHighlightBackground` | rgba(48,48,46,0.5) |
| Widget bg | `editorWidget.background` | `--bg-surface` (#252523) |
| Widget border | `editorWidget.border` | `--border-subtle` (#30302e) |

**Syntax Tokens** (warm-toned, no cold blues/purples)

| Token Type | Color | Examples |
|------------|-------|---------|
| Keywords | `--accent-primary` (#d97757) | `const`, `function`, `return`, `if`, `import` |
| Strings | `--status-success` (#7cb87c) | String/template literals |
| Comments | `--text-muted` (#6b6960) | All comment forms |
| Numbers | `--accent-warm` (#e8956a) | Numeric literals |
| Types/Interfaces | `--status-info` (#6b9bd2) | Type annotations, interfaces, generics |
| Functions | `--text-primary` (#faf9f5) | Function/method names |

#### Decorations (Backend-Controlled)

All decorations are applied from `editor:decorations` WebSocket messages. The editor never generates its own decorations.

**Decoration type + style matrix**

| Type | Style | Visual Treatment |
|------|-------|-----------------|
| `line-highlight` | `hint` | Full-line background: `--hint-glow` (rgba(217,119,87,0.4)) |
| `line-highlight` | `error` | Full-line background: rgba(224,82,82,0.15) |
| `line-highlight` | `success` | Full-line background: rgba(124,184,124,0.15) |
| `gutter-marker` | `hint` | Terracotta dot in gutter: `--accent-primary` |
| `gutter-marker` | `error` | Red dot in gutter: `--status-error` |
| `gutter-marker` | `warning` | Yellow dot in gutter: `--status-warning` |
| `squiggly` | `error` | Red wavy underline: `--status-error` |
| `squiggly` | `warning` | Yellow wavy underline: `--status-warning` |

**Hover hints** (`editor:hover_hint`) render as a tooltip positioned at the range:
- Background: `--bg-elevated`
- Border: `--border-active` (terracotta at 60%)
- Text: `--text-primary`
- Max width: 400px
- Appears on hover over the decorated range

#### Floating "Explain" Button

- Appears when the user selects text (2+ characters)
- Small circular button (24px) with Paige icon, positioned above-right of the selection end
- Background: `--accent-primary`, icon: `--text-primary`
- Hover: `--accent-warm` background
- Click sends `user:explain` with `{ path, range, selectedText }`
- Disappears when selection is cleared
- Does not appear for single-click cursor placement (selection must have length)

#### Empty State (No File Open)

- Centered in the editor area
- Figlet-rendered "PAIGE" ASCII art in `--accent-primary` (terracotta)
- Below: "Open a file from the explorer to get started" in `--text-secondary`
- Below that: keyboard shortcut hint — "Cmd+S to save" in `--text-muted`
- Dot matrix background texture (consistent with design system)

#### File Operations Flow

| Action | Client Message | Server Response | Editor Behavior |
|--------|---------------|-----------------|-----------------|
| Open file | `file:open { path }` | `fs:content { path, content, language, lineCount }` | Opens new tab (or switches to existing), sets language mode |
| Save file | `file:save { path, content }` | `fs:save_ack { path, success, timestamp }` | Clears dirty dot on success |
| Save fails | `file:save { path, content }` | `fs:save_error { path, error }` | Dirty dot remains, error toast with message |
| Close tab | (local only) | — | Removes tab; if dirty, prompt first |
| Edit buffer | — | — | After 300ms debounce: `buffer:update { path, content, cursorPosition, selections }` |
| Tab switch | (local + notify) | — | Sends `editor:tab_switch { fromPath, toPath }` |

#### Status Bar (Editor Footer)

VS Code-style status bar at the bottom of the editor area, 32px height. Background: `--bg-surface`. Border-top: `--border-subtle`.

```
┌──────────────────────────────────────────────────────────┐
│  src/components/Auth.tsx    Ln 42, Col 18   TypeScript   │  ← left / center / right
│                                          [Review My Work]│
└──────────────────────────────────────────────────────────┘
```

- **Left**: File path breadcrumb (relative path of active file) in `--text-muted` (12px)
- **Center-left**: Cursor position — `Ln {line}, Col {col}` in `--text-muted` (12px)
- **Center-right**: Language indicator (from `fs:content` language field) in `--text-muted` (12px)
- **Right**: "Review My Work" button — text button in `--accent-primary`, hover: `--accent-warm`. Click sends `user:review {}` via WebSocket.

When no file is open: breadcrumb, cursor, and language sections are empty. "Review My Work" button remains visible.

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+S | Save current file (sends `file:save`) |
| Cmd+W | Close current tab (with dirty check) |
| All Monaco defaults | Undo, redo, find, replace, go to line, etc. |

#### Acceptance Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 5.1 | No file open | Figlet "PAIGE" splash with help text centered in editor area |
| 5.2 | Click file in explorer | New tab opens, file content loads, correct syntax highlighting |
| 5.3 | Click already-open file | Switches to existing tab (no duplicate) |
| 5.4 | Edit a file | Dirty dot appears on tab. Buffer update sent after 300ms. |
| 5.5 | Cmd+S on dirty file | `file:save` sent, `fs:save_ack` received, dirty dot cleared |
| 5.6 | Cmd+W on clean tab | Tab closes immediately |
| 5.7 | Cmd+W on dirty tab | "Save changes?" prompt appears with Save/Don't Save/Cancel |
| 5.8 | Open 10+ files | Tab strip scrolls horizontally. Fade indicators at edges. |
| 5.9 | Backend sends `editor:decorations` | Correct decoration type renders (glow, gutter dot, squiggly) |
| 5.10 | Hover over decorated range | Hint tooltip appears with correct styling |
| 5.11 | Backend sends `editor:clear_decorations` | All decorations removed (or per-file if path specified) |
| 5.12 | Select code in editor | Floating Paige explain button appears above-right of selection |
| 5.13 | Click explain button | `user:explain` sent with path, range, selected text. Button disappears. |
| 5.14 | View editor background and syntax colors | Warm palette throughout — terracotta keywords, green strings, no cold hues |

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| E5.1 | File content >1MB | Pass to Monaco; it handles large files natively |
| E5.2 | Binary file opened | Show "Binary file — cannot display" message in tab area |
| E5.3 | File deleted while tab open | Tab remains with last content; show subtle "File deleted" indicator |
| E5.4 | Save fails (backend error) | Dirty dot remains; brief error toast with backend error message |
| E5.5 | Unknown file extension / no language | Monaco defaults to plain text mode |
| E5.6 | Multiple files with same name | Tab shows `parent/filename` (e.g., `components/index.ts` vs `utils/index.ts`); tooltip shows full relative path |
| E5.7 | Decorations for a file not currently open | Store decorations; apply when file tab becomes active |
| E5.8 | Selection spans multiple lines for explain | Button anchored to end of selection; sends full selected text |

#### Requirements

| ID | Requirement |
|----|-------------|
| R5.1 | Editor MUST use `@monaco-editor/react` |
| R5.2 | Custom Monaco theme ("Paige Dark") MUST use design tokens from Story 1 |
| R5.3 | No raw hex color values in editor theme definition — all MUST reference design tokens or derive from them |
| R5.4 | Minimap MUST be disabled |
| R5.5 | All decorations MUST originate from backend via `editor:decorations` WebSocket messages |
| R5.6 | Editor MUST NOT generate its own decorations (thin client principle) |
| R5.7 | `buffer:update` MUST be debounced at 300ms per Story 4 |
| R5.8 | Closing a dirty tab MUST show a save confirmation prompt |
| R5.9 | Duplicate tabs MUST be prevented (opening an already-open file switches to its tab) |
| R5.10 | Cmd+S MUST trigger `file:save` via WebSocket |
| R5.11 | Language mode MUST be set from the `language` field in `fs:content` response |
| R5.12 | Editor MUST include a 32px status bar at bottom with file path, cursor position, language, and "Review My Work" button |
| R5.13 | "Review My Work" button MUST send `user:review` via WebSocket |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC5.1 | Theme matches design system | Editor background is #141413, cursor is terracotta, no cold-hued syntax tokens |
| SC5.2 | Decorations render correctly | All 4 decoration types display with correct visual treatment per style matrix |
| SC5.3 | Tab system works | Open, switch, close, dirty indicator all function; no duplicate tabs |
| SC5.4 | File round-trip works | Open → edit → save → ack completes; dirty state tracks correctly |
| SC5.5 | Explain button works | Select text → button appears → click → `user:explain` sent with correct payload |

### Story 6: File Explorer with Hint Glow [P1] ✅

**As a** developer working on an issue in Paige,
**I want** a file tree that shows project structure and subtly glows to guide me toward relevant files,
**So that** I can navigate the codebase with optional coaching hints that feel like discovery, not instruction.

**Priority**: P1 — Left sidebar panel; primary navigation and the "breakable wall" demo highlight.
**Dependencies**: Story 1 (Visual Identity), Story 2 (App Shell), Story 4 (WebSocket).

#### Tree Component

- Library: `react-arborist` (virtualized, custom node rendering, keyboard nav)
- File icons: `vscode-icons` (per file type, familiar to developers)
- Panel width: 220px fixed (Story 2)
- Background: `--bg-surface`

**Header**: "EXPLORER" in uppercase `--text-muted` (12px, weight 500) at top of panel, with 8px padding.

#### Node Rendering

| Element | Style |
|---------|-------|
| Folder icon | Chevron (right when collapsed, down when expanded) + folder icon |
| File icon | vscode-icons by file extension |
| Filename text | `--text-primary` (14px) |
| Indentation | 20px per nesting level |
| Selected node | `--bg-elevated` background |
| Hovered node | `--bg-elevated` at 50% opacity |
| Active (open in editor) | `--text-primary` bold weight |

#### Click Behavior

- **Single click file**: Opens file in editor tab (sends `file:open` via WebSocket). If file already open, switches to its tab.
- **Single click folder**: Expands or collapses. Sends `explorer:expand_dir` or `explorer:collapse_dir` to backend.
- **Keyboard**: Arrow keys navigate, Enter opens/expands, Left collapses current or navigates to parent.

#### Data Flow

| Event | Message | Description |
|-------|---------|-------------|
| Session start | `fs:tree` (server → client) | `{ root: TreeNode }` — full tree structure |
| File created/deleted/renamed | `fs:tree_update` (server → client) | `{ action: 'add' \| 'remove' \| 'rename', path, newPath? }` |
| User expands directory | `explorer:expand_dir` (client → server) | `{ path }` — backend logs for Observer |
| User collapses directory | `explorer:collapse_dir` (client → server) | `{ path }` — backend logs for Observer |

**TreeNode structure** (from backend):
```typescript
interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}
```

#### Three-Tier Hint Glow System

Hints are triggered by `explorer:hint_files` from the backend. Three styles map to the hint level progression:

**`explorer:hint_files` payload** (revised from Story 4):
```typescript
{
  hints: Array<{
    path: string;                  // file to hint
    style: 'subtle' | 'obvious' | 'unmissable';
    directories?: string[];        // directory paths to also glow (backend-determined)
  }>
}
```

**Style behaviors:**

| Style | File Glow | Directory Glow | When Used |
|-------|-----------|---------------|-----------|
| `subtle` | Gentle breathing glow | None | Hint level: File — "look around here" |
| `obvious` | Gentle breathing glow | Backend-selected directories glow at gentle breathing | Hint level: Line — "this area matters" |
| `unmissable` | Gentle breathing glow | ALL directories in `directories[]` glow with distance-based intensity gradient | Hint level: Detail — "right here" |

**Gentle breathing glow** (baseline for all styles):
- Animation: `gentle` spring preset (stiffness: 120, damping: 14), looping
- Color: `--hint-glow` (rgba(217,119,87,0.4))
- Applied as a background glow on the tree node row

**Unmissable gradient** (directory intensity based on distance from file):
- Parent directory of hinted file: **brightest/fastest** — stiffness: 400, damping: 25, glow opacity: 0.7
- Each ancestor further up: progressively slower and dimmer (linear interpolation)
- Caps at gentle breathing baseline (stiffness: 120, damping: 14, opacity: 0.4) — stays there for all remaining ancestors
- Frontend computes intensity per directory: `intensity = 1.0 - (distance / totalDepth)`, clamped to [0, 1]
- Maps intensity to animation parameters:
  - Stiffness: lerp(120, 400, intensity)
  - Damping: lerp(14, 25, intensity)
  - Glow opacity: lerp(0.4, 0.7, intensity)

**When multiple hints affect the same directory**: highest intensity wins.

**For `obvious` style**: backend sends `directories[]` with the meaningful ancestor directories (backend decides what's "generic" vs "meaningful" — no hardcoded list in the frontend). All directories glow at gentle breathing baseline.

**`explorer:clear_hints`**: Removes all file and directory glows. Payload: `{}`.

#### Auto-Expand on Hint

When a hint arrives for a file inside a collapsed directory:
- `subtle`: do NOT auto-expand (user discovers by exploring)
- `obvious`: auto-expand to reveal the glowing top-level directory only
- `unmissable`: auto-expand the full path to reveal the hinted file

#### Acceptance Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 6.1 | Session starts | File tree renders from `fs:tree` data with correct icons and nesting |
| 6.2 | Click a file | File opens in editor tab, tree node shows selected/active state |
| 6.3 | Click a folder | Folder expands/collapses with immediate response |
| 6.4 | Backend sends `subtle` hint | Hinted file has gentle breathing terracotta glow. No directory glow. |
| 6.5 | Backend sends `obvious` hint | Hinted file glows. Backend-specified directories also glow at gentle breathing. |
| 6.6 | Backend sends `unmissable` hint | Hinted file glows. All ancestor directories glow with gradient — parent brightest, fading up. |
| 6.7 | `unmissable` hint on collapsed tree | Path auto-expands to reveal the hinted file |
| 6.8 | `subtle` hint on collapsed tree | Tree stays collapsed; user must manually expand to find the glow |
| 6.9 | `explorer:clear_hints` received | All glows removed immediately across files and directories |
| 6.10 | File created while session active | `fs:tree_update` with `add` action; new node appears in correct position |
| 6.11 | File deleted while session active | `fs:tree_update` with `remove` action; node removed from tree |
| 6.12 | File renamed | `fs:tree_update` with `rename` action; node updates in place |
| 6.13 | Keyboard navigate tree | Arrow keys move selection, Enter opens file or toggles folder |
| 6.14 | Many files (500+) | Tree remains responsive (react-arborist virtualization) |

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| E6.1 | Very deep nesting (10+ levels) | Indentation continues at 20px/level; horizontal scroll if needed |
| E6.2 | Empty project (no files) | Tree shows "No files in project" in `--text-muted` |
| E6.3 | Multiple hints for same file | Latest hint style wins (backend sends fresh hint set) |
| E6.4 | Hint for file not in tree | Ignore hint silently (log warning) |
| E6.5 | `fs:tree_update` for non-existent path | Ignore update (log warning) |
| E6.6 | Multiple hints cause same directory to glow at different intensities | Highest intensity wins |
| E6.7 | Very long filenames | Truncate with ellipsis; tooltip shows full name |
| E6.8 | Hidden files (dotfiles) | Shown in tree (developers need .gitignore, .env, config files) |

#### Requirements

| ID | Requirement |
|----|-------------|
| R6.1 | File tree MUST use `react-arborist` with virtualized rendering |
| R6.2 | File icons MUST use `vscode-icons` |
| R6.3 | All tree data MUST come from backend via WebSocket (`fs:tree`, `fs:tree_update`) |
| R6.4 | Tree MUST NOT access the filesystem directly (thin client) |
| R6.5 | Hint glow MUST use Framer Motion with `gentle` spring preset as baseline |
| R6.6 | `unmissable` directory gradient MUST interpolate from parent (brightest) to baseline (gentlest) |
| R6.7 | Frontend MUST NOT hardcode "generic directory" names — backend determines which directories to glow |
| R6.8 | Single click on file MUST open it in editor (sends `file:open`) |
| R6.9 | `explorer:hint_files` format MUST support per-file style and optional directory list |
| R6.10 | Auto-expand behavior MUST match hint style: none for subtle, top-level for obvious, full path for unmissable |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC6.1 | Tree renders correctly | Full project tree displays with correct icons, nesting, expand/collapse |
| SC6.2 | Three hint styles visually distinct | subtle = file only; obvious = file + key dirs; unmissable = full path gradient |
| SC6.3 | Gradient animation visible | `unmissable` parent directory visibly brighter/faster than distant ancestors |
| SC6.4 | Auto-expand matches style | `subtle` stays collapsed; `unmissable` reveals file |
| SC6.5 | Performance with large trees | 500+ files render and scroll without jank |

### Story 7: Terminal with xterm.js [P1] ✅ *(Revised: REV-9)*

**As a** developer working on an issue in Paige,
**I want** a terminal panel where I talk to Claude Code and receive coaching guidance inline,
**So that** I can have a conversational coaching experience in a familiar terminal environment.

**Priority**: P1 — The conversational coaching surface; where the user interacts with Paige.
**Dependencies**: Story 1 (Visual Identity), Story 2 (App Shell), Story 4 (WebSocket).

#### Rendering Approach: xterm.js

The terminal uses xterm.js for rendering. The original "Full React (No xterm.js)" approach was invalidated by PoC — Claude Code's TUI output (cursor positioning, alternate screen buffer, box-drawing characters, powerline glyphs) requires a full terminal emulator, not ANSI-to-React parsing.

- PTY spawned via `node-pty` in Electron main process
- Raw PTY data sent to renderer via Electron IPC
- Renderer writes data directly to xterm.js instance via `terminal.write(data)`
- xterm.js handles all ANSI parsing, cursor movement, screen management, and rendering
- xterm.js `FitAddon` manages automatic terminal sizing to container

#### Terminal Panel Layout

- **Header**: "TERMINAL" in uppercase `--text-muted` (12px, weight 500)
- **Terminal area**: xterm.js canvas, fills remaining panel height
- **Input**: xterm.js captures keystrokes when focused; forwarded to PTY via `terminal.onData()` → IPC → `pty.write()`

Background: `--bg-inset` (#141413). Font: JetBrains Mono 14px.

#### Data Pipeline

```
PTY (node-pty)
  → pty.onData()
  → Electron main process
  → IPC to renderer
  → xterm.write(data)
```

#### Observer Nudge Flow

Observer nudges are invisible to the user from a UI perspective:

1. Backend sends `observer:nudge` via WebSocket: `{ signal, confidence, context }`
2. Electron main process writes nudge prompt to PTY stdin (Claude Code processes it as Paige)
3. The nudge prompt includes instructions telling Claude it was an automated prompt, so it adjusts response language accordingly
4. Claude Code's response streams through PTY → renders in xterm.js as normal output
5. Any MCP tool calls triggered by the nudge render their results normally
6. No visual distinction between user-initiated and observer-initiated interactions

#### Warm-Mapped ANSI Color Palette

All 16 ANSI colors remapped to warm-toned variants, applied as an xterm.js `ITheme`:

**Standard 8**

| ANSI | Name | Color | Reference |
|------|------|-------|-----------|
| 0 | Black | #1a1a18 | `--bg-base` |
| 1 | Red | #d97757 | `--accent-primary` (terracotta) |
| 2 | Green | #7cb87c | `--status-success` |
| 3 | Yellow | #d4a843 | `--status-warning` |
| 4 | Blue | #6b9bd2 | `--status-info` |
| 5 | Magenta | #c0879b | warm rose |
| 6 | Cyan | #7aab9e | warm sage |
| 7 | White | #a8a69e | `--text-secondary` |

**Bright 8**

| ANSI | Name | Color | Reference |
|------|------|-------|-----------|
| 8 | Bright Black | #6b6960 | `--text-muted` |
| 9 | Bright Red | #e8956a | `--accent-warm` |
| 10 | Bright Green | #96d096 | lighter warm green |
| 11 | Bright Yellow | #e5c35c | lighter warm yellow |
| 12 | Bright Blue | #8bb4e0 | lighter warm blue |
| 13 | Bright Magenta | #d4a0b0 | lighter warm rose |
| 14 | Bright Cyan | #96c4b8 | lighter warm sage |
| 15 | Bright White | #faf9f5 | `--text-primary` |

Foreground default: `--text-primary` (#faf9f5). Background default: `--bg-inset` (#141413). Cursor: `--accent-primary` (#d97757). Selection: `--accent-primary` at 30% opacity.

#### PTY Size Management

- xterm.js `FitAddon` calculates cols/rows from container dimensions automatically
- `FitAddon.fit()` called on container resize (via `ResizeObserver`)
- On fit, new dimensions written to PTY via `pty.resize(cols, rows)`
- Send `terminal:ready` (on init) and `terminal:resize` (on change) to backend via WebSocket

#### Input Handling

- xterm.js captures keyboard events natively when the terminal element is focused
- `terminal.onData(data)` fires for each user input → sent to main process via IPC → `pty.write(data)`
- xterm.js handles control sequences (Ctrl+C, Ctrl+D, Ctrl+Z), arrow keys, Tab, and all standard terminal input natively
- Terminal only captures input when its container element has focus

#### Acceptance Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 7.1 | Session starts, terminal initializes | Shell prompt appears in xterm.js, user can type commands |
| 7.2 | Run `ls --color` | Colored output rendered with warm-mapped ANSI colors in xterm.js |
| 7.3 | Run a command producing 1000+ lines | xterm.js scrollback handles output without freezing |
| 7.4 | Type Ctrl+C during a running command | SIGINT sent, command interrupted |
| 7.5 | Observer nudge arrives | Main process writes prompt to PTY; Claude Code responds; output appears as normal terminal text |
| 7.6 | Terminal panel resized (sidebar collapse) | FitAddon recalculates dimensions, PTY resized, subsequent output reflows |
| 7.7 | Interactive command (`read` prompt, etc.) | User can type input to running script, echoed correctly |
| 7.8 | Claude Code TUI renders (welcome screen, status bars) | Full TUI renders correctly via xterm.js (cursor positioning, box-drawing, powerline) |

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| E7.1 | Rapid successive output (>10KB/s) | xterm.js handles rendering performance natively |
| E7.2 | PTY exits (user types `exit`) | Terminal shows "Process exited" message; no crash |
| E7.3 | Non-UTF8 output (binary data) | xterm.js best-effort rendering; don't crash |
| E7.4 | Terminal focused while typing in editor | xterm.js only captures input when its element has focus |
| E7.5 | `prefers-reduced-motion` active | No animated elements in terminal (cursor blink can be disabled) |
| E7.6 | Very long scrollback (10k+ lines) | xterm.js scrollback buffer capped at configurable limit (default 5000 lines) |

#### Requirements

| ID | Requirement |
|----|-------------|
| R7.1 | Terminal MUST use xterm.js for rendering |
| R7.2 | All 16 ANSI colors MUST be remapped to warm palette variants via xterm.js `ITheme` |
| R7.3 | PTY dimensions MUST be managed via xterm.js `FitAddon` with `ResizeObserver` |
| R7.4 | Observer nudges MUST be written to PTY stdin by main process (no UI treatment) |
| R7.5 | Control characters (Ctrl+C, Ctrl+D, Ctrl+Z) MUST be forwarded to PTY via xterm.js `onData` |
| R7.6 | Terminal MUST only capture keyboard input when focused |
| R7.7 | xterm.js `WebLinksAddon` MUST be enabled for clickable URLs |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC7.1 | ANSI rendering fidelity | Colored output renders correctly with warm-mapped colors in xterm.js |
| SC7.2 | TUI rendering | Claude Code welcome screen, status bars, and powerline render correctly |
| SC7.3 | Input responsiveness | Typing feels immediate (PTY echo latency <50ms perceptible) |
| SC7.4 | Large output performance | 1000+ lines scroll without jank |

### Story 8: Coaching Sidebar (Issue + Phases) [P1] ✅

**As a** developer working on an issue in Paige,
**I want** a sidebar showing my current issue context and coaching phase progression with adjustable detail,
**So that** I can always see what I'm working on, where I am in the plan, and control how much guidance I receive.

**Priority**: P1 — The coaching command center; makes the scaffolded learning visible.
**Dependencies**: Story 1 (Visual Identity), Story 2 (App Shell), Story 4 (WebSocket).

#### Sidebar Layout

Right sidebar, 280px fixed width (Story 2). Background: `--bg-surface`. Independently scrollable when content exceeds panel height.

```
┌──────────────────────┐
│  COACHING       [^]  │  ← Header + collapse toggle
├──────────────────────┤
│  #42                 │  ← Issue number (clickable link)
│  Fix auth token bug  │  ← Title
│  🏷 bug  🏷 auth     │  ← Label pills
│  ▾ Summary           │  ← Toggleable
│  "Auth token refresh │
│   fails silently..." │
├──────────────────────┤
│  ┌──────────────────┐│
│  │  [illustration]  ││  ← SVG, morphs per level
│  └──────────────────┘│
│  ○───○───●───○       │  ← Stepped slider (0-3)
│  None Light Med Heavy│  ← Level labels
├──────────────────────┤
│  ✓ 1. Understand     │  ← Complete (green)
│  ● 2. Plan approach  │  ← Active (terracotta, expanded)
│    │  Summary text    │
│    │  ├ Step 2.1      │  ← Sub-steps (level 2+)
│    │  ├ Step 2.2      │
│    │  └ Step 2.3      │
│  ○ 3. Implement      │  ← Pending (muted)
│  ○ 4. Test & verify  │
│  ○ 5. Review         │
└──────────────────────┘
```

**Header**: "COACHING" in uppercase `--text-muted` (12px, weight 500), consistent with "EXPLORER" and "TERMINAL" panel headers. Collapse toggle icon at right edge (Story 2 sidebar collapse behavior).

#### Issue Context Section

- **Issue number**: `#N` in `--accent-primary`, clickable. Opens GitHub issue URL in default browser via Electron `shell.openExternal`.
- **Title**: H3 (18px, weight 600), `--text-primary`. Below issue number.
- **Labels**: Horizontal row of pill badges below title. Each pill: background from GitHub label hex color, text auto-contrasted (white on dark labels, dark on light labels), border-radius 12px, font Small (12px). Hidden entirely when issue has no labels.
- **Summary**: AI-generated by backend (Claude API call), max 250 characters. Summarizes issue body + comments — not just the issue description.
  - Toggle: chevron icon (▾ expanded / ▸ collapsed) + "Summary" label in `--text-muted`. Click toggles.
  - Default state: expanded (visible).
  - Text: `--text-secondary`, Body size (14px).
- **Divider**: `--border-subtle` horizontal line below the section.

Data sources: `coaching:issue_context` and `session:started.issueContext`.

#### Hint Level Slider

Positioned between issue context and phase stepper. Controls both the phase detail shown in this sidebar and the hint intensity in the file explorer (Story 6) and editor (Story 9).

**SVG Illustration** (centered above slider, ~120px tall):

Morphs between 4 scenes with `standard` spring animation (stiffness: 300, damping: 28) on level change:

| Level | Label | Illustration |
|-------|-------|-------------|
| 0 | None | Person hunched over laptop, looking determined |
| 1 | Light | Person with stack of books next to laptop, more relaxed |
| 2 | Medium | Second person standing behind, pointing at screen; first person happy with lightbulb over head |
| 3 | Heavy | Second person seated at laptop; first person standing behind in straw hat and sunglasses, drinking a colorful cocktail |

Scanline overlay on the illustration background (consistent with Story 1 aesthetic).

**Stepped slider control**:
- 4 discrete positions (0, 1, 2, 3)
- Track: `--border-subtle` background, `--accent-primary` fill from left up to active position
- Thumb: 16px circle, `--accent-primary` fill, 2px `--bg-surface` border
- Level labels below each stop: "None", "Light", "Medium", "Heavy" in `--text-muted` (12px)
- Active label: `--text-secondary`
- On change: sends `hints:level_change { level }` via WebSocket

**Divider**: `--border-subtle` horizontal line below the slider section.

#### Phase Stepper

Vertical stepper layout with connected status line. Maximum 5 phases per issue.

**Connecting line**:
- 2px wide vertical line running through phase indicators
- Completed segment: `--phase-complete` (#7cb87c)
- Active-to-pending segment: `--border-subtle` (#30302e)

**Phase indicators** (circles on the line):

| Status | Indicator | Size | Color |
|--------|-----------|------|-------|
| Complete | Filled circle with checkmark icon | 12px | `--phase-complete` (#7cb87c) |
| Active | Filled circle with subtle pulse animation | 14px | `--phase-active` (#d97757) |
| Pending | Outlined circle, unfilled | 12px | `--phase-pending` (#6b6960) |

Active phase pulse: `gentle` spring preset (stiffness: 120, damping: 14), looping.

**Phase title text** (right of indicator):

| Status | Style |
|--------|-------|
| Complete | `--text-secondary`, normal weight |
| Active | `--text-primary`, weight 600 |
| Pending | `--text-muted`, normal weight |

Font: Body (14px).

#### Hint-Level-Driven Phase Detail

Only the active phase shows expanded content. Inactive phases always show title + status indicator only, regardless of hint level.

| Level | Active Phase Shows |
|-------|-------------------|
| 0 (None) | Title + status indicator only |
| 1 (Light) | Title + summary (2-3 sentences, `--text-secondary`) |
| 2 (Medium) | Title + summary + sub-step titles (bulleted list) |
| 3 (Heavy) | Title + summary + sub-step accordion |

**Sub-step accordion** (Level 3 only):
- Each sub-step: clickable title row with chevron
- Click expands to show description of required changes
- Only one sub-step expanded at a time (clicking another closes the previous)
- Expanded sub-step: description in `--text-secondary` (14px), indented, with 2px left border in `--accent-primary`
- Collapsed sub-step title: `--text-primary` (14px)
- Expand/collapse: `snappy` spring preset (stiffness: 400, damping: 35)

#### Phase Transition Animation

When a phase completes and the next becomes active:

1. Completing phase indicator fills with green checkmark (`snappy` spring)
2. Connecting line segment fills `--phase-complete` upward to next phase
3. Next phase indicator transitions from pending outline to active filled circle (pulse begins)
4. If hint level > 0: active phase content area expands with detail (`standard` spring)

#### Phase Data Structure

```typescript
// Within session:started payload
interface Phase {
  number: number;        // 1-5
  title: string;         // e.g., "Understand the problem"
  status: 'pending' | 'active' | 'complete';
  summary: string;       // 2-3 sentence description
  steps: Array<{
    title: string;       // e.g., "Read the failing test"
    description: string; // e.g., "Look at test/auth.test.ts — the assertion on line 42..."
  }>;
}
```

Backend sends all phase data (including summaries and step descriptions) upfront in `session:started`. Frontend filters display based on current hint level — no round-trip needed on level change.

#### Revised Issue Context Data Structure

```typescript
// Revision to coaching:issue_context (Story 4)
interface IssueContext {
  number: number;        // GitHub issue number
  title: string;
  summary: string;       // AI-generated, max 250 chars
  labels: Array<{
    name: string;
    color: string;       // Hex color from GitHub
  }>;
  url: string;           // Full GitHub issue URL
}
```

#### Collapsed Sidebar State

When sidebar is collapsed to 32px rail (Story 2):
- Coaching icon centered in rail (small Paige logo or speech bubble icon)
- No content visible
- Click rail toggle to expand back to full 280px

#### Acceptance Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 8.1 | Session starts (issue selected from dashboard) | Sidebar populates with issue context + phases from `session:started` |
| 8.2 | View issue number | `#N` displayed in terracotta, styled as link |
| 8.3 | Click issue number | GitHub issue opens in default browser |
| 8.4 | View issue labels | Colored pills render with GitHub label colors, text contrast-adjusted |
| 8.5 | Click summary chevron | Summary text collapses/expands with spring animation |
| 8.6 | View hint slider at level 0 | "None" illustration shown, slider at leftmost, phases show titles only |
| 8.7 | Move slider to level 1 | Illustration morphs to "Light" scene, active phase shows summary |
| 8.8 | Move slider to level 2 | Illustration morphs to "Medium", active phase adds sub-step titles |
| 8.9 | Move slider to level 3 | Illustration morphs to "Heavy", active phase shows sub-step accordion |
| 8.10 | Click sub-step title at level 3 | Accordion expands showing description; previous sub-step collapses |
| 8.11 | View phase stepper | Vertical stepper with connected line, indicators colored by status |
| 8.12 | Phase completes during session | Green checkmark appears, line fills, next phase activates with pulse |
| 8.13 | All phases complete | All indicators green with checkmarks, no active expansion |
| 8.14 | Content overflows sidebar height | Sidebar scrolls independently of editor and terminal |
| 8.15 | Sidebar collapsed | 32px rail with coaching icon, no content visible |
| 8.16 | Expand collapsed sidebar | Full content restored, hint level and phase state preserved |
| 8.17 | Session resumed from dashboard | Sidebar restores issue context + phase state from `session:resumed` |

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| E8.1 | Issue has no labels | Labels row hidden entirely (no empty pills, no "no labels" message) |
| E8.2 | Issue summary >250 chars from backend | Frontend truncates at 250 chars with ellipsis (backend should enforce, defense in depth) |
| E8.3 | Very long phase title | Truncate with ellipsis; tooltip shows full title |
| E8.4 | Only 1-2 phases | Stepper renders correctly with fewer nodes; connecting line shortened |
| E8.5 | Phase update for non-existent phase number | Ignore, log warning |
| E8.6 | Hint level drops below 3 while accordion open | Accordion state resets; sub-steps hidden |
| E8.7 | SVG illustrations not ready at build time | Fallback: level name in large text with representative emoji |
| E8.8 | `prefers-reduced-motion` active | Phase pulse static; illustration morph instant; accordion toggle instant; slider snap instant |
| E8.9 | Session ends while sidebar visible | Navigation returns to dashboard (Story 2 reverse zoom) |
| E8.10 | Label color too light for white text | Auto-contrast: use dark text on light-colored label pills |

#### Requirements

| ID | Requirement |
|----|-------------|
| R8.1 | Sidebar MUST be 280px fixed width with independent vertical scrolling |
| R8.2 | Issue number MUST be a clickable link that opens GitHub URL via `shell.openExternal` |
| R8.3 | Issue summary MUST be toggleable (expand/collapse) and max 250 characters |
| R8.4 | Label pill text color MUST auto-contrast against the GitHub label background color |
| R8.5 | Hint level slider MUST have exactly 4 discrete positions (0-3) |
| R8.6 | Hint level labels MUST be "None", "Light", "Medium", "Heavy" |
| R8.7 | SVG illustrations MUST morph between levels using `standard` spring animation |
| R8.8 | Phase stepper MUST use vertical layout with connected status line |
| R8.9 | Phase detail MUST be frontend-filtered by hint level (no backend round-trip) |
| R8.10 | Only the active phase MUST show expanded content |
| R8.11 | Sub-step accordion (level 3) MUST allow only one expanded sub-step at a time |
| R8.12 | Phase transitions MUST animate (checkmark, line fill, pulse activation) |
| R8.13 | All sidebar data MUST come from backend via WebSocket |
| R8.14 | Sidebar MUST NOT contain AI logic (thin client principle) |
| R8.15 | `prefers-reduced-motion` MUST be respected for all sidebar animations |
| R8.16 | Maximum 5 phases per issue |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC8.1 | Issue context renders | Number (linked), title, labels, toggleable summary all display from backend data |
| SC8.2 | Hint slider controls phase detail | Moving between 4 levels visibly changes what the active phase shows |
| SC8.3 | Illustrations morph | Each of 4 levels displays distinct SVG illustration with spring transition |
| SC8.4 | Phase stepper reflects state | Complete = green checkmark, active = terracotta pulse, pending = muted outline |
| SC8.5 | Phase transition animates | Completing a phase shows checkmark → line fill → next activation sequence |
| SC8.6 | Accordion works at level 3 | Click sub-step title → expands description; click another → previous collapses |

### Story 9: Hinting System [P1] ✅

**As a** developer working on an issue in Paige,
**I want** a unified hinting system that coordinates coaching messages, editor decorations, and file tree glows based on my chosen hint level,
**So that** I receive progressively detailed guidance across the entire IDE surface — from subtle file breadcrumbs to inline coaching comments — all controlled by a single slider.

**Priority**: P1 — The crown jewel of the coaching UX; ties the entire coaching surface together.
**Dependencies**: Story 5 (Editor decorations, explain button), Story 6 (Explorer glow), Story 8 (Sidebar hint slider).

#### Rendering Responsibility Model

The backend is the source of truth for *what hints exist*. The frontend owns *all rendering decisions*.

- Backend sends all hints with level metadata (once per phase or coaching event)
- Frontend filters display based on current hint level (instant, no round-trip)
- Frontend auto-dismisses comment balloons when anchored code is modified (instant via Monaco `onDidChangeModelContent`)
- Frontend shows/hides hints when the slider moves (re-evaluates all stored hints)

This is consistent with Story 8's phase detail filtering — same data, different presentation based on user preference.

#### Hint Level → IDE Surface Mapping

| Level | Label | Explorer (Story 6) | Editor Decorations (Story 5) | Comment Balloons | Sidebar (Story 8) |
|-------|-------|---------------------|------------------------------|------------------|--------------------|
| 0 | None | No glow | No decorations | Collapsed to icon | Phase titles only |
| 1 | Light | `subtle` glow (file only) | No decorations | Collapsed to icon | Phase + summary |
| 2 | Medium | `obvious` glow (file + dirs) | Line highlights + gutter markers | Fully expanded | Phase + summary + sub-step titles |
| 3 | Heavy | `unmissable` glow (gradient) | Line highlights + gutter + hover hints | Fully expanded | Phase + summary + sub-step accordion |

**Level metadata on messages:**
- `editor:decorations` items include a `level` field (minimum hint level to display)
- `coaching:message` includes a `level` field and `source` field
- `explorer:hint_files` styles map implicitly: `subtle`=1, `obvious`=2, `unmissable`=3
- `editor:hover_hint` is implicitly level 3 — frontend registers the Monaco hover provider only when hint level is 3; deregisters below 3. Hover hint data is stored regardless.

**Exceptions — always fully displayed regardless of level:**
- Review comments (`coaching:review_result`) — user-initiated
- Explain responses (`coaching:message` with `source: 'explain'`) — user-initiated
- Editor toasts (unanchored `coaching:message`) — already lightweight, not in code view

#### Comment Balloons (Anchored Coaching Messages)

Rendered when `coaching:message` arrives with an `anchor: { path, range }`.

**Library**: `@floating-ui/react`

**Monaco integration**:
- Convert anchor range to screen coordinates via `editor.getScrolledVisiblePosition(position)`
- Create Floating UI virtual reference element at those coordinates
- Listen to Monaco's `onDidScrollChange` to reposition
- Hide balloon when anchor scrolls out of the visible editor area; show when scrolled back into view

**Positioning**:
- Preferred placement: right side of the editor area
- `flip` middleware: repositions to left side when right-side space is insufficient
- `shift` middleware: keeps balloon within editor bounds
- Arrow pointing toward the anchored code range

**Visual treatment**:

| Element | Style |
|---------|-------|
| Background | `--bg-elevated` |
| Border | 1px `--border-subtle` |
| Left border | 3px, color by message type (see below) |
| Text | `--text-primary` (14px) |
| Arrow | `--bg-elevated` fill, `--border-subtle` border |
| Max width | 320px |
| Max height | 200px (scrollable if content overflows) |
| Close button | 16px `✕` in `--text-muted`, hover: `--text-secondary` |
| Border radius | 6px |

**Left border color by message type**:

| Type | Left Border | Use Case |
|------|-------------|----------|
| `hint` | `--accent-primary` | Coaching guidance |
| `info` | `--status-info` | Neutral information |
| `success` | `--status-success` | "This looks good" |
| `warning` | `--status-warning` | "Watch out here" |

**Multiple balloons**: Multiple comment balloons can be visible simultaneously. Floating UI collision detection prevents overlap.

**Dismissal**:
- Click the close button (✕)
- Auto-dismiss when the anchored code range is modified (Monaco `onDidChangeModelContent` — if change range overlaps balloon anchor range, dismiss immediately)
- Phase transition: frontend clears all non-review coaching messages when `coaching:phase_update` arrives with a new active phase (see Lifecycle section)

#### Collapsed Icon (Levels 0-1)

When hint level is 0 or 1, coaching comment balloons (except user-initiated) render as a collapsed icon instead of the full balloon.

| Element | Style |
|---------|-------|
| Shape | 20px circle |
| Icon | Paige speech bubble glyph |
| Background | `--accent-primary` at 60% opacity |
| Animation | `gentle` spring pulse (stiffness: 120, damping: 14), looping |
| Position | At the anchor point via Floating UI (same positioning logic as full balloon) |

- Click: expands to full comment balloon (overrides level filtering for that specific message)
- Once expanded by click, stays expanded until dismissed (✕ or code modification)
- Multiple collapsed icons visible simultaneously
- Hidden when anchor scrolls out of view (same as full balloons)

#### Editor Toasts (Unanchored Coaching Messages)

Rendered when `coaching:message` arrives without an `anchor` field.

**Library**: `react-toastify` with `stacked` prop

**Configuration**:

| Setting | Value |
|---------|-------|
| Position | top-right |
| Auto-close | disabled (persist until closed) |
| Stacked | `true` |
| Close on click | `false` (must click ✕) |
| Close button | `true` |
| Draggable | `false` |
| Progress bar | disabled |

**Styling** (override react-toastify defaults to match design system):

| Element | Style |
|---------|-------|
| Background | `--bg-elevated` |
| Text | `--text-primary` (14px) |
| Left border | 3px, color by message type (same as comment balloons) |
| Close button | `--text-muted`, hover: `--text-secondary` |
| Max width | 360px |
| Border radius | 6px |
| Shadow | subtle drop shadow (`--bg-base` at 40%) |

Toasts always show full content regardless of hint level.

#### "Explain This" Response

When the user clicks the floating explain button (Story 5), `user:explain` is sent with `{ path, range, selectedText }`.

Backend responds with a `coaching:message`:
```typescript
{
  message: string;          // The explanation
  type: 'info';             // Explanations are informational
  anchor: { path, range };  // Anchored to the selected range
  level: 0;                 // N/A — always shown (source overrides)
  source: 'explain';        // User-initiated → always fully displayed
}
```

Renders as a comment balloon at the selected range, always fully expanded regardless of hint level.

#### "Review My Work" System

##### Split Button

The "Review My Work" button in the editor status bar (Story 5) is a split button, following the GitHub merge button pattern:

```
┌──────────────────────┬───┐
│  Review My Work      │ ▾ │
└──────────────────────┴───┘
```

- **Main area**: Click triggers review with the currently selected scope
- **Caret area (▾)**: Click opens dropdown to change scope (does not trigger review)
- **Separator**: 1px `--border-subtle` vertical line between main area and caret
- **Main area styling**: `--accent-primary` text, hover: `--accent-warm` background
- **Caret styling**: Same as main area; `--accent-primary` chevron

**Dropdown** (opens upward from status bar):

| Option | Description |
|--------|-------------|
| Review File | Review the currently active file |
| Since Last Review | Review all changes since your last review |
| Since Last Phase | Review all changes since the current phase started |
| Since Issue Start | Review all changes since this issue began |

- Background: `--bg-elevated`
- Border: `--border-subtle`, border-radius 6px
- Shadow: subtle drop shadow
- Checked item: `--accent-primary` checkmark icon + bold title text
- Unchecked item: `--text-primary` title, `--text-secondary` description (12px)
- Hover: `--bg-surface` background
- Default checked: "Review File"
- Selecting an option sets it as the new default (checkmark moves) but does NOT trigger the review

##### Review Payload

```typescript
// Revised client → server
'user:review' → {
  scope: 'file' | 'since_last_review' | 'since_last_phase' | 'since_issue_start';
  path?: string;  // included when scope is 'file' (active file path)
}
```

##### Review Response

```typescript
// New server → client message type
'coaching:review_result' → {
  comments: Array<{
    message: string;
    type: 'info' | 'hint' | 'success' | 'warning';
    anchor: { path: string; range: Range };
  }>;
}
```

Review comments are always fully displayed regardless of hint level.

##### Review Navigation Mode

When `coaching:review_result` arrives, the status bar transforms:

```
Normal:  │  src/auth.tsx    Ln 42, Col 18   TypeScript   [Review My Work ▾] │
Review:  │  src/auth.tsx    Ln 42, Col 18   TypeScript     [◀] 2/7 [▶] [✕] │
```

- **◀ / ▶**: Navigate to previous/next review comment. Scrolls editor to center the comment's anchor range. If the comment is in a different file, auto-switches to that tab (opens it if not already open).
- **2/7**: Current comment index / total count. Text in `--text-primary`.
- **✕**: Exit review mode. Dismisses all review comment balloons. Restores "Review My Work ▾" button.
- **Current comment emphasis**: The currently focused review comment balloon has a brighter left border (full opacity) and a subtle `--bg-surface` highlight. Non-focused review balloons show left border at 60% opacity.

##### Review Lifecycle

- New review requested while previous review active: previous review comments dismissed, replaced by new results
- Phase transition during review: review comments persist (user-initiated); new phase coaching hints layer alongside
- Tab closed containing review comments: counter adjusts; ◀/▶ skip those comments. If all remaining comments are in closed tabs, review mode exits.
- Session ends: review mode exits, all comments dismissed

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+H` | Cycle hint level (0→1→2→3→0) |
| `Cmd+Shift+[` | Decrease hint level (min 0) |
| `Cmd+Shift+]` | Increase hint level (max 3) |

All three update the sidebar slider position and trigger the same frontend re-evaluation as clicking the slider. The `hints:level_change` WebSocket message is debounced at 200ms for rapid changes; frontend rendering updates instantly per slider position.

#### Phase Transition Hint Lifecycle

When a phase completes and the next phase becomes active:

1. Backend sends `explorer:clear_hints` — frontend removes all file/directory glows
2. Backend sends `editor:clear_decorations` — frontend removes all editor decorations
3. Frontend clears all non-review coaching message balloons (triggered by `coaching:phase_update` with new active phase)
4. Backend sends new `explorer:hint_files` for the new phase
5. Backend sends new `editor:decorations` for the new phase (with level metadata)
6. Backend sends new `coaching:message`(s) for the new phase guidance

Frontend applies new hints according to the current hint level. No level change needed.

Review comments are NOT cleared by phase transitions.

#### Revised WebSocket Messages (Story 4 Revisions)

**Modified server → client:**

`coaching:message` payload changed:
```typescript
// Was: { message, type, anchor?: { path, range } }
// Now:
{ message, type, anchor?: { path, range }, level: number, source: 'coaching' | 'explain' | 'observer' }
```

`editor:decorations` payload changed:
```typescript
// Was: decorations: [{ type, range, message?, style }]
// Now:
decorations: [{ type, range, message?, style, level: number }]
```

**Modified client → server:**

`user:review` payload changed:
```typescript
// Was: {}
// Now:
{ scope: 'file' | 'since_last_review' | 'since_last_phase' | 'since_issue_start', path?: string }
```

**New server → client message:**

| Type | Payload | Description |
|------|---------|-------------|
| `coaching:review_result` | `{ comments: [{ message, type, anchor }] }` | Batch review response with positioned comments |

Server → client total: 27 → 28 message types. Client → server: 21 (unchanged).

#### Acceptance Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 9.1 | Backend sends anchored `coaching:message` at level 2, hint level is 2 | Full comment balloon appears right of anchor with arrow and type-colored left border |
| 9.2 | Same message, hint level is 1 | Collapsed 20px pulsing Paige icon at anchor |
| 9.3 | Click collapsed icon | Balloon expands to full content; stays expanded until dismissed |
| 9.4 | Edit code under a comment balloon anchor | Balloon auto-dismisses immediately |
| 9.5 | Backend sends unanchored `coaching:message` | Toast appears top-right, stacked, persists until ✕ clicked |
| 9.6 | User clicks explain button on selected code | `user:explain` sent; response renders as full comment balloon at selection regardless of level |
| 9.7 | Hint level slider moved from 1→3 | Collapsed icons expand to full balloons; new decorations appear; explorer glows intensify |
| 9.8 | Hint level slider moved from 3→0 | Balloons collapse to icons; decorations removed; explorer glows removed; sidebar shows titles only |
| 9.9 | Click "Review My Work" main button | `user:review` sent with current scope; review comments render as balloons; status bar shows ◀/▶ navigation |
| 9.10 | Click ▾ on split button | Dropdown opens upward with 4 scope options, current default checked |
| 9.11 | Navigate review with ◀/▶ | Editor scrolls to comment; focused comment highlighted; cross-file navigation switches tabs |
| 9.12 | Click ✕ in review navigation | All review balloons dismissed; status bar restores to "Review My Work ▾" |
| 9.13 | Phase transition during session | Old hints cleared, new hints appear filtered by current level |
| 9.14 | Cmd+Shift+] at level 2 | Level increases to 3; slider updates; more decorations and full phase accordion appear |
| 9.15 | Cmd+Shift+H at level 3 | Level cycles to 0; all visual hints collapse or hide |
| 9.16 | Scroll editor with visible balloons | Balloons track their anchors; off-screen anchors cause balloons to hide |
| 9.17 | Multiple comment balloons visible | All render without overlap (Floating UI collision detection) |

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| E9.1 | Comment balloon anchor scrolls out of visible area | Hide balloon; show when scrolled back into view |
| E9.2 | Multiple comment balloons would overlap | Floating UI shift/flip middleware prevents overlap |
| E9.3 | Code modification partially overlaps anchor range | Dismiss balloon (any overlap triggers dismiss) |
| E9.4 | Review comments span multiple files | ◀/▶ auto-switches tabs; opens file if not already in a tab |
| E9.5 | Review requested while previous review active | Previous review dismissed; replaced by new results |
| E9.6 | Hint level changes during active review | Review comments unaffected (always fully displayed) |
| E9.7 | Phase transition during active review | Review comments persist; new phase hints layer alongside |
| E9.8 | `prefers-reduced-motion` active | Collapsed icon pulse static; no fade transitions on show/hide |
| E9.9 | Very long coaching message in balloon | Scrollable within balloon; max-height 200px |
| E9.10 | Anchor code deleted entirely | Dismiss balloon |
| E9.11 | Tab closed containing review comments | Counter adjusts; ◀/▶ skip those comments; if all gone, exit review mode |
| E9.12 | Backend sends `coaching:message` for file not currently open | Store message; render balloon when file tab becomes active |
| E9.13 | Rapid hint level slider changes | Debounce `hints:level_change` WebSocket at 200ms; frontend rendering updates instantly per slider position |

#### Requirements

| ID | Requirement |
|----|-------------|
| R9.1 | Comment balloons MUST use `@floating-ui/react` for positioning |
| R9.2 | Balloon anchor tracking MUST use Monaco `getScrolledVisiblePosition` + Floating UI virtual elements |
| R9.3 | Balloons MUST prefer right-side placement with `flip` and `shift` middleware |
| R9.4 | Balloons MUST show an arrow pointing at the anchored code range |
| R9.5 | Balloons at levels 0-1 MUST render as collapsed 20px pulsing icon (except user-initiated) |
| R9.6 | Clicking a collapsed icon MUST expand the balloon; it stays expanded until dismissed |
| R9.7 | Balloons MUST auto-dismiss when anchored code is modified (any overlap with change range) |
| R9.8 | Editor toasts MUST use `react-toastify` with `stacked` prop |
| R9.9 | Toasts MUST be positioned top-right and persist until closed |
| R9.10 | Toasts MUST always show full content regardless of hint level |
| R9.11 | "Explain This" responses MUST render as fully expanded balloons regardless of level |
| R9.12 | "Review My Work" MUST be a split button with scope dropdown (GitHub merge button pattern) |
| R9.13 | Split button MUST default to "Review File" scope |
| R9.14 | Review response MUST use `coaching:review_result` message type with comment array |
| R9.15 | Review navigation MUST show ◀/▶ controls with current/total counter in status bar |
| R9.16 | Review ◀/▶ MUST auto-switch tabs for cross-file comments |
| R9.17 | Review comments MUST always be fully displayed regardless of hint level |
| R9.18 | Frontend MUST own all rendering decisions (filter by level, dismiss on code change, show/hide on level change) |
| R9.19 | Frontend MUST NOT round-trip to backend for hint display changes |
| R9.20 | Keyboard shortcuts Cmd+Shift+H/[/] MUST control hint level |
| R9.21 | Phase transitions MUST clear old hints (backend sends clear, frontend clears coaching balloons) then apply new |
| R9.22 | `prefers-reduced-motion` MUST be respected for collapsed icon pulse and show/hide transitions |
| R9.23 | Left border color MUST differentiate by message type (hint/info/success/warning → design system status tokens) |
| R9.24 | `hints:level_change` MUST be debounced at 200ms; frontend rendering MUST update instantly |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC9.1 | Comment balloons render at anchor | Balloon appears right of anchored code with arrow pointing at range |
| SC9.2 | Progressive disclosure works | Level 0-1 shows collapsed icon; level 2+ shows full balloon; change is instant |
| SC9.3 | Auto-dismiss on code change | Edit code under balloon → balloon disappears immediately (no lag) |
| SC9.4 | Explain flow works | Select text → explain button → click → balloon at selection with explanation |
| SC9.5 | Review flow works | Click review → comments appear → ◀/▶ navigates → ✕ exits |
| SC9.6 | Split button works | Main click reviews; caret opens dropdown; option changes default |
| SC9.7 | Cross-file review | Broad scope review → comments in multiple files → ◀/▶ switches tabs |
| SC9.8 | Toasts work | Unanchored message → toast top-right; stacks; persists until closed |
| SC9.9 | Keyboard shortcuts work | Cmd+Shift+H cycles; [/] increment/decrement; slider reflects change |
| SC9.10 | Phase transition clean | Old hints clear, new hints appear at current level |

### Story 10: Placeholder / Coming Soon Page [P2] ✅

**As a** developer clicking on Practice Challenges or Learning Materials on the dashboard,
**I want** a friendly placeholder page that tells me these features are coming soon,
**So that** I know the feature exists in Paige's vision but isn't available yet — without feeling like I hit a dead end.

**Priority**: P2 — Polish; prevents dead-end UX for unbuilt features.
**Dependencies**: Story 1 (Visual Identity), Story 2 (App Shell).

#### Page Layout

Centered content, vertically and horizontally, within the app shell. Background: `--bg-base`. The 48px header (Story 2) remains visible.

```
┌──────────────────────────────────────────┐
│  [Paige logo]           PAIGE            │  ← persistent header
├──────────────────────────────────────────┤
│                                          │
│                                          │
│        ╔═══════════════════════╗         │
│        ║   COMING SOON        ║         │  ← figlet ASCII, terracotta
│        ╚═══════════════════════╝         │
│                                          │
│        [SVG illustration]                │  ← Paige character building
│                                          │
│        "I'm still learning this          │
│         one myself... check back         │
│         soon!"                           │  ← playful message
│                                          │
│        ← Back to Dashboard               │  ← text link
│                                          │
│                                          │
│              · · · · · · ·               │  ← dot matrix bg
└──────────────────────────────────────────┘
```

#### Visual Elements

**Figlet header**: "COMING SOON" rendered in figlet ASCII art, `--accent-primary` (terracotta). Same treatment as dashboard section headers (Story 3).

**SVG illustration**: Paige character mid-construction — e.g., hard hat, hammering together a window frame. ~160px tall. Scanline overlay (Story 1 aesthetic).

**Message text**: `--text-secondary`, Body size (14px), max-width 320px, center-aligned. The message is static (hardcoded in the frontend — no backend data needed).

**Back link**: "← Back to Dashboard" in `--accent-primary`, hover: `--accent-warm`. Click navigates back to dashboard view. Arrow is a literal `←` character, not an icon.

**Dot matrix background**: Full-page dot matrix texture from Story 1, consistent with dashboard and editor empty states.

#### Navigation

- **Entry**: Click on a practice challenge card or learning material item from the dashboard
- **Transition in**: Simple opacity fade (300ms ease-in-out). No zoom transition.
- **Transition out**: Same opacity fade back to dashboard
- **Back link**: Returns to dashboard. Dashboard state is preserved (scroll position, loaded data).
- **Header back behavior**: If the header has any navigation affordance (Story 2), it should also return to dashboard from this view.

#### Acceptance Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 10.1 | Click practice challenge on dashboard | Fade to placeholder page with "COMING SOON" header and playful message |
| 10.2 | Click learning material on dashboard | Same placeholder page (identical content) |
| 10.3 | Click "← Back to Dashboard" | Fade back to dashboard; scroll position and data preserved |
| 10.4 | View page styling | Figlet header in terracotta, dot matrix background, warm palette throughout |
| 10.5 | SVG illustration not ready at build time | Fallback: large construction emoji (🚧) at 64px in place of illustration |

#### Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| E10.1 | Direct deep-link to placeholder route | Render normally; back link goes to dashboard |
| E10.2 | SVG illustration not ready | Fallback to 🚧 emoji at 64px |
| E10.3 | `prefers-reduced-motion` active | Fade transition instant (0ms) |

#### Requirements

| ID | Requirement |
|----|-------------|
| R10.1 | Placeholder MUST be a single page for both practice challenges and learning materials |
| R10.2 | Page MUST use figlet-rendered "COMING SOON" header in `--accent-primary` |
| R10.3 | Page MUST display a playful, in-character Paige message |
| R10.4 | Page MUST include a "← Back to Dashboard" link |
| R10.5 | Navigation MUST use a simple opacity fade (300ms), NOT the zoom transition |
| R10.6 | Page MUST NOT require any backend data or WebSocket messages |
| R10.7 | Dashboard state MUST be preserved when returning from placeholder |
| R10.8 | Dot matrix background MUST be consistent with Story 1 design system |
| R10.9 | `prefers-reduced-motion` MUST be respected (instant transition) |

#### Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC10.1 | No dead ends | Practice and learning clicks reach a real page, not a broken route |
| SC10.2 | Matches design system | Figlet header, warm palette, dot matrix, scanline on illustration |
| SC10.3 | Round-trip works | Dashboard → placeholder → back preserves dashboard state |
| SC10.4 | Playful tone | Message reads as Paige's voice, not generic boilerplate |

---

## Edge Cases

| ID | Scenario | Handling | Stories Affected |
|----|----------|----------|------------------|
| E1.1 | JetBrains Mono fails to load | Fallback to system monospace | 1 |
| E1.2 | System forced high contrast | Respect OS accessibility settings | 1 |
| E1.3 | `prefers-reduced-motion` active | Disable spring animations, use instant transitions | 1 |
| E2.1 | Window very narrow (<800px) | Auto-collapse sidebars | 2 |
| E2.2 | Window very short (<500px) | Hide terminal panel | 2 |
| E2.3 | Rapid navigation clicks | Debounce during transitions | 2 |
| E2.4 | Non-macOS platform | Standard frame, custom header inside | 2 |
| E3.1 | Backend not connected / no data | Skeleton loading blocks | 3 |
| E3.2 | No GitHub issues available | Message in issues section | 3 |
| E3.3 | Radar chart with 1-2 axes | Degrade to bar chart | 3 |
| E3.4 | New user, all stats zero | Show zeros with onboarding message | 3 |
| E3.5 | Very long issue titles | Truncate with ellipsis at 2 lines | 3 |
| E3.6 | Many issues (20+) | Virtual scrolling or pagination | 3 |
| E4.1 | Backend not running | Retry with backoff, show connecting message | 4 |
| E4.2 | Unknown message type | Log warning, ignore | 4 |
| E4.3 | Invalid message payload | Log error, ignore | 4 |
| E4.4 | WebSocket backpressure | Backend handles; client processes ASAP | 4 |
| E4.5 | Very large file (>1MB) | Pass to Monaco; it handles large files | 4 |
| E4.6 | Rapid reconnect cycles | Cap at 30s, persistent error after 5 failures | 4 |
| E5.1 | File content >1MB | Pass to Monaco; handles large files natively | 5 |
| E5.2 | Binary file opened | Show "Binary file — cannot display" message | 5 |
| E5.3 | File deleted while tab open | Tab remains with last content; subtle "File deleted" indicator | 5 |
| E5.4 | Save fails (backend error) | Dirty dot remains; error toast with message | 5 |
| E5.5 | Unknown file extension | Monaco defaults to plain text mode | 5 |
| E5.6 | Multiple files with same name | Tab shows `parent/filename`; tooltip shows full path | 5 |
| E5.7 | Decorations for unopened file | Store decorations; apply when tab becomes active | 5 |
| E5.8 | Multi-line selection for explain | Button anchored to selection end; sends full text | 5 |
| E6.1 | Very deep nesting (10+ levels) | Indentation continues; horizontal scroll if needed | 6 |
| E6.2 | Empty project (no files) | "No files in project" message | 6 |
| E6.3 | Multiple hints for same file | Latest hint set wins | 6 |
| E6.4 | Hint for file not in tree | Ignore silently (log warning) | 6 |
| E6.5 | `fs:tree_update` for non-existent path | Ignore (log warning) | 6 |
| E6.6 | Multiple hints, same directory, different intensities | Highest intensity wins | 6 |
| E6.7 | Very long filenames | Truncate with ellipsis; tooltip shows full name | 6 |
| E6.8 | Hidden files (dotfiles) | Shown in tree | 6 |
| E7.1 | Rapid successive output (>10KB/s) | xterm.js handles rendering performance natively | 7 |
| E7.2 | PTY exits (user types `exit`) | "Process exited" message; no crash | 7 |
| E7.3 | Non-UTF8 output (binary data) | xterm.js best-effort rendering; don't crash | 7 |
| E7.4 | Terminal focused while typing in editor | xterm.js only captures input when its element has focus | 7 |
| E7.5 | `prefers-reduced-motion` active | Cursor blink disabled; no animated terminal elements | 7 |
| E7.6 | Very long scrollback (10k+ lines) | xterm.js scrollback buffer capped at configurable limit (default 5000) | 7 |
| E8.1 | Issue has no labels | Labels row hidden entirely | 8 |
| E8.2 | Issue summary >250 chars | Frontend truncates at 250 with ellipsis | 8 |
| E8.3 | Very long phase title | Truncate with ellipsis; tooltip for full title | 8 |
| E8.4 | Only 1-2 phases | Stepper renders with fewer nodes; line shortened | 8 |
| E8.5 | Phase update for non-existent phase | Ignore, log warning | 8 |
| E8.6 | Hint level drops below 3 with accordion open | Accordion state resets; sub-steps hidden | 8 |
| E8.7 | SVG illustrations not ready | Fallback: level name text + emoji | 8 |
| E8.8 | `prefers-reduced-motion` active | Phase pulse static; morph/accordion/slider instant | 8 |
| E8.9 | Session ends while sidebar visible | Navigate back to dashboard | 8 |
| E8.10 | Label color too light for white text | Auto-contrast: dark text on light labels | 8 |
| E9.1 | Balloon anchor scrolls out of view | Hide; show when scrolled back | 9 |
| E9.2 | Multiple balloons would overlap | Floating UI shift/flip prevents overlap | 9 |
| E9.3 | Code modification overlaps anchor range | Dismiss balloon on any overlap | 9 |
| E9.4 | Review comments span multiple files | ◀/▶ auto-switches tabs | 9 |
| E9.5 | New review while previous active | Previous dismissed; replaced by new | 9 |
| E9.6 | Hint level changes during review | Review comments unaffected | 9 |
| E9.7 | Phase transition during review | Review persists; new hints layer alongside | 9 |
| E9.8 | `prefers-reduced-motion` active | Collapsed icon static; transitions instant | 9 |
| E9.9 | Very long coaching message | Scrollable; max-height 200px | 9 |
| E9.10 | Anchor code deleted entirely | Dismiss balloon | 9 |
| E9.11 | Tab closed with review comments | Counter adjusts; ◀/▶ skip; exit if all gone | 9 |
| E9.12 | Coaching message for unopened file | Store; render when tab becomes active | 9 |
| E9.13 | Rapid hint level slider changes | Debounce WebSocket at 200ms; render instant | 9 |
| E10.1 | Direct deep-link to placeholder route | Render normally; back link goes to dashboard | 10 |
| E10.2 | SVG illustration not ready | Fallback to 🚧 emoji at 64px | 10 |
| E10.3 | `prefers-reduced-motion` active | Fade transition instant (0ms) | 10 |

---

## Requirements

### Functional Requirements

| ID | Requirement | Stories | Confidence |
|----|-------------|---------|------------|
| R1.1 | Colour tokens as CSS custom properties in single theme file | 1 | 100% |
| R1.2 | Named spring preset constants in single animation config | 1 | 100% |
| R1.3 | Framer Motion for all spring animations | 1 | 100% |
| R1.4 | Respect `prefers-reduced-motion` media query | 1 | 100% |
| R1.5 | JetBrains Mono from Google Fonts (400, 500, 600, 700) | 1 | 100% |
| R1.6 | No raw hex literals outside theme file | 1 | 100% |
| R1.7 | ASCII treatments via CSS only | 1 | 100% |
| R2.1 | Three view states: Dashboard, IDE, and Placeholder | 2, 10 | 100% |
| R2.2 | 48px persistent header across both views | 2 | 100% |
| R2.3 | CSS Grid for IDE layout with fixed proportions | 2 | 100% |
| R2.4 | Sidebar collapse via Framer Motion `standard` spring | 2 | 100% |
| R2.5 | View transitions via Framer Motion `expressive` spring | 2 | 100% |
| R2.6 | Collapsed sidebar rail is 32px wide | 2 | 100% |
| R2.7 | Electron `hiddenInset` title bar on macOS | 2 | 100% |
| R2.8 | Navigation debounced during transitions | 2 | 100% |
| R3.1 | Dashboard golden ratio proportions (38:62 / 62:38) | 3 | 100% |
| R3.2 | All dashboard data from backend via WebSocket | 3 | 100% |
| R3.3 | In-progress row hidden when empty | 3 | 100% |
| R3.4 | Stats switcher: this week / this month / all time | 3 | 100% |
| R3.5 | Issue cards are zoom-transition origins | 3 | 100% |
| R3.6 | Practice/learning clicks go to placeholder | 3 | 100% |
| R3.7 | Figlet headers on each dashboard section | 3 | 100% |
| R3.8 | Dreyfus rendered as radar/spider chart | 3 | 100% |
| R3.9 | Dashboard is scrollable | 3 | 100% |
| R3.10 | Skeleton loading state while awaiting data | 3 | 100% |
| R4.1 | All UI↔Backend via WebSocket only | 4 | 100% |
| R4.2 | Consistent message envelope `{ type, payload, id?, timestamp }` | 4 | 100% |
| R4.3 | TypeScript string literal unions for message types | 4 | 100% |
| R4.4 | `buffer:update` debounced at 300ms | 4 | 100% |
| R4.5 | `editor:scroll` debounced at 200ms | 4 | 100% |
| R4.6 | `user:idle_start` fires after 5000ms inactivity | 4 | 100% |
| R4.7 | Exponential backoff reconnection capped at 30s | 4 | 100% |
| R4.8 | Unknown messages logged and ignored | 4 | 100% |
| R4.9 | Per-type message handler registration | 4 | 100% |
| R4.10 | Singleton WebSocket client service | 4 | 100% |
| R5.1 | Editor MUST use `@monaco-editor/react` | 5 | 100% |
| R5.2 | Custom Monaco theme MUST use design tokens from Story 1 | 5 | 100% |
| R5.3 | No raw hex values in editor theme — reference design tokens | 5 | 100% |
| R5.4 | Minimap MUST be disabled | 5 | 100% |
| R5.5 | All decorations MUST originate from backend via WebSocket | 5 | 100% |
| R5.6 | Editor MUST NOT generate its own decorations | 5 | 100% |
| R5.7 | `buffer:update` MUST be debounced at 300ms | 5 | 100% |
| R5.8 | Closing dirty tab MUST show save confirmation | 5 | 100% |
| R5.9 | Duplicate tabs MUST be prevented | 5 | 100% |
| R5.10 | Cmd+S MUST trigger `file:save` via WebSocket | 5 | 100% |
| R5.11 | Language mode MUST be set from `fs:content` language field | 5 | 100% |
| R5.12 | Editor MUST include 32px status bar with file path, cursor, language, "Review My Work" | 5 | 100% |
| R5.13 | "Review My Work" button MUST send `user:review` via WebSocket | 5 | 100% |
| R6.1 | File tree MUST use `react-arborist` with virtualized rendering | 6 | 100% |
| R6.2 | File icons MUST use `vscode-icons` | 6 | 100% |
| R6.3 | All tree data MUST come from backend via WebSocket | 6 | 100% |
| R6.4 | Tree MUST NOT access the filesystem directly | 6 | 100% |
| R6.5 | Hint glow MUST use Framer Motion with `gentle` spring baseline | 6 | 100% |
| R6.6 | `unmissable` gradient MUST interpolate parent (brightest) to baseline | 6 | 100% |
| R6.7 | Frontend MUST NOT hardcode generic directory names | 6 | 100% |
| R6.8 | Single click file MUST open in editor | 6 | 100% |
| R6.9 | `explorer:hint_files` MUST support per-file style + optional directory list | 6 | 100% |
| R6.10 | Auto-expand MUST match hint style | 6 | 100% |
| R7.1 | Terminal MUST use xterm.js for rendering | 7 | 100% |
| R7.2 | All 16 ANSI colors MUST be remapped to warm palette variants via xterm.js `ITheme` | 7 | 100% |
| R7.3 | PTY dimensions MUST be managed via xterm.js `FitAddon` with `ResizeObserver` | 7 | 100% |
| R7.4 | Observer nudges MUST be written to PTY stdin by main process (no UI treatment) | 7 | 100% |
| R7.5 | Control characters (Ctrl+C, Ctrl+D, Ctrl+Z) MUST be forwarded to PTY via xterm.js `onData` | 7 | 100% |
| R7.6 | Terminal MUST only capture keyboard input when focused | 7 | 100% |
| R7.7 | xterm.js `WebLinksAddon` MUST be enabled for clickable URLs | 7 | 100% |
| R8.1 | Sidebar MUST be 280px fixed width with independent scrolling | 8 | 100% |
| R8.2 | Issue number MUST be clickable link opening GitHub URL via `shell.openExternal` | 8 | 100% |
| R8.3 | Issue summary MUST be toggleable and max 250 characters | 8 | 100% |
| R8.4 | Label pill text MUST auto-contrast against GitHub label color | 8 | 100% |
| R8.5 | Hint level slider MUST have exactly 4 discrete positions (0-3) | 8 | 100% |
| R8.6 | Hint level labels MUST be "None", "Light", "Medium", "Heavy" | 8 | 100% |
| R8.7 | SVG illustrations MUST morph between levels with `standard` spring | 8 | 100% |
| R8.8 | Phase stepper MUST use vertical layout with connected status line | 8 | 100% |
| R8.9 | Phase detail MUST be frontend-filtered by hint level (no round-trip) | 8 | 100% |
| R8.10 | Only active phase MUST show expanded content | 8 | 100% |
| R8.11 | Sub-step accordion (level 3) MUST allow only one expanded at a time | 8 | 100% |
| R8.12 | Phase transitions MUST animate (checkmark, line fill, pulse) | 8 | 100% |
| R8.13 | All sidebar data MUST come from backend via WebSocket | 8 | 100% |
| R8.14 | Sidebar MUST NOT contain AI logic | 8 | 100% |
| R8.15 | `prefers-reduced-motion` MUST be respected for all sidebar animations | 8 | 100% |
| R8.16 | Maximum 5 phases per issue | 8 | 100% |
| R9.1 | Comment balloons MUST use `@floating-ui/react` | 9 | 100% |
| R9.2 | Balloon anchor tracking MUST use Monaco `getScrolledVisiblePosition` + Floating UI virtual elements | 9 | 100% |
| R9.3 | Balloons MUST prefer right-side placement with flip/shift middleware | 9 | 100% |
| R9.4 | Balloons MUST show arrow pointing at anchored code range | 9 | 100% |
| R9.5 | Balloons at levels 0-1 MUST render as collapsed 20px pulsing icon (except user-initiated) | 9 | 100% |
| R9.6 | Clicking collapsed icon MUST expand balloon; stays expanded until dismissed | 9 | 100% |
| R9.7 | Balloons MUST auto-dismiss when anchored code is modified | 9 | 100% |
| R9.8 | Editor toasts MUST use `react-toastify` with `stacked` prop | 9 | 100% |
| R9.9 | Toasts MUST be positioned top-right and persist until closed | 9 | 100% |
| R9.10 | Toasts MUST always show full content regardless of hint level | 9 | 100% |
| R9.11 | "Explain This" responses MUST render as fully expanded balloons regardless of level | 9 | 100% |
| R9.12 | "Review My Work" MUST be split button with scope dropdown | 9 | 100% |
| R9.13 | Split button MUST default to "Review File" scope | 9 | 100% |
| R9.14 | Review response MUST use `coaching:review_result` message type | 9 | 100% |
| R9.15 | Review navigation MUST show ◀/▶ with current/total counter in status bar | 9 | 100% |
| R9.16 | Review ◀/▶ MUST auto-switch tabs for cross-file comments | 9 | 100% |
| R9.17 | Review comments MUST always be fully displayed regardless of hint level | 9 | 100% |
| R9.18 | Frontend MUST own all rendering decisions (filter by level, dismiss on code change) | 9 | 100% |
| R9.19 | Frontend MUST NOT round-trip to backend for hint display changes | 9 | 100% |
| R9.20 | Keyboard shortcuts Cmd+Shift+H/[/] MUST control hint level | 9 | 100% |
| R9.21 | Phase transitions MUST clear old hints then apply new | 9 | 100% |
| R9.22 | `prefers-reduced-motion` MUST be respected for collapsed icon pulse | 9 | 100% |
| R9.23 | Left border color MUST differentiate by message type via design system tokens | 9 | 100% |
| R9.24 | `hints:level_change` MUST be debounced at 200ms; frontend rendering MUST be instant | 9 | 100% |
| R10.1 | Placeholder MUST be a single page for both practice challenges and learning materials | 10 | 100% |
| R10.2 | Page MUST use figlet-rendered "COMING SOON" header in `--accent-primary` | 10 | 100% |
| R10.3 | Page MUST display a playful, in-character Paige message | 10 | 100% |
| R10.4 | Page MUST include a "← Back to Dashboard" link | 10 | 100% |
| R10.5 | Navigation MUST use simple opacity fade (300ms), NOT zoom transition | 10 | 100% |
| R10.6 | Page MUST NOT require any backend data or WebSocket messages | 10 | 100% |
| R10.7 | Dashboard state MUST be preserved when returning from placeholder | 10 | 100% |
| R10.8 | Dot matrix background MUST be consistent with Story 1 design system | 10 | 100% |
| R10.9 | `prefers-reduced-motion` MUST be respected (instant transition) | 10 | 100% |

### Key Entities

[To be documented as further stories graduate]

---

## Success Criteria

| ID | Criterion | Measurement | Stories |
|----|-----------|-------------|---------|
| SC1.1 | Centralised design tokens | 0 raw hex values outside theme | 1 |
| SC1.2 | Consistent animation system | All animations use named presets | 1 |
| SC1.3 | Reduced motion accessibility | Animations disabled on OS preference | 1 |
| SC1.4 | Visual cohesion | Matches design preview HTML | 1 |
| SC2.1 | Layout proportions match spec | Panels measure 220/flex/280 at 1440px | 2 |
| SC2.2 | Smooth transitions | Zoom in/out at 60fps without jank | 2 |
| SC2.3 | Sidebar collapse correct | 32px collapsed, original expanded | 2 |
| SC2.4 | Cross-platform window | Renders correctly on macOS with hiddenInset | 2 |
| SC3.1 | All sections render | 6 sections show backend data | 3 |
| SC3.2 | Golden ratio layout | Columns at 38:62 and 62:38 | 3 |
| SC3.3 | Zoom transition works | Issue card click → smooth zoom to IDE | 3 |
| SC3.4 | Stats period switching | Three periods load different data | 3 |
| SC3.5 | Empty state handling | Hidden when empty, skeleton when loading | 3 |
| SC4.1 | Type safety | All 48 message types have TS interfaces, no `any` | 4 |
| SC4.2 | Reconnection works | Disconnect → reconnect → state restored | 4 |
| SC4.3 | Debouncing correct | buffer:update max once per 300ms | 4 |
| SC4.4 | No data loss | file:save → ack round-trip completes | 4 |
| SC5.1 | Theme matches design system | Background #141413, terracotta cursor, warm syntax tokens | 5 |
| SC5.2 | Decorations render correctly | All 4 types display per style matrix | 5 |
| SC5.3 | Tab system works | Open, switch, close, dirty indicator all function | 5 |
| SC5.4 | File round-trip works | Open → edit → save → ack; dirty state tracks | 5 |
| SC5.5 | Explain button works | Select → button → click → correct `user:explain` payload | 5 |
| SC6.1 | Tree renders correctly | Full tree with correct icons, nesting, expand/collapse | 6 |
| SC6.2 | Three hint styles distinct | subtle = file only; obvious = file + dirs; unmissable = gradient | 6 |
| SC6.3 | Gradient animation visible | Parent dir visibly brighter/faster than distant ancestors | 6 |
| SC6.4 | Auto-expand matches style | subtle stays collapsed; unmissable reveals file | 6 |
| SC6.5 | Performance with large trees | 500+ files render without jank | 6 |
| SC7.1 | ANSI rendering fidelity | Colored output renders correctly with warm-mapped colors in xterm.js | 7 |
| SC7.2 | TUI rendering | Claude Code welcome screen, status bars, powerline render correctly | 7 |
| SC7.3 | Input responsiveness | Typing feels immediate (<50ms PTY echo latency) | 7 |
| SC7.4 | Large output performance | 1000+ lines scroll without jank | 7 |
| SC8.1 | Issue context renders | Number (linked), title, labels, toggleable summary display from backend | 8 |
| SC8.2 | Hint slider controls detail | 4 levels visibly change active phase content | 8 |
| SC8.3 | Illustrations morph | 4 distinct SVG scenes with spring transitions | 8 |
| SC8.4 | Phase stepper reflects state | Complete=green check, active=terracotta pulse, pending=muted | 8 |
| SC8.5 | Phase transition animates | Checkmark → line fill → next activation sequence | 8 |
| SC8.6 | Accordion at level 3 | Click sub-step → expand; click another → collapse previous | 8 |
| SC9.1 | Comment balloons render at anchor | Balloon right of code with arrow pointing at range | 9 |
| SC9.2 | Progressive disclosure works | Level 0-1 shows icon; level 2+ shows full balloon; instant | 9 |
| SC9.3 | Auto-dismiss on code change | Edit under balloon → disappears immediately | 9 |
| SC9.4 | Explain flow works | Select → explain → balloon at selection with explanation | 9 |
| SC9.5 | Review flow works | Review → comments → ◀/▶ navigates → ✕ exits | 9 |
| SC9.6 | Split button works | Main click reviews; caret opens dropdown; option changes default | 9 |
| SC9.7 | Cross-file review | Broad scope → multi-file comments → ◀/▶ switches tabs | 9 |
| SC9.8 | Toasts work | Unanchored → toast top-right; stacks; persists until closed | 9 |
| SC9.9 | Keyboard shortcuts work | Cmd+Shift+H cycles; [/] increment/decrement; slider syncs | 9 |
| SC9.10 | Phase transition clean | Old hints clear, new hints appear at current level | 9 |
| SC10.1 | No dead ends | Practice and learning clicks reach a real page, not a broken route | 10 |
| SC10.2 | Matches design system | Figlet header, warm palette, dot matrix, scanline on illustration | 10 |
| SC10.3 | Round-trip works | Dashboard → placeholder → back preserves dashboard state | 10 |
| SC10.4 | Playful tone | Message reads as Paige's voice, not generic boilerplate | 10 |

---

## Appendix: Story Revision History

*Major revisions to graduated stories. Full details in `archive/REVISIONS.md`*

| Date | Story | Change | Reason |
|------|-------|--------|--------|
| 2026-02-10 | 4 | `explorer:hint_files` payload changed from `{ paths, style }` to `{ hints: [{ path, style, directories? }] }` | Story 6 requires per-file hint styles and backend-controlled directory glow lists |
| 2026-02-11 | 4 | `coaching:issue_context` payload changed from `{ title, summary, labels }` to `{ number, title, summary, labels: [{ name, color }], url }` | Story 8 needs issue number link, label colors for pills |
| 2026-02-11 | 4 | `coaching:message` payload changed from `{ message, type }` to `{ message, type, anchor?: { path, range } }` | Story 8 discovery: coaching messages render as anchored comment balloons (when anchor present) or editor toasts (when absent), not in sidebar |
| 2026-02-11 | 4 | `session:started` payload clarified: `phases` is `Phase[]`, `issueContext` is `IssueContext` (see Story 8 for interfaces) | Story 8 requires formal data structures for phase stepper and issue context |
| 2026-02-11 | 2, 5 | Added 32px editor status bar (VS Code-style) to IDE layout between editor and terminal | Story 8 discovery: "Review My Work" button needs a home; status bar also shows file path, cursor position, language |
| 2026-02-11 | 4 | `coaching:message` payload changed from `{ message, type, anchor? }` to `{ message, type, anchor?, level, source }` | Story 9: frontend needs level metadata to filter display, source to identify user-initiated messages |
| 2026-02-11 | 4 | `editor:decorations` items changed from `{ type, range, message?, style }` to `{ type, range, message?, style, level }` | Story 9: frontend needs level metadata to filter decorations by hint level |
| 2026-02-11 | 4 | `user:review` payload changed from `{}` to `{ scope, path? }` | Story 9: review split button supports 4 scopes (file, since last review, since last phase, since issue start) |
| 2026-02-11 | 4 | New message type `coaching:review_result` (server → client, 28 total now) | Story 9: batch review response with positioned comment array for navigation |
| 2026-02-11 | 5 | "Review My Work" text button → split button with scope dropdown (GitHub merge button pattern) | Story 9: user needs to choose review scope; split button keeps default action fast with options accessible |
| 2026-02-11 | 5 | Status bar gains review navigation mode: `[◀] 2/7 [▶] [✕]` replaces split button during active review | Story 9: review comments need next/previous navigation with cross-file tab switching |
| 2026-02-11 | 2 | R2.1 changed from "Exactly two view states" to "Three view states: Dashboard, IDE, and Placeholder" | Story 10: placeholder page is a lightweight third view state with fade transition |
