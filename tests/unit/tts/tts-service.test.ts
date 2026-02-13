import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TTSService } from '../../../src/tts/tts-service.js';

// Mock the @elevenlabs/elevenlabs-js module with a proper class
const mockStream = vi.fn();

vi.mock('@elevenlabs/elevenlabs-js', () => {
  return {
    ElevenLabsClient: class MockElevenLabsClient {
      textToSpeech = { stream: mockStream };
    },
  };
});

describe('TTSService', () => {
  let service: TTSService;

  beforeEach(() => {
    mockStream.mockReset();

    service = new TTSService({
      apiKey: 'sk_test',
      voiceId: 'voice_123',
      fallbackVoiceId: 'voice_fallback',
      model: 'eleven_turbo_v2',
      outputFormat: 'mp3_44100_128',
      enabled: true,
    });
  });

  it('constructs without error', () => {
    expect(service).toBeDefined();
  });

  it('isEnabled returns true when enabled', () => {
    expect(service.isEnabled()).toBe(true);
  });

  it('isEnabled returns false when disabled', () => {
    const disabled = new TTSService({
      apiKey: 'sk_test',
      voiceId: 'voice_123',
      fallbackVoiceId: 'voice_fallback',
      model: 'eleven_turbo_v2',
      outputFormat: 'mp3_44100_128',
      enabled: false,
    });
    expect(disabled.isEnabled()).toBe(false);
  });

  it('isEnabled returns false when apiKey is missing', () => {
    const noKey = new TTSService({
      apiKey: '',
      voiceId: 'voice_123',
      fallbackVoiceId: 'voice_fallback',
      model: 'eleven_turbo_v2',
      outputFormat: 'mp3_44100_128',
      enabled: true,
    });
    expect(noKey.isEnabled()).toBe(false);
  });

  it('streamSpeech calls onChunk for each chunk', async () => {
    // Create a mock ReadableStream that yields 3 chunks
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
      new Uint8Array([7, 8, 9]),
    ];
    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    mockStream.mockResolvedValue(readableStream);

    const receivedChunks: Array<{ chunk: Buffer; sequence: number }> = [];
    let completeCalled = false;

    await service.streamSpeech(
      'Hello world',
      (chunk, sequence) => receivedChunks.push({ chunk, sequence }),
      () => {
        completeCalled = true;
      },
      () => {},
    );

    expect(receivedChunks).toHaveLength(3);
    expect(receivedChunks[0]!.sequence).toBe(0);
    expect(receivedChunks[1]!.sequence).toBe(1);
    expect(receivedChunks[2]!.sequence).toBe(2);
    expect(completeCalled).toBe(true);
  });

  it('streamSpeech calls onError on API failure', async () => {
    mockStream.mockRejectedValue(new Error('API rate limit'));

    let capturedError: Error | null = null;

    await service.streamSpeech(
      'Hello world',
      () => {},
      () => {},
      (error) => {
        capturedError = error;
      },
    );

    expect(capturedError).not.toBeNull();
    expect(capturedError!.message).toBe('API rate limit');
  });

  it('streamSpeech is a no-op when disabled', async () => {
    const disabled = new TTSService({
      apiKey: 'sk_test',
      voiceId: 'voice_123',
      fallbackVoiceId: 'voice_fallback',
      model: 'eleven_turbo_v2',
      outputFormat: 'mp3_44100_128',
      enabled: false,
    });

    const onChunk = vi.fn();
    const onComplete = vi.fn();

    await disabled.streamSpeech('Hello', onChunk, onComplete, () => {});

    expect(onChunk).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('abort signal stops chunk delivery', async () => {
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
      new Uint8Array([7, 8, 9]),
    ];
    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    mockStream.mockResolvedValue(readableStream);

    const controller = new AbortController();
    const receivedChunks: Buffer[] = [];

    // Abort after first chunk
    await service.streamSpeech(
      'Hello world',
      (chunk, _seq) => {
        receivedChunks.push(chunk);
        controller.abort();
      },
      () => {},
      () => {},
      controller.signal,
    );

    expect(receivedChunks.length).toBeLessThanOrEqual(1);
  });
});
