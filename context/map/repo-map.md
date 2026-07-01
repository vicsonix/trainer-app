# Repo Map

_Synthesized from: git log analysis (85 files, co-change pairs), madge dependency graph, diff-level contributor review._
_Generated: 2026-06-25. Active branch: `feature/ai-assistant`._

---

## What this project is

Solo trainer management app. One contributor (Victoria), AI pair on every commit. Stack: Next.js 16 App Router, Supabase (auth + PostgreSQL + RLS), Cloudflare Workers (via OpenNext), Vercel AI SDK v5 + Anthropic claude-haiku-4-5.

Six slices shipped (S-01 through S-05, F-01). One in progress (S-06 ai-assistant, p4+p5 uncommitted).

---

## The four narrow doors

These files are loaded by the framework, not imported by any `src/` file. The import graph doesn't see them. The entire app passes through them.

| File | Loaded by | If broken |
|------|-----------|-----------|
| `src/middleware.ts` | Next.js, every request | Auth bypass or infinite redirect. Untouched since S-01 (2026-05-26) |
| `src/app/(app)/layout.tsx` | Next.js layout tree | All 5 protected pages lose nav, ChatWrapper, auth check |
| `src/app/api/ai/chat/route.ts` | HTTP POST `/api/ai/chat` | Entire chat UI goes dark — ChatPanel, assistant page, MobileHeader trigger |
| `src/app/layout.tsx` | Next.js root layout | Global styles and toast provider gone for the whole app |

---

## The two widest blast radii

**`src/lib/supabase/server.ts`** — imported by 13 files spanning every layer: layout, all pages, every server action, the AI route, and all integration tests. Its contract is one line:
```ts
createClient(): Promise<SupabaseClient>
```
Changing the return type or making it throw differently breaks the entire app simultaneously.

**`src/lib/utils.ts`** — imported by 15+ UI components. Pure `cn()` utility. Low change risk but rebuilds all UI on touch.

---

## The hottest file

`src/app/api/ai/chat/route.ts` — 7 commits, more than any other file. Every major AI decision landed here. It crossed the runtime+build boundary in two different commits (SDK deps changed alongside route logic). It is uncommitted on the active branch today.

Its evolution in one line per touch:
```
a8aac56  2026-05-29  Born: manual SSE, @anthropic-ai/sdk, context from caller
a9cecbc  2026-05-30  Added: log() at every failure path (pattern for whole area)
8fdbe29  2026-05-30  Fixed: silent JSON parse catch
127562b  2026-05-30  Fixed: CF Workers cold-start — module-level throw breaks deploy
a437939  2026-06-04  Rewritten: AI SDK v5, context server-side, language → Polish
368fa63  2026-06-04  Added: makeTools() wired
dca9b78  2026-06-25  Added: vector search behind VOYAGE_API_KEY gate (uncommitted)
```

The CF Workers constraint (`127562b`) is worth memorizing: **module-level code that reads env vars and throws will abort the Workers deployment**, because module code runs at deploy time, not per-request. The pattern was removed in the AI SDK v5 rewrite but the constraint is still live for anything added at module scope.

---

## Hidden hub: `TimeGrid.tsx`

`src/app/(app)/calendar/TimeGrid.tsx` has no special status in the import graph — it depends on `types.ts`, `dates.ts`, `eventPositioning.ts`, `useLongPress.ts`. But co-change analysis (git, not imports) shows it moved with every other calendar file: page.tsx (3×), CalendarView (3×), MonthView (3×), WeekView (2×). It is the rendering core the calendar views converge on. It does not announce itself as a hub.

**Before touching any calendar view: check TimeGrid first.**

---

## Four cycles, one root cause

`npx madge --circular` found 4 cycles, all in `src/app/(app)/clients/`:

```
page.tsx → ClientsClientSection → ClientFormModal → page.tsx
page.tsx → ClientsClientSection → ClientCard → EditClientModal → ClientForm → page.tsx
```

Root cause: `PackageOption` interface lives in `page.tsx` (line 4) and is `import type`-d by 4 sibling components. Runtime-safe (`import type` is erased), but `page.tsx` now plays two roles — Server Component and shared type source — and every change to `PackageOption` fans out to 4 files.

Fix when convenient: move `PackageOption` to `src/app/(app)/clients/types.ts`. Zero runtime change.

---

## Two things that look wired but aren't

**`src/app/actions/conversations/index.ts`** is imported by `ChatPanel.tsx` and `assistant/page.tsx`. It queries `conversations` and `conversation_messages`. Neither table has a migration. Both consumers will throw a Supabase error at runtime the moment a user opens the chat panel. This is Phase 6 of S-06 — added to scope during plan-review but the DB half wasn't committed.

**`src/lib/supabase/client.ts`** (`createBrowserClient`) has zero importers in `src/`. All chat UI communicates via HTTP to the API route; there is no direct client-side Supabase access. The file exists but is currently dead code.

---

## What to read before changing the AI area

All three documents are in `context/changes/ai-assistant/`:

| Document | What it contains |
|----------|-----------------|
| `research.md` | Why AI SDK v5 (not v4), tool inventory rationale, why context is server-side (security risk #6), vector search architecture, z-index stack |
| `reviews/plan-review.md` | **F2**: truncation test mocks away the thing it's testing — passes even if truncation is deleted. **F3**: missing `sendAutomaticallyWhen` in `useChat()` silently stalls tool approval flow |
| `context/archive/2026-05-28-ai-streaming-route/reviews/impl-review.md` | CF Workers cold-start issue; `.wrangler-dry-run/` gitignore requirement |

F2 and F3 from plan-review are the most operationally dangerous findings in the codebase — both are silent (no crash, no test failure, wrong behavior).

---

## Before any significant change: the short checklist

```
□ Touching middleware.ts or supabase/server.ts?
  → Full regression across auth + every page + every action.

□ Touching (app)/layout.tsx?
  → NavLink, ChatWrapper, MobileHeader, auth redirect all change together.

□ Touching any calendar component?
  → Check TimeGrid.tsx — it co-moves with everything in that module.

□ Touching route.ts or lib/ai/?
  → Read research.md §2 (API compat) and plan-review F2 + F3.
  → Do not add module-level env-var reads that throw (CF Workers cold-start).
  → Do not accept context from the request body (security, risk #6).
  → New tools go in the domain file under lib/ai/tools/, not in route.ts.

□ Adding a new optional external integration?
  → Gate it behind process.env.KEY; degrade gracefully in the catch.

□ Merging feature/ai-assistant?
  → Apply supabase/migrations/20260605000001_pgvector.sql to prod first.
  → Create conversations + conversation_messages tables before ChatPanel ships.
```

---

## Stable areas (low risk)

These files have not changed since the slice that introduced them and have no active work nearby:

| File / Area | Last touched | Note |
|---|---|---|
| `src/middleware.ts` | 2026-05-26 (S-01) | Auth gate — correct by inertia, sensitive by nature |
| `src/lib/supabase/{client,server}.ts` | 2026-05-19 (scaffold) | Foundation; never changed |
| `src/app/actions/appointments/` | 2026-06-04 (S-04) | Complete; tests pass |
| `src/app/actions/packages/` | 2026-05-30 (S-02) | Complete; tests pass |
| `src/app/(app)/calendar/` (excluding TimeGrid) | 2026-06-04 (S-05) | Done; badge fixes were the last touch |
