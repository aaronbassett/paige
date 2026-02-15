interface ChallengeViewProps {
  kataId: number;
  onBack: () => void;
}

export function ChallengeView({ kataId, onBack }: ChallengeViewProps) {
  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <p>Challenge view for kata {kataId}</p>
      <button onClick={onBack}>Back</button>
    </div>
  );
}
