/**
 * EditorTabs -- Horizontal tab strip above the code editor.
 *
 * Renders one tab per open file with a language icon, filename, and close
 * button. The active tab is highlighted with a terracotta bottom border.
 * Dirty tabs display a dot indicator that swaps to a close button on hover.
 * Closing a dirty tab triggers a confirmation prompt.
 *
 * Overflow is handled with horizontal scrolling and gradient fade indicators
 * that appear at the edges when content is clipped.
 *
 * Subscribes to the singleton {@link editorState} service for tab data
 * and dispatches mutations (setActiveTab, closeTab) through it.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TabState } from '@shared/types/entities';
import { editorState } from '../../services/editor-state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditorTabsProps {
  /** Optional callback when a tab is closed (e.g. to trigger save prompt). */
  onCloseTab?: (path: string) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TAB_HEIGHT = 32;

const stripContainerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'stretch',
  height: TAB_HEIGHT,
  minHeight: TAB_HEIGHT,
  background: 'var(--bg-surface)',
  borderBottom: '1px solid var(--border-subtle)',
  userSelect: 'none',
};

const scrollContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  overflowX: 'auto',
  overflowY: 'hidden',
  flex: 1,
  scrollbarWidth: 'none', // Firefox
};

/**
 * Shared base for left/right fade overlays. Each is a 24px-wide gradient
 * that masks the tab strip edge when content overflows in that direction.
 */
const fadeBaseStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 24,
  pointerEvents: 'none',
  zIndex: 1,
  transition: 'opacity 150ms ease',
};

const fadeLeftStyle: React.CSSProperties = {
  ...fadeBaseStyle,
  left: 0,
  background: 'linear-gradient(to right, var(--bg-surface), transparent)',
};

const fadeRightStyle: React.CSSProperties = {
  ...fadeBaseStyle,
  right: 0,
  background: 'linear-gradient(to left, var(--bg-surface), transparent)',
};

const tabBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: TAB_HEIGHT,
  padding: '0 12px',
  border: 'none',
  borderBottom: '2px solid transparent',
  background: 'var(--bg-surface)',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  lineHeight: 'var(--font-small-line-height)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  outline: 'none',
};

const activeTabOverrides: React.CSSProperties = {
  borderBottom: '2px solid var(--accent-primary)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
};

const iconStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)',
  flexShrink: 0,
};

const closeBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  borderRadius: 3,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: 12,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
};

const closeBtnHoverStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
};

const dirtyDotStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  color: 'var(--accent-primary)',
  fontSize: 14,
  lineHeight: 1,
  flexShrink: 0,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabCloseButton({
  isDirty,
  isTabHovered,
  onClick,
}: {
  isDirty: boolean;
  isTabHovered: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const [isBtnHovered, setIsBtnHovered] = useState(false);

  // Dirty + not hovered: show dot as a button (still clickable for close)
  const showDot = isDirty && !isTabHovered;

  return (
    <button
      type="button"
      style={{
        ...(showDot ? dirtyDotStyle : closeBtnStyle),
        ...(!showDot && isBtnHovered ? closeBtnHoverStyle : undefined),
        // Ensure the dirty dot renders as a button with no default button chrome
        ...(showDot
          ? { background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }
          : undefined),
      }}
      onMouseEnter={() => setIsBtnHovered(true)}
      onMouseLeave={() => setIsBtnHovered(false)}
      onClick={onClick}
      aria-label={showDot ? 'Unsaved changes' : 'Close tab'}
    >
      {showDot ? '\u2022' : '\u00d7'}
    </button>
  );
}

function extractFilename(filePath: string): string {
  const segments = filePath.split('/');
  return segments[segments.length - 1] ?? filePath;
}

interface SingleTabProps {
  tab: TabState;
  isActive: boolean;
  onActivate: (path: string) => void;
  onClose: (path: string, isDirty: boolean) => void;
}

function SingleTab({ tab, isActive, onActivate, onClose }: SingleTabProps) {
  const [isHovered, setIsHovered] = useState(false);
  const filename = extractFilename(tab.path);

  const handleClick = () => {
    onActivate(tab.path);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(tab.path, tab.isDirty);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate(tab.path);
    }
  };

  return (
    <div
      role="tab"
      aria-selected={isActive}
      aria-label={`${filename}${tab.isDirty ? ' (unsaved)' : ''}`}
      tabIndex={isActive ? 0 : -1}
      style={{
        ...tabBaseStyle,
        ...(isActive ? activeTabOverrides : undefined),
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span style={iconStyle}>{tab.icon}</span>
      <span>{filename}</span>
      <TabCloseButton isDirty={tab.isDirty} isTabHovered={isHovered} onClick={handleClose} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overflow detection hook
// ---------------------------------------------------------------------------

interface OverflowState {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

function useScrollOverflow(ref: React.RefObject<HTMLDivElement | null>): OverflowState {
  const [overflow, setOverflow] = useState<OverflowState>({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setOverflow({
      canScrollLeft: scrollLeft > 0,
      canScrollRight: scrollLeft + clientWidth < scrollWidth - 1,
    });
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial check
    update();

    // Listen for scroll events
    el.addEventListener('scroll', update, { passive: true });

    // Re-check on resize (tabs may become overflowed or vice versa)
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', update);
      resizeObserver.disconnect();
    };
  }, [ref, update]);

  return overflow;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EditorTabs({ onCloseTab }: EditorTabsProps) {
  const [tabs, setTabs] = useState<ReadonlyArray<TabState>>(() => editorState.getTabs());
  const [activeTabPath, setActiveTabPath] = useState<string | undefined>(() =>
    editorState.getActiveTabPath()
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { canScrollLeft, canScrollRight } = useScrollOverflow(scrollRef);

  // Subscribe to editor state changes
  useEffect(() => {
    const unsubscribe = editorState.subscribe(() => {
      setTabs(editorState.getTabs());
      setActiveTabPath(editorState.getActiveTabPath());
    });
    return unsubscribe;
  }, []);

  const handleActivate = useCallback((path: string) => {
    editorState.setActiveTab(path);
  }, []);

  const handleClose = useCallback(
    (path: string, isDirty: boolean) => {
      if (isDirty) {
        const filename = extractFilename(path);
        const confirmed = window.confirm(`Discard unsaved changes to ${filename}?`);
        if (!confirmed) return;
      }

      editorState.closeTab(path);
      onCloseTab?.(path);
    },
    [onCloseTab]
  );

  // Don't render the strip when there are no tabs
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div style={stripContainerStyle} role="tablist" aria-label="Open files">
      {/* Left fade indicator */}
      <div style={{ ...fadeLeftStyle, opacity: canScrollLeft ? 1 : 0 }} />

      {/* Scrollable tab container */}
      <div ref={scrollRef} style={scrollContainerStyle}>
        {tabs.map((tab) => (
          <SingleTab
            key={tab.path}
            tab={tab}
            isActive={tab.path === activeTabPath}
            onActivate={handleActivate}
            onClose={handleClose}
          />
        ))}
      </div>

      {/* Right fade indicator */}
      <div style={{ ...fadeRightStyle, opacity: canScrollRight ? 1 : 0 }} />
    </div>
  );
}
