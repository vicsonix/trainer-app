# Auth Registration + Login — Plan Brief

> Full plan: `context/changes/auth-registration-login/plan.md`

## What & Why

Implementacja pełnego flow autentykacji: rejestracja przez email + hasło, logowanie i wylogowanie. Weryfikacja emaila wyłączona — trener jest zalogowany od razu po rejestracji. To fundament bezpieczeństwa całej aplikacji — dane każdego trenera muszą być izolowane per konto, a bez działającego auth żaden kolejny slice (S-02–S-06) nie może być zbudowany ani przetestowany.

## Starting Point

Middleware (`src/middleware.ts`) jest gotowy — weryfikuje sesję i obsługuje routing auth. Klienty Supabase są skonfigurowane. Strona `/login` istnieje jako stub (`<h1>Hello World</h1>`), `/register` i `/dashboard` nie istnieją w ogóle.

## Desired End State

Trener może założyć konto przez `/register` i od razu trafić na `/dashboard` — bez żadnego kroku weryfikacji. Na dashboardzie widzi swój email i nawigację do przyszłych sekcji (Pakiety, Klienci, Kalendarz, Asystent). Sesja przeżywa zamknięcie przeglądarki. Błędy auth (złe hasło, istniejący email) pojawiają się inline pod formularzem po polsku.

## Key Decisions Made

| Decyzja | Wybór | Dlaczego | Source |
|---------|-------|----------|--------|
| Implementacja formularzy | Server Actions | Cookie + redirect atomowe w jednym response — eliminuje race condition na mobilnym; `httpOnly` cookies | Plan |
| Email verification | Wyłączona w Supabase Dashboard | MVP — zero tarcia, trener loguje się natychmiast po rejestracji | Plan |
| Błędy auth | Inline pod formularzem | Standard mobilny; widoczne bez przewijania | Plan |
| Walidacja hasła | Client-side (min 6) + server errors | Natychmiastowy feedback + pełne błędy Supabase | Plan |
| Potwierdzenie hasła | Tak, pole "Powtórz hasło" | Klawiatura mobilna → ryzyko literówki | Plan |
| Loading state | Spinner w przycisku (disabled) | Zapobiega double-submit; widoczna informacja zwrotna | Plan |
| Dashboard scope | Shell nawigacyjny (nie placeholder) | Fundament nawigacji dla S-02–S-06 — lepiej zdecydować teraz | Plan |

## Scope

**In scope:**
- Server Actions: `loginAction`, `registerAction`, `logoutAction`
- `Spinner` + `SubmitButton` komponenty UI
- Strona `/login` — pełny formularz
- Strona `/register` — formularz z potwierdzeniem hasła, redirect na `/dashboard` po sukcesie
- `/dashboard` layout z nawigacją + strona powitalna
- Root `/` → redirect na `/dashboard`
- Metadata aplikacji (tytuł, opis)

**Out of scope:**
- Google OAuth (v2)
- Reset hasła
- Walidacja siły hasła ponad min 6 znaków
- Rate limiting (Supabase obsługuje server-side)
- Prawdziwe strony docelowe nawigacji (S-02–S-06)

## Architecture / Approach

Server Actions w `src/app/actions/auth.ts` obsługują auth po stronie serwera (Supabase server client). Strony formularzy są Client Components używającymi `useActionState` (błędy) i `useFormStatus` (spinner). Po rejestracji Server Action redirectuje bezpośrednio na `/dashboard` — weryfikacja emaila wyłączona w Supabase. Dashboard layout jest Server Component — pobiera email trenera i dostarcza nawigację dla wszystkich stron dashboardu.

## Phases at a Glance

| Faza | Co dostarcza | Główne ryzyko |
|------|-------------|---------------|
| 1. Auth Actions + Login + Minimal dashboard | Login → dashboard → logout (E2E loop) | `redirect()` wewnątrz try/catch nie działa — musi być po bloku |
| 2. Register page | Rejestracja → natychmiastowy redirect na `/dashboard` | Supabase Dashboard musi mieć wyłączone "Confirm email" przed testem |
| 3. Dashboard nav shell + cleanup | Shell nawigacyjny gotowy dla S-02–S-06 | Decyzja o strukturze nav (top bar vs bottom bar) — implementer decyduje |

**Prerequisites:** Supabase projekt skonfigurowany, `.env.local` z `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Supabase Dashboard → Authentication → Email → wyłączone "Confirm email".

## Open Risks & Assumptions

- `redirect()` z `next/navigation` rzuca wyjątek wewnętrznie — nie owijać w `try/catch`.
- `useFormStatus` wymaga, żeby `SubmitButton` był dzieckiem elementu `<form>` — nie może być w tym samym komponencie co `useActionState`.

## Success Criteria (Summary)

- Trener przechodzi pełny flow `/register` → natychmiastowy redirect → `/dashboard` w mniej niż 5 minut od pierwszego otwarcia aplikacji
- Błędne dane logowania zawsze skutkują czytelnym komunikatem po polsku (nigdy pustą stroną lub angielskim błędem)
- Interfejs jest w pełni użyteczny na ekranie mobilnym 360px bez poziomego scrollowania
