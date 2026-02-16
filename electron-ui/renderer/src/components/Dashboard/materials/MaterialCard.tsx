/**
 * MaterialCard -- Individual learning material card for the dashboard.
 *
 * Displays a thumbnail (or placeholder), type badge (VID / DOC), title,
 * description, view count, and action buttons (complete, dismiss).
 *
 * Thumbnail, title, and description link to the resource URL and open in the
 * host OS default browser via `window.paige.openExternal`.
 *
 * Completed materials show a trophy instead of the graduation cap and are
 * rendered with reduced opacity.
 */

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import type { LearningMaterial } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaterialCardProps {
  material: LearningMaterial;
  onView: (id: number) => void;
  onComplete: (id: number) => void;
  onDismiss: (id: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_BADGE: Record<LearningMaterial['type'], { label: string; color: string }> = {
  youtube: { label: 'VID', color: 'var(--accent-primary)' },
  article: { label: 'DOC', color: 'var(--status-info)' },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  padding: 'var(--space-sm) var(--space-md)',
  background: 'var(--bg-elevated)',
  borderRadius: '8px',
  border: '1px solid var(--border-subtle)',
  cursor: 'default',
};

const thumbnailStyle: React.CSSProperties = {
  width: 80,
  height: 45,
  borderRadius: '4px',
  objectFit: 'cover',
  background: 'var(--bg-surface)',
  flexShrink: 0,
  cursor: 'pointer',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
};

const titleStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const viewCountStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-muted)',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  flexShrink: 0,
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-subtle)',
  borderRadius: '4px',
  padding: '4px 6px',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const placeholderThumbStyle: React.CSSProperties = {
  width: 80,
  height: 45,
  borderRadius: '4px',
  background: 'var(--bg-surface)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  color: 'var(--text-muted)',
  cursor: 'pointer',
};

const badgeStyle: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 700,
  padding: '1px 4px',
  borderRadius: '3px',
  color: '#fff',
  letterSpacing: '0.5px',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MaterialCard({ material, onView, onComplete, onDismiss }: MaterialCardProps) {
  const badge = TYPE_BADGE[material.type];
  const isCompleted = material.status === 'completed';

  const viewCountText =
    material.viewCount > 0
      ? `Viewed ${material.viewCount} time${material.viewCount !== 1 ? 's' : ''}`
      : 'Not yet viewed';

  const openLink = useCallback(() => {
    onView(material.id);
    window.paige.openExternal(material.url);
  }, [material.id, material.url, onView]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isCompleted ? 0.45 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      style={cardStyle}
    >
      {material.thumbnailUrl ? (
        <img
          src={material.thumbnailUrl}
          alt={material.title}
          style={thumbnailStyle}
          onClick={openLink}
          role="link"
        />
      ) : (
        <div style={placeholderThumbStyle} aria-hidden="true" onClick={openLink} role="link">
          {material.type === 'youtube' ? '\u25B6' : '\u2759'}
        </div>
      )}

      <div style={contentStyle}>
        <div style={titleRowStyle}>
          <span style={{ ...badgeStyle, background: badge.color }}>{badge.label}</span>
          <span style={titleStyle} onClick={openLink} role="link">
            {material.title}
          </span>
        </div>
        <span style={descriptionStyle} onClick={openLink} role="link">
          {material.description}
        </span>
        <span style={viewCountStyle}>{viewCountText}</span>
      </div>

      <div style={actionsStyle}>
        {!isCompleted && (
          <button
            style={iconBtnStyle}
            onClick={() => onComplete(material.id)}
            aria-label="Complete material"
            title="Mark as complete"
          >
            {'\uD83C\uDF93'}
          </button>
        )}
        {isCompleted && (
          <span
            style={{ ...iconBtnStyle, cursor: 'default', border: 'none' }}
            aria-label="Completed"
            title="Completed"
          >
            {'\uD83C\uDFC6'}
          </span>
        )}
        {!isCompleted && (
          <button
            style={{ ...iconBtnStyle, color: 'var(--status-error, #d97757)' }}
            onClick={() => onDismiss(material.id)}
            aria-label="Dismiss material"
            title="Dismiss"
          >
            &#x2715;
          </button>
        )}
      </div>
    </motion.div>
  );
}
