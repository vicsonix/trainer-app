---
date: 2026-07-03T22:10:00+02:00
researcher: Claude Opus 4.8 (pair: Victoria)
git_commit: fb83301b91fcac99efaa88da3a6d2b1adabc7332
branch: chore/documentation-update
repository: trainer-app
topic: "Which appointment-status tech-debt items to refactor, in what shape, in what order"
based_on: context/changes/appointment-status-consistency/research.md
tags: [research, refactor, tech-debt, appointments, status, ranking, trade-offs]
status: complete
last_updated: 2026-07-03
last_updated_by: Claude Opus 4.8
---

# Research: Refactor opportunities from the appointment-status analysis

**Date**: 2026-07-03T22:10:00+02:00
**Researcher**: Claude Opus 4.8 (pair: Victoria)
**Git Commit**: fb83301b91fcac99efaa88da3a6d2b1adabc7332
**Branch**: chore/documentation-update
**Input analysis**: `context/changes/appointment-status-consistency/research.md`

## Research Question

The `appointment-status-consistency` analysis inventoried the technical debt and structural risk of the appointment `status` write-path but deliberately left one question open: **which of those problems are worth fixing, in what target shape, and in what order?** This document explores each documented problem in the code and git history and organizes them as *ranked refactor opportunities with trade-offs*.

## Method & scope (what this phase is — and is not)

- **Grounded in** the `appointment-status-consistency` research: the `status` field, its **two** production write sites (server action + AI tool), the **four** read surfaces (calendar, analytics, dashboard, AI assistant), the future-appointment guard, the RED test suite, the revalidation mismatch, and the enum duplication. All structural claims there were ast-grep-verified.
- **This is exploration only.** No refactor is performed and no decision is made here. The output is a ranked options list. The decision on what we implement is made in the planning phase; code changes start only per the accepted plan.
- **New verification done this phase** (to make the ranking honest): read `updateAppointmentAction`/`createAppointmentAction` in full (`index.ts:53-162`) and the AI tool factory (`tools/appointments.ts:1-40`). Findings folded in below (closes open questions U4 and the "can the guard be shared?" question).

## Classification lens

Every opportunity is tagged along two axes the input analysis asked us to separate:

- **Real vs. cheap** — *Real* = silent, wrong behavior, nothing catches it automatically. *Cheap* = already caught by CI/typecheck/a red test; mechanical to fix, low judgement.
- **Coupling / test-gap / blast-radius** — which kind of risk it is.

---

## Cross-cutting finding (frames everything below)

There are **two parallel appointment-write implementations** that were never unified:

| Concern | Server action (`actions/appointments/index.ts`) | AI tool (`lib/ai/tools/appointments.ts`) |
|---|---|---|
| `computeTimes` | `:45-51` | **duplicated** `:6-12` (identical) |
| overlap check | `:75-82`, `:129-137` | **duplicated** `:35-40+` |
| trainer-scoping | `.eq('trainer_id', user.id)` | `.eq('trainer_id', userId)` |
| future-appointment guard | `:191-201` (present) | **absent** |
| `revalidatePath` | `/calendar` | **none** |
| status enum | inline union `:184` | `z.enum(...)` `:133` |

**EVIDENCE.** The AI tool factory receives `(supabase, userId)` (`appointments.ts:25`) — the same primitives the server action gets from `createClient()` + `getUser()`. So a shared, guarded write core is technically feasible and is the natural home for the guard, the overlap check, and `computeTimes`.

**INFERENCE.** TD-1 (guard divergence) is not an isolated bug — it is one symptom of this un-unified duplication. Any ranking should treat "one write path" as the structural fix and the individual symptoms (guard, revalidation, enum) as things that either fold into it or stand alone.

---

## Problem catalog → refactor opportunities

Each entry: current state (file:line) · why it matters (real/cheap) · target-shape options · trade-offs · effort · dependencies.

### RO-A — Unify the two write seams behind one guarded write core
- **Source**: TD-1 + the cross-cutting finding.
- **Current state (EVIDENCE)**: guard only in `index.ts:191-201`; AI tool writes `.update({ status })` unguarded (`appointments.ts:138-142`) with `needsApproval:true` (`:135`) but no date check and no revalidation; `computeTimes`/overlap duplicated.
- **Why it matters**: **REAL / fragile-coupling.** A trainer can approve "mark this future session completed" in chat and it persists — inflating analytics revenue/counts. Nothing catches it (no type error, no test).
- **Target-shape options**:
  - **A1 — Extract a shared guard helper only.** `assertCompletable(supabase, id, userId, status)` in a neutral module; both writers call it. *Smallest diff, kills the divergence.* Leaves computeTimes/overlap duplicated.
  - **A2 — Extract a shared "appointment write core"** (guard + overlap + computeTimes + revalidate targets) that both the server action and the AI tool call. *Removes all write duplication; one place to change the rules.* Bigger diff; must keep `'use server'` boundary clean (the core is a plain module, not a server action).
  - **A3 — Make the AI tool call the server actions directly.** *Zero logic duplication.* But server actions are `'use server'` form-shaped (`FormData`, `_prevState`) — awkward to call from a tool; would need a non-form internal function anyway (collapses into A2).
- **Trade-offs**: A1 is cheapest and removes the acute risk; A2 is the real structural win but more churn and needs tests first; A3 is not clean given the server-action shape.
- **Effort**: A1 S · A2 M. **Dependencies**: safest *after* RO-B (tests exist).

### RO-B — Fix the RED suite and actually cover the guard
- **Source**: TD-2.
- **Current state (EVIDENCE)**: `appointments.test.ts:49` mock `makeChain` list is `['select','insert','update','delete','eq','neq','lt','gt']` — no `single`; the guard calls `.single()` (`index.ts:197`) → **3 failing tests** (verified: `3 failed | 27 passed`). Guard branches (blocks-future / passes-past) have zero passing coverage.
- **Why it matters**: **Mixed.** The *red suite* is **cheap** (CI catches it; add `single` to the mock). The *missing guard coverage* is **real** — the core business rule is unprotected, and even with `.single()` added, `setupSingleCallMock` (`:78-93`) returns one shared chain and can't feed the guard a past-vs-future `starts_at`, so the mock harness needs a small redesign to distinguish the guard read from the update.
- **Target shape**: add `single` to the method list; give the harness a way to return distinct chains (guard read vs. write); add branch tests: future→blocked (error string asserted), past→update+revalidate asserted, for **both** write paths once RO-A lands.
- **Trade-offs**: do minimally now (unblock CI) vs. do fully (harness redesign + guard tests). Doing it before RO-A means the refactor is covered.
- **Effort**: S (unblock) → M (full). **Dependencies**: none to start; pairs with RO-A.

### RO-C — Single source of truth for the status enum
- **Source**: TD-4.
- **Current state (EVIDENCE)**: the 4-value set is hand-copied across **8-9 sites** (`types.ts:3` union · `index.ts:184` inline union · `appointments.ts:133` zod · `AppointmentDetailModal.tsx:330` array, `:186` + `:193` Records · `dashboard/page.tsx:54` · `tool-formatters.ts:1` · SQL `20260603000001…sql:4`). `dashboard/page.tsx:54` **already drifted** (3 keys, missing `scheduled`, wording differs).
- **Why it matters**: **Split.** The 3 `Record<AppointmentStatus,…>` maps are compiler-checked = **cheap** (a new value fails the build). The **loose** `Record<string,string>` maps (dashboard, tool-formatter), the button array, the zod enum, the inline union, and the SQL CHECK are **real** silent-drift risks — and one has *already* drifted.
- **Target shape**: one exported `APPOINTMENT_STATUSES` tuple + derived `type AppointmentStatus`; derive zod via `z.enum(APPOINTMENT_STATUSES)`; type all label maps `Record<AppointmentStatus,string>` so drift becomes a compile error; the SQL CHECK cannot import TS — keep it, but add a note/test that pins it to the tuple.
- **Trade-offs**: touches ~8 files (churn, cross-cuts calendar/analytics/dashboard/AI), but each edit is mechanical. Highest value from converting the *loose* maps to typed ones — that alone removes the class of bug that already bit.
- **Effort**: M. **Dependencies**: independent; do the loose-map fixes even if the full SSOT is deferred.

### RO-D — Correct/​harden revalidation for the read fan-out
- **Source**: TD-3.
- **Current state (EVIDENCE)**: status writes revalidate only `/calendar` (`index.ts:211`; AI tool none). `/analytics` + `/dashboard` read status but are never revalidated. No `export const dynamic/revalidate` anywhere (ast-grep 0) → pages are dynamic via per-request `cookies()`.
- **Why it matters**: **Latent, not real today.** Dynamic rendering masks the mismatch (next visit re-queries). It becomes a real staleness bug the moment any of these pages is made static/ISR.
- **Target shape**: when RO-A lands, have the write core revalidate `/calendar`, `/analytics`, `/dashboard` together; or, cheaper, add a comment + a guard test asserting these pages stay dynamic.
- **Trade-offs**: fixing now is near-zero-cost insurance but touches a currently-working path; deferring is defensible given dynamic rendering.
- **Effort**: S. **Dependencies**: folds cleanly into RO-A.

### RO-E — End-to-end test crossing the status boundary
- **Source**: TD-5.
- **Current state (EVIDENCE)**: `calendar.spec.ts:10-51` creates then deletes, never sets a status; `analytics.spec.ts:3-72` asserts headings/tabs/"cards-or-empty", no numeric value. No test changes a status in the calendar and asserts the analytics/dashboard number moves.
- **Why it matters**: **REAL / test-gap for the exact target risk.** The whole reason this flow was picked is "does a status change survive to analytics?" — and nothing protects it.
- **Target shape**: one Playwright spec (getByRole, storageState, unique client + cleanup) that books a past-dated appointment, marks it `completed`, and asserts the analytics "completed" count / dashboard tile increments.
- **Trade-offs**: highest-signal test but the most setup (needs deterministic seed data + a past-dated appointment). Guards the risk end-to-end where unit tests can't.
- **Effort**: M. **Dependencies**: strengthened by RO-B but independent.

### RO-F — Prevent status/date drift on edit (closes U4)
- **Source**: open question U4 — **now confirmed**.
- **Current state (EVIDENCE)**: `updateAppointmentAction` (`index.ts:106-162`) rewrites `starts_at`/`ends_at` but never touches or re-validates `status`. A `completed`/`no_show` appointment can be edited to a future date, leaving status inconsistent with the date. The guard only fires in the status action.
- **Why it matters**: **REAL but low-frequency / correctness.** Analytics would count a future session as completed after such an edit.
- **Target shape**: in `updateAppointmentAction`, if new `starts_at` is in the future and status ∈ {completed,no_show}, either reject or reset status to `scheduled`; reuse the shared guard from RO-A.
- **Trade-offs**: tiny logic add; the product decision (reject vs. auto-reset) belongs to planning.
- **Effort**: S. **Dependencies**: natural once RO-A's guard exists.

### RO-G — Client trusts unverified write success
- **Source**: TD-6.
- **Current state (EVIDENCE)**: `.update()` matching 0 rows returns no error (`index.ts:203-209`); the modal sets the new badge on any `{}` result (`AppointmentDetailModal.tsx:244`).
- **Why it matters**: **Low / real-but-guarded.** RLS + trainer scoping make a 0-row match unlikely; the UI would briefly show a success it didn't verify.
- **Target shape**: return affected-row count (or `.select()` the updated row) and only update UI on a confirmed write.
- **Effort**: S. **Dependencies**: none. Lowest priority.

---

## Ranked refactor opportunities (the deliverable)

Ranking blends: severity of *real* risk, whether CI already catches it, cost, and dependency order. **These are options, not a decision.**

| Rank | Opportunity | Risk kind | Real/cheap | Effort | Why here |
|------|-------------|-----------|-----------|--------|----------|
| **1** | **RO-B** — fix RED suite + cover the guard | test-gap | red-now (cheap) → real | S→M | A red suite blocks everything and you want tests *before* refactoring the write path. Unblocks CI immediately; the guard coverage is the real prize. |
| **2** | **RO-A** — unify write seams behind one guarded core | fragile coupling | **REAL** | S(A1)→M(A2) | Kills the only behavioral risk that ships wrong data silently (AI bypass). Do after RO-B so the refactor is covered. Start A1 (guard) if time-boxed; A2 if removing all write duplication. |
| **3** | **RO-D** — correct revalidation | blast-radius (latent) | latent | S | Near-zero cost when folded into RO-A's write core; removes a future landmine. |
| **4** | **RO-E** — E2E status→analytics test | test-gap | **REAL** | M | Protects the exact target risk end-to-end; independent of the refactor but best after RO-B's harness work. |
| **5** | **RO-C** — status enum SSOT | fragile coupling | mixed (loose maps REAL) | M | Mechanical but wide; prioritize converting the 2 loose `Record<string,string>` maps (one already drifted) — that removes the proven bug class. Full SSOT optional. |
| **6** | **RO-F** — drift guard on edit (U4) | correctness | REAL, low-freq | S | Small; slots in once RO-A's guard helper exists. |
| **7** | **RO-G** — verify write before UI success | correctness | low | S | Nice-to-have; RLS already makes it unlikely. |

### Suggested sequencing rationale
1. **Tests before refactor**: RO-B first — you cannot safely unify the write path (RO-A) on a red suite with an untested guard.
2. **Structural fix next**: RO-A removes the real behavioral risk and creates the single home that RO-D and RO-F then plug into cheaply.
3. **End-to-end proof**: RO-E locks in the cross-boundary guarantee the map flagged.
4. **Mechanical cleanups**: RO-C (loose maps first), then RO-F, RO-G as capacity allows.

A defensible **minimal slice** = RO-B + RO-A(A1) + RO-D: unblocks CI, closes the AI-bypass, and fixes revalidation, in one coherent change. Everything else is incremental.

---

## What is explicitly NOT decided here

- Whether to do RO-A as A1 (guard-only) or A2 (full write core) — a scope/effort trade-off for planning.
- RO-F product choice: reject the edit vs. auto-reset status to `scheduled`.
- Whether RO-C goes full SSOT or just fixes the two loose maps.
- Whether RO-D is worth doing while rendering is dynamic, or deferred with a pinning test.

These are planning-phase decisions. This document ranks the options and their trade-offs only.

## Open questions still remaining

- **U2 (unchanged, UNKNOWN)**: are the migrations (`…status`, `…pgvector`, `…conversations`) applied to the live Supabase instance? Not answerable from the repo; affects nothing in this ranking but blocks any deploy-time assumption.
- **U3 (product)**: revenue counts only `completed` appointments with non-null `price` (`analytics/page.tsx:88`) — intended "N of M priced" or a data hole? A reporting decision, not a refactor; parked unless planning pulls it in.
- **CI**: is `appointments.test.ts` actually run in CI (i.e., is the pipeline red now)? Worth confirming before RO-B is scheduled, since it changes urgency.

## Related

- `context/changes/appointment-status-consistency/research.md` — the debt inventory this ranking consumes (evidence, ast-grep verification, blast radius).
- `context/map/repo-map.md` — the risk-zone selection that led here.
