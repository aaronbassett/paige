# Terminal & Coaching Panel Fixes

**Date**: 2026-02-13
**Status**: Approved

## Problem

Two rendering issues in the Electron UI:

1. **Terminal**: Backend logs `[ws-router] Unknown message type: terminal:ready` because the router has no handler for terminal lifecycle messages
2. **Coaching Panel**: Shows "Waiting for session..." permanently because the backend never sends `session:start` after planning completes

## Fix 1: Terminal Message Handlers

**Root cause**: Frontend sends `terminal:ready`, `terminal:resize`, and `terminal:input` per the WebSocket contract, but the backend only implements `terminal:command`.

### Changes

**`src/types/websocket.ts`** - Add interfaces:
- `TerminalReadyData` (cols, rows)
- `TerminalResizeData` (cols, rows)
- `TerminalInputData` (data: string)
- Add all three to `ClientToServerMessage` union

**`src/websocket/schemas.ts`** - Add Zod schemas:
- `terminalReadyDataSchema`
- `terminalResizeDataSchema`
- `terminalInputDataSchema`
- Register in `messageDataSchemas`

**`src/websocket/handlers/terminal.ts`** - New handler:
- `handleTerminalReady`: Store ready state + dimensions on connection context
- `handleTerminalResize`: Update dimensions on connection context
- `handleTerminalInput`: No-op (basic state tracking only)

**`src/websocket/router.ts`** - Register all three handlers

### Design decision

Terminal state is stored in-memory on the connection context, not in the database. This is sufficient for the Observer to check terminal readiness. Full command tracking is a future enhancement.

## Fix 2: Coaching Panel session:start Message

**Root cause**: After planning, backend sends `planning:complete` but not `session:start`. The CoachingSidebar subscribes to `session:start` to populate issue context and phases.

### Changes

**`src/types/websocket.ts`** - Add `SessionStartMessage` server-to-client type (if not present):
- sessionId: string
- issueContext: { number, title, summary, labels, url }
- phases: Phase[]
- initialHintLevel: 0

**`src/websocket/handlers/planning.ts`** - After sending `planning:complete`, also send `session:start`:
- Data already available in the handler (session ID, issue context, phases)
- Format as `session:start` message and send to client

### Data flow after fix

```
Planning completes
  → Backend sends planning:complete (triggers IDE navigation)
  → Backend sends session:start (populates CoachingSidebar)
  → CoachingSidebar sets issueContext + phases
  → UI renders issue card, hint slider, phase stepper
```
