/**
 * React hook bridging WebSocket audio messages to the AudioPlayer service.
 *
 * Subscribes to `audio:chunk` and `audio:complete` server messages,
 * forwards them to the AudioPlayer, and exposes mute/unmute/skip/replayLast
 * actions that both control the player and notify the backend via
 * `audio:control` messages.
 *
 * Usage:
 * ```tsx
 * function AudioControls() {
 *   const { isPlaying, isMuted, mute, unmute, skip, replayLast } = useAudioPlayback();
 *   // render controls based on state
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { AudioPlayer, type AudioPlayerState } from '../services/audio-player';
import type { WebSocketMessage } from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseAudioPlaybackReturn extends AudioPlayerState {
  mute: () => void;
  unmute: () => void;
  skip: () => void;
  replayLast: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_STATE: AudioPlayerState = {
  isPlaying: false,
  isMuted: false,
  currentMessageId: null,
  hasLastAudio: false,
  lastMessageId: null,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAudioPlayback(): UseAudioPlaybackReturn {
  const { on, send } = useWebSocket();
  const playerRef = useRef<AudioPlayer | null>(null);
  const [state, setState] = useState<AudioPlayerState>(INITIAL_STATE);

  // Lazy-init the player (avoid creating AudioContext during SSR/test import)
  if (!playerRef.current) {
    playerRef.current = new AudioPlayer();
  }

  useEffect(() => {
    const player = playerRef.current!;

    const unsubChunk = on('audio:chunk', (msg: WebSocketMessage) => {
      if (msg.type !== 'audio:chunk') return;
      const payload = msg.payload as { messageId: string; chunk: string; sequence: number };
      player.addChunk(payload.messageId, payload.chunk);
    });

    const unsubComplete = on('audio:complete', (msg: WebSocketMessage) => {
      if (msg.type !== 'audio:complete') return;
      const payload = msg.payload as { messageId: string };
      player.complete(payload.messageId);
    });

    const unsubState = player.onStateChange(setState);

    return () => {
      unsubChunk();
      unsubComplete();
      unsubState();
    };
  }, [on]);

  const mute = useCallback(() => {
    playerRef.current?.mute();
    send('audio:control', { action: 'mute' });
  }, [send]);

  const unmute = useCallback(() => {
    playerRef.current?.unmute();
    send('audio:control', { action: 'unmute' });
  }, [send]);

  const skip = useCallback(() => {
    const messageId = playerRef.current?.getState().currentMessageId;
    playerRef.current?.skip();
    if (messageId) {
      send('audio:control', { action: 'skip', messageId });
    }
  }, [send]);

  const replayLast = useCallback(() => {
    playerRef.current?.replayLast();
  }, []);

  return { ...state, mute, unmute, skip, replayLast };
}
