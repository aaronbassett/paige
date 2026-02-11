// WebSocket handler for observer:mute — T332
import type { WebSocket as WsWebSocket } from 'ws';
import { getActiveObserver } from '../../mcp/tools/lifecycle.js';

export function handleObserverMute(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  // Validate data has muted boolean
  if (typeof data !== 'object' || data === null || !('muted' in data)) return;
  const { muted } = data as { muted: unknown };
  if (typeof muted !== 'boolean') return;

  const observer = getActiveObserver();
  if (observer === null) return;

  observer.setMuted(muted);
}
