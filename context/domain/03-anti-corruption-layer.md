---
title: Anti-Corruption Layer — Supabase Isolation
created: 2026-07-03
type: refactor-plan
---

# Anti-Corruption Layer — Isolating the Supabase Dependency

> Product of this artifact: a **refactor PLAN**, not implementation. No production code is
> modified. Builds on `01-domain-distillation.md` / `02-invariant-aggregate-refactor.md`.
> Every `file:line` is verified.

---

## Step 0 — Context

- **Docs:** `context/foundation/tech-stack.md` frames Supabase as swap-in **managed infrastructure** — *"Supabase is **added post-scaffold** to provide managed PostgreSQL, built-in email+password auth (covering FR-001/002 without writing auth from scratch), and storage — **eliminating operational overhead**"* (`tech-stack.md:36`). It is described as a convenience layer, i.e. exactly the kind of thing a domain should not be welded to.
- **Stack / layers** (`CLAUDE.md`): Next.js App Router + Supabase. Layers present: persistence (`src/lib/supabase/*`), edge (`src/middleware.ts`), server actions (`src/app/actions/*`), API route (`src/app/api/ai/chat`), AI layer (`src/lib/ai/*`), read models (`src/app/(app)/**/page.tsx`), scripts (`src/scripts/*`). **There is no domain/persistence port layer** — callers talk to the Supabase SDK directly.
- **External deps** (`package.json:22-42`): the candidates that cross layer boundaries are `@supabase/supabase-js` + `@supabase/ssr`, `ai` + `@ai-sdk/*`, and `@internationalized/date`.

---

## Step 1 — Leaking dependencies identified

### Candidate A — `@supabase/*` (the data + auth SDK)

**Files that directly `import '@supabase/*'` today (11):**

| File | How it leaks |
|---|---|
| `src/lib/supabase/server.ts:1` | `createServerClient` factory (persistence) |
| `src/lib/supabase/client.ts:1` | `createBrowserClient` factory — **unused / dead** (no importer; grep for `@/lib/supabase/client` → 0 hits) |
| `src/middleware.ts:1,7,30` | server SDK + `supabase.auth.getUser()` in the **edge** runtime |
| `src/app/actions/clients/index.ts:5,12` | **`SupabaseClient` type in a function signature** |
| `src/lib/ai/context.ts:1,7` | **`SupabaseClient` in `buildTrainerContext` signature** |
| `src/lib/ai/tools/read.ts:3,5` | **`SupabaseClient` in `makeReadTools` signature** |
| `src/lib/ai/tools/clients.ts:3,15` | **`SupabaseClient` in signature** |
| `src/lib/ai/tools/appointments.ts:4,25` | **`SupabaseClient` in signature** |
| `src/lib/ai/tools/packages.ts:3,11` | **`SupabaseClient` in signature** |
| `src/lib/ai/tools/index.ts:1,7` | **`SupabaseClient` in `makeTools` signature** |
| `src/scripts/backfill-embeddings.ts` | direct SDK use |

**Plus the transitive surface** — every file that calls `createClient()` from `@/lib/supabase/server` and then hand-writes `supabase.from('…')` queries: all read-model pages (`calendar/page.tsx`, `clients/page.tsx`, `analytics/page.tsx`, `dashboard/page.tsx`, `packages/page.tsx`), the remaining actions (`appointments/index.ts`, `packages/index.ts`, `auth.ts`, `conversations/index.ts`), and `api/ai/chat/route.ts`. These "know" Supabase's **query DSL and row shapes** even though they don't import the type name.

**Duplicated reconstruction of the library's row shapes** (a Step-1 signal): each read model re-declares Supabase's row types and casts raw results — e.g. `ApptRow`/`ClientRow` + `as unknown as ApptRow[]` (`calendar/page.tsx:5-24,51-52`), independent `ApptRow`/`PackageRow`/`ClientRow` in `analytics/page.tsx:34-37`. The SDK's untyped rows are re-typed by hand in every screen.

### Candidate B — `ai` / `@ai-sdk/*` (LLM SDK)

- `tool` used in `ai/tools/{read,packages,clients,appointments}.ts:1`.
- **Library type in a wire/persistence contract:** `saveMessageAction(conversationId, message: UIMessage)` — `UIMessage` from `ai` is the parameter of a persisted-conversation action (`actions/conversations/index.ts:3,26`).
- Same type on the client: `ChatPanel.tsx:5`, `chat/MessageBubble.tsx:3`, `assistant/page.tsx:5`, and server route `api/ai/chat/route.ts:7`. → `UIMessage` genuinely crosses the client/server boundary.

### Candidate C — `@internationalized/date`

- **Verbatim duplicated reconstruction:** `computeTimes(date, start_time, tz, duration)` using `parseDateTime` + `toZoned` is copy-pasted in **two** write paths — `appointments/index.ts:4,45-51` and `ai/tools/appointments.ts:3,6-12`.
- `CalendarDate` spread across ~8 calendar UI files + `calendar/utils/dates.ts:1`.

---

## Step 2 — Classification & selection of #1

| Axis | A · `@supabase/*` | B · `ai` SDK | C · `@internationalized/date` |
|---|---|---|---|
| (a) Layers / files touched | **Persistence + edge + actions + API + AI + read models + scripts** — 11 direct + ~10 transitive | AI route + tools + UI + 1 wire contract (~7) | 2 write paths (dup) + ~9 UI (~11) |
| (b) Cost / risk to replace today | **Extreme** — it is the entire data store **and** the auth/session mechanism (`middleware.ts:30`) **and** tenant isolation via RLS `auth.uid()` (`schema.sql:52-62`) | High, but the AI feature is intrinsically LLM-coupled | Moderate — pure date math, narrow surface |
| (c) Docs declare it swappable? (intent-vs-code) | **Yes** — `tech-stack.md:36` frames it as replaceable managed infra "eliminating operational overhead"; code welds domain signatures to it | No explicit swap intent | No |
| Library type in domain/wire signatures? | **Yes — 7 signatures** | Yes — 1 wire contract | Types stay local to date math |

**Selected #1: `@supabase/*`.** It is worst on every axis that matters: it bleeds through the most layers (including persistence, the edge runtime, and the AI domain), it is the single most expensive dependency to replace, its concrete type `SupabaseClient` sits in **seven** domain-facing signatures, and its raw row shapes are re-reconstructed in every read model. Critically, it is the **one dependency the docs explicitly cast as swappable infrastructure** (`tech-stack.md:36`) while the code does the opposite — the strongest possible intent-vs-code mismatch.

*(Honesty note: the "same SDK on both sides of the client/server boundary" signal does **not** apply here — `client.ts`'s browser factory is dead code (Step 1). All live Supabase access is server-side. The selection rests on layer spread, replacement cost, type-in-signature leakage, and the swappability mismatch — not on a client-bundle leak.)*

---

## Step 3 — Diagnosis of the Supabase leak

1. **Library type as a domain contract.** `buildTrainerContext(supabase: SupabaseClient, …)` (`ai/context.ts:6-9`) and all five `makeX(supabase: SupabaseClient, userId)` tool factories (`ai/tools/{index,read,clients,packages,appointments}.ts`) take the SDK client as their first argument. The "domain" of context-building and assistant tools is defined in terms of the vendor object. Swapping Supabase changes every one of these signatures.

2. **Query DSL smeared across read models.** The same conceptual query ("this trainer's clients with their package") is hand-written repeatedly against the SDK: `clients/page.tsx:27-37`, `calendar/page.tsx:38-49`, `analytics/page.tsx:60-72`, `ai/context.ts:12-30`, `ai/tools/read.ts:11-16`. Each re-derives select strings, join syntax, and `.eq('trainer_id', …)`.

3. **Row-shape reconstruction.** Because the SDK returns loosely-typed rows, every screen re-declares them and force-casts: `calendar/page.tsx:5-24` + `:51-52` (`as unknown as ApptRow[]`), `analytics/page.tsx:34-37`. The mapping "DB row → app object" has no owner; it is copy-pasted.

4. **Auth SDK in the edge boundary.** `middleware.ts:7-30` instantiates the server client and calls `supabase.auth.getUser()` directly at the edge; the same `getUser()` call is repeated in every action and page loader. Session/identity is a Supabase call, not a domain concept.

5. **Swallowed failures leak the SDK's semantics.** Writes rely on the SDK's behavior that `.update().eq()` matching 0 rows returns **no error** — surfaced as `{ success: true }` (`appointments.test.ts:283-291`). The domain has no "not found" concept; it inherits the driver's silent no-op.

6. **Intent-vs-code, quoted.** `tech-stack.md:36` — Supabase is *"added post-scaffold … eliminating operational overhead"* (i.e. swappable infra). The code binds domain + AI + edge signatures to `SupabaseClient`, so the declared swappability is not honored.

---

## Step 4 — Design: the Anti-Corruption Layer

### 4a. Domain model — plain entities (the single knowledge of shape)

Vendor-free types own the shape; mapping from persistence lives in **one** place (4c). Replaces the per-screen `ApptRow`/`ClientRow` reconstructions.

```ts
// src/domain/model.ts   (no external imports)
export type TrainerId = string & { readonly __brand: 'TrainerId' };
export interface Client      { id; trainerId; firstName; lastName; phone; email;
                               packageId; interviewNotes; planUrl }
export interface Package     { id; trainerId; name; visitCount; price }
export interface Appointment { id; trainerId; clientId; packageId;
                               startsAt: Date; endsAt: Date; status: AppointmentStatus;
                               price: number | null; notes: string | null }
```

### 4b. Narrow ports — the ONLY thing the rest of the app imports

```ts
// src/domain/ports.ts   (no external imports)
export interface AuthGateway {
  currentTrainerId(): Promise<TrainerId | null>;          // wraps supabase.auth.getUser()
}
export interface ClientRepository {
  listWithPackages(t: TrainerId): Promise<Array<Client & { package: Package | null }>>;
  getById(t: TrainerId, id: string): Promise<Client | null>;
  save(c: Client): Promise<void>;                          // throws NotFoundError on 0-row update
}
export interface AppointmentRepository {
  listForTrainer(t: TrainerId, range?: DateRange): Promise<Appointment[]>;
  add(a: Appointment): Promise<void>;
  updateStatus(t: TrainerId, id: string, s: AppointmentStatus): Promise<void>; // NotFoundError
}
export interface PackageRepository { /* list / getById / save / delete */ }
export interface ConversationRepository { /* create / appendMessage(domain msg) */ }

export class NotFoundError extends Error {}                // domain-owned, not the SDK's silence
```

Everything downstream (pages, actions, AI tools, context builder, middleware) depends on these interfaces only.

### 4c. Adapter — the ONLY code that imports `@supabase/*`

```ts
// src/infra/supabase/mappers.ts   — single owner of DB-row ↔ domain mapping
export const toClient = (row: ClientRow): Client => ({ id: row.id, trainerId: row.trainer_id,
  firstName: row.first_name, /* … snake_case → camelCase, once … */ });
export const toAppointment = (row) => ({ …, startsAt: new Date(row.starts_at), … });

// src/infra/supabase/SupabaseClientRepository.ts
import type { SupabaseClient } from '@supabase/supabase-js';   // ← allowed ONLY here
export class SupabaseClientRepository implements ClientRepository {
  constructor(private db: SupabaseClient) {}
  async listWithPackages(t) {
    const { data, error } = await this.db.from('clients')
      .select('*, packages(*)').eq('trainer_id', t);
    if (error) throw error;
    return (data ?? []).map(toClientWithPackage);              // returns DOMAIN objects
  }
  async save(c) {
    const { data, error } = await this.db.from('clients')
      .update(toRow(c)).eq('id', c.id).eq('trainer_id', c.trainerId).select('id');
    if (error) throw error;
    if (!data?.length) throw new NotFoundError(`client ${c.id}`); // ← encodes the 0-row decision
  }
}

// src/infra/supabase/client.ts   — the server/edge factories move here (from src/lib/supabase/*)
// src/infra/supabase/SupabaseAuthGateway.ts implements AuthGateway via supabase.auth.getUser()
```

### 4d. Composition — callers receive ports, never the SDK

- **AI tools:** `makeReadTools(repos: TrainerRepositories, t: TrainerId)` instead of `(supabase: SupabaseClient, userId)`. Tools call `repos.clients.listWithPackages(t)` and get domain entities — `SupabaseClient` disappears from `ai/tools/*` and `ai/context.ts`.
- **Actions / route:** obtain `const t = await auth.currentTrainerId()`; call `repos.appointments.add(appt)`; map `NotFoundError` / `PackageCapacityExceededError` (doc 02) → response. No `supabase.from(...)`.
- **Read models:** `await repos.clients.listWithPackages(t)` → delete the local `ApptRow`/`ClientRow` types and `as unknown` casts.
- **Middleware:** depends on `AuthGateway`; the edge-specific Supabase wiring lives in the adapter dir.

### 4e. Open library-contract questions — decided in the ACL, not the API layer

| Question (Supabase contract) | Decision | Encoded in |
|---|---|---|
| `.update().eq()` matching 0 rows returns no error (silent no-op) | Repository `.save/.updateStatus` calls `.select()` and throws `NotFoundError` on empty | `SupabaseClientRepository` (adapter) |
| Rely on RLS `auth.uid()` **or** explicit `.eq('trainer_id', …)`? | Adapter always adds explicit `trainer_id` filter **and** keeps RLS as backstop (defense-in-depth) | adapter query builders |
| snake_case columns / `numeric` types | Normalized to camelCase + `number`/`Date` once | `mappers.ts` |

---

## Step 5 — Isolation proof & before/after

**Replacing Supabase (e.g. with Prisma/Drizzle/another BaaS) touches only `src/infra/supabase/**`** — a new `PrismaClientRepository implements ClientRepository` is dropped in; the wiring module swaps adapters. Untouched: `supabase/schema.sql` tables, the domain model/ports, every action's control flow, every AI tool, the API route, and all UI.

| Site | Before | After |
|---|---|---|
| `ai/tools/read.ts:5` | `makeReadTools(supabase: SupabaseClient, userId)` | `makeReadTools(repos, trainerId)` — no SDK type |
| `ai/context.ts:6-9` | `buildTrainerContext(supabase: SupabaseClient, …)` | `buildTrainerContext(repos, trainerId, …)` |
| `calendar/page.tsx:5-24,51-52` | local `ApptRow` + `as unknown as ApptRow[]` | `const appts = await repos.appointments.listForTrainer(t)` → domain objects |
| `analytics/page.tsx:34-37,60-72` | local row types + hand-written joins | port calls returning domain objects |
| `actions/clients/index.ts:11-18` | `generateAndStoreEmbedding(supabase, …)` | repository method; SDK type gone |
| `conversations/index.ts:26` | `message: UIMessage` (SDK type) persisted | map to a domain message VO in the adapter (also detaches Candidate B from persistence) |
| `middleware.ts:7-30` | inline `createServerClient` + `getUser()` | `auth.currentTrainerId()` |

**UI/AI get finished domain data, not raw SDK rows** — the `as unknown as` casts in the read models are deleted because the repository already returns typed domain entities.

---

## Step 6 — Verification & phased plan

**Success criterion (grep gate):** `rg "@supabase/(supabase-js|ssr)" src` returns **only** files under `src/infra/supabase/`. Enforce with an ESLint `no-restricted-imports` rule banning `@supabase/*` outside that directory, run in CI.

**Knows Supabase today → after refactor:**

| File(s) | Today | After |
|---|---|---|
| `src/infra/supabase/**` (new; absorbs `lib/supabase/server.ts`, `client.ts`) | — | **Yes (only here)** |
| `ai/tools/{index,read,clients,packages,appointments}.ts`, `ai/context.ts` | Yes (7 signatures) | No |
| `actions/{clients,appointments,packages,conversations,auth}/…`, `api/ai/chat/route.ts` | Yes (transitive) | No |
| `(app)/**/page.tsx` read models | Yes (rows + casts) | No |
| `middleware.ts` | Yes | No (uses `AuthGateway`) |
| `scripts/backfill-embeddings.ts` | Yes | No (uses repository) |

**Phased plan** (project convention: `context/changes/<id>` → research → plan → implement; test-first available, Vitest):

1. **Model + ports** — pure types/interfaces, zero deps. *(no runtime; typecheck only)*
2. **Adapter + mappers (test-first)** — build `src/infra/supabase/*`, move the two factories in, encode the 0-row→`NotFoundError` decision. Unit-test adapters against the existing mocked-chain harness (`appointments.test.ts:43-93`); legal read/write + `NotFoundError` on 0 rows.
3. **Read migration** — repoint pages, `ai/context.ts`, AI read tools to ports; delete local row types + `as unknown` casts. Refactor-under-green.
4. **Write migration** — actions + AI write tools call repositories; map domain errors to responses. (Composes with doc 02's `PackageEnrollment`.)
5. **Boundary enforcement** — add the ESLint `no-restricted-imports` rule + CI grep gate; delete dead `lib/supabase/client.ts` (or relocate) so the only Supabase imports remaining are in the adapter.

**Load-bearing names to register** (`context/foundation/lessons.md`): `AuthGateway`, `ClientRepository` / `AppointmentRepository` / `PackageRepository` / `ConversationRepository`, `NotFoundError`, `src/infra/supabase` (adapter home), `mappers.ts` (single row↔domain owner), and the invariant *"`@supabase/*` may be imported only under `src/infra/supabase/`"*.

---

## Appendix — files inspected

`package.json`; `tech-stack.md`; `lib/supabase/{server,client}.ts`; `middleware.ts`; `actions/{clients,conversations}/index.ts`; `ai/context.ts`; `ai/tools/{index,read,clients,packages,appointments}.ts`; `(app)/{calendar,clients,analytics}/page.tsx`; grep across `src` for `@supabase`, `SupabaseClient`, `ai`, `@internationalized/date`, `@/lib/supabase/client`.
