import { useRef, useEffect } from 'react';
import { AiMessage } from './AiMessage';
import { UserMessage } from './UserMessage';

export type ChatMessage =
  | { role: 'ai'; content: string; type: 'challenge' | 'review' }
  | { role: 'user'; code: string };

interface ChatThreadProps {
  messages: ChatMessage[];
}

export function ChatThread({ messages }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
      }}
    >
      {messages.map((msg, i) =>
        msg.role === 'ai' ? (
          <AiMessage key={i} content={msg.content} type={msg.type} />
        ) : (
          <UserMessage key={i} code={msg.code} />
        )
      )}
      <div ref={bottomRef} />
    </div>
  );
}
