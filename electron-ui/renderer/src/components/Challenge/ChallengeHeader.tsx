interface ChallengeHeaderProps {
  title: string;
  round: number;
  maxRounds: number;
}

export function ChallengeHeader({ title, round, maxRounds }: ChallengeHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-sm) var(--space-md)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        minHeight: '48px',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-h3-size)',
          color: 'var(--text-primary)',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-small-size)',
          color: 'var(--text-secondary)',
        }}
      >
        <span>
          Round {round}/{maxRounds}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {Array.from({ length: maxRounds }, (_, i) => (
            <div
              key={i}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: i < round ? 'var(--accent-primary)' : 'var(--bg-elevated)',
              }}
            />
          ))}
        </div>
      </div>
    </header>
  );
}
