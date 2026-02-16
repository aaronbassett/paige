/**
 * LearningMaterials -- Dashboard section showing recommended learning
 * materials (articles, videos).
 *
 * Each material renders as a MaterialCard with thumbnail, type badge,
 * title, description, view count, and action buttons (complete, dismiss).
 *
 * Clicking the graduation cap opens a CompletionModal where the learner
 * answers a comprehension question. The answer is validated server-side.
 *
 * Completed materials stay in the list with a trophy badge, faded out,
 * and sorted to the bottom.
 *
 * States:
 *   - Loading (materials === null): "Loading..." text
 *   - Empty (no materials at all): encouragement to complete phases
 *   - Ready: animated list of MaterialCards
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import type { LearningMaterial } from '@shared/types/entities';
import type { WebSocketMessage } from '@shared/types/websocket-messages';
import { MaterialCard } from './materials/MaterialCard';
import { CompletionModal } from './materials/CompletionModal';
import { showCoachingToast } from '../Hints/EditorToast';
import { useWebSocket } from '../../hooks/useWebSocket';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LearningMaterialsProps {
  materials: LearningMaterial[] | null;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const headerStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: 'var(--space-sm)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
  overflowY: 'auto',
  flex: 1,
};

const emptyStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 'var(--text-sm)',
  textAlign: 'center',
  padding: 'var(--space-lg)',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LearningMaterials({ materials }: LearningMaterialsProps) {
  const { send, on } = useWebSocket();
  const [localMaterials, setLocalMaterials] = useState<LearningMaterial[]>(materials ?? []);
  const [modalMaterial, setModalMaterial] = useState<LearningMaterial | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Sync from parent prop
  useEffect(() => {
    if (materials) setLocalMaterials(materials);
  }, [materials]);

  // Listen for server responses
  useEffect(() => {
    const unsubs = [
      on('materials:updated', (msg: WebSocketMessage) => {
        const { id, viewCount, status } = msg.payload as {
          id: number;
          viewCount: number;
          status: string;
        };
        setLocalMaterials((prev) =>
          status === 'dismissed'
            ? prev.filter((m) => m.id !== id)
            : prev.map((m) =>
                m.id === id ? { ...m, viewCount, status: status as LearningMaterial['status'] } : m
              )
        );
      }),
      on('materials:complete_result', (msg: WebSocketMessage) => {
        const { id, correct, message } = msg.payload as {
          id: number;
          correct: boolean;
          message?: string;
        };
        setSubmitting(false);
        if (correct) {
          setFeedback(null);
          setModalMaterial(null);
          // Mark as completed locally instead of removing
          setLocalMaterials((prev) =>
            prev.map((m) => (m.id === id ? { ...m, status: 'completed' as const } : m))
          );
          showCoachingToast({
            messageId: `material-complete-${id}`,
            message: 'Nice work! Material marked as complete.',
            type: 'success',
          });
        } else {
          setFeedback(message ?? 'Not quite \u2014 give the material another read and try again.');
        }
      }),
      on('materials:open_url', (msg: WebSocketMessage) => {
        const { url } = msg.payload as { url: string };
        window.paige.openExternal(url);
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [on]);

  const handleView = useCallback(
    (id: number) => {
      void send('materials:view', { id });
    },
    [send]
  );

  const handleComplete = useCallback(
    (id: number) => {
      const material = localMaterials.find((m) => m.id === id);
      if (material) {
        setFeedback(null);
        setModalMaterial(material);
      }
    },
    [localMaterials]
  );

  const handleDismiss = useCallback(
    (id: number) => {
      void send('materials:dismiss', { id });
    },
    [send]
  );

  const handleSubmitAnswer = useCallback(
    (id: number, answer: string) => {
      setSubmitting(true);
      void send('materials:complete', { id, answer });
    },
    [send]
  );

  // Sort: pending first, completed at the bottom
  const sortedMaterials = useMemo(() => {
    const visible = localMaterials.filter((m) => m.status !== 'dismissed');
    const pending = visible.filter((m) => m.status === 'pending');
    const completed = visible.filter((m) => m.status === 'completed');
    return [...pending, ...completed];
  }, [localMaterials]);

  // Loading state
  if (materials === null) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Learning Materials</div>
        <div style={emptyStyle}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Learning Materials</div>

      {sortedMaterials.length === 0 ? (
        <div style={emptyStyle}>Complete coaching phases to unlock learning materials</div>
      ) : (
        <LayoutGroup>
          <div style={listStyle}>
            <AnimatePresence mode="popLayout">
              {sortedMaterials.map((material) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  onView={handleView}
                  onComplete={handleComplete}
                  onDismiss={handleDismiss}
                />
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      )}

      {modalMaterial && (
        <CompletionModal
          material={modalMaterial}
          onSubmit={handleSubmitAnswer}
          onClose={() => {
            setFeedback(null);
            setModalMaterial(null);
          }}
          submitting={submitting}
          feedback={feedback}
        />
      )}
    </div>
  );
}
