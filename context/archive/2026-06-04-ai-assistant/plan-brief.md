# AI Assistant (S-06) — Plan Brief

> Full plan: `context/changes/ai-assistant/plan.md`
> Research: `context/changes/ai-assistant/research.md`

## What & Why

Build the AI assistant that is the second half of the north-star outcome (S-05 proved "one tap for full context"; S-06 proves "natural language synthesis"). The trainer asks questions and issues commands via chat — the assistant answers from real client data and performs write operations after a confirmation step. Without this, the product is indistinguishable from a notes app.

## Starting Point

F-01 delivered a working streaming route at `src/app/api/ai/chat/route.ts` (bare Anthropic SDK, custom SSE format) and the nav already links to `/assistant`. No UI client exists yet — the route migration is a clean cut with no existing callers to coordinate.

## Desired End State

A floating chat button appears on every authenticated page, opening a slide-in panel. The trainer can ask "how many sessions does Anna have left?" and get an accurate answer, or say "book a session with Jan on Friday at 10am" and confirm the booking with one tap. The `/assistant` page offers the same interface full-screen. Client data is semantically indexed so natural-language queries match by meaning, not just keywords.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| AI SDK version | Vercel AI SDK v5 + `@ai-sdk/anthropic` | First-class `needsApproval` tool approval; cleaner streaming protocol than manual SSE | Research |
| Tool confirmation | `needsApproval: true` structural pattern | `execute` is physically blocked until user approves — stronger than a prompt instruction | Research |
| Write tool scope | All 10: appointments × 4, clients × 3, packages × 3 | User explicitly requested package CRUD parity with the UI | Plan |
| Read tool scope | 4: `list_clients`, `list_appointments`, `get_stats`, `get_client` (full profile + live counters) | `get_client` needed to answer "how many sessions left?" without a second tool call | Plan |
| Remaining visits formula | `visit_count − completed − scheduled` | Matches `calendar/page.tsx:74` exactly — both `completed` and `scheduled` consume slots | Research |
| Tool errors | Structured error object → AI explains naturally | Consistent chat UX; model interprets the error and responds in Polish | Plan |
| Confirmation UX | Human-readable Polish summary per tool | Trainer reads it in 2s; `delete_client` gets a destructive red variant | Plan |
| Vector search | Supabase pgvector + Voyage AI voyage-3-lite (512 dims, free tier) | Semantic search without an SDK; degrades gracefully to full client list if key absent | Research |
| Context limit | 12 000 chars | Fits ~10 full client profiles without truncation at current scale | Plan |
| Model | claude-haiku-4-5 (keep) | Supports tool use; upgrade to Sonnet if multi-step reliability is insufficient | Plan |
| Testing | Phase 5 in-plan (Vitest + Playwright) | Risks #1 and #6 from test-plan are high; shipping write tools without tests is too risky | Plan |

## Scope

**In scope:**
- `/api/ai/chat` migration to AI SDK v5 streaming
- 14 tool definitions (10 write with confirmation, 4 read)
- `get_client` read tool: full profile + package info + remaining visits + last 5 appointments
- Human-readable Polish confirmation cards per write tool
- `ChatButton` (floating, z-30) + `ChatPanel` (slide-in, z-40) in layout
- `/assistant` full-screen page
- Supabase pgvector migration + Voyage AI embeddings
- Vitest integration + Playwright E2E for test-plan Phase 3

**Out of scope:**
- Rate limiting on the AI route (excluded in test-plan §7)
- Auth tools (login/register/logout)
- AI-proposed calendar slots (roadmap §Parked)
- `training_goals` column (use `interview_notes` only)

## Architecture / Approach

```
ChatWrapper (client boundary in layout.tsx)
  ├── ChatButton (fixed bottom-right, hidden on /assistant)
  └── ChatPanel (useChat → /api/ai/chat)
        └── MessageBubble
              └── ToolCard (approval-requested | output-available | output-denied)

/assistant/page.tsx (same useChat, full-screen)

POST /api/ai/chat
  1. Auth (getUser)
  2. Vector search (embed last message → match_clients RPC) [Phase 4]
  3. buildTrainerContext (Supabase queries, 12 000 char cap)
  4. streamText (claude-haiku-4-5 + 14 tools)
  5. createUIMessageStreamResponse

src/lib/ai/tools.ts — makeTools(supabase, userId) factory
src/lib/ai/context.ts — buildTrainerContext
src/lib/ai/tool-formatters.ts — Polish confirmation labels
src/lib/embeddings.ts — Voyage AI raw fetch [Phase 4]
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. SDK migration + route | Working `/api/ai/chat` with AI SDK v5, server-side context | Bundle > 3 MiB gate |
| 2. Tool definitions | All 14 tools in stream; `get_client` with live visit counters | Remaining-visits formula must match calendar/page.tsx exactly |
| 3. UI layer | End-to-end chat UX: panel, button, tool cards, `/assistant` page | Mobile layout (button above bottom nav, panel clears nav) |
| 4. Vector search | Semantic client search; pgvector migration + embeddings | Voyage API key wiring; backfill of existing clients |
| 5. Tests | test-plan Phase 3 coverage (risks #1 and #6) | Mock fidelity for route handler tests |
| 6. Conversation history | Persistent named threads in Supabase; thread-list sidebar on `/assistant` | UIMessage JSONB serialization; mobile thread sheet |

**Prerequisites:** `feature/ai-assistant` branch, F-01 merged (done), S-04 data in DB, Cloudflare plan upgrade if bundle gate fails  
**Estimated effort:** ~5–8 sessions across 6 phases
