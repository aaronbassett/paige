/**
 * Unit tests for the AudioPlayer service.
 *
 * Tests the AudioPlayer class (state management, mute/unmute, chunk buffering,
 * skip, complete, replay, and state change listeners).
 *
 * The Web Audio API (AudioContext) is mocked since it is not available in
 * the Node.js/happy-dom test environment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioPlayer } from '../../../renderer/src/services/audio-player';

// ---------------------------------------------------------------------------
// Mock AudioContext (not available in Node.js test environment)
// ---------------------------------------------------------------------------

const mockDecodeAudioData = vi.fn().mockResolvedValue({ duration: 1.0, length: 44100 });
const mockCreateBufferSource = vi.fn().mockReturnValue({
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  buffer: null,
  onended: null,
});
const mockResume = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal(
  'AudioContext',
  vi.fn().mockImplementation(() => ({
    decodeAudioData: mockDecodeAudioData,
    createBufferSource: mockCreateBufferSource,
    resume: mockResume,
    destination: {},
    state: 'running',
  }))
);

// Mock atob for base64 decoding (happy-dom may provide it, but we control it here)
vi.stubGlobal('atob', (str: string) => Buffer.from(str, 'base64').toString('binary'));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudioPlayer', () => {
  let player: AudioPlayer;

  beforeEach(() => {
    vi.clearAllMocks();
    player = new AudioPlayer();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('starts in idle state', () => {
    const state = player.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.isMuted).toBe(false);
    expect(state.currentMessageId).toBeNull();
    expect(state.hasLastAudio).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Mute / Unmute
  // -------------------------------------------------------------------------

  it('mute toggles state', () => {
    player.mute();
    expect(player.getState().isMuted).toBe(true);

    player.unmute();
    expect(player.getState().isMuted).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Adding chunks
  // -------------------------------------------------------------------------

  it('addChunk stores chunks by messageId', () => {
    player.addChunk('msg-1', btoa('audio-data'));
    // No assertion on internal state -- just ensure no throw
    expect(player.getState().currentMessageId).toBe('msg-1');
  });

  // -------------------------------------------------------------------------
  // Complete
  // -------------------------------------------------------------------------

  it('complete marks playback done and stores lastAudio', () => {
    player.addChunk('msg-1', btoa('chunk1'));
    player.complete('msg-1');
    expect(player.getState().hasLastAudio).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Skip
  // -------------------------------------------------------------------------

  it('skip resets current playback', () => {
    player.addChunk('msg-1', btoa('chunk1'));
    player.skip();
    expect(player.getState().isPlaying).toBe(false);
    expect(player.getState().currentMessageId).toBeNull();
  });

  // -------------------------------------------------------------------------
  // State change listeners
  // -------------------------------------------------------------------------

  it('notifies state change listeners', () => {
    const listener = vi.fn();
    const unsub = player.onStateChange(listener);

    player.mute();

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isMuted: true }));

    unsub();
    player.unmute();
    // Should not be called again after unsub
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Muted behavior
  // -------------------------------------------------------------------------

  it('ignores chunks when muted but still tracks messageId', () => {
    player.mute();
    player.addChunk('msg-1', btoa('chunk1'));
    // Muted players still track state for replay
    expect(player.getState().currentMessageId).toBe('msg-1');
  });
});
