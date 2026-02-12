import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mock the chromadb module ────────────────────────────────────────────────
//
// We mock `chromadb` so tests never require a running ChromaDB server.
// The mock collection tracks calls to `add` and `query` so we can verify
// that our wrapper functions pass correct arguments.

const mockAdd = vi.fn().mockResolvedValue(undefined);
const mockQuery = vi.fn();
const mockGetOrCreateCollection = vi.fn();

vi.mock('chromadb', () => {
  return {
    ChromaClient: class MockChromaClient {
      constructor(_opts: { path: string }) {
        // no-op
      }
      getOrCreateCollection = mockGetOrCreateCollection;
    },
  };
});

// ── Import modules under test AFTER mocking ─────────────────────────────────

import { initializeMemory, closeMemory } from '../../src/memory/chromadb.js';
import {
  addMemories,
  queryMemories,
  type MemoryInput,
  type MemoryResult,
} from '../../src/memory/queries.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a mock collection object that mimics the chromadb Collection interface. */
function buildMockCollection() {
  return {
    id: 'test-collection-id',
    name: 'paige_memories',
    tenant: 'default',
    database: 'default',
    metadata: undefined,
    configuration: {},
    add: mockAdd,
    query: mockQuery,
    get: vi.fn(),
    peek: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    modify: vi.fn(),
    fork: vi.fn(),
  };
}

/** Build sample MemoryInput entries for testing. */
function sampleMemories(count: number): MemoryInput[] {
  return Array.from({ length: count }, (_, i) => ({
    content: `Memory content ${i}`,
    tags: [`tag-${i}`, 'common'],
    importance: i % 2 === 0 ? 'high' : 'low',
  }));
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('ChromaDB memory storage and retrieval (integration)', () => {
  beforeEach(() => {
    mockAdd.mockClear();
    mockQuery.mockClear();
    mockGetOrCreateCollection.mockClear();

    // Default: getOrCreateCollection returns a working mock collection
    mockGetOrCreateCollection.mockResolvedValue(buildMockCollection());
  });

  afterEach(async () => {
    await closeMemory();
  });

  // ── FR-096 / FR-097: Initialization ─────────────────────────────────────────

  describe('initializeMemory', () => {
    it('creates a ChromaClient and calls getOrCreateCollection with "paige_memories"', async () => {
      await initializeMemory('http://localhost:8000');

      expect(mockGetOrCreateCollection).toHaveBeenCalledTimes(1);
      const callArgs = mockGetOrCreateCollection.mock.calls[0]![0] as Record<string, unknown>;
      expect(callArgs['name']).toBe('paige_memories');
    });
  });

  // ── FR-099 / FR-100 / FR-107: addMemories ──────────────────────────────────

  describe('addMemories', () => {
    beforeEach(async () => {
      await initializeMemory('http://localhost:8000');
    });

    it('stores documents with correct IDs, content, and metadata', async () => {
      const memories = sampleMemories(2);
      const sessionId = 'sess-abc';
      const project = 'my-project';

      await addMemories(memories, sessionId, project);

      expect(mockAdd).toHaveBeenCalledTimes(1);

      const addArgs = mockAdd.mock.calls[0]![0] as {
        ids: string[];
        documents: string[];
        metadatas: Array<{
          session_id: string;
          project: string;
          created_at: string;
          importance: string;
          tags: string;
        }>;
      };

      // FR-100: IDs follow mem_{sessionId}_{index} pattern (0-based)
      expect(addArgs.ids).toEqual(['mem_sess-abc_0', 'mem_sess-abc_1']);

      // Documents are the content strings
      expect(addArgs.documents).toEqual(['Memory content 0', 'Memory content 1']);

      // FR-099: Metadata includes session_id, project, created_at, importance, tags
      expect(addArgs.metadatas).toHaveLength(2);

      const meta0 = addArgs.metadatas[0]!;
      expect(meta0.session_id).toBe('sess-abc');
      expect(meta0.project).toBe('my-project');
      expect(meta0.importance).toBe('high');
      // FR-107: Tags joined as comma-separated string
      expect(meta0.tags).toBe('tag-0,common');
      // FR-099: created_at is ISO 8601
      expect(() => new Date(meta0.created_at).toISOString()).not.toThrow();
    });

    it('returns { added: N } on success', async () => {
      const memories = sampleMemories(3);

      const result = await addMemories(memories, 'sess-xyz', 'project-1');

      expect(result).toEqual({ added: 3 });
    });

    it('generates IDs following mem_{sessionId}_{index} pattern (0-based)', async () => {
      const memories = sampleMemories(4);

      await addMemories(memories, 'sess-id-123', 'proj');

      const addArgs = mockAdd.mock.calls[0]![0] as { ids: string[] };
      expect(addArgs.ids).toEqual([
        'mem_sess-id-123_0',
        'mem_sess-id-123_1',
        'mem_sess-id-123_2',
        'mem_sess-id-123_3',
      ]);
    });

    it('joins tags array as comma-separated string in metadata', async () => {
      const memories: MemoryInput[] = [
        { content: 'Multi-tag memory', tags: ['react', 'hooks', 'state'], importance: 'medium' },
      ];

      await addMemories(memories, 'sess-tags', 'proj');

      const addArgs = mockAdd.mock.calls[0]![0] as {
        metadatas: Array<{ tags: string }>;
      };

      expect(addArgs.metadatas[0]!.tags).toBe('react,hooks,state');
    });
  });

  // ── FR-101 / FR-102: queryMemories ──────────────────────────────────────────

  describe('queryMemories', () => {
    beforeEach(async () => {
      await initializeMemory('http://localhost:8000');
    });

    it('returns semantically similar results with distance', async () => {
      // Mock a query result from ChromaDB
      mockQuery.mockResolvedValueOnce({
        ids: [['mem_s1_0', 'mem_s1_1']],
        documents: [['First memory', 'Second memory']],
        metadatas: [
          [
            {
              session_id: 's1',
              project: 'proj',
              created_at: '2026-02-11T00:00:00.000Z',
              importance: 'high',
              tags: 'react,hooks',
            },
            {
              session_id: 's1',
              project: 'proj',
              created_at: '2026-02-11T01:00:00.000Z',
              importance: 'low',
              tags: 'state',
            },
          ],
        ],
        distances: [[0.12, 0.45]],
        embeddings: [[]],
        uris: [[]],
        include: [],
      });

      const results: MemoryResult[] = await queryMemories({ queryText: 'react hooks' });

      expect(results).toHaveLength(2);

      expect(results[0]!.id).toBe('mem_s1_0');
      expect(results[0]!.content).toBe('First memory');
      expect(results[0]!.distance).toBe(0.12);
      expect(results[0]!.metadata).toEqual({
        session_id: 's1',
        project: 'proj',
        created_at: '2026-02-11T00:00:00.000Z',
        importance: 'high',
        tags: 'react,hooks',
      });

      expect(results[1]!.id).toBe('mem_s1_1');
      expect(results[1]!.content).toBe('Second memory');
      expect(results[1]!.distance).toBe(0.45);
    });

    it('defaults to nResults=10 when not specified', async () => {
      mockQuery.mockResolvedValueOnce({
        ids: [[]],
        documents: [[]],
        metadatas: [[]],
        distances: [[]],
        embeddings: [[]],
        uris: [[]],
        include: [],
      });

      await queryMemories({ queryText: 'test query' });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const queryArgs = mockQuery.mock.calls[0]![0] as Record<string, unknown>;
      expect(queryArgs['nResults']).toBe(10);
    });

    it('respects custom nResults value', async () => {
      mockQuery.mockResolvedValueOnce({
        ids: [[]],
        documents: [[]],
        metadatas: [[]],
        distances: [[]],
        embeddings: [[]],
        uris: [[]],
        include: [],
      });

      await queryMemories({ queryText: 'test query', nResults: 5 });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const queryArgs = mockQuery.mock.calls[0]![0] as Record<string, unknown>;
      expect(queryArgs['nResults']).toBe(5);
    });

    it('queries all projects when no project filter is provided', async () => {
      mockQuery.mockResolvedValueOnce({
        ids: [[]],
        documents: [[]],
        metadatas: [[]],
        distances: [[]],
        embeddings: [[]],
        uris: [[]],
        include: [],
      });

      await queryMemories({ queryText: 'general query' });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const queryArgs = mockQuery.mock.calls[0]![0] as Record<string, unknown>;
      // No `where` clause when project is not specified
      expect(queryArgs['where']).toBeUndefined();
    });

    it('uses where clause when project filter is provided', async () => {
      mockQuery.mockResolvedValueOnce({
        ids: [[]],
        documents: [[]],
        metadatas: [[]],
        distances: [[]],
        embeddings: [[]],
        uris: [[]],
        include: [],
      });

      await queryMemories({ queryText: 'project-specific query', project: 'my-project' });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const queryArgs = mockQuery.mock.calls[0]![0] as Record<string, unknown>;
      expect(queryArgs['where']).toEqual({ project: 'my-project' });
    });

    it('passes queryTexts array to ChromaDB query', async () => {
      mockQuery.mockResolvedValueOnce({
        ids: [[]],
        documents: [[]],
        metadatas: [[]],
        distances: [[]],
        embeddings: [[]],
        uris: [[]],
        include: [],
      });

      await queryMemories({ queryText: 'semantic search text' });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const queryArgs = mockQuery.mock.calls[0]![0] as Record<string, unknown>;
      expect(queryArgs['queryTexts']).toEqual(['semantic search text']);
    });
  });
});
