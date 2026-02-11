# Revision History: electron-ui

*Record of all revisions to graduated stories.*

---

## REV-1: Story 4 — `explorer:hint_files` payload restructured — 2026-02-10

**Revision Type**: Modificative

**Story Affected**: Story 4 (WebSocket Client)

**What Changed**:
- Old: `explorer:hint_files` payload was `{ paths: string[], style }`
- New: `explorer:hint_files` payload is `{ hints: [{ path, style: 'subtle' | 'obvious' | 'unmissable', directories?: string[] }] }`

**Why**: Story 6 (File Explorer with Hint Glow) requires three distinct hint styles mapped to hint levels, with per-file style assignment and backend-controlled directory glow lists. The flat `paths[]` + single `style` format couldn't express this.

**Impact**: The `explorer:hint_files` TypeScript interface in Story 4's message type definitions must use the new structure. No other messages affected.

**Triggered By**: Story 6 deep-dive — user specified three-tier hint system where backend determines which directories to glow.

---

## REV-2: Story 4 — `coaching:message` gains `level` and `source` fields — 2026-02-11

**Revision Type**: Modificative

**Story Affected**: Story 4 (WebSocket Client)

**What Changed**:
- Old: `coaching:message` payload was `{ message, type, anchor?: { path, range } }`
- New: `coaching:message` payload is `{ message, type, anchor?: { path, range }, level: number, source: 'coaching' | 'explain' | 'observer' }`

**Why**: Story 9 (Hinting System) requires the frontend to own rendering decisions — filtering comment balloons by hint level and identifying user-initiated messages (explain, review) that bypass level filtering. The `level` field tells the frontend the minimum hint level for full display. The `source` field distinguishes user-initiated responses from proactive coaching.

**Impact**: All `coaching:message` handlers must accept the new fields. Frontend stores messages and filters display.

**Triggered By**: Story 9 deep-dive — user specified frontend rendering responsibility model.

---

## REV-3: Story 4 — `editor:decorations` items gain `level` field — 2026-02-11

**Revision Type**: Modificative

**Story Affected**: Story 4 (WebSocket Client)

**What Changed**:
- Old: decoration items were `{ type, range, message?, style }`
- New: decoration items are `{ type, range, message?, style, level: number }`

**Why**: Story 9 requires frontend to filter editor decorations by current hint level. The `level` field tells the frontend the minimum hint level at which to display each decoration.

**Impact**: The `editor:decorations` TypeScript interface must include `level` per decoration item.

**Triggered By**: Story 9 deep-dive — hint level mapping across IDE surfaces.

---

## REV-4: Story 4 — `user:review` payload gains `scope` field — 2026-02-11

**Revision Type**: Modificative

**Story Affected**: Story 4 (WebSocket Client)

**What Changed**:
- Old: `user:review` payload was `{}`
- New: `user:review` payload is `{ scope: 'file' | 'since_last_review' | 'since_last_phase' | 'since_issue_start', path?: string }`

**Why**: Story 9 introduces a split "Review My Work" button (GitHub merge button pattern) allowing the user to choose review scope.

**Impact**: Backend review handler must accept scope parameter and return comments accordingly.

**Triggered By**: Story 9 deep-dive — user specified split button with 4 review scopes.

---

## REV-5: Story 4 — New `coaching:review_result` message type — 2026-02-11

**Revision Type**: Additive

**Story Affected**: Story 4 (WebSocket Client)

**What Changed**:
- New server → client message: `coaching:review_result` with `{ comments: [{ message, type, anchor }] }`
- Server → client total: 27 → 28 message types

**Why**: Review responses need to be a batch (array of positioned comments) so the frontend can build navigation (◀/▶ with "2/7" counter). Individual `coaching:message` messages wouldn't let the frontend know when the batch is complete.

**Impact**: New TypeScript interface needed. Frontend enters "review navigation mode" on receipt.

**Triggered By**: Story 9 deep-dive — user specified review navigation with next/previous controls.

---

## REV-6: Story 5 — "Review My Work" becomes split button — 2026-02-11

**Revision Type**: Modificative

**Story Affected**: Story 5 (Code Editor - Status Bar)

**What Changed**:
- Old: "Review My Work" was a simple text button sending `user:review {}`
- New: Split button (GitHub merge button pattern) with main action + ▾ dropdown for scope selection

**Why**: Story 9 defines 4 review scopes. The split button keeps the default action (Review File) as a single click while making broader scopes accessible.

**Impact**: Status bar component needs split button implementation with upward-opening dropdown.

**Triggered By**: Story 9 deep-dive — user specified GitHub-style split button for review scope selection.

---

## REV-7: Story 5 — Status bar gains review navigation mode — 2026-02-11

**Revision Type**: Additive

**Story Affected**: Story 5 (Code Editor - Status Bar)

**What Changed**:
- New: When `coaching:review_result` arrives, the status bar right section transforms from `[Review My Work ▾]` to `[◀] 2/7 [▶] [✕]`
- ◀/▶ navigate review comments (cross-file tab switching), ✕ exits review mode

**Why**: Review comments need structured navigation. Status bar is the natural location (already contains the review trigger).

**Impact**: Status bar needs a "review mode" state with navigation controls.

**Triggered By**: Story 9 deep-dive — user specified review comment navigation with next/previous and cross-file tab switching.

---

## REV-8: Story 2 — Three view states (was two) — 2026-02-11

**Revision Type**: Modificative

**Story Affected**: Story 2 (App Shell & Navigation)

**What Changed**:
- Old: R2.1 — "Exactly two view states: Dashboard and IDE"
- New: R2.1 — "Three view states: Dashboard, IDE, and Placeholder"
- "Two Views" section updated to "Three Views" with Placeholder listed
- Back/home button now visible in Placeholder view (in addition to IDE)

**Why**: Story 10 (Placeholder / Coming Soon Page) introduces a lightweight third view state for unbuilt features (Practice Challenges, Learning Materials). It uses a simple opacity fade rather than the zoom transition.

**Impact**: Router/navigation logic needs a third route. Header back button must also appear on placeholder view. Minimal impact — placeholder is a simple centered-content page.

**Triggered By**: Story 10 graduation — placeholder page needs to exist as a navigable view.

---
