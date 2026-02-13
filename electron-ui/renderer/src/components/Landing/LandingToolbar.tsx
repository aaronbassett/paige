/**
 * LandingToolbar -- Search, language filter, and sort controls for the repo list.
 *
 * Provides:
 * - A search input that filters repos by name/description
 * - A language dropdown populated from fetched repos
 * - A sort dropdown with 4 options (Recently used, Last updated, Name, Issue count)
 *
 * All filtering and sorting happens client-side. Dropdowns use floating-ui
 * for collision-aware positioning.
 */

import { useState, useRef, useCallback, memo } from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';

export type SortOption = 'recently_used' | 'last_updated' | 'name' | 'issue_count';

const SORT_LABELS: Record<SortOption, string> = {
  recently_used: 'Recently used',
  last_updated: 'Last updated',
  name: 'Name',
  issue_count: 'Issue count',
};

interface LandingToolbarProps {
  /** Current search query. */
  searchQuery: string;
  /** Callback when search query changes. */
  onSearchChange: (query: string) => void;
  /** Currently selected language filter (empty = all). */
  selectedLanguage: string;
  /** Callback when language filter changes. */
  onLanguageChange: (language: string) => void;
  /** List of unique languages extracted from repos. */
  languages: string[];
  /** Current sort option. */
  sortBy: SortOption;
  /** Callback when sort changes. */
  onSortChange: (sort: SortOption) => void;
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-sm)',
  alignItems: 'center',
  marginBottom: 'var(--space-md)',
  flexWrap: 'wrap',
};

const searchInputStyle: React.CSSProperties = {
  flex: '1 1 240px',
  minWidth: '200px',
  padding: '8px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-body-size)',
  outline: 'none',
};

const dropdownButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  whiteSpace: 'nowrap',
};

const dropdownPanelStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  padding: '4px 0',
  minWidth: '160px',
  maxHeight: '280px',
  overflowY: 'auto',
  zIndex: 100,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
};

const dropdownItemStyle: React.CSSProperties = {
  padding: '6px 14px',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  whiteSpace: 'nowrap',
  background: 'none',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const dropdownItemActiveStyle: React.CSSProperties = {
  ...dropdownItemStyle,
  color: 'var(--accent-primary)',
};

const chevronStyle: React.CSSProperties = {
  fontSize: '10px',
  opacity: 0.6,
};

/* -------------------------------------------------------------------------- */
/*  Language color dot                                                         */
/* -------------------------------------------------------------------------- */

/** GitHub-style language color mapping for common languages. */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Rust: '#dea584',
  Go: '#00add8',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4f5d95',
  Swift: '#f05138',
  Kotlin: '#a97bff',
  Scala: '#c22d40',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Dart: '#00b4ab',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Lua: '#000080',
  Zig: '#ec915c',
  Nix: '#7e7eff',
  Vue: '#41b883',
};

export function getLanguageColor(language: string): string {
  return LANGUAGE_COLORS[language] ?? '#a89c8c';
}

function LanguageDot({ language }: { language: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: getLanguageColor(language),
        flexShrink: 0,
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Generic dropdown                                                           */
/* -------------------------------------------------------------------------- */

interface DropdownProps {
  label: string;
  children: React.ReactNode;
}

function Dropdown({ label, children }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-start',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  return (
    <>
      <button
        ref={refs.setReference}
        style={dropdownButtonStyle}
        {...getReferenceProps()}
      >
        {label}
        <span style={chevronStyle}>{isOpen ? '\u25B2' : '\u25BC'}</span>
      </button>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, ...dropdownPanelStyle }}
            {...getFloatingProps()}
            onClick={() => setIsOpen(false)}
          >
            {children}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  LandingToolbar                                                             */
/* -------------------------------------------------------------------------- */

export const LandingToolbar = memo(function LandingToolbar({
  searchQuery,
  onSearchChange,
  selectedLanguage,
  onLanguageChange,
  languages,
  sortBy,
  onSortChange,
}: LandingToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
    },
    [onSearchChange]
  );

  const languageLabel = selectedLanguage || 'All languages';
  const sortLabel = SORT_LABELS[sortBy];

  return (
    <div style={toolbarStyle}>
      <input
        ref={searchRef}
        type="text"
        placeholder="Search repositories..."
        value={searchQuery}
        onChange={handleSearchInput}
        style={searchInputStyle}
        aria-label="Search repositories"
      />

      {/* Language filter dropdown */}
      <Dropdown label={languageLabel}>
        <button
          style={selectedLanguage === '' ? dropdownItemActiveStyle : dropdownItemStyle}
          onClick={() => onLanguageChange('')}
        >
          All languages
        </button>
        {languages.map((lang) => (
          <button
            key={lang}
            style={selectedLanguage === lang ? dropdownItemActiveStyle : dropdownItemStyle}
            onClick={() => onLanguageChange(lang)}
          >
            <LanguageDot language={lang} />
            {lang}
          </button>
        ))}
      </Dropdown>

      {/* Sort dropdown */}
      <Dropdown label={`Sort: ${sortLabel}`}>
        {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
          <button
            key={option}
            style={sortBy === option ? dropdownItemActiveStyle : dropdownItemStyle}
            onClick={() => onSortChange(option)}
          >
            {SORT_LABELS[option]}
          </button>
        ))}
      </Dropdown>
    </div>
  );
});
