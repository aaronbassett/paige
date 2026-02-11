/**
 * IDE — Five-panel IDE layout for coaching sessions.
 *
 * Layout:
 *   - Left sidebar: File Explorer (220px, collapsible to 32px)
 *   - Center top: Editor area (flex, 70% height)
 *   - Center: Status bar (32px)
 *   - Center bottom: Terminal area (30% height)
 *   - Right sidebar: Coaching Sidebar (280px, collapsible to 32px)
 *
 * Sidebars collapse independently with Framer Motion spring animations.
 * Auto-collapses sidebars at <800px width, hides terminal at <500px height.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { AppView } from '@shared/types/entities';

/** Spring preset: balanced, general-purpose */
const SPRING_STANDARD = { stiffness: 300, damping: 28 };

interface IDEProps {
  onNavigate: (view: AppView, context?: { issueNumber?: number }) => void;
}

const SIDEBAR_LEFT_EXPANDED = 220;
const SIDEBAR_LEFT_COLLAPSED = 32;
const SIDEBAR_RIGHT_EXPANDED = 280;
const SIDEBAR_RIGHT_COLLAPSED = 32;
const AUTO_COLLAPSE_WIDTH = 800;
const AUTO_HIDE_TERMINAL_HEIGHT = 500;

const panelLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-muted)',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family), monospace',
  userSelect: 'none',
};

const collapseButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  cursor: 'pointer',
  padding: '4px 6px',
  lineHeight: 1,
};

const sidebarHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 var(--space-xs)',
  height: 'var(--status-bar-height)',
  borderBottom: '1px solid var(--border-subtle)',
};

const statusBarStyle: React.CSSProperties = {
  height: 'var(--status-bar-height)',
  background: 'var(--bg-surface)',
  borderTop: '1px solid var(--border-subtle)',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 var(--space-sm)',
  color: 'var(--text-muted)',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family), monospace',
};

export function IDE({ onNavigate: _onNavigate }: IDEProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(
    () => window.innerWidth < AUTO_COLLAPSE_WIDTH,
  );
  const [rightCollapsed, setRightCollapsed] = useState(
    () => window.innerWidth < AUTO_COLLAPSE_WIDTH,
  );
  const [terminalHidden, setTerminalHidden] = useState(
    () => window.innerHeight < AUTO_HIDE_TERMINAL_HEIGHT,
  );

  const handleResize = useCallback(() => {
    const { innerWidth, innerHeight } = window;
    setLeftCollapsed(innerWidth < AUTO_COLLAPSE_WIDTH);
    setRightCollapsed(innerWidth < AUTO_COLLAPSE_WIDTH);
    setTerminalHidden(innerHeight < AUTO_HIDE_TERMINAL_HEIGHT);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const leftWidth = leftCollapsed ? SIDEBAR_LEFT_COLLAPSED : SIDEBAR_LEFT_EXPANDED;
  const rightWidth = rightCollapsed ? SIDEBAR_RIGHT_COLLAPSED : SIDEBAR_RIGHT_EXPANDED;

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      {/* Left Sidebar: File Explorer */}
      <motion.div
        style={{
          height: '100%',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
        animate={{ width: leftWidth }}
        transition={{ type: 'spring', ...SPRING_STANDARD }}
      >
        <div style={sidebarHeaderStyle}>
          {!leftCollapsed && (
            <span
              style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-small-size)',
                fontFamily: 'var(--font-family), monospace',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Explorer
            </span>
          )}
          <button
            style={collapseButtonStyle}
            onClick={() => setLeftCollapsed((prev) => !prev)}
            aria-label={leftCollapsed ? 'Expand file explorer' : 'Collapse file explorer'}
            title={leftCollapsed ? 'Expand' : 'Collapse'}
          >
            {leftCollapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>
        {!leftCollapsed && (
          <div style={panelLabelStyle}>File Explorer</div>
        )}
      </motion.div>

      {/* Center: Editor + Status Bar + Terminal */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Editor area */}
        <div
          style={{
            flex: terminalHidden ? 1 : 7,
            background: 'var(--bg-inset)',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div style={panelLabelStyle}>Editor</div>
        </div>

        {/* Status bar */}
        <div style={statusBarStyle}>
          <span>Ready</span>
        </div>

        {/* Terminal area */}
        {!terminalHidden && (
          <div
            style={{
              flex: 3,
              background: 'var(--bg-inset)',
              borderTop: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            <div style={panelLabelStyle}>Terminal</div>
          </div>
        )}
      </div>

      {/* Right Sidebar: Coaching */}
      <motion.div
        style={{
          height: '100%',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
        animate={{ width: rightWidth }}
        transition={{ type: 'spring', ...SPRING_STANDARD }}
      >
        <div style={sidebarHeaderStyle}>
          <button
            style={collapseButtonStyle}
            onClick={() => setRightCollapsed((prev) => !prev)}
            aria-label={rightCollapsed ? 'Expand coaching sidebar' : 'Collapse coaching sidebar'}
            title={rightCollapsed ? 'Expand' : 'Collapse'}
          >
            {rightCollapsed ? '\u25C0' : '\u25B6'}
          </button>
          {!rightCollapsed && (
            <span
              style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-small-size)',
                fontFamily: 'var(--font-family), monospace',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Coaching
            </span>
          )}
        </div>
        {!rightCollapsed && (
          <div style={panelLabelStyle}>Coaching Sidebar</div>
        )}
      </motion.div>
    </div>
  );
}
