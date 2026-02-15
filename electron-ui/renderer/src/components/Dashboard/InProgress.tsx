/**
 * InProgress -- Dashboard section showing in-progress issues and authored PRs.
 *
 * Manages its own WebSocket subscriptions:
 *   - `dashboard:in_progress_item` -- individual items streamed one at a time
 *   - `dashboard:in_progress_complete` -- signal that all items have been sent
 *
 * Features:
 *   - Progressive rendering: items accumulate into state as they arrive
 *   - Filter dropdown: show all / issues only / PRs only
 *   - Sort button: updated desc/asc, title desc/asc
 *   - Different row background tints for issues vs PRs
 *   - Skeleton placeholders while waiting for first item
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { InProgressItem, IssueDifficulty } from '@shared/types/entities';
import type { WebSocketMessage } from '@shared/types/websocket-messages';
import { useWebSocket } from '../../hooks/useWebSocket';
import { SortButton, type SortOption } from './SortButton';
import { DifficultyIcon } from './DifficultyIcon';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterMode = 'all' | 'issues' | 'prs';
type SortKey = 'updated_desc' | 'updated_asc' | 'title_desc' | 'title_asc';

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------

const SORT_OPTIONS: SortOption<SortKey>[] = [
  { key: 'updated_desc', label: 'Updated (newest)', direction: 'desc' },
  { key: 'updated_asc', label: 'Updated (oldest)', direction: 'asc' },
  { key: 'title_desc', label: 'Title (Z-A)', direction: 'desc' },
  { key: 'title_asc', label: 'Title (A-Z)', direction: 'asc' },
];

// ---------------------------------------------------------------------------
// Difficulty labels
// ---------------------------------------------------------------------------

const DIFFICULTY_LABELS: Record<IssueDifficulty, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  very_high: 'Very High',
  extreme: 'Extreme',
};

// ---------------------------------------------------------------------------
// Label contrast helper
// ---------------------------------------------------------------------------

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a18' : '#faf9f5';
}

// ---------------------------------------------------------------------------
// Sort comparator
// ---------------------------------------------------------------------------

function sortItems(items: InProgressItem[], sortKey: SortKey): InProgressItem[] {
  const sorted = [...items];
  switch (sortKey) {
    case 'updated_desc':
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'updated_asc':
      return sorted.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    case 'title_desc':
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case 'title_asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
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

const controlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '4px',
  padding: '4px 8px',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};

const listContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflowY: 'auto',
};

const issueRowStyle = (index: number): React.CSSProperties => ({
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
  overflow: 'hidden',
  padding: 'var(--space-xs) var(--space-md)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 'var(--space-md)',
  background: index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
});

const prRowStyle = (index: number): React.CSSProperties => ({
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
  overflow: 'hidden',
  padding: 'var(--space-xs) var(--space-md)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 'var(--space-md)',
  background: index % 2 === 0 ? 'rgba(217, 119, 87, 0.04)' : 'rgba(217, 119, 87, 0.08)',
});

const numberStyle: React.CSSProperties = {
  color: 'var(--accent-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  fontWeight: 600,
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  fontWeight: 600,
  lineHeight: 1.4,
  margin: 0,
  flex: 1,
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};

const prBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '4px',
  padding: '2px 8px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  backgroundColor: 'rgba(217, 119, 87, 0.15)',
  color: 'var(--accent-warm)',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

const labelPillStyle = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '4px',
  padding: '2px 8px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  backgroundColor: color.startsWith('#') ? color : `#${color}`,
  color: getContrastColor(color),
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
});

const overflowPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '4px',
  padding: '2px 8px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-muted)',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

const timeStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  whiteSpace: 'nowrap',
};

const skeletonStyle: React.CSSProperties = {
  borderRadius: '4px',
  height: '32px',
  background: 'var(--bg-elevated)',
  animation: 'breathe 2s ease-in-out infinite',
};

const emptyStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  textAlign: 'center',
  padding: 'var(--space-md)',
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LabelPills({
  labels,
  maxVisible,
}: {
  labels: InProgressItem['labels'];
  maxVisible: number;
}) {
  const visible = labels.slice(0, maxVisible);
  const overflowCount = labels.length - maxVisible;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap' }}
    >
      {visible.map((label) => (
        <span key={label.name} style={labelPillStyle(label.color)}>
          {label.name}
        </span>
      ))}
      {overflowCount > 0 && <span style={overflowPillStyle}>+{overflowCount}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const cardVariants = {
  initial: { opacity: 0, y: 12, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InProgress() {
  const { on } = useWebSocket();

  const [items, setItems] = useState<InProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated_desc');

  // Subscribe to streaming in-progress messages
  useEffect(() => {
    setItems([]);
    setLoading(true);

    const unsubs = [
      on('dashboard:in_progress_item', (msg: WebSocketMessage) => {
        const m = msg as { payload: { item: InProgressItem } };
        setItems((prev) => {
          // Avoid duplicates by number + type
          if (
            prev.some((i) => i.number === m.payload.item.number && i.type === m.payload.item.type)
          ) {
            return prev;
          }
          return [...prev, m.payload.item];
        });
        setLoading(false);
      }),
      on('dashboard:in_progress_complete', () => {
        setLoading(false);
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [on]);

  // Filter and sort
  const displayItems = useMemo(() => {
    let filtered = items;
    if (filter === 'issues') {
      filtered = items.filter((i) => i.type === 'issue');
    } else if (filter === 'prs') {
      filtered = items.filter((i) => i.type === 'pr');
    }
    return sortItems(filtered, sortKey);
  }, [items, filter, sortKey]);

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(e.target.value as FilterMode);
  }, []);

  const handleItemClick = useCallback((item: InProgressItem) => {
    window.open(item.htmlUrl, '_blank');
  }, []);

  const getRowStyle = (item: InProgressItem, index: number) => {
    return item.type === 'pr' ? prRowStyle(index) : issueRowStyle(index);
  };

  const getHoverBg = (item: InProgressItem, index: number) => {
    if (item.type === 'pr') {
      return index % 2 === 0 ? 'rgba(217, 119, 87, 0.04)' : 'rgba(217, 119, 87, 0.08)';
    }
    return index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)';
  };

  return (
    <section style={containerStyle} aria-label="In-progress items">
      {/* Header */}
      <div style={headerRowStyle}>
        <pre className="figlet-header" style={{ fontSize: '18px', margin: 0 }}>
          IN PROGRESS
        </pre>
        <div style={controlsStyle}>
          <select
            style={selectStyle}
            value={filter}
            onChange={handleFilterChange}
            aria-label="Filter items"
          >
            <option value="all">Show All</option>
            <option value="issues">Show Issues</option>
            <option value="prs">Show PRs</option>
          </select>
          <SortButton options={SORT_OPTIONS} current={sortKey} onChange={setSortKey} />
        </div>
      </div>

      {/* Loading state */}
      {loading && items.length === 0 && (
        <div style={listContainerStyle} role="status" aria-label="Loading in-progress items">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{ ...skeletonStyle, animationDelay: `${i * 150}ms`, marginBottom: '4px' }}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <p style={emptyStyle}>No issues in progress. Select an issue below to get started.</p>
      )}

      {/* Items list */}
      {displayItems.length > 0 && (
        <div style={listContainerStyle}>
          <AnimatePresence mode="popLayout">
            {displayItems.map((item, index) => (
              <motion.div
                key={`${item.type}-${item.number}`}
                layoutId={`inprogress-${item.type}-${item.number}`}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={getRowStyle(item, index)}
                onClick={() => handleItemClick(item)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = getHoverBg(item, index);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
                aria-label={`${item.type === 'pr' ? 'PR' : 'Issue'} #${item.number}: ${item.title}`}
              >
                <span style={numberStyle}>#{item.number}</span>
                <p style={titleStyle}>{item.title}</p>

                {/* Type-specific badge */}
                {item.type === 'issue' && item.difficulty && (
                  <span style={badgeStyle}>
                    <DifficultyIcon level={item.difficulty} size={16} />
                    {DIFFICULTY_LABELS[item.difficulty]}
                  </span>
                )}
                {item.type === 'pr' && (
                  <span style={prBadgeStyle}>{item.prStatus === 'draft' ? 'Draft' : 'PR'}</span>
                )}

                {item.labels.length > 0 && <LabelPills labels={item.labels} maxVisible={3} />}
                <span style={timeStyle}>{formatRelativeTime(item.updatedAt)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
