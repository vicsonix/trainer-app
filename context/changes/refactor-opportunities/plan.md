# Appointment status write-path refactor — Implementation Plan

## Overview

Close the two real risks on the appointment `status` write-path and the one latent risk, in five reversible phases ordered cheapest-and-most-self-contained first. The scope is the decided slice **RO-B + RO-A(A1) + RO-D + RO-E** from `context/changes/refactor-opportunities/research.md`: cover the untested future-appointment guard, unify the two write seams behind one shared guard so the AI tool can no longer bypass it, correct revalidation for the analytics/dashboard read surfaces, and prove the whole thing end-to-end.

The plan follows four discipline rules the user set:
1. **Characterization before touching** — uncovered code (the guard, the AI-tool write) is pinned by a test that passes against *current* behavior before it is refactored.
2. **Phases are separately reversible commits**, ordered cheapest/most-self-contained first.
3. **Every phase has automated *and* manual verification.**
4. **Mechanism lands green; enforcement turns on explicitly, in its own step** — the shared guard is introduced behavior-preserving (Phase 3), then enforcement in the AI tool is a separate, visible flip (Phase 4).

## Current State Analysis

From the grounding research (`appointment-status-consistency/research.md`, ast-grep-verified):

- `updateAppointmentStatusAction` (`src/app/actions/appointments/index.ts:182-213`) enforces a future-appointment guard (`:191-201`, `.single()` read of `starts_at`) and revalidates only `/calendar` (`:211`).
- The AI tool `update_appointment_status` (`src/lib/ai/tools/appointments.ts:129-150`) writes `.update({ status })` (`:138-142`) with `needsApproval:true` but **no guard and no revalidation** — the bypass.
- The unit suite is **RED**: `appointments.test.ts:49` mock `makeChain` omits `single`, which the guard calls (`index.ts:197`) → 3 failing tests; the guard's branches have no passing coverage.
- `/analytics` (`analytics/page.tsx:82-94`) and `/dashboard` (`dashboard/page.tsx:88-122`) derive every status KPI but are never revalidated; they are currently correct only because they render dynamically (per-request `cookies()`; no `export const dynamic/revalidate` anywhere — ast-grep 0).
- No E2E crosses the status boundary (`calendar.spec.ts` never sets a status; `analytics.spec.ts` asserts no numbers).

### Key Discoveries:

- The AI tool factory `makeAppointmentTools(supabase, userId)` (`tools/appointments.ts:25`) receives the same `supabase`+`userId` primitives the server action derives — so a **plain shared guard module** (no `'use server'`) can be imported and called by both.
- The status union is canonical at `src/app/(app)/calendar/types.ts:3` (`AppointmentStatus`).
- The guard performs two `supabase.from('appointments')` calls (select `starts_at` → `.single()`, then `.update`), so the test mock must return **distinct chains per `from()` call**.
- `revalidatePath` is callable in Route Handlers; the AI tool executes inside `/api/ai/chat`, so it can revalidate — Phase 2 asserts this via a no-throw test.

## Desired End State

- `npx vitest run` is green, and the future-appointment guard has explicit passing coverage (future→blocked, past→passes) for the server action and, via the shared helper, the AI tool.
- Marking a future appointment `completed`/`no_show` is rejected on **both** write paths (human UI and AI chat) with the same Polish error.
- A status write revalidates `/calendar`, `/analytics`, and `/dashboard` on both writers.
- One Playwright spec proves: mark an appointment `completed` in the calendar → the analytics "completed" count increments.

## What We're NOT Doing

- **RO-C** (full status-enum single-source-of-truth / the drifted loose maps), **RO-F** (edit-time status/date drift guard in `updateAppointmentAction`), **RO-G** (verify-write-before-UI-success) — deferred; out of this change's scope.
- Revalidation changes to `createAppointmentAction`/`updateAppointmentAction`/`deleteAppointmentAction` (same latent gap, but out of the status-write scope).
- Any change to the DB schema, migrations, or the status enum values.
- Applying/verifying migrations on the live Supabase instance (open question U2 — unrelated to this code change).

## Implementation Approach

Tests first (Phase 1), then the cheapest independent behavior change (Phase 2 revalidation), then the guard unification split into mechanism-green (Phase 3) and enforcement-flip (Phase 4), then the heaviest end-to-end proof (Phase 5). Each phase is a standalone commit that leaves the suite green.

## Critical Implementation Details

- **Shared guard must be a plain module** (`src/lib/appointments/status-guard.ts`, no `'use server'`) so both the server action and the AI tool (which is not a server action) can import it.
- **Analytics period filter in the E2E**: `analytics/page.tsx` is period-scoped; the spec must select a period (e.g. all-time) that includes the seeded appointment's date before asserting the count, and seed a **past-dated** appointment (the guard blocks completing a future one).

---

## Phase 1: Characterize the guard, land green (RO-B)

### Overview
Pure test commit — no production code changes. Fix the mock harness so the guard is testable, pin the server action's guard behavior with passing tests, and pin the AI tool's *current permissive* behavior (documenting the bug before Phase 4 fixes it).

### Changes Required:

#### 1. Mock harness supports the guard's two-call shape
**File**: `src/app/actions/appointments/appointments.test.ts`

**Intent**: Make the guard's `.single()` read mockable and let a single action invocation see two different `from()` results (guard-read, then update), so the guard branches can be exercised.

**Contract**: Add `'single'` to the `makeChain` method list (`:49`) and let the mocked `from()` yield distinct chains per call (a queue), so the first `from()` returns `{ data: { starts_at } }` for `.single()` and the second resolves the update.
```ts
// e.g. a per-call queue instead of one shared chain:
function setupChains(chains: Chain[]) {
  const q = [...chains]
  from.mockImplementation(() => q.shift() ?? makeChain({ error: null }))
}
```

#### 2. Characterization tests — server action guard
**File**: `src/app/actions/appointments/appointments.test.ts`

**Intent**: Pin the guard's intended behavior against current code so Phase 3's extraction is provably behavior-preserving.

**Contract**: For `updateAppointmentStatusAction`, add tests: (a) `completed`/`no_show` on a **future** `starts_at` → returns `{ error: 'Nie można oznaczyć przyszłej wizyty jako odbytej' }` and does **not** call `update`; (b) `completed`/`no_show` on a **past** `starts_at` → calls `update({ status })` and `revalidatePath('/calendar')`. These pass against the current inline guard.

#### 3. Characterization test — AI tool current (permissive) behavior
**File**: `src/lib/ai/tools/appointments.test.ts` (new)

**Intent**: Document the current bug — the AI tool writes a status with no date guard — so the fix in Phase 4 is a visible, deliberate flip.

**Contract**: Invoke `makeAppointmentTools(mockSupabase, userId).update_appointment_status.execute({ appointment_id, status: 'completed' })` and assert current behavior: it calls `update({ status })` and returns `{ success: true }` **regardless of the appointment being in the future**. Add a comment marking this as pinned current behavior to be reversed in Phase 4.

### Success Criteria:

#### Automated Verification:
- Full unit suite is green: `npx vitest run` (was `3 failed | 27 passed`, now `0 failed`)
- The guard branch tests and the AI-tool characterization test are present and passing
- Type checking passes: `npm run test` / `tsc` clean for the test files
- Linting passes: `npm run lint`

#### Manual Verification:
- Review confirms the server-action tests assert the *intended* guard behavior, and the AI-tool test is explicitly labelled as pinning *current buggy* behavior (to be flipped in Phase 4)
- No production source file was modified in this phase (test-only diff)

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Correct revalidation (RO-D)

### Overview
Smallest independent behavior change: status writes invalidate all three status-derived surfaces on both writers.

### Changes Required:

#### 1. Server action revalidates the read fan-out
**File**: `src/app/actions/appointments/index.ts`

**Intent**: A status change should invalidate every surface that derives from status, not just the calendar.

**Contract**: In `updateAppointmentStatusAction`, replace the single `revalidatePath('/calendar')` (`:211`) with revalidation of `/calendar`, `/analytics`, and `/dashboard`.

#### 2. AI tool revalidates on status write
**File**: `src/lib/ai/tools/appointments.ts`

**Intent**: The AI-driven status write currently invalidates nothing; bring it to parity.

**Contract**: In `update_appointment_status.execute`, after a successful update, `revalidatePath` the same three paths (import from `next/cache`). Confirm it does not throw in the route-handler execution context.

#### 3. Update tests to assert the new revalidation
**File**: `src/app/actions/appointments/appointments.test.ts`, `src/lib/ai/tools/appointments.test.ts`

**Intent**: Lock the new invalidation contract.

**Contract**: Assert `revalidatePath` is called with `/calendar`, `/analytics`, and `/dashboard` on a successful status write for both writers; assert the AI-tool `execute` does not throw when revalidating.

### Success Criteria:

#### Automated Verification:
- `npx vitest run` green; new assertions for the three revalidatePath targets pass on both writers
- AI-tool `execute` test asserts no throw on revalidation
- Linting passes: `npm run lint`

#### Manual Verification:
- In the running app, mark an appointment `completed` in the calendar, then open `/analytics` and `/dashboard` — the counts reflect the change with no error
- Trigger a status change via the AI assistant and confirm no runtime error from revalidation

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Extract shared guard helper — behavior-preserving (RO-A/A1 mechanism)

### Overview
Introduce the mechanism (one guard both writers can share) without changing any behavior. Only the server action is routed through it here; the AI tool is untouched until Phase 4. Phase 1's server-action characterization tests must stay green **unchanged**, proving behavior preservation.

### Changes Required:

#### 1. Shared guard module
**File**: `src/lib/appointments/status-guard.ts` (new, plain module — no `'use server'`)

**Intent**: One authoritative implementation of "may this appointment move to this status?", importable by both the server action and the AI tool.

**Contract**: 
```ts
export async function assertCompletable(
  supabase: SupabaseClient,
  appointmentId: string,
  trainerId: string,
  status: AppointmentStatus,
): Promise<{ ok: true } | { ok: false; error: string }>
```
For `completed`/`no_show` it reads `starts_at` scoped by `id`+`trainer_id` via `.single()` and returns `{ ok: false, error: 'Nie można oznaczyć przyszłej wizyty jako odbytej' }` when the row is missing or `starts_at` is in the future; otherwise `{ ok: true }`. For other statuses it returns `{ ok: true }` without a DB read.

#### 2. Server action uses the helper
**File**: `src/app/actions/appointments/index.ts`

**Intent**: Replace the inline guard with a call to the shared helper — identical behavior.

**Contract**: Swap the inline block (`:191-201`) for `const g = await assertCompletable(supabase, id, user.id, status); if (!g.ok) return { error: g.error }`. No other logic changes.

#### 3. Direct unit tests for the helper
**File**: `src/lib/appointments/status-guard.test.ts` (new)

**Intent**: Cover the guard once, at its new home.

**Contract**: `completed`/`no_show` future→`{ ok:false }` with the Polish error; past→`{ ok:true }`; `scheduled`/`cancelled`→`{ ok:true }` with no DB read (assert `from` not called).

### Success Criteria:

#### Automated Verification:
- Helper unit tests pass: `npx vitest run src/lib/appointments/status-guard.test.ts`
- Phase 1's server-action guard characterization tests still pass **unchanged** (behavior-preserving proof)
- Full suite green: `npx vitest run`
- Type checking + lint pass: `npm run lint`

#### Manual Verification:
- In the UI, the calendar still blocks marking a future appointment `completed`/`no_show` with the same message, and still allows a past one — behavior visibly unchanged from before this phase

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Enforce the guard in the AI tool — explicit flip (RO-A/A1 enforcement)

### Overview
Turn enforcement on where it was missing. This is the deliberate behavior change: the AI tool now rejects future completions. The AI-tool characterization test from Phase 1 flips from permissive to blocking in this same commit, making the change auditable in one diff.

### Changes Required:

#### 1. AI tool calls the shared guard
**File**: `src/lib/ai/tools/appointments.ts`

**Intent**: Close the bypass — route the AI status write through the same guard as the server action.

**Contract**: In `update_appointment_status.execute`, before the update, `const g = await assertCompletable(supabase, appointment_id, userId, status); if (!g.ok) return { success: false, error: g.error }`. Keep `needsApproval: true`.

#### 2. Flip the AI-tool characterization test
**File**: `src/lib/ai/tools/appointments.test.ts`

**Intent**: Record the behavior change explicitly.

**Contract**: Change the future-`completed` case from "returns success and calls update" to "returns `{ success:false, error }` and does **not** call `update`"; add a past-appointment case asserting success. Remove the "pinned current buggy behavior" comment.

### Success Criteria:

#### Automated Verification:
- AI-tool test now asserts future completions are blocked and no `update` occurs: `npx vitest run src/lib/ai/tools/appointments.test.ts`
- Full suite green: `npx vitest run`
- Type checking + lint pass: `npm run lint`

#### Manual Verification:
- In the assistant chat, request marking a **future** appointment `completed`, approve the tool call → it is rejected with the Polish error and no DB change
- Request marking a **past** appointment `completed` via chat → it succeeds and the calendar/analytics reflect it

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Cross-boundary E2E (RO-E)

### Overview
Prove the exact risk that motivated the investigation: a status change in the calendar reaches analytics. Heaviest setup (seed data), so it lands last.

### Changes Required:

#### 1. Status-consistency E2E spec
**File**: `playwright/status-consistency.spec.ts` (new)

**Intent**: End-to-end guarantee that marking an appointment `completed` in the calendar increments the analytics completed count.

**Contract**: Following the existing `calendar.spec.ts`/`analytics.spec.ts` conventions (storageState auth, `getByRole`/`getByText`, no CSS selectors, unique timestamp-suffixed data, cleanup in `afterEach`): create a unique client (+ package if required), book a **past-dated** appointment, open it and mark it `completed`, navigate to `/analytics`, select the period (e.g. all-time) that includes the seeded date, and assert the "Sesji ukończonych" count increased. Clean up the seeded rows.

### Success Criteria:

#### Automated Verification:
- The spec passes: `npx playwright test playwright/status-consistency.spec.ts`
- It uses role/text/label locators only (no CSS/XPath) and unique identifiers with cleanup
- Existing E2E specs still pass: `npx playwright test`

#### Manual Verification:
- Review the Playwright trace/report: the completed count visibly moved after the status change
- After the run, no orphaned test client/appointment remains (cleanup verified)

**Implementation Note**: Final phase — confirm all manual checks before archiving the change.

---

## Testing Strategy

### Unit Tests:
- Guard branches (future-blocked, past-passes) for the server action (Phase 1) and the shared helper (Phase 3)
- AI-tool status write: current permissive behavior pinned (Phase 1), flipped to blocking (Phase 4)
- Revalidation targets `/calendar` + `/analytics` + `/dashboard` on both writers (Phase 2)

### Integration / E2E:
- Calendar status change → analytics count increment (Phase 5)

### Manual Testing Steps:
1. Calendar: mark a past appointment completed → analytics + dashboard update, no error
2. Calendar: attempt to mark a future appointment completed → blocked with the Polish message (behavior identical across Phases 3→4 for the UI)
3. Assistant chat: attempt the same future completion → rejected after Phase 4
4. Assistant chat: past completion → succeeds and propagates

## Migration Notes

No schema or data migration. No changes to status enum values.

## References

- Exploration & ranking: `context/changes/refactor-opportunities/research.md`
- Debt inventory (evidence, ast-grep verification): `context/changes/appointment-status-consistency/research.md`
- Guard origin: `context/archive/2026-06-25-trainer-analytics/plan.md` (commit `f164aaa`)
- Existing E2E patterns: `playwright/calendar.spec.ts`, `playwright/analytics.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Characterize the guard, land green (RO-B)

#### Automated
- [ ] 1.1 Full unit suite green: `npx vitest run` (0 failed)
- [ ] 1.2 Guard branch tests + AI-tool characterization test present and passing
- [ ] 1.3 Type checking clean for the test files
- [ ] 1.4 Linting passes: `npm run lint`

#### Manual
- [ ] 1.5 Review confirms server-action tests assert intended behavior; AI-tool test labelled as pinning current buggy behavior
- [ ] 1.6 Test-only diff — no production source modified

### Phase 2: Correct revalidation (RO-D)

#### Automated
- [ ] 2.1 `npx vitest run` green with three-target revalidatePath assertions on both writers
- [ ] 2.2 AI-tool `execute` test asserts no throw on revalidation
- [ ] 2.3 Linting passes: `npm run lint`

#### Manual
- [ ] 2.4 Mark completed in calendar → `/analytics` + `/dashboard` reflect it, no error
- [ ] 2.5 Status change via AI assistant → no revalidation runtime error

### Phase 3: Extract shared guard helper — behavior-preserving (RO-A/A1 mechanism)

#### Automated
- [ ] 3.1 Helper unit tests pass: `npx vitest run src/lib/appointments/status-guard.test.ts`
- [ ] 3.2 Phase 1 server-action guard tests still pass unchanged (behavior-preserving)
- [ ] 3.3 Full suite green: `npx vitest run`
- [ ] 3.4 Type checking + lint pass

#### Manual
- [ ] 3.5 UI still blocks future completion / allows past — behavior visibly unchanged

### Phase 4: Enforce the guard in the AI tool — explicit flip (RO-A/A1 enforcement)

#### Automated
- [ ] 4.1 AI-tool test asserts future completions blocked, no `update`: `npx vitest run src/lib/ai/tools/appointments.test.ts`
- [ ] 4.2 Full suite green: `npx vitest run`
- [ ] 4.3 Type checking + lint pass

#### Manual
- [ ] 4.4 Assistant chat: future completion rejected with Polish error, no DB change
- [ ] 4.5 Assistant chat: past completion succeeds and propagates

### Phase 5: Cross-boundary E2E (RO-E)

#### Automated
- [ ] 5.1 Spec passes: `npx playwright test playwright/status-consistency.spec.ts`
- [ ] 5.2 Role/text locators only, unique data + cleanup
- [ ] 5.3 Existing E2E specs still pass: `npx playwright test`

#### Manual
- [ ] 5.4 Trace shows the completed count moved after the status change
- [ ] 5.5 No orphaned test data remains after the run
