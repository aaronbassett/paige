/**
 * SortButton -- Cycles through sort options on click.
 *
 * Displays the current sort label with a directional arrow indicator.
 * Shared between InProgress and GitHubIssues panels.
 */

export interface SortOption<T extends string = string> {
  key: T;
  label: string;
  direction: 'asc' | 'desc';
}

interface SortButtonProps<T extends string = string> {
  options: SortOption<T>[];
  current: T;
  onChange: (key: T) => void;
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  background: 'none',
  border: '1px solid var(--border-subtle)',
  borderRadius: '4px',
  padding: '4px 8px',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease, color 0.15s ease',
  whiteSpace: 'nowrap',
};

function ArrowIcon({ direction }: { direction: 'asc' | 'desc' }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden="true"
      style={{ transform: direction === 'asc' ? 'rotate(180deg)' : undefined }}
    >
      <path d="M6 8L2 4h8L6 8z" />
    </svg>
  );
}

export function SortButton<T extends string = string>({
  options,
  current,
  onChange,
}: SortButtonProps<T>) {
  const currentIndex = options.findIndex((o) => o.key === current);
  const currentOption = options[currentIndex] ?? options[0];

  const handleClick = () => {
    const nextIndex = (currentIndex + 1) % options.length;
    onChange(options[nextIndex].key);
  };

  return (
    <button
      type="button"
      style={buttonStyle}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
      aria-label={`Sort by ${currentOption.label}`}
      title={`Sort by ${currentOption.label}`}
    >
      {currentOption.label}
      <ArrowIcon direction={currentOption.direction} />
    </button>
  );
}
