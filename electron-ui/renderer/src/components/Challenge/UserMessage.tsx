import { motion } from 'framer-motion';
import MonacoEditor from '@monaco-editor/react';

interface UserMessageProps {
  code: string;
}

export function UserMessage({ code }: UserMessageProps) {
  const lineCount = code.split('\n').length;
  const height = Math.min(Math.max(lineCount * 19, 60), 300);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{
        alignSelf: 'flex-end',
        maxWidth: '85%',
        width: '85%',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <MonacoEditor
        height={height}
        defaultLanguage="typescript"
        value={code}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          folding: false,
          fontSize: 13,
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: { vertical: 'hidden', horizontal: 'auto' },
        }}
      />
    </motion.div>
  );
}
