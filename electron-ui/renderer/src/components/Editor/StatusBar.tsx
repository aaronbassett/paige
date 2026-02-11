/**
 * StatusBar — 32px status bar at the bottom of the editor area.
 *
 * Shows file info (breadcrumb, cursor position, language) and provides
 * a "Review My Work" split button with a dropdown for different review scopes.
 *
 * Subscribes to the singleton editorState service for live tab/cursor updates.
 * When no tab is open, displays "Ready" with no file-specific info.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { editorState } from '../../services/editor-state';
import type { TabState } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Review scope passed to the onReview callback. */
type ReviewScope = 'current' | 'file' | 'last_review' | 'last_phase' | 'issue_start';

export interface StatusBarProps {
  onReview?: (scope: ReviewScope) => void;
  /** Whether a review is currently active (transforms the right side to nav controls). */
  reviewActive?: boolean;
  /** Zero-based index of the currently focused review comment. */
  reviewCurrentIndex?: number;
  /** Total number of review comments. */
  reviewTotal?: number;
  /** Navigate to the next review comment. */
  onReviewNext?: () => void;
  /** Navigate to the previous review comment. */
  onReviewPrevious?: () => void;
  /** Exit review mode. */
  onReviewExit?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a file path as a breadcrumb string.
 * Takes the last 3 segments and joins them with " > ".
 *
 * @example
 * formatBreadcrumb('/home/user/project/src/components/Editor.tsx')
 * // => 'src > components > Editor.tsx'
 *
 * formatBreadcrumb('/short/File.tsx')
 * // => 'short > File.tsx'
 */
function formatBreadcrumb(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const tail = segments.slice(-3);
  return tail.join(' > ');
}

/**
 * Capitalize the first letter of a language string.
 *
 * @example
 * capitalizeLanguage('typescript') // => 'TypeScript' — nope, just 'Typescript'
 * // We only capitalize the first letter; language names follow Monaco convention.
 */
function capitalizeLanguage(language: string): string {
  if (language.length === 0) return language;
  return language.charAt(0).toUpperCase() + language.slice(1);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Dropdown options for the split button. */
const REVIEW_OPTIONS: ReadonlyArray<{ label: string; scope: ReviewScope }> = [
  { label: 'Review File', scope: 'file' },
  { label: 'Since Last Review', scope: 'last_review' },
  { label: 'Since Last Phase', scope: 'last_phase' },
  { label: 'Since Issue Start', scope: 'issue_start' },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const barStyle: React.CSSProperties = {
  height: 'var(--status-bar-height, 32px)',
  minHeight: 'var(--status-bar-height, 32px)',
  background: 'var(--bg-surface)',
  borderTop: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 8px',
  fontSize: 'var(--font-small-size, 12px)',
  fontFamily: 'var(--font-family, monospace), monospace',
  color: 'var(--text-muted)',
  userSelect: 'none',
};

const leftSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  minWidth: 0,
  overflow: 'hidden',
};

const breadcrumbStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const cursorStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
};

const languageStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};

const readyStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
};

// Split button styles

const splitButtonContainerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'stretch',
  flexShrink: 0,
};

const mainButtonStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRight: 'none',
  borderRadius: '4px 0 0 4px',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family, monospace), monospace',
  fontSize: 'var(--font-small-size, 12px)',
  padding: '2px 8px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  lineHeight: '1.4',
};

const caretButtonStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderLeft: '1px solid var(--border-subtle)',
  borderRadius: '0 4px 4px 0',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family, monospace), monospace',
  fontSize: 'var(--font-small-size, 12px)',
  padding: '2px 4px',
  cursor: 'pointer',
  lineHeight: '1.4',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  right: 0,
  marginBottom: '4px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '4px',
  boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.3)',
  zIndex: 100,
  minWidth: '160px',
  overflow: 'hidden',
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 12px',
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family, monospace), monospace',
  fontSize: 'var(--font-small-size, 12px)',
  textAlign: 'left',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Styles for review navigation buttons. */
const navButtonStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '3px',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family, monospace), monospace',
  fontSize: 'var(--font-small-size, 12px)',
  padding: '1px 6px',
  cursor: 'pointer',
  lineHeight: '1.4',
};

/** Review navigation controls shown when a review is active. */
function ReviewNavigation({
  currentIndex,
  total,
  onNext,
  onPrevious,
  onExit,
}: {
  currentIndex: number;
  total: number;
  onNext: () => void;
  onPrevious: () => void;
  onExit: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Previous comment"
        style={navButtonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-base)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
        }}
      >
        {'\u25C0'}
      </button>
      <span
        style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--font-small-size, 12px)',
        }}
      >
        {currentIndex + 1}/{total}
      </span>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next comment"
        style={navButtonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-base)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
        }}
      >
        {'\u25B6'}
      </button>
      <button
        type="button"
        onClick={onExit}
        aria-label="Exit review"
        style={navButtonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-base)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
        }}
      >
        {'\u2715'}
      </button>
    </div>
  );
}

/** Split button with main action and dropdown caret. */
function ReviewSplitButton({ onReview }: { onReview?: (scope: ReviewScope) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMainClick = useCallback(() => {
    onReview?.('current');
  }, [onReview]);

  const handleCaretClick = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleOptionClick = useCallback(
    (scope: ReviewScope) => {
      onReview?.(scope);
      setIsOpen(false);
    },
    [onReview],
  );

  return (
    <div ref={containerRef} style={splitButtonContainerStyle}>
      <button
        type="button"
        style={mainButtonStyle}
        onClick={handleMainClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-base)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
        }}
        aria-label="Review my work"
      >
        Review My Work
      </button>

      <button
        type="button"
        style={caretButtonStyle}
        onClick={handleCaretClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-base)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-elevated)';
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Review options"
      >
        {'\u25BE'}
      </button>

      {isOpen && (
        <div style={dropdownStyle} role="menu" aria-label="Review scope options">
          {REVIEW_OPTIONS.map(({ label, scope }) => (
            <button
              key={scope}
              type="button"
              role="menuitem"
              style={dropdownItemStyle}
              onClick={() => handleOptionClick(scope)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StatusBar({
  onReview,
  reviewActive,
  reviewCurrentIndex,
  reviewTotal,
  onReviewNext,
  onReviewPrevious,
  onReviewExit,
}: StatusBarProps) {
  const [activeTab, setActiveTab] = useState<TabState | undefined>(() =>
    editorState.getActiveTab(),
  );

  useEffect(() => {
    const unsubscribe = editorState.subscribe(() => {
      setActiveTab(editorState.getActiveTab());
    });
    return unsubscribe;
  }, []);

  const line = activeTab?.cursorPosition?.line ?? 1;
  const column = activeTab?.cursorPosition?.column ?? 1;

  return (
    <footer style={barStyle} role="status" aria-label="Editor status bar">
      <div style={leftSectionStyle}>
        {activeTab ? (
          <>
            <span style={breadcrumbStyle} title={activeTab.path}>
              {formatBreadcrumb(activeTab.path)}
            </span>

            <span style={cursorStyle}>
              Ln {line}, Col {column}
            </span>

            <span style={languageStyle}>{capitalizeLanguage(activeTab.language)}</span>
          </>
        ) : (
          <span style={readyStyle}>Ready</span>
        )}
      </div>

      {reviewActive ? (
        <ReviewNavigation
          currentIndex={reviewCurrentIndex ?? 0}
          total={reviewTotal ?? 0}
          onNext={onReviewNext ?? (() => {})}
          onPrevious={onReviewPrevious ?? (() => {})}
          onExit={onReviewExit ?? (() => {})}
        />
      ) : (
        <ReviewSplitButton onReview={onReview} />
      )}
    </footer>
  );
}
