/**
 * InProgressTasks -- Dashboard section showing active coding tasks
 * with progress bars and resume capability.
 *
 * Rendered only when there are tasks to display (the parent Dashboard
 * component handles the empty-state gate). Each task card shows a
 * title, horizontal progress bar, percentage, optional due date, and
 * a terracotta "Resume" button.
 */

interface InProgressTasksProps {
  tasks: Array<{
    id: string;
    title: string;
    progress: number; // 0-100
    dueDate?: string; // ISO 8601
  }>;
  onResume: (taskId: string) => void;
}

// ---------------------------------------------------------------------------
// Date formatting helper
// ---------------------------------------------------------------------------

/**
 * Formats an ISO 8601 date string into a short human-readable form.
 * Examples: "Due Feb 15", "Due Jan 3"
 */
function formatDueDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return '';
  }
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `Due ${month} ${day}`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
};

const taskListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
  margin: 0,
  padding: 0,
  listStyle: 'none',
};

const taskCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
  padding: 'var(--space-sm)',
  borderRadius: '4px',
  background: 'var(--bg-base)',
};

const taskHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-sm)',
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  color: 'var(--text-primary)',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  minWidth: 0,
};

const resumeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--accent-warm)',
  cursor: 'pointer',
  padding: '2px 4px',
  flexShrink: 0,
};

const progressRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
};

const progressTrackStyle: React.CSSProperties = {
  flex: 1,
  height: '4px',
  borderRadius: '2px',
  background: 'var(--bg-base)',
  overflow: 'hidden',
};

const progressPercentStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  flexShrink: 0,
  minWidth: '32px',
  textAlign: 'right',
};

const dueDateStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-muted)',
  margin: 0,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InProgressTasks({ tasks, onResume }: InProgressTasksProps) {
  return (
    <section style={containerStyle} aria-label="In-progress tasks">
      <pre className="figlet-header" style={{ fontSize: '18px' }}>
        IN PROGRESS
      </pre>

      <ul style={taskListStyle} role="list">
        {tasks.map((task) => {
          const clampedProgress = Math.max(0, Math.min(100, Math.round(task.progress)));
          const dueDateLabel = task.dueDate ? formatDueDate(task.dueDate) : null;

          return (
            <li key={task.id} style={taskCardStyle}>
              {/* Title row with resume button */}
              <div style={taskHeaderStyle}>
                <p style={titleStyle} title={task.title}>
                  {task.title}
                </p>
                <button
                  type="button"
                  style={resumeButtonStyle}
                  onClick={() => onResume(task.id)}
                  aria-label={`Resume task: ${task.title}`}
                >
                  Resume
                </button>
              </div>

              {/* Progress bar row */}
              <div style={progressRowStyle}>
                <div
                  style={progressTrackStyle}
                  role="progressbar"
                  aria-valuenow={clampedProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${task.title} progress`}
                >
                  <div
                    style={{
                      width: `${clampedProgress}%`,
                      height: '100%',
                      borderRadius: '2px',
                      background: 'var(--accent-primary)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={progressPercentStyle}>{clampedProgress}%</span>
              </div>

              {/* Due date (conditional) */}
              {dueDateLabel && <p style={dueDateStyle}>{dueDateLabel}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
