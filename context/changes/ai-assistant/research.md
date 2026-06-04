---
date: 2026-06-04T00:00:00+00:00
researcher: Claude Sonnet 4.6
git_commit: d773f49
branch: feature/ai-assistant
repository: trainer-app
topic: "AI assistant — floating panel, tool use, vector search, AI SDK UI"
tags: [research, ai-assistant, vercel-ai-sdk, pgvector, tool-use, floating-panel]
status: complete
last_updated: 2026-06-04
last_updated_by: Claude Sonnet 4.6
---

# Research: AI Assistant (S-06)

**Date**: 2026-06-04  
**Git Commit**: d773f49  
**Branch**: feature/ai-assistant  
**Repository**: trainer-app

## Research Question

Build an AI assistant that:
1. Appears as a **floating button** (bottom-right) that opens a slide-in chat panel; plus a dedicated `/assistant` full-screen page
2. Can **perform all app operations** (book/reschedule/cancel appointments, add clients, query stats) via chat tool calls, with confirmation before every write
3. Has **nice UI** using Vercel AI SDK components (`useChat`, tool invocation rendering)
4. Performs **semantic search over client data** using a vector database (Supabase pgvector + embeddings)

**User decisions (pre-research):**
- AI SDK: Use Vercel AI SDK (`ai` v5 + `@ai-sdk/anthropic`) — bundle size validated via wrangler dry-run
- Vector DB: Full pgvector — Supabase extension + Voyage AI voyage-3-lite embeddings
- UI placement: Both — floating button opens overlay panel + `/assistant` full-screen page

---

## Summary

All prerequisites are in place. F-01 delivered a working streaming route at `src/app/api/ai/chat/route.ts` and the nav already has an `/assistant` link (`src/app/(app)/layout.tsx:12`). The implementation has five interlocking parts:

| Part | Decision | Key dependency |
|---|---|---|
| **AI SDK migration** | Replace bare SSE route with `ai` v5 `streamText` + `@ai-sdk/anthropic` | New route format: `createUIMessageStreamResponse` |
| **Tool definitions** | 7 write tools (`needsApproval: true`) + 3 read tools (`execute`) | Wrap existing server actions |
| **Context assembly** | Supabase queries for client/appointment/package data; vector search for semantic lookup | New `/api/ai/chat` context-building layer |
| **Vector search** | pgvector on `clients` table, Voyage AI voyage-3-lite (512 dims) via raw `fetch` | New migration + backfill script |
| **UI layer** | `ChatButton` + `ChatPanel` in layout, `/assistant` page, tool approval rendering | `@ai-sdk/react` `useChat` hook |

**Critical path**: AI SDK migration → tool definitions → UI layer → vector search (can be done last, degrades gracefully to full context without vector search).

---

## Detailed Findings

### 1. Existing AI Route (F-01 baseline)

**File**: `src/app/api/ai/chat/route.ts`

The route exists and works. Key facts:

- Custom SSE format: `data: ${JSON.stringify({ content })}\n\n` — **incompatible with AI SDK's data stream protocol**. Migration to `createUIMessageStreamResponse` is a breaking change; any existing callers must be updated simultaneously.
- Takes `{ messages: Message[], context: string }` — context is assembled by the caller. This is intentional; S-06 needs to assemble context server-side inside the route instead.
- `MAX_CONTEXT_CHARS = 8000` exported — will be reused or raised in the new route.
- Auth: `supabase.auth.getUser()` defense-in-depth check (middleware also protects all routes).
- Model: `claude-haiku-4-5` with prompt caching on system prompt.

**What changes in the migration:**
- Response format: manual SSE → `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`
- Request body: `{ messages, context }` → `{ messages: UIMessage[] }` (context assembled server-side)
- Add tool definitions to `streamText`
- Add Supabase context-building queries inside the route handler

### 2. Vercel AI SDK v5 — Compatibility & API

**Source**: Context7 `/vercel/ai` (library ID, 9791 snippets, High reputation)

#### Cloudflare Workers compatibility

AI SDK v5 is **edge-runtime compatible**. The `streamText` function and `@ai-sdk/anthropic` provider use the Web Fetch API internally — no Node.js built-ins. The `workers-ai-provider` example in the docs confirms the pattern works on Cloudflare Workers. Verify with `wrangler deploy --dry-run` before merging (same gate as F-01).

**Note**: The previous F-01 plan avoided Vercel AI SDK due to bundle risk. Since `@anthropic-ai/sdk` is already installed (and `@ai-sdk/anthropic` wraps it), adding `ai` v5 + `@ai-sdk/anthropic` + `@ai-sdk/react` replaces rather than layers. Net bundle delta should be small, but **must be validated**.

#### Route handler pattern (v5)

```ts
// src/app/api/ai/chat/route.ts (new shape)
import {
  streamText, tool,
  createUIMessageStreamResponse,
  toUIMessageStream,
  convertToModelMessages,
  UIMessage,
  isStepCount,
} from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  // ... auth + context assembly ...

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(5),
    tools: { ...readTools, ...writeTools },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

Key v5 differences from v4:
- `stopWhen: isStepCount(5)` replaces `maxSteps: 5`
- `convertToModelMessages(messages)` converts UI messages to model format
- `createUIMessageStreamResponse` + `toUIMessageStream` replaces `result.toDataStreamResponse()`
- `message.parts` replaces `message.toolInvocations` on the client
- `addToolApprovalResponse` replaces `addToolResult` for confirmations

#### Tool approval (v5 first-class)

```ts
// Write tool — pauses for user confirmation
const createAppointmentTool = tool({
  description: 'Book a new training appointment for a client...',
  inputSchema: z.object({
    client_id: z.string().uuid(),
    date: z.string().describe('YYYY-MM-DD'),
    start_time: z.string().describe('HH:MM'),
    duration: z.enum(['30', '60', '90', '120']),
    package_id: z.string().uuid().optional(),
    notes: z.string().optional(),
    price: z.number().optional(),
    tz: z.string().describe('IANA timezone, e.g. Europe/Warsaw'),
  }),
  needsApproval: true,           // <-- pauses here, sends state:'approval-requested'
  execute: async (args) => {
    // Only runs AFTER user approves via addToolApprovalResponse
    return await createAppointmentAction(args);
  },
});
```

#### Client-side rendering (v5)

```tsx
'use client';
import { useChat } from '@ai-sdk/react';         // NOT 'ai/react'

const { messages, addToolApprovalResponse } = useChat({
  api: '/api/ai/chat',
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
});

// In message rendering:
message.parts.map(part => {
  if (part.type === 'tool-create_appointment') {
    if (part.state === 'approval-requested' && !part.approval.isAutomatic) {
      return <ConfirmCard
        args={part.input}
        onApprove={() => addToolApprovalResponse({ id: part.approval.id, approved: true })}
        onDeny={() => addToolApprovalResponse({ id: part.approval.id, approved: false })}
      />;
    }
    if (part.state === 'output-available') return <ToolResultCard result={part.output} />;
    if (part.state === 'output-denied') return <ToolDeniedCard />;
  }
})
```

### 3. Tool Inventory (10 AI-exposed tools)

**Source**: Task #2 agent — full codebase read of all server actions and schema

#### Write tools (7) — all require `needsApproval: true`

| Tool name | Wraps | Key inputs | Cascade risk |
|---|---|---|---|
| `create_appointment` | `createAppointmentAction` | client_id, date, start_time, duration, tz | Overlap check |
| `update_appointment` | `updateAppointmentAction` | id + same as create | Overlap check |
| `delete_appointment` | `deleteAppointmentAction` | id | Cascades to nowhere (clean delete) |
| `update_appointment_status` | `updateAppointmentStatusAction` | id, status enum | Affects visit counter |
| `create_client` | `createClientAction` | first_name, last_name, email?, phone?, package_id?, interview_notes?, plan_url? | — |
| `update_client` | `updateClientAction` | id + same as create | — |
| `delete_client` | `deleteClientAction` | id | **Cascades to all appointments** |

**Auth actions** (`login`, `register`, `logout`) are NOT exposed as AI tools.
**Package actions** (`create_package`, `update_package`, `delete_package`) — confirm with user whether to expose; the roadmap doesn't list package CRUD as an AI action, but the schema is complete.

#### Read tools (3) — `execute` only, no confirmation

| Tool name | Action | Returns |
|---|---|---|
| `list_clients` | SELECT clients WHERE trainer_id = user.id | Client list with package info |
| `list_appointments` | SELECT appointments + client JOIN | Calendar events for a date range |
| `get_stats` | Aggregated counts from appointments | visits_completed, revenue, cancellations |

#### Ownership pattern
Every action enforces `trainer_id = auth.uid()` at **three levels**: action code (`.eq('trainer_id', user.id)`), Supabase RLS policy, and the Supabase server client (JWT-scoped). The AI route must also call `supabase.auth.getUser()` before building context — same defense-in-depth as the existing route.

### 4. Context Assembly Architecture

The existing route takes a pre-assembled `context` string. The new route should assemble context **server-side** by querying Supabase directly. Proposed structure:

```
POST /api/ai/chat
  ↓
1. Auth check (getUser)
2. Parse { messages: UIMessage[] }
3. Extract last user message text
4. Vector search: embed last message → match_clients RPC → top 5 relevant clients
5. Full data fetch: fetch matched clients + recent appointments + packages
6. Assemble context string (max 8000 chars, truncate interview_notes last)
7. streamText with tools + system prompt grounded in context
```

The context string no longer comes from the caller — the route owns it. This fixes the security concern (AI route #6 from test-plan.md: "AI route builds context without trainer-scoped filter").

### 5. Vector Search — Supabase pgvector

**Source**: Task #3 agent research

#### Recommended embedding provider: Voyage AI `voyage-3-lite`

| Provider | Dims | Cost at scale | CF Workers | Notes |
|---|---|---|---|---|
| **Voyage AI voyage-3-lite** ✓ | 512 | Free (50M tokens/month) | Yes (raw fetch) | Anthropic's recommended partner |
| OpenAI text-embedding-3-small | 1536 | $0.02/1M tokens | Yes (raw fetch) | Larger column, higher latency |

At 20 clients + 50 queries/day → ~46K tokens/month → **free on Voyage AI**. No SDK needed — thin `fetch` wrapper to `api.voyageai.com/v1/embeddings`.

#### Migration SQL

```sql
-- 1. Enable extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Add embedding column to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS embedding vector(512);

-- 3. IVFFlat index (lists=1 for ≤20 clients; re-tune when >500)
CREATE INDEX IF NOT EXISTS clients_embedding_idx
  ON public.clients
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 1);

-- 4. Match function
CREATE OR REPLACE FUNCTION match_clients(
  query_embedding  vector(512),
  trainer_uuid     uuid,
  match_threshold  float  DEFAULT 0.65,
  match_count      int    DEFAULT 5
)
RETURNS TABLE (
  id               uuid,
  first_name       text,
  last_name        text,
  interview_notes  text,
  similarity       float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id, c.first_name, c.last_name, c.interview_notes,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.clients c
  WHERE c.trainer_id = trainer_uuid          -- scoped to this trainer
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**Note**: The function takes `trainer_uuid` explicitly so RLS is not needed on the function — the route handler passes `user.id` from `getUser()`.

#### When to generate embeddings

Generate **in the server action, non-blocking fire-and-forget**:

```ts
// After INSERT/UPDATE succeeds, don't await
generateAndStoreEmbedding(client).catch(err =>
  log('error', 'embedding_failed', { clientId: client.id, err })
);
```

If the Voyage API is down, the save succeeds — the client just won't be semantically searchable until the next update or a backfill job. Add a one-time backfill script for existing clients after the migration.

Fields to embed per client:
```ts
`${client.first_name} ${client.last_name}\n${client.interview_notes ?? ''}`
```

#### Graceful degradation

If vector search returns zero results (e.g., no embeddings yet, or low similarity), fall back to fetching **all clients** for the trainer (at 20 clients this is trivially small). The AI route should never return empty context.

### 6. UI Architecture

**Source**: Task #5 agent — full codebase read of layout, design tokens, components

#### Z-index stack (existing → new)

| Layer | z-index | Element |
|---|---|---|
| Background blobs | -10 | `layout.tsx:29` |
| Sidebar, mobile nav | 10 | `layout.tsx:38,72,90` |
| Sticky calendar headers | 20 | `CalendarView` |
| **Floating chat button** | **30** | New |
| **Chat panel** | **40** | New |
| Modals (Radix Dialog) | 50 | `dialog.tsx:42,66` |

#### Floating button

```tsx
// src/components/ChatButton.tsx — place in layout after <main>
<div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-30">
  <button
    onClick={onOpen}
    className="w-12 h-12 rounded-full bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700
               shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center text-white"
    aria-label="Open AI assistant"
  >
    <Bot size={20} />
  </button>
</div>
```

Mobile: `bottom-6` (24px) places button above the 56px bottom nav. No pb adjustment needed since the button is fixed.

**Hide on `/assistant` page**: Use `usePathname()` — return `null` when `pathname === '/assistant'`.

#### Chat panel

```
fixed right-0 top-0 bottom-0
w-full md:w-80
z-40
bg-white/80 dark:bg-carbon-black-900/80 backdrop-blur-md
border-l border-soft-linen-200 dark:border-carbon-black-800
```

Mobile: full width, slides from right. Add `pb-16 md:pb-0` inside the panel to clear the mobile bottom nav.

Panel structure:
1. **Header**: "Asystent" label + close (X) button
2. **Messages area**: `flex-1 overflow-y-auto` — user bubbles right (lobster-pink bg), assistant bubbles left (muted bg)
3. **Tool approval cards**: amber-tinted card, shows tool name + args, Approve/Deny buttons
4. **Input area**: `<Textarea>` (resize-none, rows=2) + Send button, Enter to send (Shift+Enter = newline)

#### State management

`useState` in `layout.tsx` is sufficient. The layout is a Server Component but ChatButton/ChatPanel are Client Components — wrap them in a thin `ChatWrapper` client boundary that holds the state.

```tsx
// src/components/ChatWrapper.tsx  ('use client')
export function ChatWrapper() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ChatButton isOpen={open} onClick={() => setOpen(!open)} />
      <ChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
// In layout.tsx (Server Component): <ChatWrapper />
```

#### `/assistant` full-screen page

- Route already registered in `navLinks` (`layout.tsx:12`) — page just needs to be created
- Layout: `mx-auto max-w-3xl px-4 py-8` matching other pages
- Same `useChat` hook, same tool rendering
- No floating button (hidden via `usePathname`)
- Panel link → "Open full screen" button in the panel header navigates to `/assistant`

---

## Code References

- `src/app/api/ai/chat/route.ts` — existing SSE route, baseline for migration
- `src/app/(app)/layout.tsx:12` — `navLinks` already has `/assistant` Asystent entry
- `src/app/(app)/layout.tsx:38,72,90` — z-index reference points (z-10 for nav layers)
- `src/app/(app)/layout.tsx:97` — `pb-16 md:pb-0` pattern for mobile bottom nav clearance
- `src/app/actions/appointments/index.ts:53-197` — all 4 appointment actions
- `src/app/actions/clients/index.ts:43-131` — all 3 client actions
- `src/app/actions/packages/index.ts:23-108` — all 3 package actions
- `src/app/actions/appointments/schema.ts:3-19` — appointment Zod schema (duration enum, tz field)
- `src/app/actions/clients/schema.ts:3-17` — client Zod schema (interview_notes, plan_url)
- `supabase/schema.sql` — clients, packages, appointments tables + RLS policies
- `src/components/ui/dialog.tsx:42,66` — z-50 modal reference
- `src/components/ui/button.tsx` — gradient variant available
- `src/app/globals.css:84-143` — full color token catalog

---

## Architecture Insights

### AI SDK v5 is the right choice (over v4)

v5 has **first-class tool approval** via `needsApproval: true` + `addToolApprovalResponse`. This eliminates the v4 pattern of omitting `execute` and calling `addToolResult` manually — the SDK handles the pause/resume protocol. The `parts`-based message format also makes tool state rendering cleaner than the `toolInvocations` array.

### Structural security guarantee

Write tools with `needsApproval: true` physically cannot auto-execute. The `execute` function only runs after `addToolApprovalResponse({ approved: true })` is called from the client. This is a structural guarantee, not a prompt instruction. Server actions additionally re-validate session and ownership independently.

### Route format is a breaking change

The old route returns `data: {"content":"chunk"}\n\n` SSE. The new route returns AI SDK's data stream protocol via `createUIMessageStreamResponse`. Any existing client code that reads the old SSE format must be migrated simultaneously. Since the route has no UI client yet (the `/assistant` page doesn't exist), this is a clean cut.

### Vector search degrades gracefully

If Voyage API is unavailable or embeddings haven't been generated yet, the route falls back to full client list (all trainer's clients, no semantic filtering). At 20 clients this produces ~3–5KB of context — well within the 8000 char limit. The 8000 char limit may need raising to 12000–16000 chars when full context includes appointment history.

### Package CRUD tools are optional

The roadmap's S-06 outcome mentions: book, reschedule, cancel, add client. Package management (create/update/delete) is not explicitly listed. Recommend exposing `list_packages` as a read tool for context, but deferring write package tools to a follow-up slice.

---

## Historical Context

- `context/archive/2026-05-28-ai-streaming-route/plan.md` — F-01 deliberately avoided Vercel AI SDK for bundle size. The user has now explicitly chosen it. Bundle validation gate (`wrangler deploy --dry-run`) must stay in the implementation plan.
- `context/archive/2026-05-28-ai-streaming-route/plan.md` — Confirmed: `compatibility_flags = ["nodejs_compat"]` already in `wrangler.toml`. No additional Workers config needed.
- `context/foundation/test-plan.md` — Phase 3 coverage for this slice: AI route context scoping (risk #6), grounding under truncation (risk #1), progress indicator E2E. The test plan already anticipates this slice.

---

## Open Questions

1. **Bundle size validation** — `ai` v5 + `@ai-sdk/anthropic` + `@ai-sdk/react`: estimate ~60–100KB gzipped. Must run `wrangler deploy --dry-run` against the 3 MiB free-tier limit before merging. If it fails, fallback is `ai` without the `@ai-sdk/react` client (build a minimal `useChat`-like hook instead).

2. **Package write tools** — Expose `create_package` / `update_package` / `delete_package` as AI tools? Roadmap doesn't list it but the actions are ready. Recommend deferring to avoid scope creep in S-06.

3. **`interview_notes` vs `training_goals`** — The schema has a single `interview_notes` field (freetext). The action agent referenced `training_goals` separately, but the actual Supabase schema (`supabase/schema.sql`) has only `interview_notes`. Confirm during implementation — do not add a separate column without a schema migration.

4. **Context assembly max chars** — Current limit is 8000 chars. With full tool context (10 clients × ~300 chars each + recent appointments), this may be too tight. Recommend raising to 12000 chars and measuring actual token usage in `claude-haiku-4-5` (128K context window — the limit is a prompt-quality guard, not a model constraint).

5. **Streaming progress indicator** — Test plan phase 3 requires a visible progress indicator for responses taking >2s. The AI SDK `useChat` exposes `isLoading` and streaming state natively. The `partial-call` tool state also provides in-progress feedback. No custom progress bar needed — use a typing indicator tied to `isLoading`.

6. **Voyage API key secret** — Needs a new Cloudflare Workers secret: `wrangler secret put VOYAGE_API_KEY`. Add placeholder `VOYAGE_API_KEY=` to `.env.example`. Document same as `ANTHROPIC_API_KEY` in F-01 plan.
