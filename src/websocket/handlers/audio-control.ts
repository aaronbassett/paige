import type { AudioControlData } from '../../tts/tts-types.js';

export interface AudioControlCallbacks {
  onMute: () => void;
  onUnmute: () => void;
  onSkip: (messageId: string | undefined) => void;
}

/**
 * Handles audio:control messages from the Electron UI.
 * Dispatches to the appropriate callback based on the action.
 */
export function handleAudioControl(data: AudioControlData, callbacks: AudioControlCallbacks): void {
  switch (data.action) {
    case 'mute':
      callbacks.onMute();
      break;
    case 'unmute':
      callbacks.onUnmute();
      break;
    case 'skip':
      callbacks.onSkip(data.messageId);
      break;
  }
}
