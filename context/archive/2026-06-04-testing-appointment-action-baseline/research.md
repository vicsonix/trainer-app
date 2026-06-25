---
date: 2026-06-04T00:00:00+02:00
researcher: Claude Sonnet 4.6
git_commit: 9139183535d44bdfabb2640c3de64cd3441189a5
branch: feature/calendar-appointments
repository: trainer-app
topic: "Ground appointment action code for Vitest integration testing — overlap constraint, status logic, ownership checks"
tags: [research, testing, appointments, vitest, idor, overlap, status]
status: complete
last_updated: 2026-06-04
last_updated_by: Claude Sonnet 4.6
---

# Research: Appointment Action Baseline — Test Coverage Grounding

**Date**: 2026-06-04
**Researcher**: Claude Sonnet 4.6
**Git Commit**: `9139183535d44bdfabb2640c3de64cd3441189a5`
**Branch**: `feature/calendar-appointments`
**Repository**: trainer-app

## Research Question

Ground the appointment CRUD actions for Vitest integration testing covering:
- Risk #4: appointment overlap constraint and status logic (zero test coverage assumed)
- Risk #5: IDOR — trainer_id ownership checks on all actions

## Summary

**The test file already exists.** `src/app/actions/appointments/appointments.test.ts` covers the happy path and basic error cases for all four actions. The coverage is solid on structure but has specific, actionable gaps. The most important finding is a **behavioral ambiguity in the overlap check**: the implementation includes `cancelled` and `no_show` appointments in the overlap calculation (no status filter), which may or may not be intentional. No existing test documents or challenges this behavior. The second significant finding is that IDOR testing verifies the predicate is called but does not test the silent no-op scenario where the ownership filter eliminates all matched rows.

**Phase 1 planning implication**: The plan should focus on gap-filling, not rebuilding from scratch. The reference test file is high quality — the same `makeChain`/`setupDualCallMock`/`setupSingleCallMock` helper pattern should be reused verbatim.

## Detailed Findings

### Appointment Schema (`src/app/actions/appointments/schema.ts`)

All fields:

| Field | Validation | Notes |
|---|---|---|
| `client_id` | required UUID | `min(1)` + `.uuid()` |
| `package_id` | optional UUID or null | `nullish().transform(v => v \|\| null).pipe(uuid \| null)` |
| `date` | required non-empty string | No format check — relies on form date input |
| `start_time` | required non-empty string | No format check — relies on form time input |
| `duration` | enum `'30'\|'60'\|'90'\|'120'` | Hard enum, not a numeric range |
| `notes` | optional string | `nullish().transform(v => v ?? '')` |
| `price` | optional regex-validated string → Number | `/^\d+(\.\d{1,2})?$/`; null if empty |
| `tz` | required non-empty string | Timezone identifier (e.g. `'Europe/Warsaw'`) |

**Schema test gaps** (`appointments.test.ts:97-128` covers 4 cases only):
- `tz` field: no test for required validation (missing `tz` → schema rejects but test absent)
- `price` format: no test for invalid format (e.g. `'12.345'` → rejects) or valid format
- `package_id` UUID: no test for non-UUID rejection when non-empty

### Overlap Logic — Critical Behavioral Finding

**Location**: `src/app/actions/appointments/index.ts:75-84` (create) and `127-136` (update)

The overlap query for `createAppointmentAction`:
```
.from('appointments')
.select('id', { count: 'exact', head: true })
.eq('trainer_id', user.id)
.lt('starts_at', endsAt.toISOString())
.gt('ends_at', startsAt.toISOString())
```

**No status filter is applied.** This means appointments with status `cancelled` or `no_show` are included in the overlap calculation and will block a time slot.

The test at `appointments.test.ts:171-178` verifies that `overlapCount > 0` returns an error, but does not inspect which predicates are sent to the overlap query. The behavior (cancelled appointments block slots) is untested and undocumented.

**This is the key gap for Risk #4.** The test plan assumed cancelled appointments should NOT block slots; the implementation says they DO. A test is needed to make this behavior explicit — either documenting the current behavior or catching it as a bug to fix.

For `updateAppointmentAction`, the overlap query additionally includes `.neq('id', id)` (`index.ts:131`) to exclude the appointment being edited from its own overlap check — this is correct and is verified at `appointments.test.ts:202`.

### Time Computation

**Location**: `src/app/actions/appointments/index.ts:45-51`

```typescript
function computeTimes(date: string, start_time: string, tz: string, duration: string) {
  const localDt = parseDateTime(`${date}T${start_time}`)
  const zonedDt = toZoned(localDt, tz)
  const startsAt = zonedDt.toDate()
  const endsAt = new Date(startsAt.getTime() + Number(duration) * 60_000)
  return { startsAt, endsAt }
}
```

`parseDateTime` treats the input as a naive local datetime; `toZoned` anchors it to the provided `tz` identifier (e.g. `'Europe/Warsaw'`). The `tz` value is captured from the browser at render time (`AppointmentDetailModal.tsx:398`: `Intl.DateTimeFormat().resolvedOptions().timeZone`).

The existing test at `appointments.test.ts:146-148` verifies that `ends_at - starts_at = 60 minutes` for `duration: '60'`. It does not test that the timestamp is correctly anchored to the `tz` timezone — but this is outside Phase 1 scope (Phase 2 covers calendar time correctness).

### IDOR / Ownership Checks

All four actions include the ownership check. Summary by action:

| Action | Ownership predicate | Test coverage |
|---|---|---|
| `createAppointmentAction` | `insert({ trainer_id: user.id, … })` — server-sets, no bypass possible | `appointments.test.ts:142-144` ✓ |
| `updateAppointmentAction` | `.eq('id', id).eq('trainer_id', user.id)` | `appointments.test.ts:206-207` ✓ |
| `deleteAppointmentAction` | `.eq('id', id).eq('trainer_id', user.id)` | `appointments.test.ts:241-243` ✓ |
| `updateAppointmentStatusAction` | `.eq('id', id).eq('trainer_id', user.id)` | `appointments.test.ts:269-271` ✓ |

**The ownership predicates are present and tested.** Risk #5 is more covered than the test plan assumed.

**Untested IDOR scenario — silent no-op**: When the ownership filter matches 0 rows (trainer A provides trainer B's appointment ID), Supabase returns `{ error: null }` with 0 rows affected. The current action code does not check the number of rows affected, so it returns `{ success: true }` (update) or `{}` (delete/status) — a silent success. No test currently documents or challenges this behavior.

**RLS as the real guard**: The Supabase RLS policy (`supabase/schema.sql:60-62`) is `trainer_id = auth.uid()` for ALL operations. So even if the action-layer ownership check were missing, RLS would prevent cross-trainer access in production. The action-layer check is defense in depth.

### Status State Machine

**`updateAppointmentStatusAction`** (`index.ts:178-197`) accepts any of the four statuses with no business-logic guards. The UI (`AppointmentDetailModal.tsx:323-334`) presents all statuses except the current one as available transitions — fully unrestricted.

**Database constraint** (`supabase/migrations/20260603000001_add_appointment_status.sql`):
```sql
CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'))
```

There is no DB-level state machine (e.g. cannot go back from `completed` to `scheduled`). The transitions are fully open.

**Test coverage**: `appointments.test.ts:262-281` covers happy path (`completed`) and unauthenticated. Missing: testing each of the other valid statuses, verifying the TypeScript-level union is the only guard.

### Action Error-Path Gaps

Comparing against the reference `clients.test.ts` contract:

| Case | `createAppointmentAction` | `updateAppointmentAction` | `deleteAppointmentAction` | `updateAppointmentStatusAction` |
|---|---|---|---|---|
| Happy path | ✓ | ✓ | ✓ | ✓ |
| Validation failure | ✓ | ✓ | n/a | n/a |
| Unauthenticated | ✓ | ✓ | ✓ | ✓ |
| Overlap rejection | ✓ | **missing** | n/a | n/a |
| DB error | ✓ | **missing** | **missing** | **missing** |

### Existing Test Infrastructure

**Reference test file**: `src/app/actions/appointments/appointments.test.ts`

The mock helpers are more sophisticated than `clients.test.ts` — the `makeChain` function supports the full set of Supabase chainable methods (`select`, `insert`, `update`, `delete`, `eq`, `neq`, `lt`, `gt`) from a single self-referential object. `setupDualCallMock` handles the two-call pattern (overlap check then write) by returning different chains on successive `from()` calls. All new tests should reuse these helpers directly.

**Test runner**: Vitest 4.x, jsdom environment, `globals: true`. Run with: `npm run test` or `npx vitest run src/app/actions/appointments/appointments.test.ts`.

## Code References

- `src/app/actions/appointments/schema.ts:3-19` — Zod schema definition; all field validators
- `src/app/actions/appointments/index.ts:45-51` — `computeTimes()` — timezone-aware datetime computation
- `src/app/actions/appointments/index.ts:75-84` — overlap check in `createAppointmentAction`; no status filter
- `src/app/actions/appointments/index.ts:127-136` — overlap check in `updateAppointmentAction`; `neq('id', id)` + no status filter
- `src/app/actions/appointments/index.ts:150` — update ownership: `.eq('id', id).eq('trainer_id', user.id)`
- `src/app/actions/appointments/index.ts:169-170` — delete ownership: `.eq('id', id).eq('trainer_id', user.id)`
- `src/app/actions/appointments/index.ts:178-197` — `updateAppointmentStatusAction`; TypeScript-typed status, no runtime Zod validation
- `src/app/actions/appointments/appointments.test.ts:43-53` — `makeChain` helper; reuse for new tests
- `src/app/actions/appointments/appointments.test.ts:56-75` — `setupDualCallMock`; reuse for create/update tests
- `src/app/actions/appointments/appointments.test.ts:78-93` — `setupSingleCallMock`; reuse for delete/status tests
- `src/app/actions/appointments/appointments.test.ts:171-178` — existing overlap test (verifies error returned but not which predicates fire)
- `src/app/(app)/calendar/AppointmentDetailModal.tsx:323-334` — unrestricted status transition UI
- `src/app/(app)/calendar/AppointmentDetailModal.tsx:398` — browser timezone capture
- `src/app/(app)/calendar/types.ts:3` — `AppointmentStatus` type union
- `supabase/schema.sql:60-62` — RLS policy: `trainer_id = auth.uid()` for all operations
- `supabase/migrations/20260603000001_add_appointment_status.sql` — status `CHECK` constraint

## Architecture Insights

1. **Overlap check is status-blind by design or oversight.** The implementation treats all appointments — regardless of status — as time-blocking. There is no existing comment, test, or PRD requirement indicating this is intentional. The plan must surface this for the user to decide: is this the intended behavior, or should cancelled/no_show appointments free the slot?

2. **Two-call Supabase pattern.** Create and update each make two sequential `from('appointments')` calls: one for the overlap check (read) and one for the write. The `setupDualCallMock` helper in the existing test file was designed specifically for this and must be reused. New tests for the overlap predicate should spy on `overlapCh` methods.

3. **RLS is the real IDOR guard; action-layer checks are defense in depth.** The RLS policy at `supabase/schema.sql:60` covers all operations. The action-level `.eq('trainer_id', user.id)` is a fast-fail that avoids a pointless round-trip when the check would fail at the DB layer. Tests should verify both layers exist but should not rely on the mock to simulate the RLS behavior (the mock bypasses RLS).

4. **Status action has no Zod guard — TypeScript only.** `updateAppointmentStatusAction` takes a typed union parameter. In a Server Action context, TypeScript types are compile-time only; a malformed call at runtime (e.g. from a crafted fetch) could pass an invalid status string. The DB constraint is the runtime guard here. No need to add Zod unless the action is ever called from non-typed client code.

5. **`computeTimes` depends on a valid IANA timezone string.** If `tz` is an empty string or an invalid identifier, `toZoned` will throw. The schema validates `tz` is non-empty but does not validate it is a valid IANA identifier. Tests should pass `'Europe/Warsaw'` as the canonical value.

## Historical Context

- `context/archive/2026-06-01-client-management/plan.md` — Established the Supabase mock pattern (`vi.mock('@/lib/supabase/server')`, `buildQueryChain`, `makeFormData`). The appointment test file follows the same conventions with a more sophisticated chain builder.
- `context/foundation/test-plan.md §2` — Risk #4 and Risk #5 are the scope of this change. Research corrections noted below.

## Research Corrections to Test Plan §2

The following findings update the test plan's response guidance (may be backported to `context/foundation/test-plan.md §2` per the post-research backport check):

1. **Risk #4 source correction**: Hot-spot dir `src/app/actions/appointments/` was cited as "zero tests." In fact, `appointments.test.ts` exists with substantial coverage. The gap is specific: the overlap status-filter behavior is undocumented and the error-path cases for `updateAppointmentAction` and `deleteAppointmentAction` are missing.

2. **Risk #4 response guidance correction**: "Prove that a cancelled/no_show appointment does NOT block the slot" — this premise is wrong. The implementation includes all statuses. The correct challenge is: "Is this intentional? Either add a test documenting the inclusive-overlap behavior, or fix the query to add `.neq('status', 'cancelled').neq('status', 'no_show')` and test the exclusive behavior." Present this choice to the user during planning.

3. **Risk #5 response guidance confirmed**: The ownership predicates are present on all four actions and are tested. The residual gap is the silent no-op scenario, which should be added as one test per action showing that the filter chain fires even when no rows are matched.

## Open Questions

1. **Should cancelled/no_show appointments block time slots?** The implementation says yes (no status filter in overlap query). The test plan assumed no. This is a product decision that must be confirmed before the plan locks the overlap test contract.

2. **Should `updateAppointmentAction` return an error when 0 rows are updated** (i.e., the ID didn't match the trainer)? Currently it returns `{ success: true }`. The same question applies to `deleteAppointmentAction` (returns `{}`). Making the silent no-op explicit would require checking Supabase's `count` on the response.
