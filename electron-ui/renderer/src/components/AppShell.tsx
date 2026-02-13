/**
 * AppShell — Main application shell for Paige.
 *
 * Renders a persistent 48px header bar and routes between Dashboard,
 * IDE, and Placeholder views based on `currentView` state.
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppView } from '@shared/types/entities';
import type { SessionRepoStartedMessage, WebSocketMessage } from '@shared/types/websocket-messages';
import { useWebSocket } from '../hooks/useWebSocket';
import { Landing } from '../views/Landing';
import { Dashboard } from '../views/Dashboard';
import { IDE } from '../views/IDE';
import { Placeholder } from '../views/Placeholder';

/** Spring preset: lively, bouncy motion */
const SPRING_EXPRESSIVE = { stiffness: 260, damping: 20 };

/** Navigation context passed alongside view changes */
interface NavigationContext {
  issueNumber?: number;
}

const isMacOS = (): boolean => window.paige?.platform === 'darwin';

const headerStyle: React.CSSProperties = {
  height: 'var(--header-height)',
  minHeight: 'var(--header-height)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  background: 'var(--bg-surface)',
  borderBottom: '1px solid var(--border-subtle)',
  paddingRight: 'var(--space-md)',
  userSelect: 'none',
  WebkitAppRegion: 'drag',
};

const logoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family), monospace',
  fontWeight: 700,
  fontSize: 'var(--font-h3-size)',
  color: 'var(--accent-primary)',
  letterSpacing: '0.15em',
};

const backButtonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-subtle)',
  borderRadius: '4px',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  padding: '2px 8px',
  cursor: 'pointer',
  WebkitAppRegion: 'no-drag',
};

const viewContainerStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  position: 'relative',
};

/** Framer Motion variants for view transitions */
const viewVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function AppShell() {
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [, setNavContext] = useState<NavigationContext>({});
  const [, setCurrentRepo] = useState<{ owner: string; repo: string } | null>(null);

  const { send, on } = useWebSocket();

  const handleNavigate = useCallback((view: AppView, context?: { issueNumber?: number }) => {
    setCurrentView(view);
    if (context) {
      setNavContext(context);
    }
  }, []);

  const handleBack = useCallback(() => {
    switch (currentView) {
      case 'ide':
      case 'placeholder':
        setCurrentView('dashboard');
        break;
      case 'dashboard':
        setCurrentView('landing');
        setCurrentRepo(null);
        break;
      default:
        break;
    }
    setNavContext({});
  }, [currentView]);

  /** Handle repo selection from the landing page. */
  const handleSelectRepo = useCallback(
    (repo: { owner: string; repo: string }) => {
      setCurrentRepo(repo);
      send('session:start_repo', { owner: repo.owner, repo: repo.repo });
    },
    [send]
  );

  /** Listen for session:repo_started to transition to dashboard. */
  useEffect(() => {
    const unsub = on('session:repo_started', (msg: WebSocketMessage) => {
      const m = msg as SessionRepoStartedMessage;
      setCurrentRepo({ owner: m.payload.owner, repo: m.payload.repo });
      setCurrentView('dashboard');
    });
    return unsub;
  }, [on]);

  const renderView = () => {
    switch (currentView) {
      case 'landing':
        return <Landing onSelectRepo={handleSelectRepo} />;
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'ide':
        return <IDE onNavigate={handleNavigate} />;
      case 'placeholder':
        return <Placeholder onNavigate={handleNavigate} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header bar */}
      <header
        style={{
          ...headerStyle,
          paddingLeft: isMacOS() ? '70px' : 'var(--space-md)',
        }}
        role="banner"
      >
        <span style={logoStyle}>PAIGE</span>

        <AnimatePresence>
          {currentView !== 'landing' && (
            <motion.button
              style={backButtonStyle}
              onClick={handleBack}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ type: 'spring', ...SPRING_EXPRESSIVE }}
              whileHover={{ borderColor: 'var(--accent-primary)' }}
              aria-label={
                currentView === 'dashboard' ? 'Back to project picker' : 'Back to dashboard'
              }
            >
              &larr;{' '}
              {currentView === 'dashboard' ? 'Projects' : 'Dashboard'}
            </motion.button>
          )}
        </AnimatePresence>
      </header>

      {/* View area */}
      <div style={viewContainerStyle}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', ...SPRING_EXPRESSIVE }}
            style={{ height: '100%' }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
