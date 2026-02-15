import MonacoEditor from '@monaco-editor/react';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

export function CodeInput({ value, onChange, onSubmit, disabled }: CodeInputProps) {
  return (
    <div
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        padding: 'var(--space-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-xs)',
      }}
    >
      <div style={{ height: '200px', borderRadius: '6px', overflow: 'hidden' }}>
        <MonacoEditor
          height="200px"
          defaultLanguage="typescript"
          value={value}
          onChange={(v) => onChange(v ?? '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            fontSize: 13,
            padding: { top: 8, bottom: 8 },
            readOnly: disabled,
            wordWrap: 'on',
          }}
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={disabled}
        style={{
          width: '100%',
          padding: 'var(--space-sm)',
          background: disabled ? 'var(--bg-elevated)' : 'var(--accent-primary)',
          color: disabled ? 'var(--text-muted)' : '#ffffff',
          border: 'none',
          borderRadius: '6px',
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-body-size)',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s ease',
        }}
      >
        {disabled ? 'Reviewing...' : 'Submit Solution'}
      </button>
    </div>
  );
}
