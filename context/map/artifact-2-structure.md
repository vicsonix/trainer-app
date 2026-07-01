# Artifact 2 — Structure: Dependencies, Entry Points, Cycles, and Blast Radius

_Source: npx madge --circular + grep verification. 85 files processed._
_Generated: 2026-06-25_

---

## Thin Entry Points

Files with **zero src/ importers** that are nevertheless runtime-critical. Changing any of these has an outsized effect — nothing pulls them in explicitly, but everything depends on them being correct.

| File | How it's loaded | Blast radius if broken |
|------|----------------|----------------------|
| `src/middleware.ts` | Next.js framework intercepts every HTTP request | Every route in the app — auth bypass or redirect loop |
| `src/app/(app)/layout.tsx` | Next.js layout tree (children, not imports) | All 5 protected pages lose their shell, nav, ChatWrapper |
| `src/app/api/ai/chat/route.ts` | HTTP POST `/api/ai/chat` | All chat UI — ChatPanel, assistant page, MobileHeader trigger |
| `src/app/layout.tsx` | Next.js root layout | Global styles and Sonner toaster for the entire app |

These four are the **cienkie wejścia** — narrow doors the entire app passes through, invisible to the import graph.

---

## Hubs (Deep Centers)

Files with the highest number of direct dependents — changing them breaks the most downstream consumers.

### `lib/supabase/server.ts` — widest blast radius in the codebase

**Imported by 13 files across every layer:**
```
app/(app)/layout.tsx
app/(app)/calendar/page.tsx
app/(app)/clients/page.tsx
app/(app)/packages/page.tsx
app/page.tsx
app/actions/auth.ts
app/actions/appointments/index.ts
app/actions/appointments/appointments.test.ts
app/actions/clients/index.ts
app/actions/clients/clients.test.ts
app/actions/conversations/index.ts
app/actions/packages/index.ts
app/api/ai/chat/route.ts
app/api/ai/chat/route.test.ts
```

Changing its export signature (e.g. `createClient()` return type) breaks every Server Component, every Server Action, and the AI route simultaneously. It is the single riskiest file in the project.

**Contract it exposes:**
```ts
createClient(): Promise<SupabaseClient>   // one async factory, called at top of every action/page
```

---

### `lib/utils.ts` — UI foundation

**Imported by 15+ files**, almost exclusively UI components (all `components/ui/*`, NavLink, CalendarNav, calendar views, AppointmentDetailModal). It re-exports the `cn()` class-merge utility from `clsx` + `tailwind-merge`. No logic — pure utility. Low change risk, but touching it rebuilds all UI.

---

### `app/(app)/clients/page.tsx` — accidental type hub (cycle root)

**Imported by 5 sibling components** — not because they need page-level logic but because the `PackageOption` interface is defined here:

```
page.tsx exports: PackageOption
↑ imported by: ClientCard, ClientForm, ClientFormModal, EditClientModal, ClientsClientSection
↓ page.tsx imports: ClientsClientSection
```

This creates 4 reported circular dependencies (see Cycles section). The page is both a data-fetching Server Component and an interface source — two roles that create a forced cycle.

---

### `app/actions/clients/index.ts` — most-depended-on action file

Imported by 5 consumers: `ClientForm`, `ClientFormModal`, `DeleteClientDialog`, `EditClientModal`, `clients.test.ts`. It also has a side-effect dependency on `lib/embeddings.ts` (fire-and-forget embedding generation) that none of its consumers are aware of.

---

### `lib/ai/tools/index.ts` — AI tool aggregator

Single importer (`app/api/ai/chat/route.ts`), but aggregates 4 tool factories via spread merge. A new tool added here is invisible until `makeTools()` is called. A name collision between tool factories silently overwrites the earlier definition with no error.

---

## Full Reverse Dependency Map

> Reading: X → [A, B, C] means A, B, C all import X.

```
lib/supabase/server.ts    → 13 files (see hub section above)
lib/utils.ts              → NavLink, all ui/*, CalendarNav, CalendarView views, AppointmentDetailModal, CreateAppointmentModal, DayView, MobileDayStrip, MonthView, PackageForm, TimeGrid, WeekView (~15 files)
app/actions/clients/index.ts    → ClientForm, ClientFormModal, DeleteClientDialog, EditClientModal, clients.test.ts
app/actions/packages/index.ts   → DeletePackageDialog, EditPackageModal, PackageForm, PackageFormModal
app/actions/appointments/index.ts → AppointmentDetailModal, CreateAppointmentModal, appointments.test.ts
app/actions/auth.ts             → layout.tsx, login/page.tsx, register/page.tsx, MobileHeader.tsx
app/actions/conversations/index.ts → assistant/page.tsx, ChatPanel.tsx
lib/ai/context.ts               → route.ts, route.test.ts, context.test.ts
lib/ai/tools/index.ts           → route.ts
lib/ai/tool-formatters.ts       → ToolCard.tsx
lib/embeddings.ts               → actions/clients/index.ts, route.ts, scripts/backfill-embeddings.ts
lib/logger.ts                   → actions/clients/index.ts, route.ts, lib/ai/context.ts
components/ChatWrapper.tsx      → layout.tsx
components/ChatPanel.tsx        → ChatWrapper.tsx, MobileHeader.tsx
components/ChatButton.tsx       → ChatWrapper.tsx
components/chat/MessageBubble.tsx → ChatPanel.tsx, assistant/page.tsx
components/chat/ToolCard.tsx    → MessageBubble.tsx
components/ui/button.tsx        → ClientEmptyState, CalendarNav, CreateAppointmentModal, AppointmentDetailModal, PackageForm, PackagesClientSection, ClientsClientSection, SubmitButton, dialog, alert-dialog
components/ui/dialog.tsx        → AppointmentDetailModal, CreateAppointmentModal, ClientFormModal, EditClientModal, EditPackageModal, PackageFormModal
app/(app)/clients/page.tsx      → ClientCard, ClientForm, ClientFormModal, ClientsClientSection, EditClientModal (type import — see Cycles)
```

---

## Cycles

`npx madge --circular` found **4 cycles**, all in the clients module:

```
1) ClientCard → EditClientModal → ClientForm → page → ClientsClientSection
2) ClientForm → page → ClientsClientSection → ClientFormModal
3) page → ClientsClientSection → ClientFormModal
4) page → ClientsClientSection
```

**Root cause:** `PackageOption` interface is defined in `clients/page.tsx` and `import type`-d by 4 sibling components. `page.tsx` in turn renders `ClientsClientSection`, which renders those components.

```ts
// page.tsx — line 4
export interface PackageOption {
  id: string
  name: string
  visit_count: number
}
```

**Impact at runtime:** `import type` is erased at compile time — these cycles do not cause a runtime crash. TypeScript handles them correctly. However:
- Tree-shaking tools and bundlers may mis-report them as problems
- Any refactor of `page.tsx` that changes `PackageOption` must touch 4 other files
- The pattern will spread if new types are added to `page.tsx`

**Fix path (low urgency):** Move `PackageOption` (and any future shared client types) to `src/app/(app)/clients/types.ts`. Zero runtime change, eliminates all 4 cycles.

---

## Suspicious / Unexpected Dependencies

### 1. `lib/supabase/client.ts` — never imported

The browser Supabase client (`createBrowserClient`) exists in the codebase but has zero importers in `src/`. The chat UI uses `@ai-sdk/react` → `DefaultChatTransport({ api: '/api/ai/chat' })` — it communicates via HTTP, not direct Supabase. All client-side data fetching goes through Server Components or Server Actions.

This file is either dead code or held for a future real-time / client-side Supabase feature. A new contributor might reach for it expecting it to be the right tool — it currently isn't used anywhere.

### 2. `app/actions/conversations/index.ts` — references tables with no migration

The file is real and implements 5 actions (`createConversation`, `saveMessage`, `loadConversation`, `listConversations`, `deleteConversation`, `renameConversation`). It queries two tables: `conversations` and `conversation_messages`. Neither table has a migration in `supabase/migrations/`. The pgvector migration (`20260605000001_pgvector.sql`) does not create these tables.

Both `ChatPanel.tsx` and `assistant/page.tsx` import from this file — the UI is wired but the DB schema doesn't exist yet. This will throw a Supabase error at runtime.

### 3. `lib/ai/tools/` — tools depend on nothing internal

All four tool files (`appointments.ts`, `clients.ts`, `packages.ts`, `read.ts`) import only from external packages (`ai`, `zod`) and `lib/supabase/server.ts` types. They have no cross-tool imports and no shared schema. This is correct isolation, but it means the `makeTools()` spread in `index.ts` is the only place that can introduce a name collision — there's no tooling to catch it.

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
    ▼
Server Actions (actions/*/index.ts)
    │  'use server' directive              ← Next.js serialization contract
    │  zod .safeParse(formData)            ← validation contract
    │  supabase.from().insert/update/delete← Supabase mutation contract
    ▼
Route Handler (api/ai/chat/route.ts)
    │  buildTrainerContext() → string      ← context string contract
    │  makeTools() → ToolSet              ← AI SDK tool contract
    │  streamText() → UIMessageStream      ← AI SDK streaming contract
    ▼
External Services
    Supabase (PostgreSQL + Auth + RLS)
    Anthropic API (claude-haiku-4-5)
    Voyage AI (voyage-3-lite embeddings)   ← optional; degrades gracefully
```

---

## Blast Radius Summary

| Change | Files directly broken | Indirect victims |
|--------|----------------------|-----------------|
| `lib/supabase/server.ts` signature | 13 files | Entire app |
| `lib/utils.ts` | 15 UI files | All rendered UI |
| `app/(app)/layout.tsx` | 0 importers | All 5 protected pages lose nav + ChatWrapper |
| `app/actions/clients/index.ts` | 5 files | All client CRUD flows |
| `lib/ai/context.ts` | route.ts + 2 tests | AI assistant quality |
| `lib/ai/tools/index.ts` | route.ts | All AI tool calls |
| `PackageOption` in `clients/page.tsx` | 4 sibling components | Client forms and modals |
| `conversations` DB table (missing) | 0 import breakage | Runtime: ChatPanel + assistant page crash on load |
