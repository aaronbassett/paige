import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mock the chromadb module ────────────────────────────────────────────────
//
// We mock `chromadb` so tests never attempt real HTTP to a ChromaDB server.
// `mockHeartbeat` controls whether the ChromaDB "server" is reachable, and
// `mockGetOrCreateCollection` controls the collection lifecycle.

const mockAdd = vi.fn();
const mockQuery = vi.fn();
const mockHeartbeat = vi.fn();
const mockGetOrCreateCollection = vi.fn();

vi.mock('chromadb', () => {
  return {
    ChromaClient: class MockChromaClient {
      heartbeat = mockHeartbeat;
      getOrCreateCollection = mockGetOrCreateCollection;
    },
  };
});

// ── Import modules under test AFTER mocking ─────────────────────────────────

import { initializeMemory, isMemoryAvailable, closeMemory } from '../../src/memory/chromadb.js';

import { addMemories, queryMemories, type MemoryResult } from '../../src/memory/queries.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a mock ChromaDB collection with controllable add/query methods. */
function buildMockCollection() {
  return {
    name: 'paige_memories',
    add: mockAdd,
    query: mockQuery,
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    peek: vi.fn(),
  };
}

/** Configure mocks so ChromaDB appears available with a working collection. */
function configureChromaAvailable() {
  mockHeartbeat.mockResolvedValue(1);
  const collection = buildMockCollection();
  mockGetOrCreateCollection.mockResolvedValue(collection);
  return collection;
}

/** Configure mocks so ChromaDB appears unreachable. */
function configureChromaUnavailable() {
  mockHeartbeat.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8000'));
  mockGetOrCreateCollection.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8000'));
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('ChromaDB graceful degradation (integration)', () => {
  beforeEach(() => {
    mockHeartbeat.mockReset();
    mockGetOrCreateCollection.mockReset();
    mockAdd.mockReset();
    mockQuery.mockReset();

    // Suppress console.warn/error noise during expected degradation
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Reset memory module state between tests
    await closeMemory();
    vi.restoreAllMocks();
  });

  // ── FR-098 / FR-105: ChromaDB available at startup ──────────────────────

  it('marks memory as available when ChromaDB is reachable at startup', async () => {
    configureChromaAvailable();

    await initializeMemory('http://localhost:8000');

    expect(isMemoryAvailable()).toBe(true);
  });

  // ── FR-098: ChromaDB unavailable at startup — server continues ──────────

  it('starts without error when ChromaDB is unreachable, isMemoryAvailable returns false', async () => {
    configureChromaUnavailable();

    // initializeMemory should NOT throw even when ChromaDB is down
    await initializeMemory('http://localhost:8000');

    expect(isMemoryAvailable()).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  // ── FR-103: addMemories returns { added: 0 } when unavailable ──────────

  it('returns { added: 0 } from addMemories when ChromaDB is unavailable', async () => {
    configureChromaUnavailable();
    await initializeMemory('http://localhost:8000');

    const result = await addMemories(
      [{ content: 'test insight', tags: ['testing'], importance: 'medium' }],
      'session-1',
      'my-project',
    );

    expect(result).toEqual({ added: 0 });
  });

  // ── FR-104: queryMemories returns [] when unavailable ──────────────────

  it('returns empty array from queryMemories when ChromaDB is unavailable', async () => {
    configureChromaUnavailable();
    await initializeMemory('http://localhost:8000');

    const results: MemoryResult[] = await queryMemories({
      queryText: 'how to handle errors',
      nResults: 5,
    });

    expect(results).toEqual([]);
  });

  // ── FR-106: Runtime failure during addMemories flips state ─────────────

  it('flips chromaAvailable to false when addMemories encounters a runtime error', async () => {
    configureChromaAvailable();
    await initializeMemory('http://localhost:8000');
    expect(isMemoryAvailable()).toBe(true);

    // Now simulate a runtime failure on the collection's add method
    mockAdd.mockRejectedValueOnce(new Error('ChromaDB connection lost'));

    const result = await addMemories(
      [{ content: 'will fail', tags: ['fail'], importance: 'high' }],
      'session-2',
      'my-project',
    );

    // Should degrade gracefully: return { added: 0 }, not throw
    expect(result).toEqual({ added: 0 });
    expect(isMemoryAvailable()).toBe(false);
  });

  // ── FR-106: Runtime failure during queryMemories flips state ───────────

  it('flips chromaAvailable to false when queryMemories encounters a runtime error', async () => {
    configureChromaAvailable();
    await initializeMemory('http://localhost:8000');
    expect(isMemoryAvailable()).toBe(true);

    // Simulate a runtime failure on query
    mockQuery.mockRejectedValueOnce(new Error('ChromaDB connection lost'));

    const results = await queryMemories({ queryText: 'something' });

    // Should degrade gracefully: return [], not throw
    expect(results).toEqual([]);
    expect(isMemoryAvailable()).toBe(false);
  });

  // ── FR-106: Lazy recovery after failure ────────────────────────────────

  it('reconnects and succeeds when ChromaDB becomes available after being down', async () => {
    // Start with ChromaDB down
    configureChromaUnavailable();
    await initializeMemory('http://localhost:8000');
    expect(isMemoryAvailable()).toBe(false);

    // Now ChromaDB comes back — reconfigure mocks to succeed
    configureChromaAvailable();
    mockAdd.mockResolvedValueOnce(undefined);

    const result = await addMemories(
      [{ content: 'recovered insight', tags: ['recovery'], importance: 'low' }],
      'session-3',
      'my-project',
    );

    // After lazy reconnection, addMemories should succeed
    expect(result).toEqual({ added: 1 });
    expect(isMemoryAvailable()).toBe(true);
  });

  // ── closeMemory when never connected ───────────────────────────────────

  it('can call closeMemory even when ChromaDB was never initialized', async () => {
    // Do NOT call initializeMemory — just call closeMemory directly
    await expect(closeMemory()).resolves.toBeUndefined();
  });
});
