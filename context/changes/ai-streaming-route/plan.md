# AI Streaming Route Implementation Plan

## Overview

Wire the Anthropic SDK and create the first API route in the codebase: a streaming chat endpoint at `POST /api/ai/chat` that accepts a conversation history and a pre-assembled client context string, calls `claude-haiku-4-5`, and returns a Server-Sent Events stream. This is a pure foundation — it does not fetch Supabase client data itself; that assembly happens in S-06.

## Current State Analysis

- `src/app/api/` does not exist — this is the first Route Handler in the codebase
- `@anthropic-ai/sdk` package is absent from `package.json`
- Middleware at `src/middleware.ts` already gates all routes (except `/login`, `/register`) — the new route is protected automatically, but the route also performs its own auth check (defense in depth)
- `src/lib/supabase/server.ts` `createClient()` is the established pattern for server-side Supabase access
- `src/lib/logger.ts` (Axiom) is the established logging layer
- Infrastructure risk register explicitly flags: "validate bundle size with `wrangler deploy --dry-run` before merging" — this plan treats it as a blocking gate

## Desired End State

`POST /api/ai/chat` exists and:
- Accepts `{ messages: Message[], context: string }` where `Message = { role: 'user' | 'assistant', content: string }`
- Returns `text/event-stream` with chunks formatted as `data: <json>\n\n`, a final `data: [DONE]\n\n`, and `event: error\ndata: <json>\n\n` on failure
- Rejects unauthenticated requests with 401 before touching Anthropic
- Rejects requests with an empty `messages` array with 400
- Silently truncates `context` to 8 000 characters if it exceeds the cap
- Grounds the model with an explicit refusal clause in the system prompt
- Bundle size (gzipped) stays under the 3 MiB Cloudflare free-tier limit after adding the SDK

### Key Discoveries

- `src/middleware.ts:50` — matcher excludes `_next/static`, `_next/image`, and image assets, but the `/api/` path IS covered by the matcher, so auth redirect applies
- `src/lib/supabase/server.ts` — `createClient()` is `async`, returns a Supabase client with cookie plumbing; call `supabase.auth.getUser()` to get the authenticated user
- `infrastructure.md` — SSE streaming confirmed as a first-class pattern with no duration limit on Cloudflare Workers; `nodejs_compat` flag is already set in `wrangler.toml`
- `wrangler.toml` — `compatibility_flags = ["nodejs_compat"]` is present, which is required for the Anthropic SDK's Node.js stream internals

## What We're NOT Doing

- Fetching client data from Supabase inside this route — the caller assembles context; this route is a thin LLM proxy
- Implementing conversation persistence or session IDs — single-request stateless call
- Rate limiting per user — deferred to S-06 or a later hardening slice
- Retry logic on Anthropic failures — let errors propagate as SSE error events; retries belong in the client
- Using the Vercel AI SDK (`ai` package) — would add unnecessary bundle weight

## Implementation Approach

Three phases in dependency order:
1. Install the SDK and wire the environment variable so subsequent phases have the key available locally
2. Create the route with all validation, streaming, and error-handling logic
3. Build the Cloudflare Workers bundle and run a dry-deploy to confirm the 3 MiB limit is not breached

The Anthropic client is instantiated once at module scope (outside the handler) so it is reused across invocations on the same Worker instance.

## Critical Implementation Details

**SSE chunk encoding** — `data:` lines must not contain raw newlines; encode each chunk's text content as JSON: `data: {"content":"chunk text"}\n\n`. The client parses `JSON.parse(line.slice(5)).content`. This avoids SSE framing bugs when model output contains newlines.

**Context truncation placement** — truncate `context` _before_ building the system prompt, not after; the `MAX_CONTEXT_CHARS` constant must be exported so S-06 can communicate the limit to users.

**Anthropic streaming on edge runtime** — use `anthropic.messages.stream({ ... })` and iterate with `for await (const event of streamResponse)`. Filter for `event.type === 'content_block_delta' && event.delta.type === 'text_delta'` to extract text. Do NOT use `.toReadableStream()` — it targets Node.js streams, not the Web Streams API used by the Workers runtime.

**Anthropic SDK vs OpenAI SDK differences**:
- System prompt is a separate `system` parameter (array of content blocks), NOT a `role: 'system'` message
- `max_tokens` is required (not optional) — use `1024`
- Streaming events use `event.type === 'content_block_delta'` + `event.delta.type === 'text_delta'` → `event.delta.text`
- Prompt caching: add `cache_control: { type: 'ephemeral' }` to the system prompt block to cache it across requests with the same context

---

## Phase 1: Install SDK + Wire Environment

### Overview

Install the Anthropic npm package and establish the environment variable convention so the key is available for local development and documented for production.

### Changes Required

#### 1. Install Anthropic SDK

**File**: `package.json` (via `npm install`)

**Intent**: Add `@anthropic-ai/sdk` as a runtime dependency.

**Contract**: Run `npm install @anthropic-ai/sdk` from the project root. The package version that lands in `package-lock.json` is the implementation source of truth.

#### 2. Add API key placeholder to `.env.example`

**File**: `.env.example`

**Intent**: Follow the same convention as `NEXT_PUBLIC_SUPABASE_URL` — add a blank placeholder so the next developer (or agent) knows the variable must be set.

**Contract**: Add one line: `ANTHROPIC_API_KEY=`

#### 3. Document production secret wiring

**File**: `context/changes/ai-streaming-route/plan.md` (this file — no code change)

**Intent**: The production key is a Cloudflare Workers secret, not a build-time var. Document the command so it isn't forgotten at deploy time.

**Contract**: Run `wrangler secret put ANTHROPIC_API_KEY` once before the first production deploy. This stores the key encrypted in Cloudflare's secret store; it is read at runtime via `process.env.ANTHROPIC_API_KEY` inside the Worker.

### Success Criteria

#### Automated Verification

- `npm install` completes without errors and `@anthropic-ai/sdk` appears in `package.json` `dependencies`
- `npm run build` (Next.js build) passes — confirms the SDK is importable in the Next.js build graph
- `npm run lint` passes

#### Manual Verification

- `.env.example` contains `ANTHROPIC_API_KEY=` alongside the Supabase vars
- Developer has added their real key to `.env.local` (not committed)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 2. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Create the Streaming API Route

### Overview

Create `src/app/api/ai/chat/route.ts` — the POST handler that authenticates the caller, validates input, builds the system prompt, streams `claude-haiku-4-5` output as SSE, and emits structured error events on failure.

### Changes Required

#### 1. Create the route handler

**File**: `src/app/api/ai/chat/route.ts`

**Intent**: Implement the POST handler as a Next.js App Router Route Handler. The handler owns: auth check, input validation, context truncation, system-prompt assembly, Anthropic streaming call, and SSE framing.

**Contract**:

- Import `log` from `@/lib/logger` at the top of the file
- Export `async function POST(request: NextRequest): Promise<Response>`
- Auth: call `createClient()` → `supabase.auth.getUser()` → `log('warn', 'ai_chat_unauthorized')` → return `new Response('Unauthorized', { status: 401 })` if `!user`
- Parse body: destructure `{ messages, context }` from `request.json()`; wrap in try/catch → 400 on parse failure
- Validate: `messages` must be a non-empty array → 400 with descriptive message if not; `context` is a string (default `''`). Individual message field types (role enum, content string) are NOT validated at the route layer — the Anthropic SDK enforces the schema and throws on invalid types; the stream catch block handles this as an SSE error event.
- Truncate: record `originalContextLength = context.length`; `context = context.slice(0, MAX_CONTEXT_CHARS)` where `MAX_CONTEXT_CHARS = 8000` (exported constant); if truncated, `log('info', 'ai_chat_context_truncated', { originalLength, truncatedTo: MAX_CONTEXT_CHARS })`
- System prompt: `"You are a personal fitness trainer assistant. You have access to the following client information:\n\n{context}\n\nAnswer questions based ONLY on the information provided above. If the answer is not in the client data, say so clearly. Do not invent or assume any details about the client."`
- Anthropic call: `anthropic.messages.stream({ model: 'claude-haiku-4-5', max_tokens: 1024, system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }], messages })`
- Stream: wrap in `new ReadableStream({ async start(controller) { ... } })`; for each event where `event.type === 'content_block_delta' && event.delta.type === 'text_delta'`, enqueue `data: ${JSON.stringify({ content: event.delta.text })}\n\n` (skip empty text); after the loop, enqueue `data: [DONE]\n\n` and `controller.close()`
- Errors mid-stream: catch inside the `start` callback; `log('error', 'ai_chat_stream_error', { message })`; enqueue `event: error\ndata: ${JSON.stringify({ message })}\n\n` then `controller.close()`
- Return `new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })`
- Guard: `if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')` at module scope before the constructor — fails fast at Worker startup if the secret is missing rather than mid-stream during a user request
- Instantiate `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` once at module scope

### Success Criteria

#### Automated Verification

- `npm run build` passes (Next.js build includes the new route without type errors)
- `npm run lint` passes
- `npm run test` passes (existing tests unaffected — no new tests required for this foundation route; integration testing is manual)

#### Manual Verification

- `npm run preview` (opennextjs-cloudflare preview) starts without errors; route appears in the Wrangler output
- `curl -X POST http://localhost:8787/api/ai/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"What are this client'\''s goals?"}],"context":"Client: Jan Kowalski. Goals: lose 10kg. Notes: knee injury, avoid squats."}'` — with a valid session cookie — returns SSE chunks and ends with `data: [DONE]`
- Same curl without a session cookie returns `401 Unauthorized`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 3. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Bundle Size Gate

### Overview

Build the Cloudflare Workers bundle and run a dry-deploy to confirm the Anthropic SDK does not push the gzipped output past the 3 MiB free-tier limit. This is a blocking gate — do not merge until it passes.

### Changes Required

No code changes in this phase. This phase is verification-only.

### Success Criteria

#### Automated Verification

- `npm run build:worker` completes without errors (runs `opennextjs-cloudflare build`)
- `wrangler deploy --dry-run` exits with code 0 and the reported gzipped bundle size is **under 3 MiB**

#### Manual Verification

- If the bundle exceeds 3 MiB: evaluate tree-shaking options (e.g., dynamic import of the Anthropic client) OR upgrade to Cloudflare Workers paid tier ($5/month) and document the decision in `context/foundation/infrastructure.md`
- Confirm `wrangler secret put ANTHROPIC_API_KEY` is documented and ready to run before the first production deploy

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before closing the slice. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests

None required for this foundation route — the route is a thin integration adapter. Testing it in isolation (mocking Anthropic) adds mock-maintenance cost with little safety return. Integration testing is the right level.

### Integration Tests

None automated in v1. The manual verification steps in Phase 2 serve as the integration test suite.

### Manual Testing Steps

1. Start preview: `npm run preview`
2. Open browser DevTools → Network tab
3. POST to `http://localhost:8787/api/ai/chat` with a valid session cookie, example payload, and observe SSE chunks arriving in the response stream
4. Repeat without a session cookie — confirm 401 response
5. Send payload with `messages: []` — confirm 400 response
6. Send payload with `context` of 9000+ characters — confirm it is accepted (truncated silently, not rejected)

## Performance Considerations

- The Anthropic client is instantiated once at module scope — not per-request. This avoids per-invocation constructor overhead on the Workers runtime.
- SSE keeps the HTTP connection open for the duration of the stream. Cloudflare Workers has no duration limit for SSE (confirmed in `infrastructure.md`). No keep-alive ping is needed.
- `claude-haiku-4-5` is Anthropic's fastest and most cost-efficient model — $1/$5 per 1M input/output tokens; appropriate for real-time trainer use.
- Prompt caching (`cache_control: { type: 'ephemeral' }` on the system prompt) reduces cost when the same context string is reused across consecutive requests.

## Migration Notes

No database changes. No existing routes affected.

## References

- Roadmap: `context/foundation/roadmap.md` — F-01
- Infrastructure risk register: `context/foundation/infrastructure.md` — "3 MiB bundle limit" entry
- Supabase server client: `src/lib/supabase/server.ts`
- Logger: `src/lib/logger.ts`
- Middleware: `src/middleware.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Install SDK + Wire Environment

#### Automated

- [x] 1.1 `npm install` completes; `@anthropic-ai/sdk` in `package.json` dependencies — ea32251
- [x] 1.2 `npm run build` passes — ea32251
- [x] 1.3 `npm run lint` passes — ea32251

#### Manual

- [x] 1.4 `.env.example` contains `ANTHROPIC_API_KEY=` — ea32251
- [x] 1.5 Real key added to `.env.local` (not committed) — ea32251

### Phase 2: Create the Streaming API Route

#### Automated

- [x] 2.1 `npm run build` passes (new route included, no type errors) — a8aac56
- [x] 2.2 `npm run lint` passes — a8aac56
- [x] 2.3 `npm run test` passes (existing tests unaffected) — a8aac56

#### Manual

- [x] 2.4 `npm run preview` starts without errors; route present in output — a8aac56
- [x] 2.5 curl with valid session cookie returns SSE chunks + `[DONE]` — a8aac56
- [x] 2.6 curl without session cookie returns 401 — a8aac56

### Phase 3: Bundle Size Gate

#### Automated

- [x] 3.1 `npm run build:worker` exits 0 — 9f30b9c
- [x] 3.2 `wrangler deploy --dry-run` exits 0; gzipped bundle < 3 MiB — 9f30b9c

#### Manual

- [x] 3.3 Bundle size confirmed under limit (or upgrade decision documented) — 9f30b9c
- [x] 3.4 `wrangler secret put ANTHROPIC_API_KEY` documented and ready for production — 9f30b9c
