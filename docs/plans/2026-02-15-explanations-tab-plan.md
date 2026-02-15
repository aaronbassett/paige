# Explanations Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dashboard back link with a tab bar (Issue Detail / Explanations) and display explain responses in an accordion panel instead of toasts.

**Architecture:** All state lives in CoachingSidebar (Approach A). A new ExplanationsPanel child component handles accordion rendering. Backend gains a `title` field in the explain API response. Toast handlers for explain are removed.

**Tech Stack:** React 18, TypeScript, Zod, WebSocket, CSS-in-JS (inline styles matching existing patterns)

---

### Task 1: Backend — Add `title` to explain schema and prompt

**Files:**
- Modify: `src/api-client/schemas.ts:129-133`
- Modify: `src/ui-apis/explain.ts:13-17,66-69,127-130`
- Modify: `src/types/websocket.ts:610-613`
- Modify: `src/websocket/handlers/user.ts:68-75`
- Modify: `tests/integration/explain-this.test.ts:130-136,166-176`

**Step 1: Update Zod schema**

In `src/api-client/schemas.ts`, add `title` to `explainThisSchema`:

```ts
export const explainThisSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  phaseConnection: z.string().optional(),
});
```

**Step 2: Update ExplainResult type and return**

In `src/ui-apis/explain.ts`, add `title` to `ExplainResult`:

```ts
export interface ExplainResult {
  title: string;
  explanation: string;
  phaseConnection: string | null;
}
```

Update the system prompt response format (end of `buildSystemPrompt`):

```ts
  prompt +=
    '\n\nRespond with a JSON object containing:\n' +
    '- "title": A short title (max 50 characters) summarizing what the selected code does.\n' +
    '- "explanation": A clear explanation of the selected code.\n' +
    '- "phaseConnection": (optional) How this code relates to the current coaching phase, or omit if not relevant.';
```

Update the return in `handleExplainThis`:

```ts
  return {
    title: response.title,
    explanation: response.explanation,
    phaseConnection: response.phaseConnection ?? null,
  };
```

**Step 3: Update ExplainResponseData type**

In `src/types/websocket.ts`, add `title`:

```ts
export interface ExplainResponseData {
  readonly title: string;
  readonly explanation: string;
  readonly phaseConnection?: string | undefined;
}
```

**Step 4: Update broadcast payload**

In `src/websocket/handlers/user.ts`, add `title` to the broadcast:

```ts
      broadcast({
        type: 'explain:response',
        data: {
          title: result.title,
          explanation: result.explanation,
          phaseConnection: result.phaseConnection ?? undefined,
        },
      });
```

**Step 5: Update integration tests**

In `tests/integration/explain-this.test.ts`, add `title` to `defaultApiResponse`:

```ts
function defaultApiResponse() {
  return {
    title: 'Debounce utility function',
    explanation: 'This is a debounce function that delays execution until a pause in calls.',
    phaseConnection:
      'This relates to the current phase where you are implementing core utility logic.',
  };
}
```

Update test 1 to assert `title`:

```ts
  it('returns explanation for selected code', async () => {
    const result = await handleExplainThis(defaultExplainData(), SESSION_ID);

    expect(result).toBeDefined();
    expect(result.title).toBe('Debounce utility function');
    expect(result.explanation).toBe(
      'This is a debounce function that delays execution until a pause in calls.',
    );
    expect(result.phaseConnection).toBe(
      'This relates to the current phase where you are implementing core utility logic.',
    );
  });
```

Update tests 4, 5, 6 mock responses to include `title`:
- Test 4: add `title: 'Debounce utility'`
- Test 5: add `title: 'Debounce function'`
- Test 6: add `title: 'Debounce function'`

**Step 6: Run tests and typecheck**

Run: `npx vitest run tests/integration/explain-this.test.ts`
Expected: 11 tests pass

Run: `npx tsc --noEmit`
Expected: clean (only the pre-existing InProgress.tsx warning)

**Step 7: Commit**

```
git add src/api-client/schemas.ts src/ui-apis/explain.ts src/types/websocket.ts src/websocket/handlers/user.ts tests/integration/explain-this.test.ts
git commit -m "feat: add title field to explain API response"
```

---

### Task 2: Frontend — Remove toast handlers from useCoachingMessages

**Files:**
- Modify: `electron-ui/renderer/src/hooks/useCoachingMessages.ts:118-135,144-150`

**Step 1: Remove explain subscriptions**

Remove the `explain:response` and `explain:error` subscription blocks (lines 118-135) and their cleanup calls in the return (lines 147-148).

The result should go from:

```ts
    // Explain This responses: show as info toast
    const unsubExplainResponse = on('explain:response', ...);
    const unsubExplainError = on('explain:error', ...);

    // Phase transition: ...

    return () => {
      unsubMessage();
      unsubClear();
      unsubExplainResponse();
      unsubExplainError();
      unsubPhaseTransition();
    };
```

To:

```ts
    // Phase transition: ...

    return () => {
      unsubMessage();
      unsubClear();
      unsubPhaseTransition();
    };
```

**Step 2: Typecheck**

Run: `cd electron-ui && npx tsc --noEmit`
Expected: clean

**Step 3: Commit**

```
git add electron-ui/renderer/src/hooks/useCoachingMessages.ts
git commit -m "refactor: remove explain toast handlers from useCoachingMessages"
```

---

### Task 3: Frontend — Create ExplanationsPanel component

**Files:**
- Create: `electron-ui/renderer/src/components/Sidebar/ExplanationsPanel.tsx`

**Step 1: Create the component file**

```tsx
/**
 * ExplanationsPanel — accordion list of code explanations.
 *
 * Each entry shows a title row with a chevron. Clicking a title expands
 * its body and collapses any other open entry. Only one entry can be
 * expanded at a time.
 *
 * A loading skeleton is shown at the top when an explain request is
 * in flight. An empty state is shown when no explanations exist.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExplanationEntry {
  id: string;
  title: string;
  explanation: string;
  phaseConnection?: string;
  timestamp: number;
}

interface ExplanationsPanelProps {
  explanations: ExplanationEntry[];
  loading: boolean;
  expandedId: string | null;
  onToggle: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-muted)',
  textAlign: 'center',
  padding: 'var(--space-md)',
};

const itemStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border-subtle)',
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: 'var(--space-xs) var(--space-md)',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  fontWeight: 500,
  color: 'var(--text-primary)',
};

const chevronStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-muted)',
  flexShrink: 0,
  transition: 'transform 0.15s ease',
};

const titleTextStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
};

const bodyStyle: React.CSSProperties = {
  padding: '0 var(--space-md) var(--space-sm)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
};

const phaseConnectionStyle: React.CSSProperties = {
  marginTop: 'var(--space-xs)',
  color: 'var(--text-muted)',
  fontStyle: 'italic',
};

// Skeleton styles
const skeletonItemStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-md)',
  borderBottom: '1px solid var(--border-subtle)',
};

const skeletonBarBase: React.CSSProperties = {
  borderRadius: '4px',
  animation: 'skeleton-pulse 1.2s ease-in-out infinite',
};

const skeletonTitleStyle: React.CSSProperties = {
  ...skeletonBarBase,
  height: '14px',
  width: '60%',
  background: 'var(--bg-inset)',
};

const skeletonBodyStyle: React.CSSProperties = {
  ...skeletonBarBase,
  height: '48px',
  width: '100%',
  marginTop: 'var(--space-xs)',
  background: 'var(--bg-inset)',
};

// ---------------------------------------------------------------------------
// Skeleton keyframes injection
// ---------------------------------------------------------------------------

const SKELETON_STYLE_ID = 'paige-skeleton-pulse';

function ensureSkeletonStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SKELETON_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = SKELETON_STYLE_ID;
  style.textContent = `
    @keyframes skeleton-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExplanationsPanel({
  explanations,
  loading,
  expandedId,
  onToggle,
}: ExplanationsPanelProps): React.ReactElement {
  ensureSkeletonStyles();

  // Empty state (no loading, no items)
  if (!loading && explanations.length === 0) {
    return (
      <div style={emptyStateStyle}>
        Select code and click Explain
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* Loading skeleton */}
      {loading && (
        <div style={skeletonItemStyle}>
          <div style={skeletonTitleStyle} />
          <div style={skeletonBodyStyle} />
        </div>
      )}

      {/* Explanation items */}
      {explanations.map((entry) => {
        const isExpanded = expandedId === entry.id;
        return (
          <div key={entry.id} style={itemStyle}>
            <button
              type="button"
              style={titleRowStyle}
              onClick={() => onToggle(entry.id)}
              aria-expanded={isExpanded}
            >
              <span
                style={{
                  ...chevronStyle,
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                &#x25B6;
              </span>
              <span style={titleTextStyle}>{entry.title}</span>
            </button>
            {isExpanded && (
              <div style={bodyStyle}>
                {entry.explanation}
                {entry.phaseConnection && (
                  <div style={phaseConnectionStyle}>
                    Phase connection: {entry.phaseConnection}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Typecheck**

Run: `cd electron-ui && npx tsc --noEmit`
Expected: clean

**Step 3: Commit**

```
git add electron-ui/renderer/src/components/Sidebar/ExplanationsPanel.tsx
git commit -m "feat: add ExplanationsPanel accordion component"
```

---

### Task 4: Frontend — Add tab bar and explanations state to CoachingSidebar

**Files:**
- Modify: `electron-ui/renderer/src/components/Sidebar/Sidebar.tsx`

**Step 1: Add imports and types**

Add import for `ExplanationsPanel` and its `ExplanationEntry` type:

```ts
import { ExplanationsPanel } from './ExplanationsPanel';
import type { ExplanationEntry } from './ExplanationsPanel';
```

Add tab type:

```ts
type SidebarTab = 'issue' | 'explanations';
```

**Step 2: Add tab bar styles**

Add these style constants alongside the existing style declarations:

```ts
const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
};

const tabButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-xs) var(--space-sm)',
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  fontWeight: 500,
  cursor: 'pointer',
  color: 'var(--text-muted)',
  transition: 'color 0.15s ease, border-color 0.15s ease',
};

const tabButtonActiveStyle: React.CSSProperties = {
  ...tabButtonStyle,
  color: 'var(--text-primary)',
  borderBottomColor: 'var(--accent-primary, #d97757)',
};
```

**Step 3: Add new props**

Update `CoachingSidebarProps`:

```ts
interface CoachingSidebarProps {
  initialIssueContext?: IssueContext | null;
  initialPhases?: Phase[] | null;
  onNavigate?: (view: AppView) => void;
  onExplainRequested?: () => void; // NOT USED HERE — sidebar exposes its own callback
}
```

Wait — per the design, IDE calls `onExplainRequested` on the sidebar. The sidebar needs to expose this. The cleanest approach: add the prop and have the parent call it. But actually, the sidebar needs to react (switch tab, show loading). So the prop should be a signal FROM the parent.

Actually, re-reading the design: "IDE.tsx's handleExplain also calls a new onExplainRequested callback prop on CoachingSidebar." This means IDE calls a function that CoachingSidebar exposes. Since React components can't expose imperative methods without `useImperativeHandle`, the simpler pattern is: pass `explanationLoading` trigger from IDE as a prop, or use a callback that IDE calls.

Simplest: add an `explainRequested` boolean prop that IDE flips to true when explain is clicked. Sidebar watches it via useEffect.

Even simpler: just pass an `explainRequestCount` number prop. Each click increments it. Sidebar useEffect reacts to changes.

```ts
interface CoachingSidebarProps {
  initialIssueContext?: IssueContext | null;
  initialPhases?: Phase[] | null;
  onNavigate?: (view: AppView) => void;
  explainRequestCount?: number;
}
```

**Step 4: Add state variables**

Inside `CoachingSidebar`, add after existing state:

```ts
  // ---- Explanations state ---------------------------------------------------

  const [activeTab, setActiveTab] = useState<SidebarTab>('issue');
  const [explanations, setExplanations] = useState<ExplanationEntry[]>([]);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [expandedExplanationId, setExpandedExplanationId] = useState<string | null>(null);
```

**Step 5: Add effect to react to explain requests**

```ts
  // ---- React to explain requests from IDE ----------------------------------

  useEffect(() => {
    if (!explainRequestCount || explainRequestCount === 0) return;
    setActiveTab('explanations');
    setExplanationLoading(true);
    setExpandedExplanationId(null);
  }, [explainRequestCount]);
```

**Step 6: Add WebSocket subscriptions for explain:response and explain:error**

Inside the existing `useEffect` that handles WebSocket subscriptions, add:

```ts
    const unsubExplainResponse = on('explain:response', (msg: WebSocketMessage) => {
      const { payload } = msg as unknown as {
        payload: { title: string; explanation: string; phaseConnection?: string };
      };
      const newId = `explain-${Date.now()}`;
      const entry: ExplanationEntry = {
        id: newId,
        title: payload.title,
        explanation: payload.explanation,
        phaseConnection: payload.phaseConnection,
        timestamp: Date.now(),
      };
      setExplanations((prev) => [entry, ...prev]);
      setExplanationLoading(false);
      setExpandedExplanationId(newId);
    });

    const unsubExplainError = on('explain:error', (msg: WebSocketMessage) => {
      const { payload } = msg as unknown as { payload: { error: string } };
      const newId = `explain-err-${Date.now()}`;
      const entry: ExplanationEntry = {
        id: newId,
        title: 'Explain failed',
        explanation: payload.error,
        timestamp: Date.now(),
      };
      setExplanations((prev) => [entry, ...prev]);
      setExplanationLoading(false);
      setExpandedExplanationId(newId);
    });
```

Add cleanup in the return:

```ts
      unsubExplainResponse();
      unsubExplainError();
```

Update `session:end` handler to also clear explanations:

```ts
    const unsubEnd = on('session:end', () => {
      setIssueContext(null);
      setPhases(null);
      setReviewResult(null);
      setCommitState('idle');
      setExplanations([]);
      setExplanationLoading(false);
      setExpandedExplanationId(null);
      setActiveTab('issue');
    });
```

**Step 7: Add toggle handler**

```ts
  const handleToggleExplanation = useCallback((id: string) => {
    setExpandedExplanationId((prev) => (prev === id ? null : id));
  }, []);
```

**Step 8: Replace dashboard back link with tab bar in JSX**

Remove the `{/* Back to dashboard link */}` button block (lines 547-560).

Replace with:

```tsx
      {/* Tab bar */}
      <div style={tabBarStyle}>
        <button
          type="button"
          style={activeTab === 'issue' ? tabButtonActiveStyle : tabButtonStyle}
          onClick={() => setActiveTab('issue')}
        >
          Issue Detail
        </button>
        <button
          type="button"
          style={activeTab === 'explanations' ? tabButtonActiveStyle : tabButtonStyle}
          onClick={() => setActiveTab('explanations')}
        >
          Explanations
        </button>
      </div>
```

**Step 9: Wrap existing content in tab conditional**

The existing content between IssueContextDisplay and the end of the scrollable area should only show when `activeTab === 'issue'`. The Explanations tab content replaces it.

Replace the scrollable content area:

```tsx
      {activeTab === 'issue' ? (
        <>
          {/* Issue context */}
          <IssueContextDisplay issueContext={issueContext} />

          {/* Scrollable content area for hint controls + phase stepper + review */}
          <div style={scrollableAreaStyle}>
            {/* ...all existing content (HintSlider, PhaseStepper, review controls, ReviewResults)... */}
          </div>
        </>
      ) : (
        <div style={scrollableAreaStyle}>
          <ExplanationsPanel
            explanations={explanations}
            loading={explanationLoading}
            expandedId={expandedExplanationId}
            onToggle={handleToggleExplanation}
          />
        </div>
      )}
```

Note: IssueContextDisplay moves inside the `issue` tab branch since the tab bar replaces the top area.

**Step 10: Remove backLinkStyle and handleBackToDashboard**

Delete the `backLinkStyle` constant and the `handleBackToDashboard` callback function. Keep the `SaveDiscardModal` and its handlers since `git:exit_complete` still uses `onNavigate('dashboard')`.

**Step 11: Typecheck**

Run: `cd electron-ui && npx tsc --noEmit`
Expected: clean

**Step 12: Commit**

```
git add electron-ui/renderer/src/components/Sidebar/Sidebar.tsx
git commit -m "feat: add tab bar and explanations panel to coaching sidebar"
```

---

### Task 5: Frontend — Wire explainRequestCount from IDE to Sidebar

**Files:**
- Modify: `electron-ui/renderer/src/views/IDE.tsx:246-251,414-418`

**Step 1: Add explainRequestCount state**

In `IDE`, add state:

```ts
  const [explainRequestCount, setExplainRequestCount] = useState(0);
```

**Step 2: Update handleExplain to increment counter**

```ts
  const handleExplain = useCallback(
    (payload: ExplainPayload) => {
      void send('user:explain', payload);
      setExplainRequestCount((c) => c + 1);
    },
    [send]
  );
```

**Step 3: Pass prop to CoachingSidebar**

```tsx
          <CoachingSidebar
            initialIssueContext={initialIssueContext}
            initialPhases={initialPhases}
            onNavigate={onNavigate}
            explainRequestCount={explainRequestCount}
          />
```

**Step 4: Typecheck**

Run: `cd electron-ui && npx tsc --noEmit`
Expected: clean

**Step 5: Commit**

```
git add electron-ui/renderer/src/views/IDE.tsx
git commit -m "feat: wire explain requests from editor to sidebar"
```

---

### Task 6: Final verification

**Step 1: Run backend tests**

Run: `npx vitest run tests/integration/explain-this.test.ts`
Expected: 11 tests pass

**Step 2: Run full backend typecheck**

Run: `npx tsc --noEmit`
Expected: clean

**Step 3: Run frontend typecheck**

Run: `cd electron-ui && npx tsc --noEmit`
Expected: clean (only pre-existing InProgress.tsx warning)

**Step 4: Run frontend lint**

Run: `cd electron-ui && npm run lint`
Expected: clean or only pre-existing warnings
