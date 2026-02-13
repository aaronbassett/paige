# TTS Design: Paige Voice Coaching

**Date**: 2026-02-13
**Status**: Proposed
**Feature**: Text-to-Speech for coaching messages via ElevenLabs

## Summary

Add voice output to Paige so she can talk developers through solving issues. A contextual intelligence engine decides which coaching messages get spoken (phase transitions, victories, nudges) and which stay text-only (spatial hints, long explanations). Audio streams from the backend via ElevenLabs SDK to the Electron UI with < 500ms time-to-first-audio.

## Motivation

Having Paige speak creates a "pair programmer in the room" feeling that text alone cannot achieve. For the hackathon demo, voice transforms Paige from a tool into a character. Judges evaluate 30% demo impact — a coaching voice that says "Nice catch!" when you fix a bug is memorable.

## Architecture

```
ElevenLabs API
      ↑ (streaming audio)
      │
Backend Server (TTS Service + Priority Engine)
      │
      ↓ (WebSocket: audio:chunk, audio:complete)
      │
Electron UI (Audio Player + Controls)
```

The backend owns all TTS logic. Text messages always send immediately. Audio streams in parallel as an enhancement. If TTS fails, the developer sees text as normal — silent degradation.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| When to speak | Contextual intelligence | Backend rules engine decides per-message. Feels intentional, not chatty. |
| TTS provider | ElevenLabs | TypeScript SDK, streaming support, low latency turbo model, instant voice cloning. |
| Audio delivery | Streamed chunks via WebSocket | Hits < 500ms target. Text never blocked by audio generation. |
| Voice | Custom via Instant Voice Cloning | Unique Paige identity. Pre-made fallback voice as backup. |
| Caching | None (MVP) | Simplifies implementation for hackathon. Add post-demo. |
| Error handling | Silent degradation | Log errors, never disrupt coaching. Text is the primary UX. |
| Latency model | `eleven_turbo_v2` | Optimized for speed over quality. Good enough for coaching messages. |

## WebSocket Protocol Extension

Three new message types (total: 54).

### `audio:chunk` (Server to Client)

Streamed audio data correlated to a coaching message.

```typescript
interface AudioChunkMessage {
  type: 'audio:chunk';
  payload: {
    messageId: string;     // Correlates to coaching:message
    chunk: string;         // Base64-encoded MP3 audio data
    sequence: number;      // Chunk ordering (0-indexed)
  };
  timestamp: number;
}
```

### `audio:complete` (Server to Client)

Signals the end of an audio stream.

```typescript
interface AudioCompleteMessage {
  type: 'audio:complete';
  payload: {
    messageId: string;
    totalChunks: number;   // Integrity check
    durationMs: number;    // Total audio duration
  };
  timestamp: number;
}
```

### `audio:control` (Client to Server)

User control actions sent to backend so it can stop streaming.

```typescript
interface AudioControlMessage {
  type: 'audio:control';
  payload: {
    action: 'mute' | 'unmute' | 'skip';
    messageId?: string;    // For skip: which message to stop generating
  };
  timestamp: number;
}
```

The `audio:control` message flows to the backend because when a user skips, the backend must stop calling ElevenLabs for that message. Without this, the backend wastes API credits streaming chunks that Electron discards.

## Contextual Intelligence: Priority Engine

A rules engine evaluates each coaching message and decides speak or silent. Rules are evaluated in order; first match wins.

### Speak (generate audio)

| Condition | Reason |
|-----------|--------|
| Phase introduction (`source: pipeline`, `type: phase_intro`) | Phase transitions are major coaching moments |
| Victory or celebration (`type: victory`, `type: celebration`) | Celebrate wins vocally |
| Observer nudge (`source: observer`, `type: nudge`) | Stuck nudges need attention — developer may not be looking at screen |
| Session welcome (`type: session_welcome`) | First impression matters |
| Session wrap-up (`type: session_wrapup`) | Closing moment should feel personal |

### Silent (text only)

| Condition | Reason |
|-----------|--------|
| Message has anchor (`anchor !== undefined`) | Anchored hints are visual — reading spatial hints aloud is awkward |
| File or line hint (`type: file_hint`, `type: line_hint`) | Spatial hints work better visually |
| Message > 500 characters | Long messages are painful to listen to |
| Default (no rule matched) | Conservative: silent unless explicitly promoted |

### Implementation

```typescript
type SpeechPriority = 'speak' | 'silent';

interface PriorityRule {
  match: (msg: CoachingMessage, context: SessionContext) => boolean;
  priority: SpeechPriority;
  reason: string;
}

const PRIORITY_RULES: PriorityRule[] = [
  // SPEAK rules
  {
    match: (msg) => msg.source === 'pipeline' && msg.type === 'phase_intro',
    priority: 'speak',
    reason: 'Phase transitions are major moments',
  },
  {
    match: (msg) => msg.type === 'victory' || msg.type === 'celebration',
    priority: 'speak',
    reason: 'Celebrate wins vocally',
  },
  {
    match: (msg) => msg.source === 'observer' && msg.type === 'nudge',
    priority: 'speak',
    reason: 'Stuck nudges need attention',
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

  // SILENT rules
  {
    match: (msg) => msg.anchor !== undefined,
    priority: 'silent',
    reason: 'Anchored hints are visual',
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

function shouldSpeak(msg: CoachingMessage, ctx: SessionContext): boolean {
  for (const rule of PRIORITY_RULES) {
    if (rule.match(msg, ctx)) return rule.priority === 'speak';
  }
  return false;
}
```

## Backend: TTS Service

### ElevenLabs Integration

```typescript
import { ElevenLabsClient } from "elevenlabs";

class TTSService {
  private client: ElevenLabsClient;
  private voiceId: string;
  private fallbackVoiceId: string;

  async streamSpeech(
    text: string,
    onChunk: (chunk: Buffer, sequence: number) => void,
    onComplete: (totalChunks: number, durationMs: number) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    const audioStream = await this.client.textToSpeech.convertAsStream(
      this.voiceId,
      {
        text,
        model_id: 'eleven_turbo_v2',
        output_format: 'mp3_44100_128',
      },
    );

    let sequence = 0;
    for await (const chunk of audioStream) {
      onChunk(chunk, sequence++);
    }
    onComplete(sequence, /* duration from metadata */);
  }
}
```

### Integration with Coaching Pipeline

```typescript
function sendCoachingMessage(message: CoachingMessage, ctx: SessionContext) {
  // Text always sends immediately
  wsConnection.send({
    type: 'coaching:message',
    payload: message,
    timestamp: Date.now(),
  });

  // Conditionally generate TTS (parallel, non-blocking)
  if (shouldSpeak(message, ctx)) {
    ttsService.streamSpeech(
      message.message,
      (chunk, seq) => wsConnection.send({
        type: 'audio:chunk',
        payload: { messageId: message.messageId, chunk: chunk.toString('base64'), sequence: seq },
        timestamp: Date.now(),
      }),
      (totalChunks, durationMs) => wsConnection.send({
        type: 'audio:complete',
        payload: { messageId: message.messageId, totalChunks, durationMs },
        timestamp: Date.now(),
      }),
      (error) => logger.error('TTS failed silently', { error, messageId: message.messageId }),
    ).catch((err) => {
      logger.error('TTS stream failed', { error: err });
    });
  }
}
```

### Error Handling

- **Rate limits**: Silent skip, log warning
- **Network timeout (5s)**: Silent skip
- **Invalid voice_id**: Fall back to `fallbackVoiceId`
- **API errors**: Log to `api_calls` table for debugging, continue without audio

### Configuration

```bash
# .env
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=voice_abc123       # Custom cloned voice
ELEVENLABS_FALLBACK_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Rachel (pre-made)
TTS_ENABLED=true                        # Kill switch
```

## Electron: Audio Player

### AudioPlayer Service

Receives streamed chunks, buffers them, and plays audio using the Web Audio API.

```typescript
interface AudioPlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  currentMessageId: string | null;
  lastAudioBlob: Blob | null;
  lastMessageId: string | null;
}

class AudioPlayer {
  addChunk(messageId: string, base64Chunk: string): void;
  complete(messageId: string): void;
  mute(): void;
  unmute(): void;
  skip(): void;
  replayLast(): void;
  getState(): AudioPlayerState;
  onStateChange(cb: (state: AudioPlayerState) => void): () => void;
}
```

### Playback Strategy

Two-phase approach for < 500ms time-to-first-audio:

1. **Buffering phase**: Collect first ~3 chunks (~100ms of audio) to prevent stuttering
2. **Streaming phase**: Play chunks as they arrive, appending to a `MediaSource` buffer

Web Audio API is used instead of `<audio>` element because `<audio>` requires a complete file URL. Web Audio API supports incremental chunk feeding via `AudioContext` + `AudioBufferSourceNode`.

### Replay

When audio completes, all chunks are concatenated into a single `Blob` stored as `lastAudioBlob`. Replay creates a fresh `AudioBufferSourceNode` from this blob.

### Skip

Calls `sourceNode.stop()`, clears the buffer queue, discards remaining incoming chunks for that `messageId`, and sends `audio:control` with `action: 'skip'` to the backend.

### useAudioPlayback Hook

```typescript
export function useAudioPlayback() {
  const { on, send } = useWebSocket();
  const playerRef = useRef(new AudioPlayer());
  const [state, setState] = useState<AudioPlayerState>(/* defaults */);

  useEffect(() => {
    const unsub1 = on('audio:chunk', (msg) => {
      playerRef.current.addChunk(msg.payload.messageId, msg.payload.chunk);
    });
    const unsub2 = on('audio:complete', (msg) => {
      playerRef.current.complete(msg.payload.messageId);
    });
    playerRef.current.onStateChange(setState);
    return () => { unsub1(); unsub2(); };
  }, [on]);

  const mute = () => {
    playerRef.current.mute();
    send({ type: 'audio:control', payload: { action: 'mute' }, timestamp: Date.now() });
  };

  const unmute = () => {
    playerRef.current.unmute();
    send({ type: 'audio:control', payload: { action: 'unmute' }, timestamp: Date.now() });
  };

  const skip = () => {
    const msgId = playerRef.current.getState().currentMessageId;
    playerRef.current.skip();
    if (msgId) {
      send({ type: 'audio:control', payload: { action: 'skip', messageId: msgId }, timestamp: Date.now() });
    }
  };

  return { ...state, mute, unmute, skip, replayLast: () => playerRef.current.replayLast() };
}
```

## UI Controls

Status bar integration with three controls:

```
┌──────────────────────────────────────────────────┐
│  [Editor]                                        │
│                                                  │
├──────────────────────────────────────────────────┤
│  main.ts  ·  Ln 42, Col 8   🔊 ⏭ 🔄  Phase 2/5 │
└──────────────────────────────────────────────────┘
```

| Control | Behavior | Visibility |
|---------|----------|------------|
| Speaker icon | Toggle mute. Filled = on, slashed = muted. Pulses during playback. | Always |
| Skip | Stop current playback | Only during active playback |
| Replay | Re-play last spoken message | Only when `lastAudioBlob` exists |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+M` | Toggle mute |
| `Cmd+.` | Skip current message |
| `Cmd+Shift+.` | Replay last message |

## File Structure

### New Files (Backend)

```
backend-server/src/
├── tts/
│   ├── tts-service.ts        # ElevenLabs SDK wrapper, streaming
│   ├── priority-engine.ts    # shouldSpeak() rules engine
│   └── tts-types.ts          # TTSConfig, PriorityRule types
└── websocket/
    └── handlers/
        └── audio-control.ts  # Handle audio:control from Electron
```

### New Files (Electron)

```
electron-ui/renderer/src/
├── services/
│   └── audio-player.ts       # AudioPlayer class (Web Audio API)
├── hooks/
│   └── useAudioPlayback.ts   # WebSocket → AudioPlayer bridge
└── components/
    └── AudioControls.tsx      # Speaker, skip, replay icons
```

### Modified Files

| File | Change |
|------|--------|
| `backend-server/src/websocket/router.ts` | Register `audio:control` handler |
| `backend-server/src/coaching/*.ts` | Call `ttsService.streamSpeech()` after sending text |
| `backend-server/src/observer/*.ts` | TTS for nudges |
| `backend-server/src/config/index.ts` | Add ElevenLabs env vars |
| `backend-server/.env.example` | Add ElevenLabs env vars |
| `electron-ui/renderer/src/components/Editor/StatusBar.tsx` | Add `<AudioControls />` |
| `electron-ui/renderer/src/hooks/useKeyboardShortcuts.ts` | Add Cmd+M, Cmd+., Cmd+Shift+. |
| `electron-ui/shared/types/websocket-messages.ts` | Add 3 new message types |

## Implementation Sequence

```
Step 1: Types & Config                    [no dependencies]
  ├─ Add 3 message types to shared contracts
  └─ Add env vars to backend config

Step 2: Backend TTS Service               [depends on Step 1]
  ├─ tts-service.ts (ElevenLabs SDK, streaming)
  └─ priority-engine.ts (shouldSpeak rules)

Step 3: Backend Integration               [depends on Step 2]
  ├─ Wire TTS into coaching message sender
  ├─ Wire TTS into observer nudges
  └─ Handle audio:control messages

Step 4: Electron Audio Player             [depends on Step 1, parallel with 2-3]
  ├─ audio-player.ts (Web Audio API, chunk buffering)
  └─ useAudioPlayback.ts hook

Step 5: Electron UI Controls              [depends on Step 4]
  ├─ AudioControls.tsx component
  ├─ StatusBar integration
  └─ Keyboard shortcuts
```

Steps 2-3 (backend) and Steps 4-5 (Electron) are independent and can be built in parallel.

## Pre-requisites

### ElevenLabs Account Setup

1. Create account at elevenlabs.io
2. Get API key
3. Record 1-minute voice sample for custom Paige voice
4. Upload via Instant Voice Cloning, receive `voice_id`
5. Test with a quick API call to verify quality
6. Note a fallback pre-made voice ID (e.g., Rachel: `21m00Tcm4TlvDq8ikWAM`)

### Cost Estimate

- ElevenLabs Starter plan: $5/month, 30,000 characters
- Typical coaching session: ~2,000-5,000 characters of spoken text
- Hackathon capacity: 6-15 demo sessions per month

## Out of Scope

- Audio caching (add post-hackathon)
- Volume slider (mute toggle is sufficient)
- Multiple voice profiles
- Speech-to-text (developer talking back to Paige)
- Lip sync or avatar animation
- Audio recording or playback history
