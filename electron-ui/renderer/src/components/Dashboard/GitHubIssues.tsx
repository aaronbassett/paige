/**
 * GitHubIssues -- Dashboard section showing scored GitHub issues.
 *
 * Manages its own WebSocket subscriptions:
 *   - `dashboard:issue` -- individual scored issues streamed one at a time
 *   - `dashboard:issues_complete` -- signal that all issues have been sent
 *
 * Features:
 *   - Progressive rendering: issues accumulate into state as they arrive
 *   - Layout toggle: full / condensed / list modes
 *   - Framer Motion entrance animations (fade + slide-up + scale)
 *   - Skeleton placeholders while waiting for the first issue
 *   - Click opens IssueModal with full details
 */

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { ScoredIssue, AppView } from '@shared/types/entities';
import type {
  DashboardSingleIssueMessage,
  WebSocketMessage,
} from '@shared/types/websocket-messages';
import { useWebSocket } from '../../hooks/useWebSocket';
import { IssueCard, type IssueLayoutMode } from './IssueCard';
import { IssueLayoutToggle } from './IssueLayoutToggle';
import { IssueModal } from './IssueModal';

interface GitHubIssuesProps {
  onNavigate: (view: AppView, context?: { issueNumber?: number }) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-sm)',
};

const fullGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gridAutoRows: '180px',
  gap: 'var(--space-md)',
  flex: 1,
  overflowY: 'auto',
};

const condensedGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gridAutoRows: 'min-content',
  gap: 'var(--space-sm)',
  flex: 1,
  overflowY: 'auto',
};

const listContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflowY: 'auto',
};

const skeletonCardStyle: React.CSSProperties = {
  borderRadius: '8px',
  border: '1px solid var(--border-subtle)',
  cursor: 'default',
  height: '80px',
  background: 'var(--bg-elevated)',
  animation: 'breathe 2s ease-in-out infinite',
};

const emptyStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  textAlign: 'center',
  padding: 'var(--space-md)',
};

// ---------------------------------------------------------------------------
// Layout style selector
// ---------------------------------------------------------------------------

function getListStyle(layout: IssueLayoutMode): React.CSSProperties {
  switch (layout) {
    case 'full':
      return fullGridStyle;
    case 'condensed':
      return condensedGridStyle;
    case 'list':
      return listContainerStyle;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GitHubIssues({ onNavigate }: GitHubIssuesProps) {
  const { on } = useWebSocket();

  // Issue accumulation state
  const [issues, setIssues] = useState<ScoredIssue[]>([]);
  const [loading, setLoading] = useState(true);

  // Layout mode state
  const [layout, setLayout] = useState<IssueLayoutMode>('full');

  // Modal state
  const [selectedIssue, setSelectedIssue] = useState<ScoredIssue | null>(null);

  // Subscribe to streaming issue messages
  useEffect(() => {
    // Reset when component mounts (e.g., navigating back to dashboard)
    setIssues([]);
    setLoading(true);

    const unsubs = [
      on('dashboard:issue', (msg: WebSocketMessage) => {
        const m = msg as DashboardSingleIssueMessage;
        setIssues((prev) => {
          // Avoid duplicates by issue number
          if (prev.some((i) => i.number === m.payload.issue.number)) {
            return prev;
          }
          return [...prev, m.payload.issue];
        });
        // First issue arrived, stop showing skeleton
        setLoading(false);
      }),
      on('dashboard:issues_complete', () => {
        setLoading(false);
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [on]);

  const handleIssueClick = useCallback((issue: ScoredIssue) => {
    setSelectedIssue(issue);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedIssue(null);
  }, []);

  return (
    <section style={containerStyle} aria-label="GitHub issues">
      {/* Header with title and layout toggle */}
      <div style={headerRowStyle}>
        <pre className="figlet-header" style={{ fontSize: '18px', margin: 0 }}>
          ISSUES
        </pre>
        <IssueLayoutToggle current={layout} onChange={setLayout} />
      </div>

      {/* Loading state: skeleton placeholders */}
      {loading && issues.length === 0 && (
        <div style={getListStyle(layout)} role="status" aria-label="Loading issues">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{ ...skeletonCardStyle, animationDelay: `${i * 150}ms` }}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* Empty state (loading complete, no issues) */}
      {!loading && issues.length === 0 && <p style={emptyStyle}>No issues found</p>}

      {/* Populated state with progressive rendering */}
      {issues.length > 0 && (
        <div style={getListStyle(layout)}>
          <AnimatePresence mode="popLayout">
            {issues.map((issue, i) => (
              <IssueCard
                key={issue.number}
                issue={issue}
                layout={layout}
                index={i}
                onClick={() => handleIssueClick(issue)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Issue detail modal */}
      <IssueModal issue={selectedIssue} onClose={handleCloseModal} onNavigate={onNavigate} />
    </section>
  );
}
