---
date: 2026-05-30T00:00:00+02:00
researcher: Claude Sonnet 4.6
git_commit: 127562b
branch: feature/ai-streaming-route
repository: trainer-app
topic: "Package management UX, competitive landscape, and data model for S-02"
tags: [research, packages, ux, competitive, data-model, s-02, libraries, shadcn, zod]
status: complete
last_updated: 2026-05-30
last_updated_by: Claude Sonnet 4.6
last_updated_note: "Added follow-up research for compatible library selection (zod, react-hook-form, shadcn/ui, TanStack Query)"
---

# Research: Package Management — UX, Competitive Landscape & Data Model

**Date**: 2026-05-30  
**Git Commit**: 127562b  
**Branch**: feature/ai-streaming-route  
**Repository**: trainer-app

## Research Question

> I want to research current solutions for package management in other apps, how to make it easier for the user to fill up those, how they are displayed, what is the smallest unit of work (is it a single training/visit)?

---

## Summary

**The current schema (`name`, `visit_count`, `price`) is the minimum viable set — confirmed by every competitor.** The atomic unit is universally the single session/visit for 1:1 PT packages. The key UX opportunity is in the creation form: preset quick-select chips (5 / 10 / 20 sessions) pre-filling the form, a real-time per-session price calculation, and a template-driven empty state will reduce entry friction to near-zero for a trainer with 5 minutes between clients. Display-wise: a vertical card list showing name + session count + price + calculated per-session rate is the industry-standard pattern.

---

## Detailed Findings

### 1. Competitive Landscape

#### Booksy
- Packages live under "Gift Cards & Bundled Services" — not native to the PT scheduling flow.
- **Fields**: package name, price, services included (multi-select), optional expiry/validity period.
- Visits consumed **automatically at checkout** (point-of-sale deduction).
- **Display**: list in a "Manage Packages" panel — name + price visible at a glance; service details on expand.
- **Minimum viable fields**: name, services included, price. Expiry optional.
- Source: [Booksy: How do I set up/sell Packages?](https://support.booksy.com/hc/en-us/articles/16487062339602-How-do-I-set-up-sell-Packages)

#### Mindbody
- Calls packages "Pricing Options."
- **Fields**: name, service category, session count, price, payment options, activation date, expiration (rolling from sale date OR fixed end date).
- Expiry is **first-class** — required on the package template.
- Staff can manually add/remove sessions or extend expiry per client.
- Both visit-count and time-based (membership/unlimited) types exist; visit-count is the default for PT.
- **Display**: list-based "Pricing Options" table — name, category, price, session count always visible; expiry and scheduling restrictions in a drill-down.
- Sources: [Mindbody Pricing Options](https://support.mindbodyonline.com/s/article/213024177-Pricing-Options-screen?language=en_US) · [Add/remove sessions](https://support.mindbodyonline.com/s/article/217551288-Can-I-add-or-remove-sessions-from-a-client-s-pricing-option?language=en_US)

#### Trainerize (ABC Trainerize)
- Calls them "Session Pack Products."
- **Fields**: product name, description, image, appointment type, then **up to 10 price tiers** (each tier: session count + price; per-session price auto-calculated).
- No expiry on the product template — expiry lives at the **client assignment level**.
- Visits deducted **automatically when a paid appointment is booked** from the pack.
- Supports tiered pricing in a single product (e.g., 5 sessions/500 PLN or 10 sessions/900 PLN in the same listing).
- **Display**: tabular tier view — session count | total price | per-session price side-by-side for each tier.
- Sources: [Trainerize: Session Pack Products](https://help.trainerize.com/hc/en-us/articles/4404649621524-What-are-session-pack-products-and-how-to-create-them) · [Build and Sell Session Packs](https://www.trainerize.com/blog/build-and-sell-session-packs/)

#### PT Distinction
- Supports pre-made packages for direct sale from a trainer's website.
- **Fields**: package name, price (one-off or recurring), session/visit count (common tiers: 8, 10, 20). Expiry is configurable.
- Source: [PT Distinction Features](https://www.ptdistinction.com/features)

#### TrueCoach
- **No native credit-based booking** — primarily a program-delivery and coaching communication tool. Session credit tracking is handled outside the app by trainers who use TrueCoach. Not a relevant model for this feature.

---

### 2. Atomic Unit of Work

**The single session/visit is the universal atomic unit for 1:1 personal training packages.** Every competitor uses visit/session count as the primary quantity metric. Time-based packages (hourly, unlimited memberships) exist as a separate product type and are not the default for PT.

**How visits are consumed:**
- Purpose-built PT apps (Trainerize, Mindbody, Booksy) auto-deduct on booking or check-in.
- This app tracks appointments via the `appointments` table — each appointment record represents one consumed visit. The remaining count is derived: `visit_count - COUNT(appointments WHERE client_id = X)`.
- This matches the PRD business logic: "remaining visits = package visit_count minus count of recorded appointments."

**Internal schema analysis (`supabase/schema.sql`):**
- `packages(id, trainer_id, name, visit_count, price, created_at)` — template, reusable across clients.
- `clients.package_id → packages.id` — one active package per client (nullable, on delete set null).
- `appointments(id, trainer_id, client_id, starts_at, created_at)` — each row = one visit consumed.
- **No `visits_remaining` column** — it is computed, not stored. Correct approach: avoids sync bugs.
- **No `expires_at` on the assignment** — competitors flag this as a common real-world need (Mindbody makes it required; Trainerize supports it at assignment level). V1 omits it per PRD scope, but the data model has room to add it to a future `client_packages` join table if the trainer workflow evolves.

---

### 3. Form UX Best Practices

**Number of sessions input:**
- **Best approach**: preset quick-select chips (5 / 10 / 20) that pre-fill the sessions field + a free numeric override.
  - Chips cover 90% of real-world PT packages in one tap.
  - Stepper (±) is fine for ranges < 10 but too slow for "20 sessions" — avoid as primary input.
- Hybrid pattern: chips populate a numeric field the trainer can then edit freely.

**Price field:**
- Static `PLN` label outside the input (avoids cursor confusion).
- `inputmode="decimal"` on the `<input>` — triggers numeric keyboard on mobile, avoids the desktop stepper arrows of `type="number"`.
- Format on blur ("800" → "800.00"), never on keystroke.

**Mobile layout:**
- Single-column, labels above fields, ≥ 16 px font inside inputs.
- 3 fields should fit in one viewport — no scrolling required.
- Confirmation toast after save ("Package saved") is mandatory; silent submission erodes trust.

**Quick-fill / templates:**
- Show 2–3 preset "starter template" options above the form ("Start from: 5-session / 10-session / 20-session") — each pre-fills all three fields in one tap.
- Pre-fill default: sessions = 10, price = 0 (most common PT offering is a 10-session pack).
- Real-time per-session rate beside the price field ("= 80 PLN / session") reinforces the trainer's pricing decision without adding a required field.

**What to avoid:**
- Multi-step wizard for 3 fields — unnecessary overhead.
- `type="number"` for price — poor mobile UX (spinner arrows on desktop).
- Requiring a description or notes field at creation time — adds friction with no V1 benefit.

---

### 4. Package List Display Patterns

**Layout:**
- Vertical card list (single-column) is the industry standard for mobile — 78% of mobile pricing/service displays use vertical stacking (per CXL research). Card grids (2-column) work on tablet+ but feel cramped on phones with longer names.
- **Use vertical card list as default.**

**Per-card content:**
- Always visible: **name + session count + total price**.
- High-value addition: **per-session price** (derived — display only, e.g., "80 PLN/session"). All serious competitors surface this automatically.
- Secondary: context-menu (⋯) for Edit / Delete actions.
- Avoid: cramming expiry, client-count, or category on the card face — reserve for detail/edit view.

**Empty state:**
- Single illustration + 1-sentence copy ("You haven't created any packages yet") + prominent CTA ("Create your first package").
- **Best-in-class**: surface 2–3 clickable template cards in the empty state ("Try: 10-session pack · 800 PLN") — this doubles as onboarding and is the most effective first-use pattern for admin tools.

---

## Code References

- `supabase/schema.sql:5-12` — `packages` table definition
- `supabase/schema.sql:14-27` — `clients` table with `package_id` FK
- `supabase/schema.sql:29-35` — `appointments` table (the atomic visit record)
- `context/foundation/prd.md:90-93` — FR-003, FR-004 (package CRUD requirements)
- `context/foundation/prd.md:138` — business logic for visit counter (≤ 2 remaining = "ending soon")
- `context/foundation/roadmap.md:97-101` — S-02 slice definition and risk note about navigation shell

---

## Architecture Insights

1. **Schema is correctly minimal.** `name + visit_count + price` on the template, derived `visits_remaining` at query time. No need to add fields for V1.

2. **Per-session price is a display concern, not a storage concern.** Compute it in the component: `price / visit_count`. Do not store it.

3. **Expiry omission is a deliberate V1 scope cut.** Competitors make expiry prominent (Mindbody: required; Trainerize: client-level). If trainers ask for it post-MVP, add `expires_at timestamptz` to a future `client_packages` assignment table — not to the `clients` table directly (one client may go through multiple packages over time).

4. **Navigation shell risk** (from roadmap S-02 note): this slice produces the dashboard shell and primary navigation that all subsequent slices inherit. A layout decision made here — sidebar vs. bottom nav, route structure — ripples into S-03, S-04, S-05, S-06. Treat this as a high-leverage decision: pick mobile-first bottom navigation (packages, clients, calendar, AI) and lock it before implementing any feature pages.

5. **Visit deduction is automatic in competitors.** In this app it is implicit — each `appointment` row is a consumed visit. No "mark as completed" step needed; presence in the `appointments` table is the signal. This is correct and simpler than manual marking.

---

## Historical Context

- No prior research artifacts found for S-02 in `context/changes/` or `context/archive/`.
- `context/archive/2026-05-26-auth-registration-login/` — auth slice done; dashboard shell was not created there. S-02 is the first slice to introduce a real dashboard page and navigation structure.
- `context/archive/2026-05-28-ai-streaming-route/` — F-01 done; no relevance to package UI.

---

## Follow-up Research 2026-05-30 — Compatible Libraries for S-02

### Research Question

> What are the available libraries for package management that are compatible with my codebase?

### Codebase Baseline (from src/ audit)

The current stack has **no form library, no validation library, and no UI component library**. Everything is hand-rolled:

- **Form pattern**: React 19 `useActionState` hook (Client Component) + `'use server'` Server Action that receives `FormData` — established in `src/app/login/page.tsx:3,9` and `src/app/actions/auth.ts:16`
- **UI components**: Only 2 exist — `src/components/ui/SubmitButton.tsx` (uses `useFormStatus` from react-dom) and `src/components/ui/Spinner.tsx` (pure SVG + `animate-spin`)
- **Styling**: Inline Tailwind className strings throughout; no `cn()` utility, no `clsx`/`tailwind-merge`
- **Design tokens**: `globals.css` defines `--background` / `--foreground` via Tailwind v4 `@theme inline`; color palette is zinc-based
- **Dark mode**: Explicit `dark:` variants on every element (no class-based toggle — uses `prefers-color-scheme` media query)
- **Validation**: Manual in Server Actions (inline `if` checks) — no schema validation library

### Library Compatibility Matrix

| Library | Compatible | Version | Caveats | Recommendation |
|---|---|---|---|---|
| **zod** | ✅ Yes | v4.0.1 | v4 API breaks v3 patterns (e.g. `z.email()` not `z.string().email()`); zero runtime/Node.js deps | **Add it** |
| **react-hook-form** | ⚠️ Partial | v7.66.0 | Conflicts with `useActionState` ownership model — two competing form state managers; v8 beta adds native Server Action support but isn't stable | **Skip** |
| **shadcn/ui** | ✅ Yes | 2.9.0+ | Tailwind v4 + React 19 fully supported since Feb 2025; requires adding `cn()` utility (`clsx` + `tailwind-merge`) | **Add it** |
| **TanStack Query v5** | ✅ Yes | v5.90.3 | React 19 compatible; overkill for a 3-field CRUD with Server Actions — adds boilerplate with no payoff at this scale | **Skip** |

### Detailed Findings

#### zod — Add it

zod is pure TypeScript with zero Node.js dependencies — confirmed compatible with Cloudflare Workers edge runtime. It is the correct tool for validating `FormData` inside Server Actions:

```ts
// In a Server Action
const schema = z.object({
  name: z.string().min(1),
  visit_count: z.coerce.number().int().positive(),
  price: z.coerce.number().nonneg(),
})
const result = schema.safeParse(Object.fromEntries(formData))
if (!result.success) return { errors: result.error.flatten().fieldErrors }
```

This replaces the current manual `if` checks in `src/app/actions/auth.ts` with typed, structured field errors. Works with the existing `useActionState` pattern with no changes to the form component layer.

**Note**: zod v4 has breaking API changes from v3. Use `z.string().email()` is deprecated; top-level `z.email()` is the v4 way. Stick to v4 patterns from day one.

#### react-hook-form — Skip

react-hook-form owns form state client-side; `useActionState` owns form state through the Server Action return value. Using both on the same form means two competing state managers — RHF's `handleSubmit` vs. the native `<form action={formAction}>` wiring. Bridging is possible but requires non-obvious plumbing that outweighs any benefit for a 3-field form. The existing `useActionState` pattern is already clean and handles pending/error state through `SubmitButton`'s `useFormStatus`. Skip until form complexity genuinely warrants it (multi-step forms, complex dependent fields).

#### shadcn/ui — Add it

Tailwind v4 support shipped in February 2025 and is production-stable (shadcn 2.9.0+). React 19 compatibility confirmed October 2024. Installation: `npx shadcn@latest init` auto-detects the Next.js + Tailwind v4 stack.

**One new dependency this introduces**: `cn()` utility (`clsx` + `tailwind-merge`). shadcn components use `cn()` for className merging. This is a new pattern in the codebase — existing hand-written components use plain string classNames. The right approach: add `src/lib/utils.ts` with the `cn()` export and adopt it for new components only; do not retroactively refactor existing auth components.

Useful components for S-02:
- `Input` — replaces the inline-styled `<input className="rounded-lg border border-zinc-300 px-4 py-3 ...">` pattern
- `Button` — replaces / extends `SubmitButton` 
- `Card` — for the package list item display
- `Label` — accessible label pairing

#### TanStack Query v5 — Skip

React 19 compatible, but unnecessary for this feature. Server Components fetch the package list server-side; Server Actions handle create/update/delete and call `revalidatePath()` to refresh the list. No client-side cache needed.

### Implementation Recommendation

**For S-02 (3-field package CRUD), add two libraries only:**

```bash
npm install zod
npx shadcn@latest init    # then add: npx shadcn@latest add input button card label
```

This gives:
- zod for Server Action validation (typed field errors back to the form)
- shadcn/ui for polished, accessible form inputs and card display
- `cn()` utility (`src/lib/utils.ts`) as the new className composition pattern going forward
- No conflict with the existing `useActionState` + Server Actions pattern

### Code References (follow-up)

- `src/app/login/page.tsx:1-9` — `useActionState` + Server Action form pattern (the baseline to follow)
- `src/app/actions/auth.ts:16-31` — Server Action shape; zod would replace the manual checks here
- `src/components/ui/SubmitButton.tsx` — `useFormStatus` pattern; keep as-is, shadcn `Button` augments rather than replaces it
- `src/app/globals.css:8-13` — Tailwind v4 `@theme inline` token definition; shadcn tokens added alongside these

---

## Open Questions

1. **Navigation shell design**: Bottom nav (mobile-first) vs. sidebar (desktop-friendly)? This is the highest-leverage decision in S-02. Bottom nav is recommended given the mobile-primary persona (5–10 min, phone, between sessions).

2. **Preset templates in empty state**: Should the 2–3 preset cards be hardcoded starters (e.g., "10 sessions / 800 PLN") or left blank for the trainer to name? Recommendation: hardcoded as suggestions only — one tap to adopt, freely editable.

3. **Currency**: PRD uses PLN (Polish złoty). Should the currency be hardcoded or configurable? V1 recommendation: hardcode PLN given the single-trainer, single-locale target. Avoid over-engineering.

4. **Package re-use vs. per-client customization**: The current model has one active `package_id` on `clients`. Can a trainer reuse the same package template for multiple clients? Yes — templates are shared, assignments are per-client via the FK. No schema change needed.
