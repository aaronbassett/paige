# Planning Agent & Loading Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a user clicks "Work on this" on a GitHub issue, show a loading screen while the Claude Agent SDK autonomously explores the codebase and builds a phased implementation plan with multi-level hints, then transition to the IDE with all data pre-loaded.

**Architecture:** Backend uses `@anthropic-ai/claude-agent-sdk` query() with read-only tools (Read, Glob, Grep) to explore the repo and output structured JSON. Progress streams to Electron via WebSocket. Electron shows a three-layer loading screen (ASCII art + progress bar + activity log). On completion, crossfade to IDE with plan, file tree, and hints pre-loaded.

**Tech Stack:** Claude Agent SDK (Opus 4.6), Zod validation, WebSocket streaming, React + Framer Motion, existing Kysely/SQLite storage.

---

## Task 1: Install Claude Agent SDK

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

Run: `cd /home/ubuntu/Projects/paige && pnpm add @anthropic-ai/claude-agent-sdk`

**Step 2: Verify installation**

Run: `cd /home/ubuntu/Projects/paige && node -e "const sdk = require('@anthropic-ai/claude-agent-sdk'); console.log('SDK loaded:', typeof sdk.query)"`
Expected: `SDK loaded: function`

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @anthropic-ai/claude-agent-sdk dependency"
```

---

## Task 2: Add Planning WebSocket Message Types (Backend)

**Files:**
- Modify: `src/types/websocket.ts`

**Step 1: Read the existing websocket types file**

Read: `src/types/websocket.ts`

Understand the existing `ServerToClientMessageType` union and the `ServerToClientMessages` interface pattern.

**Step 2: Add planning message types to `ServerToClientMessageType`**

Add these 5 new types to the `ServerToClientMessageType` union:
- `'planning:started'`
- `'planning:progress'`
- `'planning:phase_update'`
- `'planning:complete'`
- `'planning:error'`

**Step 3: Add planning message data interfaces to `ServerToClientMessages`**

```typescript
'planning:started': {
  sessionId: string;
  issueTitle: string;
};
'planning:progress': {
  message: string;
  toolName?: string;
  filePath?: string;
};
'planning:phase_update': {
  phase: 'fetching' | 'exploring' | 'planning' | 'writing_hints';
  progress: number;
};
'planning:complete': {
  sessionId: string;
  plan: {
    title: string;
    summary: string;
    phases: Array<{
      number: number;
      title: string;
      description: string;
      hint: string;
      status: 'pending' | 'active';
      tasks: Array<{
        title: string;
        description: string;
        targetFiles: string[];
        hints: { low: string; medium: string; high: string };
      }>;
    }>;
  };
  fileTree: import('../file-system/tree').TreeNode[];
  fileHints: Array<{
    path: string;
    style: 'subtle' | 'obvious' | 'unmissable';
    phase: number;
  }>;
  issueContext: {
    title: string;
    number: number;
    body: string;
    labels: string[];
    url: string;
  };
};
'planning:error': {
  sessionId: string;
  error: string;
};
```

**Step 4: Run typecheck**

Run: `cd /home/ubuntu/Projects/paige && pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/types/websocket.ts
git commit -m "feat(types): add planning WebSocket message types"
```

---

## Task 3: Create Plan Output Schema & Parser

**Files:**
- Create: `src/planning/parser.ts`

**Step 1: Write the failing test**

Create: `src/planning/__tests__/parser.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parsePlanOutput, AgentPlanOutput } from '../parser.js';

const VALID_PLAN: AgentPlanOutput = {
  title: 'Add user authentication',
  summary: 'Implement JWT-based auth with login/register endpoints',
  relevant_files: ['src/auth/middleware.ts', 'src/routes/auth.ts'],
  phases: [
    {
      number: 1,
      title: 'Set up auth middleware',
      description: 'Create Express middleware for JWT validation',
      hint: 'Start with the middleware pattern used in other routes',
      tasks: [
        {
          title: 'Create JWT validation function',
          description: 'Parse and validate JWT tokens from Authorization header',
          target_files: ['src/auth/middleware.ts'],
          hints: {
            low: 'Look at how the existing middleware handles headers',
            medium: 'Use jsonwebtoken library to verify the token, check the Authorization header format',
            high: 'Import jwt from jsonwebtoken, extract token from "Bearer <token>" header, call jwt.verify(token, process.env.JWT_SECRET)',
          },
        },
      ],
    },
  ],
};

describe('parsePlanOutput', () => {
  it('parses valid JSON plan from agent result text', () => {
    const text = `Here is the plan:\n\`\`\`json\n${JSON.stringify(VALID_PLAN)}\n\`\`\``;
    const result = parsePlanOutput(text);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Add user authentication');
      expect(result.data.phases).toHaveLength(1);
      expect(result.data.phases[0].tasks[0].hints.low).toContain('middleware');
    }
  });

  it('parses raw JSON without code fences', () => {
    const text = JSON.stringify(VALID_PLAN);
    const result = parsePlanOutput(text);
    expect(result.success).toBe(true);
  });

  it('returns error for invalid JSON', () => {
    const result = parsePlanOutput('not json at all');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('No valid JSON');
    }
  });

  it('returns error for JSON missing required fields', () => {
    const result = parsePlanOutput(JSON.stringify({ title: 'incomplete' }));
    expect(result.success).toBe(false);
  });

  it('returns error for empty phases array', () => {
    const plan = { ...VALID_PLAN, phases: [] };
    const result = parsePlanOutput(JSON.stringify(plan));
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/planning/__tests__/parser.test.ts`
Expected: FAIL — module `../parser.js` not found

**Step 3: Write the implementation**

Create: `src/planning/parser.ts`

```typescript
import { z } from 'zod';

const HintsSchema = z.object({
  low: z.string().min(1),
  medium: z.string().min(1),
  high: z.string().min(1),
});

const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  target_files: z.array(z.string()).min(1),
  hints: HintsSchema,
});

const PhaseSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  hint: z.string().min(1),
  tasks: z.array(TaskSchema).min(1),
});

const AgentPlanOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  relevant_files: z.array(z.string()),
  phases: z.array(PhaseSchema).min(1),
});

export type AgentPlanOutput = z.infer<typeof AgentPlanOutputSchema>;

export type ParseResult =
  | { success: true; data: AgentPlanOutput }
  | { success: false; error: string };

export function parsePlanOutput(text: string): ParseResult {
  const json = extractJson(text);
  if (json === null) {
    return { success: false, error: 'No valid JSON found in agent output' };
  }

  const result = AgentPlanOutputSchema.safeParse(json);
  if (!result.success) {
    return { success: false, error: `Validation failed: ${result.error.message}` };
  }

  return { success: true, data: result.data };
}

function extractJson(text: string): unknown | null {
  // Try code-fenced JSON first
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // fall through
    }
  }

  // Try raw JSON
  try {
    return JSON.parse(text.trim());
  } catch {
    // fall through
  }

  // Try to find JSON object in text
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1));
    } catch {
      return null;
    }
  }

  return null;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/planning/__tests__/parser.test.ts`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add src/planning/parser.ts src/planning/__tests__/parser.test.ts
git commit -m "feat(planning): add Zod-validated plan output parser"
```

---

## Task 4: Create Planning Agent Prompts

**Files:**
- Create: `src/planning/prompts.ts`

**Step 1: Write the failing test**

Create: `src/planning/__tests__/prompts.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { buildPlanningPrompt, PLANNING_SYSTEM_PROMPT } from '../prompts.js';

describe('buildPlanningPrompt', () => {
  it('includes issue title and body', () => {
    const prompt = buildPlanningPrompt({
      title: 'Add dark mode',
      body: 'Users want dark mode support',
      number: 42,
      labels: ['enhancement'],
      url: 'https://github.com/org/repo/issues/42',
    });
    expect(prompt).toContain('Add dark mode');
    expect(prompt).toContain('Users want dark mode support');
    expect(prompt).toContain('#42');
  });

  it('includes labels', () => {
    const prompt = buildPlanningPrompt({
      title: 'Fix bug',
      body: 'Something broken',
      number: 1,
      labels: ['bug', 'priority-high'],
      url: 'https://github.com/org/repo/issues/1',
    });
    expect(prompt).toContain('bug');
    expect(prompt).toContain('priority-high');
  });
});

describe('PLANNING_SYSTEM_PROMPT', () => {
  it('instructs JSON output', () => {
    expect(PLANNING_SYSTEM_PROMPT).toContain('JSON');
  });

  it('describes the output schema fields', () => {
    expect(PLANNING_SYSTEM_PROMPT).toContain('phases');
    expect(PLANNING_SYSTEM_PROMPT).toContain('hints');
    expect(PLANNING_SYSTEM_PROMPT).toContain('relevant_files');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/planning/__tests__/prompts.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create: `src/planning/prompts.ts`

```typescript
export interface IssueInput {
  title: string;
  body: string;
  number: number;
  labels: string[];
  url: string;
}

export const PLANNING_SYSTEM_PROMPT = `You are an expert software architect and coding coach. Your task is to analyze a GitHub issue and the project's codebase, then create a detailed, phased implementation plan that a junior developer can follow.

## Your Process

1. **Explore the codebase**: Read package.json, directory structure, key configuration files, and source code relevant to the issue.
2. **Identify relevant files**: Find all files that will need to be created or modified.
3. **Create phases**: Break the implementation into 2-5 sequential phases, each building on the previous.
4. **Create tasks per phase**: Each phase has 1-4 concrete tasks.
5. **Write multi-level hints**: For each task, write hints at three detail levels:
   - **low**: A subtle nudge pointing in the right direction (1 sentence)
   - **medium**: Directional guidance with key concepts and patterns to use (2-3 sentences)
   - **high**: Near-explicit instructions with specific function names, patterns, and approach (3-5 sentences)

## Output Format

You MUST output your plan as a single JSON object wrapped in a \`\`\`json code fence. The JSON must match this exact schema:

\`\`\`
{
  "title": "Short plan title",
  "summary": "2-3 sentence overview of the implementation approach",
  "relevant_files": ["path/to/file1.ts", "path/to/file2.ts"],
  "phases": [
    {
      "number": 1,
      "title": "Phase title",
      "description": "What this phase accomplishes",
      "hint": "Phase-level coaching hint for the developer",
      "tasks": [
        {
          "title": "Task title",
          "description": "What needs to be done",
          "target_files": ["path/to/file.ts"],
          "hints": {
            "low": "Subtle nudge",
            "medium": "Directional guidance with key concepts",
            "high": "Near-explicit instructions with specifics"
          }
        }
      ]
    }
  ]
}
\`\`\`

## Guidelines

- Phases should be completable in 15-30 minutes each
- Tasks should be completable in 5-15 minutes each
- Hints should reference actual file paths, function names, and patterns from the codebase
- The low hint should be enough for an experienced developer
- The high hint should be enough for a junior developer
- Never include the full solution in hints — guide, don't solve
- Order phases so the developer sees working progress early
`;

export function buildPlanningPrompt(issue: IssueInput): string {
  const labels = issue.labels.length > 0 ? issue.labels.join(', ') : 'none';

  return `## GitHub Issue #${issue.number}: ${issue.title}

**Labels:** ${labels}
**URL:** ${issue.url}

**Description:**
${issue.body}

---

Please explore this codebase thoroughly, then create a phased implementation plan for this issue. Output your plan as JSON in the format described in your instructions.`;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/planning/__tests__/prompts.test.ts`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add src/planning/prompts.ts src/planning/__tests__/prompts.test.ts
git commit -m "feat(planning): add planning agent system prompt and prompt builder"
```

---

## Task 5: Create Planning Agent Module

**Files:**
- Create: `src/planning/agent.ts`

This is the core module that calls the Agent SDK and streams progress.

**Step 1: Write the failing test**

Create: `src/planning/__tests__/agent.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPlanningAgent, PlanningCallbacks } from '../agent.js';

// Mock the Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';
const mockQuery = vi.mocked(query);

const VALID_PLAN_JSON = JSON.stringify({
  title: 'Test Plan',
  summary: 'A test',
  relevant_files: ['src/index.ts'],
  phases: [{
    number: 1,
    title: 'Phase 1',
    description: 'Do the thing',
    hint: 'Start here',
    tasks: [{
      title: 'Task 1',
      description: 'First task',
      target_files: ['src/index.ts'],
      hints: { low: 'Look', medium: 'Look at index', high: 'Edit src/index.ts line 5' },
    }],
  }],
});

describe('runPlanningAgent', () => {
  let callbacks: PlanningCallbacks;

  beforeEach(() => {
    callbacks = {
      onProgress: vi.fn(),
      onPhaseUpdate: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    };
  });

  it('streams progress for tool_use messages', async () => {
    const messages = [
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      { type: 'assistant', message: { content: [
        { type: 'tool_use', name: 'Read', input: { file_path: '/repo/package.json' } },
      ]}},
      { type: 'result', subtype: 'success', result: '```json\n' + VALID_PLAN_JSON + '\n```', session_id: 'sess-1' },
    ];

    mockQuery.mockReturnValue((async function* () {
      for (const msg of messages) yield msg;
    })());

    await runPlanningAgent({
      issue: { title: 'Test', body: 'Body', number: 1, labels: [], url: 'https://github.com/test' },
      repoPath: '/tmp/repo',
      callbacks,
    });

    expect(callbacks.onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'Read', filePath: '/repo/package.json' })
    );
  });

  it('calls onComplete with parsed plan on success', async () => {
    const messages = [
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      { type: 'result', subtype: 'success', result: '```json\n' + VALID_PLAN_JSON + '\n```', session_id: 'sess-1' },
    ];

    mockQuery.mockReturnValue((async function* () {
      for (const msg of messages) yield msg;
    })());

    await runPlanningAgent({
      issue: { title: 'Test', body: 'Body', number: 1, labels: [], url: 'https://github.com/test' },
      repoPath: '/tmp/repo',
      callbacks,
    });

    expect(callbacks.onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test Plan' })
    );
  });

  it('calls onError when agent returns invalid JSON', async () => {
    const messages = [
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      { type: 'result', subtype: 'success', result: 'not json', session_id: 'sess-1' },
    ];

    mockQuery.mockReturnValue((async function* () {
      for (const msg of messages) yield msg;
    })());

    await runPlanningAgent({
      issue: { title: 'Test', body: 'Body', number: 1, labels: [], url: 'https://github.com/test' },
      repoPath: '/tmp/repo',
      callbacks,
    });

    expect(callbacks.onError).toHaveBeenCalledWith(expect.stringContaining('No valid JSON'));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/planning/__tests__/agent.test.ts`
Expected: FAIL — module `../agent.js` not found

**Step 3: Write the implementation**

Create: `src/planning/agent.ts`

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { parsePlanOutput, AgentPlanOutput } from './parser.js';
import { buildPlanningPrompt, PLANNING_SYSTEM_PROMPT, IssueInput } from './prompts.js';

export interface ProgressEvent {
  message: string;
  toolName?: string;
  filePath?: string;
}

export interface PlanningCallbacks {
  onProgress: (event: ProgressEvent) => void;
  onPhaseUpdate: (phase: 'fetching' | 'exploring' | 'planning' | 'writing_hints', progress: number) => void;
  onComplete: (plan: AgentPlanOutput) => void;
  onError: (error: string) => void;
}

export interface PlanningAgentInput {
  issue: IssueInput;
  repoPath: string;
  callbacks: PlanningCallbacks;
}

const TOOL_DESCRIPTIONS: Record<string, (input: Record<string, unknown>) => string> = {
  Read: (input) => `Reading ${input.file_path ?? 'file'}...`,
  Glob: (input) => `Searching for ${input.pattern ?? 'files'}...`,
  Grep: (input) => `Searching for "${input.pattern ?? 'pattern'}"...`,
};

function describeToolUse(name: string, input: Record<string, unknown>): ProgressEvent {
  const describer = TOOL_DESCRIPTIONS[name];
  const message = describer ? describer(input) : `Using ${name}...`;
  return {
    message,
    toolName: name,
    filePath: typeof input.file_path === 'string' ? input.file_path : undefined,
  };
}

export async function runPlanningAgent({ issue, repoPath, callbacks }: PlanningAgentInput): Promise<void> {
  callbacks.onPhaseUpdate('exploring', 0);

  let resultText = '';
  let toolUseCount = 0;

  try {
    const stream = query({
      prompt: buildPlanningPrompt(issue),
      options: {
        allowedTools: ['Read', 'Glob', 'Grep'],
        permissionMode: 'bypassPermissions',
        cwd: repoPath,
        systemPrompt: PLANNING_SYSTEM_PROMPT,
        model: 'claude-opus-4-6',
      },
    });

    for await (const message of stream) {
      // Track tool use for progress streaming
      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === 'tool_use') {
            toolUseCount++;
            const event = describeToolUse(block.name, block.input as Record<string, unknown>);
            callbacks.onProgress(event);

            // Heuristic phase transitions based on tool use count
            if (toolUseCount === 1) {
              callbacks.onPhaseUpdate('exploring', 25);
            } else if (toolUseCount === 5) {
              callbacks.onPhaseUpdate('exploring', 50);
            } else if (toolUseCount === 10) {
              callbacks.onPhaseUpdate('planning', 75);
            }
          }
        }
      }

      // Capture the final result
      if (message.type === 'result' && message.subtype === 'success') {
        resultText = message.result ?? '';
      }
    }
  } catch (err) {
    callbacks.onError(`Agent SDK error: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  if (!resultText) {
    callbacks.onError('Agent returned no result');
    return;
  }

  callbacks.onPhaseUpdate('writing_hints', 90);
  callbacks.onProgress({ message: 'Parsing implementation plan...' });

  const parseResult = parsePlanOutput(resultText);
  if (!parseResult.success) {
    callbacks.onError(parseResult.error);
    return;
  }

  callbacks.onPhaseUpdate('writing_hints', 100);
  callbacks.onComplete(parseResult.data);
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/planning/__tests__/agent.test.ts`
Expected: All 3 tests PASS

**Step 5: Run typecheck**

Run: `cd /home/ubuntu/Projects/paige && pnpm typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add src/planning/agent.ts src/planning/__tests__/agent.test.ts
git commit -m "feat(planning): add Agent SDK planning agent with progress streaming"
```

---

## Task 6: Create Planning WebSocket Handler

**Files:**
- Create: `src/websocket/handlers/planning.ts`

This handler receives `session:select_issue`, fetches the issue from GitHub, runs the planning agent, streams progress, stores the plan in SQLite, and sends `planning:complete`.

**Step 1: Write the failing test**

Create: `src/websocket/handlers/__tests__/planning.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../planning/agent.js', () => ({
  runPlanningAgent: vi.fn(),
}));
vi.mock('../../server.js', () => ({
  sendToClient: vi.fn(),
  broadcast: vi.fn(),
}));
vi.mock('../../../database/db.js', () => ({
  getDatabase: vi.fn(() => ({
    insertInto: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returningAll: vi.fn().mockReturnThis(),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 1 }),
  })),
}));
vi.mock('../../../file-system/tree.js', () => ({
  scanProjectTree: vi.fn().mockResolvedValue({ name: 'root', path: '.', type: 'directory', children: [] }),
}));
vi.mock('../../../config/env.js', () => ({
  getEnv: vi.fn(() => ({ projectDir: '/tmp/repo' })),
}));

import { handlePlanningStart } from '../planning.js';
import { sendToClient } from '../../server.js';
import { runPlanningAgent } from '../../../planning/agent.js';

describe('handlePlanningStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends planning:started message immediately', async () => {
    vi.mocked(runPlanningAgent).mockResolvedValue(undefined);

    // Fire and don't await (it runs async)
    handlePlanningStart(
      {} as any,
      { issueNumber: 42, issueTitle: 'Add auth', issueBody: 'Need auth', issueLabels: ['feat'], issueUrl: 'https://github.com/test' },
      'conn-1',
    );

    // Give the microtask a tick
    await new Promise((r) => setTimeout(r, 10));

    expect(sendToClient).toHaveBeenCalledWith('conn-1', expect.objectContaining({
      type: 'planning:started',
    }));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/websocket/handlers/__tests__/planning.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create: `src/websocket/handlers/planning.ts`

```typescript
import type { WebSocket as WsWebSocket } from 'ws';
import { sendToClient } from '../server.js';
import { getEnv } from '../../config/env.js';
import { getDatabase } from '../../database/db.js';
import { createPlan } from '../../database/queries/plans.js';
import { createPhase } from '../../database/queries/phases.js';
import { createHint } from '../../database/queries/hints.js';
import { scanProjectTree } from '../../file-system/tree.js';
import { runPlanningAgent, type PlanningCallbacks } from '../../planning/agent.js';
import type { AgentPlanOutput } from '../../planning/parser.js';

interface PlanningStartData {
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  issueLabels: string[];
  issueUrl: string;
}

export function handlePlanningStart(
  _ws: WsWebSocket,
  data: unknown,
  connectionId: string,
): void {
  const input = data as PlanningStartData;
  const env = getEnv();

  // Send started message immediately
  sendToClient(connectionId, {
    type: 'planning:started',
    data: {
      sessionId: connectionId,
      issueTitle: input.issueTitle,
    },
  });

  // Run agent in background
  runPlanningAgentFlow(connectionId, input, env.projectDir).catch((err) => {
    sendToClient(connectionId, {
      type: 'planning:error',
      data: {
        sessionId: connectionId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  });
}

async function runPlanningAgentFlow(
  connectionId: string,
  input: PlanningStartData,
  repoPath: string,
): Promise<void> {
  // Send fetching phase
  sendToClient(connectionId, {
    type: 'planning:phase_update',
    data: { phase: 'fetching', progress: 10 },
  });

  const callbacks: PlanningCallbacks = {
    onProgress: (event) => {
      sendToClient(connectionId, {
        type: 'planning:progress',
        data: event,
      });
    },
    onPhaseUpdate: (phase, progress) => {
      sendToClient(connectionId, {
        type: 'planning:phase_update',
        data: { phase, progress },
      });
    },
    onComplete: () => {}, // handled below
    onError: () => {},    // handled below
  };

  // Wrap in a promise to capture onComplete/onError
  const plan = await new Promise<AgentPlanOutput>((resolve, reject) => {
    callbacks.onComplete = resolve;
    callbacks.onError = (error) => reject(new Error(error));

    runPlanningAgent({
      issue: {
        title: input.issueTitle,
        body: input.issueBody,
        number: input.issueNumber,
        labels: input.issueLabels,
        url: input.issueUrl,
      },
      repoPath,
      callbacks,
    });
  });

  // Store plan in SQLite
  const db = getDatabase();
  if (db) {
    await storePlan(db, connectionId, plan);
  }

  // Build file tree
  const fileTree = await scanProjectTree();

  // Build file hints from plan phases
  const fileHints = plan.phases.flatMap((phase) =>
    phase.tasks.flatMap((task) =>
      task.target_files.map((path) => ({
        path,
        style: phase.number === 1 ? 'obvious' as const : 'subtle' as const,
        phase: phase.number,
      })),
    ),
  );

  // Send complete payload
  sendToClient(connectionId, {
    type: 'planning:complete',
    data: {
      sessionId: connectionId,
      plan: {
        title: plan.title,
        summary: plan.summary,
        phases: plan.phases.map((phase, i) => ({
          number: phase.number,
          title: phase.title,
          description: phase.description,
          hint: phase.hint,
          status: i === 0 ? 'active' as const : 'pending' as const,
          tasks: phase.tasks.map((task) => ({
            title: task.title,
            description: task.description,
            targetFiles: task.target_files,
            hints: task.hints,
          })),
        })),
      },
      fileTree,
      fileHints,
      issueContext: {
        title: input.issueTitle,
        number: input.issueNumber,
        body: input.issueBody,
        labels: input.issueLabels,
        url: input.issueUrl,
      },
    },
  });
}

async function storePlan(
  db: NonNullable<ReturnType<typeof getDatabase>>,
  sessionId: string,
  plan: AgentPlanOutput,
): Promise<void> {
  const dbPlan = await createPlan(db, {
    session_id: sessionId,
    title: plan.title,
    description: plan.summary,
    total_phases: plan.phases.length,
    is_active: true,
  });

  for (const phase of plan.phases) {
    const dbPhase = await createPhase(db, {
      plan_id: dbPlan.id,
      number: phase.number,
      title: phase.title,
      description: phase.description,
      hint_level: 'medium',
      status: phase.number === 1 ? 'active' : 'pending',
    });

    // Store task hints as phase_hints
    for (const task of phase.tasks) {
      for (const targetFile of task.target_files) {
        await createHint(db, {
          phase_id: dbPhase.id,
          type: 'file',
          path: targetFile,
          style: 'suggested',
          hover_text: task.hints.medium,
          required_level: 'medium',
        });
      }
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/websocket/handlers/__tests__/planning.test.ts`
Expected: PASS

**Step 5: Run typecheck**

Run: `cd /home/ubuntu/Projects/paige && pnpm typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add src/websocket/handlers/planning.ts src/websocket/handlers/__tests__/planning.test.ts
git commit -m "feat(planning): add WebSocket handler for planning flow orchestration"
```

---

## Task 7: Wire Planning Handler into Router

**Files:**
- Modify: `src/websocket/router.ts`

**Step 1: Read the current router**

Read: `src/websocket/router.ts`

Understand the existing handler registration pattern in the `registerHandlers()` function.

**Step 2: Import and register the planning handler**

Add import at top:
```typescript
import { handlePlanningStart } from './handlers/planning.js';
```

In `registerHandlers()`, change the existing `session:select_issue` registration (which currently maps to `handleSessionSelectIssue` from session-start.ts) to use `handlePlanningStart` instead:

```typescript
this.handlers.set('session:select_issue', handlePlanningStart);
```

**Step 3: Run typecheck**

Run: `cd /home/ubuntu/Projects/paige && pnpm typecheck`
Expected: No errors

**Step 4: Run full test suite**

Run: `cd /home/ubuntu/Projects/paige && pnpm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/websocket/router.ts
git commit -m "feat(planning): wire planning handler into WebSocket router"
```

---

## Task 8: Add Planning Types to Frontend Shared Types

**Files:**
- Modify: `electron-ui/shared/types/websocket.ts` (or wherever frontend WebSocket types are defined)

**Step 1: Read the existing frontend shared types**

Read: `electron-ui/shared/types/` directory contents

**Step 2: Add planning message interfaces**

Add the planning message types that the frontend needs to handle. Match the backend `ServerToClientMessages` planning types:

```typescript
export type PlanningPhase = 'fetching' | 'exploring' | 'planning' | 'writing_hints';

export interface PlanningStartedPayload {
  sessionId: string;
  issueTitle: string;
}

export interface PlanningProgressPayload {
  message: string;
  toolName?: string;
  filePath?: string;
}

export interface PlanningPhaseUpdatePayload {
  phase: PlanningPhase;
  progress: number;
}

export interface PlanTask {
  title: string;
  description: string;
  targetFiles: string[];
  hints: { low: string; medium: string; high: string };
}

export interface PlanPhase {
  number: number;
  title: string;
  description: string;
  hint: string;
  status: 'pending' | 'active';
  tasks: PlanTask[];
}

export interface PlanningCompletePayload {
  sessionId: string;
  plan: {
    title: string;
    summary: string;
    phases: PlanPhase[];
  };
  fileTree: TreeNode[];
  fileHints: Array<{
    path: string;
    style: 'subtle' | 'obvious' | 'unmissable';
    phase: number;
  }>;
  issueContext: {
    title: string;
    number: number;
    body: string;
    labels: string[];
    url: string;
  };
}

export interface PlanningErrorPayload {
  sessionId: string;
  error: string;
}
```

**Step 3: Run typecheck**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add electron-ui/shared/
git commit -m "feat(electron-ui): add planning WebSocket message types"
```

---

## Task 9: Create usePlanningProgress Hook

**Files:**
- Create: `electron-ui/renderer/src/hooks/usePlanningProgress.ts`

**Step 1: Write the failing test**

Create: `electron-ui/renderer/src/hooks/__tests__/usePlanningProgress.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlanningProgress } from '../usePlanningProgress';

// Mock useWebSocket
const mockOn = vi.fn();
vi.mock('../useWebSocket', () => ({
  useWebSocket: () => ({
    on: mockOn,
    send: vi.fn(),
    status: 'connected',
    reconnectAttempt: 0,
  }),
}));

describe('usePlanningProgress', () => {
  it('starts with idle state', () => {
    mockOn.mockReturnValue(() => {});
    const { result } = renderHook(() => usePlanningProgress());
    expect(result.current.status).toBe('idle');
    expect(result.current.logs).toEqual([]);
    expect(result.current.currentPhase).toBeNull();
  });

  it('transitions to loading on planning:started', () => {
    let startedHandler: (msg: any) => void = () => {};
    mockOn.mockImplementation((type: string, handler: any) => {
      if (type === 'planning:started') startedHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() => usePlanningProgress());

    act(() => {
      startedHandler({ payload: { sessionId: 's1', issueTitle: 'Test' } });
    });

    expect(result.current.status).toBe('loading');
    expect(result.current.issueTitle).toBe('Test');
  });

  it('accumulates log entries from planning:progress', () => {
    let progressHandler: (msg: any) => void = () => {};
    mockOn.mockImplementation((type: string, handler: any) => {
      if (type === 'planning:progress') progressHandler = handler;
      return () => {};
    });

    const { result } = renderHook(() => usePlanningProgress());

    act(() => {
      progressHandler({ payload: { message: 'Reading file...' } });
      progressHandler({ payload: { message: 'Searching...' } });
    });

    expect(result.current.logs).toHaveLength(2);
    expect(result.current.logs[0].message).toBe('Reading file...');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm test -- --run src/renderer/src/hooks/__tests__/usePlanningProgress.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create: `electron-ui/renderer/src/hooks/usePlanningProgress.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import type {
  PlanningPhase,
  PlanningCompletePayload,
} from '../../../shared/types/websocket';

export type PlanningStatus = 'idle' | 'loading' | 'complete' | 'error';

export interface LogEntry {
  message: string;
  toolName?: string;
  filePath?: string;
  timestamp: number;
}

export interface PlanningProgressState {
  status: PlanningStatus;
  issueTitle: string | null;
  currentPhase: PlanningPhase | null;
  progress: number;
  logs: LogEntry[];
  result: PlanningCompletePayload | null;
  error: string | null;
}

const MAX_LOG_ENTRIES = 50;

export function usePlanningProgress(): PlanningProgressState {
  const { on } = useWebSocket();
  const [state, setState] = useState<PlanningProgressState>({
    status: 'idle',
    issueTitle: null,
    currentPhase: null,
    progress: 0,
    logs: [],
    result: null,
    error: null,
  });

  useEffect(() => {
    const unsubs = [
      on('planning:started', (msg) => {
        const { issueTitle } = msg.payload as { sessionId: string; issueTitle: string };
        setState((s) => ({ ...s, status: 'loading', issueTitle }));
      }),

      on('planning:progress', (msg) => {
        const { message, toolName, filePath } = msg.payload as { message: string; toolName?: string; filePath?: string };
        setState((s) => ({
          ...s,
          logs: [...s.logs.slice(-MAX_LOG_ENTRIES + 1), { message, toolName, filePath, timestamp: Date.now() }],
        }));
      }),

      on('planning:phase_update', (msg) => {
        const { phase, progress } = msg.payload as { phase: PlanningPhase; progress: number };
        setState((s) => ({ ...s, currentPhase: phase, progress }));
      }),

      on('planning:complete', (msg) => {
        const result = msg.payload as PlanningCompletePayload;
        setState((s) => ({ ...s, status: 'complete', result, progress: 100 }));
      }),

      on('planning:error', (msg) => {
        const { error } = msg.payload as { sessionId: string; error: string };
        setState((s) => ({ ...s, status: 'error', error }));
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [on]);

  return state;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm test -- --run src/renderer/src/hooks/__tests__/usePlanningProgress.test.ts`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add electron-ui/renderer/src/hooks/usePlanningProgress.ts electron-ui/renderer/src/hooks/__tests__/usePlanningProgress.test.ts
git commit -m "feat(electron-ui): add usePlanningProgress hook for WebSocket streaming"
```

---

## Task 10: Create ProgressBar Component

**Files:**
- Create: `electron-ui/renderer/src/components/planning/ProgressBar.tsx`

**Step 1: Write the failing test**

Create: `electron-ui/renderer/src/components/planning/__tests__/ProgressBar.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../ProgressBar';

describe('ProgressBar', () => {
  it('renders all four phase labels', () => {
    render(<ProgressBar currentPhase={null} progress={0} />);
    expect(screen.getByText('Fetching Issue')).toBeTruthy();
    expect(screen.getByText('Exploring Codebase')).toBeTruthy();
    expect(screen.getByText('Building Plan')).toBeTruthy();
    expect(screen.getByText('Writing Hints')).toBeTruthy();
  });

  it('marks completed phases', () => {
    const { container } = render(<ProgressBar currentPhase="planning" progress={75} />);
    // Fetching and Exploring should be complete
    const steps = container.querySelectorAll('[data-testid^="step-"]');
    expect(steps).toHaveLength(4);
  });

  it('highlights the active phase', () => {
    render(<ProgressBar currentPhase="exploring" progress={50} />);
    const active = screen.getByTestId('step-exploring');
    expect(active.getAttribute('data-active')).toBe('true');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm test -- --run src/renderer/src/components/planning/__tests__/ProgressBar.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create: `electron-ui/renderer/src/components/planning/ProgressBar.tsx`

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { PlanningPhase } from '../../../../shared/types/websocket';

interface ProgressBarProps {
  currentPhase: PlanningPhase | null;
  progress: number;
}

const PHASES: Array<{ key: PlanningPhase; label: string }> = [
  { key: 'fetching', label: 'Fetching Issue' },
  { key: 'exploring', label: 'Exploring Codebase' },
  { key: 'planning', label: 'Building Plan' },
  { key: 'writing_hints', label: 'Writing Hints' },
];

const PHASE_ORDER: Record<PlanningPhase, number> = {
  fetching: 0,
  exploring: 1,
  planning: 2,
  writing_hints: 3,
};

export function ProgressBar({ currentPhase, progress }: ProgressBarProps): React.ReactElement {
  const currentIndex = currentPhase ? PHASE_ORDER[currentPhase] : -1;

  return (
    <div style={containerStyle}>
      {/* Progress track */}
      <div style={trackStyle}>
        <motion.div
          style={fillStyle}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        />
      </div>

      {/* Phase steps */}
      <div style={stepsStyle}>
        {PHASES.map((phase, i) => {
          const isComplete = i < currentIndex;
          const isActive = i === currentIndex;

          return (
            <div
              key={phase.key}
              data-testid={`step-${phase.key}`}
              data-active={isActive ? 'true' : 'false'}
              style={stepStyle}
            >
              <motion.div
                style={{
                  ...dotStyle,
                  background: isComplete
                    ? 'var(--status-success)'
                    : isActive
                      ? 'var(--accent-primary)'
                      : 'var(--bg-elevated)',
                  borderColor: isComplete || isActive
                    ? 'transparent'
                    : 'var(--text-muted)',
                }}
                animate={isActive ? {
                  boxShadow: [
                    '0 0 0 0 rgba(217, 119, 87, 0.4)',
                    '0 0 0 6px rgba(217, 119, 87, 0)',
                    '0 0 0 0 rgba(217, 119, 87, 0.4)',
                  ],
                } : {}}
                transition={isActive ? { duration: 2, repeat: Infinity } : {}}
              >
                {isComplete && <span style={checkStyle}>&#10003;</span>}
              </motion.div>
              <span
                style={{
                  ...labelStyle,
                  color: isActive
                    ? 'var(--text-primary)'
                    : isComplete
                      ? 'var(--text-secondary)'
                      : 'var(--text-muted)',
                }}
              >
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
};

const trackStyle: React.CSSProperties = {
  height: '4px',
  background: 'var(--bg-elevated)',
  borderRadius: '2px',
  overflow: 'hidden',
  marginBottom: 'var(--space-md)',
};

const fillStyle: React.CSSProperties = {
  height: '100%',
  background: 'var(--accent-primary)',
  borderRadius: '2px',
};

const stepsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
};

const stepStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-xs)',
};

const dotStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  border: '2px solid transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const checkStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontWeight: 700,
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  whiteSpace: 'nowrap',
};
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm test -- --run src/renderer/src/components/planning/__tests__/ProgressBar.test.tsx`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add electron-ui/renderer/src/components/planning/ProgressBar.tsx electron-ui/renderer/src/components/planning/__tests__/ProgressBar.test.tsx
git commit -m "feat(electron-ui): add planning ProgressBar component with phase indicators"
```

---

## Task 11: Create ActivityLog Component

**Files:**
- Create: `electron-ui/renderer/src/components/planning/ActivityLog.tsx`

**Step 1: Write the failing test**

Create: `electron-ui/renderer/src/components/planning/__tests__/ActivityLog.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityLog } from '../ActivityLog';
import type { LogEntry } from '../../../hooks/usePlanningProgress';

describe('ActivityLog', () => {
  it('renders log entries', () => {
    const logs: LogEntry[] = [
      { message: 'Reading package.json...', timestamp: Date.now() },
      { message: 'Searching for routes...', toolName: 'Grep', timestamp: Date.now() },
    ];
    render(<ActivityLog logs={logs} />);
    expect(screen.getByText('Reading package.json...')).toBeTruthy();
    expect(screen.getByText('Searching for routes...')).toBeTruthy();
  });

  it('renders empty state when no logs', () => {
    const { container } = render(<ActivityLog logs={[]} />);
    expect(container.textContent).toContain('Waiting');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm test -- --run src/renderer/src/components/planning/__tests__/ActivityLog.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create: `electron-ui/renderer/src/components/planning/ActivityLog.tsx`

```tsx
import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LogEntry } from '../../hooks/usePlanningProgress';

interface ActivityLogProps {
  logs: LogEntry[];
}

export function ActivityLog({ logs }: ActivityLogProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div style={containerStyle} ref={scrollRef}>
      {logs.length === 0 ? (
        <span style={emptyStyle}>Waiting for agent to start...</span>
      ) : (
        <AnimatePresence initial={false}>
          {logs.map((entry, i) => (
            <motion.div
              key={`${entry.timestamp}-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              style={entryStyle}
            >
              <span style={bulletStyle}>{'>'}</span>
              <span style={messageStyle}>{entry.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
  height: '200px',
  overflowY: 'auto',
  background: 'var(--bg-inset)',
  borderRadius: '8px',
  padding: 'var(--space-sm) var(--space-md)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
};

const emptyStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontStyle: 'italic',
};

const entryStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-xs)',
  padding: '2px 0',
};

const bulletStyle: React.CSSProperties = {
  color: 'var(--accent-primary)',
  flexShrink: 0,
};

const messageStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
};
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm test -- --run src/renderer/src/components/planning/__tests__/ActivityLog.test.tsx`
Expected: All 2 tests PASS

**Step 5: Commit**

```bash
git add electron-ui/renderer/src/components/planning/ActivityLog.tsx electron-ui/renderer/src/components/planning/__tests__/ActivityLog.test.tsx
git commit -m "feat(electron-ui): add planning ActivityLog component with auto-scroll"
```

---

## Task 12: Create PlanningLoader View

**Files:**
- Create: `electron-ui/renderer/src/views/PlanningLoader.tsx`

**Step 1: Write the failing test**

Create: `electron-ui/renderer/src/views/__tests__/PlanningLoader.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanningLoader } from '../PlanningLoader';

// Mock the hook
vi.mock('../../hooks/usePlanningProgress', () => ({
  usePlanningProgress: () => ({
    status: 'loading',
    issueTitle: 'Add dark mode',
    currentPhase: 'exploring',
    progress: 50,
    logs: [{ message: 'Reading package.json...', timestamp: Date.now() }],
    result: null,
    error: null,
  }),
}));

// Mock child components
vi.mock('../../components/planning/ProgressBar', () => ({
  ProgressBar: ({ currentPhase }: any) => <div data-testid="progress-bar">{currentPhase}</div>,
}));
vi.mock('../../components/planning/ActivityLog', () => ({
  ActivityLog: ({ logs }: any) => <div data-testid="activity-log">{logs.length} entries</div>,
}));

describe('PlanningLoader', () => {
  it('renders the PAIGE ASCII banner', () => {
    render(<PlanningLoader onComplete={() => {}} />);
    expect(screen.getByText(/PAIGE/)).toBeTruthy();
  });

  it('renders the progress bar', () => {
    render(<PlanningLoader onComplete={() => {}} />);
    expect(screen.getByTestId('progress-bar')).toBeTruthy();
  });

  it('renders the activity log', () => {
    render(<PlanningLoader onComplete={() => {}} />);
    expect(screen.getByTestId('activity-log')).toBeTruthy();
  });

  it('shows issue title', () => {
    render(<PlanningLoader onComplete={() => {}} />);
    expect(screen.getByText(/Add dark mode/)).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm test -- --run src/renderer/src/views/__tests__/PlanningLoader.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create: `electron-ui/renderer/src/views/PlanningLoader.tsx`

```tsx
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ProgressBar } from '../components/planning/ProgressBar';
import { ActivityLog } from '../components/planning/ActivityLog';
import { usePlanningProgress } from '../hooks/usePlanningProgress';
import type { PlanningCompletePayload } from '../../../shared/types/websocket';

interface PlanningLoaderProps {
  onComplete: (result: PlanningCompletePayload) => void;
  onError?: (error: string) => void;
  onRetry?: () => void;
}

const PAIGE_ASCII = `    ____  ___    ____________
   / __ \\/   |  /  _/ ____/ ____
  / /_/ / /| |  / // / __/ __/
 / ____/ ___ |_/ // /_/ / /___
/_/   /_/  |_/___/\\____/_____/`;

export function PlanningLoader({ onComplete, onError, onRetry }: PlanningLoaderProps): React.ReactElement {
  const { status, issueTitle, currentPhase, progress, logs, result, error } = usePlanningProgress();

  // Transition to IDE when complete
  useEffect(() => {
    if (status === 'complete' && result) {
      // Brief delay for the 100% progress animation to land
      const timer = setTimeout(() => onComplete(result), 600);
      return () => clearTimeout(timer);
    }
  }, [status, result, onComplete]);

  useEffect(() => {
    if (status === 'error' && error && onError) {
      onError(error);
    }
  }, [status, error, onError]);

  return (
    <div style={containerStyle}>
      {/* Layer 1: Animated ASCII Banner */}
      <motion.pre
        style={bannerStyle}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {PAIGE_ASCII}
      </motion.pre>

      {/* Issue title */}
      {issueTitle && (
        <motion.p
          style={titleStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Preparing: {issueTitle}
        </motion.p>
      )}

      {/* Layer 2: Progress Bar */}
      <div style={progressContainerStyle}>
        <ProgressBar currentPhase={currentPhase} progress={progress} />
      </div>

      {/* Layer 3: Activity Log */}
      <div style={logContainerStyle}>
        <ActivityLog logs={logs} />
      </div>

      {/* Error state */}
      {status === 'error' && (
        <motion.div
          style={errorStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p style={errorTextStyle}>{error}</p>
          {onRetry && (
            <button onClick={onRetry} style={retryButtonStyle}>
              Retry
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: 'var(--space-lg)',
  padding: 'var(--space-xl)',
  background: 'var(--bg-base)',
};

const bannerStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '14px',
  lineHeight: 1.2,
  color: 'var(--accent-primary)',
  whiteSpace: 'pre',
  textAlign: 'center',
  margin: 0,
};

const titleStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-body-size)',
  fontFamily: 'var(--font-family)',
  margin: 0,
};

const progressContainerStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
};

const logContainerStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
};

const errorStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-sm)',
};

const errorTextStyle: React.CSSProperties = {
  color: 'var(--status-error)',
  fontSize: 'var(--font-body-size)',
  fontFamily: 'var(--font-family)',
};

const retryButtonStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-md)',
  borderRadius: '6px',
  border: 'none',
  background: 'var(--accent-primary)',
  color: 'var(--text-primary)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-family)',
};
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm test -- --run src/renderer/src/views/__tests__/PlanningLoader.test.tsx`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add electron-ui/renderer/src/views/PlanningLoader.tsx electron-ui/renderer/src/views/__tests__/PlanningLoader.test.tsx
git commit -m "feat(electron-ui): add PlanningLoader view with ASCII banner, progress bar, activity log"
```

---

## Task 13: Wire PlanningLoader into AppShell Routing

**Files:**
- Modify: `electron-ui/renderer/src/App.tsx` (or `AppShell.tsx` — wherever view routing lives)

**Step 1: Read the current routing code**

Read: `electron-ui/renderer/src/App.tsx`

Understand how `AppView` type is used and how views transition.

**Step 2: Add 'planning' to AppView type**

In `electron-ui/shared/types/` (wherever `AppView` is defined):

```typescript
export type AppView = 'dashboard' | 'ide' | 'planning' | 'placeholder' | 'landing';
```

**Step 3: Add PlanningLoader to the view switch**

In the component that renders views (AppShell or App):

```typescript
import { PlanningLoader } from './views/PlanningLoader';
```

Add case in the view rendering:
```typescript
case 'planning':
  return (
    <PlanningLoader
      onComplete={(result) => {
        // Store result for IDE to consume
        setPlanningResult(result);
        setView('ide');
      }}
      onRetry={() => {
        // Re-send session:select_issue
        // This depends on how the issue data is stored
      }}
    />
  );
```

Add state for the planning result:
```typescript
const [planningResult, setPlanningResult] = useState<PlanningCompletePayload | null>(null);
```

Pass `planningResult` to the IDE view so it can initialize with the plan data.

**Step 4: Run typecheck**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add electron-ui/renderer/src/ electron-ui/shared/
git commit -m "feat(electron-ui): wire PlanningLoader into app view routing"
```

---

## Task 14: Update IssueModal Navigation to Planning View

**Files:**
- Modify: `electron-ui/renderer/src/components/dashboard/IssueModal.tsx` (or GitHubIssues.tsx — wherever `handleWorkOnThis` is)

**Step 1: Read the current issue modal code**

Read: `electron-ui/renderer/src/components/dashboard/IssueModal.tsx`

Understand the current `handleWorkOnThis` function.

**Step 2: Change navigation target from 'ide' to 'planning'**

Find the `handleWorkOnThis` callback. Currently it does:
```typescript
send('session:select_issue', { issueNumber: issue.number });
onNavigate('ide', { issueNumber: issue.number });
```

Change to send the full issue data needed by the planning handler, and navigate to planning:
```typescript
const handleWorkOnThis = useCallback(() => {
  if (issue) {
    send('session:select_issue', {
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueBody: issue.body,
      issueLabels: issue.labels.map((l) => l.name),
      issueUrl: issue.htmlUrl,
    });
    onNavigate('planning');
  }
}, [issue, send, onNavigate]);
```

**Step 3: Run typecheck**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm run typecheck`
Expected: No errors

**Step 4: Run full frontend test suite**

Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add electron-ui/renderer/src/components/dashboard/IssueModal.tsx
git commit -m "feat(electron-ui): route 'Work on this' through planning loader instead of direct IDE"
```

---

## Task 15: Create Nudge Agent Module

**Files:**
- Create: `src/planning/nudge-agent.ts`

**Step 1: Write the failing test**

Create: `src/planning/__tests__/nudge-agent.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateNudge } from '../nudge-agent.js';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';
const mockQuery = vi.mocked(query);

describe('generateNudge', () => {
  it('returns nudge message from agent result', async () => {
    const messages = [
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      { type: 'result', subtype: 'success', result: 'It looks like you might be stuck on the JWT middleware. Try looking at how the existing auth.ts file handles token parsing.' },
    ];

    mockQuery.mockReturnValue((async function* () {
      for (const msg of messages) yield msg;
    })());

    const nudge = await generateNudge({
      sessionContext: 'User is working on auth middleware, idle for 3 minutes',
      currentPhase: 'Implement JWT validation',
      currentFile: 'src/auth/middleware.ts',
      repoPath: '/tmp/repo',
    });

    expect(nudge).toContain('JWT');
  });

  it('returns null when agent fails', async () => {
    mockQuery.mockReturnValue((async function* () {
      throw new Error('API error');
    })());

    const nudge = await generateNudge({
      sessionContext: 'test',
      currentPhase: 'test',
      currentFile: null,
      repoPath: '/tmp/repo',
    });

    expect(nudge).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/planning/__tests__/nudge-agent.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create: `src/planning/nudge-agent.ts`

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

interface NudgeInput {
  sessionContext: string;
  currentPhase: string;
  currentFile: string | null;
  repoPath: string;
}

const NUDGE_SYSTEM_PROMPT = `You are a supportive coding coach helping a junior developer. Based on the context provided, generate a brief, encouraging nudge message (1-3 sentences) to help them move forward. Be specific to their current task. Never give away the answer — guide, don't solve.`;

export async function generateNudge(input: NudgeInput): Promise<string | null> {
  const prompt = `The developer is working on: ${input.currentPhase}
Current context: ${input.sessionContext}
${input.currentFile ? `They have open: ${input.currentFile}` : 'No file currently open.'}

Generate a brief coaching nudge to help them move forward.`;

  try {
    let result = '';

    const stream = query({
      prompt,
      options: {
        allowedTools: ['Read'],
        permissionMode: 'bypassPermissions',
        cwd: input.repoPath,
        systemPrompt: NUDGE_SYSTEM_PROMPT,
        model: 'claude-haiku-4-5-20251001',
        maxTurns: 2,
      },
    });

    for await (const message of stream) {
      if (message.type === 'result' && message.subtype === 'success') {
        result = message.result ?? '';
      }
    }

    return result || null;
  } catch {
    return null;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/planning/__tests__/nudge-agent.test.ts`
Expected: All 2 tests PASS

**Step 5: Commit**

```bash
git add src/planning/nudge-agent.ts src/planning/__tests__/nudge-agent.test.ts
git commit -m "feat(planning): add Haiku-powered nudge agent for coaching messages"
```

---

## Task 16: Update Observer to Use Nudge Agent

**Files:**
- Modify: `src/observer/nudge.ts`

**Step 1: Read the current nudge module**

Read: `src/observer/nudge.ts`

Understand how `deliverNudge` currently works.

**Step 2: Replace terminal nudge with Agent SDK nudge**

Import and call `generateNudge` from `../planning/nudge-agent.js`. Instead of sending a nudge to the terminal, generate one via the agent and broadcast it via WebSocket:

```typescript
import { generateNudge } from '../planning/nudge-agent.js';
import { broadcast } from '../websocket/server.js';

export async function deliverNudge(payload: NudgePayload): Promise<void> {
  const nudgeMessage = await generateNudge({
    sessionContext: payload.context,
    currentPhase: payload.phase,
    currentFile: payload.currentFile,
    repoPath: payload.repoPath,
  });

  if (nudgeMessage) {
    broadcast({
      type: 'coaching:nudge',
      data: {
        message: nudgeMessage,
        source: 'observer',
        timestamp: Date.now(),
      },
    });
  }
}
```

Adapt the NudgePayload interface to include the fields the nudge agent needs (repoPath, currentFile, context, phase).

**Step 3: Run typecheck**

Run: `cd /home/ubuntu/Projects/paige && pnpm typecheck`
Expected: No errors

**Step 4: Run existing observer tests**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/observer/`
Expected: All tests pass (may need to update mocks)

**Step 5: Commit**

```bash
git add src/observer/nudge.ts
git commit -m "feat(observer): replace terminal nudges with Agent SDK coaching messages"
```

---

## Task 17: End-to-End Smoke Test

**Files:**
- Create: `src/planning/__tests__/integration.test.ts`

**Step 1: Write an integration test for the full planning flow**

This test mocks the Agent SDK but tests the real WebSocket handler → parser → storage → response flow.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePlanningStart } from '../../websocket/handlers/planning.js';

vi.mock('../../planning/agent.js');
vi.mock('../../websocket/server.js');
vi.mock('../../database/db.js');
vi.mock('../../file-system/tree.js');
vi.mock('../../config/env.js');

import { runPlanningAgent } from '../../planning/agent.js';
import { sendToClient } from '../../websocket/server.js';
import { getDatabase } from '../../database/db.js';
import { scanProjectTree } from '../../file-system/tree.js';
import { getEnv } from '../../config/env.js';

describe('Planning flow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnv).mockReturnValue({ projectDir: '/tmp/repo' } as any);
    vi.mocked(scanProjectTree).mockResolvedValue({
      name: 'root', path: '.', type: 'directory', children: [],
    });
    vi.mocked(getDatabase).mockReturnValue(null); // skip DB for smoke test
  });

  it('sends planning:started then planning:complete on success', async () => {
    vi.mocked(runPlanningAgent).mockImplementation(async ({ callbacks }) => {
      callbacks.onProgress({ message: 'Reading...' });
      callbacks.onPhaseUpdate('exploring', 50);
      callbacks.onComplete({
        title: 'Test Plan',
        summary: 'A test',
        relevant_files: ['src/index.ts'],
        phases: [{
          number: 1,
          title: 'Phase 1',
          description: 'Do it',
          hint: 'Start',
          tasks: [{
            title: 'Task 1',
            description: 'First',
            target_files: ['src/index.ts'],
            hints: { low: 'L', medium: 'M', high: 'H' },
          }],
        }],
      });
    });

    handlePlanningStart({} as any, {
      issueNumber: 1,
      issueTitle: 'Test',
      issueBody: 'Body',
      issueLabels: [],
      issueUrl: 'https://github.com/test',
    }, 'conn-1');

    // Wait for async flow
    await new Promise((r) => setTimeout(r, 50));

    const calls = vi.mocked(sendToClient).mock.calls;
    const types = calls.map(([, msg]) => (msg as any).type);

    expect(types).toContain('planning:started');
    expect(types).toContain('planning:phase_update');
    expect(types).toContain('planning:progress');
    expect(types).toContain('planning:complete');

    // Verify complete payload has plan data
    const completeCall = calls.find(([, msg]) => (msg as any).type === 'planning:complete');
    expect(completeCall).toBeDefined();
    const payload = (completeCall![1] as any).data;
    expect(payload.plan.title).toBe('Test Plan');
    expect(payload.fileTree).toBeDefined();
    expect(payload.issueContext.number).toBe(1);
  });
});
```

**Step 2: Run the integration test**

Run: `cd /home/ubuntu/Projects/paige && pnpm vitest run src/planning/__tests__/integration.test.ts`
Expected: PASS

**Step 3: Run full test suites**

Run: `cd /home/ubuntu/Projects/paige && pnpm test`
Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm test`
Expected: All tests pass in both projects

**Step 4: Run both typechecks**

Run: `cd /home/ubuntu/Projects/paige && pnpm typecheck`
Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm run typecheck`
Expected: No errors in either

**Step 5: Run linters**

Run: `cd /home/ubuntu/Projects/paige && pnpm lint`
Run: `cd /home/ubuntu/Projects/paige/electron-ui && npm run lint`
Expected: No errors

**Step 6: Commit**

```bash
git add src/planning/__tests__/integration.test.ts
git commit -m "test(planning): add end-to-end integration test for planning flow"
```

---

## Summary

| Task | Component | Files | Estimated Steps |
|------|-----------|-------|----------------|
| 1 | Install SDK | package.json | 3 |
| 2 | Backend WS types | src/types/websocket.ts | 5 |
| 3 | Plan parser | src/planning/parser.ts + test | 5 |
| 4 | Agent prompts | src/planning/prompts.ts + test | 5 |
| 5 | Planning agent | src/planning/agent.ts + test | 6 |
| 6 | WS handler | src/websocket/handlers/planning.ts + test | 6 |
| 7 | Router wiring | src/websocket/router.ts | 5 |
| 8 | Frontend types | electron-ui/shared/types/ | 4 |
| 9 | Progress hook | electron-ui/renderer/src/hooks/ + test | 5 |
| 10 | ProgressBar | electron-ui/renderer/src/components/planning/ + test | 5 |
| 11 | ActivityLog | electron-ui/renderer/src/components/planning/ + test | 5 |
| 12 | PlanningLoader view | electron-ui/renderer/src/views/ + test | 5 |
| 13 | App routing | electron-ui/renderer/src/App.tsx | 5 |
| 14 | Issue modal nav | electron-ui/renderer/src/components/dashboard/ | 5 |
| 15 | Nudge agent | src/planning/nudge-agent.ts + test | 5 |
| 16 | Observer update | src/observer/nudge.ts | 5 |
| 17 | Integration test | src/planning/__tests__/integration.test.ts | 6 |
