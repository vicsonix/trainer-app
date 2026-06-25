# AI Assistant (S-06) Implementation Plan

## Overview

Build the AI assistant slice: a floating chat button that opens a slide-in panel (plus a dedicated `/assistant` full-screen page), backed by Claude haiku-4-5 with 14 tool definitions (10 write with confirmation, 4 read) and semantic search over client data via Supabase pgvector + Voyage AI embeddings. The assistant can answer questions and perform all core app operations — booking, rescheduling, client management, package management — with a human-readable Polish confirmation step before every write.

## Current State Analysis

- `src/app/api/ai/chat/route.ts` — F-01 delivered a working streaming route using the bare `@anthropic-ai/sdk` with a custom SSE format (`data: {"content":"..."}\n\n`). It takes a pre-assembled `context` string from the caller. This format is incompatible with AI SDK's data stream protocol — migration is a clean break (no existing UI client yet).
- `src/app/(app)/layout.tsx:12` — the nav already has an `/assistant` link pointing to a page that doesn't exist yet.
- All server actions (appointments, clients, packages) exist and enforce `trainer_id` ownership at 3 levels (code + RLS + Supabase client).
- `MAX_CONTEXT_CHARS = 8000` is exported from the route — will be raised to 12 000.
- `wrangler.toml` has `compatibility_flags = ["nodejs_compat"]` — no additional Workers config needed for AI SDK.
- The `clients` table has only `interview_notes` (freetext) — no separate `training_goals` column.
- Remaining visits formula (from `calendar/page.tsx:74`): `package.visit_count − completed_count − scheduled_count` (only `completed` and `scheduled` statuses consume slots; `cancelled` and `no_show` do not).

## Desired End State

The trainer can open a chat panel from any page via a floating button (bottom-right), ask natural-language questions about clients and appointments, and issue commands that the assistant carries out after a confirmation step. The `/assistant` page offers the same interface full-screen. Client data is semantically indexed — "which clients have knee problems?" returns the right profiles. All write actions require an explicit Approve/Cancel before executing.

### Key Discoveries

- AI SDK v5 has first-class tool approval via `needsApproval: true` — `execute` only runs after `addToolApprovalResponse({ approved: true })` from the client. Structural guarantee, not a prompt instruction.
- The `@ai-sdk/anthropic` provider wraps `@anthropic-ai/sdk` — the bare SDK dependency can be removed after migration.
- The route handler must build tools via a factory `makeTools(supabase, userId)` — tools close over auth context so each `execute` call is scoped to the authenticated trainer.
- `get_client` remaining-visits query needs two counts from `appointments` (completed + scheduled for `client.package_id`) to match the existing calendar display formula exactly.
- The existing server actions use `FormData` — tool `execute` functions call Supabase directly (plain objects), not the server actions.
- Voyage AI `voyage-3-lite` (512 dims, free tier) via raw `fetch` — no SDK, keeps bundle lean.
- `@ai-sdk/react` imports go to `useChat` — must import from `@ai-sdk/react`, NOT `ai/react`.

## What We're NOT Doing

- Conversation persistence (sessions are stateless, no conversation history stored in DB)
- Rate limiting on `/api/ai/chat` (explicitly excluded in test-plan §7)
- AI tools for auth operations (login/register/logout)
- Reusing the FormData-based server action signatures in tool `execute` functions — tools call Supabase directly with plain objects (Phase 4 does add embedding side-effects to the client actions, but does not change their public API)
- Adding a `training_goals` column to the DB schema (use `interview_notes`)
- Cloudflare plan upgrade as a pre-condition — validate bundle first, upgrade only if needed
- AI-proposed calendar slots (parked in roadmap §Parked)

## Implementation Approach

Five sequential phases, each independently testable before the next begins. Critical path: Phase 1 (route) → Phase 2 (tools) → Phase 3 (UI). Vector search (Phase 4) degrades gracefully — if `VOYAGE_API_KEY` is absent or embeddings haven't been generated, the route falls back to full client list. Tests (Phase 5) close the test-plan Phase 3 coverage gap.

Bundle gate: after Phase 1's `npm install`, run `wrangler deploy --dry-run` before any further work. If the gzipped bundle exceeds the Cloudflare Workers free-tier 3 MiB limit, upgrade the Cloudflare plan before proceeding.

## Critical Implementation Details

**Tools factory pattern** — Tools must close over `supabase` (the auth-scoped server client) and `userId`. Define `makeTools(supabase, userId)` in `src/lib/ai/tools.ts` returning the `tools` object passed to `streamText`. Instantiate it inside the `POST` handler after `getUser()`, not at module scope.

**`get_client` remaining visits** — Must replicate `calendar/page.tsx:57-76` exactly: fetch ALL appointments for this client (`WHERE client_id = clientId AND trainer_id = userId`, no LIMIT), then count in JS — `completedCount = appointments.filter(a => a.status === 'completed' && a.package_id === client.package_id).length` and `scheduledCount` similarly. `remaining = package.visit_count − completedCount − scheduledCount`. Do NOT use LIMIT or COUNT queries — LIMIT will undercount for clients with more than 10 total appointments, and COUNT queries diverge from the proven production pattern.

**Tool error objects** — `execute` must return a typed result object on failure (e.g. `{ success: false, error: 'Overlap detected' }`) rather than throwing. This lets the model receive the error as a tool result and explain it conversationally. If the function throws, AI SDK surfaces a generic error to the client.

**`needsApproval` vs. bare `execute`** — Read tools (`list_clients`, `list_appointments`, `get_client`, `get_stats`) have only `execute` — they auto-run. Write tools have both `needsApproval: true` AND `execute` — the SDK pauses at `approval-requested`, then only calls `execute` after `addToolApprovalResponse({ approved: true })`.

---

## Phase 1: AI SDK Migration + Context-Assembly Route

### Overview

Replace the bare Anthropic SDK + manual SSE route with AI SDK v5 `streamText` + `createUIMessageStreamResponse`. Context is assembled server-side from the trainer's Supabase data (no more caller-provided context string). No tools yet — the route returns text-only streaming responses. Bundle gate runs here.

### Changes Required

#### 1. Install AI SDK packages

**File**: `package.json` (via `npm install`)

**Intent**: Add the three AI SDK packages needed across all phases; remove the bare `@anthropic-ai/sdk` which is superseded by `@ai-sdk/anthropic`.

**Contract**: Run `npm install ai @ai-sdk/anthropic @ai-sdk/react` then `npm uninstall @anthropic-ai/sdk`. Verify `package.json` dependencies section contains `"ai"`, `"@ai-sdk/anthropic"`, `"@ai-sdk/react"` and no longer contains `"@anthropic-ai/sdk"`.

#### 2. Context assembly module

**File**: `src/lib/ai/context.ts` (new)

**Intent**: Centralise all Supabase queries needed to build the trainer's context string. Called from the route handler; also updated in Phase 4 to incorporate vector search results.

**Contract**: Export `buildTrainerContext(supabase, userId: string): Promise<string>`. Fetches: all clients (with package name and visit_count), all appointments from the past 90 days and next 30 days (with client name and status), and all packages. Serialises into a plain-text block capped at `MAX_CONTEXT_CHARS = 12_000`. Truncation order: drop oldest appointments first, then truncate `interview_notes` fields to 500 chars each. Never returns an empty string — falls back to "No client data available." if all queries fail.

#### 3. Rewrite AI chat route

**File**: `src/app/api/ai/chat/route.ts`

**Intent**: Replace the custom SSE + bare Anthropic SDK implementation with AI SDK v5 `streamText` and the `@ai-sdk/anthropic` provider. Context is assembled server-side. No tools in this phase.

**Contract**: `POST` handler signature unchanged. Request body changes: accepts `{ messages: UIMessage[] }` (AI SDK format) instead of `{ messages: Message[], context: string }`. Auth check unchanged (`getUser()` before anything else). Calls `buildTrainerContext`, then `streamText({ model: anthropic('claude-haiku-4-5'), system: SYSTEM_PROMPT, messages: await convertToModelMessages(messages), stopWhen: isStepCount(5) })`. Returns `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`. Export `MAX_CONTEXT_CHARS = 12_000`.

The system prompt grounds the model on the assembled context and instructs it to refuse if information is not in the data. Keep the `cache_control: { type: 'ephemeral' }` hint on the system block for prompt caching.

#### 4. Bundle size gate

**File**: `wrangler.toml` (no change), just run the command

**Intent**: Validate the Cloudflare Workers free-tier 3 MiB gzipped limit before proceeding further.

**Contract**: Run `npm run build:worker && wrangler deploy --dry-run`. If gzipped bundle > 3 MiB, upgrade the Cloudflare plan. Document the bundle size in a comment in `wrangler.toml`.

### Success Criteria

#### Automated Verification

- `npm run build:worker && wrangler deploy --dry-run` exits 0 with bundle size < 3 MiB (or Cloudflare plan upgraded)
- `npm run lint` passes
- `npx tsc --noEmit` passes with no new errors
- `npm run test` passes (existing tests unaffected)

#### Manual Verification

- `POST /api/ai/chat` with `{ "messages": [{ "role": "user", "content": [{ "type": "text", "text": "Hello" }] }] }` returns a streaming AI SDK data stream (starts with `f:` or `0:` prefix lines, not `data: {"content":`)
- The response contains a sensible greeting referencing trainer context
- Unauthenticated request returns 401

**Implementation Note**: After completing Phase 1 and all automated verification passes, confirm manually that the streaming format works before proceeding to Phase 2. Phase blocks use plain bullets — checkboxes live in `## Progress`.

---

## Phase 2: Tool Definitions

### Overview

Add all 14 tool definitions to the route — 10 write tools with `needsApproval: true` and 4 read tools with `execute`. Creates the tools factory, confirmation formatters, and the `get_client` read query. After this phase, the route returns tool calls in the stream that the UI can render (Phase 3).

### Changes Required

#### 1. Tool confirmation formatters

**File**: `src/lib/ai/tool-formatters.ts` (new)

**Intent**: Map each write tool name + args to a human-readable Polish confirmation string displayed in the chat panel. Decoupled from tool definitions so the UI can import without pulling in Supabase deps.

**Contract**: Export `TOOL_CONFIRMATION_LABELS: Record<string, (args: Record<string, unknown>) => string>` with one entry per write tool. Examples:
- `create_appointment`: `"Zarezerwuj wizytę ${args.date} o ${args.start_time} (${args.duration} min)"` — UUIDs for client/package IDs are not shown; the AI's surrounding conversational text already names the client.
- `create_client`: `"Dodaj klienta: ${args.first_name} ${args.last_name}"`
- `delete_client`: `"USUŃ klienta i wszystkie jego wizyty"` — destructive action visually flagged
- `delete_package`: `"Usuń pakiet"`
- `update_appointment_status`: uses Polish status labels (Odbyła się / Anulowana / Nieobecność / Zaplanowana)

#### 2. Tools factory

**File**: `src/lib/ai/tools.ts` (new)

**Intent**: Define all 14 tools; export a `makeTools(supabase, userId)` factory so each tool's `execute` closes over the auth-scoped client and is inherently trainer-scoped. All Supabase writes in `execute` use `.eq('trainer_id', userId)` for defense-in-depth even though RLS also enforces it.

**Contract**: `makeTools(supabase: SupabaseClient, userId: string)` returns an object with 14 keys matching the tool names below. Each tool uses `tool()` from `ai` with `inputSchema` (Zod). Write tools add `needsApproval: true`.

**Write tools (10):**
- `create_appointment` — `inputSchema`: `client_id` (uuid), `date` (YYYY-MM-DD), `start_time` (HH:MM), `duration` (enum: '30'|'60'|'90'|'120'), `tz` (IANA), `package_id?` (uuid), `notes?` (string), `price?` (number). `execute` replicates `createAppointmentAction`'s logic: timezone computation using `@internationalized/date`, overlap check, INSERT. Returns `{ success: true }` or `{ success: false, error: string }`.
- `update_appointment` — same schema + `appointment_id` (uuid). Excludes self from overlap check.
- `delete_appointment` — `appointment_id` (uuid).
- `update_appointment_status` — `appointment_id` (uuid), `status` (enum: 'scheduled'|'completed'|'cancelled'|'no_show').
- `create_client` — `first_name`, `last_name`, `phone?`, `email?`, `package_id?`, `interview_notes?`, `plan_url?`.
- `update_client` — same schema + `client_id` (uuid).
- `delete_client` — `client_id` (uuid). Note: cascades to all appointments — return a warning in the success response.
- `create_package` — `name`, `visit_count` (positive int), `price` (non-negative decimal).
- `update_package` — same schema + `package_id` (uuid).
- `delete_package` — `package_id` (uuid).

**Read tools (4):**
- `list_clients` — no input. `execute`: `SELECT *, packages(name, visit_count, price) FROM clients WHERE trainer_id = userId ORDER BY created_at DESC`. Returns array of client summaries.
- `list_appointments` — `from_date?` (YYYY-MM-DD), `to_date?` (YYYY-MM-DD). `execute`: query appointments with client join for the given range (defaults: today − 7 days to today + 30 days).
- `get_stats` — `period` (enum: 'this_month'|'last_3_months'|'all_time'). `execute`: aggregate counts — completed visits, cancelled/no_show counts, revenue (sum of `price` on completed appointments).
- `get_client` — `client_id` (uuid). `execute`: two parallel Supabase calls — (1) `SELECT *, packages(id, name, visit_count, price) FROM clients WHERE id = client_id AND trainer_id = userId SINGLE`, (2) `SELECT id, starts_at, ends_at, status, notes, package_id FROM appointments WHERE client_id = client_id AND trainer_id = userId ORDER BY starts_at ASC` (no LIMIT — must fetch all to count correctly). Compute in JS: `completedCount = appointments.filter(a => a.status === 'completed' && a.package_id === client.package_id).length`, `scheduledCount` similarly for `'scheduled'`, `remainingVisits = package.visit_count - completedCount - scheduledCount`. Return all client fields + package info + remainingVisits + last 5 appointments (`.slice(-5)` of the sorted array).

#### 3. Wire tools into route

**File**: `src/app/api/ai/chat/route.ts`

**Intent**: Add the tools factory call inside the `POST` handler and pass tools to `streamText`.

**Contract**: After `getUser()`, call `const tools = makeTools(supabase, user.id)`. Add `tools` to the `streamText` call. No other changes to the route in this phase.

### Success Criteria

#### Automated Verification

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run test` passes

#### Manual Verification

- `POST /api/ai/chat` with a message like "List my clients" causes the stream to include a `tool_call` part for `list_clients` before the final text response
- Asking "Book an appointment for client X on Friday at 10am for 60 minutes timezone Europe/Warsaw" causes the stream to include an `approval-requested` tool part for `create_appointment`
- `get_client` with a valid UUID returns full profile + remaining visits in the `output-available` state (can verify by inspecting stream bytes before the UI exists)

---

## Phase 3: UI Layer

### Overview

Build the full chat UI: `ChatWrapper` client boundary in layout, floating `ChatButton`, slide-in `ChatPanel` with message rendering and tool approval cards, and the `/assistant` full-screen page. After this phase, the end-to-end flow works: float button → panel → send message → see streaming response → approve write action → confirm result.

### Changes Required

#### 1. Tool card components

**File**: `src/components/chat/ToolCard.tsx` (new)

**Intent**: Render the three states a write-tool call can be in: `approval-requested` (confirmation card), `output-available` (success card), `output-denied` (cancelled card). Also renders read-tool results.

**Contract**: Export `<ToolCard part={part} onApprove={fn} onDeny={fn} />`. When `part.state === 'approval-requested'` and `!part.approval.isAutomatic`: render an amber-tinted card (matching the app's destructive/warning palette) with the human-readable label from `TOOL_CONFIRMATION_LABELS[part.type.replace('tool-', '')]` and Approve/Cancel buttons. The `delete_client` and `delete_appointment` tools render a red destructive variant (use `border-destructive/30 bg-destructive/5` matching `AppointmentDetailModal.tsx:357`). When `output-available`: render a teal success card with a brief confirmation. When `output-denied`: render a muted "Action cancelled" card. Read tool results render as a collapsible data summary.

#### 2. Message bubble component

**File**: `src/components/chat/MessageBubble.tsx` (new)

**Intent**: Render a single message's text content and tool parts.

**Contract**: Export `<MessageBubble message={message} onApprove={fn} onDeny={fn} />`. User messages: right-aligned bubble, `bg-lobster-pink-500 text-white`. Assistant messages: left-aligned bubble, `bg-muted text-foreground`. Iterate `message.parts` — `text` parts render inline; `tool-*` parts render `<ToolCard>`. Strip empty text parts before rendering (the SDK sometimes emits empty strings around tool calls).

#### 3. ChatWrapper (client boundary)

**File**: `src/components/ChatWrapper.tsx` (new)

**Intent**: The only Client Component in the layout tree that owns the panel's open/close state. The parent layout (`layout.tsx`) is a Server Component and cannot hold `useState`.

**Contract**: `'use client'`. Exports `<ChatWrapper />`. Holds `const [open, setOpen] = useState(false)`. Renders `<ChatButton>` and `<ChatPanel>` passing open state and callbacks.

#### 4. ChatButton

**File**: `src/components/ChatButton.tsx` (new)

**Intent**: Fixed floating button (bottom-right) that opens the chat panel. Hidden on the `/assistant` page where the full-screen interface replaces it.

**Contract**: `'use client'`. Uses `usePathname()` from `next/navigation` — returns `null` when `pathname === '/assistant'`. Renders a `w-12 h-12 rounded-full` button with `fixed bottom-20 right-4 md:bottom-8 md:right-8 z-30` (bottom-20 on mobile to clear the bottom nav bar, bottom-8 on desktop). Gradient: `bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700`. Icon: `<Bot size={20} />` from `lucide-react`.

#### 5. ChatPanel

**File**: `src/components/ChatPanel.tsx` (new)

**Intent**: Slide-in chat panel — glass effect, 320px wide on desktop, full-width on mobile.

**Contract**: `'use client'`. Uses `useChat` from `@ai-sdk/react` with `api: '/api/ai/chat'` and `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses` (import from `'ai'`) — required for the approval flow to automatically resume after the user clicks Approve. The panel renders when `open === true`. Layout:
- `fixed right-0 top-0 bottom-0 w-full md:w-80 z-40 bg-white/80 dark:bg-carbon-black-900/80 backdrop-blur-md border-l border-soft-linen-200 dark:border-carbon-black-800 flex flex-col`
- Header: "Asystent" title + "Open full screen" link to `/assistant` + X close button
- Messages area: `flex-1 overflow-y-auto p-3 space-y-3 pb-16 md:pb-0` — renders `<MessageBubble>` per message; shows a typing indicator (three animated dots) when `isLoading === true`
- Input area: `<Textarea>` rows=2, resize-none + Send button; Enter submits, Shift+Enter newlines
- `addToolApprovalResponse` from `useChat` passed to `<ToolCard>` for confirmation handling

Progress indicator: while `isLoading`, show a pulsing "…" typing indicator bubble as the last message. Add `data-testid="typing-indicator"` to this element — required by the Phase 5 E2E test. This is the element verified by the E2E test in Phase 5.

#### 6. Wire ChatWrapper into layout

**File**: `src/app/(app)/layout.tsx`

**Intent**: Add the chat UI to every authenticated page.

**Contract**: Import `<ChatWrapper />`. Add `<ChatWrapper />` after the closing `</main>` tag (before the end of the outer `<div>`). No other changes to the layout.

#### 7. `/assistant` full-screen page

**File**: `src/app/(app)/assistant/page.tsx` (new)

**Intent**: Full-screen chat interface for the existing `/assistant` nav link. Identical UX to the panel but full-width, no floating button.

**Contract**: `'use client'`. Same `useChat` hook (include `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`), same `<MessageBubble>` and `<ToolCard>` components. Layout: `mx-auto max-w-3xl px-4 py-8` matching other pages. Header: `<h1>` with gradient text "Asystent" matching the dashboard page pattern (`dashboard/page.tsx:116-122`). Messages area scrolls independently. Input at the bottom. No close button, no "open full screen" link.

### Success Criteria

#### Automated Verification

- `npx tsc --noEmit` passes
- `npm run lint` passes

#### Manual Verification

- Floating button appears on `/dashboard`, `/clients`, `/calendar`, `/packages` pages
- Floating button does NOT appear on `/assistant`
- Button click opens the slide-in panel; X button closes it
- Sending a text message streams a response into the panel
- Panel shows typing indicator (animated dots) while the response streams
- A booking request shows a Polish-language confirmation card with Approve/Cancel
- Clicking Approve executes the booking; clicking Cancel cancels it
- Cancelled write shows "Action cancelled" card
- Failed write (e.g. overlap) shows AI's natural-language explanation, not a raw error
- `/assistant` page loads, shows the same chat interface full-screen
- "Open full screen" link in panel navigates to `/assistant`
- Panel chat and `/assistant` chat both work on mobile (bottom nav is not obscured)

---

## Phase 4: Vector Search

### Overview

Add Supabase pgvector support for semantic client search. Clients' `interview_notes` are embedded using Voyage AI `voyage-3-lite` (512 dims, free tier). Embeddings are generated non-blockingly on client create/update. The route handler runs a vector search before context assembly to surface the most relevant clients first.

### Changes Required

#### 1. Database migration

**File**: `supabase/migrations/<timestamp>_pgvector.sql` (new)

**Intent**: Enable the pgvector extension, add the embedding column to `clients`, create the IVFFlat index, and define the `match_clients` RPC function.

**Contract**: Migration must be idempotent (`IF NOT EXISTS` guards). Use `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions`. Add `embedding vector(512)` to `public.clients`. Index: `USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1)` (1 list is correct for ≤20 rows; re-tune to `sqrt(row_count)` when the dataset grows). `match_clients` function signature: `(query_embedding vector(512), trainer_uuid uuid, match_threshold float DEFAULT 0.65, match_count int DEFAULT 5)` — returns `(id uuid, first_name text, last_name text, interview_notes text, similarity float)`. The function applies `WHERE trainer_id = trainer_uuid` to scope results to the requesting trainer.

#### 2. Embeddings module

**File**: `src/lib/embeddings.ts` (new)

**Intent**: Thin raw-fetch wrapper for the Voyage AI embeddings API. No SDK — keeps bundle lean.

**Contract**: Export `embedText(text: string): Promise<number[]>`. POSTs to `https://api.voyageai.com/v1/embeddings` with `{ model: 'voyage-3-lite', input: text }` and `Authorization: Bearer ${process.env.VOYAGE_API_KEY}`. Throws a descriptive error if `VOYAGE_API_KEY` is absent or if the API returns a non-200 status. Returns `json.data[0].embedding` (an array of 512 floats). Also export `clientToEmbeddingText(client: { first_name, last_name, interview_notes }): string` — concatenates `${first_name} ${last_name}\n${interview_notes ?? ''}`.

#### 3. Environment variable wiring

**File**: `.env.example`

**Intent**: Document the new secret alongside the existing ones.

**Contract**: Add `VOYAGE_API_KEY=` on a new line after `ANTHROPIC_API_KEY=`. Add a comment above: `# Voyage AI — used for semantic client search (voyage-3-lite embeddings)`. Also update `CLAUDE.md` or the plan notes to document that `wrangler secret put VOYAGE_API_KEY` must be run before production deploy.

#### 4. Wire embedding generation into client actions

**File**: `src/app/actions/clients/index.ts`

**Intent**: After a successful client INSERT or UPDATE, generate and store the embedding non-blockingly so the client's interview notes become semantically searchable.

**Contract**: Import `embedText`, `clientToEmbeddingText` from `@/lib/embeddings`. In both `createClientAction` and `updateClientAction`, after the Supabase INSERT/UPDATE succeeds and before `revalidatePath`, call a fire-and-forget helper: `generateAndStoreEmbedding(client.id, client).catch(err => log('error', 'embedding_failed', { clientId: client.id }))`. The helper must not be awaited. `generateAndStoreEmbedding` calls `embedText(clientToEmbeddingText(client))` then `.update({ embedding }).eq('id', clientId)`. Only attempt if `process.env.VOYAGE_API_KEY` is set — skip silently otherwise.

#### 5. Backfill script

**File**: `src/scripts/backfill-embeddings.ts` (new)

**Intent**: One-time script to generate and store embeddings for all existing clients who have a null `embedding` column.

**Contract**: Script uses the Supabase service-role client (reads `SUPABASE_SERVICE_ROLE_KEY` from env). Fetches all clients WHERE `embedding IS NULL`. Generates embeddings sequentially (not parallel — rate-limit friendly). Logs progress. Safe to re-run — skips clients that already have an embedding. Run via `npx tsx src/scripts/backfill-embeddings.ts`.

#### 6. Wire vector search into route

**File**: `src/lib/ai/context.ts`

**Intent**: Update context assembly to first run a vector search if `VOYAGE_API_KEY` is set and the last user message can be embedded, then prioritise semantically relevant clients at the top of the context string.

**Contract**: Add an optional `vectorResults?: Array<{ id: string, similarity: number }>` parameter to `buildTrainerContext`. When provided, sort the client list so vector-matched clients appear first (highest similarity first), prepending a `[Semantic match: N%]` annotation to their profile block. When `VOYAGE_API_KEY` is absent or vector search errors, the function behaves identically to its Phase 1 state.

**File**: `src/app/api/ai/chat/route.ts`

**Intent**: Before calling `buildTrainerContext`, extract the last user message text, embed it, and run `supabase.rpc('match_clients', ...)`. Pass results into context assembly.

**Contract**: Wrap in try/catch — if vector search fails for any reason, `vectorResults` is left undefined and context assembly runs without it. Log the failure but do not surface it to the user.

### Success Criteria

#### Automated Verification

- `supabase db push` (or migration apply) exits 0
- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run test` passes

#### Manual Verification

- After running the migration and setting `VOYAGE_API_KEY` locally, creating a client and then asking the assistant "which clients have knee problems?" returns clients whose `interview_notes` mention knee issues, even if the query uses different words
- Creating a new client triggers a background embedding request (visible in logs: no `embedding_failed` error)
- Backfill script runs to completion without errors on the current client set
- When `VOYAGE_API_KEY` is not set, the assistant still responds correctly (degrades to full client list)

---

## Phase 5: Tests

### Overview

Deliver the test-plan Phase 3 coverage: two Vitest integration tests for the AI route (auth scoping and grounding under truncation), and one Playwright E2E test for the progress indicator. This closes the risks flagged in `context/foundation/test-plan.md` §2 risks #1 and #6.

### Changes Required

#### 1. Vitest integration: route auth + context scoping

**File**: `src/app/api/ai/chat/route.test.ts` (new)

**Intent**: Verify risk #6 — "AI route builds context without trainer-scoped filter." Two assertions: (1) unauthenticated request returns 401, (2) authenticated request only receives context from that trainer's own clients.

**Contract**: Mock pattern follows `src/app/actions/clients/clients.test.ts` — `vi.mock('@/lib/supabase/server')`. Also mock `ai` module (`streamText`, `createUIMessageStreamResponse`) to return a fixture stream so the test doesn't call Anthropic. Test cases:
- Unauthenticated (mock `getUser` returns null): `POST` returns 401.
- Authenticated: mock `getUser` returns `{ user: { id: 'trainer-1' } }`. Mock Supabase `from('clients').select()` to return 2 clients. Mock `from('clients').select()` for a different trainer to return different clients. Assert that `buildTrainerContext` was called with `userId = 'trainer-1'` and the context string contains trainer-1's client names, not trainer-2's.

#### 2. Vitest unit: context truncation

**File**: `src/lib/ai/context.test.ts` (new)

**Intent**: Verify risk #1 — `buildTrainerContext` never returns a string longer than `MAX_CONTEXT_CHARS`, and the grounding instruction in the route's system prompt instructs the model to refuse fabrication. Truncation is tested where it lives (inside `buildTrainerContext`), not by mocking it away.

**Contract**: Mock `@/lib/supabase/server` to return enough clients and appointments to produce a raw serialised string longer than `MAX_CONTEXT_CHARS` (e.g., 20 clients each with a 2 000-char `interview_notes` field). Call `buildTrainerContext(mockSupabase, 'trainer-1')`. Assert: (a) the returned string length is ≤ `MAX_CONTEXT_CHARS`, and (b) the string is not empty. Separately, in `route.test.ts`, assert that the `system` prompt passed to `streamText` contains the literal grounding instruction ("Do not invent or assume any details").

#### 3. Playwright E2E: typing indicator

**File**: `playwright/assistant.spec.ts` (new)

**Intent**: Verify the progress indicator for responses taking >2s (test-plan Phase 3 requirement). Follows the seed test conventions from `playwright/` directory — `storageState` auth, `getByRole` locators, no `waitForTimeout`.

**Contract**: Test name: `'shows typing indicator while AI response streams'`. Auth via `storageState`. Navigate to `/assistant`. Type a message ("Hello"). Click send (or press Enter). Assert: `await expect(page.getByTestId('typing-indicator')).toBeVisible()` before the response completes. Assert: after response completes, typing indicator is no longer visible. Clean up: no state written to DB (this is a read-only chat message). Requires `data-testid="typing-indicator"` to be present on the typing indicator element in `ChatPanel.tsx` and `assistant/page.tsx`.

### Success Criteria

#### Automated Verification

- `npm run test -- src/app/api/ai/chat/route.test.ts` passes (2 cases: 401 + scoping)
- `npm run test -- src/lib/ai/context.test.ts` passes (truncation unit test)
- `npx playwright test playwright/assistant.spec.ts` passes
- `npm run lint` passes
- `npx tsc --noEmit` passes

#### Manual Verification

- Test output shows: "1 passing" for the E2E spec and "3 passing" for the Vitest integration
- No other tests regressed

---

## Phase 6: Conversation History + Named Threads

### Overview

Persist chat conversations in Supabase so the trainer can return to past threads. The `/assistant` page gains a thread-list sidebar. The floating ChatPanel continues the most recent conversation on open. Threads are auto-titled from the first user message and can be renamed.

### Changes Required

#### 1. Database migration

**File**: `supabase/migrations/<timestamp>_conversations.sql` (new)

**Intent**: Two new tables: `conversations` (thread metadata) and `conversation_messages` (individual messages with full UI state).

**Contract**: Idempotent (`IF NOT EXISTS` guards). RLS: `trainer_id = auth.uid()` on `conversations`; `conversation_id IN (SELECT id FROM conversations WHERE trainer_id = auth.uid())` on `conversation_messages`.

```sql
CREATE TABLE public.conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.conversation_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  content         jsonb NOT NULL,   -- full UIMessage object (preserves tool call state)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.conversation_messages (conversation_id, created_at);
```

`content` stores the entire `UIMessage` as JSONB so tool call state (approvals, results) survives in history — simple text would lose this.

#### 2. Conversation server actions

**File**: `src/app/actions/conversations/index.ts` (new)

**Intent**: CRUD for conversations and messages used by both the floating panel and the `/assistant` page.

**Contract**: Export these server actions:
- `createConversationAction(firstMessage: string): Promise<{ id: string } | { error: string }>` — INSERT into `conversations` with `title = firstMessage.slice(0, 60)`, returns the new `id`.
- `saveMessageAction(conversationId: string, message: UIMessage): Promise<void>` — INSERT one row into `conversation_messages`. Called after each AI response completes (via `useChat`'s `onFinish`).
- `loadConversationAction(conversationId: string): Promise<UIMessage[]>` — SELECT `content` from `conversation_messages` WHERE `conversation_id` ordered by `created_at`. Returns the deserialized `UIMessage[]` for `useChat`'s `initialMessages`.
- `listConversationsAction(): Promise<Array<{ id, title, updated_at }>>` — SELECT from `conversations` WHERE `trainer_id = user.id` ORDER BY `updated_at DESC LIMIT 50`.
- `renameConversationAction(id: string, title: string): Promise<void>` — UPDATE title + updated_at.
- `deleteConversationAction(id: string): Promise<void>` — DELETE (cascades to messages via FK).

All actions call `getUser()` before any DB operation; return `{ error: 'Sesja wygasła' }` if unauthenticated.

#### 3. Update ChatPanel for thread continuity

**File**: `src/components/ChatPanel.tsx`

**Intent**: On open, load the most recent conversation. On close/unmount, ensure the last message is saved. Add a "New conversation" button to the panel header.

**Contract**: On mount, call `listConversationsAction()` — if a conversation exists, call `loadConversationAction(conversations[0].id)` and pass the result as `initialMessages` to `useChat`. If none exist, start fresh. Track `currentConversationId` in state. When the first user message is sent (`onFinish` after the first user message), if no conversation exists yet call `createConversationAction(message.text)` and store the returned `id`. On each AI response finish, call `saveMessageAction(currentConversationId, assistantMessage)`. Also save user messages before sending. Add "New conversation" button to header: clears `initialMessages`, sets `currentConversationId = null`.

#### 4. Update `/assistant` page with thread list sidebar

**File**: `src/app/(app)/assistant/page.tsx`

**Intent**: Full-screen page now has a two-column layout: left sidebar lists past threads, right panel is the active conversation.

**Contract**: On mount, call `listConversationsAction()` to populate the sidebar. Left sidebar (hidden on mobile, toggleable): list of past conversations ordered by `updated_at DESC`, each showing title + relative date. Clicking a thread calls `loadConversationAction(id)` and sets `initialMessages`. "New conversation" button at the top of the sidebar. Thread rename: long-press or pencil icon inline — calls `renameConversationAction`. Thread delete: swipe or trash icon — calls `deleteConversationAction` with confirm dialog. On mobile, show a "Threads" toggle button to open the sidebar as a sheet.

Same message-saving logic as ChatPanel (track `currentConversationId`, save on `onFinish`).

### Success Criteria

#### Automated Verification

- `npm run db:push` applies migration cleanly
- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run test` passes

#### Manual Verification

- Opening the assistant panel shows messages from the most recent conversation
- Sending a new message in the panel saves it — reload the page and the message is still there
- `/assistant` sidebar shows a list of past conversations
- Clicking a past thread loads it in the right panel
- "New conversation" button clears the chat and starts fresh
- Thread is auto-titled from the first message (truncated to 60 chars)
- Rename and delete work on the `/assistant` page
- On mobile, thread list opens as a sheet/drawer

---

## Testing Strategy

### Unit Tests

- Route handler: auth scoping, context truncation grounding (Phase 5, Vitest)
- Embeddings module: can be unit-tested with a mocked `fetch` if needed

### Integration Tests

- `route.test.ts` — Supabase mock, verifies scoping and system prompt content

### Manual Testing Steps

1. Open the app on mobile — verify floating button is above the bottom nav bar
2. Send "List my clients" — verify `list_clients` tool auto-executes and response names your clients
3. Send "Tell me everything about [client name]" — verify `get_client` fires, response includes package info and remaining visits
4. Send "Book an appointment for [client] on [date]" — verify confirmation card appears in Polish
5. Click Approve — verify appointment appears in the calendar
6. Send the same booking again — verify the overlap error is explained naturally by the model
7. Navigate to `/assistant` — verify full-screen interface works identically
8. Turn off `VOYAGE_API_KEY` in `.env.local` — verify assistant still works

## Migration Notes

- Run the pgvector migration with `npm run db:push` after Phase 4 starts
- Run the backfill script once after the migration: `npx tsx src/scripts/backfill-embeddings.ts`
- Set `VOYAGE_API_KEY` as a Cloudflare Workers secret: `wrangler secret put VOYAGE_API_KEY`
- The `@anthropic-ai/sdk` direct dependency is removed in Phase 1; `@ai-sdk/anthropic` replaces it

## References

- Research: `context/changes/ai-assistant/research.md`
- F-01 plan (AI streaming foundation): `context/archive/2026-05-28-ai-streaming-route/plan.md`
- Test plan Phase 3 (risks #1 and #6): `context/foundation/test-plan.md`
- Remaining visits formula: `src/app/(app)/calendar/page.tsx:74-76`
- Existing modal pattern (confirmation UX reference): `src/app/(app)/calendar/AppointmentDetailModal.tsx:357-384`
- Supabase mock pattern: `src/app/actions/clients/clients.test.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: AI SDK Migration + Context-Assembly Route

#### Automated

- [x] 1.1 `npm run build:worker && wrangler deploy --dry-run` exits 0 with bundle < 3 MiB — a437939
- [x] 1.2 `npm run lint` passes — a437939
- [x] 1.3 `npx tsc --noEmit` passes with no new errors — a437939
- [x] 1.4 `npm run test` passes (existing tests unaffected) — a437939

#### Manual

- [x] 1.5 `POST /api/ai/chat` returns AI SDK data stream format (not custom SSE) — a437939
- [x] 1.6 Response contains trainer context in the reply — a437939
- [x] 1.7 Unauthenticated request returns 401 — a437939

### Phase 2: Tool Definitions

#### Automated

- [x] 2.1 `npx tsc --noEmit` passes — 368fa63
- [x] 2.2 `npm run lint` passes — 368fa63
- [x] 2.3 `npm run test` passes — 368fa63

#### Manual

- [x] 2.4 "List my clients" triggers `list_clients` tool call in stream — 368fa63
- [x] 2.5 Booking request triggers `create_appointment` tool with `approval-requested` state — 368fa63
- [x] 2.6 "Tell me about [client name]" triggers `get_client` with correct remaining-visit count — 368fa63

### Phase 3: UI Layer

#### Automated

- [x] 3.1 `npx tsc --noEmit` passes — b569677
- [x] 3.2 `npm run lint` passes — b569677

#### Manual

- [x] 3.3 Floating button visible on all app pages except `/assistant` — b569677
- [x] 3.4 Panel opens/closes; typing indicator visible during stream — b569677
- [x] 3.5 Polish confirmation card appears for write actions; Approve executes, Cancel cancels — b569677
- [x] 3.6 Failed write shows natural-language error (not raw JSON) — b569677
- [x] 3.7 `/assistant` page loads with full-screen chat — b569677
- [x] 3.8 Works on mobile (button above bottom nav; panel clears nav) — b569677

### Phase 4: Vector Search

#### Automated

- [x] 4.1 `npm run db:push` applies migration cleanly
- [x] 4.2 `npx tsc --noEmit` passes
- [x] 4.3 `npm run lint` passes
- [x] 4.4 `npm run test` passes

#### Manual

- [x] 4.5 Semantic query returns clients matching by meaning, not just exact words
- [x] 4.6 New client create/update triggers background embedding (no `embedding_failed` in logs)
- [x] 4.7 Backfill script runs to completion
- [x] 4.8 Assistant works correctly when `VOYAGE_API_KEY` is absent

### Phase 5: Tests

#### Automated

- [x] 5.1 `npm run test -- src/app/api/ai/chat/route.test.ts` — 2 cases pass (401 + scoping) — dca9b78
- [x] 5.2 `npm run test -- src/lib/ai/context.test.ts` — truncation unit test passes — dca9b78
- [x] 5.3 `npx playwright test playwright/assistant.spec.ts` passes — dca9b78
- [x] 5.4 `npm run lint` passes — dca9b78
- [x] 5.5 `npx tsc --noEmit` passes — dca9b78

#### Manual

- [x] 5.6 Test output confirms Vitest integration tests green and Playwright E2E green — dca9b78
- [x] 5.7 No regressions in other test files — dca9b78

### Phase 6: Conversation History + Named Threads

#### Automated

- [x] 6.1 `npm run db:push` applies conversations migration cleanly
- [x] 6.2 `npx tsc --noEmit` passes
- [x] 6.3 `npm run lint` passes
- [x] 6.4 `npm run test` passes

#### Manual

- [x] 6.5 Opening the panel shows messages from the most recent conversation
- [x] 6.6 Messages persist across page reload
- [x] 6.7 `/assistant` sidebar lists past conversations
- [x] 6.8 Clicking a past thread loads it; New conversation clears and starts fresh
- [x] 6.9 Thread auto-titled from first message; rename and delete work
- [x] 6.10 Mobile thread list opens as sheet/drawer
