/**
 * StatusBar -- 32px status bar at the bottom of the editor area.
 *
 * Shows file info (breadcrumb, cursor position, language).
 *
 * Subscribes to the singleton editorState service for live tab/cursor updates.
 * When no tab is open, displays "Ready" with no file-specific info.
 */

import { useState, useEffect } from 'react';
import { editorState } from '../../services/editor-state';
import type { TabState } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatusBarProps {}

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
 * capitalizeLanguage('typescript') // => 'Typescript'
 * // We only capitalize the first letter; language names follow Monaco convention.
 */
function capitalizeLanguage(language: string): string {
  if (language.length === 0) return language;
  return language.charAt(0).toUpperCase() + language.slice(1);
}

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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StatusBar(_props: StatusBarProps) {
  const [activeTab, setActiveTab] = useState<TabState | undefined>(() =>
    editorState.getActiveTab()
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
    </footer>
  );
}
