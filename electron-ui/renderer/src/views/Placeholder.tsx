/**
 * Placeholder — "Coming Soon" view for unimplemented features.
 *
 * Shown when navigating to a feature that has not been built yet.
 * Includes a figlet-style header, a friendly message, and a back link.
 */

import type { AppView } from '@shared/types/entities';

interface PlaceholderProps {
  onNavigate: (view: AppView, context?: { issueNumber?: number }) => void;
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: 'var(--space-lg)',
  padding: 'var(--space-xl)',
};

const messageStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-body-size)',
  fontFamily: 'var(--font-family), monospace',
  textAlign: 'center' as const,
  maxWidth: '480px',
  lineHeight: 'var(--font-body-line-height)',
};

const backLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent-primary)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-body-size)',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
};

export function Placeholder({ onNavigate }: PlaceholderProps) {
  return (
    <div className="dot-matrix" style={containerStyle}>
      <pre className="figlet-header" aria-label="Coming Soon">
        COMING SOON
      </pre>

      <p style={messageStyle}>
        I&apos;m still learning this one myself... check back soon!
      </p>

      <button
        style={backLinkStyle}
        onClick={() => onNavigate('dashboard')}
        aria-label="Back to dashboard"
      >
        &larr; Back to Dashboard
      </button>
    </div>
  );
}
