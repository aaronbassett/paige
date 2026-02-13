// TTS configuration and shared types

export interface TTSConfig {
  readonly apiKey: string;
  readonly voiceId: string;
  readonly fallbackVoiceId: string;
  readonly model: 'eleven_turbo_v2';
  readonly outputFormat: 'mp3_44100_128';
  readonly enabled: boolean;
}

export type SpeechPriority = 'speak' | 'silent';

export interface PriorityRule {
  readonly match: (msg: SpeakableMessage) => boolean;
  readonly priority: SpeechPriority;
  readonly reason: string;
}

/** Minimal message shape needed for priority evaluation. */
export interface SpeakableMessage {
  readonly message: string;
  readonly type: string;
  readonly source?: string;
  readonly anchor?: unknown;
}

/** Data payload for audio:chunk server->client message. */
export interface AudioChunkData {
  readonly messageId: string;
  readonly chunk: string; // Base64-encoded MP3 audio
  readonly sequence: number; // 0-indexed chunk ordering
}

/** Data payload for audio:complete server->client message. */
export interface AudioCompleteData {
  readonly messageId: string;
  readonly totalChunks: number;
  readonly durationMs: number;
}

/** Data payload for audio:control client->server message. */
export interface AudioControlData {
  readonly action: 'mute' | 'unmute' | 'skip';
  readonly messageId?: string; // Required for 'skip'
}
