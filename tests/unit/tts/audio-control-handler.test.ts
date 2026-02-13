import { describe, it, expect, vi } from 'vitest';
import { handleAudioControl } from '../../../src/websocket/handlers/audio-control.js';

describe('handleAudioControl', () => {
  it('calls onMute when action is mute', () => {
    const onMute = vi.fn();
    const onUnmute = vi.fn();
    const onSkip = vi.fn();

    handleAudioControl({ action: 'mute' }, { onMute, onUnmute, onSkip });

    expect(onMute).toHaveBeenCalledOnce();
    expect(onUnmute).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('calls onUnmute when action is unmute', () => {
    const onMute = vi.fn();
    const onUnmute = vi.fn();
    const onSkip = vi.fn();

    handleAudioControl({ action: 'unmute' }, { onMute, onUnmute, onSkip });

    expect(onUnmute).toHaveBeenCalledOnce();
  });

  it('calls onSkip with messageId when action is skip', () => {
    const onMute = vi.fn();
    const onUnmute = vi.fn();
    const onSkip = vi.fn();

    handleAudioControl({ action: 'skip', messageId: 'msg-42' }, { onMute, onUnmute, onSkip });

    expect(onSkip).toHaveBeenCalledWith('msg-42');
  });
});
