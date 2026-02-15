import { motion } from 'framer-motion';

interface AiMessageProps {
  content: string;
  type: 'challenge' | 'review';
}

export function AiMessage({ content, type }: AiMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{
        alignSelf: 'flex-start',
        maxWidth: '85%',
        padding: 'var(--space-sm) var(--space-md)',
        background: 'var(--bg-surface)',
        borderRadius: '8px',
        borderLeft: type === 'challenge' ? '3px solid var(--accent-primary)' : 'none',
        fontFamily: 'var(--font-family)',
        fontSize: 'var(--font-body-size)',
        color: 'var(--text-primary)',
        lineHeight: 1.6,
      }}
    >
      <pre
        style={{
          margin: 0,
          fontFamily: 'inherit',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
      </pre>
    </motion.div>
  );
}
