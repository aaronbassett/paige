/**
 * Dashboard -- Home screen view with 6 sections in golden ratio grid.
 *
 * Layout (golden ratio 38:62 / 62:38):
 *   Row 1: Dreyfus radar (38%) + Stats bento with period switcher (62%)
 *   Row 2: In-progress issues & PRs (62%) + Practice challenges (38%)
 *   Row 3: GitHub issues (62%) + Learning materials (38%)
 *
 * All data flows from backend via WebSocket messages.
 * Note: GitHub issues are now managed internally by the GitHubIssues component
 * via its own WebSocket subscriptions (dashboard:issue, dashboard:issues_complete).
 */

import { useEffect, useState, useCallback } from 'react';
import type { AppView, LearningMaterial } from '@shared/types/entities';
import type {
  DashboardDreyfusMessage,
  DashboardChallengesMessage,
  WebSocketMessage,
} from '@shared/types/websocket-messages';
import type { DashboardStatsPayload, StatsPeriod } from '../components/Dashboard/stats/types';
import { useWebSocket } from '../hooks/useWebSocket';
import { DreyfusRadar } from '../components/Dashboard/DreyfusRadar';
import { StatsBento } from '../components/Dashboard/StatsBento';
import { InProgress } from '../components/Dashboard/InProgress';
import { GitHubIssues } from '../components/Dashboard/GitHubIssues';
import { PracticeChallenges } from '../components/Dashboard/PracticeChallenges';
import { LearningMaterials } from '../components/Dashboard/LearningMaterials';

interface DashboardProps {
  onNavigate: (view: AppView, context?: { issueNumber?: number; kataId?: number }) => void;
}

const scrollContainerStyle: React.CSSProperties = {
  height: '100%',
  overflowY: 'auto',
  scrollBehavior: 'smooth',
  padding: 'var(--space-md) var(--space-lg)',
  display: 'flex',
  flexDirection: 'column',
};

const gridRowStyle: React.CSSProperties = {
  display: 'grid',
  gap: 'var(--space-lg)',
  marginBottom: 'var(--space-md)',
};

export function Dashboard({ onNavigate }: DashboardProps) {
  const { send, on } = useWebSocket();

  // Dashboard data state (issues removed -- now managed by GitHubIssues)
  const [dreyfusAxes, setDreyfusAxes] = useState<DashboardDreyfusMessage['payload']['axes'] | null>(
    null
  );
  const [stats, setStats] = useState<DashboardStatsPayload | null>(null);
  const [challenges, setChallenges] = useState<
    DashboardChallengesMessage['payload']['challenges'] | null
  >(null);
  const [materials, setMaterials] = useState<LearningMaterial[] | null>(null);

  // Subscribe to dashboard WebSocket messages (issues removed)
  useEffect(() => {
    const unsubs = [
      on('dashboard:dreyfus', (msg: WebSocketMessage) => {
        const m = msg as DashboardDreyfusMessage;
        setDreyfusAxes(m.payload.axes);
      }),
      on('dashboard:stats', (msg: WebSocketMessage) => {
        // Cast to new DashboardStatsPayload shape; backend will be updated in Tasks 11-14
        setStats(msg.payload as DashboardStatsPayload);
      }),
      on('dashboard:challenges', (msg: WebSocketMessage) => {
        const m = msg as DashboardChallengesMessage;
        setChallenges(m.payload.challenges);
      }),
      on('dashboard:materials', (msg: WebSocketMessage) => {
        const payload = msg.payload as { materials: LearningMaterial[] };
        setMaterials(payload.materials);
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [on]);

  // Request initial stats when Dashboard mounts (the connection:hello
  // broadcast happens before Dashboard is rendered, so we'd miss it)
  useEffect(() => {
    send('dashboard:stats_period', { period: 'last_month' });
  }, [send]);

  const handleStatsPeriodChange = useCallback(
    (period: StatsPeriod) => {
      send('dashboard:stats_period', { period });
    },
    [send]
  );

  const handleChallengeClick = useCallback(
    (challengeId: string) => {
      onNavigate('challenge', { kataId: Number(challengeId) });
    },
    [onNavigate]
  );

  return (
    <main className="dot-matrix" style={scrollContainerStyle} aria-label="Dashboard">
      {/* Row 1: Dreyfus Radar (38%) + Stats Bento (62%) */}
      <div style={{ ...gridRowStyle, gridTemplateColumns: '38fr 62fr' }}>
        <DreyfusRadar
          axes={dreyfusAxes}
          overallStage={
            stats?.stats.dreyfus_progression ? String(stats.stats.dreyfus_progression.value) : null
          }
          selfSufficiency={
            stats?.stats.self_sufficiency && typeof stats.stats.self_sufficiency.value === 'number'
              ? stats.stats.self_sufficiency.value
              : null
          }
          selfSufficiencyChange={
            stats?.stats.self_sufficiency ? stats.stats.self_sufficiency.change : null
          }
        />
        <StatsBento stats={stats} onPeriodChange={handleStatsPeriodChange} />
      </div>

      {/* Row 2: In-Progress (62%) + Practice Challenges (38%) */}
      <div style={{ ...gridRowStyle, gridTemplateColumns: '62fr 38fr' }}>
        <InProgress onNavigate={onNavigate} />
        <PracticeChallenges challenges={challenges} onChallengeClick={handleChallengeClick} />
      </div>

      {/* Row 3: GitHub Issues (62%) + Learning Materials (38%) */}
      <div style={{ ...gridRowStyle, gridTemplateColumns: '62fr 38fr', flex: 1, marginBottom: 0 }}>
        <GitHubIssues onNavigate={onNavigate} />
        <LearningMaterials materials={materials} />
      </div>
    </main>
  );
}
