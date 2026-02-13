/**
 * Landing -- Repository picker view (home screen).
 *
 * Shows an ASCII art "PAIGE" banner, a subtitle, and a searchable/filterable
 * list of repositories the user has access to. Clicking a repo row triggers
 * the `onSelectRepo` callback which starts a repo-based session.
 *
 * Data flow:
 * 1. On mount, sends `repos:list` via WebSocket
 * 2. Listens for `repos:list_response` to populate the repo list
 * 3. For visible repos on the current page, sends `repos:activity`
 * 4. Listens for `repo:activity` to update per-repo activity data
 * 5. Activity data is cached client-side so page changes don't re-fetch
 *
 * All filtering, sorting, and pagination happens client-side.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import type { RepoInfo, RepoActivityEntry } from '@shared/types/entities';
import type {
  ReposListResponseMessage,
  RepoActivityResponseMessage,
  WebSocketMessage,
} from '@shared/types/websocket-messages';
import { useWebSocket } from '../hooks/useWebSocket';
import { LandingToolbar, type SortOption } from '../components/Landing/LandingToolbar';
import { RepoRow } from '../components/Landing/RepoRow';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 20;

/**
 * ASCII art "PAIGE" using figlet `slant` font style.
 * Hardcoded to avoid importing a figlet library.
 */
const PAIGE_ASCII = `    ____  ___    ____________
   / __ \\/   |  /  _/ ____/ ____
  / /_/ / /| |  / // / __/ __/
 / ____/ ___ |_/ // /_/ / /___
/_/   /_/  |_/___/\\____/_____/`;

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */

const containerStyle: React.CSSProperties = {
  height: '100%',
  overflowY: 'auto',
  scrollBehavior: 'smooth',
  padding: 'var(--space-lg)',
  display: 'flex',
  flexDirection: 'column',
};

const bannerStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '14px',
  lineHeight: 1.2,
  color: 'var(--accent-primary)',
  whiteSpace: 'pre',
  textAlign: 'center',
  marginBottom: 'var(--space-sm)',
  userSelect: 'none',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-h3-size)',
  color: 'var(--text-secondary)',
  textAlign: 'center',
  marginBottom: 'var(--space-lg)',
};

const listContainerStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const listBodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
};

const paginationStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 'var(--space-md)',
  padding: 'var(--space-sm) var(--space-md)',
  borderTop: '1px solid var(--border-subtle)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-muted)',
};

const pageButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '4px',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  cursor: 'pointer',
};

const pageButtonDisabledStyle: React.CSSProperties = {
  ...pageButtonStyle,
  opacity: 0.4,
  cursor: 'default',
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-lg)',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-body-size)',
  minHeight: '200px',
};

const loadingStyle: React.CSSProperties = {
  ...emptyStateStyle,
  color: 'var(--text-secondary)',
};

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

interface LandingProps {
  /** Called when the user selects a repository. */
  onSelectRepo: (repo: { owner: string; repo: string }) => void;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function Landing({ onSelectRepo }: LandingProps) {
  const { send, on } = useWebSocket();

  /* ---- State ---- */
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('last_updated');
  const [currentPage, setCurrentPage] = useState(0);
  const [activityMap, setActivityMap] = useState<Record<string, RepoActivityEntry[]>>({});

  /** Track which repos we've already requested activity for. */
  const fetchedActivityRepos = useRef<Set<string>>(new Set());

  /* ---- Fetch repos on mount ---- */
  useEffect(() => {
    send('repos:list', {});

    const unsubList = on('repos:list_response', (msg: WebSocketMessage) => {
      const m = msg as ReposListResponseMessage;
      setRepos(m.payload.repos);
      setIsLoading(false);
    });

    const unsubActivity = on('repo:activity', (msg: WebSocketMessage) => {
      const m = msg as RepoActivityResponseMessage;
      setActivityMap((prev) => ({
        ...prev,
        [m.payload.repo]: m.payload.activities,
      }));
    });

    return () => {
      unsubList();
      unsubActivity();
    };
  }, [send, on]);

  /* ---- Derived: unique languages ---- */
  const languages = useMemo(() => {
    const langSet = new Set<string>();
    for (const repo of repos) {
      if (repo.language) {
        langSet.add(repo.language);
      }
    }
    return Array.from(langSet).sort();
  }, [repos]);

  /* ---- Derived: filtered + sorted repos ---- */
  const filteredRepos = useMemo(() => {
    let result = repos;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.fullName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    // Language filter
    if (selectedLanguage) {
      result = result.filter((r) => r.language === selectedLanguage);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'recently_used':
        case 'last_updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'name':
          return a.fullName.localeCompare(b.fullName);
        case 'issue_count':
          return b.openIssues - a.openIssues;
        default:
          return 0;
      }
    });

    return result;
  }, [repos, searchQuery, selectedLanguage, sortBy]);

  /* ---- Derived: pagination ---- */
  const totalPages = Math.max(1, Math.ceil(filteredRepos.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const visibleRepos = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filteredRepos.slice(start, start + PAGE_SIZE);
  }, [filteredRepos, safePage]);

  /* ---- Fetch activity for visible repos ---- */
  useEffect(() => {
    if (visibleRepos.length === 0) return;

    const reposToFetch = visibleRepos
      .map((r) => r.fullName)
      .filter((name) => !fetchedActivityRepos.current.has(name));

    if (reposToFetch.length === 0) return;

    // Mark as fetched before sending to avoid duplicate requests
    for (const name of reposToFetch) {
      fetchedActivityRepos.current.add(name);
    }

    send('repos:activity', { repos: reposToFetch });
  }, [visibleRepos, send]);

  /* ---- Reset page when filters change ---- */
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, selectedLanguage, sortBy]);

  /* ---- Handlers ---- */
  const handleSelectRepo = useCallback(
    (repo: { owner: string; repo: string }) => {
      onSelectRepo(repo);
    },
    [onSelectRepo]
  );

  const handlePrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
  }, [totalPages]);

  /* ---- Spring preset ---- */
  const springExpressive = { stiffness: 260, damping: 20 };

  /* ---- Render ---- */
  return (
    <main style={containerStyle} aria-label="Repository picker">
      {/* ASCII banner */}
      <motion.pre
        style={bannerStyle}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', ...springExpressive, delay: 0.05 }}
      >
        {PAIGE_ASCII}
      </motion.pre>

      {/* Subtitle */}
      <motion.p
        style={subtitleStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        Pick a project to work on
      </motion.p>

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', ...springExpressive, delay: 0.2 }}
      >
        <LandingToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          languages={languages}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      </motion.div>

      {/* Repo list */}
      <motion.div
        style={listContainerStyle}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', ...springExpressive, delay: 0.25 }}
      >
        <div style={listBodyStyle}>
          {isLoading ? (
            <div style={loadingStyle}>Loading repositories...</div>
          ) : filteredRepos.length === 0 ? (
            <div style={emptyStateStyle}>
              {repos.length === 0
                ? 'No repositories found. Check your GitHub authentication.'
                : 'No repositories match your filters.'}
            </div>
          ) : (
            visibleRepos.map((repo) => (
              <RepoRow
                key={repo.fullName}
                repo={repo}
                activities={activityMap[repo.fullName] ?? null}
                onClick={handleSelectRepo}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {filteredRepos.length > PAGE_SIZE && (
          <div style={paginationStyle}>
            <button
              style={safePage === 0 ? pageButtonDisabledStyle : pageButtonStyle}
              onClick={handlePrevPage}
              disabled={safePage === 0}
              aria-label="Previous page"
            >
              Prev
            </button>
            <span>
              Page {safePage + 1} of {totalPages}
            </span>
            <button
              style={safePage >= totalPages - 1 ? pageButtonDisabledStyle : pageButtonStyle}
              onClick={handleNextPage}
              disabled={safePage >= totalPages - 1}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        )}
      </motion.div>
    </main>
  );
}
