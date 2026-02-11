// ChromaDB client with lazy connection and graceful degradation

import type { Collection } from 'chromadb';

/** Initialize ChromaDB connection (lazy — server starts even if ChromaDB is down). */
export function initializeMemory(_chromadbUrl: string): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}

/** Returns whether ChromaDB is currently reachable and the collection is ready. */
export function isMemoryAvailable(): boolean {
  return false;
}

/** Get the ChromaDB collection, attempting reconnection if unavailable. */
export function getCollection(): Promise<Collection | null> {
  return Promise.reject(new Error('Not implemented'));
}

/** Close the ChromaDB connection (for graceful shutdown). */
export function closeMemory(): Promise<void> {
  return Promise.resolve();
}
