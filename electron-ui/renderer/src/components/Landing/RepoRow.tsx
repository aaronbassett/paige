/**
 * RepoRow -- Single repository row in the landing page repo list.
 *
 * Displays:
 * - Repo name (bold) + description (truncated)
 * - Language dot + name, license, stars, forks, issues, PRs
 * - Relative time since last update
 * - An absolute-positioned ActivityPlot background (decorative)
 *
 * Uses React.memo to avoid unnecessary re-renders since there may be
 * many rows rendered simultaneously.
 */

import { memo, useState, useCallback } from 'react';
import type { RepoInfo, RepoActivityEntry } from '@shared/types/entities';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { getLanguageColor } from './LandingToolbar';
import { ActivityPlot } from './ActivityPlot';

interface RepoRowProps {
  /** Repository metadata. */
  repo: RepoInfo;
  /** Activity data for this repo (null if not yet fetched). */
  activities: RepoActivityEntry[] | null;
  /** Called when the user clicks this row to select the repo. */
  onClick: (repo: { owner: string; repo: string }) => void;
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */

const rowStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '14px 16px',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
  overflow: 'hidden',
};

const rowHoverStyle: React.CSSProperties = {
  ...rowStyle,
  background: 'var(--bg-elevated)',
};

const topRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--space-sm)',
  position: 'relative',
  zIndex: 1,
};

const nameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-body-size)',
  fontWeight: 600,
  color: 'var(--accent-primary)',
  whiteSpace: 'nowrap',
};

const descriptionStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  minWidth: 0,
};

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-md)',
  flexWrap: 'wrap',
  position: 'relative',
  zIndex: 1,
};

const metaItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
};

const timeStyle: React.CSSProperties = {
  marginLeft: 'auto',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  position: 'relative',
  zIndex: 1,
};

/* -------------------------------------------------------------------------- */
/*  Helper icons (simple SVG-based)                                            */
/* -------------------------------------------------------------------------- */

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity={0.7}>
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
    </svg>
  );
}

function ForkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity={0.7}>
      <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h1.5v2.128a2.251 2.251 0 1 0 1.5 0V8.5h1.5a2.25 2.25 0 0 0 2.25-2.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878zm3.75 7.378a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm3-8.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" />
    </svg>
  );
}

function IssueIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity={0.7}>
      <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0z" />
    </svg>
  );
}

function PullRequestIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity={0.7}>
      <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354zM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0z" />
    </svg>
  );
}

function LicenseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity={0.7}>
      <path d="M8.75.75V2h.985c.304 0 .603.08.867.231l1.29.736c.038.022.08.033.124.033h2.234a.75.75 0 0 1 0 1.5h-.427l2.111 4.692a.75.75 0 0 1-.154.838l-.53-.53.53.53-.001.002-.002.002-.006.006-.006.005-.01.01a.756.756 0 0 1-.074.06 1.898 1.898 0 0 1-.187.128c-.12.073-.28.16-.485.248a4.625 4.625 0 0 1-1.792.382 4.625 4.625 0 0 1-1.793-.382 3.737 3.737 0 0 1-.485-.248 1.898 1.898 0 0 1-.26-.188L11 9.75a.75.75 0 0 1-.154-.838L12.96 4.5h-.97l-1.29.736a2.495 2.495 0 0 1-.867.231H8.75V13h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5V5.467h-.985a2.495 2.495 0 0 1-.867-.231L4.04 4.5h-.97l2.112 4.692a.75.75 0 0 1-.154.838l-.53-.53.53.53-.001.002-.002.002-.006.006-.006.005-.01.01a.756.756 0 0 1-.074.06 1.898 1.898 0 0 1-.187.128c-.12.073-.28.16-.485.248a4.625 4.625 0 0 1-1.792.382 4.625 4.625 0 0 1-1.793-.382 3.737 3.737 0 0 1-.485-.248 1.898 1.898 0 0 1-.26-.188L0 9.75a.75.75 0 0 1-.154-.838L1.96 4.5H1.5a.75.75 0 0 1 0-1.5h2.234c.044 0 .086-.011.124-.033l1.29-.736A2.493 2.493 0 0 1 6.015 2H7V.75a.75.75 0 0 1 1.5 0h.25zM4.475 8.99l1.09-2.424H2.5l1.09 2.424-.615.344.615-.344zm8.14 0-.615-.344.615.344L13.5 6.566h-3.065l1.09 2.424z" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export const RepoRow = memo(function RepoRow({ repo, activities, onClick }: RepoRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(() => {
    onClick({ owner: repo.owner, repo: repo.name });
  }, [onClick, repo.owner, repo.name]);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  return (
    <div
      style={isHovered ? rowHoverStyle : rowStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      aria-label={`Select repository ${repo.fullName}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Activity background */}
      <ActivityPlot activities={activities} />

      {/* Top row: name + description */}
      <div style={topRowStyle}>
        <span style={nameStyle}>{repo.fullName}</span>
        {repo.description && (
          <span style={descriptionStyle}>{repo.description}</span>
        )}
      </div>

      {/* Meta row: language, license, stats, time */}
      <div style={metaRowStyle}>
        {repo.language && (
          <span style={metaItemStyle}>
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: getLanguageColor(repo.language),
              }}
            />
            {repo.language}
          </span>
        )}

        {repo.license && repo.license !== 'NOASSERTION' && (
          <span style={metaItemStyle}>
            <LicenseIcon />
            {repo.license}
          </span>
        )}

        {repo.stars > 0 && (
          <span style={metaItemStyle}>
            <StarIcon />
            {repo.stars.toLocaleString()}
          </span>
        )}

        {repo.forks > 0 && (
          <span style={metaItemStyle}>
            <ForkIcon />
            {repo.forks.toLocaleString()}
          </span>
        )}

        <span style={metaItemStyle}>
          <IssueIcon />
          {repo.openIssues}
        </span>

        {repo.openPRs > 0 && (
          <span style={metaItemStyle}>
            <PullRequestIcon />
            {repo.openPRs}
          </span>
        )}

        <span style={timeStyle}>
          Updated {formatRelativeTime(repo.updatedAt)}
        </span>
      </div>
    </div>
  );
});
