# Decision Log: electron-ui

*Chronological record of all decisions made during discovery.*

---

[Decision entries will be added as decisions are made]

## D1: Full Monaco decoration suite for MVP — 2026-02-10

**Context**: Choosing which Monaco editor decorations to implement for MVP demo

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Implement all four types: line highlighting, gutter markers, hover popovers with hint text, and squiggly underlines for errors. High complexity but critical for demo impact — the decorations ARE the visible coaching.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Code Editor, Hinting System

**Related Questions**: [Questions not specified]

---

## D2: Anthropic-adjacent ambient aesthetic — 2026-02-10

**Context**: Deciding where to apply the distinctive Claude/Paige visual identity

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Warm palette and spring animations applied everywhere as ambient personality (warm darks, terracotta accents, subtle grain). Extra expressiveness concentrated on coaching panels (issue card, phase progression, hint toggle). Editor and terminal stay professional but within the warm palette. Faux-ASCII touches in the coaching chrome, not in content areas.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Visual Identity, Coaching Panels, App Shell

**Related Questions**: [Questions not specified]

---

## D3: Hint toggle in coaching sidebar with keyboard shortcuts — 2026-02-10

**Context**: Choosing the UI form for the hint level toggle (off/file/line/detail)

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Primary control lives in the coaching sidebar near phase progression. All major controls including hint toggle have keyboard shortcuts. No visible toolbar button — keeps the editor chrome clean.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Hinting System, Coaching Panels

**Related Questions**: [Questions not specified]

---

## D4: Observer promoted to MVP scope — 2026-02-10

**Context**: Observer was originally a stretch goal. User has promoted it to required for MVP.

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: The Observer system (two-tier model evaluation, PTY filter layer, thinking block rendering) is now in MVP scope. The terminal pipeline (pty.onData → filterLayer → xterm.write) must be implemented. Nudges render as collapsible thinking blocks.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Terminal, Observer

**Related Questions**: [Questions not specified]

---

## D5: Fixed panel layout — 2026-02-10

**Context**: Choosing between resizable, partially resizable, or fixed panel proportions

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Fixed layout with set proportions. Sidebars can collapse/expand but panels do not have drag-resize handles. Simplest to implement, avoids complexity of split-pane libraries.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: App Shell

**Related Questions**: [Questions not specified]

---

## D6: Animated breathing glow for file hints — 2026-02-10

**Context**: Choosing visual treatment for file tree hinting (breakable wall effect)

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Files hinted by Paige get a gentle pulsing/breathing glow effect using the spring animation system. More eye-catching than static highlights. Uses terracotta/warm accent colour from the Anthropic-adjacent palette.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: File Explorer, Hinting System, Visual Identity

**Related Questions**: [Questions not specified]

---

## D7: Full dashboard as home screen with all sections required — 2026-02-10

**Context**: Deciding scope of the dashboard landing experience

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Dashboard is a full-screen view with 6 sections: Dreyfus stage assessment, session stats/metrics, resume in-progress tasks, GitHub issues list, practice challenges, and learning materials. All are MVP-required. Full-screen swap animation transitions to/from the IDE view when an issue or challenge is selected.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Dashboard, App Shell

**Related Questions**: [Questions not specified]

---

## D8: Dreyfus radar chart on dashboard — 2026-02-10

**Context**: Choosing visual representation for the Dreyfus skill assessment on dashboard

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Skill radar/spider chart showing competence across different skill areas (React, Testing, Git, State Management, etc). Visually rich, strong demo highlight. Data comes from backend.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Dashboard

**Related Questions**: [Questions not specified]

---

## D9: Skeleton blocks with coming soon overlay for unbuilt features — 2026-02-10

**Context**: Choosing placeholder UX for practice challenges and learning materials when clicked

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Clicking practice challenges or learning materials on the dashboard shows skeleton loading blocks (like component loading states) with a polished 'coming soon' overlay on top. Matches the aesthetic, looks intentional and professional rather than broken.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Dashboard

**Related Questions**: [Questions not specified]

---

## D10: Monospace display typography with full ASCII treatment — 2026-02-10

**Context**: Choosing font direction and faux-ASCII techniques for Paige visual identity

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Display type: characterful monospace (JetBrains Mono, IBM Plex Mono, or Space Mono family). Body/UI: same family at lighter weights. ASCII treatments: figlet for dashboard headers and splash, scanline overlay on coaching panels, dot matrix accents on backgrounds/borders. Full aesthetic commitment.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Visual Identity

**Related Questions**: [Questions not specified]

---

## D11: IDE panel proportions: 220/flex/280, 30% terminal — 2026-02-10

**Context**: Setting fixed layout proportions for the IDE view

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Left sidebar: 220px fixed. Right sidebar: 280px fixed. Editor/terminal column takes remaining width. Terminal: 30% of total height. Editor: 70%. No drag resize.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: App Shell

**Related Questions**: [Questions not specified]

---

## D12: Sidebar collapse: icon toggle + spring slide + thin rail — 2026-02-10

**Context**: Choosing collapse behavior for left and right sidebars

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Small toggle icon at top of each sidebar. Spring animation slide (standard preset) to collapse. Collapsed state shows a thin vertical rail with the toggle icon to reopen.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: App Shell

**Related Questions**: [Questions not specified]

---

## D13: Dashboard-to-IDE zoom transition — 2026-02-10

**Context**: Choosing animation for full-screen view swap between dashboard and IDE

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Clicking an issue on the dashboard triggers a zoom transition where the issue card expands to fill the screen, morphing into the IDE layout. Uses expressive spring preset. Most dramatic option — connects the user's click to the resulting workspace.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: App Shell, Dashboard

**Related Questions**: [Questions not specified]

---

## D14: 48px header bar with logo + back navigation — 2026-02-10

**Context**: Adding a persistent header to the layout with navigation

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: 48px header bar across both views. Contains Paige logo/wordmark on left. In IDE view, a back/home button appears to return to dashboard. Minimal — no extra controls in the header. Hint toggle lives in the coaching sidebar, not the header.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: App Shell

**Related Questions**: [Questions not specified]

---

## D15: Electron titleBarStyle hiddenInset on macOS — 2026-02-10

**Context**: Choosing Electron window chrome approach

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Use Electron's titleBarStyle: 'hiddenInset' on macOS for a native-feeling but integrated look. Traffic lights overlay the content. The 48px header accounts for this inset.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: App Shell

**Related Questions**: [Questions not specified]

---

## D16: Dashboard layout: two-column grid from wireframe — 2026-02-10

**Context**: Choosing dashboard section arrangement based on user wireframe

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Two-column grid: Row 1: Dreyfus radar (50%) + Stats bento (50%). Row 2: In-Progress Tasks (60%) + Practice Challenges (40%). Rows 3-4: GitHub Issues tall/scrollable (60%) + Learning Materials (40%). In-progress row hides entirely when empty. Page scrolls naturally.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Dashboard

**Related Questions**: [Questions not specified]

---

## D17: Stats bento with time period switcher — 2026-02-10

**Context**: Defining stats section content and interactivity

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Mini bento grid of stat cards showing: issues completed, time spent, hints used, streak, phases completed, practice challenges completed. No Dreyfus (separate section). Top-right corner has a time period switcher: this week | this month | all time. Stats come from backend via WebSocket.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: Dashboard

**Related Questions**: [Questions not specified]

---

## D18: WebSocket protocol: 27 server + 21 client message types — 2026-02-10

**Context**: Defining full WebSocket message surface between backend and Electron UI

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: 27 server-to-client and 21 client-to-server message types organized by domain (connection, dashboard, filesystem, editor, explorer, session, coaching, observer, buffer, hints, terminal, user action). Messages separated per dashboard section for incremental loading. Observer-related messages (selection, scroll, idle) included for triage model input.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: WebSocket Client

**Related Questions**: [Questions not specified]

---

## D19: Auto-reconnect with exponential backoff — 2026-02-10

**Context**: Choosing WebSocket reconnection strategy

**Question**: [Question not provided]

**Options Considered**:
[Options not provided]

**Decision**: Exponential backoff reconnection (1s, 2s, 4s, 8s, max 30s). Subtle reconnecting indicator in the UI. State restoration on successful reconnect (re-request active session data). Backend must handle reconnect handshake to restore context.

**Rationale**: [Rationale not provided]

**Implications**:
[Implications not provided]

**Stories Affected**: WebSocket Client

**Related Questions**: [Questions not specified]

---
