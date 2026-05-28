<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Registration + Login

- **Plan**: context/changes/auth-registration-login/plan.md
- **Scope**: All phases (1–3 of 3)
- **Date**: 2026-05-26
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  5 warnings  1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Password confirm not validated server-side

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/actions/auth.ts + src/app/register/page.tsx
- **Detail**: registerAction only read `email` and `password` from formData — `confirm-password` was never checked server-side. Client-side guard is bypassable with JS off or programmatic submission.
- **Fix**: Added server-side check in registerAction — reads confirm-password, returns `{ error: 'Hasła nie są zgodne' }` if mismatch.
- **Decision**: FIXED via Fix A

### F2 — logoutAction silently swallows signOut errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/actions/auth.ts:~50
- **Detail**: `supabase.auth.signOut()` result was ignored. On signOut failure, session cookie could remain valid while user is redirected to /login, potentially causing a redirect loop via middleware.
- **Fix**: Destructure `{ error }` from signOut; log error if present before redirecting.
- **Decision**: FIXED

### F3 — Dashboard layout has no auth guard for null user

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/dashboard/layout.tsx:17-20
- **Detail**: Layout rendered `user?.email` with optional chaining, silently rendering empty string if user null. Inconsistent with page.tsx which explicitly checks and redirects.
- **Fix**: Added `if (!user) redirect('/login')` after getUser() in DashboardLayout.
- **Decision**: FIXED

### F4 — Middleware `setAll` cookie pattern — version dependency

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:~19
- **Detail**: The setAll callback pattern must match the installed @supabase/ssr version's contract. Mismatch can cause silent session token loss on rotation.
- **Fix**: Verified @supabase/ssr@0.10.3 — current version. Pattern in middleware matches Supabase docs for this version. Confirmed safe.
- **Decision**: FIXED (confirmed-safe via version check)

### F5 — Duplicate getUser() call in layout and page

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/dashboard/layout.tsx:17 + src/app/dashboard/page.tsx:4
- **Detail**: DashboardLayout and DashboardPage both called getUser() — two Supabase round-trips per dashboard page load.
- **Fix**: Removed getUser() from DashboardPage. Welcome message simplified to "Witaj!" — email already displayed in nav header from layout's fetch.
- **Decision**: FIXED

### F6 — lang="en" on a Polish-language app

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/layout.tsx:28
- **Detail**: All UI text is in Polish. `<html lang="en">` causes screen readers and browser translation tools to misidentify the page language (WCAG 2.1 criterion 3.1.1).
- **Fix**: Changed to `lang="pl"`.
- **Decision**: FIXED
