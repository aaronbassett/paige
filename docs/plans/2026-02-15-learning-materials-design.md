# Learning Materials Dashboard PoC — Design

## Overview

AI-generated learning materials panel for the Paige dashboard. Claude generates relevant resources (YouTube videos, articles) based on knowledge gaps detected during coaching phases. Developers verify comprehension via AI-checked questions before materials are marked complete.

## Data Model

New `learning_materials` table (migration `002-learning-materials.ts`):

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| session_id | INTEGER NOT NULL | FK → sessions |
| phase_id | INTEGER | FK → phases, nullable |
| type | TEXT NOT NULL | 'youtube' \| 'article' |
| url | TEXT NOT NULL | Resource URL |
| title | TEXT NOT NULL | Display title |
| description | TEXT NOT NULL | 1-2 sentence summary |
| thumbnail_url | TEXT | YouTube: static URL; articles: local file path |
| question | TEXT NOT NULL | AI-generated comprehension question |
| status | TEXT NOT NULL DEFAULT 'pending' | 'pending' \| 'completed' \| 'dismissed' |
| view_count | INTEGER NOT NULL DEFAULT 0 | Incremented on View action |
| created_at | TEXT NOT NULL | ISO 8601 |
| completed_at | TEXT | ISO 8601, nullable |

Indexes: `idx_learning_materials_session_id`, `idx_learning_materials_status`.

## AI Generation Pipeline

**Trigger:** Phase completion in the coaching flow.

**Input:** Phase knowledge gaps, phase title/description, issue context.

**Output:** 2-3 learning materials per phase with Zod-validated structured output:

```typescript
const LearningMaterialSchema = z.object({
  materials: z.array(z.object({
    type: z.enum(['youtube', 'article']),
    url: z.string().url(),
    title: z.string(),
    description: z.string(),
    question: z.string(),
  }))
});
```

**Prompt strategy:** Ask Claude to find real, well-known resources (MDN, Fireship, official docs) relevant to knowledge gaps. Questions should test genuine engagement, not trivial recall.

**Thumbnails:**
- YouTube: `https://img.youtube.com/vi/{VIDEO_ID}/mqdefault.jpg`
- Articles: Headless Playwright screenshot, cropped/resized to 320x180, saved to `~/.paige/thumbnails/{id}.png`

**Post-generation:** Insert to DB, log `learning_material_generated`, broadcast `dashboard:materials` to Electron.

## WebSocket Protocol

### Server → Client

**`dashboard:materials`** (existing type, new payload):
```typescript
{
  materials: Array<{
    id: number;
    type: 'youtube' | 'article';
    url: string;
    title: string;
    description: string;
    thumbnailUrl: string | null;
    question: string;
    viewCount: number;
    status: 'pending' | 'completed' | 'dismissed';
    createdAt: string;
  }>;
}
```

**`materials:complete_result`** (new):
```typescript
{ id: number; correct: boolean; message?: string; }
```

**`materials:updated`** (new):
```typescript
{ id: number; viewCount: number; status: 'pending' | 'completed' | 'dismissed'; }
```

### Client → Server

**`materials:view`**: `{ id: number }` — open in browser, increment view count.

**`materials:complete`**: `{ id: number, answer: string }` — submit comprehension answer.

**`materials:dismiss`**: `{ id: number }` — soft-delete from list.

## Backend Handlers

- `handleMaterialsView` — increment view_count, IPC to Electron main for `shell.openExternal(url)`, send `materials:updated`
- `handleMaterialsComplete` — call Claude API for answer verification, send `materials:complete_result`, update DB if correct, send `materials:updated`
- `handleMaterialsDismiss` — set status to 'dismissed', send `materials:updated`

**Action log entries:** `learning_material_generated`, `learning_material_viewed`, `learning_material_completed`, `learning_material_dismissed`, `learning_material_answer_checked`

## Answer Verification

Zod schema:
```typescript
const AnswerVerificationSchema = z.object({
  correct: z.boolean(),
  feedback: z.string(),
});
```

Evaluation criteria (in prompt):
- Did the answer demonstrate engagement with the material?
- Is the core concept understood, even if wording is imperfect?
- Err on the side of accepting — coaching, not an exam.

On correct: update status → 'completed', set completed_at, log, send result + updated.
On incorrect: log with correct=false, send result with feedback. Status stays 'pending'.

## Electron UI Components

**MaterialsPanel** (`Dashboard/materials/MaterialsPanel.tsx`):
- Vertical scrollable list alongside StatsBento grid
- Subscribes to `dashboard:materials` via `useWebSocket().on()`
- Empty state message when no materials exist

**MaterialCard** (`Dashboard/materials/MaterialCard.tsx`):
- Horizontal row: thumbnail (80x45) | title + description + view count | action buttons
- Three icon buttons: View, Complete, Dismiss
- Framer Motion `layout` + `AnimatePresence` for smooth removal
- CSS variable theming

**CompletionModal** (`Dashboard/materials/CompletionModal.tsx`):
- Follows IssueModal pattern: fixed overlay, centered card, fade+scale
- Shows: material title, question, textarea, Submit button
- On correct: close modal, material animates out
- On incorrect: close modal, toast "Not quite — give the material another read and try again"

**Toast:** Uses existing `showCoachingToast()` for feedback.

**Browser opening:** View action → WS to backend → IPC to Electron main → `shell.openExternal(url)`.
