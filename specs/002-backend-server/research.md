# Research: Backend Server

**Feature**: Backend Server | **Date**: 2026-02-11

## Research Questions

This document consolidates research findings for technical decisions and best practices needed for the backend server implementation.

---

## 1. Test Framework Selection

**Decision**: Vitest

**Rationale**:
- **ESM-native**: Works seamlessly with native ES modules (no complex Jest ESM transforms)
- **TypeScript-first**: Zero-config TypeScript support out of the box
- **Fast**: Up to 10x faster than Jest due to Vite's transformation caching
- **Jest-compatible API**: Minimal migration effort if familiar with Jest
- **Watch mode**: Built-in watch mode with smart re-run
- **UI**: Optional Vitest UI for visual test exploration

**Alternatives Considered**:
- **Jest**: Mature, widely used, but ESM support still experimental, slower transformation
- **Node.js Test Runner**: Native, no dependencies, but minimal ecosystem, no snapshots
- **ava**: Fast, concurrent, but less TypeScript support, smaller ecosystem

**Configuration**:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['tests/**', '**/*.test.ts']
    }
  }
})
```

---

## 2. Testing Strategy

**Decision**: 3-tier testing (unit → integration → contract)

**Happy Path Tests (12 stories)**:
1. **Server Foundation** (Story 1): `tests/integration/server-lifecycle.test.ts` - Start, MCP init, WebSocket connect, health check, graceful shutdown
2. **SQLite State** (Story 2): `tests/integration/database-lifecycle.test.ts` - Fresh DB creation, full session lifecycle round-trip
3. **File System** (Story 3): `tests/integration/file-system.test.ts` - Read, write, buffer cache, diff, tree scan, path validation
4. **Action Logging** (Story 4): `tests/integration/action-logging.test.ts` - Actions logged, buffer summaries, API calls tracked
5. **WebSocket Protocol** (Story 5): `tests/integration/websocket.test.ts` - Handshake, file ops dispatch, buffer updates, broadcasts
6. **MCP Tools** (Story 6): `tests/integration/mcp-tools.test.ts` - All 12 tools callable, read ops return data, UI ops broadcast
7. **Claude API Client** (Story 7): `tests/integration/api-client.test.ts` - Structured outputs, model resolution, retries, cost tracking
8. **ChromaDB Memory** (Story 8): `tests/integration/chromadb.test.ts` - Memories stored, semantic search works, degradation graceful
9. **Coaching Pipeline** (Story 9): `tests/integration/coaching-pipeline.test.ts` - Full pipeline stores plan, wrap-up calls 3 agents
10. **Observer** (Story 10): `tests/integration/observer.test.ts` - Starts with session, triggers triage, delivers nudges, suppression works
11. **UI-Driven APIs** (Story 11): `tests/integration/ui-apis.test.ts` - Explain This returns explanation, Practice Review unlocks constraints
12. **Dashboard** (Story 12): `tests/integration/dashboard.test.ts` - Immediate response, stats filtered, issues assessed, learning materials

**Unit Tests**: Fast, isolated tests for pure functions (no I/O)
- Database queries (mocked better-sqlite3)
- File path validation
- Buffer diff computation
- API cost calculation
- Message routing logic

**Contract Tests**: Protocol conformance
- MCP tool schemas match spec (Zod validation)
- WebSocket message types match spec (TypeScript type checking)

---

## 3. TypeScript Strict Mode Configuration

**Decision**: Full strict mode with all checks enabled

**tsconfig.json** (recommended):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,

    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Rationale**:
- `strict: true` enables all strict type-checking options
- `noUncheckedIndexedAccess` catches missing property checks (Map.get, array access)
- `noUnusedLocals/Parameters` catches dead code early
- `forceConsistentCasingInFileNames` prevents cross-platform file system issues

---

## 4. Linting & Formatting Setup

**Decision**: ESLint + Prettier with TypeScript support

**ESLint** (`.eslintrc.json`):
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

**Prettier** (`.prettierrc.json`):
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Pre-commit Hooks** (using `husky` + `lint-staged`):
```json
{
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**Rationale**:
- ESLint catches type errors, promise misuse, unused vars
- Prettier enforces consistent formatting (no bikeshedding)
- Pre-commit hooks prevent committing code with warnings (per constitution)

---

## 5. MCP SDK Best Practices

**Decision**: Use Streamable HTTP transport with stateful sessions

**Key Patterns**:

1. **Server Setup**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHttpServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

const server = new Server({ name: 'paige-backend', version: '1.0.0' }, {
  capabilities: {
    tools: {},
    resources: {}
  }
})

const transport = new StreamableHttpServerTransport({
  endpoint: '/mcp',
  sessionIdHeader: 'Mcp-Session-Id'
})

server.connect(transport)
```

2. **Tool Registration**:
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'paige_get_buffer',
      description: 'Get current editor buffer state for a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' }
        },
        required: ['path']
      }
    }
  ]
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'paige_get_buffer') {
    const buffer = getBuffer(args.path)
    return {
      content: [{ type: 'text', text: JSON.stringify(buffer) }]
    }
  }

  throw new Error(`Unknown tool: ${name}`)
})
```

3. **Session Management**:
```typescript
const sessions = new Map<string, Session>()

transport.onNewSession = (sessionId) => {
  sessions.set(sessionId, createSession())
}

transport.onSessionClose = (sessionId) => {
  sessions.delete(sessionId)
}
```

**Rationale**:
- Streamable HTTP enables stateful sessions (required for multi-turn coaching)
- Session ID header tracks state across requests
- Tool schemas enable IDE autocomplete in Claude Code

---

## 6. SQLite + Kysely Best Practices

**Decision**: Kysely for type-safe queries, better-sqlite3 for driver

**Key Patterns**:

1. **Database Setup**:
```typescript
import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

const dialect = new SqliteDialect({
  database: new Database(dbPath)
})

const db = new Kysely<DatabaseSchema>({ dialect })

// Enable WAL mode for concurrent reads
db.connection().run('PRAGMA journal_mode = WAL')
```

2. **Type Definitions**:
```typescript
interface DatabaseSchema {
  sessions: SessionsTable
  plans: PlansTable
  phases: PhasesTable
  // ... all 10 tables
}

interface SessionsTable {
  id: Generated<number>
  project_dir: string
  issue_number: number | null
  issue_title: string | null
  status: 'active' | 'completed'
  started_at: string
  ended_at: string | null
}
```

3. **Typed Queries**:
```typescript
async function createSession(data: InsertableSession): Promise<Session> {
  return await db
    .insertInto('sessions')
    .values(data)
    .returningAll()
    .executeTakeFirstOrThrow()
}

async function getActiveSession(): Promise<Session | null> {
  return await db
    .selectFrom('sessions')
    .selectAll()
    .where('status', '=', 'active')
    .executeTakeFirst()
}
```

**Rationale**:
- Kysely provides full type safety (compile-time SQL validation)
- better-sqlite3 is faster than node-sqlite3 (synchronous C++ bindings)
- WAL mode enables concurrent reads without blocking writes
- `executeTakeFirstOrThrow` vs `executeTakeFirst` makes null-handling explicit

---

## 7. WebSocket Protocol Typing

**Decision**: Discriminated unions for message types

**Key Patterns**:

1. **Message Type Definitions**:
```typescript
// Client → Server
type ClientMessage =
  | { type: 'connection:hello'; data: { version: string; platform: string } }
  | { type: 'file:open'; data: { path: string } }
  | { type: 'file:save'; data: { path: string; content: string } }
  | { type: 'buffer:update'; data: { path: string; content: string; cursorPosition: number } }
  // ... 23 types total

// Server → Client
type ServerMessage =
  | { type: 'connection:init'; data: { sessionId: string; capabilities: Capabilities } }
  | { type: 'fs:content'; data: { path: string; content: string; language: string } }
  | { type: 'editor:open_file'; data: { path: string; content: string } }
  // ... 32 types total
```

2. **Type-Safe Router**:
```typescript
type MessageHandler<T extends ClientMessage> = (
  data: T['data'],
  ws: WebSocket
) => void | Promise<void>

const handlers: {
  [K in ClientMessage['type']]: MessageHandler<Extract<ClientMessage, { type: K }>>
} = {
  'connection:hello': handleHello,
  'file:open': handleFileOpen,
  // ... all 23 handlers
}

function routeMessage(message: ClientMessage, ws: WebSocket) {
  const handler = handlers[message.type]
  if (handler) {
    return handler(message.data, ws)
  }
  console.warn(`Unknown message type: ${message.type}`)
}
```

**Rationale**:
- Discriminated unions enable exhaustive type checking
- Type narrowing ensures handlers receive correct data shape
- Adding new message types causes compile errors until handler is added

---

## 8. ChromaDB Client Best Practices

**Decision**: Lazy connection with graceful degradation

**Key Patterns**:

1. **Client Setup**:
```typescript
import { ChromaClient } from 'chromadb'

let client: ChromaClient | null = null
let isAvailable = false

async function ensureClient(): Promise<ChromaClient | null> {
  if (client && isAvailable) return client

  try {
    client = new ChromaClient({ path: 'http://localhost:8000' })
    await client.heartbeat() // Test connection
    isAvailable = true
    return client
  } catch (error) {
    console.warn('ChromaDB unavailable, memory features disabled')
    isAvailable = false
    return null
  }
}
```

2. **Graceful Degradation**:
```typescript
async function queryMemories(query: string): Promise<Memory[]> {
  const client = await ensureClient()
  if (!client) return [] // Degraded: no memories

  try {
    const collection = await client.getOrCreateCollection({ name: 'paige_memories' })
    const results = await collection.query({ queryTexts: [query], nResults: 5 })
    return formatResults(results)
  } catch (error) {
    console.error('Memory query failed:', error)
    isAvailable = false // Mark as unavailable for next call
    return []
  }
}
```

**Rationale**:
- Lazy connection defers ChromaDB requirement to runtime (server starts even if ChromaDB down)
- Heartbeat validates connection before use
- Graceful degradation returns empty arrays (not errors) so coaching pipeline continues
- Availability flag prevents repeated connection attempts

---

## 9. Error Handling Patterns

**Decision**: Fail-fast with structured errors and clear context

**Key Patterns**:

1. **Custom Error Classes**:
```typescript
export class ConfigError extends Error {
  constructor(message: string, public readonly missingVars: string[]) {
    super(message)
    this.name = 'ConfigError'
  }
}

export class PathTraversalError extends Error {
  constructor(public readonly attemptedPath: string) {
    super(`Path traversal attempt: ${attemptedPath}`)
    this.name = 'PathTraversalError'
  }
}
```

2. **Validation at Boundaries**:
```typescript
function validateEnvironment(): void {
  const missing: string[] = []
  if (!process.env.PROJECT_DIR) missing.push('PROJECT_DIR')
  if (!process.env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY')

  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required environment variables: ${missing.join(', ')}`,
      missing
    )
  }

  if (!fs.existsSync(process.env.PROJECT_DIR)) {
    throw new ConfigError(
      `PROJECT_DIR does not exist: ${process.env.PROJECT_DIR}`,
      []
    )
  }
}
```

3. **Error Logging**:
```typescript
try {
  await dangerousOperation()
} catch (error) {
  console.error('Operation failed:', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: { sessionId, path, timestamp: new Date().toISOString() }
  })
  throw error // Re-throw after logging
}
```

**Rationale**:
- Custom error classes enable type-safe error handling
- Early validation (at app startup, at request boundaries) fails fast with clear messages
- Structured logging (JSON) enables grep-able error context
- Re-throwing preserves stack traces

---

## 10. API Client Retry Logic

**Decision**: Exponential backoff with jitter for transient failures

**Key Patterns**:

1. **Retry Configuration**:
```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1
}

function calculateDelay(attempt: number): number {
  const baseDelay = Math.min(
    RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
    RETRY_CONFIG.maxDelayMs
  )
  const jitter = baseDelay * RETRY_CONFIG.jitterFactor * (Math.random() - 0.5)
  return baseDelay + jitter
}
```

2. **Retry Logic**:
```typescript
async function callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry on non-transient errors
      if (error.status && error.status < 500) {
        throw error
      }

      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = calculateDelay(attempt)
        console.warn(`Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError!
}
```

**Rationale**:
- Exponential backoff reduces load on overloaded services
- Jitter prevents thundering herd (multiple clients retrying simultaneously)
- Only retry transient errors (5xx, network timeouts), not client errors (4xx)
- Log retry attempts for observability

---

## Summary

All research questions resolved. Key decisions:

1. **Testing**: Vitest with 3-tier strategy (unit → integration → contract)
2. **TypeScript**: Full strict mode with noUncheckedIndexedAccess
3. **Linting**: ESLint + Prettier with pre-commit hooks
4. **MCP**: Streamable HTTP with stateful sessions
5. **Database**: Kysely + better-sqlite3 with WAL mode
6. **WebSocket**: Discriminated unions with type-safe router
7. **ChromaDB**: Lazy connection with graceful degradation
8. **Errors**: Custom error classes, fail-fast validation
9. **Retries**: Exponential backoff with jitter for transient failures

**Ready for Phase 1**: Data modeling and contract generation.
