import { describe, it, expect } from 'vitest';
import type {
  AudioChunkMessage,
  AudioCompleteMessage,
  AudioControlMessage,
} from '@shared/types/websocket-messages';

describe('Audio WebSocket message types', () => {
  it('AudioChunkMessage has correct shape', () => {
    const msg: AudioChunkMessage = {
      type: 'audio:chunk',
      payload: { messageId: 'msg-1', chunk: 'base64', sequence: 0 },
      timestamp: Date.now(),
    };
    expect(msg.type).toBe('audio:chunk');
  });

  it('AudioCompleteMessage has correct shape', () => {
    const msg: AudioCompleteMessage = {
      type: 'audio:complete',
      payload: { messageId: 'msg-1', totalChunks: 5, durationMs: 2400 },
      timestamp: Date.now(),
    };
    expect(msg.type).toBe('audio:complete');
  });

  it('AudioControlMessage has correct shape', () => {
    const msg: AudioControlMessage = {
      type: 'audio:control',
      payload: { action: 'skip', messageId: 'msg-1' },
      timestamp: Date.now(),
    };
    expect(msg.type).toBe('audio:control');
  });
});
