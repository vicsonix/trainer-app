# Appointment status write-path refactor — Plan Brief

> Full plan: `context/changes/refactor-opportunities/plan.md`
> Research: `context/changes/refactor-opportunities/research.md` (ranking) · `context/changes/appointment-status-consistency/research.md` (debt inventory)

## What & Why

The appointment `status` field is written by two seams that disagree: the server action enforces a future-appointment guard, but the AI tool writes the same column with **no guard and no revalidation**, and the guard's unit tests are currently **RED** (uncovered). This change closes both real risks and the latent revalidation gap, then proves the fix end-to-end — the decided slice **RO-B + RO-A(A1) + RO-D + RO-E** from the exploration.

## Starting Point

`updateAppointmentStatusAction` (`actions/appointments/index.ts:182`) guards future completions and revalidates only `/calendar`; the AI tool `update_appointment_status` (`lib/ai/tools/appointments.ts:129`) bypasses the guard entirely. `/analytics` and `/dashboard` derive every status KPI but are never revalidated (correct today only because they render dynamically). No E2E crosses the calendar→analytics boundary; `appointments.test.ts` fails 3/30 because its mock lacks `.single()`.

## Desired End State

Future completions are rejected on both the UI and AI-chat paths with the same message; a status write revalidates calendar + analytics + dashboard; the guard has explicit passing coverage; and one Playwright spec proves marking an appointment `completed` in the calendar increments the analytics count. The suite is green throughout.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope | RO-B + RO-A(A1) + RO-D + RO-E | Closes both real risks + latent one, and proves the target risk end-to-end | Plan |
| Guard unification shape | A1 — shared guard helper only | Removes the AI-bypass with the smallest diff; defer broader write-core dedup | Plan |
| Revalidation | Revalidate all three surfaces now | Near-zero-cost insurance against a future static/ISR change | Plan |
| Test depth | Full guard coverage (harness fix + branches) | The guard is the business rule; cover it, don't just un-red the suite | Plan |
| Guard vs enforcement | Land helper green (Ph3), flip AI enforcement separately (Ph4) | Mechanism-green-then-explicit-enforcement discipline | Plan |
| Out of scope | RO-C, RO-F, RO-G | Cheaper/CI-caught or lower-risk; keep this change tight | Research |

## Scope

**In scope:** guard test coverage; shared guard helper used by both writers; AI-tool enforcement; three-surface revalidation; one cross-boundary E2E.

**Out of scope:** enum single-source-of-truth (RO-C), edit-time drift guard (RO-F), verify-write-before-UI (RO-G); revalidation for create/update/delete; schema/enum changes; live-DB migration verification (U2).

## Architecture / Approach

Introduce a plain `src/lib/appointments/status-guard.ts` module (`assertCompletable`) that both the `'use server'` action and the AI tool import. The server action is routed through it behavior-preserving first; enforcement in the AI tool is a separate, auditable flip. Tests come first and stay green at every phase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Characterize + green (RO-B) | Mock harness fix; guard branch tests; AI-tool current behavior pinned | Mock redesign for the guard's two-call shape |
| 2. Revalidation (RO-D) | Both writers revalidate calendar+analytics+dashboard | `revalidatePath` callable in the AI tool's route context (asserted) |
| 3. Shared guard helper (RO-A mechanism) | `assertCompletable`; server action routed through it, no behavior change | Behavior drift — caught by Phase 1 tests staying green unchanged |
| 4. AI-tool enforcement (RO-A flip) | AI tool rejects future completions; test flipped permissive→blocking | The one deliberate behavior change; keep it isolated |
| 5. Cross-boundary E2E (RO-E) | Calendar status change → analytics count asserted | Seeding a past-dated appointment; analytics period selection |

**Prerequisites:** none beyond the existing Vitest + Playwright setup and `playwright/.auth/user.json`.
**Estimated effort:** ~2-3 sessions across 5 small phases (5 reversible commits).

## Open Risks & Assumptions

- `revalidatePath` inside the AI tool's `execute` runs in the `/api/ai/chat` route handler and should be callable; Phase 2 asserts no-throw. If it can't, the server-action revalidation still stands and the AI path falls back to dynamic rendering.
- The E2E depends on `createAppointmentAction` accepting a past date (it does — no past-date block) and on selecting an analytics period that includes the seeded date.
- Dynamic rendering currently masks the revalidation gap; RO-D is insurance, so its user-visible effect today is "no regression," verified manually.

## Success Criteria (Summary)

- Future completions blocked on **both** the calendar UI and the AI chat, same Polish message.
- A status write refreshes analytics and dashboard, not just the calendar.
- Guard has passing unit coverage; the full suite is green; one E2E proves calendar→analytics consistency.
