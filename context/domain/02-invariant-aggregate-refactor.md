---
title: Invariant Aggregate Refactor — Package Capacity
created: 2026-07-03
type: refactor-plan
---

# Invariant Aggregate Refactor — Package Capacity

> Product of this artifact: a **refactor PLAN**, not implementation. No production code is
> modified here. Builds on `01-domain-distillation.md`. Every `file:line` is verified.

---

## Step 0 — Context (recap, verified)

- **Requirements:** `context/foundation/prd.md` — Business Logic (`prd.md:134-140`), FR-014 (`prd.md:117-118`), guardrails (`prd.md:51-53`).
- **Stack / layers where business logic lives** (`CLAUDE.md`, `tech-stack.md`): Next.js App Router + Supabase Postgres. There is **no domain/service layer** — rules are inlined at each read/write site:
  - Persistence: `supabase/schema.sql`, `supabase/migrations/*`.
  - Writes: `src/app/actions/{appointments,packages}/index.ts` **and** `src/lib/ai/tools/{appointments,packages}.ts` (a second, parallel write surface via the AI assistant).
  - Reads with inline calculation: `src/app/(app)/{calendar,clients,analytics}/page.tsx`, `src/lib/ai/tools/read.ts`, `src/lib/ai/context.ts`.
- **Test discipline:** Vitest (`npm run test`, `vitest.config.ts`); Supabase is mocked via a self-referential thenable chain (`appointments.test.ts:43-93`). Domain logic can be unit-tested **in memory with no DB** — ideal for test-first invariant cases.

---

## Step 1 — Business invariants identified

| # | Invariant (must always be true) | Source |
|---|---|---|
| **I-1** | **A client can never consume more visits than the assigned package contains** — used visits ≤ `visit_count` (equivalently, `remaining ≥ 0`). This *is* the "remaining visits" counter. | `prd.md:117-118` (FR-014, *"core feature"*), `prd.md:138`; DB only guarantees `visit_count > 0` (`schema.sql:9`), never the ceiling. |
| **I-2** | **"Remaining" has one meaning** across every surface (card, calendar, assistant). | `prd.md:138` (single definition) |
| **I-3** | A package is "ending soon" exactly when remaining ≤ 2. | `prd.md:138` |
| **I-4** | An appointment occupies a valid, non-overlapping time span. | `prd.md:53`, `prd.md:113` |
| **I-5** | Trainer data is tenant-isolated. | `prd.md:51,128` |
| **I-6** | Assistant asserts only trainer-entered facts (grounding). | `prd.md:132` (FR-015) |
| **I-7** | Completed/no_show cannot be set on a future-dated appointment. | `appointments/index.ts:191-201` |
| **I-8** | A package-visit's price derives from the package; one-offs set it explicitly. | `schema.sql:29-30` |

---

## Step 2 — Classification & selection of #1

Three axes: **(a)** how core to the product, **(b)** how smeared across layers, **(c)** enforcement reality.

| # | (a) Core-ness | (b) Smear | (c) Enforcement | Verdict |
|---|---|---|---|---|
| **I-1 Package capacity** | **Highest** — FR-014 is named *"jeden z głównych bolów trenera, core feature"* (`prd.md:118`); it's the number the app exists to show. | **Highest** — 4 write paths + 3 read calculations, no owner. | **Violable** — enforced **nowhere**; app renders negative *"Brak sesji"* (`analytics/page.tsx:344`). | **← SELECTED #1** |
| I-2 One meaning of remaining | High | Highest (3 formulas) | Violated | Folds into I-1's fix |
| I-4 Overlap | Medium | Medium | Enforced (app-layer) | OK |
| I-5 Tenant isolation | High (guardrail) | Low | **Enforced** (RLS `schema.sql:52-62`) | Strong — leave alone |
| I-7 Future-completion | Medium | Low | Enforced in one action (`index.ts:191-201`) — but **not** in the AI status tool (`ai/tools/appointments.ts:136-144`) | Secondary |
| I-8 Price derivation | Low-Med | Medium | Ignored | Secondary |

**Selection: I-1 — Package capacity (`remaining ≥ 0`).** It is simultaneously the **most core** (the product's headline number) and the **least enforced** (violated in production, no guard on any of four write paths). Fixing it also resolves I-2 and I-3, which are downstream of the same missing owner.

---

## Step 3 — Diagnosis of I-1 (where the rule lives today)

### 3a. The rule is *calculated* in 3 places, with 3 different formulas — and *enforced* in 0

| Layer | What it does | Evidence |
|---|---|---|
| Calendar read model | `remaining = visit_count − completed − scheduled`, matched on `package_id` | `calendar/page.tsx:54-64` (count build), `:73-76` |
| AI `get_client` tool | same formula, matched on `package_id` | `ai/tools/read.ts:112-118` |
| Analytics read model | `remaining = visit_count − (completed + scheduled)` matched on **`client_id`**, ignoring which package | `analytics/page.tsx:103-118` |
| PRD (spec) | `remaining = visit_count − completed` (no `scheduled`) | `prd.md:138` |
| Client card | **does not compute it at all** — shows only `visit_count` | `clients/ClientCard.tsx:79` |
| AI grounding context | **does not compute it at all** — lists only `visit_count` | `ai/context.ts:53-55` |

→ Four surfaces, four answers. **I-2 is broken as a direct consequence of no owner.**

### 3b. No write path enforces the ceiling — booking a visit never checks capacity

| Write path | Guards present | Capacity guard? | Evidence |
|---|---|---|---|
| `createAppointmentAction` | time-overlap only (excludes cancelled/no_show) | **None** | `appointments/index.ts:75-104` |
| `updateAppointmentAction` | time-overlap only | **None** | `appointments/index.ts:129-162` |
| AI `create_appointment` | time-overlap — and even **drops** the cancelled/no_show filter the action has | **None** | `ai/tools/appointments.ts:35-54` |
| AI `update_appointment` | time-overlap (no status filter) | **None** | `ai/tools/appointments.ts:74-95` |
| `updateAppointmentStatusAction` (scheduled→completed) | future-date check | **None** — completing a visit can push used past `visit_count` | `appointments/index.ts:182-213` |

→ You can book an 11th session on a 10-visit package from **any** of these paths. The DB has no `remaining ≥ 0` constraint (`schema.sql:31-45`).

### 3c. Failure modes: swallowed, client-guarded, and history-erasing

- **Rendered, not prevented:** analytics anticipates the violation — `isUrgent = remaining <= 0`, badge *"Brak sesji"* (`analytics/page.tsx:325,344`). The system *displays* the broken state instead of *rejecting* the operation that caused it.
- **Silent no-op on ownership mismatch:** writes match `id + trainer_id`; 0 rows matched returns `{ success: true }` — a swallowed failure, asserted as intended in tests (`appointments.test.ts:283-291,330-338,391-399`).
- **No aggregate boundary / no purchase instance:** deleting a package `SET NULL`s both `clients.package_id` and `appointments.package_id` (`schema.sql:22,35`), erasing consumption history; re-buying the same package has no instance boundary, so old completed visits keep counting against the "renewed" one.
- **UI as the only "guard":** nothing stops overbooking server-side; the trainer only *notices* via the calendar badge — enforcement lives in the human reading the screen.

### 3d. Canonical-definition decision (resolves I-2)

The PRD's `remaining = visit_count − completed` (`prd.md:138`) **cannot protect I-1**: counting only completed visits lets a trainer schedule unlimited *future* visits on a depleted package. The only definition that actually caps consumption is the reserve-on-book rule already used by 2 of 3 code sites:

> **Canonical: `remaining = visit_count − completed − scheduled`.** A `scheduled` visit reserves a slot; `cancelled` / `no_show` release it.

This is a deliberate reconciliation: the aggregate adopts the reserve-on-book rule and the PRD wording (`prd.md:138`) should be updated to match (a documentation fix, flagged — not silently diverged).

---

## Step 4 — Design: the guardian aggregate

### 4a. Aggregate root — `PackageEnrollment`

The missing concept from `01-domain-distillation.md` (candidate A). It represents **one client's purchased instance of a package** and is the **single owner** of I-1/I-2/I-3.

**Boundary (what it encloses):** the enrollment identity (client + package + a `visit_count` snapshot taken at purchase) and the set of *consuming* appointments (this client's appointments on this enrollment with status `scheduled | completed`).

```
PackageEnrollment (root)
  ├─ enrollmentId, trainerId, clientId, packageId
  ├─ visitCount        // snapshot at purchase — immune to later package edits
  ├─ consumedVisits[]  // { appointmentId, status }  (scheduled | completed only)
  └─ invariant I-1:  completed + scheduled  ≤  visitCount
```

**Domain methods — every illegal op throws a *named* domain error, never a silent update:**

```ts
class PackageCapacityExceededError extends DomainError {}   // I-1 violated
class VisitNotInEnrollmentError    extends DomainError {}
class FutureCompletionError        extends DomainError {}   // I-7

class PackageEnrollment {
  // THE one canonical calculation — kills the 3 divergent formulas (I-2)
  remaining(): number {
    return this.visitCount - this.countConsuming();          // scheduled + completed
  }
  isEndingSoon(): boolean { return this.remaining() <= 2 }    // I-3, single source

  // Reserve a slot for a new scheduled visit
  bookVisit(v: { appointmentId: string; startsAt: Date }): void {
    if (this.remaining() <= 0)
      throw new PackageCapacityExceededError(this.enrollmentId, this.visitCount);
    this.consumedVisits.push({ appointmentId: v.appointmentId, status: 'scheduled' });
  }

  // scheduled → completed
  completeVisit(appointmentId: string, now: Date): void {
    const v = this.mustFind(appointmentId);                   // else VisitNotInEnrollmentError
    if (v.startsAt > now) throw new FutureCompletionError(appointmentId);   // I-7
    v.status = 'completed';                                   // stays within capacity — no new slot
  }

  // cancelled / no_show → releases the slot
  releaseVisit(appointmentId: string): void {
    this.mustFind(appointmentId).status = 'released';
  }

  private countConsuming(): number {
    return this.consumedVisits.filter(v => v.status === 'scheduled' || v.status === 'completed').length;
  }
}
```

Precondition-first: `bookVisit` refuses the (N+1)th slot **before** any write. No log-and-continue.

### 4b. Repository — load/save the whole aggregate, not scattered queries

```ts
interface PackageEnrollmentRepository {
  loadForClient(trainerId: string, clientId: string): Promise<PackageEnrollment | null>;
  save(agg: PackageEnrollment): Promise<void>;   // persists appointment rows for this enrollment
}
```

`loadForClient` replaces the ad-hoc counting in `calendar/page.tsx:54-76`, `analytics/page.tsx:103-118`, `ai/tools/read.ts:112-118` — read models call `enrollment.remaining()` / `.isEndingSoon()` instead of re-deriving.

### 4c. Atomicity — capacity check + insert in ONE transaction

The Supabase JS client cannot span multiple statements in a transaction, and serverless concurrency means a pure app-layer check races (two requests both read remaining=1, both insert). I-1 therefore needs a **DB-level backstop**, with the aggregate as the single app-layer gateway:

- **Primary enforcement (atomic):** a Postgres function `book_visit(p_client_id, p_starts_at, …)` (SQL `SECURITY DEFINER`, respecting `trainer_id = auth.uid()`) that, in one transaction: locks the enrollment's rows (`SELECT … FOR UPDATE`), recomputes `remaining`, and either `INSERT`s the appointment or `RAISE`s `package_capacity_exceeded`. The repository's `save()` calls this RPC.
- **Ultimate backstop (defense-in-depth):** a `BEFORE INSERT/UPDATE` trigger `enforce_package_capacity` on `appointments` that rejects any write pushing `scheduled + completed` past the enrollment's `visit_count`. Guarantees I-1 even against direct SQL / future write paths.

### 4d. Thin write surface — enforcement moves off the read screens onto the server

```ts
// createAppointmentAction  (replaces appointments/index.ts:75-104)
export async function createAppointmentAction(prev, formData) {
  const input = appointmentSchema.safeParse(...);        // 1. parse
  if (!input.success) return { errors: byField(input.error) };
  const enrollment = await repo.loadForClient(trainerId, input.data.client_id);
  try {
    enrollment.bookVisit({ appointmentId, startsAt });   // 2. aggregate method (precondition)
    await repo.save(enrollment);                          //    atomic RPC (4c)
  } catch (e) {
    if (e instanceof PackageCapacityExceededError)        // 3. map domain error → response
      return { errors: { _form: ['Pakiet nie ma już wolnych wizyt'] } };
    throw e;                                              //    fail fast on the unexpected
  }
  revalidatePath('/calendar');
  return { success: true };
}
```

**All four write paths route through the aggregate** — the two Server Actions and the two AI tools (`ai/tools/appointments.ts`) call the same `repo` + aggregate, so the assistant can no longer overbook either. Enforcement leaves the UI/read layer entirely.

---

## Step 5 — Before/after, phased plan, tests, contracts

### 5a. Before / after per site

| Site | Before | After |
|---|---|---|
| `calendar/page.tsx:73-76` | inline `visit_count − completed − scheduled` | `enrollment.remaining()` |
| `analytics/page.tsx:111-118` | inline, counted by `client_id` (wrong scope) | `enrollment.remaining()` (per-enrollment) |
| `ai/tools/read.ts:112-118` | inline formula #2 | `enrollment.remaining()` |
| `ai/context.ts:53-55` | no remaining shown | include `enrollment.remaining()` + ending-soon (fixes FR-015 grounding) |
| `clients/ClientCard.tsx:79` | only `visit_count` | remaining + ending-soon badge (fixes FR-014 surface) |
| `AppointmentDetailModal.tsx:282` | hard-coded `<= 2` | `enrollment.isEndingSoon()` |
| `appointments/index.ts:75-104` create | overlap only | `bookVisit()` + atomic save |
| `appointments/index.ts:182-213` complete | no capacity/date guard in-model | `completeVisit()` (I-1 + I-7) |
| `ai/tools/appointments.ts:35-95` | overlap (no status filter), no capacity | route through aggregate |
| DB `schema.sql` | no ceiling constraint | `book_visit` RPC + `enforce_package_capacity` trigger + `package_enrollments` table |

### 5b. Phased plan

1. **Phase 1 — Domain core (test-first).** `PackageEnrollment` + named errors as pure TS, no DB. Unit-tested in isolation (mirrors existing in-memory test style).
2. **Phase 2 — Persistence.** `package_enrollments` migration (snapshot `visit_count`, `purchased_at`); backfill from current `clients.package_id`; `book_visit` RPC + `enforce_package_capacity` trigger + repository.
3. **Phase 3 — Write paths.** Route all four write paths through the aggregate; map `PackageCapacityExceededError` → form/tool error. (test-first: action-level tests.)
4. **Phase 4 — Read unification.** Replace the 3 inline formulas with `enrollment.remaining()`; add remaining to client card + AI context.
5. **Phase 5 — Doc reconciliation.** Update `prd.md:138` to the reserve-on-book definition (Step 3d); register load-bearing names (5d).

**Test-first phases: 1 and 3** (pure logic + guarded write behavior). Phase 2 (DB trigger) verified with an integration test against a real/branch DB; Phase 4 is refactor-under-green.

### 5c. Test cases for I-1 (legal vs illegal)

*Aggregate (Phase 1, in-memory):*
- ✅ `bookVisit` on a 10-pack with 9 consuming → remaining 0, succeeds.
- ❌ `bookVisit` on a pack with remaining 0 → throws `PackageCapacityExceededError` (no push).
- ✅ `releaseVisit` (cancel) frees a slot → remaining increases → next `bookVisit` succeeds.
- ✅ `remaining()` counts `scheduled` + `completed`, ignores `cancelled` / `no_show`.
- ✅ `completeVisit` scheduled→completed keeps remaining unchanged (no new slot).
- ❌ `completeVisit` on a future-dated visit → `FutureCompletionError` (I-7).
- ❌ `completeVisit` / `releaseVisit` on an unknown id → `VisitNotInEnrollmentError`.
- ✅ `isEndingSoon()` true at remaining exactly 2, false at 3.

*Write path (Phase 3):* `createAppointmentAction` on a full package → `{ errors: { _form: [...] } }`, **no insert, no `revalidatePath`** (contrast the current silent success).

*DB backstop (Phase 2, integration):* two concurrent `book_visit` calls at remaining 1 → exactly one succeeds, one raises `package_capacity_exceeded`.

### 5d. New load-bearing names to register

Register in `context/foundation/lessons.md` (or a contracts registry if adopted):

- `PackageEnrollment` — aggregate root owning I-1/I-2/I-3.
- `PackageCapacityExceededError`, `VisitNotInEnrollmentError`, `FutureCompletionError` — named domain errors (fail-fast contract).
- `PackageEnrollment.remaining()` / `.isEndingSoon()` — the **single** canonical calculation (supersedes 3 inline formulas).
- `PackageEnrollmentRepository.loadForClient` / `.save`.
- `book_visit` RPC + `enforce_package_capacity` trigger — atomic DB enforcement.
- Canonical definition: **`remaining = visit_count − completed − scheduled`** (reconciles `prd.md:138`).

---

## Appendix — files inspected for this plan

`prd.md`; `schema.sql`; `appointments/index.ts`; `appointments/schema.ts`; `appointments/appointments.test.ts`; `packages/index.ts`; `ai/tools/{appointments,read,packages}.ts`; `ai/context.ts`; `(app)/{calendar,clients,analytics}/page.tsx`; `calendar/AppointmentDetailModal.tsx`; `clients/ClientCard.tsx`.
