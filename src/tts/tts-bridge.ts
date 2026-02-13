import type { TTSService } from './tts-service.js';
import type { SpeakableMessage } from './tts-types.js';
import type { ServerToClientMessage } from '../types/websocket.js';
import { shouldSpeak } from './priority-engine.js';

interface BridgeMessage extends SpeakableMessage {
  readonly messageId: string;
}

type BroadcastFn = (message: ServerToClientMessage) => void;

/**
 * Bridges coaching messages to the TTS service.
 * Evaluates priority rules and streams audio chunks to WebSocket clients.
 */
export class TTSBridge {
  private ttsService: TTSService;
  private broadcast: BroadcastFn;
  private muted = false;
  private activeAbortControllers = new Map<string, AbortController>();

  constructor(ttsService: TTSService, broadcast: BroadcastFn) {
    this.ttsService = ttsService;
    this.broadcast = broadcast;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Abort an in-progress TTS stream for a given messageId. */
  skipMessage(messageId: string): void {
    const controller = this.activeAbortControllers.get(messageId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(messageId);
    }
  }

  /**
   * Evaluate a coaching message and stream TTS audio if appropriate.
   * This method is fire-and-forget — errors are caught silently.
   */
  async maybeSpeakCoachingMessage(msg: BridgeMessage): Promise<void> {
    if (!this.ttsService.isEnabled()) return;
    if (this.muted) return;
    if (!shouldSpeak(msg)) return;

    const controller = new AbortController();
    this.activeAbortControllers.set(msg.messageId, controller);

    await this.ttsService.streamSpeech(
      msg.message,
      (chunk, sequence) => {
        this.broadcast({
          type: 'audio:chunk',
          data: {
            messageId: msg.messageId,
            chunk: chunk.toString('base64'),
            sequence,
          },
        } as ServerToClientMessage);
      },
      (totalChunks) => {
        this.activeAbortControllers.delete(msg.messageId);
        this.broadcast({
          type: 'audio:complete',
          data: {
            messageId: msg.messageId,
            totalChunks,
            durationMs: 0, // ElevenLabs doesn't provide duration in streaming mode
          },
        } as ServerToClientMessage);
      },
      (error) => {
        this.activeAbortControllers.delete(msg.messageId);
        // eslint-disable-next-line no-console
        console.error('[TTSBridge] TTS error (silent degradation):', error.message);
      },
      controller.signal,
    );
  }
}
