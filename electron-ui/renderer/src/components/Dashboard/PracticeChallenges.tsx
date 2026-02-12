/**
 * PracticeChallenges — Dashboard section listing available practice challenges.
 *
 * Displays challenge cards with difficulty badges and estimated time.
 * Supports loading (skeleton), empty, and populated states.
 */

interface PracticeChallengesProps {
  challenges: Array<{
    id: string;
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    estimatedMinutes: number;
  }> | null;
  onChallengeClick: () => void;
}

const DIFFICULTY_COLORS: Record<'easy' | 'medium' | 'hard', string> = {
  easy: '#7cb87c',
  medium: '#d4a843',
  hard: '#e05252',
};

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: '6px',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
  gap: 'var(--space-sm)',
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  color: 'var(--text-primary)',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const badgeStyle = (difficulty: 'easy' | 'medium' | 'hard'): React.CSSProperties => ({
  display: 'inline-block',
  borderRadius: '4px',
  padding: '2px 6px',
  fontSize: 'var(--font-small-size)',
  fontWeight: 500,
  fontFamily: 'var(--font-family)',
  color: '#ffffff',
  backgroundColor: DIFFICULTY_COLORS[difficulty],
  flexShrink: 0,
});

const timeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};

const emptyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  color: 'var(--text-muted)',
  padding: 'var(--space-md) 0',
  textAlign: 'center',
};

const skeletonCardStyle: React.CSSProperties = {
  height: '36px',
  borderRadius: '6px',
  background: 'var(--bg-elevated)',
  animation: 'breathe 2s ease-in-out infinite',
  marginBottom: 'var(--space-xs)',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
  marginTop: 'var(--space-sm)',
};

export function PracticeChallenges({ challenges, onChallengeClick }: PracticeChallengesProps) {
  const renderContent = () => {
    // Loading state: null means data hasn't arrived yet
    if (challenges === null) {
      return (
        <div style={listStyle} role="status" aria-busy="true" aria-label="Loading challenges">
          <div style={skeletonCardStyle} aria-hidden="true" />
          <div style={{ ...skeletonCardStyle, animationDelay: '150ms' }} aria-hidden="true" />
        </div>
      );
    }

    // Empty state: data arrived but no challenges
    if (challenges.length === 0) {
      return <p style={emptyStyle}>No challenges available</p>;
    }

    // Populated state
    return (
      <div style={listStyle} role="list">
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            role="listitem"
            style={cardStyle}
            onClick={onChallengeClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChallengeClick();
              }
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            tabIndex={0}
            aria-label={`${challenge.title}, ${challenge.difficulty}, approximately ${challenge.estimatedMinutes} minutes`}
          >
            <span style={titleStyle}>{challenge.title}</span>
            <span style={badgeStyle(challenge.difficulty)}>{challenge.difficulty}</span>
            <span style={timeStyle}>~{challenge.estimatedMinutes} min</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section style={containerStyle}>
      <pre className="figlet-header" style={{ fontSize: '18px' }}>
        CHALLENGES
      </pre>
      {renderContent()}
    </section>
  );
}
