# Package CRUD — Add, Edit, and Delete Training Packages

## Overview

Implement the S-02 slice: a trainer can add, edit, and delete training packages (name, visit count, price) through a mobile-first UI. This slice also installs the shadcn/ui + zod foundation and adds active nav state — infrastructure that all subsequent slices (S-03 through S-06) will inherit.

## Current State Analysis

The dashboard shell already exists at `src/app/dashboard/layout.tsx` with top-bar navigation (Pakiety, Klienci, Kalendarz, Asystent links). The nav has no active-state highlighting. The `/dashboard/packages` route is linked in the nav but returns 404 — no page exists yet.

The codebase uses `useActionState` + Server Actions for forms (established in `src/app/login/page.tsx` + `src/app/actions/auth.ts`). No form validation library, no UI component library, and no `cn()` utility exist. Auth forms are hand-rolled (inline Tailwind `<input>` and `<label>` elements).

Schema is defined locally in `supabase/schema.sql` but deployment status to the Supabase instance is unconfirmed.

### Key Discoveries

- `src/app/dashboard/layout.tsx:6-11` — nav links are hardcoded with no active-state; layout is a pure Server Component. A new `NavLink` Client Component will provide `usePathname()` highlighting without converting the layout itself.
- `src/app/actions/auth.ts:16-31` — existing Server Action shape: `(prevState, formData) → { error: string }`. Package actions extend this to per-field errors: `{ errors: { name?, visit_count?, price?, _form? } } | { success: true } | null`.
- `supabase/schema.sql:4-12` — `packages` table: `id, trainer_id, name, visit_count (int, >0), price (numeric 10,2, ≥0), created_at`. RLS in place. No schema changes needed.
- `supabase/schema.sql:14-27` — `clients.package_id` is `FK → packages.id ON DELETE SET NULL`. A deleted package silently nullifies client assignments — the delete confirmation must surface this count to the trainer.
- `src/components/ui/SubmitButton.tsx` — uses `useFormStatus`; keep as-is, shadcn `Button` augments new forms; do not replace `SubmitButton` used by auth forms.

## Desired End State

A trainer logged into the dashboard can:
1. Navigate to Pakiety — see their package list (or a template-driven empty state) with name, visit count, total price, and per-session rate on each card.
2. Create a package via `/dashboard/packages/new` — quick-select chips (5/10/20) pre-fill session count; price field has PLN label and decimal keyboard mode; real-time per-session rate shown; zod-validated with inline field errors; Sonner toast on save.
3. Edit any package via `/dashboard/packages/[id]/edit` — same form pre-filled; success toast on save; 404 for unknown IDs.
4. Delete any package — AlertDialog warns how many clients will lose their assignment before confirming.
5. See the current nav section highlighted on both desktop and mobile.

Verify: navigate to `/dashboard/packages` (empty state with preset cards) → click a preset card (chip pre-selected) → submit → package appears in list → edit it → verify change → assign to a client via Supabase dashboard → delete → AlertDialog warns "1 klienta" → confirm → empty state returns.

## What We're NOT Doing

- Expiry dates on packages (V1 scope cut; future via a `client_packages` join table)
- Tier pricing (multiple price points per package)
- Pagination or search on the package list (trainer scale: ≤ 20 packages expected)
- Client-side form library (react-hook-form conflicts with `useActionState`)
- Migrating the appointments or client pages to shadcn (they don't exist yet)

## Implementation Approach

Phase 0 gates on database readiness. Phase 1 installs the library foundation and migrates auth forms. Phase 2 adds active nav. Phases 3–6 build the package CRUD following the schema → Server Actions → list → create form → edit form sequence. Phase 7 adds unit tests for zod validation.

## Critical Implementation Details

**Server Action success/navigate pattern**: The packages create and update actions return `{ success: true }` instead of calling `redirect()` server-side. The Client Component form watches for `state?.success` in a `useEffect`, fires the Sonner toast, then calls `router.push('/dashboard/packages')`. A server-side `redirect()` bypasses the toast entirely — this ordering is the only way to show the toast before navigating.

**Supabase client count via embed**: The package list fetches client counts with `.select('*, clients(count)')`. The result shape is `clients: [{ count: N }]` — extract as `row.clients[0]?.count ?? 0` to get the integer.

**Sonner placement**: Add `<Toaster />` once in `src/app/layout.tsx` (the root layout), not in the dashboard layout — this future-proofs toast availability across the whole app.

---

## Phase 0: Schema Verification and Deployment

### Overview

Manual gate: confirm the Supabase instance has the packages, clients, and appointments tables with RLS enabled before writing any UI code. All subsequent phases depend on this.

### Changes Required

#### 1. Verify Supabase schema deployment

**File**: `supabase/schema.sql` (read-only reference)

**Intent**: Open the Supabase SQL editor for the project instance and confirm the three tables exist with RLS enabled. If absent, run `schema.sql` in its entirety.

**Contract**: In the Supabase dashboard SQL editor, run:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```
Expected result: `appointments`, `clients`, `packages`. If absent, paste and execute `supabase/schema.sql`. After applying, verify RLS shows as enabled on all three tables in the Table Editor.

### Success Criteria

#### Manual Verification

- Supabase table editor shows `packages`, `clients`, `appointments` under the `public` schema
- Table editor shows "RLS enabled" for all three tables
- A test insert (`INSERT INTO packages (trainer_id, name, visit_count, price) VALUES (auth.uid(), 'Test', 10, 800)`) succeeds when run as an authenticated user via the SQL editor

---

## Phase 1: Foundation — shadcn/ui + zod + Auth Form Refactor

### Overview

Install zod and shadcn/ui, establish `cn()`, add the Sonner toaster to the root layout, and migrate the existing hand-rolled auth forms to use shadcn components. This creates the visual and validation foundation all subsequent pages follow.

### Changes Required

#### 1. Install zod and initialise shadcn/ui

**File**: `package.json` (via CLI)

**Intent**: Add zod v4 for Server Action validation. Install shadcn/ui (auto-detects Next.js + Tailwind v4) and add the specific components needed across this and future slices.

**Contract**: Run in order — the `init` command modifies `globals.css` (adding shadcn CSS variables alongside the existing `@theme inline` tokens) and creates `components.json`:
```bash
npm install zod
npx shadcn@latest init
npx shadcn@latest add input button card label sonner alert-dialog
```

#### 2. `cn()` utility

**File**: `src/lib/utils.ts` (new)

**Intent**: Add the `cn()` className merging utility that all shadcn components depend on. The `shadcn init` command may generate this automatically; verify after init, create manually if absent.

**Contract**: Exports `cn(...inputs: ClassValue[]): string` using `clsx` + `tailwind-merge`. Import path for all consumers: `@/lib/utils`.

#### 3. Sonner Toaster in root layout

**File**: `src/app/layout.tsx`

**Intent**: Mount `<Toaster />` once at the root layout level so toasts are available app-wide.

**Contract**: Import `Toaster` from `@/components/ui/sonner`; add it as a sibling of `{children}` inside the root `<body>` element.

#### 4. Login form refactor

**File**: `src/app/login/page.tsx`

**Intent**: Replace the hand-rolled `<label className="...">` and `<input className="rounded-lg border ...">` elements with shadcn `<Label>` and `<Input>`. Form logic, Server Action wiring (`useActionState`), error display, and `SubmitButton` usage remain unchanged.

**Contract**: Import `Label` from `@/components/ui/label` and `Input` from `@/components/ui/input`. Each `<div className="flex flex-col gap-1">` wrapper stays; only the inner `<label>` and `<input>` elements are replaced.

#### 5. Register form refactor

**File**: `src/app/register/page.tsx`

**Intent**: Same migration as login — three input fields (email, password, confirm-password) refactored to shadcn `Label` + `Input`. Error display and `SubmitButton` unchanged.

**Contract**: Same pattern as login. All three inputs receive `Label` + `Input` replacements.

### Success Criteria

#### Automated Verification

- `npm run build` completes without errors
- `npm run lint` passes
- `npx tsc --noEmit` passes

#### Manual Verification

- Login page renders with shadcn-styled inputs; login flow works end-to-end
- Register page renders with shadcn-styled inputs; registration flow works end-to-end
- No visual regression on existing auth pages (dark mode included)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Active Navigation

### Overview

Add active-state highlighting to the dashboard header nav. A small `NavLink` Client Component wraps each nav item; the layout itself stays a Server Component.

### Changes Required

#### 1. NavLink component

**File**: `src/components/ui/NavLink.tsx` (new)

**Intent**: A `'use client'` component wrapping Next.js `<Link>` that applies an active className when `usePathname().startsWith(href)`.

**Contract**: Props: `href: string`, `label: string`. Active className: `bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50`. Base className: copy the existing link className from `src/app/dashboard/layout.tsx:36-38`. Use `cn()` to merge base and conditional active classes.

#### 2. Dashboard layout — NavLink wiring

**File**: `src/app/dashboard/layout.tsx`

**Intent**: Replace the two `navLinks.map(...)` blocks (desktop at lines 31–41 and mobile at lines 59–68) to render `<NavLink>` instead of plain `<Link>`. The outer layout structure and `navLinks` array are unchanged.

**Contract**: Import `NavLink` from `@/components/ui/NavLink`. Replace each `<Link key={href} href={href} className="...">` with `<NavLink key={href} href={href} label={label} />`.

### Success Criteria

#### Automated Verification

- `npm run build` completes without errors
- `npm run lint` passes

#### Manual Verification

- Navigating to `/dashboard/packages` highlights "Pakiety" in both desktop and mobile nav
- Navigating to `/dashboard` highlights nothing (no nav href matches `/dashboard` via `startsWith` since all hrefs are `/dashboard/…`)
- Dark mode: active state is visible

**Implementation Note**: Pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Package Server Actions

### Overview

Create all three package mutations as Server Actions with zod v4 validation and typed return states. This is the data layer that the form and delete components depend on.

### Changes Required

#### 1. Package action state type and zod schema

**File**: `src/app/actions/packages.ts` (new)

**Intent**: Define `PackageFormState` and the shared `packageSchema`. Exporting the schema from this file enables direct unit testing without mocking the Server Action.

**Contract**:
```ts
// PackageFormState — returned by create and update actions
type PackageFormState =
  | { errors: { name?: string[]; visit_count?: string[]; price?: string[]; _form?: string[] } }
  | { success: true }
  | null

// Zod v4 schema — use z.coerce for FormData string inputs
const packageSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  visit_count: z.coerce.number().int().positive('Liczba wizyt musi być większa od zera'),
  price: z.coerce.number().nonneg('Cena nie może być ujemna'),
})
```
Flatten errors with `result.error.flatten().fieldErrors` to produce the `string[]` arrays.

#### 2. `createPackageAction`

**File**: `src/app/actions/packages.ts`

**Intent**: Validate FormData, insert a new package scoped to `auth.uid()`, and return `{ success: true }` or `{ errors }`. Does not redirect — the Client Component navigates after detecting success.

**Contract**: Signature: `createPackageAction(prevState: PackageFormState, formData: FormData): Promise<PackageFormState>`. On Supabase error: return `{ errors: { _form: ['Nie udało się zapisać pakietu'] } }`.

#### 3. `updatePackageAction`

**File**: `src/app/actions/packages.ts`

**Intent**: Same validation as create; update the row with `.eq('id', id).eq('trainer_id', auth.uid())` to prevent cross-trainer edits even if RLS is misconfigured.

**Contract**: Signature: `updatePackageAction(id: string, prevState: PackageFormState, formData: FormData): Promise<PackageFormState>`. The `id` is pre-bound via `.bind(null, packageId)` in the edit page. Returns `{ success: true }` or `{ errors }`.

#### 4. `deletePackageAction`

**File**: `src/app/actions/packages.ts`

**Intent**: Delete a package by id, scoped to the trainer. The schema's `ON DELETE SET NULL` handles client FK nullification automatically. Calls `revalidatePath` to refresh the list.

**Contract**: Signature: `deletePackageAction(id: string): Promise<void>`. Deletes with `.delete().eq('id', id).eq('trainer_id', auth.uid())`; calls `revalidatePath('/dashboard/packages')`. Invoked via `<form action={deletePackageAction.bind(null, id)}>` in the AlertDialog confirm button.

### Success Criteria

#### Automated Verification

- `npx tsc --noEmit` passes (all action signatures type-check)
- `npm run lint` passes

#### Manual Verification

- `src/app/actions/packages.ts` exists with all four exports (`createPackageAction`, `updatePackageAction`, `deletePackageAction`, `packageSchema`)

**Implementation Note**: Pause for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Package List Page

### Overview

The main packages screen: fetches the trainer's packages with embedded client counts, renders cards with per-session rate and delete flow, or a template-driven empty state.

### Changes Required

#### 1. Package list page (Server Component)

**File**: `src/app/dashboard/packages/page.tsx` (new)

**Intent**: Fetch packages + embedded client count in one query, then branch to empty state or card list.

**Contract**: 
- Query: `supabase.from('packages').select('*, clients(count)').order('created_at', { ascending: false })`
- Client count per row: `row.clients[0]?.count ?? 0`
- Renders: heading "Pakiety" + "Dodaj pakiet" button linking to `/dashboard/packages/new`; then `<PackageEmptyState />` if no rows, or a list of `<PackageCard>` components

#### 2. Package card

**File**: `src/app/dashboard/packages/PackageCard.tsx` (new)

**Intent**: Display one package with name, session count, total price, calculated per-session rate, Edit link, and Delete trigger. Wrapped in a shadcn `Card`.

**Contract**: Props: `id: string, name: string, visitCount: number, price: number, clientCount: number`. Per-session rate: `(price / visitCount).toFixed(2)` PLN — display only. Edit: `<Link href={'/dashboard/packages/' + id + '/edit'}>`. Delete: `<DeletePackageDialog packageId={id} packageName={name} clientCount={clientCount} />`.

#### 3. Delete confirmation dialog

**File**: `src/app/dashboard/packages/DeletePackageDialog.tsx` (new)

**Intent**: Client Component wrapping shadcn `AlertDialog`. Shows the trainer how many clients will lose their assignment, then submits `deletePackageAction` on confirm.

**Contract**: Props: `packageId: string, packageName: string, clientCount: number`. Dialog body: if `clientCount > 0` → `"Ten pakiet jest przypisany do ${clientCount} klienta/ów. Usunięcie go usunie przypisanie pakietu."` otherwise `"Czy na pewno chcesz usunąć pakiet "${packageName}"?"`. Confirm button: `<form action={deletePackageAction.bind(null, packageId)}><button type="submit">Usuń</button></form>`.

#### 4. Empty state with preset templates

**File**: `src/app/dashboard/packages/PackageEmptyState.tsx` (new)

**Intent**: When the list is empty, show a motivating message and three preset template cards that link to the create form with `?visits=N` pre-filling the chip selection.

**Contract**: Three preset cards linking to:
- `/dashboard/packages/new?visits=5` — "5 wizyt / 400 PLN"
- `/dashboard/packages/new?visits=10` — "10 wizyt / 800 PLN"
- `/dashboard/packages/new?visits=20` — "20 wizyt / 1400 PLN"

Plus a plain "Utwórz swój pierwszy pakiet" CTA button → `/dashboard/packages/new`. The create form reads `searchParams.visits` (Phase 5) to pre-select the matching chip.

### Success Criteria

#### Automated Verification

- `npm run build` completes without errors
- `npm run lint` passes
- `npx tsc --noEmit` passes

#### Manual Verification

- `/dashboard/packages` renders the empty state when no packages exist; all three preset cards visible
- After creating a package, the list shows name, session count, total price, and per-session rate
- Clicking the delete button on a package with 1 assigned client shows the warning with "1"
- Clicking the delete button on an unassigned package shows the simple confirmation
- Confirming delete removes the package from the list

**Implementation Note**: Pause for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Create Package Form

### Overview

The `/dashboard/packages/new` page: 3-field form with session chips, PLN price input with decimal mode, real-time per-session rate, and zod-powered inline validation.

### Changes Required

#### 1. Create page (Server Component wrapper)

**File**: `src/app/dashboard/packages/new/page.tsx` (new)

**Intent**: Thin Server Component that reads the `visits` search param (set by empty-state preset cards) and passes it as `defaultVisits` to the shared form component.

**Contract**: Reads `searchParams.visits` and parses it as a number (`Number(searchParams.visits) || undefined`). Renders `<PackageForm action={createPackageAction} defaultVisits={...} />` with a "Nowy pakiet" heading.

#### 2. Shared package form (Client Component)

**File**: `src/app/dashboard/packages/PackageForm.tsx` (new — shared between create and edit)

**Intent**: The reusable Client Component form handling `useActionState`, session chips, real-time per-session rate, inline field errors, and the toast-then-navigate success flow. Shared by create and edit pages.

**Contract**:
- Props: `action: (prevState: PackageFormState, formData: FormData) => Promise<PackageFormState>`, `defaultValues?: { name: string; visit_count: number; price: number }`, `defaultVisits?: number`
- Session chips: three `<button type="button">` elements (5, 10, 20) that set controlled `visitCount` state; the corresponding `<Input type="number" name="visit_count">` is a controlled input reflecting this state
- Price: `<Input type="text" inputMode="decimal" name="price">` with a static `PLN` label rendered to the right; format on blur only
- Per-session rate: derived live as `price / visitCount`; displayed as `"= X PLN / sesja"` — updates on price `onChange` and chip click
- Inline errors: `{state?.errors?.name?.[0] && <p className="text-sm text-red-600">{state.errors.name[0]}</p>}` per field
- Success: `useEffect(() => { if (state?.success) { toast('Pakiet zapisany'); router.push('/dashboard/packages') } }, [state])`

### Success Criteria

#### Automated Verification

- `npm run build` completes without errors
- `npx tsc --noEmit` passes

#### Manual Verification

- Clicking a session chip updates the visit count input and per-session rate
- Submitting with an empty name shows the "Nazwa jest wymagana" error inline below the name field
- Submitting with valid data shows the Sonner toast "Pakiet zapisany" and redirects to the list
- Navigating from an empty-state preset card pre-selects the matching chip (e.g. `?visits=10` → 10-chip active)
- Price input on mobile triggers numeric keyboard

**Implementation Note**: Pause for manual confirmation before proceeding to Phase 6.

---

## Phase 6: Edit Package Form

### Overview

The `/dashboard/packages/[id]/edit` page reuses `PackageForm` with server-fetched pre-filled values. Returns 404 for unknown or unauthorised IDs.

### Changes Required

#### 1. Edit page (Server Component)

**File**: `src/app/dashboard/packages/[id]/edit/page.tsx` (new)

**Intent**: Fetch the package by id scoped to the authenticated trainer, pass its data to `PackageForm` with the bound update action, and return a 404 if not found.

**Contract**: 
- Fetch: `supabase.from('packages').select('*').eq('id', params.id).single()` — RLS ensures only the trainer's own package is returned
- If `data` is null: call `notFound()` from `next/navigation`
- Bound action: `const boundUpdate = updatePackageAction.bind(null, params.id)` — pass as `action` prop
- `defaultValues`: `{ name: data.name, visit_count: data.visit_count, price: Number(data.price) }`
- Heading: "Edytuj pakiet"

### Success Criteria

#### Automated Verification

- `npm run build` completes without errors
- `npx tsc --noEmit` passes

#### Manual Verification

- `/dashboard/packages/[valid-id]/edit` renders the form pre-filled with the package's existing values
- All three chips remain visible; the chip matching the current `visit_count` is highlighted if it matches 5, 10, or 20 (no chip highlighted otherwise)
- Submitting changes updates the package and shows the success toast
- `/dashboard/packages/[invalid-id]/edit` returns the Next.js 404 page
- Editing a package does not affect other trainers' packages (RLS enforced)

**Implementation Note**: Pause for manual confirmation before proceeding to Phase 7.

---

## Phase 7: Unit Tests

### Overview

Vitest unit tests for the zod validation schema — valid inputs, invalid inputs, type coercion, and boundary values. The `packageSchema` export is tested directly without mocking the Server Action's Supabase calls.

### Changes Required

#### 1. Package schema validation tests

**File**: `src/app/actions/packages.test.ts` (new)

**Intent**: Test the exported `packageSchema` in isolation against the seven cases that cover the full validation surface: valid baseline, each invalid field individually, type coercion for FormData strings, and the zero-price edge case.

**Contract**: Import `packageSchema` from `@/app/actions/packages`. Use `schema.safeParse()`. Seven test cases:

| Input | Expected |
|---|---|
| `{ name: 'Test', visit_count: '10', price: '800' }` | `success: true` |
| `{ name: '', visit_count: '10', price: '800' }` | `errors.name` present |
| `{ name: 'X', visit_count: '-1', price: '800' }` | `errors.visit_count` present |
| `{ name: 'X', visit_count: '0', price: '800' }` | `errors.visit_count` present |
| `{ name: 'X', visit_count: '10', price: '-5' }` | `errors.price` present |
| `{ name: 'X', visit_count: '10', price: '0' }` | `success: true` (free package is valid) |
| `{ name: 'X', visit_count: '10', price: '800' }` (all strings) | `success: true` with `data.visit_count === 10` (number) |

### Success Criteria

#### Automated Verification

- `npm run test` passes with all seven test cases green

#### Manual Verification

- All seven test cases listed in the contract have corresponding assertions in the test file

---

## Testing Strategy

### Unit Tests

- `packageSchema.safeParse()`: valid/invalid inputs, type coercion, boundary values (visit_count = 0, price = 0)
- Action return shapes are validated by TypeScript rather than runtime tests

### Integration Tests

Not in scope for this slice — no Supabase test project is configured.

### Manual Testing Steps

1. Verify schema is deployed (Phase 0 gate)
2. Navigate to `/dashboard/packages` — confirm empty state with three preset template cards
3. Click the "10 wizyt" preset card — confirm the 10-chip is pre-selected on the create form
4. Submit the form — confirm "Pakiet zapisany" toast appears and the package shows in the list with correct per-session rate
5. Click Edit — confirm form is pre-filled; change the price; confirm save toast and updated per-session rate in the list
6. In the Supabase dashboard, assign the package to a client (`UPDATE clients SET package_id = '...' WHERE ...`)
7. Click Delete on that package — confirm the AlertDialog warns "1 klienta"
8. Confirm delete — package disappears; return to empty state
9. Test nav: navigate to each of the four sections; confirm the correct nav link is highlighted on desktop and mobile
10. Test auth regression: log out, log in — confirm login form renders with shadcn inputs and login succeeds
11. Test register regression: register a new account — confirm form renders correctly and flow completes

## Performance Considerations

The package list query fetches packages + client count in a single Supabase round-trip using the embedded count syntax. At the expected scale (≤ 20 packages per trainer) no pagination or caching is needed. Per-session rate is computed in the component (`price / visit_count`) — not stored.

## Migration Notes

No database migration needed — the schema already defines all required tables and constraints. Phase 0 ensures the schema is applied to the live Supabase instance before any app code runs.

## References

- Related research: `context/changes/package-management/research.md`
- Schema: `supabase/schema.sql:4-12` (packages), `supabase/schema.sql:14-27` (clients FK)
- Auth pattern baseline: `src/app/actions/auth.ts:16-31`, `src/app/login/page.tsx:1-59`
- PRD requirements: `context/foundation/prd.md:90-93` (FR-003, FR-004), `prd.md:138` (package counter business logic)
- Roadmap: `context/foundation/roadmap.md:97-101` (S-02 slice definition and nav shell risk)

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Schema Verification and Deployment

#### Manual

- [ ] 0.1 Supabase table editor shows packages, clients, appointments tables
- [ ] 0.2 RLS enabled on all three tables
- [ ] 0.3 Test insert into packages succeeds as authenticated user

### Phase 1: Foundation — shadcn/ui + zod + Auth Form Refactor

#### Automated

- [x] 1.1 npm run build passes — f35d579
- [x] 1.2 npm run lint passes — f35d579
- [x] 1.3 npx tsc --noEmit passes — f35d579

#### Manual

- [x] 1.4 Login page renders with shadcn inputs; login flow works end-to-end — f35d579
- [x] 1.5 Register page renders with shadcn inputs; registration flow works end-to-end — f35d579
- [x] 1.6 No visual regression on auth pages (dark mode included) — f35d579

### Phase 2: Active Navigation

#### Automated

- [x] 2.1 npm run build passes — 48f8cd9
- [x] 2.2 npm run lint passes — 48f8cd9

#### Manual

- [x] 2.3 Navigating to /dashboard/packages highlights "Pakiety" in desktop and mobile nav
- [x] 2.4 Dark mode active state visible

### Phase 3: Package Server Actions

#### Automated

- [x] 3.1 npx tsc --noEmit passes (all action signatures) — 6f2f905
- [x] 3.2 npm run lint passes — 6f2f905

#### Manual

- [x] 3.3 src/app/actions/packages.ts exists with createPackageAction, updatePackageAction, deletePackageAction, packageSchema exports

### Phase 4: Package List Page

#### Automated

- [x] 4.1 npm run build passes
- [x] 4.2 npm run lint passes
- [x] 4.3 npx tsc --noEmit passes

#### Manual

- [x] 4.4 /dashboard/packages renders empty state with three preset template cards when no packages exist
- [x] 4.5 Package list shows name, session count, total price, and per-session rate for each card
- [x] 4.6 Delete AlertDialog shows correct client count message
- [x] 4.7 Confirming delete removes the package from the list

### Phase 5: Create Package Form

#### Automated

- [x] 5.1 npm run build passes
- [x] 5.2 npx tsc --noEmit passes

#### Manual

- [x] 5.3 Clicking a session chip updates the visit count input and per-session rate
- [x] 5.4 Submitting with empty name shows inline validation error below the name field
- [x] 5.5 Valid submission shows "Pakiet zapisany" toast and closes modal
- [x] 5.6 Preset card pre-selects the corresponding session chip via modal defaultVisits prop

### Phase 6: Edit Package Form

#### Automated

- [ ] 6.1 npm run build passes
- [ ] 6.2 npx tsc --noEmit passes

#### Manual

- [ ] 6.3 Edit form pre-filled with existing package values
- [ ] 6.4 Submitting changes shows success toast and updates the list
- [ ] 6.5 Invalid package ID returns 404 page
- [ ] 6.6 RLS enforced — cannot edit another trainer's package

### Phase 7: Unit Tests

#### Automated

- [ ] 7.1 npm run test passes with all seven schema validation test cases green
