---
date: 2026-06-01T00:00:00+00:00
researcher: Claude Sonnet 4.6
git_commit: 53f9155
branch: feature/client-management
repository: trainer-app
topic: "Client management interfaces — UI screens, TypeScript types, and Supabase queries for S-03"
tags: [research, codebase, client-management, s-03, ui, typescript, supabase, routing]
status: complete
last_updated: 2026-06-01
last_updated_by: Claude Sonnet 4.6
last_updated_note: "Added follow-up: route group refactor decision — /dashboard/packages → /packages before S-03 planning"
---

# Research: Client Management Interfaces (S-03)

**Date**: 2026-06-01  
**Git Commit**: 53f9155  
**Branch**: feature/client-management  
**Repository**: trainer-app

## Research Question

What UI screens and TypeScript/data interfaces are needed to implement S-03 (client management), and what data must each screen expose to the trainer? Research grounded in the completed S-02 (package management) implementation as the canonical pattern baseline.

---

## Summary

S-03 requires **8 new component files + 2 server action files**, all following the exact pattern established in S-02. The feature lives at `/dashboard/clients` and is the second nav item (jungle-teal, `Users` icon), already wired into the nav shell.

The client data model has 7 editable fields (first_name, last_name, phone, email, package_id, interview_notes, plan_url). The form is more complex than the package form due to a cross-table package dropdown, a textarea for interview notes, and optional URL validation. The list page must fetch both clients (with joined package data) and the packages list (for the dropdown) in a single parallel query before rendering.

No new navigation, layout, or auth changes are needed — the shell is complete.

---

## Detailed Findings

### 1. Navigation — No Changes Needed

**File:** `src/app/dashboard/layout.tsx:7–12`

The nav array already includes the clients route:

```typescript
const navLinks = [
  { href: '/dashboard/packages', label: 'Pakiety' },
  { href: '/dashboard/clients',  label: 'Klienci' },   // ← already present
  { href: '/dashboard/calendar', label: 'Kalendarz' },
  { href: '/dashboard/assistant',label: 'Asystent' },
]
```

**File:** `src/components/NavLink.tsx:8–36`

The NavLink component already maps `/dashboard/clients` to:
- Icon: `Users` (Lucide React)
- Active border: `border-jungle-teal-500 dark:border-jungle-teal-400`
- Active text: `text-jungle-teal-700 dark:text-jungle-teal-300`
- Active background: `bg-jungle-teal-50 dark:bg-jungle-teal-900/20`

Active state detection (`pathname.startsWith(href)`) means all subroutes under `/dashboard/clients/` auto-highlight the nav item without any changes.

**File:** `src/app/dashboard/page.tsx:1–40`

The dashboard home already shows a "Klienci" card with the `Users` icon and teal color. Nothing to change here.

---

### 2. File Structure to Create

Mirrors `src/app/dashboard/packages/` exactly, with `Package` → `Client` renames:

```
src/app/dashboard/clients/
├── page.tsx                   Server Component — parallel-fetch clients + packages
├── ClientsClientSection.tsx   Client Component — modal state, grid vs empty conditional
├── ClientCard.tsx             Client Component — single client display + action buttons
├── ClientFormModal.tsx        Client Component — create dialog wrapper
├── EditClientModal.tsx        Client Component — edit trigger button + dialog wrapper
├── ClientForm.tsx             Client Component — 7-field form using useActionState
├── DeleteClientDialog.tsx     Client Component — AlertDialog for destructive delete
└── ClientEmptyState.tsx       Client Component — first-client call-to-action

src/app/actions/
├── clients.ts                 Server Actions — createClientAction, updateClientAction, deleteClientAction
└── clientSchema.ts            Zod validation schema for client form fields
```

---

### 3. Screen 1: Client List (`/dashboard/clients`)

**`page.tsx` — Server Component**

Responsible for fetching all data before render. Two queries run in parallel:

```typescript
export default async function ClientsPage() {
  const supabase = await createClient()

  const [{ data: clientsData }, { data: packagesData }] = await Promise.all([
    supabase
      .from('clients')
      .select('*, packages(id, name, visit_count)')
      .order('created_at', { ascending: false }),
    supabase
      .from('packages')
      .select('id, name, visit_count')
      .order('name', { ascending: true }),
  ])

  // map to clean interfaces before passing to Client Component
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ClientsClientSection
        clients={clients}
        packages={packages}
      />
    </div>
  )
}
```

**Why two queries:** The client list needs package names for the card badges. The create/edit form needs the packages list for the assignment dropdown. Both are needed on this page; fetching in parallel avoids sequential round-trips.

**TypeScript interface (co-located in `ClientsClientSection.tsx`):**

```typescript
interface PackageOption {
  id: string
  name: string
  visit_count: number
}

interface ClientListItem {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  package_id: string | null
  interview_notes: string | null
  plan_url: string | null
  created_at: string
  packages: PackageOption | null   // joined via .select('*, packages(...)')
}

interface ClientsClientSectionProps {
  clients: ClientListItem[]
  packages: PackageOption[]        // for form dropdown
}
```

**`ClientsClientSection.tsx` — Client Component**

Manages modal open/close state. Passes `packages` down to the form modal:

```typescript
'use client'

export default function ClientsClientSection({ clients, packages }: ClientsClientSectionProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      {/* Header: "Klienci" title + "Dodaj klienta" button */}
      {clients.length === 0 ? (
        <ClientEmptyState onCreateClick={() => setModalOpen(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard key={client.id} {...client} packages={packages} />
          ))}
        </div>
      )}
      <ClientFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        packages={packages}
      />
    </>
  )
}
```

---

### 4. Screen 2: Client Card

**`ClientCard.tsx` — Client Component**

What the trainer sees at a glance for each client:

| Zone | Content |
|------|---------|
| Top accent bar | `from-jungle-teal-500 to-jungle-teal-400` gradient (1px) |
| Header | Full name (`first_name last_name`) + edit/delete buttons (hover-reveal) |
| Contact row | Phone (if set) + Email (if set); both suppressed if null |
| Package badge | Package name + visit count pill; "Brak pakietu" muted if unassigned |

```typescript
interface ClientCardProps {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  package_id: string | null
  packages: PackageOption | null    // joined data from list query
  interview_notes: string | null    // not displayed on card — only in form/session view
  plan_url: string | null           // not displayed on card
}
```

**Design note:** `interview_notes` and `plan_url` are stored on the client record but **not shown on the list card** — they are dense fields suited for the session view (S-05) and AI context (S-06). The card focuses on identity + contact + package status only.

**Package badge pattern** (mirrors `PackageCard.tsx` footer teal pattern):

```tsx
{client.packages ? (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full
    bg-jungle-teal-50 text-jungle-teal-700
    dark:bg-jungle-teal-900/20 dark:text-jungle-teal-300">
    {client.packages.name} · {client.packages.visit_count} wizyt
  </span>
) : (
  <span className="inline-flex items-center px-2.5 py-1 text-xs rounded-full
    bg-muted text-muted-foreground">
    Brak pakietu
  </span>
)}
```

---

### 5. Screen 3: Create Client Modal

**`ClientFormModal.tsx` — Client Component**

Controlled dialog (open state owned by `ClientsClientSection`). Passes `packages` into the form:

```typescript
interface ClientFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  packages: PackageOption[]
}

// Renders:
// <Dialog open={open} onOpenChange={onOpenChange}>
//   <DialogContent>
//     <DialogHeader><DialogTitle>Nowy klient</DialogTitle></DialogHeader>
//     <ClientForm action={createClientAction} packages={packages} onSuccess={() => onOpenChange(false)} />
//   </DialogContent>
// </Dialog>
```

---

### 6. Screen 4: Edit Client Modal

**`EditClientModal.tsx` — Client Component**

Owns its own open state (inline trigger button on the card). Pre-fills all form fields:

```typescript
interface EditClientModalProps {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  package_id: string | null
  interview_notes: string | null
  plan_url: string | null
  packages: PackageOption[]   // passed from ClientCard → needed by form dropdown
}

// Pattern (mirrors EditPackageModal.tsx:1–54):
// const boundUpdate = updateClientAction.bind(null, id)
// <ClientForm action={boundUpdate} defaultValues={...} packages={packages} onSuccess={close} />
```

---

### 7. Screen 5: Delete Client Dialog

**`DeleteClientDialog.tsx` — Client Component**

Uses `AlertDialog` (not `Dialog`) — same as `DeletePackageDialog.tsx`.

**S-03 cascade note:** The `appointments` table has `ON DELETE CASCADE` on `client_id`. In S-03 appointments don't exist yet, so a generic warning is appropriate. The description can be updated in S-04 to include appointment count, mirroring the `clientCount` warning pattern already in `DeletePackageDialog`.

```typescript
interface DeleteClientDialogProps {
  clientId: string
  clientName: string   // "first_name last_name" — for the confirmation message
}
```

---

### 8. Screen 6: Empty State

**`ClientEmptyState.tsx` — Client Component**

Simpler than `PackageEmptyState` — no meaningful presets for clients. Single call-to-action:

```typescript
interface ClientEmptyStateProps {
  onCreateClick: () => void
}
```

Content: guidance text + "Dodaj pierwszego klienta" button. Optionally mention that packages must exist first for package assignment to work (links to packages if none yet).

---

### 9. Client Form — All 7 Fields

**`ClientForm.tsx` — Client Component**

Follows `PackageForm.tsx` exactly: `useActionState` + local controlled state per field + `useEffect` for success handling.

**Field inventory:**

| Field | Input type | Required | Validation | Notes |
|-------|-----------|----------|------------|-------|
| `first_name` | `<Input>` text | Yes | min 1 char | |
| `last_name` | `<Input>` text | Yes | min 1 char | |
| `phone` | `<Input>` text, `inputMode="tel"` | No | none in v1 | nullable |
| `email` | `<Input>` email | No | valid email format if present | nullable |
| `package_id` | ShadCN `<Select>` | No | valid UUID if present | "Brak pakietu" as empty option |
| `interview_notes` | `<Textarea>` | No | unconstrained | **Must not add char limits per roadmap risk note** |
| `plan_url` | `<Input>` text, `inputMode="url"` | No | valid URL if present | opens in new tab |

**Props interface:**

```typescript
interface ClientFormProps {
  action: (prevState: ClientFormState, formData: FormData) => Promise<ClientFormState>
  defaultValues?: {
    first_name: string
    last_name: string
    phone: string
    email: string
    package_id: string    // empty string = no package
    interview_notes: string
    plan_url: string
  }
  packages: PackageOption[]   // for the dropdown — passed from modal
  onSuccess?: () => void
}
```

**Package Select render pattern:**

```tsx
<Select name="package_id" value={packageId} onValueChange={setPackageId}>
  <SelectTrigger>
    <SelectValue placeholder="Brak pakietu" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">Brak pakietu</SelectItem>
    {packages.map((pkg) => (
      <SelectItem key={pkg.id} value={pkg.id}>
        {pkg.name} ({pkg.visit_count} wizyt)
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Hidden input trick for empty package_id:** `<Select>` with value `""` will submit an empty string. The server action treats `""` as `null` before inserting.

**interview_notes textarea:**

```tsx
<Textarea
  name="interview_notes"
  value={interviewNotes}
  onChange={(e) => setInterviewNotes(e.target.value)}
  rows={4}
  placeholder="Motywacje, cele, informacje z wywiadu..."
  className="resize-y"
/>
```

**form layout suggestion** (logical grouping for mobile):

```
[first_name]     [last_name]    ← side-by-side on wider screens, stacked on mobile
[phone]          [email]        ← same
[package_id]                    ← full width select
[interview_notes]               ← full width textarea (tallest field)
[plan_url]                      ← full width
[Submit button]
```

**Success handler (mirrors `PackageForm.tsx:useEffect`):**

```typescript
useEffect(() => {
  if (state && 'success' in state && state.success) {
    toast('Klient zapisany')
    router.refresh()
    if (onSuccess) {
      onSuccess()
    } else {
      router.push('/dashboard/clients')
    }
  }
}, [state, onSuccess, router])
```

---

### 10. Server Actions

**`src/app/actions/clients.ts`**

```typescript
'use server'

export type ClientFormState =
  | { errors: {
      first_name?: string[]
      last_name?: string[]
      phone?: string[]
      email?: string[]
      package_id?: string[]
      interview_notes?: string[]
      plan_url?: string[]
      _form?: string[]
    }}
  | { success: true }
  | null

// CREATE — signature matches useActionState contract
export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState>

// UPDATE — id is bound via .bind(null, id) at call site
export async function updateClientAction(
  id: string,
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState>

// DELETE — fire-and-forget, no return value
export async function deleteClientAction(id: string): Promise<void>
```

**Action pattern (mirrors `packages.ts`):**
1. `clientSchema.safeParse(formData fields)` — validate
2. `supabase.auth.getUser()` — get session
3. DB operation with `.eq('trainer_id', user.id)` ownership check
4. `revalidatePath('/dashboard/clients')` after mutations
5. Return `{ success: true }` or `{ errors: { _form: ['...'] } }`

**Empty → null coercion inside action (phone, email, package_id, plan_url):**

```typescript
const { error } = await supabase.from('clients').insert({
  trainer_id: user.id,
  first_name: result.data.first_name,
  last_name: result.data.last_name,
  phone: result.data.phone || null,
  email: result.data.email || null,
  package_id: result.data.package_id || null,
  interview_notes: result.data.interview_notes || null,
  plan_url: result.data.plan_url || null,
})
```

---

### 11. Zod Validation Schema

**`src/app/actions/clientSchema.ts`**

```typescript
import { z } from 'zod'

export const clientSchema = z.object({
  first_name: z.string().min(1, 'Imię jest wymagane'),
  last_name:  z.string().min(1, 'Nazwisko jest wymagane'),
  phone:      z.string().optional().or(z.literal('')),
  email:      z.union([
                z.string().email('Nieprawidłowy adres email'),
                z.literal(''),
              ]).optional(),
  package_id: z.union([
                z.string().uuid('Nieprawidłowy pakiet'),
                z.literal(''),
              ]).optional(),
  interview_notes: z.string().optional().or(z.literal('')),
  plan_url:   z.union([
                z.string().url('Nieprawidłowy URL planu'),
                z.literal(''),
              ]).optional(),
})
```

**Key difference from `packageSchema`:** optional fields use `.union([z.string().x(), z.literal('')])` pattern to allow either a valid value OR an empty string (submitted from a cleared input). The action converts `''` to `null` before DB insert.

---

## Code References

- `src/app/dashboard/packages/page.tsx` — Server Component data-loading pattern to mirror
- `src/app/dashboard/packages/PackagesClientSection.tsx` — Client section state management pattern
- `src/app/dashboard/packages/PackageCard.tsx` — Card layout + action button pattern
- `src/app/dashboard/packages/PackageForm.tsx` — `useActionState` form pattern
- `src/app/dashboard/packages/EditPackageModal.tsx:30` — `.bind(null, id)` currying pattern
- `src/app/dashboard/packages/DeletePackageDialog.tsx` — AlertDialog + async delete handler
- `src/app/actions/packages.ts` — Server action structure (validate → auth → query → revalidate)
- `src/app/actions/packageSchema.ts` — Zod schema pattern
- `src/components/NavLink.tsx:15–36` — Jungle-teal color tokens for clients section
- `supabase/schema.sql:15–26` — Exact `clients` table column names and constraints

## Architecture Insights

**Server/Client split:** All data fetching is in Server Components; all interactivity (modals, form state, delete handlers) is in Client Components. Server Actions bridge the gap for mutations.

**Parallel data fetching:** `page.tsx` must run two queries in parallel (`Promise.all`) — clients with joined package data, and the packages list for the dropdown. This is a new pattern vs `packages/page.tsx` which only needed one table.

**packages prop threading:** The `packages` array flows: `page.tsx` → `ClientsClientSection` → `ClientFormModal` / `EditClientModal` → `ClientForm`. It never hits the browser from Supabase directly — always server-fetched.

**interview_notes must be unconstrained:** The roadmap explicitly flags this as a risk: "If the field is constrained (e.g., character limit, sanitisation that strips content), AI context quality degrades." No `maxLength`, no HTML sanitisation, no trimming in v1.

**plan_url opens in new tab:** The link is an external URL (Google Docs, Excel). Render as `<a href={plan_url} target="_blank" rel="noopener noreferrer">` anywhere it appears.

**Color token discipline:** All client-section accents must use `jungle-teal-*` tokens, not generic Tailwind colors. This is enforced by the `lessons.md` color palette rule.

## Historical Context

- `context/archive/2026-05-30-package-management/plan.md` — S-02 plan established the 4-section nav and color assignments; the jungle-teal → clients mapping is a hard constraint from that plan.
- `context/foundation/roadmap.md:100–113` — S-03 risk note on unconstrained `interview_notes`; S-03 prerequisite is S-02 (packages must exist for the assignment dropdown to be useful).
- `context/foundation/lessons.md` — Color palette rule (no generic Tailwind colors) and component directory convention (hand-written components in `src/components/`, not `src/components/ui/`).

## Open Questions

1. **Empty state when no packages exist:** If the trainer has no packages yet, the package dropdown in the create form will be empty. Should the empty state or the form itself link to `/packages` to prompt creation first? Not a blocker for S-03 but worth deciding during planning.

2. **Textarea ShadCN component:** The packages implementation uses ShadCN `Input`. For `interview_notes` a `Textarea` is needed — confirm `Textarea` is available in `src/components/ui/` or add it via `shadcn add textarea` before implementing.

3. **`plan_url` validation strictness:** The Zod schema above validates as a URL if non-empty. Some trainers may paste partial URLs (e.g., `docs.google.com/...` without `https://`). Consider accepting any non-empty string in v1 and validating lightly (or not at all) to reduce friction.

---

## Follow-up: Route Group Refactor (prerequisite for S-03)

**Decision (2026-06-01):** Refactor routing to use a Next.js route group `(app)/` before implementing client management, so that feature routes are siblings rather than children of `/dashboard`.

### Why

`src/app/dashboard/layout.tsx` currently serves two roles: (1) the authenticated shell with nav, and (2) the URL prefix `/dashboard/`. This makes packages live at `/dashboard/packages`, which is semantically wrong — packages is not a sub-page of dashboard.

### Target URL map

| Before | After |
|--------|-------|
| `/dashboard` | `/dashboard` (unchanged) |
| `/dashboard/packages` | `/packages` |
| `/dashboard/clients` | `/clients` |
| `/dashboard/calendar` | `/calendar` |
| `/dashboard/assistant` | `/assistant` |

### File moves

```
src/app/dashboard/layout.tsx         → src/app/(app)/layout.tsx
src/app/dashboard/page.tsx           → src/app/(app)/dashboard/page.tsx
src/app/dashboard/packages/*         → src/app/(app)/packages/*
```

`(app)` is a Next.js route group — the folder name is stripped from the URL entirely. It exists only to share the layout across authenticated routes.

### Edits required after move

| File | Change |
|------|--------|
| `src/app/(app)/layout.tsx` | navLinks hrefs: `/dashboard/packages` → `/packages`; same for clients, calendar, assistant |
| `src/components/NavLink.tsx` | sectionIcons + sectionStyles record keys: same remap |
| `src/app/(app)/packages/PackageForm.tsx` | `router.push('/dashboard/packages')` → `router.push('/packages')` |
| `src/app/(app)/dashboard/page.tsx` | card `<a>` hrefs: remap all 4 section links |
| `src/app/actions/packages.ts` | `revalidatePath('/dashboard/packages')` → `revalidatePath('/packages')` |
| `src/middleware.ts` | **no change** — route group folder `(app)` is invisible to the URL matcher; redirect to `/dashboard` still works |

### Impact on S-03 planning

All client management files should be created at `src/app/(app)/clients/` (URL: `/clients`). Server action `revalidatePath` calls use `/clients`. Any internal `router.push` fallbacks point to `/clients`.
