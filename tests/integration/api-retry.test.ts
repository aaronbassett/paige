import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { createDatabase, closeDatabase, type AppDatabase } from '../../src/database/db.js';
import { createSession } from '../../src/database/queries/sessions.js';
import type { ApiCallLogEntry } from '../../src/types/domain.js';

// ── Mock the Anthropic SDK ──────────────────────────────────────────────────
//
// We mock `@anthropic-ai/sdk` so that `callApi` never makes real HTTP requests.
// The `mockCreate` spy lets each test configure the SDK response shape.

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      messages = { create: mockCreate };
    },
  };
});

// ── Import the module under test AFTER mocking ──────────────────────────────

import {
  callApi,
  ApiRefusalError,
  ApiMaxTokensError,
  type CallApiOptions,
} from '../../src/api-client/claude.js';

// ── Test Schema ─────────────────────────────────────────────────────────────

const testSchema = z.object({ answer: z.string(), confidence: z.number() });
type TestOutput = z.infer<typeof testSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Builds a minimal mock response matching the Anthropic SDK MessageCreateResponse shape. */
function buildMockResponse(overrides: {
  text?: string;
  stopReason?: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  return {
    id: 'msg_test_123',
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: overrides.text ?? JSON.stringify({ answer: 'test', confidence: 0.9 }),
      },
    ],
    model: 'claude-haiku-4-5-20251001',
    stop_reason: overrides.stopReason ?? 'end_turn',
    usage: {
      input_tokens: overrides.inputTokens ?? 100,
      output_tokens: overrides.outputTokens ?? 50,
    },
  };
}

/** Default options for calling the API under test. */
function defaultOptions(sessionId: number): CallApiOptions<TestOutput> {
  return {
    callType: 'coach_agent',
    model: 'haiku',
    systemPrompt: 'You are a test assistant.',
    userMessage: 'What is the answer?',
    responseSchema: testSchema,
    sessionId,
  };
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('Claude API client (integration)', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: AppDatabase;
  let sessionId: number;

  beforeEach(async () => {
    // Set required env vars
    tmpDir = mkdtempSync(join(tmpdir(), 'paige-api-retry-'));
    dbPath = join(tmpDir, 'test.db');
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    process.env['PROJECT_DIR'] = tmpDir;

    // Create real SQLite database with migrations
    db = await createDatabase(dbPath);

    // Create a session to satisfy foreign key constraints on api_call_log
    const session = await createSession(db, {
      project_dir: tmpDir,
      status: 'active',
      started_at: new Date().toISOString(),
    });
    sessionId = session.id;

    // Reset mock between tests
    mockCreate.mockReset();
  });

  afterEach(async () => {
    await closeDatabase();
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env['ANTHROPIC_API_KEY'];
    delete process.env['PROJECT_DIR'];
  });

  // ── Test 1: Successful structured output ────────────────────────────────────

  it('parses structured output from a successful response', async () => {
    const responseData = { answer: 'forty-two', confidence: 0.95 };
    mockCreate.mockResolvedValueOnce(buildMockResponse({ text: JSON.stringify(responseData) }));

    const result = await callApi(defaultOptions(sessionId));

    expect(result).toEqual(responseData);
  });

  // ── Test 2: API call logged on success ──────────────────────────────────────

  it('logs a successful API call to the api_call_log table', async () => {
    mockCreate.mockResolvedValueOnce(buildMockResponse({ inputTokens: 200, outputTokens: 80 }));

    await callApi(defaultOptions(sessionId));

    const rows = (await db
      .selectFrom('api_call_log')
      .selectAll()
      .where('session_id', '=', sessionId)
      .execute()) as ApiCallLogEntry[];

    expect(rows).toHaveLength(1);

    const row = rows[0]!;
    expect(row.session_id).toBe(sessionId);
    expect(row.call_type).toBe('coach_agent');
    // Model should be the full model ID, not the tier alias
    expect(row.model).toBe('claude-haiku-4-5-20251001');
    expect(row.latency_ms).toBeGreaterThanOrEqual(0);
    expect(row.input_tokens).toBe(200);
    expect(row.output_tokens).toBe(80);
    expect(row.cost_estimate).toBeGreaterThan(0);
    expect(row.created_at).toBeTruthy();
  });

  // ── Test 3: input_hash is SHA-256 truncated to 16 chars ────────────────────

  it('computes input_hash as first 16 chars of SHA-256 of userMessage', async () => {
    const userMessage = 'What is the answer?';
    mockCreate.mockResolvedValueOnce(buildMockResponse({}));

    await callApi(defaultOptions(sessionId));

    const rows = (await db
      .selectFrom('api_call_log')
      .selectAll()
      .where('session_id', '=', sessionId)
      .execute()) as ApiCallLogEntry[];

    expect(rows).toHaveLength(1);

    const expectedHash = createHash('sha256').update(userMessage).digest('hex').substring(0, 16);

    expect(rows[0]!.input_hash).toBe(expectedHash);
  });

  // ── Test 4: Stop reason 'refusal' throws ApiRefusalError ───────────────────

  it('throws ApiRefusalError when stop_reason is refusal', async () => {
    mockCreate.mockResolvedValueOnce(buildMockResponse({ stopReason: 'refusal' }));

    await expect(callApi(defaultOptions(sessionId))).rejects.toThrow(ApiRefusalError);
  });

  // ── Test 5: Stop reason 'max_tokens' throws ApiMaxTokensError ──────────────

  it('throws ApiMaxTokensError when stop_reason is max_tokens', async () => {
    mockCreate.mockResolvedValueOnce(buildMockResponse({ stopReason: 'max_tokens' }));

    await expect(callApi(defaultOptions(sessionId))).rejects.toThrow(ApiMaxTokensError);
  });

  // ── Test 6: Failed call logged with latency=-1 and zero tokens/cost ────────

  it('logs a failed call with latency_ms=-1, zero tokens, and zero cost', async () => {
    mockCreate.mockResolvedValueOnce(buildMockResponse({ stopReason: 'refusal' }));

    // The call will throw ApiRefusalError — catch it so the test continues
    await expect(callApi(defaultOptions(sessionId))).rejects.toThrow(ApiRefusalError);

    const rows = (await db
      .selectFrom('api_call_log')
      .selectAll()
      .where('session_id', '=', sessionId)
      .execute()) as ApiCallLogEntry[];

    expect(rows).toHaveLength(1);

    const row = rows[0]!;
    expect(row.latency_ms).toBe(-1);
    expect(row.input_tokens).toBe(0);
    expect(row.output_tokens).toBe(0);
    expect(row.cost_estimate).toBe(0);
  });

  // ── Test 7: Default maxTokens 4096 ─────────────────────────────────────────

  it('passes max_tokens=4096 to the SDK when maxTokens is not specified', async () => {
    mockCreate.mockResolvedValueOnce(buildMockResponse({}));

    const options = defaultOptions(sessionId);
    // Ensure maxTokens is not set
    delete options.maxTokens;

    await callApi(options);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs['max_tokens']).toBe(4096);
  });

  // ── Test 8: Custom maxTokens ───────────────────────────────────────────────

  it('passes the specified max_tokens value to the SDK', async () => {
    mockCreate.mockResolvedValueOnce(buildMockResponse({}));

    const options = defaultOptions(sessionId);
    options.maxTokens = 8192;

    await callApi(options);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs['max_tokens']).toBe(8192);
  });
});
