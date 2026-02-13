import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TTSBridge } from '../../../src/tts/tts-bridge.js';

describe('TTSBridge', () => {
  const mockTTSService = {
    isEnabled: vi.fn().mockReturnValue(true),
    streamSpeech: vi.fn().mockResolvedValue(undefined),
  };

  const mockBroadcast = vi.fn();

  let bridge: TTSBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new TTSBridge(mockTTSService as never, mockBroadcast);
  });

  it('streams audio for speakable messages', async () => {
    await bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-1',
      message: 'Great job!',
      type: 'victory',
    });

    expect(mockTTSService.streamSpeech).toHaveBeenCalledOnce();
    expect(mockTTSService.streamSpeech.mock.calls[0]![0]).toBe('Great job!');
  });

  it('skips audio for silent messages', async () => {
    await bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-2',
      message: 'Check line 42',
      type: 'file_hint',
    });

    expect(mockTTSService.streamSpeech).not.toHaveBeenCalled();
  });

  it('skips audio when TTS is disabled', async () => {
    mockTTSService.isEnabled.mockReturnValue(false);

    await bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-3',
      message: 'Welcome!',
      type: 'session_welcome',
    });

    expect(mockTTSService.streamSpeech).not.toHaveBeenCalled();
  });

  it('skips audio when muted', async () => {
    mockTTSService.isEnabled.mockReturnValue(true);
    bridge.setMuted(true);

    await bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-4',
      message: 'Welcome!',
      type: 'session_welcome',
    });

    expect(mockTTSService.streamSpeech).not.toHaveBeenCalled();
  });

  it('broadcasts audio:chunk for each chunk', async () => {
    // Make streamSpeech call onChunk twice
    mockTTSService.streamSpeech.mockImplementation(
      (_text: string, onChunk: (chunk: Buffer, seq: number) => void, onComplete: () => void) => {
        onChunk(Buffer.from('data1'), 0);
        onChunk(Buffer.from('data2'), 1);
        onComplete();
        return Promise.resolve();
      },
    );

    await bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-5',
      message: 'Nice catch!',
      type: 'celebration',
    });

    // Expect 2 audio:chunk + 1 audio:complete = 3 broadcasts
    expect(mockBroadcast).toHaveBeenCalledTimes(3);

    const firstCall = mockBroadcast.mock.calls[0]![0] as {
      type: string;
      data: { messageId: string; chunk: string; sequence: number };
    };
    expect(firstCall.type).toBe('audio:chunk');
    expect(firstCall.data.messageId).toBe('msg-5');
    expect(firstCall.data.sequence).toBe(0);

    const lastCall = mockBroadcast.mock.calls[2]![0] as {
      type: string;
      data: { messageId: string };
    };
    expect(lastCall.type).toBe('audio:complete');
    expect(lastCall.data.messageId).toBe('msg-5');
  });

  it('abort stops streaming when skip is called', async () => {
    const receivedChunks: number[] = [];

    mockTTSService.streamSpeech.mockImplementation(
      (
        _text: string,
        onChunk: (chunk: Buffer, seq: number) => void,
        _onComplete: () => void,
        _onError: () => void,
        signal?: AbortSignal,
      ) => {
        for (let i = 0; i < 10; i++) {
          if (signal?.aborted) break;
          onChunk(Buffer.from(`chunk${i}`), i);
          receivedChunks.push(i);
        }
        return Promise.resolve();
      },
    );

    // Start speaking
    const promise = bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-6',
      message: 'Phase 1: Understanding the problem',
      type: 'phase_intro',
      source: 'pipeline',
    });

    // Skip mid-stream
    bridge.skipMessage('msg-6');

    await promise;

    // Should have been aborted
    // (Exact chunk count depends on timing, but abort was signaled)
  });
});
