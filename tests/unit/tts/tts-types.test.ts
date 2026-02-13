import { describe, it, expect } from 'vitest';
import type {
  AudioChunkData,
  AudioCompleteData,
  AudioControlData,
} from '../../../src/tts/tts-types.js';
import type {
  AudioChunkMessage,
  AudioCompleteMessage,
  AudioControlMessage,
} from '../../../src/types/websocket.js';

describe('TTS types', () => {
  it('AudioChunkData has required fields', () => {
    const data: AudioChunkData = {
      messageId: 'msg-1',
      chunk: 'base64data',
      sequence: 0,
    };
    expect(data.messageId).toBe('msg-1');
    expect(data.chunk).toBe('base64data');
    expect(data.sequence).toBe(0);
  });

  it('AudioCompleteData has required fields', () => {
    const data: AudioCompleteData = {
      messageId: 'msg-1',
      totalChunks: 5,
      durationMs: 2400,
    };
    expect(data.messageId).toBe('msg-1');
    expect(data.totalChunks).toBe(5);
    expect(data.durationMs).toBe(2400);
  });

  it('AudioControlData has required fields', () => {
    const data: AudioControlData = {
      action: 'skip',
      messageId: 'msg-1',
    };
    expect(data.action).toBe('skip');
    expect(data.messageId).toBe('msg-1');
  });

  it('AudioControlData allows optional messageId', () => {
    const data: AudioControlData = {
      action: 'mute',
    };
    expect(data.action).toBe('mute');
    expect(data.messageId).toBeUndefined();
  });

  it('AudioChunkMessage has correct type literal', () => {
    const msg: AudioChunkMessage = {
      type: 'audio:chunk',
      data: { messageId: 'msg-1', chunk: 'base64data', sequence: 0 },
    };
    expect(msg.type).toBe('audio:chunk');
  });

  it('AudioCompleteMessage has correct type literal', () => {
    const msg: AudioCompleteMessage = {
      type: 'audio:complete',
      data: { messageId: 'msg-1', totalChunks: 5, durationMs: 2400 },
    };
    expect(msg.type).toBe('audio:complete');
  });

  it('AudioControlMessage has correct type literal', () => {
    const msg: AudioControlMessage = {
      type: 'audio:control',
      data: { action: 'mute' },
    };
    expect(msg.type).toBe('audio:control');
  });
});
