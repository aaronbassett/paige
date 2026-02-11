// Memory storage and retrieval via ChromaDB

import { getCollection, setUnavailable } from './chromadb.js';

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
  memories: MemoryInput[],
  sessionId: string,
  project: string,
): Promise<{ added: number }> {
  return getCollection()
    .then((col) => {
      if (col === null) {
        // eslint-disable-next-line no-console
        console.warn('[memory] addMemories skipped — ChromaDB unavailable');
        return { added: 0 };
      }

      const now = new Date().toISOString();
      const ids = memories.map((_, i) => `mem_${sessionId}_${String(i)}`);
      const documents = memories.map((m) => m.content);
      const metadatas: MemoryMetadata[] = memories.map((m) => ({
        session_id: sessionId,
        project,
        created_at: now,
        importance: m.importance,
        tags: m.tags.join(','),
      }));

      return col.add({ ids, documents, metadatas }).then(() => ({ added: memories.length }));
    })
    .catch(() => {
      setUnavailable();
      // eslint-disable-next-line no-console
      console.warn('[memory] addMemories failed — marking ChromaDB unavailable');
      return { added: 0 };
    });
}

/** Semantic search for memories. Returns [] if ChromaDB is unavailable. */
export function queryMemories(params: {
  queryText: string;
  nResults?: number;
  project?: string;
}): Promise<MemoryResult[]> {
  return getCollection()
    .then((col) => {
      if (col === null) {
        // eslint-disable-next-line no-console
        console.warn('[memory] queryMemories skipped — ChromaDB unavailable');
        return [];
      }

      const queryArgs: {
        queryTexts: string[];
        nResults: number;
        where?: { project: string };
      } = {
        queryTexts: [params.queryText],
        nResults: params.nResults ?? 10,
      };

      if (params.project !== undefined) {
        queryArgs.where = { project: params.project };
      }

      return col.query(queryArgs).then((result) => {
        const ids = result.ids[0] ?? [];
        const documents = result.documents[0] ?? [];
        const metadatas = result.metadatas[0] ?? [];
        const distances = result.distances[0] ?? [];

        return ids.map(
          (id, i): MemoryResult => ({
            id,
            content: (documents[i] as string | null) ?? '',
            metadata: (metadatas[i] as MemoryMetadata | null) ?? {
              session_id: '',
              project: '',
              created_at: '',
              importance: '',
              tags: '',
            },
            distance: (distances[i] as number | null) ?? 0,
          }),
        );
      });
    })
    .catch(() => {
      setUnavailable();
      // eslint-disable-next-line no-console
      console.warn('[memory] queryMemories failed — marking ChromaDB unavailable');
      return [];
    });
}
