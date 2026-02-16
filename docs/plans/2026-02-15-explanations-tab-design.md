# Explanations Tab Design

Date: 2026-02-15

## Summary

Replace the "Back to Dashboard" link in the coaching sidebar with a two-tab bar. First tab ("Issue Detail") contains the existing coaching view. Second tab ("Explanations") displays an accordion list of code explanations returned by the Explain This API. Explanations persist in app memory only.

## Tab Bar & Layout

- Two-tab bar at the top of the sidebar, replacing the dashboard back link
- **Issue Detail** (default): IssueContext, HintSlider, PhaseStepper, review/commit controls, ReviewResults
- **Explanations**: accordion list of explanation entries
- Active tab: `border-bottom: 2px solid var(--accent-primary)`, `color: var(--text-primary)`
- Inactive tab: `color: var(--text-muted)`, no bottom border
- Both panels share the scrollable area below the tab bar
- Instant content swap on tab change, no animation
- Tab bar only renders when `hasSession` is true

## API Changes

Backend `explainThisSchema` gains `title: z.string()` (max 50 chars). System prompt updated to request a short title. `ExplainResult`, `ExplainResponseData`, and the broadcast payload all gain the `title` field.

## In-Memory State

Stored in `CoachingSidebar`:

```ts
interface ExplanationEntry {
  id: string;              // `explain-${Date.now()}`
  title: string;           // from API (max 50 chars)
  explanation: string;     // main body
  phaseConnection?: string;
  timestamp: number;
}
```

- `explanations: ExplanationEntry[]` — newest first
- `explanationLoading: boolean`
- `expandedExplanationId: string | null` — single open item

Cleared on `session:end`. Persists across tab switches and phase transitions.

## Explain Flow

1. User clicks Explain button in editor
2. `IDE.tsx` sends `user:explain` via WebSocket
3. `IDE.tsx` calls `onExplainRequested` on `CoachingSidebar`
4. Sidebar switches to Explanations tab, collapses all items, shows loading skeleton
5. `explain:response` arrives: prepend entry, auto-expand it, clear loading
6. `explain:error` arrives: prepend error entry ("Explain failed"), clear loading

## ExplanationsPanel Component

New file: `electron-ui/renderer/src/components/Sidebar/ExplanationsPanel.tsx`

Props: `explanations`, `loading`, `expandedId`, `onToggle`

- Accordion: one item open at a time, click title to toggle
- Chevron indicator (right collapsed, down expanded)
- Body shows explanation + optional phase connection line
- Empty state: "Select code and click Explain"
- Loading skeleton: two pulsing CSS bars (title + body), no library dependency

## Toast Handler Removal

Remove `explain:response` / `explain:error` subscriptions from `useCoachingMessages`. The sidebar handles these instead.

## Error Handling

- No active session: tab bar hidden, placeholder shown
- Rapid clicks: new request replaces loading state, previous response still prepended on arrival
- Session end: clears explanations, resets to Issue Detail tab
- Phase transition: explanations persist (not phase-specific)

## Approach

Approach A: all state in `CoachingSidebar`, accordion rendering in a new `ExplanationsPanel` child component. No new hooks, contexts, or architectural abstractions.
