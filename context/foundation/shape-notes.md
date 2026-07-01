---
project: Trainer App
context_type: greenfield
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 6
  after_hours_only: true
  hard_deadline: null
updated: 2026-05-18
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 17
  quality_check_status: accepted
---

## Vision & Problem Statement

**Ból:** Trener personalny traci kontekst o kliencie między wizytami — przed każdą sesją musi przeszukiwać notatki, żeby przypomnieć sobie wywiad, motywacje i poprzedni trening. Ryzyko: trening jest niepersonalny, klient czuje się jak "jeden z wielu".

**Osoba:** Trener personalny prowadzący solo biznes (kilku–kilkanastu klientów tygodniowo).

**Moment bólu:** Tuż przed wizytą lub w jej trakcie — trener sięga po telefon żeby sprawdzić co było ostatnio i co klient mówił o swoich celach.

**Koszt dziś:** Manualne notatki rozrzucone po różnych miejscach (aplikacje, kartki, pamięć), wieloaplikacyjna żonglerka (kalendarz osobno, notatki osobno, rozliczenia osobno), ryzyko przeoczenia kończącego się pakietu.

**Insight:** Trenerzy nie potrzebują kolejnej aplikacji do notatek — potrzebują jednego miejsca, które syntetyzuje kontekst o kliencie na żądanie (asystent AI), zamiast zmuszać trenera do szukania go samemu.

## User & Persona

**Główna persona:** Trener personalny solo

- Prowadzi własny biznes, 5–20 klientów tygodniowo
- Dostęp do systemu głównie przez telefon — między ćwiczeniami lub 5–10 minut przed wizytą
- Technicznie przeciętny: korzysta ze smartfona, kalendarza online, może być pierwszym razem z dedykowaną aplikacją dla trenera
- Kluczowa potrzeba: szybki dostęp do kontekstu o konkretnym kliencie, bez przeszukiwania notatek

## Access Control

- **Metoda v1:** Email + hasło (rejestracja i logowanie)
- **Metoda v2:** Google OAuth (odroczone — uprości logowanie na telefonie)
- **Model ról:** Flat — jedno konto trenera, brak hierarchii ról w MVP
- **Sesja:** Standardowa sesja webowa; trener pozostaje zalogowany na urządzeniu

## Success Criteria

### Primary

Trener może przejść pełny flow v1 bez żadnej zewnętrznej aplikacji:
1. Loguje się przez email + hasło
2. Dodaje pakiet (nazwa, liczba wizyt, cena)
3. Dodaje klienta (dane, przypisany pakiet, wywiad/cele, link do planu treningowego)
4. Dodaje wizyty klienta w kalendarzu (widok tygodniowy)
5. Klika na wizytę → widzi pełną kartę klienta

Flow działa = MVP działa.

### Secondary

Podsumowanie miesięczne — ile wizyt odbyto, szacowany przychód. Prosty widok statystyk.

### Guardrails

- Dane klientów są izolowane per konto trenera (brak dostępu cross-user)
- Interfejs działa poprawnie na telefonie (responsywność mobilna)
- Kalendarz wyświetla poprawny tydzień (błędne daty = utrata zaufania do produktu)

## Timeline Budget

- **mvp_weeks:** 6 (v1 z AI — świadoma decyzja, timeline zaakceptowany)
- **after_hours_only:** true
- **hard_deadline:** null
- **Acknowledged 2026-05-18:** 6-tygodniowy MVP wymaga wytrwałości; user zaakceptował koszt.
- **Nota AI:** Asystent AI włączony do v1 jako core feature — bez niego produkt nie rozwiązuje głównego bólu.

## Functional Requirements

### Autentykacja

- FR-001: Trener może zarejestrować się i zalogować przez email + hasło. Priority: must-have
  > Socrates: Kontrargument: "OAuth to zewnętrzna zależność wymagająca Google Cloud Console." Rozwiązanie: email+hasło w v1, Google OAuth w v2.
- FR-002: Trener pozostaje zalogowany między sesjami (persistent session). Priority: must-have
  > Socrates: Brak kontrargumentu — persistent session to requirement mobilny.

### Pakiety

- FR-003: Trener może dodać pakiet (nazwa, liczba wizyt, cena). Priority: must-have
  > Socrates: Kontrargument: "zahardkodować pakiety." Odrzucony — każdy trener ma inne struktury cenowe.
- FR-004: Trener może edytować i usunąć pakiet. Priority: must-have
  > Socrates: Brak kontrargumentu — pakiety zmieniają się w czasie.

### Klienci

- FR-005: Trener może dodać klienta (imię, nazwisko, dane kontaktowe). Priority: must-have
- FR-006: Trener może przypisać pakiet do klienta. Priority: must-have
- FR-007: Trener może zapisać wywiad klienta (motywacje, cele, notatki freetext). Priority: must-have
  > Socrates: Kontrargument: "ustrukturyzowany formularz lepiej dla AI." Rozwiązanie: freetext w v1 wystarczy; AI w v2 może przeszukiwać tekst.
- FR-008: Trener może dodać link do planu treningowego klienta (URL do Google Docs / Excel). Priority: must-have
  > Socrates: Brak kontrargumentu — link nie wymaga implementacji, tylko pole tekstowe.
- FR-009: Trener może edytować dane klienta. Priority: must-have

### Kalendarz i wizyty

- FR-010: Trener może dodać wizytę do kalendarza (data, godzina, przypisany klient). Priority: must-have
- FR-011: Trener może przeglądać kalendarz w widoku tygodniowym (widok domyślny), a także miesięcznym i dziennym. Priority: must-have
  > Socrates: Kontrargument: "potrzeba widoku miesięcznego." Pierwotnie odrzucony (trener planuje tygodniowo), ostatecznie zaimplementowany — kalendarz dostarcza przełącznik Miesiąc/Tydzień/Dzień (`CalendarNav.tsx`, `MonthView`/`WeekView`/`DayView`). Widok tygodniowy pozostaje domyślny.
- FR-012: Trener może kliknąć na wizytę i zobaczyć pełną kartę klienta. Priority: must-have
  > Socrates: Brak kontrargumentu — to core value flow.
- FR-013: Trener może edytować i usunąć wizytę. Priority: must-have
  > Socrates: Brak kontrargumentu — odwołania to codzienna rzeczywistość.

### Licznik pakietu

- FR-014: System wyświetla ile wizyt pozostało klientowi z aktualnego pakietu — na karcie klienta i na wizytach w kalendarzu. Priority: must-have
  > Socrates: Brak kontrargumentu — to jeden z głównych bolów trenera, core feature.

### Asystent AI

- FR-015: Trener może zadać pytanie w języku naturalnym o konkretnego klienta (wywiad, plan, liczba wizyt, stan pakietu). Priority: must-have
- FR-016: Trener może zapytać o statystyki ogólne (ile wizyt w tym miesiącu, szacowany przychód). Priority: must-have
- FR-017: Asystent AI jest dostępny przez osobną stronę oraz floating button widoczny w całej aplikacji. Priority: must-have

## Business Logic

**Reguła v1 — Licznik pakietu:** Aplikacja oblicza `pozostałe wizyty = liczba wizyt w pakiecie − liczba odbytych wizyt`. Gdy wynik wynosi ≤ 2, stan pakietu jest oznaczony jako "kończący się". Wartość jest widoczna na karcie klienta i przy każdej wizycie w kalendarzu. Aplikacja nie sugeruje przedłużenia — tylko informuje.

**Reguła v1 — Asystent AI:** Aplikacja pobiera dane klienta z bazy (wywiad, wizyty, stan pakietu, link do planu) i wysyła je jako kontekst do LLM — trener zadaje pytanie w języku naturalnym i dostaje odpowiedź. Przy skali 5–20 klientów nie wymaga RAG — wystarczy inject danych konkretnego klienta jako kontekst. To właściwy rdzeń wartości produktu.

## Non-Functional Requirements

- Dane klientów są dostępne wyłącznie dla zalogowanego trenera-właściciela konta. Sesja wygasa po wylogowaniu lub po określonym czasie bezczynności.
- Aplikacja działa w przeglądarce mobilnej bez instalacji (web app, nie natywna).
- Ładowanie karty klienta nie przekracza czasu zauważalnego dla użytkownika (poniżej 2s w typowych warunkach sieciowych).

## Non-Goals

- **Proponowanie wolnych terminów przez AI** — AI odpowiada na pytania, nie zarządza kalendarzem aktywnie.
- **Dostęp klienta do aplikacji** — klient nie loguje się, nie widzi kalendarza ani kart. Tylko trener ma dostęp.
- **Automatyczne powiadomienia do klientów** — brak wysyłania SMS/email do klientów w v1. Trener zarządza komunikacją samodzielnie.
- **Obsługa wielu trenerów / studio** — tylko model solo-trenera w v1. Multi-tenant to osobna iteracja.
- **Aplikacja mobilna natywna** — tylko web app w v1. App Store/Google Play poza zakresem.

## Forward: tech-stack

- Auth: email+hasło (v1), Google OAuth (v2)
- AI integration (v1): LLM (Claude API lub OpenAI) — inject danych klienta jako kontekst, brak RAG potrzebny przy tej skali
- Linki do planów: Google Docs / Excel — tylko URL, bez integracji API

## User Stories

### US-01: Sprawdzenie klienta przed wizytą

**Given** trener otwiera aplikację na telefonie 5 minut przed treningiem,
**When** klika na wizytę w kalendarzu tygodniowym,
**Then** widzi kartę klienta z: przypisanym pakietem i liczbą pozostałych wizyt, notatkami z wywiadu, celami treningowymi i linkiem do planu.

