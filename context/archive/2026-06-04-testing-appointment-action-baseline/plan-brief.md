# Appointment Action Baseline — Plan Brief

> Full plan: `context/changes/testing-appointment-action-baseline/plan.md`
> Research: `context/changes/testing-appointment-action-baseline/research.md`

## What & Why

Fix a status-filter bug in the overlap query and fill the remaining Vitest integration test gaps for all four appointment CRUD actions. This closes test-plan Risks #4 (overlap/status logic untested) and #5 (IDOR ownership check coverage) by making the behavior of every action explicit and regression-proof.

## Starting Point

`src/app/actions/appointments/appointments.test.ts` already exists with solid happy-path and auth-failure coverage for all four actions. The two gaps: (1) the overlap query in `index.ts` includes cancelled/no_show appointments — a bug — and (2) several error-path and predicate-assertion cases are missing across `updateAppointmentAction`, `deleteAppointmentAction`, and `updateAppointmentStatusAction`.

## Desired End State

The overlap query correctly excludes cancelled and no_show appointments. All test gaps identified in research are closed. `npm run test`, `npm run lint`, and `npx tsc --noEmit` pass clean with no new debt.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Cancelled/no_show in overlap | Free the slot (fix the query) | Trainer should be able to rebook a cancelled slot | Plan |
| Silent IDOR no-op | Document with tests, no code change | RLS is the real guard; misleading success is a known tradeoff | Plan |
| Phase structure | 2 phases: fix first, then fill gaps | Keeps the production change reviewable in isolation | Plan |

## Scope

**In scope:**
- Add `.neq('status', 'cancelled').neq('status', 'no_show')` to both overlap queries in `index.ts`
- Schema tests: `tz` required, `price` format, `package_id` UUID
- Overlap predicate assertions (verify the fix fires in tests)
- `updateAppointmentAction`: overlap rejection + DB error
- `deleteAppointmentAction`: DB error
- `updateAppointmentStatusAction`: remaining 3 valid statuses
- IDOR silent no-op: one documentation test per mutation action

**Out of scope:** E2E tests, status state machine changes, return-type changes, revalidatePath path changes.

## Architecture / Approach

Two files only: `src/app/actions/appointments/index.ts` (Phase 1 production fix) and `src/app/actions/appointments/appointments.test.ts` (both phases). All test helpers (`makeChain`, `setupDualCallMock`, `setupSingleCallMock`) already support the new assertions — no infrastructure changes needed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Fix overlap + schema tests | Correct production behavior + schema coverage | `makeChain` neq spy must be verified before asserting |
| 2. Fill action test gaps | Full coverage of all error paths, statuses, and IDOR behavior | IDOR no-op tests must name their intent clearly to avoid future confusion |

**Prerequisites:** None — all relevant code is already implemented.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- The `makeChain` helper at `appointments.test.ts:49` includes `neq` as a spy — verified in research. If this changes, Phase 2 predicate assertions will need updates.
- The IDOR no-op behavior (success returned on 0-row match) is documented but not fixed. A future plan may address this if it causes production issues.

## Success Criteria (Summary)

- `npm run test` passes clean with all new cases green
- The overlap query in `index.ts` excludes cancelled/no_show (verifiable via the new predicate assertion tests)
- Every gap from `research.md` §Open Questions is resolved or explicitly documented
