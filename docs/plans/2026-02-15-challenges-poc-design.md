# Challenges PoC Design

**Date:** 2026-02-15
**Branch:** challenges

## Overview

A chat-like challenge view within the Electron app where the user's "message input" is a mini Monaco code editor. The AI poses a coding challenge, the user submits a solution, the AI reviews it, and on pass the challenge repeats with an added constraint (up to 4 rounds). On fail the user retries with their previous code pre-populated.

## Approach

Chat-Thread Component (Approach A). A single React component tree renders a scrollable chat thread with AI messages (challenge text, review feedback) and user messages (submitted code rendered as read-only code blocks). A pinned Monaco editor at the bottom serves as the input.

## Component Architecture

New full-screen view `ChallengeView`, added to the `AppView` union alongside `landing`, `dashboard`, `ide`, `placeholder`, and `planning`.

**Navigation:** User clicks a challenge card in `PracticeChallenges` on the Dashboard. `AppShell` navigates to `ChallengeView`, passing the `kataId`. Back button returns to Dashboard.

**Component tree:**

```
ChallengeView (view, owns all state)
├── ChallengeHeader (kata title, round indicator "Round 2/4")
├── ChatThread (scrollable message list)
│   ├── AiMessage (challenge text / review feedback, rendered as markdown)
│   └── UserMessage (submitted code, rendered as read-only Monaco snippet)
└── CodeInput (pinned to bottom)
    ├── Mini Monaco editor (~200px tall, resizable)
    └── Submit button
```

**State model** (all local to `ChallengeView`):

```ts
interface ChallengeState {
  kataId: number;
  kata: { title: string; description: string; scaffoldingCode: string; constraints: KataConstraint[] };
  messages: ChatMessage[];
  activeConstraints: string[];
  round: number;
  status: 'idle' | 'submitting' | 'complete';
  editorValue: string;
}

type ChatMessage =
  | { role: 'ai'; content: string; type: 'challenge' | 'review' }
  | { role: 'user'; code: string };
```

## Flow

### Initial Load
1. `ChallengeView` mounts with `kataId`
2. Send `challenge:load` via WebSocket, receive `challenge:loaded` with full kata data
3. Populate first AI message with kata description + scaffolding code
4. Set `editorValue` to `scaffoldingCode`
5. `activeConstraints` starts empty, `round` = 1

### Submit
1. Set `status = 'submitting'` (disable editor + button, show spinner)
2. Append `{ role: 'user', code: editorValue }` to messages
3. Send `practice:submit_solution` with `{ kataId, code, activeConstraints }`
4. Listen for `practice:solution_review` response

### On Pass
1. Append AI review message to thread
2. If `round < 4` and there are unlocked constraints:
   - Pick next constraint from `constraintsUnlocked[0]`
   - Add it to `activeConstraints`
   - Increment `round`
   - Append new AI challenge message with added constraint description
   - Clear editor back to scaffolding code
3. If `round >= 4` or no more constraints:
   - Append congratulatory AI message
   - Set `status = 'complete'`
   - Show "Back to Dashboard" button

### On Fail
1. Append AI review message (with feedback)
2. Re-populate `editorValue` with user's last submitted code
3. Keep `round` the same, `status` back to `'idle'`

### Simplified Constraint Model
Instead of using `minLevel`, iterate through constraints array in order. Round 1 = no constraints. Round 2 = first constraint active. Round 3 = first + second. Round 4 = first + second + third. We control which constraint IDs we send in `activeConstraints`.

## Backend Changes

One new WebSocket round-trip to load the full kata.

### New Messages

Client -> Server:
```ts
interface ChallengeLoadData {
  readonly kataId: number;
}
// type: 'challenge:load'
```

Server -> Client:
```ts
interface ChallengeLoadedData {
  readonly kataId: number;
  readonly title: string;
  readonly description: string;
  readonly scaffoldingCode: string;
  readonly constraints: readonly { id: string; description: string }[];
}
// type: 'challenge:loaded'

interface ChallengeLoadErrorData {
  readonly error: string;
}
// type: 'challenge:load_error'
```

No changes to database schema, review API, or Sonnet prompt. The existing `practice:submit_solution` / `practice:solution_review` handles everything else.

## UI Details

### Layout
Full height view, flexbox column: Header (fixed, ~48px) -> ChatThread (flex: 1, overflow-y: auto) -> CodeInput (fixed to bottom, ~250px).

### ChatThread
- AI messages: left-aligned, monospace, dark background (`var(--bg-surface)`), markdown rendered. Challenge messages get accent-left-border.
- User messages: right-aligned, read-only Monaco snippet with syntax highlighting.
- Auto-scrolls to bottom on new messages.

### CodeInput
- Mini Monaco instance, ~200px tall, same theme as main editor
- Language auto-detected from scaffolding code (default TypeScript)
- Full-width submit button, disabled during submitting state
- Spinner while waiting for review response

### ChallengeHeader
- Kata title on left
- Round indicator on right: "Round 1/4" with progression dots

### Animations
Framer Motion presets for message appearance (fade + slide up). No complex transitions.

### Complete State
CodeInput replaced with "Challenge complete!" summary and "Back to Dashboard" button.

### Error Handling
If `review:error` received, show inline error in chat thread and re-enable editor for retry.
