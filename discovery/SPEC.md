# Feature Specification: electron-ui

**Feature Branch**: `feature/electron-ui`
**Created**: 2026-02-10
**Last Updated**: 2026-02-10
**Status**: In Progress
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

**Two Views**
1. **Dashboard** — Full-screen home view (Story 3 details content)
2. **IDE** — Five-panel workspace layout

**Header Bar** (shared across both views)
- Height: 48px fixed
- Contents: Paige logo/wordmark (left), back/home button (visible in IDE view only)
- Background: `--bg-surface`
- Border bottom: `--border-subtle`

**Electron Window**
- `titleBarStyle: 'hiddenInset'` on macOS
- Header accounts for traffic light inset (~70px left padding on macOS)

**IDE Panel Layout** (fixed proportions, no drag resize)

```
┌─────────────────────────────────────────────────────────┐
│  Header: 48px — Logo + Back                             │
├────────┬──────────────────────────┬─────────────────────┤
│  File  │  Code Editor (tabs)      │  Current Issue      │
│  Explr │                          ├─────────────────────┤
│        │                          │  Plan Phases        │
│ 220px  │       flex (remaining)   │  + Hint Toggle      │
│        │                          │       280px         │
├────────┴──────────────────────────┴─────────────────────┤
│  Claude Code Terminal                         30% height│
└─────────────────────────────────────────────────────────┘
```

- Left sidebar: 220px fixed width
- Right sidebar: 280px fixed width
- Editor + terminal column: remaining width (flex)
- Editor: 70% of column height
- Terminal: 30% of column height
- Terminal spans full width below all three columns

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
| R2.1 | App MUST have exactly two view states: Dashboard and IDE |
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
```

#### Server → Client Messages (27 types)

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
| `dashboard:issues` | `{ issues: [{ number, title, description, labels, age }] }` | GitHub issues list |
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
| `explorer:hint_files` | `{ paths: string[], style }` | File tree glow triggers |
| `explorer:clear_hints` | `{}` | Remove all file glows |

**Session**

| Type | Payload | Description |
|------|---------|-------------|
| `session:started` | `{ issueContext, phases, hintLevel, openFiles? }` | Session initialised |
| `session:resumed` | `{ restoredState }` | Session restored from previous |
| `session:ended` | `{ summary }` | Session wrap-up data |

**Coaching**

| Type | Payload | Description |
|------|---------|-------------|
| `coaching:phase_update` | `{ phase, status, description }` | Phase state change |
| `coaching:message` | `{ message, type }` | Paige coaching message |
| `coaching:issue_context` | `{ title, summary, labels }` | Current issue details |

**Observer**

| Type | Payload | Description |
|------|---------|-------------|
| `observer:nudge` | `{ signal, confidence, context }` | Nudge for PTY injection |
| `observer:status` | `{ state }` | Observer state change |

#### Client → Server Messages (21 types)

**Connection**

| Type | Payload | Description |
|------|---------|-------------|
| `connection:hello` | `{ version, platform, windowSize }` | Initial handshake |

**Dashboard**

| Type | Payload | Description |
|------|---------|-------------|
| `dashboard:request` | `{}` | Request all dashboard data |
| `dashboard:stats_period` | `{ period }` | Switch stats time period |

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
| R2.1 | Exactly two view states: Dashboard and IDE | 2 | 100% |
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

---

## Appendix: Story Revision History

*Major revisions to graduated stories. Full details in `archive/REVISIONS.md`*

| Date | Story | Change | Reason |
|------|-------|--------|--------|
| *No revisions yet* | - | - | - |
