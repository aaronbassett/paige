/**
 * ActivityLog -- Scrollable log of planning agent activity.
 *
 * Displays a rolling feed of log entries emitted by the planning agent
 * during its four-phase pipeline. Each entry shows the message with an
 * optional tool name prefix. The container auto-scrolls to the bottom
 * whenever new entries arrive, so the user always sees the latest
 * activity without manual scrolling.
 *
 * When no entries exist, a placeholder message is shown indicating the
 * agent has not yet started.
 *
 * Used on the planning loading screen alongside the ProgressBar.
 */

import React, { useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LogEntry } from '../../hooks/usePlanningProgress';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityLogProps {
  /** Rolling log of tool-use entries from the planning agent. */
  logs: LogEntry[];
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  maxHeight: '200px',
  overflowY: 'auto',
  background: 'var(--bg-inset, #1a1a1a)',
  borderRadius: '6px',
  padding: '12px',
  fontFamily: 'var(--font-family, monospace)',
  fontSize: '12px',
  lineHeight: '1.6',
  color: 'var(--text-secondary, #999)',
  width: '100%',
  maxWidth: '600px',
};

const emptyStyle: React.CSSProperties = {
  color: 'var(--text-muted, #666)',
  fontStyle: 'italic',
};

const entryStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  alignItems: 'baseline',
};

const bulletStyle: React.CSSProperties = {
  color: 'var(--accent-primary, #d97757)',
  flexShrink: 0,
  userSelect: 'none',
};

const toolNameStyle: React.CSSProperties = {
  color: 'var(--accent-primary, #d97757)',
  fontWeight: 600,
};

const messageStyle: React.CSSProperties = {
  color: 'var(--text-secondary, #999)',
  wordBreak: 'break-word',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityLog({ logs }: ActivityLogProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div
      ref={scrollRef}
      style={containerStyle}
      role="log"
      aria-label="Planning activity log"
    >
      {logs.length === 0 ? (
        <span style={emptyStyle}>Waiting for agent to start...</span>
      ) : (
        <AnimatePresence initial={false}>
          {logs.map((entry, i) => (
            <motion.div
              key={`${entry.timestamp}-${i}`}
              data-testid="log-entry"
              style={entryStyle}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <span style={bulletStyle}>{'>'}</span>
              {entry.toolName && (
                <span style={toolNameStyle}>[{entry.toolName}]</span>
              )}
              <span style={messageStyle}>{entry.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
