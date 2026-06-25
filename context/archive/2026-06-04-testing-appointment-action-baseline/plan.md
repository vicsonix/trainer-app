# Appointment Action Baseline — Test Coverage Plan

## Overview

Fix the overlap query status filter and fill the remaining integration-test gaps in `src/app/actions/appointments/appointments.test.ts`. Research revealed that (1) the overlap check includes cancelled/no_show appointments — a bug, since those appointments should free the slot — and (2) several test cases are missing against the established pattern from `clients.test.ts`. Phase 1 fixes the production code and adds schema test gaps; Phase 2 fills all remaining action test gaps.

## Current State Analysis

- `src/app/actions/appointments/appointments.test.ts` exists with solid coverage of happy paths, validation errors, and unauthenticated cases for all four actions. The `makeChain` / `setupDualCallMock` / `setupSingleCallMock` helpers are more capable than the client action equivalents.
- The overlap query in `index.ts` has no status filter: cancelled and no_show appointments block the time slot, which is wrong.
- Schema tests cover only 4 cases (`client_id`, `duration`, fully populated, minimal). `tz` (required), `price` (format regex), and `package_id` (UUID) are untested.
- `updateAppointmentAction` is missing: overlap rejection test, DB error test.
- `deleteAppointmentAction` is missing: DB error test.
- `updateAppointmentStatusAction` tests only `'completed'`; the other 3 valid statuses are uncovered.
- IDOR silent no-op: when the ownership filter matches 0 rows, all mutation actions return success. This behavior is undocumented; a test should make it explicit.

## Desired End State

All appointment action tests pass. The overlap query correctly excludes `cancelled` and `no_show` appointments. Every test gap identified in the research document is closed. `npm run test`, `npm run lint`, and `npx tsc --noEmit` all pass clean.

### Key Discoveries

- `src/app/actions/appointments/index.ts:75-84` — overlap query for create; needs `.neq('status', 'cancelled').neq('status', 'no_show')` before resolving.
- `src/app/actions/appointments/index.ts:127-136` — overlap query for update; same fix; already has `.neq('id', id)` for self-exclusion.
- `src/app/actions/appointments/appointments.test.ts:49` — `makeChain` already includes `neq` as a spy; no helper changes needed.
- `src/app/actions/appointments/appointments.test.ts:56-75` — `setupDualCallMock` exposes `overlapCh`; use `overlapCh.neq` to assert status predicates.
- RLS policy (`supabase/schema.sql:60-62`) covers all operations with `trainer_id = auth.uid()` — the action-level ownership check is defense in depth.

## What We're NOT Doing

- No E2E tests — those belong to Phase 2 of the test rollout.
- No changes to the status state machine (transitions stay unrestricted by design).
- No `revalidatePath` path changes.
- No fix to the silent no-op IDOR behavior — documenting it with a test is sufficient per the agreed decision.
- No changes to `deleteAppointmentAction`'s return type (already returns `{ error?: string }`).

## Implementation Approach

Phase 1 is the production fix + schema tests: small, safe, and independently verifiable. Phase 2 adds only test code against the now-correct behavior. Both phases target the same two files; splitting them keeps the production change reviewable in isolation.

---

## Phase 1: Fix Overlap Status Filter + Schema Test Gaps

### Overview

Add the status exclusion predicates to the two overlap queries and extend `appointmentSchema` tests to cover the untested fields.

### Changes Required

#### 1. Fix overlap query in `createAppointmentAction`

**File**: `src/app/actions/appointments/index.ts`

**Intent**: The overlap check must not count cancelled or no_show appointments as blocking; a cancelled appointment should free the slot for rebooking.

**Contract**: After the existing `.gt('ends_at', startsAt.toISOString())` call (line 81), chain `.neq('status', 'cancelled').neq('status', 'no_show')` before the count resolves. The method order within the chain does not matter; all chain methods return `this`.

#### 2. Fix overlap query in `updateAppointmentAction`

**File**: `src/app/actions/appointments/index.ts`

**Intent**: Same status exclusion as item 1, applied to the update path's overlap check.

**Contract**: After the existing `.neq('id', id)` call (line 131), add `.neq('status', 'cancelled').neq('status', 'no_show')`. Same ordering note as above.

#### 3. Schema test gaps

**File**: `src/app/actions/appointments/appointments.test.ts`

**Intent**: Extend the `appointmentSchema` describe block with the three untested validation cases so the schema contract is fully documented.

**Contract**: Add three `it(...)` cases inside the existing `describe('appointmentSchema', ...)` block (currently `appointments.test.ts:97-128`):
- `'rejects missing tz'` — parse `{ ...VALID_FORM_OBJ, tz: '' }` and assert `result.success === false` with `path[0] === 'tz'`.
- `'rejects invalid price format when non-empty'` — parse `{ ...VALID_FORM_OBJ, price: '12.345' }` and assert `result.success === false` with `path[0] === 'price'`.
- `'rejects non-UUID package_id when non-empty'` — parse `{ ...VALID_FORM_OBJ, package_id: 'not-a-uuid' }` and assert `result.success === false` with `path[0] === 'package_id'`.

Note: `VALID_FORM` in the test file is `Record<string, string>` for FormData construction; create a plain-object alias for schema tests (e.g., `VALID_SCHEMA_OBJ`) rather than reusing `VALID_FORM` directly, since the schema accepts the raw object shape while `VALID_FORM` is typed for `makeFormData`.

### Success Criteria

#### Automated Verification

- Tests pass: `npm run test`
- Lint passes: `npm run lint`
- Type check passes: `npx tsc --noEmit`

---

## Phase 2: Fill Remaining Action Test Gaps

### Overview

Add the missing test cases to `appointments.test.ts`: overlap predicate assertions, error-path coverage for update/delete/status, status coverage, and IDOR silent no-op documentation.

### Changes Required

#### 1. Overlap predicate assertion — `createAppointmentAction`

**File**: `src/app/actions/appointments/appointments.test.ts`

**Intent**: Verify that the fixed overlap query sends the status exclusion predicates so a future refactor cannot silently remove them.

**Contract**: Inside `describe('createAppointmentAction', ...)`, add:
- `'excludes cancelled and no_show appointments from the overlap check'` — call `setupDualCallMock({ overlapCount: 0 })`, invoke the action, then assert `overlapCh.neq` was called with `('status', 'cancelled')` and `('status', 'no_show')`.

#### 2. Overlap predicate assertion — `updateAppointmentAction`

**File**: `src/app/actions/appointments/appointments.test.ts`

**Intent**: Same predicate assertion for the update path, which also has the self-exclusion `.neq('id', id)`.

**Contract**: Inside `describe('updateAppointmentAction', ...)`, add:
- `'excludes cancelled and no_show appointments from the overlap check'` — same structure as item 1; additionally assert `overlapCh.neq` was called with `('id', APPT_ID)` (the existing self-exclusion predicate, confirming neither fix broke the other).

#### 3. Overlap rejection — `updateAppointmentAction`

**File**: `src/app/actions/appointments/appointments.test.ts`

**Intent**: Mirror the overlap rejection test that exists for `createAppointmentAction` (line 171-178) so update's overlap path is also covered.

**Contract**: Inside `describe('updateAppointmentAction', ...)`, add:
- `'returns form error when an appointment already exists in that time slot'` — `setupDualCallMock({ overlapCount: 1 })`, invoke, assert `{ errors: { _form: expect.any(Array) } }` and `revalidatePath` not called.

#### 4. DB error — `updateAppointmentAction`

**File**: `src/app/actions/appointments/appointments.test.ts`

**Intent**: Cover the path where validation and overlap pass but the Supabase update returns an error.

**Contract**: Inside `describe('updateAppointmentAction', ...)`, add:
- `'returns form error when Supabase update fails'` — `setupDualCallMock({ writeError: { message: 'DB error' } })`, invoke with valid form, assert `{ errors: { _form: expect.any(Array) } }` and `revalidatePath` not called.

#### 5. DB error — `deleteAppointmentAction`

**File**: `src/app/actions/appointments/appointments.test.ts`

**Intent**: Cover the path where the delete call fails.

**Contract**: Inside `describe('deleteAppointmentAction', ...)`, add:
- `'returns error when Supabase delete fails'` — `setupSingleCallMock({ resolveWith: { error: { message: 'DB error' } } })`, invoke, assert `result` contains `{ error: expect.any(String) }` and `revalidatePath` not called.

#### 6. All valid statuses — `updateAppointmentStatusAction`

**File**: `src/app/actions/appointments/appointments.test.ts`

**Intent**: The existing test covers only `'completed'`. All four valid statuses should be documented so the DB constraint is reflected in tests.

**Contract**: Inside `describe('updateAppointmentStatusAction', ...)`, add three cases using `setupSingleCallMock({})`:
- `'accepts scheduled status'` — call with `'scheduled'`, assert `chain.update` was called with `{ status: 'scheduled' }`.
- `'accepts cancelled status'` — same for `'cancelled'`.
- `'accepts no_show status'` — same for `'no_show'`.

#### 7. IDOR silent no-op documentation — mutation actions

**File**: `src/app/actions/appointments/appointments.test.ts`

**Intent**: Document the current behavior: when the ownership filter matches 0 rows, update/delete/status actions return success. This makes the behavior an explicit, visible decision rather than an unnoticed gap.

**Contract**: Add one case to each of the three mutation action describe blocks using `setupDualCallMock` (for update) or `setupSingleCallMock` (for delete, status) with `resolveWith: { error: null }`:
- `updateAppointmentAction`: `'returns success when ownership filter matches 0 rows (silent no-op)'` — verify ownership predicates `.eq('id', APPT_ID).eq('trainer_id', USER_ID)` were called and result is `{ success: true }`.
- `deleteAppointmentAction`: `'returns empty object when ownership filter matches 0 rows (silent no-op)'` — verify predicates called, result is `{}`.
- `updateAppointmentStatusAction`: `'returns empty object when ownership filter matches 0 rows (silent no-op)'` — same pattern.

These tests are labelled "silent no-op" so any future reader immediately understands the intent.

### Success Criteria

#### Automated Verification

- Tests pass: `npm run test`
- Lint passes: `npm run lint`
- Type check passes: `npx tsc --noEmit`

---

## Testing Strategy

All tests in this plan are Vitest integration tests using the Supabase mock pattern established in `appointments.test.ts`. No new infrastructure is required. The reference test file is `src/app/actions/appointments/appointments.test.ts`; run a single file with `npx vitest run src/app/actions/appointments/appointments.test.ts`.

## References

- Research: `context/changes/testing-appointment-action-baseline/research.md`
- Reference test file: `src/app/actions/appointments/appointments.test.ts`
- Pattern source: `src/app/actions/clients/clients.test.ts`
- Production code: `src/app/actions/appointments/index.ts`
- Schema: `src/app/actions/appointments/schema.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Fix Overlap Status Filter + Schema Test Gaps

#### Automated

- [x] 1.1 Tests pass: `npm run test` — 965c0e5
- [x] 1.2 Lint passes: `npm run lint` — 965c0e5
- [x] 1.3 Type check passes: `npx tsc --noEmit` — 965c0e5

### Phase 2: Fill Remaining Action Test Gaps

#### Automated

- [x] 2.1 Tests pass: `npm run test` — 7e9993d
- [x] 2.2 Lint passes: `npm run lint` — 7e9993d
- [x] 2.3 Type check passes: `npx tsc --noEmit` — 7e9993d
