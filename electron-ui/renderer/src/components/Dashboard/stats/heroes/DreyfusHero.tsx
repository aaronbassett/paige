import type { StatDefinition, StatPayload } from '../types';

const DREYFUS_LEVELS = ['Novice', 'Advanced Beginner', 'Competent', 'Proficient', 'Expert'];

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
  height: '100%',
};
const headerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};
const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};
const currentLevelStyle: React.CSSProperties = {
  fontSize: 'var(--font-display-size)',
  color: 'var(--text-primary)',
  fontWeight: 700,
  lineHeight: 1.2,
};
const timelineStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  flex: 1,
  overflow: 'hidden',
};
const nodeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  position: 'relative',
  paddingLeft: '6px',
};
const nodeColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '12px',
  flexShrink: 0,
};
const lineSegmentStyle: React.CSSProperties = {
  width: '2px',
  height: '10px',
  backgroundColor: 'var(--border-subtle)',
};
const nodeTextStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  paddingTop: '4px',
  paddingBottom: '4px',
};
const levelNameStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)',
  fontWeight: 600,
  lineHeight: 1.3,
};
const skillStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  lineHeight: 1.3,
};

type NodeStatus = 'passed' | 'current' | 'future';

function getNodeColor(status: NodeStatus): string {
  switch (status) {
    case 'passed':
      return 'var(--status-success)';
    case 'current':
      return 'var(--accent-primary)';
    case 'future':
      return 'var(--text-muted)';
  }
}

function TimelineNode({
  level,
  skill,
  status,
  isFirst,
  isLast,
}: {
  level: string;
  skill: string;
  status: NodeStatus;
  isFirst: boolean;
  isLast: boolean;
}) {
  const dotStyle: React.CSSProperties = {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: getNodeColor(status),
    flexShrink: 0,
    border: status === 'current' ? '2px solid var(--accent-primary)' : 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={nodeRowStyle}>
      <div style={nodeColumnStyle}>
        {!isFirst && <div style={lineSegmentStyle} />}
        <div style={dotStyle} />
        {!isLast && <div style={lineSegmentStyle} />}
      </div>
      <div style={nodeTextStyle}>
        <span
          style={{
            ...levelNameStyle,
            color:
              status === 'future'
                ? 'var(--text-muted)'
                : 'var(--text-primary)',
          }}
        >
          {level}
        </span>
        {skill && <span style={skillStyle}>{skill}</span>}
      </div>
    </div>
  );
}

export function DreyfusHero({
  stat,
  data,
}: {
  stat: StatDefinition;
  data: StatPayload;
}) {
  const Icon = stat.icon;
  const currentLevel = typeof data.value === 'string' ? data.value : 'Novice';
  const progression = data.progression ?? [];

  // Build timeline nodes from progression data, filling in from DREYFUS_LEVELS
  const currentIndex = DREYFUS_LEVELS.indexOf(currentLevel);
  const nodes = DREYFUS_LEVELS.map((level, i) => {
    const match = progression.find((p) => p.level === level);
    let status: NodeStatus;
    if (i < currentIndex) {
      status = 'passed';
    } else if (i === currentIndex) {
      status = 'current';
    } else {
      status = 'future';
    }
    return { level, skill: match?.skill ?? '', status };
  });

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={labelStyle}>
          <Icon size={16} color="var(--text-muted)" />
          {stat.label}
        </span>
        <span style={currentLevelStyle}>{currentLevel}</span>
      </div>
      <div style={timelineStyle}>
        {nodes.map((node, i) => (
          <TimelineNode
            key={node.level}
            level={node.level}
            skill={node.skill}
            status={node.status}
            isFirst={i === 0}
            isLast={i === nodes.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
