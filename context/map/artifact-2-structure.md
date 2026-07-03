# Artifact 2 — Structure: Dependencies, Entry Points, Cycles, and Blast Radius

_Source: npx madge --circular (88 files) + grep verification._
_Generated: 2026-07-03_

---

## Thin Entry Points

Files with **zero src/ importers** that are runtime-critical — nothing pulls them in explicitly, but everything depends on them being correct.

| File | How it's loaded | Blast radius if broken |
|------|----------------|----------------------|
| `src/middleware.ts` | Next.js intercepts every HTTP request | Every route — auth bypass or redirect loop |
| `src/app/(app)/layout.tsx` | Next.js layout tree (children, not imports) | All 6 protected pages lose shell, nav, ChatWrapper, ThemeToggle |
| `src/app/api/ai/chat/route.ts` | HTTP POST `/api/ai/chat` | All chat UI — ChatPanel, assistant page, MobileHeader trigger |
| `src/app/layout.tsx` | Next.js root layout | Global styles, Sonner toaster, ThemeProvider for the entire app |

These four are the **narrow doors** — invisible to the import graph, load-bearing for the whole app.

---

## Hubs (Deep Centers)

### `lib/supabase/server.ts` — widest blast radius (16 importers, up from 13)

```
(app)/layout.tsx            (app)/analytics/page.tsx      ← new (S-07)
(app)/calendar/page.tsx     (app)/dashboard/page.tsx      ← new (S-08)
(app)/clients/page.tsx      (app)/packages/page.tsx
app/page.tsx                actions/auth.ts
actions/appointments/index.ts (+ .test)   actions/clients/index.ts (+ .test)
actions/conversations/index.ts            actions/packages/index.ts
api/ai/chat/route.ts (+ .test)
```

Contract — one async factory called at the top of every action/page/route:
```ts
createClient(): Promise<SupabaseClient>
```
Changing its return type or throw behavior breaks every layer simultaneously. Single riskiest file in the project.

### `lib/utils.ts` — UI foundation
Imported by ~15 UI components (`cn()` class-merge). Pure utility, low change risk, but touching it rebuilds all UI.

### `components/stat-card.tsx` — new shared insight primitive (S-07 + S-08)
Imported by **both** `analytics/page.tsx` and `dashboard/page.tsx`. Small, but it is the shared visual contract for both insight surfaces — a prop-shape change ripples to both. Watch it as the insight-layer's `TimeGrid`.

### `(app)/clients/page.tsx` — accidental type hub (cycle root)
Still exports the `PackageOption` interface, `import type`-d by 4 siblings → 4 madge cycles (below). Unchanged since last map.

### `actions/appointments/index.ts` — appointment write hub
Imported by `AppointmentDetailModal`, `CreateAppointmentModal`, and consumed transitively by analytics/dashboard through the DB `status` column (not an import — a data dependency). See "Data-level coupling" below.

### `lib/ai/tools/index.ts` — AI tool aggregator
Single importer (`route.ts`); spread-merges 4 tool factories. A name collision between factories silently overwrites — no error. Unchanged.

---

## Cycles

`npx madge --circular` → **4 cycles, all in the clients module** (unchanged since last map):

```
1) ClientCard → EditClientModal → ClientForm → page → ClientsClientSection
2) ClientForm → page → ClientsClientSection → ClientFormModal
3) page → ClientsClientSection → ClientFormModal
4) page → ClientsClientSection
```

**Root cause:** `PackageOption` defined in `clients/page.tsx` and `import type`-d by 4 siblings. `import type` is erased at compile time → **no runtime crash**, but any change to `PackageOption` fans out to 4 files.

**Fix (low urgency, zero runtime change):** move `PackageOption` to `src/app/(app)/clients/types.ts`.

---

## Data-level coupling (not visible to madge)

madge sees imports. It does **not** see the appointment `status` column, which three surfaces read independently:

```
                 ┌─ calendar views  (filter: .neq status cancelled/no_show for overlap checks)
status column ───┼─ analytics/page   (completed/cancelled/no_show/scheduled counts + revenue)
   (writer:      └─ dashboard/page   (status-derived stat tiles)
 updateAppointmentStatusAction)
```

Only writer: `updateAppointmentStatusAction` (`actions/appointments/index.ts:182`). It calls `revalidatePath('/calendar')` **only** — not `/analytics`, not `/dashboard`. This is the highest-value structural finding in the current tree and the reason the appointment-status path is the chosen deep-dive (Artifact 3).

---

## Suspicious / Unexpected Dependencies

### 1. `lib/supabase/client.ts` — still never imported
The browser Supabase client (`createBrowserClient`) has **zero importers in src/**. All chat UI talks to `/api/ai/chat` over HTTP; all other data goes through Server Components / Server Actions. Dead code, or reserved for a future realtime feature. A new contributor may reach for it wrongly.

### 2. `conversations` tables — NOW RESOLVED (was a trap in the last map)
`actions/conversations/index.ts` queries `conversations` + `conversation_messages`. The last map flagged these as having **no migration** → runtime crash. Migration `20260625000001_conversations.sql` now exists and is committed. The trap is closed **on disk** — verify it is applied to the live Supabase instance.

### 3. `lib/ai/tools/` — correct isolation
Four tool files import only external packages + `supabase/server.ts` types. No cross-tool imports, no shared schema. Only `makeTools()` in `index.ts` can introduce a silent name collision.

---

## Layer Contracts

```
Browser / Client Components
    │  useChat() → POST /api/ai/chat       ← HTTP contract (URL string)
    │  <form action={serverAction}>        ← React Server Action contract
    ▼
Next.js Edge (middleware.ts)
    │  supabase.auth.getUser()             ← Supabase session contract
    ▼
Server Components (pages)
    │  createClient() → supabase queries   ← Supabase query contract
    │  revalidatePath(...)                 ← Next.js cache-invalidation contract  ⚠ status writer only revalidates /calendar
    ▼
Server Actions (actions/*/index.ts)
    │  'use server'                        ← Next.js serialization contract
    │  zod .safeParse(formData)            ← validation contract
    │  supabase.from().insert/update       ← Supabase mutation contract
    ▼
Route Handler (api/ai/chat/route.ts)
    │  buildTrainerContext() → string      ← context string contract
    │  makeTools() → ToolSet               ← AI SDK tool contract
    │  streamText() → UIMessageStream       ← AI SDK streaming contract
    ▼
External Services
    Supabase (PostgreSQL + Auth + RLS)
    Anthropic API (claude-haiku-4-5)
    Voyage AI (voyage-3-lite embeddings)   ← optional; env-gated, degrades gracefully
```

---

## Blast Radius Summary

| Change | Directly broken | Indirect victims |
|--------|----------------|-----------------|
| `lib/supabase/server.ts` signature | 16 files | Entire app |
| `lib/utils.ts` | ~15 UI files | All rendered UI |
| `(app)/layout.tsx` | 0 importers | All 6 protected pages lose nav + ChatWrapper + ThemeToggle |
| `updateAppointmentStatusAction` / `status` column | 0 import breakage | **Calendar + analytics + dashboard silently disagree** (data-level, see above) |
| `components/stat-card.tsx` props | 2 files | Analytics + dashboard tiles |
| `PackageOption` in `clients/page.tsx` | 4 siblings | Client forms and modals |
| `lib/ai/tools/index.ts` | route.ts | All AI tool calls |
