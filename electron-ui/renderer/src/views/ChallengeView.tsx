import { useState, useEffect, useCallback } from 'react';
import type {
  ChallengeLoadedMessage,
  ChallengeLoadErrorMessage,
  WebSocketMessage,
} from '@shared/types/websocket-messages';
import { useWebSocket } from '../hooks/useWebSocket';
import { ChallengeHeader } from '../components/Challenge/ChallengeHeader';
import { ChatThread, type ChatMessage } from '../components/Challenge/ChatThread';
import { CodeInput } from '../components/Challenge/CodeInput';

interface ChallengeViewProps {
  kataId: number;
  onBack: () => void;
}

interface KataConstraint {
  id: string;
  description: string;
}

interface KataData {
  title: string;
  description: string;
  scaffoldingCode: string;
  constraints: KataConstraint[];
}

const MAX_ROUNDS = 4;

export function ChallengeView({ kataId, onBack }: ChallengeViewProps) {
  const { send, on } = useWebSocket();

  const [kata, setKata] = useState<KataData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConstraints, setActiveConstraints] = useState<string[]>([]);
  const [round, setRound] = useState(1);
  const [status, setStatus] = useState<'loading' | 'idle' | 'submitting' | 'complete' | 'error'>(
    'loading'
  );
  const [editorValue, setEditorValue] = useState('');

  // Load kata on mount
  useEffect(() => {
    send('challenge:load', { kataId });
  }, [kataId, send]);

  // Listen for challenge:loaded
  useEffect(() => {
    const unsubLoaded = on('challenge:loaded', (msg: WebSocketMessage) => {
      const m = msg as ChallengeLoadedMessage;
      if (m.payload.kataId !== kataId) return;

      const kataData: KataData = {
        title: m.payload.title,
        description: m.payload.description,
        scaffoldingCode: m.payload.scaffoldingCode,
        constraints: m.payload.constraints,
      };

      setKata(kataData);
      setEditorValue(kataData.scaffoldingCode);
      setMessages([{ role: 'ai', content: kataData.description, type: 'challenge' }]);
      setStatus('idle');
    });

    const unsubError = on('challenge:load_error', (msg: WebSocketMessage) => {
      const m = msg as ChallengeLoadErrorMessage;
      setMessages([{ role: 'ai', content: `Error: ${m.payload.error}`, type: 'review' }]);
      setStatus('error');
    });

    return () => {
      unsubLoaded();
      unsubError();
    };
  }, [kataId, on]);

  // Listen for practice:solution_review
  useEffect(() => {
    const unsub = on('practice:solution_review', (msg: WebSocketMessage) => {
      const data = msg.payload as {
        review: string;
        level: number;
        passed: boolean;
        constraintsUnlocked: string[];
      };

      if (data.passed) {
        // Use functional state updates to read current values
        setActiveConstraints((prevConstraints) => {
          const nextConstraintIndex = prevConstraints.length;

          setRound((prevRound) => {
            // Access kata via closure — it's stable once set
            if (!kata) return prevRound;

            if (prevRound >= MAX_ROUNDS || nextConstraintIndex >= kata.constraints.length) {
              // Challenge complete
              setMessages((prev) => [
                ...prev,
                { role: 'ai', content: data.review, type: 'review' as const },
                {
                  role: 'ai',
                  content: 'Challenge complete! Great work progressing through all the rounds.',
                  type: 'review' as const,
                },
              ]);
              setStatus('complete');
              return prevRound;
            }

            // Next round: add next constraint
            const nextConstraint = kata.constraints[nextConstraintIndex];

            setMessages((prev) => [
              ...prev,
              { role: 'ai', content: data.review, type: 'review' as const },
              {
                role: 'ai',
                content: `Nice work! Now try it again with this added constraint:\n\n> ${nextConstraint.description}`,
                type: 'challenge' as const,
              },
            ]);
            setEditorValue(kata.scaffoldingCode);
            setStatus('idle');

            return prevRound + 1;
          });

          // Return updated constraints for next round
          if (!kata) return prevConstraints;
          const nextIndex = prevConstraints.length;
          if (nextIndex >= kata.constraints.length) return prevConstraints;
          return [...prevConstraints, kata.constraints[nextIndex].id];
        });
      } else {
        // Failed — keep same round, re-enable editor with their code
        setMessages((prev) => [...prev, { role: 'ai', content: data.review, type: 'review' }]);
        setStatus('idle');
      }
    });

    const unsubError = on('review:error', (msg: WebSocketMessage) => {
      const data = msg.payload as { error: string };
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: `Review error: ${data.error}. Try submitting again.`,
          type: 'review',
        },
      ]);
      setStatus('idle');
    });

    return () => {
      unsub();
      unsubError();
    };
  }, [kata, on]);

  const handleSubmit = useCallback(() => {
    if (status !== 'idle' || !editorValue.trim()) return;

    setStatus('submitting');
    setMessages((prev) => [...prev, { role: 'user', code: editorValue }]);
    send('practice:submit_solution', {
      kataId,
      code: editorValue,
      activeConstraints,
    });
  }, [status, editorValue, kataId, activeConstraints, send]);

  if (status === 'loading') {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-family)',
          color: 'var(--text-secondary)',
        }}
      >
        Loading challenge...
      </div>
    );
  }

  const maxRounds = kata ? Math.min(MAX_ROUNDS, kata.constraints.length + 1) : MAX_ROUNDS;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ChallengeHeader title={kata?.title ?? 'Challenge'} round={round} maxRounds={maxRounds} />
      <ChatThread messages={messages} />
      {status === 'complete' ? (
        <div
          style={{
            padding: 'var(--space-md)',
            textAlign: 'center',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}
        >
          <button
            onClick={onBack}
            style={{
              padding: 'var(--space-sm) var(--space-lg)',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-body-size)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to Dashboard
          </button>
        </div>
      ) : (
        <CodeInput
          value={editorValue}
          onChange={setEditorValue}
          onSubmit={handleSubmit}
          disabled={status === 'submitting'}
        />
      )}
    </div>
  );
}
