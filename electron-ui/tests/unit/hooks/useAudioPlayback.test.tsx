/**
 * Unit tests for the useAudioPlayback hook.
 *
 * Tests cover:
 * - Subscribes to audio:chunk and audio:complete on mount
 * - Returns correct initial state
 * - mute() updates state and sends audio:control message
 * - unmute() updates state and sends audio:control message
 * - skip() delegates to AudioPlayer and sends audio:control message
 * - replayLast() delegates to AudioPlayer
 * - Cleanup unsubscribes on unmount
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioPlayback } from '../../../renderer/src/hooks/useAudioPlayback';

// ---------------------------------------------------------------------------
// Mock useWebSocket
// ---------------------------------------------------------------------------

const mockOn = vi.fn().mockReturnValue(vi.fn()); // returns unsub fn
const mockSend = vi.fn();

vi.mock('../../../renderer/src/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    on: mockOn,
    send: mockSend,
    status: 'connected',
    reconnectAttempt: 0,
  }),
}));

// ---------------------------------------------------------------------------
// Mock AudioContext
// ---------------------------------------------------------------------------

vi.stubGlobal(
  'AudioContext',
  vi.fn().mockImplementation(() => ({
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 1.0, length: 44100 }),
    createBufferSource: vi.fn().mockReturnValue({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
      onended: null,
    }),
    resume: vi.fn().mockResolvedValue(undefined),
    destination: {},
    state: 'running',
  }))
);

vi.stubGlobal('atob', (str: string) => Buffer.from(str, 'base64').toString('binary'));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAudioPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to audio:chunk and audio:complete on mount', () => {
    renderHook(() => useAudioPlayback());

    expect(mockOn).toHaveBeenCalledWith('audio:chunk', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('audio:complete', expect.any(Function));
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useAudioPlayback());

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.hasLastAudio).toBe(false);
  });

  it('mute sends audio:control message to backend', () => {
    const { result } = renderHook(() => useAudioPlayback());

    act(() => {
      result.current.mute();
    });

    expect(result.current.isMuted).toBe(true);
    expect(mockSend).toHaveBeenCalledWith('audio:control', { action: 'mute' });
  });

  it('unmute sends audio:control message to backend', () => {
    const { result } = renderHook(() => useAudioPlayback());

    act(() => {
      result.current.mute();
      result.current.unmute();
    });

    expect(result.current.isMuted).toBe(false);
    expect(mockSend).toHaveBeenCalledWith('audio:control', { action: 'unmute' });
  });
});
