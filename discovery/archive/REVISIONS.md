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
