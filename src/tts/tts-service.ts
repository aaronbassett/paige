import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { TTSConfig } from './tts-types.js';

export class TTSService {
  private client: ElevenLabsClient;
  private config: TTSConfig;

  constructor(config: TTSConfig) {
    this.config = config;
    this.client = new ElevenLabsClient({ apiKey: config.apiKey });
  }

  /** Whether TTS is enabled and configured. */
  isEnabled(): boolean {
    return this.config.enabled && this.config.apiKey.length > 0;
  }

  /**
   * Stream audio from ElevenLabs for the given text.
   * Calls onChunk for each audio chunk, onComplete when done, onError on failure.
   * Respects AbortSignal for skip/cancel.
   * No-ops if service is disabled.
   */
  async streamSpeech(
    text: string,
    onChunk: (chunk: Buffer, sequence: number) => void,
    onComplete: (totalChunks: number) => void,
    onError: (error: Error) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      const voiceId = this.config.voiceId || this.config.fallbackVoiceId;

      const audioStream = await this.client.textToSpeech.stream(voiceId, {
        text,
        modelId: this.config.model,
        outputFormat: this.config.outputFormat,
      });

      const reader = audioStream.getReader();
      let sequence = 0;

      try {
        for (;;) {
          if (signal?.aborted) break;

          const { done, value } = await reader.read();
          if (done) break;

          onChunk(Buffer.from(value), sequence++);
        }
      } finally {
        reader.releaseLock();
      }

      if (!signal?.aborted) {
        onComplete(sequence);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError(error);
    }
  }
}
