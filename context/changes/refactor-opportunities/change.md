---
change_id: refactor-opportunities
title: Rank refactor opportunities from the status write-path tech-debt analysis
status: plan_reviewed
created: 2026-07-03
updated: 2026-07-03
archived_at: null
---

## Notes

Intent: we have an analysis of this repository that documents the technical debt and structural risks of the appointment status write-path: `context/changes/appointment-status-consistency/research.md`. This change answers the question that analysis deliberately left open: WHICH of those problems are worth fixing, in what target shape, and in what order. We explore each documented problem (TD-1…TD-6 and the open questions) in the code and in git history, then organize them as ranked refactor opportunities.

Scope of the input: this exploration is grounded in the `appointment-status-consistency` research — the appointment `status` field, its two production write sites (the server action and the AI tool), the four read surfaces (calendar, analytics, dashboard, AI assistant), the future-appointment guard, the RED test suite, the revalidation mismatch, and the enum duplication.

The change proceeds in phases: exploration → decision & plan → implementation. During exploration no refactor happens and no decision is made. Output of exploration: this change's own `research.md`, ending in a ranked list of options with trade-offs. The decision on what we actually implement is made during planning, and the refactor only starts according to the accepted plan.
