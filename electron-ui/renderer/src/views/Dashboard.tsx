/**
 * Dashboard — Placeholder dashboard view.
 *
 * Will be fleshed out in Phase 3 with issue cards, session history,
 * and skill gap analysis. For now, shows a branded landing page.
 */

import type { AppView } from '@shared/types/entities';

interface DashboardProps {
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

const subtitleStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-body-size)',
  fontFamily: 'var(--font-family), monospace',
  textAlign: 'center' as const,
  maxWidth: '480px',
  lineHeight: 'var(--font-body-line-height)',
};

const taglineStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family), monospace',
  fontStyle: 'italic',
};

export function Dashboard({ onNavigate: _onNavigate }: DashboardProps) {
  return (
    <div className="dot-matrix" style={containerStyle}>
      <pre className="figlet-header" aria-label="PAIGE">
        PAIGE
      </pre>

      <p style={subtitleStyle}>
        Dashboard is under construction. Issue cards, session history, and skill
        gap analysis will appear here.
      </p>

      <p style={taglineStyle}>&ldquo;Claude Codes, Paige Pairs.&rdquo;</p>
    </div>
  );
}
