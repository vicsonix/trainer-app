# Auth Registration + Login — Implementation Plan

## Overview

Implementacja pełnego flow autentykacji: rejestracja (email + hasło), logowanie i wylogowanie. Weryfikacja emaila wyłączona — po rejestracji trener jest od razu zalogowany i trafia na dashboard. Fundament izolacji danych — każde konto trenera widzi tylko swoje dane.

## Current State Analysis

Middleware (`src/middleware.ts`) jest w pełni zaimplementowany: weryfikuje sesję Supabase przy każdym requeście, publiczne trasy to `/login` i `/register`, unauthenticated → `/login`, authenticated na auth trasie → `/dashboard`. Klienty Supabase (`src/lib/supabase/client.ts` i `server.ts`) są gotowe i poprawnie skonfigurowane.

Brakuje: login form (stub `<h1>Hello World</h1>`), strony `/register`, strony `/dashboard`.

## Desired End State

Trener może przejść pełny flow bez żadnych zewnętrznych narzędzi: otworzyć `/register` → wypełnić email + hasło + potwierdzenie → od razu trafić na `/dashboard`. Może też otworzyć `/login`, wpisać dane → trafia na `/dashboard` z nawigacją (Pakiety, Klienci, Kalendarz, Asystent) i może się wylogować. Sesja przeżywa zamknięcie przeglądarki.

### Key Discoveries

- `src/middleware.ts:33` — `/register` już jest w `isAuthRoute`, trasa jest publiczna, nie trzeba middleware zmieniać.
- `src/middleware.ts:41` — Po zalogowaniu middleware redirectuje na `/dashboard` — ta strona musi istnieć po Phase 1.
- `src/lib/supabase/server.ts` — `createClient()` jest `async`, trzeba `await` przy każdym użyciu w Server Actions.
- Supabase zwraca błędy po angielsku (`error.message`) — trzeba zmapować na polskie komunikaty w Server Actions.
- React 19 (`useActionState` z `react`, `useFormStatus` z `react-dom`) — projekt używa React 19, obie funkcje dostępne.
- Strony auth używają `useActionState` → muszą być `'use client'` (lub mieć `'use client'` form component) — form components będą Client Components.

## What We're NOT Doing

- Google OAuth (v2, per PRD §Access Control)
- Resetowanie hasła (poza zakresem v1)
- Weryfikacja emaila — wyłączona w Supabase Dashboard (Auth → Email → wyłącz "Confirm email"); `signUp` loguje trenera natychmiast
- Route handler `/auth/callback` — nie potrzebny bez weryfikacji emaila
- Walidacja siły hasła ponad minimalne 6 znaków (Supabase minimum)
- Limity prób logowania / rate limiting (Supabase obsługuje po stronie serwera)
- Prawdziwa nawigacja do sekcji (Pakiety, Klienci, etc.) — linki są, ale strony docelowe powstaną w S-02–S-06

## Implementation Approach

Server Actions w `src/app/actions/auth.ts` obsługują `loginAction`, `registerAction` i `logoutAction` — każda woła odpowiedni Supabase method po stronie serwera i zwraca stan błędu lub redirectuje. Strony formularzy są Client Components używającymi `useActionState` (zarządzanie stanem błędu) i `useFormStatus` (stan pending dla spinnera). Po rejestracji `registerAction` redirectuje bezpośrednio na `/dashboard` — weryfikacja emaila wyłączona w Supabase.

## Critical Implementation Details

**`redirect()` po Server Action** — `redirect()` z `next/navigation` rzuca wyjątek wewnętrznie (Next.js tak to implementuje). Nie wolno owijać `redirect()` w blok `try/catch` — inaczej redirect nigdy się nie wykona. Pattern: najpierw `try { await supabase... } catch(error) { return { error: '...' } }`, a `redirect()` wywołać **po** bloku try/catch.

**`useFormStatus` wymaga rodzica `<form>`** — `SubmitButton` z `useFormStatus()` musi być child elementu `<form>`, nie może być w tym samym komponencie co `useActionState`. Wyodrębnić jako osobny komponent.

---

## Phase 1: Auth Server Actions + Login page + Minimal dashboard

### Overview

Tworzy fundament auth: Server Actions dla login/logout, komponent spinnera, pełna strona logowania i minimalny dashboard. Po tej fazie trener może zalogować się na istniejące konto i wylogować — pełna pętla weryfikowalna E2E.

### Changes Required

#### 1. Auth Server Actions

**File**: `src/app/actions/auth.ts`

**Intent**: Centralne Server Actions dla całego auth flow. `loginAction` przyjmuje `FormData`, woła Supabase `signInWithPassword`, przy błędzie zwraca `{ error: string }`, przy sukcesie redirectuje na `/dashboard`. `registerAction` woła `signUp`; przy sukcesie redirectuje na `/dashboard` (weryfikacja emaila wyłączona — sesja jest aktywna od razu). `logoutAction` woła `signOut` i redirectuje na `/login`.

**Contract**: Plik zaczyna się od `'use server'`. Każda funkcja jest `export async function`. Typy błędów Supabase do zmapowania na polskie komunikaty:
- `"Invalid login credentials"` → `"Nieprawidłowy email lub hasło"`
- `"User already registered"` → `"Konto z tym emailem już istnieje"`
- Fallback: `"Wystąpił błąd. Spróbuj ponownie."`

Sygnatury:
```ts
export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | never>

export async function registerAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | never>

export async function logoutAction(): Promise<never>
```

#### 2. Spinner component

**File**: `src/components/ui/Spinner.tsx`

**Intent**: Mały SVG spinner do wyświetlenia w przycisku Submit podczas pending state. Używany na stronach login i register.

**Contract**: Client Component (`'use client'`), eksportuje `export default function Spinner()`. Inline SVG z `animate-spin` (Tailwind). Rozmiar: `w-4 h-4`, kolor: `currentColor` (dziedziczy kolor tekstu przycisku).

#### 3. SubmitButton component

**File**: `src/components/ui/SubmitButton.tsx`

**Intent**: Przycisk formularza używający `useFormStatus()` do wykrycia pending state. Pokazuje spinner gdy `pending === true`, normalny tekst gdy `false`. Wymagany jako osobny komponent (constraint `useFormStatus` — musi być child `<form>`).

**Contract**: `'use client'`. Props: `label: string` (tekst przycisku, np. "Zaloguj się"). Disabled gdy `pending`. Klasy Tailwind dopasowane do mobilnego rozmiaru (min-height 48px dla łatwego tapnięcia).

#### 4. Login page

**File**: `src/app/login/page.tsx`

**Intent**: Zastąpienie placeholdera pełnym formularzem logowania. Email + hasło, inline komunikat błędu z `useActionState`, spinner w przycisku przez `SubmitButton`, link do rejestracji (`/register`). Walidacja HTML5 na polu hasła (`minLength={6}`).

**Contract**: `'use client'`. Używa `useActionState(loginAction, null)`. Form `action={formAction}`. Błąd wyświetlany jako `<p>` z czerwonym kolorem pod przyciskiem (gdy `state?.error` istnieje).

#### 5. Minimal dashboard page

**File**: `src/app/dashboard/page.tsx`

**Intent**: Minimalna strona docelowa po zalogowaniu — pokazuje email zalogowanego trenera i przycisk wylogowania. Zastąpiona w Phase 3 shellem nawigacyjnym, ale musi istnieć teraz żeby middleware redirect działał.

**Contract**: Server Component. Woła `createClient()` z server lib, pobiera `supabase.auth.getUser()`. Wyświetla `user.email`. Przycisk Wyloguj to `<form action={logoutAction}><button type="submit">`.

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów TypeScript
- `npm run lint` przechodzi bez błędów

#### Manual Verification

- Otwarcie `/login` pokazuje formularz z polami email i hasło
- Wpisanie błędnych danych → inline błąd "Nieprawidłowy email lub hasło" pod przyciskiem
- Wpisanie poprawnych danych → redirect na `/dashboard` z emailem i przyciskiem Wyloguj
- Kliknięcie Wyloguj → redirect na `/login`
- Zamknięcie i otwarcie przeglądarki po zalogowaniu → sesja przeżywa (nie wymaga ponownego logowania)
- Podczas submit przycisku widoczny jest spinner (przycisk disabled)

**Implementation Note**: Po przejściu automated verification i manual testing — potwierdź zanim przejdziesz do Phase 2.

---

## Phase 2: Register page

### Overview

Trener może założyć nowe konto. Po rejestracji jest od razu zalogowany i trafia na `/dashboard` — bez kroku weryfikacji emaila.

### Changes Required

#### 1. Register page

**File**: `src/app/register/page.tsx`

**Intent**: Formularz rejestracji z trzema polami: email, hasło, potwierdzenie hasła. Walidacja client-side zgodności haseł przed POST (nie wysyłaj jeśli hasła się nie zgadzają — pokaż błąd inline). Przy sukcesie `registerAction` redirectuje na `/dashboard`. Inline błędy przy problemach Supabase. Link do logowania (`/login`).

**Contract**: `'use client'`. Używa `useActionState(registerAction, null)`. Walidacja zgodności haseł: `onChange` na polu confirm porównuje z polem password; lokalny `useState` dla błędu zgodności. Priorytet wyświetlania błędów: lokalny (niezgodność haseł) > `state?.error` z Server Action. Brak success state — redirect obsługuje Server Action.

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów TypeScript
- `npm run lint` przechodzi

#### Manual Verification

- Otwarcie `/register` pokazuje formularz z polami email, hasło, powtórz hasło
- Wpisanie niezgodnych haseł → błąd "Hasła nie są zgodne" bez wysyłania formularza
- Rejestracja z istniejącym emailem → inline błąd "Konto z tym emailem już istnieje"
- Rejestracja z nowym emailem → natychmiastowy redirect na `/dashboard` (trener zalogowany)
- Link rejestracyjny na stronie logowania i link loginowy na stronie rejestracji działają

**Implementation Note**: Potwierdź manual testing przed Phase 3.

---

## Phase 3: Dashboard nav shell + cleanup

### Overview

Zastąpienie minimalnego dashboardu shellem nawigacyjnym gotowym dla S-02–S-06. Trener widzi swój email, nawigację do przyszłych sekcji i przycisk wylogowania. Cleanup: root page redirectuje na `/dashboard`, metadata aplikacji zaktualizowana.

### Changes Required

#### 1. Dashboard layout

**File**: `src/app/dashboard/layout.tsx`

**Intent**: Layout z górnym paskiem nawigacyjnym wspólnym dla wszystkich stron dashboardu. Zawiera: nazwę aplikacji ("Trainer"), email zalogowanego trenera, linki nawigacyjne (Pakiety `/dashboard/packages`, Klienci `/dashboard/clients`, Kalendarz `/dashboard/calendar`, Asystent `/dashboard/assistant`), przycisk Wyloguj. Linki do nieistniejących jeszcze stron są obecne — powstaną w S-02–S-06.

**Contract**: Server Component. Pobiera email przez `supabase.auth.getUser()`. Przekazuje `children` jako `{children}`. Mobilna nawigacja: top bar z imieniem/emailem + hamburger/linki, albo sticky bottom bar z ikonami — implementer decyduje o stylu zachowując wymagane linki i dane.

#### 2. Dashboard page (update)

**File**: `src/app/dashboard/page.tsx`

**Intent**: Zastąpienie minimalnej wersji z Phase 1 docelową stroną powitalną. Pokazuje "Witaj, {email}" i krótką instrukcję (np. "Wybierz sekcję z menu"). Wylogowanie przeniesione do layoutu — ta strona nie potrzebuje już przycisku Wyloguj.

**Contract**: Server Component. Layout z Phase 1 dostarcza nawigację i logout, ta strona zawiera tylko content welcomowy.

#### 3. Root page redirect

**File**: `src/app/page.tsx`

**Intent**: Trener lądujący na `/` powinien trafić na `/dashboard` (jeśli zalogowany) lub `/login` (jeśli nie). Middleware obsługuje `/login` case; ta strona obsługuje authenticated case — Server Component redirectuje na `/dashboard`.

**Contract**: Server Component. Woła `createClient()`, sprawdza `getUser()`. Jeśli user istnieje — `redirect('/dashboard')`. Jeśli nie — `redirect('/login')`. Nie renderuje żadnego UI.

#### 4. App metadata

**File**: `src/app/layout.tsx`

**Intent**: Zaktualizowanie tytułu i opisu aplikacji z domyślnych Next.js na właściwe.

**Contract**: `title: "Trainer App"`, `description: "Zarządzanie klientami i sesjami treningowymi"`.

### Success Criteria

#### Automated Verification

- `npm run build` przechodzi bez błędów TypeScript
- `npm run lint` przechodzi

#### Manual Verification

- Zalogowany trener na `/` → redirect na `/dashboard` (nie 404, nie default Next.js page)
- Dashboard pokazuje email trenera i linki nawigacyjne (Pakiety, Klienci, Kalendarz, Asystent)
- Linki nawigacyjne są klikalne (404 jest akceptowalne — strony powstaną w S-02+)
- Pełny E2E flow: `/register` → natychmiastowy redirect → `/dashboard` z nawigacją → Wyloguj → `/login`
- Tytuł karty przeglądarki to "Trainer App"
- Interfejs jest użyteczny na ekranie mobilnym (360px szerokości) — nav nie ucieka poza ekran

**Implementation Note**: Po Manual Verification — slice S-01 jest zamknięty. Roadmap S-01 zmienia status na `done`.

---

## Testing Strategy

### Unit Tests

Poza zakresem tego slajsu — Server Actions i auth flow najlepiej weryfikuje się E2E, nie unit testami.

### Manual Testing Steps

1. Otwórz `/register` na telefonie (lub DevTools mobile emulation 390px)
2. Zarejestruj nowe konto z unikalnym emailem
3. Zweryfikuj że trafiasz na `/dashboard` od razu z emailem i nawigacją
4. Wyloguj się → `/login`
5. Zaloguj się ponownie → `/dashboard`
6. Zamknij przeglądarkę i otwórz ponownie → sesja przeżywa (bez logowania)
7. Spróbuj zarejestrować z tym samym emailem → błąd inline
8. Spróbuj zalogować z złym hasłem → błąd inline

## Migration Notes

Brak migracji danych — Supabase auth tables są zarządzane przez Supabase automatycznie. Przed uruchomieniem: w Supabase Dashboard → Authentication → Email → wyłącz "Confirm email". Bez tego `signUp` zwróci sesję od razu, ale Supabase i tak wyśle email powitalny (ignoruj).

## References

- Roadmap: `context/foundation/roadmap.md` § S-01
- PRD: `context/foundation/prd.md` § FR-001, FR-002
- Middleware: `src/middleware.ts`
- Supabase server client: `src/lib/supabase/server.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Auth Server Actions + Login page + Minimal dashboard

#### Automated

- [x] 1.1 `npm run build` przechodzi bez błędów TypeScript
- [x] 1.2 `npm run lint` przechodzi bez błędów

#### Manual

- [ ] 1.3 Formularz logowania widoczny na `/login`
- [ ] 1.4 Błędne dane → inline błąd "Nieprawidłowy email lub hasło"
- [ ] 1.5 Poprawne dane → redirect na `/dashboard` z emailem i przyciskiem Wyloguj
- [ ] 1.6 Wyloguj → redirect na `/login`
- [ ] 1.7 Sesja przeżywa zamknięcie przeglądarki
- [ ] 1.8 Spinner widoczny podczas submit

### Phase 2: Register page

#### Automated

- [ ] 2.1 `npm run build` przechodzi bez błędów TypeScript
- [ ] 2.2 `npm run lint` przechodzi

#### Manual

- [ ] 2.3 Formularz rejestracji widoczny na `/register`
- [ ] 2.4 Niezgodne hasła → błąd "Hasła nie są zgodne" bez POST
- [ ] 2.5 Istniejący email → inline błąd "Konto z tym emailem już istnieje"
- [ ] 2.6 Nowy email → natychmiastowy redirect na `/dashboard`

### Phase 3: Dashboard nav shell + cleanup

#### Automated

- [ ] 3.1 `npm run build` przechodzi bez błędów TypeScript
- [ ] 3.2 `npm run lint` przechodzi

#### Manual

- [ ] 3.3 Zalogowany trener na `/` → redirect na `/dashboard`
- [ ] 3.4 Dashboard pokazuje email i linki nawigacyjne
- [ ] 3.5 Pełny E2E flow na mobilnym (360px)
- [ ] 3.6 Tytuł karty: "Trainer App"
