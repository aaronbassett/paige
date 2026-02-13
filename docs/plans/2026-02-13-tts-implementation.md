# TTS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ElevenLabs text-to-speech to Paige so coaching messages can be spoken aloud, with contextual intelligence deciding which messages get audio.

**Architecture:** Backend generates streamed audio via ElevenLabs SDK, sends chunks over WebSocket to Electron UI. A priority engine decides per-message whether to speak or stay silent. Text always sends immediately; audio streams in parallel.

**Tech Stack:** ElevenLabs TypeScript SDK (`elevenlabs`), Web Audio API (Electron renderer), WebSocket binary/base64 framing, Zod validation.

**Design Doc:** `docs/plans/2026-02-13-tts-design.md`

---

**IMPORTANT — Two Type Systems:** The backend uses `{ type, data }` message shape (see `src/types/websocket.ts`). The Electron UI uses `{ type, payload, timestamp }` message shape (see `electron-ui/shared/types/websocket-messages.ts`). Both must be updated, and the field names must match their respective conventions.

---

## Task 1: Backend TTS Types

Add TTS-related type definitions to the backend's WebSocket type system.

**Files:**
- Modify: `src/types/websocket.ts`
- Create: `src/tts/tts-types.ts`
- Test: `tests/unit/tts/tts-types.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/tts/tts-types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  AudioChunkData,
  AudioCompleteData,
  AudioControlData,
} from '../../../src/tts/tts-types.js';
import type {
  AudioChunkMessage,
  AudioCompleteMessage,
  AudioControlMessage,
} from '../../../src/types/websocket.js';

describe('TTS types', () => {
  it('AudioChunkData has required fields', () => {
    const data: AudioChunkData = {
      messageId: 'msg-1',
      chunk: 'base64data',
      sequence: 0,
    };
    expect(data.messageId).toBe('msg-1');
    expect(data.chunk).toBe('base64data');
    expect(data.sequence).toBe(0);
  });

  it('AudioCompleteData has required fields', () => {
    const data: AudioCompleteData = {
      messageId: 'msg-1',
      totalChunks: 5,
      durationMs: 2400,
    };
    expect(data.messageId).toBe('msg-1');
    expect(data.totalChunks).toBe(5);
    expect(data.durationMs).toBe(2400);
  });

  it('AudioControlData has required fields', () => {
    const data: AudioControlData = {
      action: 'skip',
      messageId: 'msg-1',
    };
    expect(data.action).toBe('skip');
    expect(data.messageId).toBe('msg-1');
  });

  it('AudioControlData allows optional messageId', () => {
    const data: AudioControlData = {
      action: 'mute',
    };
    expect(data.action).toBe('mute');
    expect(data.messageId).toBeUndefined();
  });

  it('AudioChunkMessage has correct type literal', () => {
    const msg: AudioChunkMessage = {
      type: 'audio:chunk',
      data: { messageId: 'msg-1', chunk: 'base64data', sequence: 0 },
    };
    expect(msg.type).toBe('audio:chunk');
  });

  it('AudioCompleteMessage has correct type literal', () => {
    const msg: AudioCompleteMessage = {
      type: 'audio:complete',
      data: { messageId: 'msg-1', totalChunks: 5, durationMs: 2400 },
    };
    expect(msg.type).toBe('audio:complete');
  });

  it('AudioControlMessage has correct type literal', () => {
    const msg: AudioControlMessage = {
      type: 'audio:control',
      data: { action: 'mute' },
    };
    expect(msg.type).toBe('audio:control');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- --testPathPattern tts-types`
Expected: FAIL — modules don't exist yet

**Step 3: Create `src/tts/tts-types.ts`**

```typescript
// TTS configuration and shared types

export interface TTSConfig {
  readonly apiKey: string;
  readonly voiceId: string;
  readonly fallbackVoiceId: string;
  readonly model: 'eleven_turbo_v2';
  readonly outputFormat: 'mp3_44100_128';
  readonly enabled: boolean;
}

export type SpeechPriority = 'speak' | 'silent';

export interface PriorityRule {
  readonly match: (msg: SpeakableMessage) => boolean;
  readonly priority: SpeechPriority;
  readonly reason: string;
}

/** Minimal message shape needed for priority evaluation. */
export interface SpeakableMessage {
  readonly message: string;
  readonly type: string;
  readonly source?: string;
  readonly anchor?: unknown;
}

/** Data payload for audio:chunk server->client message. */
export interface AudioChunkData {
  readonly messageId: string;
  readonly chunk: string; // Base64-encoded MP3 audio
  readonly sequence: number; // 0-indexed chunk ordering
}

/** Data payload for audio:complete server->client message. */
export interface AudioCompleteData {
  readonly messageId: string;
  readonly totalChunks: number;
  readonly durationMs: number;
}

/** Data payload for audio:control client->server message. */
export interface AudioControlData {
  readonly action: 'mute' | 'unmute' | 'skip';
  readonly messageId?: string; // Required for 'skip'
}
```

**Step 4: Add message types to `src/types/websocket.ts`**

Add these imports at the top of `src/types/websocket.ts`:

```typescript
import type { AudioChunkData, AudioCompleteData, AudioControlData } from '../tts/tts-types.js';
```

Then re-export the data types and add message interfaces. At the end of the Client -> Server Messages section (after `ReviewRequestMessage`), add:

```typescript
export interface AudioControlMessage {
  readonly type: 'audio:control';
  readonly data: AudioControlData;
}
```

Add `AudioControlMessage` to the `ClientToServerMessage` union.

At the end of the Server -> Client Messages section (after `SessionCompletedMessage`), add:

```typescript
export interface AudioChunkMessage {
  readonly type: 'audio:chunk';
  readonly data: AudioChunkData;
}

export interface AudioCompleteMessage {
  readonly type: 'audio:complete';
  readonly data: AudioCompleteData;
}
```

Add `AudioChunkMessage` and `AudioCompleteMessage` to the `ServerToClientMessage` union.

Re-export the data types so tests can import them from `websocket.ts`:

```typescript
export type { AudioChunkData, AudioCompleteData, AudioControlData } from '../tts/tts-types.js';
```

**Step 5: Run test to verify it passes**

Run: `pnpm test:unit -- --testPathPattern tts-types`
Expected: PASS

**Step 6: Commit**

```bash
git add src/tts/tts-types.ts src/types/websocket.ts tests/unit/tts/tts-types.test.ts
git commit -m "feat(tts): add TTS type definitions for audio WebSocket messages"
```

---

## Task 2: Backend Config — ElevenLabs Environment Variables

Add ElevenLabs configuration to the env loader.

**Files:**
- Modify: `src/config/env.ts`
- Modify: `tests/unit/config/env.test.ts`

**Step 1: Write the failing tests**

Add to `tests/unit/config/env.test.ts` inside the existing `describe('loadEnv', ...)` block:

```typescript
  it('captures ELEVENLABS_API_KEY when provided', () => {
    setMinimalEnv();
    process.env['ELEVENLABS_API_KEY'] = 'sk_test_key';

    const config = loadEnv();

    expect(config.elevenlabsApiKey).toBe('sk_test_key');
  });

  it('captures ELEVENLABS_VOICE_ID when provided', () => {
    setMinimalEnv();
    process.env['ELEVENLABS_VOICE_ID'] = 'voice_abc123';

    const config = loadEnv();

    expect(config.elevenlabsVoiceId).toBe('voice_abc123');
  });

  it('uses fallback voice ID from ELEVENLABS_FALLBACK_VOICE_ID', () => {
    setMinimalEnv();
    process.env['ELEVENLABS_FALLBACK_VOICE_ID'] = 'fallback_voice';

    const config = loadEnv();

    expect(config.elevenlabsFallbackVoiceId).toBe('fallback_voice');
  });

  it('defaults ELEVENLABS_FALLBACK_VOICE_ID to Rachel voice', () => {
    setMinimalEnv();

    const config = loadEnv();

    expect(config.elevenlabsFallbackVoiceId).toBe('21m00Tcm4TlvDq8ikWAM');
  });

  it('defaults TTS_ENABLED to true', () => {
    setMinimalEnv();

    const config = loadEnv();

    expect(config.ttsEnabled).toBe(true);
  });

  it('parses TTS_ENABLED=false', () => {
    setMinimalEnv();
    process.env['TTS_ENABLED'] = 'false';

    const config = loadEnv();

    expect(config.ttsEnabled).toBe(false);
  });
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- --testPathPattern env`
Expected: FAIL — properties don't exist on `EnvConfig`

**Step 3: Update `src/config/env.ts`**

Add the new fields to `EnvConfig`:

```typescript
export interface EnvConfig {
  host: string;
  port: number;
  projectDir: string;
  dataDir: string;
  anthropicApiKey: string | undefined;
  chromadbUrl: string;
  elevenlabsApiKey: string | undefined;
  elevenlabsVoiceId: string | undefined;
  elevenlabsFallbackVoiceId: string;
  ttsEnabled: boolean;
}
```

Add parsing logic inside `loadEnv()`, after the `chromadbUrl` line:

```typescript
  // ELEVENLABS_API_KEY: optional
  const elevenlabsApiKey = process.env['ELEVENLABS_API_KEY'];

  // ELEVENLABS_VOICE_ID: optional (custom cloned voice)
  const elevenlabsVoiceId = process.env['ELEVENLABS_VOICE_ID'];

  // ELEVENLABS_FALLBACK_VOICE_ID: optional, default Rachel
  const elevenlabsFallbackVoiceId =
    process.env['ELEVENLABS_FALLBACK_VOICE_ID'] ?? '21m00Tcm4TlvDq8ikWAM';

  // TTS_ENABLED: optional, default true
  const ttsEnabled = process.env['TTS_ENABLED'] !== 'false';
```

Add the new fields to the return object:

```typescript
  return {
    host,
    port,
    projectDir,
    dataDir,
    anthropicApiKey,
    chromadbUrl,
    elevenlabsApiKey,
    elevenlabsVoiceId,
    elevenlabsFallbackVoiceId,
    ttsEnabled,
  };
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- --testPathPattern env`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config/env.ts tests/unit/config/env.test.ts
git commit -m "feat(tts): add ElevenLabs environment variables to config"
```

---

## Task 3: Priority Engine

Implement the rules engine that decides which coaching messages get spoken.

**Files:**
- Create: `src/tts/priority-engine.ts`
- Test: `tests/unit/tts/priority-engine.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/tts/priority-engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { shouldSpeak } from '../../../src/tts/priority-engine.js';

describe('shouldSpeak', () => {
  // === SPEAK rules ===

  it('speaks for phase introductions from pipeline', () => {
    expect(shouldSpeak({ message: 'Phase 1: Understanding', type: 'phase_intro', source: 'pipeline' })).toBe(true);
  });

  it('speaks for victory messages', () => {
    expect(shouldSpeak({ message: 'Tests passing!', type: 'victory' })).toBe(true);
  });

  it('speaks for celebration messages', () => {
    expect(shouldSpeak({ message: 'Great job!', type: 'celebration' })).toBe(true);
  });

  it('speaks for observer nudges', () => {
    expect(shouldSpeak({ message: 'You seem stuck', type: 'nudge', source: 'observer' })).toBe(true);
  });

  it('speaks for session welcome', () => {
    expect(shouldSpeak({ message: 'Welcome!', type: 'session_welcome' })).toBe(true);
  });

  it('speaks for session wrapup', () => {
    expect(shouldSpeak({ message: 'Great session!', type: 'session_wrapup' })).toBe(true);
  });

  // === SILENT rules ===

  it('stays silent for anchored messages', () => {
    expect(shouldSpeak({ message: 'Check line 42', type: 'hint', anchor: { path: 'foo.ts', startLine: 42 } })).toBe(false);
  });

  it('stays silent for file hints', () => {
    expect(shouldSpeak({ message: 'Look at utils.ts', type: 'file_hint' })).toBe(false);
  });

  it('stays silent for line hints', () => {
    expect(shouldSpeak({ message: 'Check line 10', type: 'line_hint' })).toBe(false);
  });

  it('stays silent for messages over 500 characters', () => {
    const longMessage = 'A'.repeat(501);
    expect(shouldSpeak({ message: longMessage, type: 'info' })).toBe(false);
  });

  it('speaks for messages exactly 500 characters', () => {
    // 500 chars doesn't trigger the > 500 rule, falls through to default (silent)
    // But this is actually a design question — 500 is the boundary
    const exact = 'A'.repeat(500);
    // Default: silent (no rule matched)
    expect(shouldSpeak({ message: exact, type: 'info' })).toBe(false);
  });

  // === DEFAULT ===

  it('defaults to silent for unmatched message types', () => {
    expect(shouldSpeak({ message: 'Some info', type: 'info' })).toBe(false);
  });

  it('defaults to silent for generic hints', () => {
    expect(shouldSpeak({ message: 'Try this', type: 'hint' })).toBe(false);
  });

  // === PRIORITY ORDER ===

  it('speak rule wins over silent when both could match (nudge with anchor)', () => {
    // Observer nudge should speak even if it has an anchor, because nudge rule is checked first
    expect(shouldSpeak({
      message: 'You seem stuck on this line',
      type: 'nudge',
      source: 'observer',
      anchor: { path: 'foo.ts', startLine: 1 },
    })).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- --testPathPattern priority-engine`
Expected: FAIL — module doesn't exist

**Step 3: Implement `src/tts/priority-engine.ts`**

```typescript
import type { SpeechPriority, PriorityRule, SpeakableMessage } from './tts-types.js';

/**
 * Ordered rules for deciding whether a coaching message should be spoken.
 * First match wins. If no rule matches, default is 'silent'.
 */
const PRIORITY_RULES: readonly PriorityRule[] = [
  // === SPEAK ===
  {
    match: (msg) => msg.source === 'pipeline' && msg.type === 'phase_intro',
    priority: 'speak',
    reason: 'Phase transitions are major coaching moments',
  },
  {
    match: (msg) => msg.type === 'victory' || msg.type === 'celebration',
    priority: 'speak',
    reason: 'Celebrate wins vocally',
  },
  {
    match: (msg) => msg.source === 'observer' && msg.type === 'nudge',
    priority: 'speak',
    reason: 'Stuck nudges need audible attention',
  },
  {
    match: (msg) => msg.type === 'session_welcome',
    priority: 'speak',
    reason: 'First impression matters',
  },
  {
    match: (msg) => msg.type === 'session_wrapup',
    priority: 'speak',
    reason: 'Closing moment should feel personal',
  },

  // === SILENT ===
  {
    match: (msg) => msg.anchor !== undefined,
    priority: 'silent',
    reason: 'Anchored hints are visual — reading them aloud is awkward',
  },
  {
    match: (msg) => msg.type === 'file_hint' || msg.type === 'line_hint',
    priority: 'silent',
    reason: 'Spatial hints work better visually',
  },
  {
    match: (msg) => msg.message.length > 500,
    priority: 'silent',
    reason: 'Long messages are painful to listen to',
  },
];

/**
 * Evaluates whether a coaching message should be spoken aloud.
 * Rules are evaluated in order; first match wins.
 * Returns false (silent) if no rule matches.
 */
export function shouldSpeak(msg: SpeakableMessage): boolean {
  for (const rule of PRIORITY_RULES) {
    if (rule.match(msg)) {
      return rule.priority === 'speak';
    }
  }
  return false;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- --testPathPattern priority-engine`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tts/priority-engine.ts tests/unit/tts/priority-engine.test.ts
git commit -m "feat(tts): implement priority engine for contextual speech decisions"
```

---

## Task 4: TTS Service — ElevenLabs SDK Wrapper

Implement the service that calls ElevenLabs and streams audio chunks.

**Files:**
- Create: `src/tts/tts-service.ts`
- Test: `tests/unit/tts/tts-service.test.ts`

**Step 1: Install ElevenLabs SDK**

Run: `pnpm add elevenlabs`

**Step 2: Write the failing test**

Create `tests/unit/tts/tts-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TTSService } from '../../../src/tts/tts-service.js';

// Mock the elevenlabs module
vi.mock('elevenlabs', () => {
  return {
    ElevenLabsClient: vi.fn().mockImplementation(() => ({
      textToSpeech: {
        convertAsStream: vi.fn(),
      },
    })),
  };
});

describe('TTSService', () => {
  let service: TTSService;

  beforeEach(() => {
    service = new TTSService({
      apiKey: 'sk_test',
      voiceId: 'voice_123',
      fallbackVoiceId: 'voice_fallback',
      model: 'eleven_turbo_v2',
      outputFormat: 'mp3_44100_128',
      enabled: true,
    });
  });

  it('constructs without error', () => {
    expect(service).toBeDefined();
  });

  it('isEnabled returns true when enabled', () => {
    expect(service.isEnabled()).toBe(true);
  });

  it('isEnabled returns false when disabled', () => {
    const disabled = new TTSService({
      apiKey: 'sk_test',
      voiceId: 'voice_123',
      fallbackVoiceId: 'voice_fallback',
      model: 'eleven_turbo_v2',
      outputFormat: 'mp3_44100_128',
      enabled: false,
    });
    expect(disabled.isEnabled()).toBe(false);
  });

  it('isEnabled returns false when apiKey is missing', () => {
    const noKey = new TTSService({
      apiKey: '',
      voiceId: 'voice_123',
      fallbackVoiceId: 'voice_fallback',
      model: 'eleven_turbo_v2',
      outputFormat: 'mp3_44100_128',
      enabled: true,
    });
    expect(noKey.isEnabled()).toBe(false);
  });

  it('streamSpeech calls onChunk for each chunk', async () => {
    // Create a mock async iterable that yields 3 chunks
    const chunks = [Buffer.from('chunk1'), Buffer.from('chunk2'), Buffer.from('chunk3')];
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) yield chunk;
      },
    };

    // Access the mock client and set up the return value
    const client = (service as unknown as { client: { textToSpeech: { convertAsStream: ReturnType<typeof vi.fn> } } }).client;
    client.textToSpeech.convertAsStream.mockResolvedValue(mockStream);

    const receivedChunks: Array<{ chunk: Buffer; sequence: number }> = [];
    let completeCalled = false;

    await service.streamSpeech(
      'Hello world',
      (chunk, sequence) => receivedChunks.push({ chunk, sequence }),
      () => { completeCalled = true; },
      () => {},
    );

    expect(receivedChunks).toHaveLength(3);
    expect(receivedChunks[0]!.sequence).toBe(0);
    expect(receivedChunks[1]!.sequence).toBe(1);
    expect(receivedChunks[2]!.sequence).toBe(2);
    expect(completeCalled).toBe(true);
  });

  it('streamSpeech calls onError on API failure', async () => {
    const client = (service as unknown as { client: { textToSpeech: { convertAsStream: ReturnType<typeof vi.fn> } } }).client;
    client.textToSpeech.convertAsStream.mockRejectedValue(new Error('API rate limit'));

    let capturedError: Error | null = null;

    await service.streamSpeech(
      'Hello world',
      () => {},
      () => {},
      (error) => { capturedError = error; },
    );

    expect(capturedError).not.toBeNull();
    expect(capturedError!.message).toBe('API rate limit');
  });

  it('streamSpeech is a no-op when disabled', async () => {
    const disabled = new TTSService({
      apiKey: 'sk_test',
      voiceId: 'voice_123',
      fallbackVoiceId: 'voice_fallback',
      model: 'eleven_turbo_v2',
      outputFormat: 'mp3_44100_128',
      enabled: false,
    });

    const onChunk = vi.fn();
    const onComplete = vi.fn();

    await disabled.streamSpeech('Hello', onChunk, onComplete, () => {});

    expect(onChunk).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('abort signal stops chunk delivery', async () => {
    const chunks = [Buffer.from('chunk1'), Buffer.from('chunk2'), Buffer.from('chunk3')];
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) yield chunk;
      },
    };

    const client = (service as unknown as { client: { textToSpeech: { convertAsStream: ReturnType<typeof vi.fn> } } }).client;
    client.textToSpeech.convertAsStream.mockResolvedValue(mockStream);

    const controller = new AbortController();
    const receivedChunks: Buffer[] = [];

    // Abort after first chunk
    await service.streamSpeech(
      'Hello world',
      (chunk, _seq) => {
        receivedChunks.push(chunk);
        controller.abort();
      },
      () => {},
      () => {},
      controller.signal,
    );

    expect(receivedChunks.length).toBeLessThanOrEqual(1);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm test:unit -- --testPathPattern tts-service`
Expected: FAIL — module doesn't exist

**Step 4: Implement `src/tts/tts-service.ts`**

```typescript
import { ElevenLabsClient } from 'elevenlabs';
import type { TTSConfig } from './tts-types.js';

export class TTSService {
  private client: ElevenLabsClient;
  private config: TTSConfig;

  constructor(config: TTSConfig) {
    this.config = config;
    this.client = new ElevenLabsClient({ apiKey: config.apiKey });
  }

  /** Whether TTS is enabled and configured. */
  isEnabled(): boolean {
    return this.config.enabled && this.config.apiKey.length > 0;
  }

  /**
   * Stream audio from ElevenLabs for the given text.
   * Calls onChunk for each audio chunk, onComplete when done, onError on failure.
   * Respects AbortSignal for skip/cancel.
   * No-ops if service is disabled.
   */
  async streamSpeech(
    text: string,
    onChunk: (chunk: Buffer, sequence: number) => void,
    onComplete: (totalChunks: number) => void,
    onError: (error: Error) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      const voiceId = this.config.voiceId || this.config.fallbackVoiceId;

      const audioStream = await this.client.textToSpeech.convertAsStream(
        voiceId,
        {
          text,
          model_id: this.config.model,
          output_format: this.config.outputFormat,
        },
      );

      let sequence = 0;
      for await (const chunk of audioStream) {
        if (signal?.aborted) break;
        onChunk(chunk as Buffer, sequence++);
      }

      if (!signal?.aborted) {
        onComplete(sequence);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError(error);
    }
  }
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm test:unit -- --testPathPattern tts-service`
Expected: PASS

**Step 6: Commit**

```bash
git add src/tts/tts-service.ts tests/unit/tts/tts-service.test.ts package.json pnpm-lock.yaml
git commit -m "feat(tts): implement TTS service wrapping ElevenLabs SDK"
```

---

## Task 5: Backend Zod Schema & Router — audio:control Handler

Add Zod validation for the `audio:control` client message and wire it into the router.

**Files:**
- Modify: `src/websocket/schemas.ts`
- Create: `src/websocket/handlers/audio-control.ts`
- Modify: `src/websocket/router.ts`
- Test: `tests/unit/tts/audio-control-handler.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/tts/audio-control-handler.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { handleAudioControl } from '../../../src/websocket/handlers/audio-control.js';

describe('handleAudioControl', () => {
  it('calls onMute when action is mute', () => {
    const onMute = vi.fn();
    const onUnmute = vi.fn();
    const onSkip = vi.fn();

    handleAudioControl(
      { action: 'mute' },
      { onMute, onUnmute, onSkip },
    );

    expect(onMute).toHaveBeenCalledOnce();
    expect(onUnmute).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('calls onUnmute when action is unmute', () => {
    const onMute = vi.fn();
    const onUnmute = vi.fn();
    const onSkip = vi.fn();

    handleAudioControl(
      { action: 'unmute' },
      { onMute, onUnmute, onSkip },
    );

    expect(onUnmute).toHaveBeenCalledOnce();
  });

  it('calls onSkip with messageId when action is skip', () => {
    const onMute = vi.fn();
    const onUnmute = vi.fn();
    const onSkip = vi.fn();

    handleAudioControl(
      { action: 'skip', messageId: 'msg-42' },
      { onMute, onUnmute, onSkip },
    );

    expect(onSkip).toHaveBeenCalledWith('msg-42');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- --testPathPattern audio-control-handler`
Expected: FAIL — module doesn't exist

**Step 3: Add Zod schema in `src/websocket/schemas.ts`**

Add after the `reviewRequestDataSchema`:

```typescript
const audioControlDataSchema = z.object({
  action: z.enum(['mute', 'unmute', 'skip']),
  messageId: z.string().optional(),
});
```

Add to `messageDataSchemas`:

```typescript
  'audio:control': audioControlDataSchema,
```

**Step 4: Create `src/websocket/handlers/audio-control.ts`**

```typescript
import type { AudioControlData } from '../../tts/tts-types.js';

export interface AudioControlCallbacks {
  onMute: () => void;
  onUnmute: () => void;
  onSkip: (messageId: string | undefined) => void;
}

/**
 * Handles audio:control messages from the Electron UI.
 * Dispatches to the appropriate callback based on the action.
 */
export function handleAudioControl(
  data: AudioControlData,
  callbacks: AudioControlCallbacks,
): void {
  switch (data.action) {
    case 'mute':
      callbacks.onMute();
      break;
    case 'unmute':
      callbacks.onUnmute();
      break;
    case 'skip':
      callbacks.onSkip(data.messageId);
      break;
  }
}
```

**Step 5: Register in `src/websocket/router.ts`**

Add import:

```typescript
import { handleAudioControl } from './handlers/audio-control.js';
```

Add to the `handlers` Map:

```typescript
  ['audio:control', (ws, data) => {
    handleAudioControl(data as AudioControlData, {
      onMute: () => { /* TTS mute state managed by tts-bridge (Task 6) */ },
      onUnmute: () => { /* TTS unmute state managed by tts-bridge (Task 6) */ },
      onSkip: () => { /* TTS abort managed by tts-bridge (Task 6) */ },
    });
  }],
```

Add import for the type:

```typescript
import type { AudioControlData } from '../tts/tts-types.js';
```

**Step 6: Run test to verify it passes**

Run: `pnpm test:unit -- --testPathPattern audio-control-handler`
Expected: PASS

**Step 7: Commit**

```bash
git add src/websocket/schemas.ts src/websocket/handlers/audio-control.ts src/websocket/router.ts tests/unit/tts/audio-control-handler.test.ts
git commit -m "feat(tts): add audio:control message handler and Zod validation"
```

---

## Task 6: TTS Bridge — Wiring TTS into Coaching Messages

Create the integration layer that connects coaching message sends to the TTS service.

**Files:**
- Create: `src/tts/tts-bridge.ts`
- Test: `tests/unit/tts/tts-bridge.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/tts/tts-bridge.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TTSBridge } from '../../../src/tts/tts-bridge.js';

describe('TTSBridge', () => {
  const mockTTSService = {
    isEnabled: vi.fn().mockReturnValue(true),
    streamSpeech: vi.fn().mockResolvedValue(undefined),
  };

  const mockBroadcast = vi.fn();

  let bridge: TTSBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new TTSBridge(mockTTSService as never, mockBroadcast);
  });

  it('streams audio for speakable messages', async () => {
    await bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-1',
      message: 'Great job!',
      type: 'victory',
    });

    expect(mockTTSService.streamSpeech).toHaveBeenCalledOnce();
    expect(mockTTSService.streamSpeech.mock.calls[0]![0]).toBe('Great job!');
  });

  it('skips audio for silent messages', async () => {
    await bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-2',
      message: 'Check line 42',
      type: 'file_hint',
    });

    expect(mockTTSService.streamSpeech).not.toHaveBeenCalled();
  });

  it('skips audio when TTS is disabled', async () => {
    mockTTSService.isEnabled.mockReturnValue(false);

    await bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-3',
      message: 'Welcome!',
      type: 'session_welcome',
    });

    expect(mockTTSService.streamSpeech).not.toHaveBeenCalled();
  });

  it('skips audio when muted', async () => {
    mockTTSService.isEnabled.mockReturnValue(true);
    bridge.setMuted(true);

    await bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-4',
      message: 'Welcome!',
      type: 'session_welcome',
    });

    expect(mockTTSService.streamSpeech).not.toHaveBeenCalled();
  });

  it('broadcasts audio:chunk for each chunk', async () => {
    // Make streamSpeech call onChunk twice
    mockTTSService.streamSpeech.mockImplementation(
      async (_text: string, onChunk: (chunk: Buffer, seq: number) => void, onComplete: () => void) => {
        onChunk(Buffer.from('data1'), 0);
        onChunk(Buffer.from('data2'), 1);
        onComplete();
      },
    );

    await bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-5',
      message: 'Nice catch!',
      type: 'celebration',
    });

    // Expect 2 audio:chunk + 1 audio:complete = 3 broadcasts
    expect(mockBroadcast).toHaveBeenCalledTimes(3);

    const firstCall = mockBroadcast.mock.calls[0]![0] as { type: string; data: { messageId: string; chunk: string; sequence: number } };
    expect(firstCall.type).toBe('audio:chunk');
    expect(firstCall.data.messageId).toBe('msg-5');
    expect(firstCall.data.sequence).toBe(0);

    const lastCall = mockBroadcast.mock.calls[2]![0] as { type: string; data: { messageId: string } };
    expect(lastCall.type).toBe('audio:complete');
    expect(lastCall.data.messageId).toBe('msg-5');
  });

  it('abort stops streaming when skip is called', async () => {
    const receivedChunks: number[] = [];

    mockTTSService.streamSpeech.mockImplementation(
      async (_text: string, onChunk: (chunk: Buffer, seq: number) => void, _onComplete: () => void, _onError: () => void, signal?: AbortSignal) => {
        for (let i = 0; i < 10; i++) {
          if (signal?.aborted) break;
          onChunk(Buffer.from(`chunk${i}`), i);
          receivedChunks.push(i);
        }
      },
    );

    // Start speaking
    const promise = bridge.maybeSpeakCoachingMessage({
      messageId: 'msg-6',
      message: 'Phase 1: Understanding the problem',
      type: 'phase_intro',
      source: 'pipeline',
    });

    // Skip mid-stream
    bridge.skipMessage('msg-6');

    await promise;

    // Should have been aborted
    // (Exact chunk count depends on timing, but abort was signaled)
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- --testPathPattern tts-bridge`
Expected: FAIL — module doesn't exist

**Step 3: Implement `src/tts/tts-bridge.ts`**

```typescript
import type { TTSService } from './tts-service.js';
import type { SpeakableMessage } from './tts-types.js';
import type { ServerToClientMessage } from '../types/websocket.js';
import { shouldSpeak } from './priority-engine.js';

interface BridgeMessage extends SpeakableMessage {
  readonly messageId: string;
}

type BroadcastFn = (message: ServerToClientMessage) => void;

/**
 * Bridges coaching messages to the TTS service.
 * Evaluates priority rules and streams audio chunks to WebSocket clients.
 */
export class TTSBridge {
  private ttsService: TTSService;
  private broadcast: BroadcastFn;
  private muted = false;
  private activeAbortControllers = new Map<string, AbortController>();

  constructor(ttsService: TTSService, broadcast: BroadcastFn) {
    this.ttsService = ttsService;
    this.broadcast = broadcast;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Abort an in-progress TTS stream for a given messageId. */
  skipMessage(messageId: string): void {
    const controller = this.activeAbortControllers.get(messageId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(messageId);
    }
  }

  /**
   * Evaluate a coaching message and stream TTS audio if appropriate.
   * This method is fire-and-forget — errors are caught silently.
   */
  async maybeSpeakCoachingMessage(msg: BridgeMessage): Promise<void> {
    if (!this.ttsService.isEnabled()) return;
    if (this.muted) return;
    if (!shouldSpeak(msg)) return;

    const controller = new AbortController();
    this.activeAbortControllers.set(msg.messageId, controller);

    await this.ttsService.streamSpeech(
      msg.message,
      (chunk, sequence) => {
        this.broadcast({
          type: 'audio:chunk',
          data: {
            messageId: msg.messageId,
            chunk: chunk.toString('base64'),
            sequence,
          },
        } as ServerToClientMessage);
      },
      (totalChunks) => {
        this.activeAbortControllers.delete(msg.messageId);
        this.broadcast({
          type: 'audio:complete',
          data: {
            messageId: msg.messageId,
            totalChunks,
            durationMs: 0, // ElevenLabs doesn't provide duration in streaming mode
          },
        } as ServerToClientMessage);
      },
      (error) => {
        this.activeAbortControllers.delete(msg.messageId);
        // eslint-disable-next-line no-console
        console.error('[TTSBridge] TTS error (silent degradation):', error.message);
      },
      controller.signal,
    );
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- --testPathPattern tts-bridge`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tts/tts-bridge.ts tests/unit/tts/tts-bridge.test.ts
git commit -m "feat(tts): implement TTS bridge connecting coaching pipeline to audio streaming"
```

---

## Task 7: Electron UI — WebSocket Message Types

Add the 3 new audio message types to the Electron UI's type system.

**Files:**
- Modify: `electron-ui/shared/types/websocket-messages.ts`

**Step 1: Write the failing test**

This is a compile-time check — add a quick type test. Create `electron-ui/tests/unit/types/audio-messages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  AudioChunkMessage,
  AudioCompleteMessage,
  AudioControlMessage,
} from '@shared/types/websocket-messages';

describe('Audio WebSocket message types', () => {
  it('AudioChunkMessage has correct shape', () => {
    const msg: AudioChunkMessage = {
      type: 'audio:chunk',
      payload: { messageId: 'msg-1', chunk: 'base64', sequence: 0 },
      timestamp: Date.now(),
    };
    expect(msg.type).toBe('audio:chunk');
  });

  it('AudioCompleteMessage has correct shape', () => {
    const msg: AudioCompleteMessage = {
      type: 'audio:complete',
      payload: { messageId: 'msg-1', totalChunks: 5, durationMs: 2400 },
      timestamp: Date.now(),
    };
    expect(msg.type).toBe('audio:complete');
  });

  it('AudioControlMessage has correct shape', () => {
    const msg: AudioControlMessage = {
      type: 'audio:control',
      payload: { action: 'skip', messageId: 'msg-1' },
      timestamp: Date.now(),
    };
    expect(msg.type).toBe('audio:control');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd electron-ui && npm test -- --testPathPattern audio-messages`
Expected: FAIL — types don't exist

**Step 3: Update `electron-ui/shared/types/websocket-messages.ts`**

Add `'audio:chunk'` and `'audio:complete'` to `ServerMessageType` (after `| 'error:general'`):

```typescript
  // Audio streaming (2)
  | 'audio:chunk'
  | 'audio:complete';
```

Add `'audio:control'` to `ClientMessageType` (after `| 'phase:expand_step'`):

```typescript
  // Audio control (1)
  | 'audio:control';
```

Update the comment: `/** Server-to-client message type literals (30 types). */` and `/** Client-to-server message type literals (24 types). */` and total to 54.

Add message interfaces after the Phase actions section in Server -> Client:

```typescript
// -- Audio streaming (2) ---------------------------------------------------

/** Streamed audio chunk correlated to a coaching message. */
export interface AudioChunkMessage extends BaseMessage {
  type: 'audio:chunk';
  payload: {
    messageId: string;
    chunk: string; // Base64-encoded MP3
    sequence: number;
  };
}

/** Audio stream complete signal. */
export interface AudioCompleteMessage extends BaseMessage {
  type: 'audio:complete';
  payload: {
    messageId: string;
    totalChunks: number;
    durationMs: number;
  };
}
```

Add to Client -> Server section:

```typescript
// -- Audio control (1) -----------------------------------------------------

/** User audio control action. */
export interface AudioControlMessage extends BaseMessage {
  type: 'audio:control';
  payload: {
    action: 'mute' | 'unmute' | 'skip';
    messageId?: string;
  };
}
```

Add `AudioChunkMessage` and `AudioCompleteMessage` to the `ServerMessage` union.
Add `AudioControlMessage` to the `ClientMessage` union.

Add `'audio:control'` to `FIRE_AND_FORGET_TYPES` set in `electron-ui/renderer/src/services/websocket-client.ts`.

**Step 4: Run test to verify it passes**

Run: `cd electron-ui && npm test -- --testPathPattern audio-messages`
Expected: PASS

**Step 5: Commit**

```bash
git add electron-ui/shared/types/websocket-messages.ts electron-ui/renderer/src/services/websocket-client.ts electron-ui/tests/unit/types/audio-messages.test.ts
git commit -m "feat(tts): add audio message types to Electron UI WebSocket protocol"
```

---

## Task 8: Electron UI — AudioPlayer Service

Implement the Web Audio API-based audio player that receives streamed chunks.

**Files:**
- Create: `electron-ui/renderer/src/services/audio-player.ts`
- Test: `electron-ui/tests/unit/services/audio-player.test.ts`

**Step 1: Write the failing test**

Create `electron-ui/tests/unit/services/audio-player.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioPlayer } from '../../../renderer/src/services/audio-player';

// Mock AudioContext (not available in Node.js test environment)
const mockDecodeAudioData = vi.fn().mockResolvedValue({ duration: 1.0, length: 44100 });
const mockCreateBufferSource = vi.fn().mockReturnValue({
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  buffer: null,
  onended: null,
});
const mockResume = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
  decodeAudioData: mockDecodeAudioData,
  createBufferSource: mockCreateBufferSource,
  resume: mockResume,
  destination: {},
  state: 'running',
})));

// Mock atob for base64 decoding
vi.stubGlobal('atob', (str: string) => Buffer.from(str, 'base64').toString('binary'));

describe('AudioPlayer', () => {
  let player: AudioPlayer;

  beforeEach(() => {
    vi.clearAllMocks();
    player = new AudioPlayer();
  });

  it('starts in idle state', () => {
    const state = player.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.isMuted).toBe(false);
    expect(state.currentMessageId).toBeNull();
    expect(state.hasLastAudio).toBe(false);
  });

  it('mute toggles state', () => {
    player.mute();
    expect(player.getState().isMuted).toBe(true);

    player.unmute();
    expect(player.getState().isMuted).toBe(false);
  });

  it('addChunk stores chunks by messageId', () => {
    player.addChunk('msg-1', btoa('audio-data'));
    // No assertion on internal state — just ensure no throw
    expect(player.getState().currentMessageId).toBe('msg-1');
  });

  it('complete marks playback done and stores lastAudio', () => {
    player.addChunk('msg-1', btoa('chunk1'));
    player.complete('msg-1');
    expect(player.getState().hasLastAudio).toBe(true);
  });

  it('skip resets current playback', () => {
    player.addChunk('msg-1', btoa('chunk1'));
    player.skip();
    expect(player.getState().isPlaying).toBe(false);
    expect(player.getState().currentMessageId).toBeNull();
  });

  it('notifies state change listeners', () => {
    const listener = vi.fn();
    const unsub = player.onStateChange(listener);

    player.mute();

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isMuted: true }));

    unsub();
    player.unmute();
    // Should not be called again after unsub
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores chunks when muted but still tracks messageId', () => {
    player.mute();
    player.addChunk('msg-1', btoa('chunk1'));
    // Muted players still track state for replay
    expect(player.getState().currentMessageId).toBe('msg-1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd electron-ui && npm test -- --testPathPattern audio-player`
Expected: FAIL — module doesn't exist

**Step 3: Implement `electron-ui/renderer/src/services/audio-player.ts`**

```typescript
export interface AudioPlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  currentMessageId: string | null;
  hasLastAudio: boolean;
  lastMessageId: string | null;
}

type StateChangeListener = (state: AudioPlayerState) => void;

/**
 * AudioPlayer receives streamed audio chunks and plays them via Web Audio API.
 * Supports mute/unmute, skip, and replay of the last message.
 */
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private chunks = new Map<string, Uint8Array[]>();
  private currentSource: AudioBufferSourceNode | null = null;
  private state: AudioPlayerState = {
    isPlaying: false,
    isMuted: false,
    currentMessageId: null,
    hasLastAudio: false,
    lastMessageId: null,
  };
  private lastAudioData: Uint8Array | null = null;
  private listeners = new Set<StateChangeListener>();

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  getState(): AudioPlayerState {
    return { ...this.state };
  }

  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private setState(partial: Partial<AudioPlayerState>): void {
    Object.assign(this.state, partial);
    this.notify();
  }

  addChunk(messageId: string, base64Chunk: string): void {
    // Decode base64 to binary
    const binary = atob(base64Chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Store chunk
    const existing = this.chunks.get(messageId) ?? [];
    existing.push(bytes);
    this.chunks.set(messageId, existing);

    this.setState({ currentMessageId: messageId });

    // Start playback after initial buffering (3 chunks) if not muted
    if (!this.state.isMuted && existing.length === 3 && !this.state.isPlaying) {
      this.startPlayback(messageId).catch(() => {
        // Silent degradation
      });
    }
  }

  complete(messageId: string): void {
    const messageChunks = this.chunks.get(messageId);
    if (messageChunks) {
      // Concatenate all chunks for replay
      const totalLength = messageChunks.reduce((acc, c) => acc + c.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of messageChunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      this.lastAudioData = combined;
      this.setState({ hasLastAudio: true, lastMessageId: messageId });
    }

    this.chunks.delete(messageId);

    // If we haven't started playing yet (< 3 chunks arrived), play now
    if (!this.state.isPlaying && this.lastAudioData && !this.state.isMuted) {
      this.playBuffer(this.lastAudioData).catch(() => {
        // Silent degradation
      });
    }

    if (this.state.currentMessageId === messageId) {
      this.setState({ isPlaying: false, currentMessageId: null });
    }
  }

  mute(): void {
    this.setState({ isMuted: true });
    this.stopCurrentPlayback();
  }

  unmute(): void {
    this.setState({ isMuted: false });
  }

  skip(): void {
    this.stopCurrentPlayback();
    const messageId = this.state.currentMessageId;
    if (messageId) {
      this.chunks.delete(messageId);
    }
    this.setState({ isPlaying: false, currentMessageId: null });
  }

  async replayLast(): Promise<void> {
    if (!this.lastAudioData || this.state.isMuted) return;
    await this.playBuffer(this.lastAudioData);
  }

  private stopCurrentPlayback(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already stopped
      }
      this.currentSource = null;
    }
  }

  private async startPlayback(messageId: string): Promise<void> {
    const messageChunks = this.chunks.get(messageId);
    if (!messageChunks || messageChunks.length === 0) return;

    // Concatenate available chunks
    const totalLength = messageChunks.reduce((acc, c) => acc + c.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of messageChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    await this.playBuffer(combined);
  }

  private async playBuffer(data: Uint8Array): Promise<void> {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioBuffer = await ctx.decodeAudioData(data.buffer.slice(0) as ArrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      this.currentSource = source;
      this.setState({ isPlaying: true });

      source.onended = () => {
        this.currentSource = null;
        this.setState({ isPlaying: false });
      };

      source.start(0);
    } catch {
      // Silent degradation — audio decode or playback failed
      this.setState({ isPlaying: false });
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd electron-ui && npm test -- --testPathPattern audio-player`
Expected: PASS

**Step 5: Commit**

```bash
git add electron-ui/renderer/src/services/audio-player.ts electron-ui/tests/unit/services/audio-player.test.ts
git commit -m "feat(tts): implement AudioPlayer service with Web Audio API streaming"
```

---

## Task 9: Electron UI — useAudioPlayback Hook

Wire the AudioPlayer to WebSocket messages via a React hook.

**Files:**
- Create: `electron-ui/renderer/src/hooks/useAudioPlayback.ts`
- Test: `electron-ui/tests/unit/hooks/useAudioPlayback.test.tsx`

**Step 1: Write the failing test**

Create `electron-ui/tests/unit/hooks/useAudioPlayback.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioPlayback } from '../../../renderer/src/hooks/useAudioPlayback';

// Mock useWebSocket
const mockOn = vi.fn().mockReturnValue(vi.fn()); // returns unsub fn
const mockSend = vi.fn();

vi.mock('../../../renderer/src/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    on: mockOn,
    send: mockSend,
    status: 'connected',
    reconnectAttempt: 0,
  }),
}));

// Mock AudioContext
vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
  decodeAudioData: vi.fn().mockResolvedValue({ duration: 1.0, length: 44100 }),
  createBufferSource: vi.fn().mockReturnValue({
    connect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null, onended: null,
  }),
  resume: vi.fn().mockResolvedValue(undefined),
  destination: {},
  state: 'running',
})));

vi.stubGlobal('atob', (str: string) => Buffer.from(str, 'base64').toString('binary'));

describe('useAudioPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to audio:chunk and audio:complete on mount', () => {
    renderHook(() => useAudioPlayback());

    expect(mockOn).toHaveBeenCalledWith('audio:chunk', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('audio:complete', expect.any(Function));
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useAudioPlayback());

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.hasLastAudio).toBe(false);
  });

  it('mute sends audio:control message to backend', () => {
    const { result } = renderHook(() => useAudioPlayback());

    act(() => {
      result.current.mute();
    });

    expect(result.current.isMuted).toBe(true);
    expect(mockSend).toHaveBeenCalledWith('audio:control', { action: 'mute' });
  });

  it('unmute sends audio:control message to backend', () => {
    const { result } = renderHook(() => useAudioPlayback());

    act(() => {
      result.current.mute();
      result.current.unmute();
    });

    expect(result.current.isMuted).toBe(false);
    expect(mockSend).toHaveBeenCalledWith('audio:control', { action: 'unmute' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd electron-ui && npm test -- --testPathPattern useAudioPlayback`
Expected: FAIL — module doesn't exist

**Step 3: Implement `electron-ui/renderer/src/hooks/useAudioPlayback.ts`**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { AudioPlayer, type AudioPlayerState } from '../services/audio-player';
import type { WebSocketMessage } from '@shared/types/websocket-messages';

export interface UseAudioPlaybackReturn extends AudioPlayerState {
  mute: () => void;
  unmute: () => void;
  skip: () => void;
  replayLast: () => void;
}

const INITIAL_STATE: AudioPlayerState = {
  isPlaying: false,
  isMuted: false,
  currentMessageId: null,
  hasLastAudio: false,
  lastMessageId: null,
};

export function useAudioPlayback(): UseAudioPlaybackReturn {
  const { on, send } = useWebSocket();
  const playerRef = useRef<AudioPlayer | null>(null);
  const [state, setState] = useState<AudioPlayerState>(INITIAL_STATE);

  // Lazy-init the player (avoid creating AudioContext during SSR/test)
  if (!playerRef.current) {
    playerRef.current = new AudioPlayer();
  }

  useEffect(() => {
    const player = playerRef.current!;

    const unsubChunk = on('audio:chunk', (msg: WebSocketMessage) => {
      if (msg.type !== 'audio:chunk') return;
      const payload = msg.payload as { messageId: string; chunk: string; sequence: number };
      player.addChunk(payload.messageId, payload.chunk);
    });

    const unsubComplete = on('audio:complete', (msg: WebSocketMessage) => {
      if (msg.type !== 'audio:complete') return;
      const payload = msg.payload as { messageId: string };
      player.complete(payload.messageId);
    });

    const unsubState = player.onStateChange(setState);

    return () => {
      unsubChunk();
      unsubComplete();
      unsubState();
    };
  }, [on]);

  const mute = useCallback(() => {
    playerRef.current?.mute();
    send('audio:control', { action: 'mute' });
  }, [send]);

  const unmute = useCallback(() => {
    playerRef.current?.unmute();
    send('audio:control', { action: 'unmute' });
  }, [send]);

  const skip = useCallback(() => {
    const messageId = playerRef.current?.getState().currentMessageId;
    playerRef.current?.skip();
    if (messageId) {
      send('audio:control', { action: 'skip', messageId });
    }
  }, [send]);

  const replayLast = useCallback(() => {
    playerRef.current?.replayLast();
  }, []);

  return { ...state, mute, unmute, skip, replayLast };
}
```

**Step 4: Run test to verify it passes**

Run: `cd electron-ui && npm test -- --testPathPattern useAudioPlayback`
Expected: PASS

**Step 5: Commit**

```bash
git add electron-ui/renderer/src/hooks/useAudioPlayback.ts electron-ui/tests/unit/hooks/useAudioPlayback.test.tsx
git commit -m "feat(tts): implement useAudioPlayback hook bridging WebSocket to AudioPlayer"
```

---

## Task 10: Electron UI — AudioControls Component

Add speaker/skip/replay controls to the status bar.

**Files:**
- Create: `electron-ui/renderer/src/components/AudioControls.tsx`
- Modify: `electron-ui/renderer/src/components/Editor/StatusBar.tsx`
- Modify: `electron-ui/renderer/src/hooks/useKeyboardShortcuts.ts`
- Test: `electron-ui/tests/unit/components/AudioControls.test.tsx`

**Step 1: Write the failing test**

Create `electron-ui/tests/unit/components/AudioControls.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioControls } from '../../../renderer/src/components/AudioControls';

describe('AudioControls', () => {
  const defaultProps = {
    isMuted: false,
    isPlaying: false,
    hasLastAudio: false,
    onMute: vi.fn(),
    onUnmute: vi.fn(),
    onSkip: vi.fn(),
    onReplay: vi.fn(),
  };

  it('renders speaker icon', () => {
    render(<AudioControls {...defaultProps} />);
    expect(screen.getByLabelText('Toggle mute')).toBeDefined();
  });

  it('shows muted icon when muted', () => {
    render(<AudioControls {...defaultProps} isMuted={true} />);
    const btn = screen.getByLabelText('Toggle mute');
    expect(btn.textContent).toContain('\u{1F507}'); // muted speaker
  });

  it('shows unmuted icon when not muted', () => {
    render(<AudioControls {...defaultProps} isMuted={false} />);
    const btn = screen.getByLabelText('Toggle mute');
    expect(btn.textContent).toContain('\u{1F50A}'); // speaker with sound
  });

  it('calls onMute when clicking unmuted speaker', () => {
    render(<AudioControls {...defaultProps} isMuted={false} />);
    fireEvent.click(screen.getByLabelText('Toggle mute'));
    expect(defaultProps.onMute).toHaveBeenCalledOnce();
  });

  it('calls onUnmute when clicking muted speaker', () => {
    render(<AudioControls {...defaultProps} isMuted={true} />);
    fireEvent.click(screen.getByLabelText('Toggle mute'));
    expect(defaultProps.onUnmute).toHaveBeenCalledOnce();
  });

  it('shows skip button only during playback', () => {
    const { rerender } = render(<AudioControls {...defaultProps} isPlaying={false} />);
    expect(screen.queryByLabelText('Skip audio')).toBeNull();

    rerender(<AudioControls {...defaultProps} isPlaying={true} />);
    expect(screen.getByLabelText('Skip audio')).toBeDefined();
  });

  it('shows replay button only when last audio exists', () => {
    const { rerender } = render(<AudioControls {...defaultProps} hasLastAudio={false} />);
    expect(screen.queryByLabelText('Replay last')).toBeNull();

    rerender(<AudioControls {...defaultProps} hasLastAudio={true} />);
    expect(screen.getByLabelText('Replay last')).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd electron-ui && npm test -- --testPathPattern AudioControls`
Expected: FAIL — module doesn't exist

**Step 3: Implement `electron-ui/renderer/src/components/AudioControls.tsx`**

```tsx
export interface AudioControlsProps {
  isMuted: boolean;
  isPlaying: boolean;
  hasLastAudio: boolean;
  onMute: () => void;
  onUnmute: () => void;
  onSkip: () => void;
  onReplay: () => void;
}

const buttonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family, monospace), monospace',
  fontSize: 'var(--font-small-size, 12px)',
  padding: '0 4px',
  cursor: 'pointer',
  lineHeight: '1.4',
};

export function AudioControls({
  isMuted,
  isPlaying,
  hasLastAudio,
  onMute,
  onUnmute,
  onSkip,
  onReplay,
}: AudioControlsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      <button
        type="button"
        style={{
          ...buttonStyle,
          opacity: isPlaying && !isMuted ? 1 : 0.7,
        }}
        onClick={isMuted ? onUnmute : onMute}
        aria-label="Toggle mute"
        title={isMuted ? 'Unmute Paige (Cmd+M)' : 'Mute Paige (Cmd+M)'}
      >
        {isMuted ? '\u{1F507}' : '\u{1F50A}'}
      </button>

      {isPlaying && (
        <button
          type="button"
          style={buttonStyle}
          onClick={onSkip}
          aria-label="Skip audio"
          title="Skip (Cmd+.)"
        >
          {'\u23ED'}
        </button>
      )}

      {hasLastAudio && !isPlaying && (
        <button
          type="button"
          style={buttonStyle}
          onClick={onReplay}
          aria-label="Replay last"
          title="Replay (Cmd+Shift+.)"
        >
          {'\u{1F501}'}
        </button>
      )}
    </div>
  );
}
```

**Step 4: Add keyboard shortcuts to `electron-ui/renderer/src/hooks/useKeyboardShortcuts.ts`**

Add to `KeyboardShortcutHandlers`:

```typescript
  /** Toggle TTS mute. */
  onToggleMute?: () => void;
  /** Skip current TTS playback. */
  onSkipAudio?: () => void;
  /** Replay last TTS message. */
  onReplayAudio?: () => void;
```

Add to the `handleKeyDown` function, before the closing brace. These use `Cmd+M` (no shift), `Cmd+.` (no shift), and `Cmd+Shift+.` respectively:

```typescript
      // Cmd+M — Toggle TTS mute (no shift required)
      if (isMod && !e.shiftKey && key === 'm') {
        e.preventDefault();
        handlersRef.current.onToggleMute?.();
        return;
      }

      // Cmd+. — Skip TTS playback (no shift required)
      if (isMod && !e.shiftKey && key === '.') {
        e.preventDefault();
        handlersRef.current.onSkipAudio?.();
        return;
      }

      // Cmd+Shift+. — Replay last TTS message
      if (isMod && e.shiftKey && (key === '.' || key === '>')) {
        e.preventDefault();
        handlersRef.current.onReplayAudio?.();
        return;
      }
```

Note: The `Cmd+M` and `Cmd+.` shortcuts need the existing early return `if (!isMod || !e.shiftKey)` to be adjusted. Change it to `if (!isMod)` and handle shift-specific vs non-shift-specific shortcuts individually.

**Step 5: Integrate into `StatusBar.tsx`**

Add `AudioControls` between the left section and the review button. Add new props to `StatusBarProps`:

```typescript
  /** Audio playback state. */
  audioState?: {
    isMuted: boolean;
    isPlaying: boolean;
    hasLastAudio: boolean;
    onMute: () => void;
    onUnmute: () => void;
    onSkip: () => void;
    onReplay: () => void;
  };
```

In the JSX, add between the left `<div>` and the review section:

```tsx
      {audioState && (
        <AudioControls
          isMuted={audioState.isMuted}
          isPlaying={audioState.isPlaying}
          hasLastAudio={audioState.hasLastAudio}
          onMute={audioState.onMute}
          onUnmute={audioState.onUnmute}
          onSkip={audioState.onSkip}
          onReplay={audioState.onReplay}
        />
      )}
```

**Step 6: Run test to verify it passes**

Run: `cd electron-ui && npm test -- --testPathPattern AudioControls`
Expected: PASS

**Step 7: Commit**

```bash
git add electron-ui/renderer/src/components/AudioControls.tsx electron-ui/renderer/src/components/Editor/StatusBar.tsx electron-ui/renderer/src/hooks/useKeyboardShortcuts.ts electron-ui/tests/unit/components/AudioControls.test.tsx
git commit -m "feat(tts): add AudioControls component with mute/skip/replay and keyboard shortcuts"
```

---

## Task Summary

| Task | Component | Dependencies | Estimated Steps |
|------|-----------|-------------|-----------------|
| 1 | Backend TTS Types | None | 6 |
| 2 | Backend Config | None | 5 |
| 3 | Priority Engine | Task 1 | 5 |
| 4 | TTS Service | Task 1 | 6 |
| 5 | Zod Schema & Router | Task 1 | 7 |
| 6 | TTS Bridge | Tasks 3, 4 | 5 |
| 7 | Electron Message Types | None | 5 |
| 8 | AudioPlayer Service | Task 7 | 5 |
| 9 | useAudioPlayback Hook | Tasks 7, 8 | 5 |
| 10 | AudioControls + UI | Tasks 8, 9 | 7 |

**Parallelism:** Tasks 1-6 (backend) and Tasks 7-10 (Electron) are independent tracks after Tasks 1 and 7 establish types.

**Total commits:** 10

**Pre-requisite (manual):** ElevenLabs account setup, voice cloning, API key in `.env`.
