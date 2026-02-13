/**
 * Unit tests for the AudioControls component.
 *
 * Tests cover:
 * - Renders speaker icon (mute toggle always visible)
 * - Shows muted icon when muted
 * - Shows unmuted icon when not muted
 * - Calls onMute when clicking unmuted speaker
 * - Calls onUnmute when clicking muted speaker
 * - Shows skip button only during playback
 * - Shows replay button only when last audio exists (and not playing)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioControls } from '../../../renderer/src/components/AudioControls';

describe('AudioControls', () => {
  const defaultProps = {
    isMuted: false,
    isPlaying: false,
    hasLastAudio: false,
    onMute: vi.fn(),
    onUnmute: vi.fn(),
    onSkip: vi.fn(),
    onReplay: vi.fn(),
  };

  it('renders speaker icon', () => {
    render(<AudioControls {...defaultProps} />);
    expect(screen.getByLabelText('Toggle mute')).toBeDefined();
  });

  it('shows muted icon when muted', () => {
    render(<AudioControls {...defaultProps} isMuted={true} />);
    const btn = screen.getByLabelText('Toggle mute');
    expect(btn.textContent).toContain('\u{1F507}'); // muted speaker
  });

  it('shows unmuted icon when not muted', () => {
    render(<AudioControls {...defaultProps} isMuted={false} />);
    const btn = screen.getByLabelText('Toggle mute');
    expect(btn.textContent).toContain('\u{1F50A}'); // speaker with sound
  });

  it('calls onMute when clicking unmuted speaker', () => {
    render(<AudioControls {...defaultProps} isMuted={false} />);
    fireEvent.click(screen.getByLabelText('Toggle mute'));
    expect(defaultProps.onMute).toHaveBeenCalledOnce();
  });

  it('calls onUnmute when clicking muted speaker', () => {
    render(<AudioControls {...defaultProps} isMuted={true} />);
    fireEvent.click(screen.getByLabelText('Toggle mute'));
    expect(defaultProps.onUnmute).toHaveBeenCalledOnce();
  });

  it('shows skip button only during playback', () => {
    const { rerender } = render(<AudioControls {...defaultProps} isPlaying={false} />);
    expect(screen.queryByLabelText('Skip audio')).toBeNull();

    rerender(<AudioControls {...defaultProps} isPlaying={true} />);
    expect(screen.getByLabelText('Skip audio')).toBeDefined();
  });

  it('shows replay button only when last audio exists', () => {
    const { rerender } = render(<AudioControls {...defaultProps} hasLastAudio={false} />);
    expect(screen.queryByLabelText('Replay last')).toBeNull();

    rerender(<AudioControls {...defaultProps} hasLastAudio={true} />);
    expect(screen.getByLabelText('Replay last')).toBeDefined();
  });
});
