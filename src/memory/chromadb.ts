// ChromaDB client with lazy connection and graceful degradation

import { ChromaClient, type Collection } from 'chromadb';

const COLLECTION_NAME = 'paige_memories';

let client: ChromaClient | null = null;
let collection: Collection | null = null;
let available = false;

/** Initialize ChromaDB connection (lazy — server starts even if ChromaDB is down). */
export function initializeMemory(chromadbUrl: string): Promise<void> {
  client = new ChromaClient({ path: chromadbUrl });

  return client
    .getOrCreateCollection({ name: COLLECTION_NAME })
    .then((col) => {
      collection = col;
      available = true;
      // eslint-disable-next-line no-console
      console.log(`[memory] ChromaDB connected — collection ${COLLECTION_NAME} ready`);
    })
    .catch(() => {
      available = false;
      // eslint-disable-next-line no-console
      console.warn(`[memory] ChromaDB unavailable at ${chromadbUrl} — memory features disabled`);
    });
}

/** Returns whether ChromaDB is currently reachable and the collection is ready. */
export function isMemoryAvailable(): boolean {
  return available;
}

/** Mark ChromaDB as unavailable (called by queries on runtime failure). */
export function setUnavailable(): void {
  available = false;
  collection = null;
}

/**
 * Get the ChromaDB collection, attempting reconnection if unavailable.
 * Returns null if ChromaDB cannot be reached.
 */
export function getCollection(): Promise<Collection | null> {
  if (available && collection !== null) {
    return Promise.resolve(collection);
  }

  // Attempt lazy reconnection
  if (client !== null) {
    return client
      .getOrCreateCollection({ name: COLLECTION_NAME })
      .then((col) => {
        collection = col;
        available = true;
        // eslint-disable-next-line no-console
        console.log(`[memory] ChromaDB reconnected — collection ${COLLECTION_NAME} ready`);
        return col;
      })
      .catch(() => {
        available = false;
        return null;
      });
  }

  return Promise.resolve(null);
}

/** Close the ChromaDB connection (for graceful shutdown). */
export function closeMemory(): Promise<void> {
  client = null;
  collection = null;
  available = false;
  return Promise.resolve();
}
