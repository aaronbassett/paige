/**
 * Dashboard — Home screen view with 6 sections in golden ratio grid.
 *
 * Layout (golden ratio 38:62 / 62:38):
 *   Row 1: Dreyfus radar (38%) + Stats bento with period switcher (62%)
 *   Row 2 (hidden when empty): In-progress tasks (62%) + Practice challenges (38%)
 *   Row 3: GitHub issues (62%) + Learning materials (38%)
 *
 * All data flows from backend via WebSocket messages.
 */

import { useEffect, useState, useCallback } from 'react';
import type { AppView } from '@shared/types/entities';
import type {
  DashboardDreyfusMessage,
  DashboardStatsMessage,
  DashboardInProgressMessage,
  DashboardIssuesMessage,
  DashboardChallengesMessage,
  DashboardMaterialsMessage,
  WebSocketMessage,
} from '@shared/types/websocket-messages';
import { useWebSocket } from '../hooks/useWebSocket';
import { DreyfusRadar } from '../components/Dashboard/DreyfusRadar';
import { StatsBento } from '../components/Dashboard/StatsBento';
import { InProgressTasks } from '../components/Dashboard/InProgressTasks';
import { GitHubIssues } from '../components/Dashboard/GitHubIssues';
import { PracticeChallenges } from '../components/Dashboard/PracticeChallenges';
import { LearningMaterials } from '../components/Dashboard/LearningMaterials';

interface DashboardProps {
  onNavigate: (view: AppView, context?: { issueNumber?: number }) => void;
}

type StatsPeriod = 'today' | 'this_week' | 'this_month';

const scrollContainerStyle: React.CSSProperties = {
  height: '100%',
  overflowY: 'auto',
  scrollBehavior: 'smooth',
  padding: 'var(--space-lg)',
};

const gridRowStyle: React.CSSProperties = {
  display: 'grid',
  gap: 'var(--space-lg)',
  marginBottom: 'var(--space-lg)',
};

export function Dashboard({ onNavigate }: DashboardProps) {
  const { send, on } = useWebSocket();

  // Dashboard data state
  const [dreyfusAxes, setDreyfusAxes] = useState<DashboardDreyfusMessage['payload']['axes'] | null>(
    null
  );
  const [stats, setStats] = useState<DashboardStatsMessage['payload'] | null>(null);
  const [inProgressTasks, setInProgressTasks] = useState<
    DashboardInProgressMessage['payload']['tasks'] | null
  >(null);
  const [issues, setIssues] = useState<DashboardIssuesMessage['payload']['issues'] | null>(null);
  const [challenges, setChallenges] = useState<
    DashboardChallengesMessage['payload']['challenges'] | null
  >(null);
  const [materials, setMaterials] = useState<
    DashboardMaterialsMessage['payload']['materials'] | null
  >(null);

  // Subscribe to all 6 dashboard WebSocket messages
  useEffect(() => {
    const unsubs = [
      on('dashboard:dreyfus', (msg: WebSocketMessage) => {
        const m = msg as DashboardDreyfusMessage;
        setDreyfusAxes(m.payload.axes);
      }),
      on('dashboard:stats', (msg: WebSocketMessage) => {
        const m = msg as DashboardStatsMessage;
        setStats(m.payload);
      }),
      on('dashboard:in_progress', (msg: WebSocketMessage) => {
        const m = msg as DashboardInProgressMessage;
        setInProgressTasks(m.payload.tasks);
      }),
      on('dashboard:issues', (msg: WebSocketMessage) => {
        const m = msg as DashboardIssuesMessage;
        setIssues(m.payload.issues);
      }),
      on('dashboard:challenges', (msg: WebSocketMessage) => {
        const m = msg as DashboardChallengesMessage;
        setChallenges(m.payload.challenges);
      }),
      on('dashboard:materials', (msg: WebSocketMessage) => {
        const m = msg as DashboardMaterialsMessage;
        setMaterials(m.payload.materials);
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [on]);

  const handleStatsPeriodChange = useCallback(
    (period: StatsPeriod) => {
      send('dashboard:stats_period', { period });
    },
    [send]
  );

  const handleIssueClick = useCallback(
    (issueNumber: number) => {
      send('dashboard:start_issue', { issueNumber });
      onNavigate('ide', { issueNumber });
    },
    [send, onNavigate]
  );

  const handleResumeTask = useCallback(
    (taskId: string) => {
      send('dashboard:resume_task', { taskId });
      onNavigate('ide');
    },
    [send, onNavigate]
  );

  const handlePlaceholderNav = useCallback(() => {
    onNavigate('placeholder');
  }, [onNavigate]);

  const hasInProgressTasks = inProgressTasks !== null && inProgressTasks.length > 0;

  return (
    <main className="dot-matrix" style={scrollContainerStyle} aria-label="Dashboard">
      {/* Row 1: Dreyfus Radar (38%) + Stats Bento (62%) */}
      <div style={{ ...gridRowStyle, gridTemplateColumns: '38fr 62fr' }}>
        <DreyfusRadar axes={dreyfusAxes} />
        <StatsBento stats={stats} onPeriodChange={handleStatsPeriodChange} />
      </div>

      {/* Row 2 (hidden when empty): In-Progress Tasks (62%) + Practice Challenges (38%) */}
      {(hasInProgressTasks || challenges !== null) && (
        <div style={{ ...gridRowStyle, gridTemplateColumns: '62fr 38fr' }}>
          {hasInProgressTasks ? (
            <InProgressTasks tasks={inProgressTasks} onResume={handleResumeTask} />
          ) : (
            <div />
          )}
          <PracticeChallenges challenges={challenges} onChallengeClick={handlePlaceholderNav} />
        </div>
      )}

      {/* Row 3: GitHub Issues (62%) + Learning Materials (38%) */}
      <div style={{ ...gridRowStyle, gridTemplateColumns: '62fr 38fr' }}>
        <GitHubIssues issues={issues} onIssueClick={handleIssueClick} />
        <LearningMaterials materials={materials} onMaterialClick={handlePlaceholderNav} />
      </div>
    </main>
  );
}
