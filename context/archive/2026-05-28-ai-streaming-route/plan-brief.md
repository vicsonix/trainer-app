# AI Streaming Route — Plan Brief

> Full plan: `context/changes/ai-streaming-route/plan.md`

## What & Why

Wire the Anthropic SDK and create the first API route in the codebase — a streaming chat endpoint that accepts a conversation history and a pre-assembled client context string, calls `claude-haiku-4-5`, and returns a Server-Sent Events stream. This is F-01 from the roadmap: a pure foundation that proves SSE streaming works on the Cloudflare Workers + OpenNext stack before S-06 (the full AI assistant slice) is built.

## Starting Point

No API routes exist in `src/app/api/` and the `@anthropic-ai/sdk` package is absent from `package.json`. Middleware already gates all routes except `/login` and `/register`, and the Cloudflare Workers infra (wrangler.toml, OpenNext adapter, `nodejs_compat` flag) is already configured.

## Desired End State

`POST /api/ai/chat` exists, streams `claude-haiku-4-5` output as SSE chunks (`data: {"content":"..."}\n\n`), rejects unauthenticated requests with 401, validates input (non-empty messages array, 8 000-char context cap), and grounds the model with an explicit refusal clause so it cannot fabricate client details. The Cloudflare bundle stays under 3 MiB after adding the SDK.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| LLM provider + model | Anthropic `claude-haiku-4-5` | Cost-efficient ($1/$5 per 1M tokens); resolved 2026-05-29 after switching from OpenAI | Roadmap |
| SDK vs native fetch | `@anthropic-ai/sdk` | Type-safe, auto-handles SSE parsing, consistent with S-06 patterns | Plan |
| Payload shape | `{ messages: Message[], context: string }` | Supports multi-turn chat; context assembly stays in the caller (S-06), keeping this route a thin proxy | Plan |
| Response format | SSE (`text/event-stream`) | Web standard; browser EventSource API works natively; named `error` event available for mid-stream failures | Plan |
| Auth in route | Double-check (Supabase getUser) | Defense in depth for a paid external API call — middleware misconfiguration alone could expose it | Plan |
| Stream error protocol | SSE `event: error` + `data: {...}` | Client can distinguish real errors from empty completions without relying on HTTP status (already 200 when streaming starts) | Plan |
| Input validation | messages non-empty + context ≤ 8 000 chars | Prevents empty-call waste and token-budget overflow; context is silently truncated, not rejected | Plan |
| System prompt | Explicit grounding + refusal clause | PRD business logic rule: "assistant must not present fabricated details as fact" | Plan |
| Prompt caching | `cache_control: { type: 'ephemeral' }` on system block | Reduces cost when the same context is reused across consecutive requests | Plan |
| Bundle gate | Blocking — `wrangler deploy --dry-run` required | Infrastructure risk register explicitly calls this out for F-01; failing post-merge blocks production deploy | Plan |

## Scope

**In scope:**
- Install `@anthropic-ai/sdk` npm package
- Add `ANTHROPIC_API_KEY=` to `.env.example`; document `wrangler secret put` for production
- Create `src/app/api/ai/chat/route.ts` with auth, validation, streaming, and SSE error events
- Bundle size validation via `wrangler deploy --dry-run` as a blocking gate

**Out of scope:**
- Fetching client data from Supabase inside the route (caller assembles context)
- Conversation persistence or session IDs
- Per-user rate limiting
- Retry logic on Anthropic failures
- Vercel AI SDK (adds bundle weight)

## Architecture / Approach

The route is a thin LLM proxy. On POST: verify auth (Supabase `getUser`), validate and truncate input, inject context into a system message with a grounding/refusal clause plus `cache_control: { type: 'ephemeral' }` for prompt caching, stream `claude-haiku-4-5` via the Anthropic SDK async iterator (`anthropic.messages.stream`), and pipe each `content_block_delta` text delta as a JSON-encoded SSE data line. Errors caught inside the stream are emitted as a named `event: error` SSE line before closing the stream. The Anthropic client is instantiated once at module scope for reuse across Workers invocations.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Install SDK + wire env | `@anthropic-ai/sdk` in dependencies; `ANTHROPIC_API_KEY` in `.env.example` | None — straightforward install |
| 2. Create streaming route | Working `POST /api/ai/chat` with auth, SSE, and error events | Edge runtime compatibility with Anthropic SDK async iterator (mitigated by `nodejs_compat` flag) |
| 3. Bundle size gate | Confirmed gzipped bundle < 3 MiB after SDK addition | Anthropic SDK may push bundle over limit — fallback: tree-shake or upgrade to paid Workers |

**Prerequisites:** `ANTHROPIC_API_KEY` obtained and added to `.env.local`; `wrangler login` done for Phase 3 dry-run
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- The Anthropic SDK may push the gzipped bundle past 3 MiB — Phase 3 is the detection gate; mitigation options (dynamic import, paid Workers) are documented in the plan
- SSE streaming on the Cloudflare edge runtime is confirmed supported in `infrastructure.md`, but has not been tested in this specific codebase — Phase 2 manual verification must run under `wrangler dev` / `npm run preview`, not the Next.js dev server

## Success Criteria (Summary)

- `POST /api/ai/chat` with a valid session and non-empty payload streams text chunks ending with `data: [DONE]`
- Same endpoint returns 401 without a session and 400 on an empty messages array
- `wrangler deploy --dry-run` exits 0 with gzipped bundle under 3 MiB
