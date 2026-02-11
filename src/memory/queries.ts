// Memory storage and retrieval via ChromaDB

/** Input for storing a memory document. */
export interface MemoryInput {
  content: string;
  tags: string[];
  importance: string;
}

/** Metadata stored alongside each memory in ChromaDB. */
export interface MemoryMetadata {
  session_id: string;
  project: string;
  created_at: string;
  importance: string;
  tags: string;
}

/** A single memory result from a semantic query. */
export interface MemoryResult {
  id: string;
  content: string;
  metadata: MemoryMetadata;
  distance: number;
}

/** Store memories in ChromaDB. Returns { added: N } or { added: 0 } if unavailable. */
export function addMemories(
  _memories: MemoryInput[],
  _sessionId: string,
  _project: string,
): Promise<{ added: number }> {
  return Promise.reject(new Error('Not implemented'));
}

/** Semantic search for memories. Returns [] if ChromaDB is unavailable. */
export function queryMemories(_params: {
  queryText: string;
  nResults?: number;
  project?: string;
}): Promise<MemoryResult[]> {
  return Promise.reject(new Error('Not implemented'));
}
