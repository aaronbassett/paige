# Feature Specification: Electron UI

**Feature Branch**: `001-electron-ui`
**Created**: 2026-02-11
**Status**: Draft
**Source**: Converted from `docs/planning/frontend-discovery/SPEC.md` (10 stories, all details preserved)

**Codebase Documentation**: See [.sdd/codebase/](.sdd/codebase/) for technical details

---

## Feature Description

Paige's backend handles the coaching pipeline, memory, and state management, but the Electron UI is the entire demo surface — the only thing hackathon judges see. This feature implements a familiar, polished IDE experience that makes the coaching system visible and compelling, while maintaining strict thin-client architecture (no AI logic, no direct filesystem access, no state ownership).

**Target Users**:
- Demo Viewer / Judge: Hackathon judges evaluating via 3-min video
- Junior Developer: End user working through issues with coaching
- Solo Builder: Aaron, implementing in one week with existing libraries

**Design Philosophy**: Warm, distinctive Anthropic-adjacent visual identity with terracotta (#d97757) as primary accent, JetBrains Mono typography, spring animations (Framer Motion), and ASCII aesthetic treatments (figlet headers, scanlines, dot matrix).

See original spec at `docs/planning/frontend-discovery/SPEC.md` for complete design tokens, animation presets, color palettes, typography scales, and detailed component specifications. All 10 stories documented there with full acceptance scenarios, edge cases, requirements matrices, and success criteria.

---

## Clarifications

### Session 2026-02-11

- Q: Should `coaching:message` WebSocket payload include a unique `messageId` field to enable stable reference to specific comments during navigation and dismissal? → A: Add `messageId` UUID v4 field to `coaching:message` payload. Backend generates stable IDs at message creation time and persists messageId → message content mapping in session state to ensure stable reference across reconnects and tab switches. Frontend uses messageId solely as opaque identifier for navigation; no generation or transformation of messageId by frontend.
- Q: If WebSocket disconnects during file save, should the editor retry automatically, show warning, or ask user to save again? → A: Show "Save interrupted, disconnected. Attempting to reconnect..." toast and as long as app stays open retry once connection is re-established
- Q: Should editor decorations be line-number based (sticky), absolute range (strict), or hybrid when user edits decorated code? → A: Absolute range (strict) - decorations dismiss if any edit overlaps the range (matches balloon behavior)
- Q: After exponential backoff caps at 30s and 5 failures occur, should reconnection stop, continue indefinitely, or prompt user? → A: Keep retrying at 30s intervals indefinitely (show attempt count in UI)
- Q: Should keyboard navigation include full tab order and focus management, or only essential shortcuts? → A: Essential shortcuts only (save/close/hint-cycling/review, basic file tree navigation)
- Q: Do coaching messages have a level field, and how does message rendering interact with user hint level? → A: Coaching messages don't have a level field. Rendering based on user level: 0-1 = collapsed icon only, 2-3 = full balloon. Exception: user-initiated (explain/review) always show full.
- Q: How should "absolute range overlap" be calculated for decoration/balloon dismissal when user edits code? → A: Standard interval overlap (line-based): Edit is dismissed if `edit.startLine <= range.endLine AND edit.endLine >= range.startLine`. For edits on boundary lines, column bounds are checked: if edit overlaps column range on a boundary line, dismiss. Test cases: (1) Decoration lines 5-7 cols 0-20, edit line 5 cols 10-15 → dismiss, (2) Decoration lines 5-7, edit line 4 → no dismiss, (3) Multi-line edit spanning lines 5-8 → dismiss.
- Q: What is the maximum file size limit before showing an error? → A: No hard limit - trust Monaco's built-in handling (good enough for MVP).
- Q: Should session state (file, cursor, scroll, hint level) auto-restore on WebSocket reconnect, or require user confirmation? → A: Auto-restore full session state silently for seamless UX. Restoration order: (1) current active tab file content, (2) cursor position, (3) scroll position, (4) hint level, (5) queued operations. Conflict resolution: If user has unsaved edits when disconnect occurs, show toast "Save interrupted, disconnected. Attempting to reconnect..." and re-save dirty tabs on reconnect before applying session:restore. In-flight saves that completed during disconnect are treated as successful; those interrupted are reattempted.
- Q: For "obvious" hint style, which directories should glow alongside the target file? → A: Backend explicitly specifies directory list in `explorer:hint_files` payload (gives backend full control over hint strategy).
- Q: What is the debouncing strategy for edit events to prevent excessive WebSocket traffic? → A: Edits trigger `buffer:update` with trailing debounce: 300ms after last keystroke. If typing continues for >5 seconds without pause, force send at 5s mark (max-wait) regardless of keystroke activity to prevent loss of long-running edit sessions. Debounce timer resets on every keystroke.
- Q: Do editor decorations have a level field, and are they filtered by user hint level like coaching balloons? → A: EditorDecoration entity includes a `level` field in the data model, but decorations are backend-selected and always rendered regardless of user hint level. Only comment balloons and file tree glows are level-filtered. All decoration types (line-highlight, gutter-marker, squiggly, hover) render at all levels.

---

## User Scenarios & Testing

All stories are independently testable and deliver standalone value. Prioritized P1 (critical MVP) or P2 (polish).

### Story 1: Visual Identity & Design System (Priority: P1)

Developer opening Paige wants interface to feel warm, distinctive, and professionally crafted to immediately sense this is a thoughtful Claude-powered coaching tool.

**Why P1**: Foundation for all other stories. Defines visual language.

**Independent Test**: Open any view and verify colors, typography, animations, ASCII treatments match design system.

**Key Requirements**: CSS custom properties for all colors, named spring presets, Framer Motion, `prefers-reduced-motion` support, JetBrains Mono from Google Fonts (400/500/600/700), CSS-only ASCII treatments (no images/canvas).

**Acceptance**: Warm black/olive backgrounds, correct typography hierarchy, spring animations on hover, scanline overlays visible, dot matrix patterns at low opacity, figlet ASCII headers in terracotta, noise texture present, terracotta colors match specified hex values, high contrast mode degrades gracefully, reduced motion disables all spring animations.

---

### Story 2: App Shell & Navigation (Priority: P1)

Developer launching Paige wants responsive app shell that smoothly transitions between dashboard and IDE workspace.

**Why P1**: Container for all views. Defines navigation and layout.

**Independent Test**: Launch app, navigate between views, collapse/expand sidebars, verify layout proportions and animations.

**Layout**: Three views (Dashboard, IDE, Placeholder). IDE has 5-panel layout: 220px file explorer (left), flex editor column with 32px status bar, 280px coaching sidebar (right), terminal spans full width below at 30% height. Header 48px persistent. Sidebars collapse to 32px rails.

**Transitions**: Dashboard→IDE zoom (issue card expands), IDE→Dashboard reverse zoom, both use `expressive` spring preset.

**Acceptance**: Dashboard loads on launch, zoom transitions smooth at 60fps, panels measure correctly (220/flex/280, 70/30 editor/terminal), sidebars collapse to 32px with spring animation, both collapsed gives full width minus 64px rails, macOS traffic lights functional, narrow window (<800px) auto-collapses sidebars, short window (<500px) hides terminal, navigation debounced during transitions.

---

### Story 3: Dashboard Home Screen (Priority: P1)

Junior developer opening Paige wants dashboard showing learning journey, available work, and progress at a glance.

**Why P1**: First thing judges/users see. Entry point demonstrating value.

**Independent Test**: Launch with mocked WebSocket data, verify 6 sections render with golden ratio layout, interactions work, empty/loading states correct.

**Sections** (golden ratio 38:62 / 62:38):
- Row 1: Dreyfus radar (38%) + Stats bento with period switcher (62%)
- Row 2 (hidden when empty): In-progress tasks (62%) + Practice challenges (38%)
- Row 3-4: GitHub issues (62%, scrollable) + Learning materials (38%)

All data from backend WebSocket. Figlet headers. Issue cards trigger zoom to IDE.

**Acceptance**: All sections render with backend data, spider chart with axes/values, stats show 6 cards with default "this week", period switcher updates data, in-progress row visible when tasks exist / hidden when empty, issue card click zooms to IDE, resume click restores session, challenge/material click goes to placeholder, figlet headers render, page scrolls smoothly, skeleton blocks when loading, "No issues" message when empty, radar degrades gracefully with 1-2 axes, zero stats show onboarding message.

---

### Story 4: WebSocket Client (Priority: P1)

Electron UI needs reliable WebSocket connection to backend for all state, file I/O, and coaching data.

**Why P1**: Every interactive story depends on this communication layer.

**Independent Test**: Mock backend server, send all 51 message types, verify parsing/handling, test reconnection, validate debouncing.

**Protocol**: Consistent envelope `{ type, payload, id?, timestamp }`. 28 server→client types, 23 client→server types. TypeScript string literal unions. Singleton service.

**Lifecycle**: Connect→Handshake (`connection:hello`)→Init (`connection:init`)→Active→Reconnect (exponential backoff 1s→2s→4s→8s→16s, cap 30s, retry indefinitely). UI shows "Reconnecting... (attempt N)" after 5 failures. In-flight operations (e.g., file saves) are queued during disconnect and retried on reconnect with "Save interrupted, disconnected. Attempting to reconnect..." toast notification.

**Debouncing**: `buffer:update` 300ms, `editor:scroll` 200ms, `user:idle_start` 5000ms, `hints:level_change` 200ms.

**Acceptance**: Handshake completes, dashboard populates as messages arrive, file open sends request and populates editor, edits debounce at 300ms, save gets ack, disconnect shows reconnecting indicator with backoff retry, in-flight save shows "Save interrupted" toast and retries on reconnect, reconnect restores state, decorations render, nudges injected, idle fires after 5s, messages processed in order, unknown types logged/ignored, invalid payloads logged/ignored.

---

### Story 5: Code Editor (Monaco) (Priority: P1)

Developer working on issue wants familiar responsive editor with tabs, syntax highlighting, and Paige-controlled decorations.

**Why P1**: Primary workspace surface. Makes coaching visible in code.

**Independent Test**: Mock WebSocket file ops, open/edit/save files, verify tab management, test theme, validate decorations.

**Configuration**: `@monaco-editor/react`, no minimap, line numbers on, word wrap off, custom "Paige Dark" theme with warm syntax colors (terracotta keywords, green strings, no cold hues), cursor terracotta.

**Tabs**: Horizontal strip with language icon + filename + close. Active has terracotta bottom border. Dirty shows dot (replaces X, hover shows X). Closing dirty prompts. No duplicates. Overflow scrolls with fade indicators.

**Decorations** (backend-controlled via WebSocket): line-highlight (hint/error/success), gutter-marker (hint/error/warning dots), squiggly (error/warning underlines), hover hints (tooltip at range). Uses absolute range matching—decorations auto-dismiss if any edit overlaps their range (matches balloon behavior).

**Floating Explain Button**: Appears on text selection (2+ chars), positioned above-right, terracotta background, sends `user:explain` with path/range/text.

**Status Bar** (32px at bottom): File path breadcrumb | Cursor position | Language | "Review My Work" split button.

**Acceptance**: Empty state shows figlet "PAIGE" splash, file click opens new tab with syntax highlighting, already-open file switches tabs, editing shows dirty dot and debounced buffer update, Cmd+S saves and clears dirty, Cmd+W on clean closes immediately, Cmd+W on dirty prompts, 10+ files scroll horizontally, decorations render correctly per type/style, hover shows tooltip, decorations clear on command, select code shows explain button, button click sends correct payload, theme has warm colors throughout, large files handled natively, binary files show message, deleted files show indicator.

---

### Story 6: File Explorer with Hint Glow (Priority: P1)

Developer working on issue wants file tree with subtle glows guiding toward relevant files.

**Why P1**: Primary navigation and "breakable wall" demo highlight.

**Independent Test**: Mock WebSocket tree/hint data, verify rendering, test all three hint styles with visual inspection, validate auto-expand.

**Component**: `react-arborist` with virtualization, `vscode-icons`, 220px fixed width, "EXPLORER" header.

**Three-Tier Hints** (from `explorer:hint_files` WebSocket):
- `subtle` (level 1): File gentle breathing glow only
- `obvious` (level 2): File + backend-selected directories glow
- `unmissable` (level 3): File + ALL ancestor directories with intensity gradient (parent brightest, fades to baseline)

**Glow**: Gentle breathing baseline (stiffness 120, damping 14, looping), color `--hint-glow`. Gradient interpolates stiffness/damping/opacity based on distance from file. Multiple hints = highest intensity wins.

**Auto-Expand**: subtle=no expand, obvious=top-level only, unmissable=full path.

**Acceptance**: Tree renders with correct icons/nesting, file click opens in editor, folder click expands/collapses, subtle shows file glow only, obvious shows file + backend dirs glowing, unmissable shows gradient with parent brightest, unmissable auto-expands full path, subtle stays collapsed, clear command removes all glows, tree updates for add/remove/rename, keyboard nav works, 500+ files performant.

---

### Story 7: Terminal with xterm.js (Priority: P1)

Developer wants terminal panel for conversational coaching with Claude Code.

**Why P1**: Conversational coaching surface demonstrating AI in action.

**Independent Test**: Spawn PTY, connect xterm.js, verify ANSI colors map to warm palette, test control characters, validate resizing.

**Implementation**: PTY via `node-pty` in main process, xterm.js in renderer, raw data flows PTY→IPC→`terminal.write()`. xterm.js handles ANSI parsing, cursor, screen management. `FitAddon` manages sizing.

**Colors**: All 16 ANSI colors remapped to warm variants via `ITheme`. Foreground `--text-primary`, background `--bg-inset`, cursor terracotta, selection terracotta 30%.

**Observer Nudges**: Backend sends `observer:nudge` WebSocket→main writes to PTY stdin→Claude processes→output renders normally. No visual distinction from user-initiated.

**PTY Size**: FitAddon calculates cols/rows, `fit()` on resize (ResizeObserver), new dimensions to PTY via `resize()`, sends `terminal:ready`/`terminal:resize` WebSocket.

**Acceptance**: Shell prompt appears, `ls --color` shows warm colors, 1000+ lines scroll without freezing, Ctrl+C interrupts, nudges render as normal output, resize reflows correctly, interactive commands work, Claude TUI renders correctly (cursor positioning, box-drawing, powerline), rapid output handled natively, exit shows message without crash.

---

### Story 8: Coaching Sidebar (Issue + Phases) (Priority: P1)

Developer wants sidebar showing issue context and phase progression with adjustable detail.

**Why P1**: Coaching command center demonstrating progressive disclosure model.

**Independent Test**: Mock WebSocket session/coaching messages, render all components, test hint level changes (0-3), validate phase transitions.

**Layout** (280px fixed, scrollable): Issue context (number/title/labels/summary) → Hint slider with morphing SVG illustration → Phase stepper (vertical, max 5 phases).

**Issue Context**: `#N` clickable link (opens GitHub), title H3, colored label pills (auto-contrast), toggleable AI summary (max 250 chars).

**Hint Slider** (4 discrete positions 0-3):
- Illustrations morph between 4 scenes (0=hunched over laptop, 1=with books, 2=second person pointing, 3=second person coding while first person relaxes with cocktail)
- Labels: None, Light, Medium, Heavy
- Sends `hints:level_change` WebSocket

**Phase Stepper**: Vertical with 2px connecting line. Indicators: complete (green checkmark 12px), active (terracotta pulse 14px), pending (outlined 12px). Only active phase shows content based on hint level: 0=title only, 1=title+summary, 2=title+summary+sub-step titles, 3=title+summary+sub-step accordion.

**Phase Transition Animation**: Checkmark fills→line fills→next activates with pulse→content expands if level>0.

**Acceptance**: Sidebar populates on session start, issue number links to GitHub, labels render with GitHub colors, summary toggles, slider at 0 shows None illustration with titles only, slider at 1 shows Light with active summary, slider at 2 shows Medium with sub-step titles, slider at 3 shows Heavy with accordion, accordion expands one at a time, stepper shows correct colors/states, transition animates checkmark→line→pulse→expand, all complete shows all green, content scrolls independently, collapse to 32px rail hides content, expand restores state, resume restores context.

---

### Story 9: Hinting System (Priority: P1)

Developer wants unified hinting coordinating coaching messages, editor decorations, and file glows based on hint level.

**Why P1**: Crown jewel tying entire coaching surface together. Core innovation.

**Independent Test**: Mock WebSocket with level metadata, change hint level, verify frontend filtering updates instantly, test comment balloons, validate Explain/Review flows, ensure phase transitions clear correctly.

**Responsibility**: Backend = what hints exist (sends all with level metadata). Frontend = all rendering decisions (filters by level instantly, auto-dismisses on code change, shows/hides on level change). No backend round-trips for display changes.

**Level Mapping**:
- 0 (None): No glow, no decorations, balloons collapsed to icon, titles only
- 1 (Light): Subtle glow, no decorations, balloons collapsed to icon, phase+summary
- 2 (Medium): Obvious glow, line highlights+gutter, balloons expanded, phase+summary+steps
- 3 (Heavy): Unmissable glow, all decorations+hover, balloons expanded, full accordion

**Comment Balloons** (`@floating-ui/react`): Anchored to code via Monaco `getScrolledVisiblePosition`. Right-side preferred with flip/shift middleware. Arrow points to anchor. Max width 320px, max height 200px scrollable. Type-colored left border (hint=terracotta, info=blue, success=green, warning=yellow). Close button. Auto-dismiss on code change (any overlap). Multiple simultaneous with collision detection.

**Collapsed Icon** (levels 0-1 except user-initiated): 20px circle with speech bubble, terracotta 60%, gentle pulse. Click expands and stays expanded. At anchor point.

**Editor Toasts** (`react-toastify` stacked): Unanchored messages. Top-right, persist until closed. Same styling as balloons. Always full content regardless of level.

**Explain**: Select text→button→sends `user:explain`→backend responds with `coaching:message` (source: explain)→renders as full balloon at selection regardless of level.

**Review Split Button** (status bar): Main area reviews current scope, caret opens dropdown (Review File / Since Last Review / Since Last Phase / Since Issue Start). Sends `user:review` with scope. Backend responds with `coaching:review_result` (comment array, each with messageId). Status bar transforms to review navigation mode: `[◀] 2/7 [▶] [✕]`. Navigate comments with ◀/▶ using messageId for stable tracking (scrolls editor, switches tabs for cross-file), focused comment emphasized, ✕ exits and dismisses all.

**Review Lifecycle**: New review replaces previous. Phase transition = review persists, new coaching hints layer. Tab closed = counter adjusts, ◀/▶ skip, exit if all gone. Session ends = exit.

**Keyboard Shortcuts**: Cmd+Shift+H cycles level, Cmd+Shift+[ decreases, Cmd+Shift+] increases. Updates slider, re-evaluates instantly. WebSocket debounced 200ms.

**Phase Transition**: Backend sends clear commands→frontend clears coaching balloons→backend sends new hints→frontend applies by current level. Review comments NOT cleared.

**Acceptance**: Anchored message at level 2 shows full balloon with arrow, same at level 1 shows collapsed icon, click icon expands and stays expanded, edit under balloon dismisses immediately, unanchored message shows toast, explain flow works end-to-end, level 1→3 expands icons+decorations+glows, level 3→0 collapses/hides all, review click shows comments with ◀/▶ navigation, caret opens dropdown with 4 scopes, ◀/▶ navigates cross-file with tab switching, ✕ exits and dismisses, phase transition clears old and applies new hints at current level, Cmd+Shift+] increments with slider update, Cmd+Shift+H cycles with visual changes, balloons track anchors and hide when scrolled off-screen, multiple balloons render without overlap.

---

### Story 10: Placeholder / Coming Soon Page (Priority: P2)

Developer clicking Practice Challenges or Learning Materials wants friendly placeholder explaining features are coming soon.

**Why P2**: Polish preventing dead-end UX. Lower priority but important for professional feel.

**Independent Test**: Navigate directly or via dashboard, verify visual elements, test round-trip preserves state.

**Layout**: Centered content. Figlet "COMING SOON" in terracotta. SVG illustration of Paige building (hard hat, hammering, ~160px, scanline overlay). Playful message: "I'm still learning this one myself... check back soon!" Back link "← Back to Dashboard". Dot matrix background.

**Navigation**: Click challenge/material→fade in (300ms)→placeholder→back link→fade out→dashboard (state preserved). No zoom transition.

**Acceptance**: Challenge click fades to placeholder, material click shows same page, back preserves dashboard scroll/data, styling matches design system (figlet terracotta, dot matrix, warm palette), illustration fallback to 🚧 emoji if missing, reduced motion makes transitions instant.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| JetBrains Mono fails to load | Fallback to system monospace |
| System forced high contrast | Respect OS accessibility settings |
| `prefers-reduced-motion` active | Disable all spring animations, use instant transitions |
| Window very narrow (<800px) | Auto-collapse sidebars |
| Window very short (<500px) | Hide terminal panel |
| Rapid navigation clicks | Debounce during transitions |
| Non-macOS platform | Standard frame with custom header inside |
| Backend not connected / no data | Skeleton loading blocks |
| No GitHub issues | "No issues assigned" message |
| Radar chart 1-2 axes | Degrade to bar chart |
| New user all stats zero | Show zeros with onboarding message |
| Very long issue titles | Truncate with ellipsis at 2 lines |
| Many issues (20+) | Virtual scrolling or pagination |
| Backend not running on launch | Retry with backoff, show connecting message |
| Unknown message type | Log warning, ignore |
| Invalid message payload | Log error, ignore |
| WebSocket backpressure | Backend handles; client processes ASAP |
| Very large file (>1MB) | Pass to Monaco; handles natively |
| Rapid reconnect cycles (5+ failures) | Cap backoff at 30s, retry indefinitely, show "Reconnecting... (attempt N)" |
| Binary file opened | Show "Binary file — cannot display" message |
| File deleted while tab open | Tab remains with last content; "File deleted" indicator |
| Save fails (non-disconnect) | Dirty dot remains; error toast with message |
| Save interrupted by disconnect | Show "Save interrupted, disconnected. Attempting to reconnect..." toast; retry on reconnect |
| Unknown file extension | Monaco defaults to plain text |
| Multiple files same name | Tab shows `parent/filename`; tooltip shows full path |
| Decorations for unopened file | Store; apply when tab becomes active |
| Multi-line selection for explain | Button anchored to selection end; sends full text |
| Very deep nesting (10+ levels) | Indentation continues; horizontal scroll if needed |
| Empty project | "No files in project" message |
| Multiple hints same file | Latest hint set wins |
| Hint for file not in tree | Ignore silently (log warning) |
| `fs:tree_update` for non-existent path | Ignore (log warning) |
| Multiple hints same directory different intensities | Highest intensity wins |
| Very long filenames | Truncate with ellipsis; tooltip shows full name |
| Hidden files (dotfiles) | Shown in tree |
| Rapid output (>10KB/s) | xterm.js handles natively |
| PTY exits | "Process exited" message; no crash |
| Non-UTF8 output | xterm.js best-effort; don't crash |
| Terminal focused while typing in editor | xterm.js only captures when focused |
| Very long scrollback (10k+ lines) | xterm.js buffer capped at 5000 lines |
| Issue no labels | Labels row hidden entirely |
| Issue summary >250 chars | Frontend truncates at 250 with ellipsis |
| Very long phase title | Truncate with ellipsis; tooltip shows full |
| Only 1-2 phases | Stepper renders with fewer nodes |
| Phase update non-existent phase | Ignore, log warning |
| Hint level drops below 3 with accordion open | Accordion resets; sub-steps hidden |
| SVG illustrations not ready | Fallback: level name text + emoji |
| Session ends while sidebar visible | Navigate back to dashboard |
| Label color too light for white text | Auto-contrast: dark text on light labels |
| Balloon anchor scrolls out of view | Hide; show when scrolled back |
| Multiple balloons would overlap | Floating UI prevents overlap |
| Code modification overlaps anchor range | Dismiss balloon and decorations (absolute range matching) |
| Review comments span multiple files | ◀/▶ auto-switches tabs |
| New review while previous active | Previous dismissed; replaced |
| Hint level changes during review | Review comments unaffected |
| Phase transition during review | Review persists; new hints layer |
| Very long coaching message | Scrollable; max-height 200px |
| Anchor code deleted entirely | Dismiss balloon |
| Tab closed with review comments | Counter adjusts; ◀/▶ skip; exit if all gone |
| Coaching message for unopened file | Store; render when tab active |
| Rapid hint level slider changes | Debounce WebSocket 200ms; render instant |
| Direct deep-link to placeholder | Render normally; back goes to dashboard |

---

## Requirements

### Functional Requirements

For complete requirements matrix with all 110 functional requirements (FR-001 through FR-110), see original spec at `docs/planning/frontend-discovery/SPEC.md` sections under each story's Requirements subsection.

**Critical Requirements Summary** (strict thin-client architecture):
- **FR-026**: All UI↔Backend communication MUST use WebSocket (no REST, no direct file I/O)
- **FR-041**: Editor MUST NOT generate its own decorations (thin client principle)
- **FR-051**: Tree MUST NOT access filesystem directly (thin client principle)
- **FR-078**: Sidebar MUST NOT contain AI logic (thin client principle)
- **FR-097**: Frontend MUST own all rendering decisions (filter by level, dismiss on code change, show/hide on level change)
- **FR-098**: Frontend MUST NOT round-trip to backend for hint display changes

**Technology Requirements** (established libraries only):
- **FR-004**: Framer Motion for all spring animations
- **FR-036**: Monaco Editor via `@monaco-editor/react`
- **FR-048**: File tree via `react-arborist` with virtualization
- **FR-049**: File icons via `vscode-icons`
- **FR-058**: Terminal via xterm.js
- **FR-080**: Comment balloons via `@floating-ui/react`
- **FR-087**: Editor toasts via `react-toastify` with stacked prop

**Accessibility Requirements**:
- **FR-005**: `prefers-reduced-motion` media query MUST be respected for all animations

### Key Entities

**WebSocketMessage**: Standardized message envelope for all client↔server communication. Attributes: type (string), payload (unknown), id (optional string), timestamp (number). Used by all 51 message types (28 server→client, 23 client→server).

**TreeNode**: File tree hierarchy node. Attributes: name, path, type ('file'|'directory'), children (optional array).

**Phase**: Coaching progression stage. Attributes: number (1-5), title, status ('pending'|'active'|'complete'), summary, steps (array with title/description). Displayed in sidebar phase stepper.

**IssueContext**: GitHub issue metadata. Attributes: number, title, summary (AI-generated max 250 chars), labels (array with name/color hex), url. Displayed in sidebar issue context.

**CoachingMessage**: Coaching hint/guidance. Attributes: messageId (UUID, backend-generated for stable reference), message, type ('hint'|'info'|'success'|'warning'), anchor (optional path/range), source ('coaching'|'explain'|'observer'). Rendering controlled by user hint level: 0-1 shows collapsed icon only, 2-3 shows full balloon. Exception: source='explain' or 'observer' always renders full regardless of level. Renders as balloon (anchored) or toast (unanchored).

**EditorDecoration**: Monaco visual decoration. Attributes: type ('line-highlight'|'gutter-marker'|'squiggly'), range, message (optional), style ('hint'|'error'|'warning'|'success'), level (minimum to display). Backend-controlled via WebSocket. Uses absolute range matching—auto-dismisses if edit overlaps range (standard interval: edit.line within [startLine, endLine], with column check for boundary lines).

**ExplorerHint**: File tree glow. Attributes: path, style ('subtle'|'obvious'|'unmissable'), directories (optional array of paths - backend specifies which directories glow for 'obvious' style). Maps to hint levels 1/2/3. For 'unmissable', all ancestor directories glow automatically with intensity gradient.

---

## Success Criteria

### Measurable Outcomes

For complete success criteria matrix with all 51 criteria (SC-001 through SC-051) including specific measurements, see original spec at `docs/planning/frontend-discovery/SPEC.md` Success Criteria section.

**Critical Success Criteria** (demo readiness):
- **SC-004**: Visual identity is cohesive — design preview HTML matches implemented output
- **SC-006**: Transitions are smooth — zoom in/out completes without jank at 60fps
- **SC-011**: Zoom transition works — smooth transition from issue card click to IDE view
- **SC-014**: Type safety is complete — all 51 message types have TypeScript interfaces, no `any`
- **SC-018**: Theme matches design system — background #141413, terracotta cursor, warm syntax tokens (no cold hues)
- **SC-023**: Tree renders completely — full project tree with correct icons, nesting, expand/collapse
- **SC-024**: Three hint styles visually distinct — subtle=file only, obvious=file+dirs, unmissable=gradient
- **SC-029**: TUI rendering complete — Claude Code welcome screen, status bars, powerline render correctly
- **SC-039**: Progressive disclosure works instantly — level 0-1 shows icon, level 2+ shows full balloon
- **SC-042**: Review flow works end-to-end — click review → comments → ◀/▶ navigates → ✕ exits
- **SC-047**: Phase transition is clean — old hints clear, new hints appear at current level
- **SC-051**: Playful tone maintained — message reads as Paige's voice, not generic boilerplate

---

## Assumptions

1. **Browser Compatibility**: Targets modern Chromium (Electron embeds Chromium). No IE11/legacy support.
2. **Backend Availability**: Backend WebSocket server runs on localhost with configurable port. UI handles reconnection but assumes backend eventually available.
3. **File System Access**: All file operations via backend WebSocket. Frontend never touches filesystem directly.
4. **GitHub Integration**: GitHub data comes from backend. Frontend displays without validating API responses.
5. **AI-Generated Content**: Issue summaries and coaching messages are AI-generated by backend. Frontend trusts and renders (with standard XSS protection).
6. **Single User**: Designed for single user on local machine. No multi-user/multi-tenant/concurrent sessions.
7. **Platform**: Primary target macOS (development platform). Windows/Linux use standard Electron frame instead of `hiddenInset`.
8. **SVG Illustrations**: Custom SVGs for hint levels and placeholder assumed available at build time. Emoji fallbacks defined for missing.
9. **Font Loading**: JetBrains Mono from Google Fonts expected to load successfully. System monospace fallback for failures.
10. **Monaco Editor**: Assumed to handle large files (>1MB) natively without custom optimization.

---

## Out of Scope

1. **Multi-Language Support**: English-only UI, no i18n
2. **Offline Mode**: Requires active WebSocket to backend
3. **Mobile/Tablet**: Desktop-only, no responsive mobile layout
4. **Plugin System**: Fixed feature set, no extensibility
5. **Themes**: Single "Paige Dark" theme, no light theme or customization
6. **Custom Keybindings**: Fixed shortcuts, no user configuration
7. **WCAG AA Compliance**: Only `prefers-reduced-motion` enforced. No full keyboard navigation (tab order, focus management)—essential shortcuts only (save/close/hint-cycling/review, file tree arrows/Enter)
8. **File System Operations**: No file create/delete/rename from UI
9. **Git Operations**: No git commands beyond what Claude Code handles via terminal
10. **Production Deployment**: No packaging, code signing, auto-updates, deployment infrastructure
11. **Performance Monitoring**: No telemetry, error tracking. Console logging only.
12. **Multi-Window**: Single window application
13. **Drag and Drop**: No DnD for files/tabs/panels
14. **Global Search**: No search beyond Monaco Editor's file search
15. **Settings/Preferences UI**: No settings panel, configuration via environment variables only

---

**For Implementation**: See original spec at `docs/planning/frontend-discovery/SPEC.md` for:
- Complete design token tables (68 colors, 7 typography levels, 4 spring presets)
- Detailed acceptance scenario matrices per story (150+ scenarios total)
- Complete edge case catalog (90+ edge cases documented)
- Full requirements matrix (110 functional requirements with confidence scores)
- Comprehensive success criteria (51 measurable outcomes)
- Message protocol specifications (51 WebSocket message types with full payload schemas)
- Component specifications with exact dimensions, animations, and visual treatments
- Story revision history tracking all changes during discovery

**Status**: All 10 stories graduated from discovery phase. Spec validated and ready for planning/implementation.
