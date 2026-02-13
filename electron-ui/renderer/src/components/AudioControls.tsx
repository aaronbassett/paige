/**
 * AudioControls — Speaker/skip/replay controls for TTS playback.
 *
 * Renders inline in the status bar between file info and review button.
 * - Mute toggle is always visible (speaker icon).
 * - Skip button appears only during playback.
 * - Replay button appears only when last audio exists and not currently playing.
 *
 * Keyboard shortcuts (Cmd+M, Cmd+., Cmd+Shift+.) are handled by
 * useKeyboardShortcuts, not by this component.
 */

import type React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioControlsProps {
  isMuted: boolean;
  isPlaying: boolean;
  hasLastAudio: boolean;
  onMute: () => void;
  onUnmute: () => void;
  onSkip: () => void;
  onReplay: () => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const buttonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family, monospace), monospace',
  fontSize: 'var(--font-small-size, 12px)',
  padding: '0 4px',
  cursor: 'pointer',
  lineHeight: '1.4',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AudioControls({
  isMuted,
  isPlaying,
  hasLastAudio,
  onMute,
  onUnmute,
  onSkip,
  onReplay,
}: AudioControlsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      <button
        type="button"
        style={{
          ...buttonStyle,
          opacity: isPlaying && !isMuted ? 1 : 0.7,
        }}
        onClick={isMuted ? onUnmute : onMute}
        aria-label="Toggle mute"
        title={isMuted ? 'Unmute Paige (Cmd+M)' : 'Mute Paige (Cmd+M)'}
      >
        {isMuted ? '\u{1F507}' : '\u{1F50A}'}
      </button>

      {isPlaying && (
        <button
          type="button"
          style={buttonStyle}
          onClick={onSkip}
          aria-label="Skip audio"
          title="Skip (Cmd+.)"
        >
          {'\u23ED'}
        </button>
      )}

      {hasLastAudio && !isPlaying && (
        <button
          type="button"
          style={buttonStyle}
          onClick={onReplay}
          aria-label="Replay last"
          title="Replay (Cmd+Shift+.)"
        >
          {'\u{1F501}'}
        </button>
      )}
    </div>
  );
}
