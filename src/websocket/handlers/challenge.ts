// WebSocket handler for challenge:load — fetches full kata data

import type { WebSocket as WsWebSocket } from 'ws';
import { getDatabase } from '../../database/db.js';
import { getKataById } from '../../database/queries/katas.js';
import { broadcast } from '../server.js';
import type { ChallengeLoadData } from '../../types/websocket.js';
import type { KataConstraint } from '../../types/domain.js';

/**
 * Handles `challenge:load` messages from Electron clients.
 * Fetches the full kata spec and broadcasts it back with constraints.
 */
export async function handleChallengeLoad(
  _ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): Promise<void> {
  const { kataId } = data as ChallengeLoadData;

  const db = getDatabase();
  if (db === null) {
    broadcast({ type: 'challenge:load_error', data: { error: 'Database not initialized' } });
    return;
  }

  const kata = await getKataById(db, kataId);
  if (kata === null) {
    broadcast({ type: 'challenge:load_error', data: { error: `Kata not found (id=${kataId})` } });
    return;
  }

  const allConstraints = JSON.parse(kata.constraints) as KataConstraint[];

  broadcast({
    type: 'challenge:loaded',
    data: {
      kataId: kata.id,
      title: kata.title,
      description: kata.description,
      scaffoldingCode: kata.scaffolding_code,
      constraints: allConstraints.map((c) => ({ id: c.id, description: c.description })),
    },
  });
}
