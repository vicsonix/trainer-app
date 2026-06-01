# Client Management Implementation Plan

## Overview

Two-part plan: (1) a route group refactor that moves all feature URLs from `/dashboard/*` to clean sibling paths (`/packages`, `/clients`, etc.); (2) S-03 client management — full CRUD for trainer clients with package assignment, interview notes, training plan link, and an inline "create package" affordance directly inside the package assignment dropdown.

## Current State Analysis

- Feature routes are nested under `/dashboard/` — `packages` lives at `/dashboard/packages` because `src/app/dashboard/layout.tsx` serves as both the authenticated shell and a URL prefix. This is semantically wrong.
- The `clients` table is fully defined in `supabase/schema.sql:15–26` with all 7 editable fields.
- Navigation shell (`src/app/dashboard/layout.tsx:7–12`) already includes the `/dashboard/clients` entry with jungle-teal styling in `src/components/NavLink.tsx:15–36` and a "Klienci" card on the dashboard home.
- `src/components/ui/` is missing `textarea.tsx` and `select.tsx` — both are required for the client form.
- S-02 (package management) is the canonical implementation pattern. All client management files mirror its structure with `Package` → `Client` renames.

## Desired End State

- `/packages` and `/clients` exist as clean sibling URLs under a shared `(app)/` layout shell.
- Trainer can navigate to `/clients`, see their client list, and add/edit/delete clients using a 7-field form.
- Package assignment uses a ShadCN Select dropdown; if no packages exist, the dropdown includes a "+ Dodaj pakiet" action item that opens `PackageFormModal` inline — after the package is created and `router.refresh()` runs, the new package appears in the dropdown for manual selection.
- Client cards display: full name, contact info (phone/email, suppressed if null), assigned package badge (jungle-teal) or "Brak pakietu" (muted).
- `interview_notes` is an unconstrained textarea — no character limit, no sanitisation.
- `plan_url` is validated as a URL only when non-empty.

### Key Discoveries

- `supabase/schema.sql:15–26` — exact column names: `first_name`, `last_name`, `phone`, `email`, `package_id`, `interview_notes`, `plan_url`, `created_at`, `trainer_id`. `phone` and `email` are nullable; `package_id` is nullable FK to `packages` with ON DELETE SET NULL.
- `src/app/dashboard/packages/PackageForm.tsx` — `useActionState` + local controlled state per field + `useEffect` for success handling; the exact pattern for `ClientForm`.
- `src/app/dashboard/packages/EditPackageModal.tsx:30` — `updatePackageAction.bind(null, id)` currying pattern; replicate for `updateClientAction`.
- `src/components/NavLink.tsx:8–36` — sectionIcons and sectionStyles are keyed by full route path strings; both records must be updated in Phase 1.
- `src/app/actions/packages.ts` — `revalidatePath('/dashboard/packages')` must become `revalidatePath('/packages')` after Phase 1 moves the files.
- `context/foundation/lessons.md` — hand-written components go in `src/components/` (not `src/components/ui/`); all colour tokens must be from the five custom families (never generic Tailwind).

## What We're NOT Doing

- Remaining-visits counter on the client card (S-05's responsibility — appointments don't exist yet).
- Delete cascade warning with appointment count (S-04 will add this when appointments exist; S-03 uses a generic delete confirmation).
- Client search or filter (5–20 clients; not in PRD).
- Auto-selecting the newly created package after inline add (manual selection after `router.refresh()` is acceptable for v1).
- Modifying `createPackageAction` return type (stays `{ success: true }` — no ID returned).

## Implementation Approach

Phase 1 cleans the URL structure before any new code is written, so every subsequent file is created at the correct path. Phase 2 installs missing ShadCN primitives and builds the data layer in isolation (schema + actions + tests — verifiable without any UI). Phase 3 delivers the read-only display layer. Phase 4 wires in all mutation components and the inline package-add affordance.

## Critical Implementation Details

**Select action item — `onMouseDown` with `preventDefault`**: To embed a non-selectable "Dodaj pakiet" button inside `<SelectContent>`, render a `<button type="button" onMouseDown={e => e.preventDefault()}>` as the last child. The `preventDefault` call fires before ShadCN's pointer-down close handler and prevents the Select from dismissing when the button is clicked. Do NOT use `onClick` alone — the Select will close before the click fires.

**`router.refresh()` preserves client component state**: After the inline package creation closes and `router.refresh()` is called, Next.js re-renders the Server Component (`page.tsx`) and re-fetches both clients and packages, but does NOT unmount client components. All `useState` values in `ClientForm` (name, email, notes, etc.) survive. The packages prop updates, the new package appears in the dropdown, and the trainer selects it manually.

**`revalidatePath` paths are post-refactor**: The `clients.ts` server actions are written in Phase 2, after Phase 1 moves files and fixes paths. All `revalidatePath` calls use `/clients` (not `/dashboard/clients`).

---

## Phase 1: Route Group Refactor

### Overview

Move the authenticated shell from `src/app/dashboard/layout.tsx` into a Next.js route group `src/app/(app)/layout.tsx`. The `(app)` folder name is invisible to the URL router, so the layout applies to all children without adding a path segment. `dashboard`, `packages`, `clients`, `calendar`, `assistant` become sibling routes under this shared shell.

### Changes Required

#### 1. Create route group directory and move layout

**File**: `src/app/(app)/layout.tsx` (moved from `src/app/dashboard/layout.tsx`)

**Intent**: Move the file. The content of the layout is unchanged — only the navLinks hrefs and the redirect target in the auth check need editing (see below).

**Contract**: After the move, `src/app/dashboard/layout.tsx` no longer exists.

#### 2. Update navLinks hrefs in layout

**File**: `src/app/(app)/layout.tsx:7–12`

**Intent**: The four nav entries still point at `/dashboard/packages` etc. — strip the `/dashboard` prefix from each feature route so they resolve as siblings.

**Contract**:
```
'/dashboard/packages'  → '/packages'
'/dashboard/clients'   → '/clients'
'/dashboard/calendar'  → '/calendar'
'/dashboard/assistant' → '/assistant'
```
The `/dashboard` route itself (overview page) is not in this array and does not change.

#### 3. Move dashboard overview page

**File**: `src/app/(app)/dashboard/page.tsx` (moved from `src/app/dashboard/page.tsx`)

**Intent**: Move the file. The overview page stays at the `/dashboard` URL because the folder name `dashboard` is a real URL segment inside the `(app)` group.

**Contract**: After the move, `src/app/dashboard/page.tsx` no longer exists. The directory `src/app/dashboard/` is empty and can be deleted.

#### 4. Update card hrefs in dashboard overview

**File**: `src/app/(app)/dashboard/page.tsx`

**Intent**: The four section cards link to `/dashboard/packages` etc. — update to match the new sibling paths.

**Contract**: Same remap as item 2 above — strip `/dashboard` prefix from the four feature hrefs.

#### 5. Move packages directory

**File**: `src/app/(app)/packages/` (moved from `src/app/dashboard/packages/`)

**Intent**: Move the entire directory. No file content changes beyond the two edits below.

**Contract**: All 8 component files and their relative imports remain intact after the move.

#### 6. Fix `router.push` in PackageForm

**File**: `src/app/(app)/packages/PackageForm.tsx`

**Intent**: The fallback navigation on successful save points at the old path — update to the new sibling URL.

**Contract**: `router.push('/dashboard/packages')` → `router.push('/packages')`.

#### 7. Fix `revalidatePath` in packages server action

**File**: `src/app/actions/packages.ts`

**Intent**: Cache invalidation targets the old path — update to the new URL.

**Contract**: Every `revalidatePath('/dashboard/packages')` call → `revalidatePath('/packages')`.

#### 8. Update NavLink icon and style record keys

**File**: `src/components/NavLink.tsx:8–36`

**Intent**: `sectionIcons` and `sectionStyles` are keyed by route string. After the href remap in item 2, the active-state lookup will miss unless the record keys match.

**Contract**: Rename all four keys in both records:
```
'/dashboard/packages'  → '/packages'
'/dashboard/clients'   → '/clients'
'/dashboard/calendar'  → '/calendar'
'/dashboard/assistant' → '/assistant'
```

### Success Criteria

#### Automated Verification

- Build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification

- Navigate to `/packages` — packages list renders; sidebar "Pakiety" nav item is active (lobster-pink highlight).
- Navigate to `/dashboard` — overview grid renders; all four section cards link to `/packages`, `/clients`, `/calendar`, `/assistant` correctly.
- Navigate to a package's edit modal and save — toast appears, redirected to `/packages` (not `/dashboard/packages`).
- No 404 errors in browser console.

**Implementation Note**: After this phase passes manual verification, proceed to Phase 2.

---

## Phase 2: ShadCN Components + Data Layer

### Overview

Install the two missing ShadCN UI primitives (`Textarea`, `Select`), write the Zod validation schema for client forms, implement the three server actions, and add tests covering both schema validation and action behaviour with a Supabase mock.

### Changes Required

#### 1. Install missing ShadCN primitives

**File**: `src/components/ui/textarea.tsx`, `src/components/ui/select.tsx` (generated)

**Intent**: Run `npx shadcn@latest add textarea select` to scaffold both components into `src/components/ui/`. Required before `ClientForm` can compile.

**Contract**: Both files exist in `src/components/ui/` after the command. No manual edits needed.

#### 2. Client Zod validation schema

**File**: `src/app/actions/clientSchema.ts`

**Intent**: Define field-level validation for all 7 client form inputs. Mirrors `packageSchema.ts` in structure.

**Contract**:
- `first_name`, `last_name`: `z.string().min(1, …)` — required, non-empty.
- `phone`: accept any string or empty — no format validation in v1.
- `email`: valid email format **or** empty string (`z.union([z.string().email(…), z.literal('')])`).
- `package_id`: valid UUID **or** empty string (same union pattern).
- `interview_notes`: any string or empty — **no length limit** (PRD Business Logic constraint; AI context quality depends on this).
- `plan_url`: valid URL **or** empty string (same union pattern — validates only when non-empty).
- All optional fields use the `z.literal('')` union so a cleared browser input doesn't fail validation.

#### 3. Client server actions

**File**: `src/app/actions/clients.ts`

**Intent**: Implement `createClientAction`, `updateClientAction`, and `deleteClientAction` following the exact pattern of `src/app/actions/packages.ts` — validate → authenticate → query with ownership check → `revalidatePath` → return state.

**Contract**:
- `ClientFormState` discriminated union: `{ errors: { first_name?, last_name?, phone?, email?, package_id?, interview_notes?, plan_url?, _form? } }` | `{ success: true }` | `null`.
- `createClientAction(_prevState, formData)` — inserts with `trainer_id: user.id`; converts empty strings to `null` for nullable fields before insert.
- `updateClientAction(id, _prevState, formData)` — `.eq('id', id).eq('trainer_id', user.id)` ownership double-check.
- `deleteClientAction(id)` — fire-and-forget void; same ownership check.
- All mutations call `revalidatePath('/clients')`.

#### 4. Tests

**File**: `src/app/actions/clients.test.ts`

**Intent**: Cover schema validation (mirrors `packages.test.ts`) and server action behaviour via Supabase mock and `next/cache` mock.

**Contract — schema tests**:
- Valid input (all fields populated) → `success: true`.
- Missing `first_name` or `last_name` → field error.
- Empty string for optional fields (`email: ''`, `package_id: ''`, `plan_url: ''`) → parses without error.
- Invalid email format → field error on `email`.
- Invalid URL format (non-empty) → field error on `plan_url`.
- Non-UUID `package_id` (non-empty) → field error on `package_id`.

**Contract — action integration tests** (mock `@/lib/supabase/server` and `next/cache`):
- `createClientAction`: valid input + authenticated user → calls `.from('clients').insert({trainer_id: user.id, …})`, returns `{ success: true }`, calls `revalidatePath('/clients')`.
- `createClientAction`: validation failure (empty `first_name`) → returns field errors without calling Supabase.
- `createClientAction`: `getUser()` returns no user → returns `{ errors: { _form: ['Sesja wygasła'] } }`.
- `createClientAction`: Supabase insert returns error → returns `{ errors: { _form: […] } }`.
- `updateClientAction`: valid → calls `.update(…).eq('id', id).eq('trainer_id', user.id)`.
- `deleteClientAction`: calls `.delete().eq('id', id).eq('trainer_id', user.id)` and `revalidatePath('/clients')`.

### Success Criteria

#### Automated Verification

- Tests pass: `npm run test`
- Lint passes: `npm run lint`
- Type check passes: `npm run build` (or `npx tsc --noEmit`)

#### Manual Verification

- `src/components/ui/textarea.tsx` and `src/components/ui/select.tsx` both exist.

**Implementation Note**: After tests are green and lint clean, proceed to Phase 3.

---

## Phase 3: Stateless Display Layer

### Overview

Implement the Server Component entry point and the two display-only Client Components: the client card and the empty state. No mutations yet — this phase delivers a working read-only `/clients` view.

### Changes Required

#### 1. Clients list page

**File**: `src/app/(app)/clients/page.tsx`

**Intent**: Server Component that fetches clients (with joined package data) and the packages list in parallel, maps both to clean interfaces, and passes them to `ClientsClientSection`.

**Contract**:
- Two parallel Supabase queries via `Promise.all`: (1) `.from('clients').select('*, packages(id, name, visit_count)').order('created_at', { ascending: false })`; (2) `.from('packages').select('id, name, visit_count').order('name', { ascending: true })`.
- Maps raw data to `ClientListItem[]` and `PackageOption[]` before passing as props.
- Wrapper div: `className="mx-auto max-w-5xl px-4 py-8"` — matches `packages/page.tsx`.
- In this phase, renders `ClientsClientSection` (which will be a stub until Phase 4 — temporarily render just the grid/empty state directly, or create the section component as a thin wrapper).

#### 2. ClientCard component

**File**: `src/app/(app)/clients/ClientCard.tsx`

**Intent**: Display a single client as a styled card with name, contact info, and package badge. Action buttons (edit/delete) are placeholder divs in this phase — wired in Phase 4.

**Contract**:
- Props: `{ id, first_name, last_name, phone, email, packages: PackageOption | null }` — `interview_notes` and `plan_url` are not rendered on the card.
- Top accent bar: `bg-gradient-to-r from-jungle-teal-500 to-jungle-teal-400` (1px high) — matches the card pattern in `lessons.md`.
- Full name as the primary heading: `{first_name} {last_name}`.
- Contact row: render `phone` and `email` conditionally — suppress if null.
- Package badge: if `packages` is non-null, jungle-teal pill showing `{packages.name} · {packages.visit_count} wizyt`; if null, muted pill showing "Brak pakietu".
- Uses `bg-white/70 dark:bg-carbon-black-900/70 backdrop-blur-md` glass-morphism card style per `lessons.md`.

#### 3. ClientEmptyState component

**File**: `src/app/(app)/clients/ClientEmptyState.tsx`

**Intent**: Shown when the trainer has no clients. Single "Dodaj pierwszego klienta" CTA button.

**Contract**:
- Props: `{ onCreateClick: () => void }`.
- Guidance text: "Nie masz jeszcze żadnych klientów" heading + "Dodaj pierwszego klienta, żeby zacząć śledzić postępy." subtitle.
- One primary button that calls `onCreateClick`.
- No preset templates (unlike `PackageEmptyState`) — clients have no meaningful defaults.

### Success Criteria

#### Automated Verification

- Build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification

- Navigate to `/clients` — renders empty state if no clients in DB; page is responsive on mobile viewport.
- Add a client row directly in Supabase Studio (or via SQL) — reload `/clients`; card renders with correct name, package badge (if package_id set), contact info.
- "Klienci" nav item highlights in jungle-teal when on `/clients`.

**Implementation Note**: After manual verification passes, proceed to Phase 4.

---

## Phase 4: Interactive Layer + Full Integration

### Overview

Implement all mutation components (create modal, edit modal, form with inline package add, delete dialog), wire them into `ClientsClientSection` and `ClientCard`, and verify the complete CRUD flow end-to-end.

### Changes Required

#### 1. ClientsClientSection

**File**: `src/app/(app)/clients/ClientsClientSection.tsx`

**Intent**: Client Component that owns the `modalOpen` state for the create flow, renders the grid or empty state, and mounts `ClientFormModal` at page level.

**Contract**:
- Props: `{ clients: ClientListItem[], packages: PackageOption[] }`.
- `const [modalOpen, setModalOpen] = useState(false)`.
- Conditional render: `clients.length === 0` → `<ClientEmptyState onCreateClick={() => setModalOpen(true)} />`; otherwise → `<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">` with `ClientCard` per item.
- Section header: "Klienci" title + "Dodaj klienta" primary button (`onClick={() => setModalOpen(true)}`).
- `<ClientFormModal open={modalOpen} onOpenChange={setModalOpen} packages={packages} />` rendered always (controlled by `open` prop).

#### 2. ClientFormModal

**File**: `src/app/(app)/clients/ClientFormModal.tsx`

**Intent**: Controlled Dialog wrapper for the create flow. Passes `packages` into the form.

**Contract**:
- Props: `{ open: boolean, onOpenChange: (open: boolean) => void, packages: PackageOption[] }`.
- Renders ShadCN `<Dialog>` with `<DialogTitle>Nowy klient</DialogTitle>` and `<ClientForm action={createClientAction} packages={packages} onSuccess={() => onOpenChange(false)} />`.

#### 3. EditClientModal

**File**: `src/app/(app)/clients/EditClientModal.tsx`

**Intent**: Inline edit trigger (pencil icon button) that owns its own open state. Binds the client ID to the update action.

**Contract**:
- Props: `{ id, first_name, last_name, phone, email, package_id, interview_notes, plan_url, packages: PackageOption[] }`.
- `const [open, setOpen] = useState(false)`.
- `const boundUpdate = updateClientAction.bind(null, id)` — mirrors `EditPackageModal.tsx:30`.
- Trigger: icon button using Lucide `<Pencil size={14} />` with hover opacity.
- Renders `<ClientForm action={boundUpdate} defaultValues={{…}} packages={packages} onSuccess={() => setOpen(false)} />` inside a `<Dialog>`.
- `defaultValues` converts `null` → `''` for all nullable fields before passing (the form uses controlled string state, not nulls).

#### 4. ClientForm

**File**: `src/app/(app)/clients/ClientForm.tsx`

**Intent**: The 7-field client form. Uses `useActionState` + controlled local state per field. Includes an inline "Dodaj pakiet" action item in the package Select dropdown that opens `PackageFormModal` without closing the dropdown.

**Contract**:
- Props: `{ action, defaultValues?, packages: PackageOption[], onSuccess? }`.
- Local state: `firstName`, `lastName`, `phone`, `email`, `packageId`, `interviewNotes`, `planUrl` — initialised from `defaultValues` or `''`.
- `const [packageModalOpen, setPackageModalOpen] = useState(false)`.
- Package Select: standard ShadCN `<Select name="package_id" value={packageId} onValueChange={setPackageId}>`. Inside `<SelectContent>`, after all `<SelectItem>` entries, render a separator `<div className="border-t my-1 border-soft-linen-200 dark:border-carbon-black-700" />` followed by:
  ```tsx
  <button
    type="button"
    className="flex w-full items-center gap-1.5 px-2 py-1.5 text-sm
               text-jungle-teal-700 dark:text-jungle-teal-300
               hover:bg-jungle-teal-50 dark:hover:bg-jungle-teal-900/20 cursor-pointer"
    onMouseDown={(e) => {
      e.preventDefault()
      setPackageModalOpen(true)
    }}
  >
    <Plus size={12} />
    Dodaj pakiet
  </button>
  ```
  `onMouseDown` with `e.preventDefault()` is required — prevents the Select from closing before the state update fires (see Critical Implementation Details).
- Empty-dropdown hint: if `packages.length === 0` and `packageId === ''`, render a small hint below the Select: `"Brak pakietów — kliknij 'Dodaj pakiet', żeby przypisać jeden."` in `text-xs text-muted-foreground`.
- `interview_notes` field: ShadCN `<Textarea>` with `rows={4} className="resize-y"` — no `maxLength`.
- `plan_url` field: `<Input type="text" inputMode="url">`.
- Form layout (mobile-first, stacked by default, side-by-side on `sm:` breakpoint): first_name + last_name, phone + email, package_id (full width), interview_notes (full width), plan_url (full width).
- Success handler (`useEffect` on `state`): toast "Klient zapisany", `router.refresh()`, call `onSuccess()` or fall back to `router.push('/clients')`.
- At bottom of JSX: `<PackageFormModal open={packageModalOpen} onOpenChange={setPackageModalOpen} />` — no `packages` prop needed; it creates a new package via `createPackageAction`. Import from `@/app/(app)/packages/PackageFormModal`.

#### 5. DeleteClientDialog

**File**: `src/app/(app)/clients/DeleteClientDialog.tsx`

**Intent**: AlertDialog for destructive client deletion. Generic warning in S-03 (no appointment count yet — S-04 will add that).

**Contract**:
- Props: `{ clientId: string, clientName: string }`.
- Trigger: Lucide `<Trash2 size={14} />` icon button with hover destructive colour.
- `AlertDialogDescription`: `Czy na pewno chcesz usunąć klienta "${clientName}"? Tej operacji nie można cofnąć.`
- Delete handler: `async function handleDelete() { await deleteClientAction(clientId); toast('Klient usunięty'); router.refresh() }` with `catch → toast.error(…)`.
- Uses ShadCN `<AlertDialog>` — not `<Dialog>`.

#### 6. Wire action buttons into ClientCard

**File**: `src/app/(app)/clients/ClientCard.tsx`

**Intent**: Replace the Phase 3 action button placeholders with the real `EditClientModal` and `DeleteClientDialog` components.

**Contract**:
- Props extended: add `packages: PackageOption[]` (needed by `EditClientModal`).
- Render `<EditClientModal>` and `<DeleteClientDialog>` in the card header's button group, with the same hover-opacity reveal pattern as `PackageCard.tsx`.
- `clientName` passed to delete dialog: `` `${first_name} ${last_name}` ``.

### Success Criteria

#### Automated Verification

- Build passes: `npm run build`
- Lint passes: `npm run lint`
- All tests pass: `npm run test`

#### Manual Verification

- **Create client**: click "Dodaj klienta", fill all fields, submit → toast appears, modal closes, new client card renders.
- **Create with inline package add**: open create form with no package selected, click "+ Dodaj pakiet" in the dropdown — PackageFormModal opens without closing the form; create the package; after save the package appears in the Select dropdown; manually select it and submit.
- **Edit client**: click pencil icon on a card, change fields, submit → card updates.
- **Delete client**: click trash icon, confirm in dialog → card removed; toast appears.
- **Empty state**: with no clients, empty state renders; "Dodaj pierwszego klienta" opens the create modal.
- **No packages edge case**: create form with no packages in DB — dropdown shows "Brak pakietu" option only, hint text appears below it.
- **interview_notes**: paste a multi-paragraph text → accepted without truncation.
- **plan_url**: enter an invalid URL → field error shown; enter a valid URL → saved; field blank → no error.
- **Mobile layout**: open form on mobile viewport — fields stack vertically; textarea is resizable; Select dropdown is tap-friendly.
- **Nav**: "Klienci" tab is highlighted on all `/clients` routes.

**Implementation Note**: After full manual verification passes, S-03 is complete. Update `roadmap.md` S-03 status from `proposed` → `done`.

---

## Testing Strategy

### Unit Tests (Phase 2)

- `src/app/actions/clients.test.ts` covers all validation branches and all three action behaviours (see Phase 2, item 4 for full contract).
- Pattern mirrors `src/app/actions/packages.test.ts` — test schema with `safeParse`, test actions with `vi.mock('@/lib/supabase/server')` and `vi.mock('next/cache')`.

### Manual Testing Steps (Phase 4)

See Phase 4 Manual Verification above — it covers the full CRUD flow, edge cases, and mobile layout.

## Migration Notes

No database migrations needed — `clients` table is already defined in `supabase/schema.sql` and the migration in `supabase/migrations/`. Confirm the schema is deployed to the Supabase instance before Phase 3 manual testing.

## References

- Research: `context/changes/client-management/research.md`
- Schema baseline: `supabase/schema.sql:15–26`
- Pattern source: `src/app/dashboard/packages/` (all 8 component files)
- Action pattern: `src/app/actions/packages.ts`
- Lessons: `context/foundation/lessons.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Route Group Refactor

#### Automated

- [x] 1.1 Build passes: `npm run build` — 1e1103c
- [x] 1.2 Lint passes: `npm run lint` — 1e1103c

#### Manual

- [x] 1.3 Navigate to `/packages` — packages list renders; "Pakiety" nav item active — 1e1103c
- [x] 1.4 Navigate to `/dashboard` — overview grid renders; all four card links go to sibling routes — 1e1103c
- [x] 1.5 Edit a package and save — redirected to `/packages`, not `/dashboard/packages` — 1e1103c
- [x] 1.6 No 404 errors in browser console — 1e1103c

### Phase 2: ShadCN Components + Data Layer

#### Automated

- [x] 2.1 Tests pass: `npm run test` — 7969cf4
- [x] 2.2 Lint passes: `npm run lint` — 7969cf4
- [x] 2.3 Build passes: `npm run build` — 7969cf4

#### Manual

- [x] 2.4 `src/components/ui/textarea.tsx` and `src/components/ui/select.tsx` exist — 7969cf4

### Phase 3: Stateless Display Layer

#### Automated

- [x] 3.1 Build passes: `npm run build` — 8f7a5f9
- [x] 3.2 Lint passes: `npm run lint` — 8f7a5f9

#### Manual

- [x] 3.3 `/clients` renders empty state with no clients in DB — 8f7a5f9
- [x] 3.4 Client card renders correctly after seeding a row in Supabase Studio — 8f7a5f9
- [x] 3.5 "Klienci" nav item highlights in jungle-teal on `/clients` — 8f7a5f9

### Phase 4: Interactive Layer + Full Integration

#### Automated

- [x] 4.1 Build passes: `npm run build` — 6fbe3d5
- [x] 4.2 Lint passes: `npm run lint` — 6fbe3d5
- [x] 4.3 All tests pass: `npm run test` — 6fbe3d5

#### Manual

- [x] 4.4 Create client — toast, modal closes, card renders — 6fbe3d5
- [x] 4.5 Inline package add from dropdown — PackageFormModal opens; after creation package appears in Select — 6fbe3d5
- [x] 4.6 Edit client — card updates after save — 6fbe3d5
- [x] 4.7 Delete client — card removed, toast appears — 6fbe3d5
- [x] 4.8 Empty state CTA opens create modal — 6fbe3d5
- [x] 4.9 No-packages hint text visible in dropdown when package list is empty — 6fbe3d5
- [x] 4.10 `interview_notes` multi-paragraph input accepted without truncation — 6fbe3d5
- [x] 4.11 `plan_url` validation: invalid URL shows error; blank shows no error — 6fbe3d5
- [x] 4.12 Mobile layout: fields stack vertically, form usable on small screen — 6fbe3d5
