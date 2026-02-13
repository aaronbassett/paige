/**
 * AudioPlayer receives streamed audio chunks and plays them via Web Audio API.
 *
 * Supports mute/unmute, skip, and replay of the last message. Chunks arrive
 * as base64-encoded MP3 data from WebSocket `audio:chunk` messages. Playback
 * starts after an initial buffer of 3 chunks to avoid stuttering.
 *
 * State changes are observable via `onStateChange` so React hooks can
 * subscribe and trigger re-renders.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioPlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  currentMessageId: string | null;
  hasLastAudio: boolean;
  lastMessageId: string | null;
}

type StateChangeListener = (state: AudioPlayerState) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of chunks to buffer before starting playback. */
const PLAYBACK_BUFFER_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// AudioPlayer
// ---------------------------------------------------------------------------

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private chunks = new Map<string, Uint8Array[]>();
  private currentSource: AudioBufferSourceNode | null = null;
  private state: AudioPlayerState = {
    isPlaying: false,
    isMuted: false,
    currentMessageId: null,
    hasLastAudio: false,
    lastMessageId: null,
  };
  private lastAudioData: Uint8Array | null = null;
  private listeners = new Set<StateChangeListener>();

  // -------------------------------------------------------------------------
  // AudioContext lifecycle
  // -------------------------------------------------------------------------

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  // -------------------------------------------------------------------------
  // Public API: State
  // -------------------------------------------------------------------------

  /** Return a snapshot of the current player state. */
  getState(): AudioPlayerState {
    return { ...this.state };
  }

  /**
   * Register a listener for state changes.
   * Returns an unsubscribe function.
   */
  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // -------------------------------------------------------------------------
  // Public API: Controls
  // -------------------------------------------------------------------------

  /** Mute playback. Stops any active audio immediately. */
  mute(): void {
    this.setState({ isMuted: true });
    this.stopCurrentPlayback();
  }

  /** Unmute playback. Does not automatically resume; future chunks will play. */
  unmute(): void {
    this.setState({ isMuted: false });
  }

  /** Skip the currently playing / buffering audio. Discards buffered chunks. */
  skip(): void {
    this.stopCurrentPlayback();
    const messageId = this.state.currentMessageId;
    if (messageId) {
      this.chunks.delete(messageId);
    }
    this.setState({ isPlaying: false, currentMessageId: null });
  }

  /** Replay the last complete audio message. No-op if muted or no audio stored. */
  async replayLast(): Promise<void> {
    if (!this.lastAudioData || this.state.isMuted) return;
    await this.playBuffer(this.lastAudioData);
  }

  // -------------------------------------------------------------------------
  // Public API: Streaming
  // -------------------------------------------------------------------------

  /**
   * Add a base64-encoded audio chunk for a given message.
   *
   * Chunks are buffered and playback starts after `PLAYBACK_BUFFER_THRESHOLD`
   * chunks have arrived (unless muted).
   */
  addChunk(messageId: string, base64Chunk: string): void {
    // Decode base64 to binary
    const binary = atob(base64Chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Store chunk
    const existing = this.chunks.get(messageId) ?? [];
    existing.push(bytes);
    this.chunks.set(messageId, existing);

    this.setState({ currentMessageId: messageId });

    // Start playback after initial buffering if not muted
    if (
      !this.state.isMuted &&
      existing.length === PLAYBACK_BUFFER_THRESHOLD &&
      !this.state.isPlaying
    ) {
      this.startPlayback(messageId).catch(() => {
        // Silent degradation -- audio decode or playback failed
      });
    }
  }

  /**
   * Mark a message's audio stream as complete.
   *
   * Concatenates all chunks for replay and triggers playback if we
   * haven't started yet (fewer than PLAYBACK_BUFFER_THRESHOLD chunks arrived).
   */
  complete(messageId: string): void {
    const messageChunks = this.chunks.get(messageId);
    if (messageChunks) {
      // Concatenate all chunks for replay
      const totalLength = messageChunks.reduce((acc, c) => acc + c.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of messageChunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      this.lastAudioData = combined;
      this.setState({ hasLastAudio: true, lastMessageId: messageId });
    }

    this.chunks.delete(messageId);

    // If we haven't started playing yet (< threshold chunks), play now
    if (!this.state.isPlaying && this.lastAudioData && !this.state.isMuted) {
      this.playBuffer(this.lastAudioData).catch(() => {
        // Silent degradation
      });
    }

    if (this.state.currentMessageId === messageId) {
      this.setState({ isPlaying: false, currentMessageId: null });
    }
  }

  // -------------------------------------------------------------------------
  // Internal: State management
  // -------------------------------------------------------------------------

  private setState(partial: Partial<AudioPlayerState>): void {
    Object.assign(this.state, partial);
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  // -------------------------------------------------------------------------
  // Internal: Playback
  // -------------------------------------------------------------------------

  private stopCurrentPlayback(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already stopped
      }
      this.currentSource = null;
    }
  }

  private async startPlayback(messageId: string): Promise<void> {
    const messageChunks = this.chunks.get(messageId);
    if (!messageChunks || messageChunks.length === 0) return;

    // Concatenate available chunks
    const totalLength = messageChunks.reduce((acc, c) => acc + c.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of messageChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    await this.playBuffer(combined);
  }

  private async playBuffer(data: Uint8Array): Promise<void> {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioBuffer = await ctx.decodeAudioData(data.buffer.slice(0) as ArrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      this.currentSource = source;
      this.setState({ isPlaying: true });

      source.onended = () => {
        this.currentSource = null;
        this.setState({ isPlaying: false });
      };

      source.start(0);
    } catch {
      // Silent degradation -- audio decode or playback failed
      this.setState({ isPlaying: false });
    }
  }
}
