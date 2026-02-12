/**
 * ErrorBoundary -- Global error boundary for the Paige application.
 *
 * Catches unhandled rendering errors from child components and displays
 * a graceful error screen with recovery options. Must be a class component
 * because React error boundaries require getDerivedStateFromError and
 * componentDidCatch lifecycle methods.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/* ---------------------------------------------------------------------------
 * Styles (React.CSSProperties with design tokens)
 * ------------------------------------------------------------------------- */

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: 'var(--space-lg)',
  padding: 'var(--space-xl)',
  background: 'var(--bg-base)',
  fontFamily: 'var(--font-family), monospace',
};

const headerStyle: React.CSSProperties = {
  fontSize: '36px',
  textAlign: 'center',
};

const errorCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-md)',
  padding: 'var(--space-xl)',
  background: 'var(--bg-surface)',
  borderRadius: '8px',
  border: '1px solid var(--status-error)',
  maxWidth: '520px',
  width: '100%',
};

const errorLabelStyle: React.CSSProperties = {
  color: 'var(--status-error)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const errorMessageStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-body-size)',
  lineHeight: 'var(--font-body-line-height)',
  textAlign: 'center',
  wordBreak: 'break-word',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-sm)',
  marginTop: 'var(--space-sm)',
};

const primaryButtonStyle: React.CSSProperties = {
  background: 'var(--accent-primary)',
  border: 'none',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-subtle)',
  borderRadius: '4px',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  fontWeight: 500,
  padding: '8px 16px',
  cursor: 'pointer',
};

const hintStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  textAlign: 'center',
};

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/**
 * Sanitize an error message for display.
 * Strips stack traces and limits length to avoid leaking internal details.
 * The full error (including stack) is still logged to console.error in
 * componentDidCatch for debugging purposes.
 */
function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Take only the first line -- no stack trace leakage
    const firstLine = error.message.split('\n')[0] ?? 'Unknown error';
    return firstLine.length > 200 ? firstLine.slice(0, 200) + '...' : firstLine;
  }

  if (typeof error === 'string') {
    return error.length > 200 ? error.slice(0, 200) + '...' : error;
  }

  return 'An unexpected error occurred';
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: null,
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: sanitizeErrorMessage(error),
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught rendering error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  private handleTryAgain = (): void => {
    this.setState({ hasError: false, errorMessage: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="dot-matrix" style={containerStyle} role="alert" aria-live="assertive">
        <pre className="figlet-header" style={headerStyle} aria-label="Oops">
          {'  ___   ___  ____  ____\n' +
            ' / _ \\ / _ \\|  _ \\/ ___|\n' +
            '| | | | | | | |_) \\___ \\\n' +
            '| |_| | |_| |  __/ ___) |\n' +
            ' \\___/ \\___/|_|   |____/'}
        </pre>

        <div style={errorCardStyle}>
          <span style={errorLabelStyle}>Something went wrong</span>

          {this.state.errorMessage && <p style={errorMessageStyle}>{this.state.errorMessage}</p>}

          <div style={buttonRowStyle}>
            <button style={primaryButtonStyle} onClick={this.handleTryAgain} aria-label="Try again">
              Try Again
            </button>
            <button
              style={secondaryButtonStyle}
              onClick={this.handleReload}
              aria-label="Reload application"
            >
              Reload
            </button>
          </div>
        </div>

        <p style={hintStyle}>If this keeps happening, try restarting the application.</p>
      </div>
    );
  }
}
