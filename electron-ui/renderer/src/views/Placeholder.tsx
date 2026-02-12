/**
 * Placeholder — Polished "Coming Soon" page for unimplemented features.
 *
 * Displays a figlet-style header, an inline SVG construction illustration
 * with scanline overlay, a playful message, and a back-to-dashboard link.
 * The dot-matrix background pattern is applied to the outer container.
 *
 * The SVG is wrapped in an ErrorBoundary that falls back to a construction
 * emoji if the illustration fails to render for any reason.
 */

import { Component } from 'react';
import type { ReactNode } from 'react';
import type { AppView } from '@shared/types/entities';

/* -------------------------------------------------------------------------
 * Props
 * ----------------------------------------------------------------------- */

interface PlaceholderProps {
  onNavigate: (view: AppView, context?: { issueNumber?: number }) => void;
}

/* -------------------------------------------------------------------------
 * SVG Error Boundary — falls back to emoji on render failure
 * ----------------------------------------------------------------------- */

interface SvgErrorBoundaryProps {
  children: ReactNode;
}

interface SvgErrorBoundaryState {
  hasError: boolean;
}

class SvgErrorBoundary extends Component<SvgErrorBoundaryProps, SvgErrorBoundaryState> {
  constructor(props: SvgErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SvgErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <span style={emojiFallbackStyle} role="img" aria-label="Under construction">
          🚧
        </span>
      );
    }
    return this.props.children;
  }
}

/* -------------------------------------------------------------------------
 * Inline styles (CSS variables only, no raw values except structural)
 * ----------------------------------------------------------------------- */

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: 'var(--space-lg)',
  padding: 'var(--space-xl)',
};

const illustrationWrapperStyle: React.CSSProperties = {
  width: '160px',
  height: '160px',
  position: 'relative',
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

const emojiFallbackStyle: React.CSSProperties = {
  fontSize: '80px',
  lineHeight: 1,
  display: 'block',
  textAlign: 'center',
};

/* -------------------------------------------------------------------------
 * Construction Illustration — Inline SVG
 *
 * A figure wearing a hard hat, holding a hammer, working at a sawhorse
 * workbench. Uses the design system's terracotta palette:
 *   --accent-primary (#d97757), --accent-deep (#b85c3a),
 *   --accent-warm (#e8956a), --text-muted (#6b6960),
 *   --bg-elevated (#30302e), --text-secondary (#a8a69e)
 * ----------------------------------------------------------------------- */

function ConstructionIllustration() {
  return (
    <div className="scanline-overlay" style={illustrationWrapperStyle}>
      <svg
        viewBox="0 0 160 160"
        width="160"
        height="160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Construction worker illustration"
      >
        {/* Ground line */}
        <line
          x1="20"
          y1="145"
          x2="140"
          y2="145"
          stroke="#6b6960"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 3"
        />

        {/* Sawhorse / workbench */}
        {/* legs */}
        <line
          x1="90"
          y1="120"
          x2="80"
          y2="145"
          stroke="#6b6960"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="90"
          y1="120"
          x2="100"
          y2="145"
          stroke="#6b6960"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="120"
          y1="120"
          x2="110"
          y2="145"
          stroke="#6b6960"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="120"
          y1="120"
          x2="130"
          y2="145"
          stroke="#6b6960"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* top plank */}
        <rect x="85" y="116" width="40" height="6" rx="1.5" fill="#b85c3a" />
        {/* cross brace */}
        <line x1="86" y1="132" x2="100" y2="122" stroke="#6b6960" strokeWidth="1.5" />
        <line x1="118" y1="132" x2="132" y2="122" stroke="#6b6960" strokeWidth="1.5" />

        {/* Small blocks on workbench */}
        <rect x="92" y="110" width="8" height="6" rx="1" fill="#a8a69e" />
        <rect
          x="104"
          y="108"
          width="10"
          height="8"
          rx="1"
          fill="#30302e"
          stroke="#6b6960"
          strokeWidth="1"
        />

        {/* Figure — body */}
        {/* Torso */}
        <rect x="48" y="78" width="24" height="32" rx="4" fill="#30302e" />
        {/* Belt */}
        <rect x="48" y="100" width="24" height="4" rx="1" fill="#b85c3a" />

        {/* Legs */}
        <rect x="50" y="110" width="8" height="28" rx="3" fill="#30302e" />
        <rect x="62" y="110" width="8" height="28" rx="3" fill="#30302e" />
        {/* Boots */}
        <rect x="48" y="135" width="12" height="6" rx="2" fill="#6b6960" />
        <rect x="60" y="135" width="12" height="6" rx="2" fill="#6b6960" />

        {/* Head */}
        <circle cx="60" cy="62" r="12" fill="#e8956a" />
        {/* Eyes */}
        <circle cx="55" cy="60" r="1.5" fill="#1a1a18" />
        <circle cx="65" cy="60" r="1.5" fill="#1a1a18" />
        {/* Smile */}
        <path
          d="M56 66 Q60 70 64 66"
          stroke="#1a1a18"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Hard hat */}
        <ellipse cx="60" cy="52" rx="16" ry="5" fill="#d97757" />
        <rect x="48" y="44" width="24" height="8" rx="3" fill="#d97757" />
        {/* Hat brim highlight */}
        <ellipse cx="60" cy="52" rx="14" ry="3" fill="#e8956a" opacity="0.4" />

        {/* Right arm — reaching toward workbench */}
        <line
          x1="72"
          y1="84"
          x2="88"
          y2="108"
          stroke="#e8956a"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Hand */}
        <circle cx="88" cy="108" r="3" fill="#e8956a" />

        {/* Left arm — holding hammer up */}
        <line
          x1="48"
          y1="84"
          x2="32"
          y2="68"
          stroke="#e8956a"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Hand */}
        <circle cx="32" cy="68" r="3" fill="#e8956a" />

        {/* Hammer */}
        {/* handle */}
        <line
          x1="32"
          y1="68"
          x2="26"
          y2="42"
          stroke="#a8a69e"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* head */}
        <rect x="18" y="36" width="16" height="8" rx="2" fill="#d97757" />
        {/* head highlight */}
        <rect x="20" y="38" width="12" height="3" rx="1" fill="#e8956a" opacity="0.5" />

        {/* Decorative: small sparks / work particles */}
        <circle cx="22" cy="32" r="1.5" fill="#d97757" opacity="0.7" />
        <circle cx="30" cy="30" r="1" fill="#e8956a" opacity="0.6" />
        <circle cx="18" cy="28" r="1" fill="#d97757" opacity="0.5" />

        {/* Decorative: scattered dots suggesting construction dust */}
        <circle cx="135" cy="140" r="1" fill="#6b6960" opacity="0.4" />
        <circle cx="30" cy="142" r="1" fill="#6b6960" opacity="0.3" />
        <circle cx="45" cy="148" r="0.8" fill="#6b6960" opacity="0.3" />
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Placeholder Component
 * ----------------------------------------------------------------------- */

export function Placeholder({ onNavigate }: PlaceholderProps) {
  return (
    <div className="dot-matrix" style={containerStyle}>
      <pre className="figlet-header" aria-label="Coming Soon">
        COMING SOON
      </pre>

      <SvgErrorBoundary>
        <ConstructionIllustration />
      </SvgErrorBoundary>

      <p style={messageStyle}>I&apos;m still learning this one myself... check back soon!</p>

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
