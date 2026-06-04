---
project: Trainer App
version: 1
status: draft
created: 2026-05-18
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 6
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Trener personalny prowadzący solo biznes traci kontekst o kliencie między wizytami. Przed każdą sesją musi przeszukiwać notatki, żeby przypomnieć sobie wywiad, motywacje i poprzedni trening. Kiedy to wyszukiwanie zawodzi — trening staje się generyczny, klient czuje się jak "jeden z wielu", a trener traci przewagę profesjonalną, która uzasadnia jego stawkę.

Trenerzy nie potrzebują kolejnej aplikacji do notatek — potrzebują jednego miejsca, które syntetyzuje kontekst o kliencie na żądanie. Asystent dostępny przez telefon, oparty na danych, które trener sam wprowadził, eliminuje rytuał poszukiwań przed sesją. Żaden istniejący produkt nie łączy warstwy danych specyficznej dla trenera (pakiety, notatki z wywiadu, kalendarz wizyt) z asystentem kontekstu dostępnym w jednym miejscu.

## User & Persona

**Trener personalny solo**

Prowadzi własny biznes z 5–20 aktywnymi klientami tygodniowo. Dostęp do aplikacji głównie przez smartphone — 5–10 minut przed sesją lub między ćwiczeniami. Technicznie przeciętny: korzysta ze smartfona i kalendarza online; może być to jego pierwsza dedykowana aplikacja do zarządzania treningami.

Kluczowa potrzeba: natychmiastowy dostęp do pełnego kontekstu konkretnego klienta — notatek z wywiadu, celów, stanu pakietu i planu treningowego — bez otwierania wielu aplikacji lub przeszukiwania notatek.

## Success Criteria

### Primary

Trener przechodzi pełny flow v1 bez żadnej zewnętrznej aplikacji:
1. Rejestruje się i loguje przez email + hasło
2. Dodaje pakiet (nazwa, liczba wizyt, cena)
3. Dodaje klienta (dane, przypisany pakiet, notatki z wywiadu, link do planu)
4. Dodaje wizyty klienta do kalendarza tygodniowego
5. Klika na wizytę → widzi pełną kartę klienta z liczbą pozostałych wizyt w pakiecie

Jeśli trener może to zrobić end-to-end na telefonie w mniej niż 10 minut od nowego konta — v1 działa.

### Secondary

Widok podsumowania miesięcznego: liczba odbytych wizyt, szacowany przychód. Prosty widok statystyk redukujący czas rozliczeń na koniec miesiąca.

### Guardrails

- Dane klientów trenera nigdy nie są dostępne z konta innego trenera.
- Interfejs jest w pełni użyteczny w mobilnej przeglądarce bez instalacji.
- Kalendarz zawsze wyświetla poprawny tydzień — błędy w datach niszczą zaufanie do produktu.

## User Stories

### US-01: Sprawdzenie klienta przed sesją

- **Given** trener otwiera aplikację na telefonie 5 minut przed treningiem
- **When** klika na sesję w widoku tygodniowym kalendarza
- **Then** natychmiast widzi pełną kartę klienta: przypisany pakiet z liczbą pozostałych wizyt, notatki z wywiadu, cele treningowe i link do planu

#### Acceptance Criteria
- Karta klienta ładuje się w ciągu 2 sekund od kliknięcia w wizytę
- Liczba pozostałych wizyt z pakietu jest widoczna bez przewijania
- Link do planu treningowego otwiera się w nowej karcie

### US-02: Zapytanie do asystenta o klienta

- **Given** trener jest gdziekolwiek w aplikacji
- **When** otwiera asystenta AI (przez dedykowaną stronę lub floating button) i zadaje pytanie o konkretnego klienta w języku naturalnym
- **Then** otrzymuje odpowiedź opartą na danych tego klienta: notatki z wywiadu, historia wizyt, stan pakietu i notatki z planu

#### Acceptance Criteria
- Asystent wyświetla widoczny postęp jeśli odpowiedź trwa dłużej niż 2 sekundy
- Odpowiedź jest oparta wyłącznie na danych wprowadzonych przez trenera — asystent nie prezentuje zmyślonych szczegółów jako faktu
- Asystent odpowiada na pytania o statystyki ("ile wizyt w tym miesiącu", "ile zarobiłem w tym tygodniu") korzystając z danych wizyt i pakietów trenera

## Functional Requirements

### Autentykacja

- FR-001: Trener może zarejestrować się i zalogować przez email + hasło. Priority: must-have
  > Socratic: Kontrargument: "OAuth to zewnętrzna zależność wymagająca Google Cloud Console." Rozwiązanie: email+hasło w v1, Google sign-in w v2.
- FR-002: Trener pozostaje zalogowany między sesjami (persistent session). Priority: must-have
  > Socratic: Brak kontrargumentu — persistent session to requirement mobilny.

### Pakiety

- FR-003: Trener może dodać pakiet (nazwa, liczba wizyt, cena). Priority: must-have
  > Socratic: Kontrargument: "zahardkodować pakiety." Odrzucony — każdy trener ma inne struktury cenowe.
- FR-004: Trener może edytować i usunąć pakiet. Priority: must-have
  > Socratic: Brak kontrargumentu — pakiety zmieniają się w czasie.

### Klienci

- FR-005: Trener może dodać klienta (imię, nazwisko, dane kontaktowe). Priority: must-have
- FR-006: Trener może przypisać pakiet do klienta. Priority: must-have
- FR-007: Trener może zapisać wywiad klienta (motywacje, cele, notatki freetext). Priority: must-have
  > Socratic: Kontrargument: "ustrukturyzowany formularz lepiej dla AI." Rozwiązanie: freetext w v1 wystarczy; asystent może przeszukiwać tekst swobodny.
- FR-008: Trener może dodać link do planu treningowego klienta (URL do zewnętrznego dokumentu, np. Google Docs lub Excel). Priority: must-have
  > Socratic: Brak kontrargumentu — link nie wymaga implementacji, tylko pole tekstowe.
- FR-009: Trener może edytować dane klienta. Priority: must-have

### Kalendarz i wizyty

- FR-010: Trener może dodać wizytę do kalendarza (data, godzina, przypisany klient). Priority: must-have
- FR-011: Trener może przeglądać kalendarz w widoku miesięcznym, tygodniowym i dziennym oraz przełączać się między nimi. Priority: must-have
  > Socratic: Widok tygodniowy to domyślny i najważniejszy — trener planuje tygodniowo. Widoki miesięczny i dzienny dodane w S-04 na żądanie, aby umożliwić szybki przegląd miesiąca i szczegółowy widok dnia.
- FR-012: Trener może kliknąć na wizytę i zobaczyć pełną kartę klienta. Priority: must-have
  > Socratic: Brak kontrargumentu — to core value flow.
- FR-013: Trener może edytować i usunąć wizytę. Priority: must-have
  > Socratic: Brak kontrargumentu — odwołania to codzienna rzeczywistość.

### Licznik pakietu

- FR-014: System wyświetla ile wizyt pozostało klientowi z aktualnego pakietu — na karcie klienta i na wizytach w kalendarzu. Priority: must-have
  > Socratic: Brak kontrargumentu — to jeden z głównych bolów trenera, core feature.

### Asystent AI

- FR-015: Trener może zadać pytanie w języku naturalnym o konkretnego klienta (wywiad, plan, liczba wizyt, stan pakietu). Priority: must-have
- FR-016: Trener może zapytać o statystyki ogólne (ile wizyt w tym miesiącu, szacowany przychód). Priority: must-have
- FR-017: Asystent AI jest dostępny przez osobną stronę oraz floating button widoczny w całej aplikacji. Priority: must-have

## Non-Functional Requirements

- Dane klientów są dostępne wyłącznie w aktywnej, uwierzytelnionej sesji. Dane jednego konta trenera nigdy nie są widoczne dla użytkownika zalogowanego na inne konto.
- Aplikacja jest w pełni użyteczna w aktualnej mobilnej przeglądarce bez instalacji; nie wymaga pobrania ze sklepu z aplikacjami.
- Karta klienta ładuje się i renderuje w całości w ciągu 2 sekund w typowych warunkach sieci mobilnej.
- Asystent zapewnia widoczny postęp podczas każdej odpowiedzi trwającej dłużej niż 2 sekundy; trener nigdy nie jest pozostawiony z nieruchomym, niereagującym ekranem.
- Odpowiedzi asystenta są oparte na danych wprowadzonych przez trenera; asystent nie prezentuje zmyślonych szczegółów jako faktu.

## Business Logic

Aplikacja automatycznie oblicza liczbę pozostałych wizyt w pakiecie każdego klienta oraz odpowiada na pytania trenera w języku naturalnym o kontekst klienta i statystyki, korzystając wyłącznie z danych wprowadzonych przez trenera.

**Licznik pakietu:** Liczba pozostałych wizyt równa się liczbie wizyt w pakiecie minus liczba zarejestrowanych wizyt odbytych. Gdy ta wartość wynosi ≤ 2, pakiet jest oznaczony jako "kończący się". Stan ten jest widoczny na karcie klienta i na każdej wizycie w kalendarzu. Aplikacja raportuje ten stan — nie sugeruje odnowienia pakietu.

**Asystent kontekstu:** Gdy trener zadaje pytanie o konkretnego klienta, odpowiedź jest oparta na pełnej kartotece tego klienta — wywiadzie, historii wizyt, stanie pakietu i notatkach z planu treningowego. Gdy trener pyta o statystyki ogólne, odpowiedź jest wyprowadzana z wszystkich wizyt i pakietów zarejestrowanych na jego koncie. Trener formułuje pytanie; aplikacja pobiera i syntetyzuje odpowiednie dane.

## Access Control

**Autentykacja:** Email + hasło w v1. Logowanie przez konto Google planowane w v2 dla zmniejszenia tarcia na telefonie. Rejestracja i logowanie to ten sam punkt wejścia.

**Model autoryzacji:** Flat. Jedno konto trenera ma pełny dostęp do wszystkich danych wprowadzonych pod tym kontem. Brak ról, brak użytkowników admin i brak współdzielonego dostępu między kontami w v1.

**Zachowanie sesji:** Sesja trwa przez ponowne uruchomienia przeglądarki do momentu jawnego wylogowania lub wygaśnięcia po czasie bezczynności. Nieautentykowane żądania do chronionych tras przekierowują na stronę logowania.

## Non-Goals

- **Proponowanie wolnych terminów przez asystenta AI** — asystent odpowiada na pytania trenera, nie zarządza aktywnie kalendarzem.
- **Dostęp klienta do aplikacji** — klient nie loguje się i nie widzi kalendarza ani kart. Dostęp wyłącznie dla trenera.
- **Automatyczne powiadomienia do klientów** — brak wysyłania wiadomości do klientów w v1. Trener zarządza komunikacją samodzielnie.
- **Obsługa wielu trenerów / studio** — tylko model solo-trenera w v1. Multi-tenant to osobna iteracja.
- **Aplikacja mobilna natywna** — tylko web app w v1. Dystrybucja przez sklep z aplikacjami poza zakresem MVP.

## Open Questions

Brak otwartych pytań — wszystkie luki z shape-notes zostały rozwiązane przed generowaniem PRD (`quality_check_status: accepted`).

1. **target_scale.qps i target_scale.data_volume** — nie zostały jawnie określone podczas shapowania. Wartości szacunkowe (`qps: low`, `data_volume: small`) wyprowadzone z zadeklarowanej skali `users: small` i przypadku użycia (solo-trener, 5–20 klientów, dane tekstowe i kalendarzowe). Nadpisz jeśli faktyczny profil wdrożenia odbiega od założeń.
