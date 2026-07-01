# Artifact 3 — Contributors: AI Route Area

_Chosen area: `src/app/api/ai/chat/route.ts` + `src/lib/ai/` (the highest-churn cross-boundary hub)._
_Source: git log --follow -p, diff analysis, research.md, plan-review.md, impl-review.md._
_Generated: 2026-06-25_

---

## Who Works Here

**Solo project — one human, one AI pair.**

| Person | Role | Commits in area |
|--------|------|----------------|
| Victoria (`budziakvictoria@gmail.com`) | Author — owns all decisions, reviews, merges | 8 commits touching route.ts |
| Claude Sonnet 4.6 | AI pair programmer — does the research, generates code, runs plan-review | Co-author on all commits |

Knowledge is fully concentrated in Victoria. The AI pair has produced detailed written documentation (research.md, plan-review.md) that is the authoritative source for *why* things are the way they are. If Victoria is unavailable, these documents are the primary handoff.

---

## Complete Evolution of `route.ts` (8 touches, annotated)

Every touch to the most active file in the codebase, with the decision behind it:

### Touch 1 — `a8aac56` — 2026-05-29 — First version (F-01 p2)

```ts
// Initial shape:
// - Raw @anthropic-ai/sdk (not Vercel AI SDK)
// - Custom SSE: data: ${JSON.stringify({ content })}\n\n
// - Context came from caller: body.context (string, external)
// - Module-level singleton: const anthropic = new Anthropic(...)
// - Prompt caching: cache_control: { type: 'ephemeral' } on system block
```

**Decision logged:** F-01 deliberately avoided Vercel AI SDK due to bundle size risk on Cloudflare Workers free tier (3 MiB gzipped limit). Bare Anthropic SDK was the safe choice.

---

### Touch 2 — `a9cecbc` — 2026-05-30 — Observability added (impl-review finding F3)

```diff
+if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
+log('warn', 'ai_chat_unauthorized')
+log('info', 'ai_chat_context_truncated', { originalLength, truncatedTo })
+log('error', 'ai_chat_stream_error', { message })
```

**Pattern established:** every failure path gets a structured log event. This pattern propagates to all subsequent AI work — `vector_search_failed`, `build_trainer_context_failed`, `embedding_failed` all follow the same `log(level, event_name, payload)` shape.

---

### Touch 3 — `8fdbe29` — 2026-05-30 — Log silent JSON parse failure (impl-review finding F3 continued)

```diff
-  } catch {
+  } catch (err) {
+    log('warn', 'ai_chat_invalid_body', { error: err instanceof Error ? err.message : String(err) })
```

**Pattern:** catch blocks that were swallowing errors silently are always flagged in review. Seen again in vector search (try/catch with log in `dca9b78`).

---

### Touch 4 — `127562b` — 2026-05-30 — CF Workers cold-start fix

```diff
-if (!process.env.ANTHROPIC_API_KEY) throw new Error(...)
-const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
+let _anthropic: Anthropic | null = null
+function getAnthropicClient(): Anthropic {
+  if (!_anthropic) {
+    const apiKey = process.env.ANTHROPIC_API_KEY
+    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
+    _anthropic = new Anthropic({ apiKey })
+  }
+  return _anthropic
+}
```

**Edge case:** module-level `throw` on missing env var breaks Cloudflare Workers. CF Workers instantiates module code at **deploy time**, not at request time. A module-level throw aborts the worker deployment entirely even if the env var is present at runtime. The lazy initializer defers the check to the first POST request. This commit message is terse (`fix: anthropic client`) but the change encodes a CF-Workers-specific constraint.

**This pattern is now gone** — the AI SDK v5 migration (`a437939`) removed the Anthropic SDK singleton entirely (replaced by `anthropic('claude-haiku-4-5')` from `@ai-sdk/anthropic` which handles init internally). But the constraint is still live: any new module-level initialization that reads env vars on this route will hit the same issue.

---

### Touch 5 — `a437939` — 2026-06-04 — AI SDK v5 rewrite (S-06 p1)

The biggest single change to the file. ~60 lines deleted, ~25 added. Three simultaneous shifts:

**1. SDK swap:** `@anthropic-ai/sdk` → `ai` + `@ai-sdk/anthropic`
```ts
// Before: manual SSE ReadableStream, for-await on streamResponse events
// After:  streamText() → createUIMessageStreamResponse()
```
The old SSE format (`data: {"content":"..."}`) is **incompatible** with AI SDK's data stream protocol. This was a clean-cut migration because the `/assistant` page didn't exist yet and ChatPanel hadn't been built. If there had been any existing client reading the old format, this would have been a breaking change requiring a flag or versioned route.

**2. Context moved server-side:**
```ts
// Before: context = body.context (caller's responsibility)
// After:  const context = await buildTrainerContext(supabase, user.id)
```
This fixed a security concern noted in test-plan.md risk #6: the old shape let the client send whatever context it wanted — no trainer-scoping guarantee at the route level.

**3. Language hardcoded to Polish:**
```ts
// p1: "Respond in the same language the trainer uses."
// p2: "Respond in Polish by default; switch to the trainer's language only if they write in a different language."
```
The language instruction changed between p1 and p2 — Polish became the explicit default, not inferred. This is the intended behavior for a Polish-market product.

---

### Touch 6 — `368fa63` — 2026-06-04 — Tools wired (S-06 p2)

```diff
+const tools = makeTools(supabase, user.id)
 const result = streamText({
   ...
+  tools,
 })
```

Minimal diff on route.ts — the bulk of this commit was new files (`lib/ai/tools/*`). The route itself stayed thin; `makeTools()` owns the entire tool surface area.

**Decision noted in commit message:** "Polish confirmation labels for all write tools" — the confirmation UI that appears before write actions executes shows Polish text defined in `lib/ai/tool-formatters.ts`.

---

### Touch 7 — (not a route.ts touch) — `b569677` — 2026-06-05 — UI layer

Route unchanged. The chat panel, floating button, and assistant page were added. The only connection back to route.ts is the `api: '/api/ai/chat'` string in `ChatPanel.tsx:25` and `DefaultChatTransport`.

---

### Touch 8 — `dca9b78` — 2026-06-25 — Vector search added (S-06 p4, uncommitted)

```ts
// New: optional pre-step before buildTrainerContext()
if (process.env.VOYAGE_API_KEY) {
  try {
    // embed last user message → supabase.rpc('match_clients') → vectorResults
  } catch (err) {
    log('warn', 'vector_search_failed', ...)  // silent degradation
  }
}
const context = await buildTrainerContext(supabase, user.id, vectorResults)
```

**Degradation design:** the entire vector search block is behind `process.env.VOYAGE_API_KEY`. If the key is absent (current prod state), code path is skipped entirely. If Voyage API throws, the catch swallows and logs — context is built without reranking. Victoria chose explicit feature-flag-by-env-var over a runtime on/off switch.

**Context size raised here:** `MAX_CONTEXT_CHARS` went from `8_000` (F-01) to `12_000` (S-06 p1) — the increase happened when context assembly moved server-side, because server-side queries include appointment history that doesn't fit in 8K. The value lives in `lib/ai/context.ts:4` and is re-exported from `route.ts:16`.

---

## Recurring Patterns (what Victoria consistently does in this area)

| Pattern | Example | Implication for changes |
|---------|---------|------------------------|
| **Observability at every failure path** | 7 `log()` calls across the route | New error paths need a log event; missing logs are flagged in impl-review |
| **Graceful degradation via env-var gate** | `if (process.env.VOYAGE_API_KEY)` for vector search | Optional integrations are gated, not required. Same approach expected for future optional features |
| **Defense in depth on auth** | `supabase.auth.getUser()` in route even though middleware guards all routes | Intentional double-check. Do not remove the in-route check assuming middleware is sufficient |
| **Context assembled server-side** | `buildTrainerContext(supabase, user.id)` — caller never provides context | Security decision (risk #6). Never accept context from the request body |
| **Tool isolation by domain** | `tools/appointments.ts`, `tools/clients.ts`, etc. — separate files, composed in index.ts | New tools go in the matching domain file, not directly in route.ts |

---

## Key Decisions to Read Before Changing This Area

### 1. `context/changes/ai-assistant/research.md`
The most important document. 400+ lines covering:
- Why AI SDK v5 over v4 (first-class `needsApproval`, `parts`-based rendering)
- Z-index stack (30 for floating button, 40 for panel — below Radix modals at 50)
- Tool inventory rationale (what's exposed, what's deferred — package write tools deferred)
- Why context is assembled server-side (security)
- Vector search architecture: why Voyage AI over OpenAI, dimension choice (512 vs 1536), IVFFlat index tuning, graceful degradation

### 2. `context/changes/ai-assistant/reviews/plan-review.md`
5 findings caught before implementation:

| Finding | What it caught |
|---------|---------------|
| F1 — get_client spec | Visit count with LIMIT 10 was wrong for clients with >10 appointments |
| **F2 — truncation test structural bug** | Mocking `buildTrainerContext` in route.test.ts bypasses truncation (it lives inside context.ts, not route.ts) — the test would pass even if truncation code was deleted |
| **F3 — sendAutomaticallyWhen missing** | Without this option in `useChat()`, user clicks "Approve" → nothing happens. The approval response sits locally and the conversation stalls |
| F4 — "NOT modifying actions" was wrong | clients/index.ts is modified to add embedding side-effect — the "out of scope" statement was incorrect |
| F5 — data-testid not specified | `data-testid="typing-indicator"` needed in ChatPanel for E2E test to work |

**F2 and F3 are the most important** — F2 is a test correctness trap (test passes but doesn't protect the risk), F3 is a silent runtime bug in the approval flow.

### 3. `context/archive/2026-05-28-ai-streaming-route/reviews/impl-review.md`
F-01 impl-review. The Cloudflare Workers cold-start issue (Touch 4 above) was caught here — the module-level throw pattern. This review also established the `.wrangler-dry-run/` gitignore requirement.

---

## What's Pending / Not Yet Closed

From `plan-review.md` and current working tree:

| Item | Status | Risk if ignored |
|------|--------|----------------|
| `supabase/migrations/20260605000001_pgvector.sql` | Uncommitted, not on prod | `match_clients` RPC doesn't exist on prod → route silently falls back to keyword (no crash, but no vector search) |
| `conversations` + `conversation_messages` tables | Defined in `actions/conversations/index.ts`, no migration | ChatPanel and assistant/page crash at runtime when trying to load conversation list |
| Package write tools | Explicitly deferred in research.md | Not missing — intentionally out of scope for S-06 |
| Conversation history (Phase 6) | Was added to plan during plan-review as scope addition | The `conversations` action file exists and is imported — this is partially implemented without DB schema |

---

## Knowledge Concentration Risk

This entire area was designed and built by one person in a 3-week burst (2026-05-29 → 2026-06-25). The institutional knowledge lives in:

1. Victoria's head
2. `context/changes/ai-assistant/research.md` — architectural decisions
3. `context/changes/ai-assistant/plan-review.md` — pre-implementation review findings
4. The diff history itself (each commit message references the plan phase)

There is no other person who has touched this code. The AI pair programmer (Claude) contributed code but holds no persistent memory between sessions.

**Before making any change to route.ts or lib/ai/:** read research.md section 2 (API compatibility), section 3 (tool ownership model), and plan-review.md findings F2 and F3 in full.
