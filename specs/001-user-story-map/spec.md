# Feature Specification: User Story Map Board View

**Feature Branch**: `001-user-story-map`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: Podsumowanie ustaleń architektonicznych i biznesowych dla wtyczki **Obsidian User Story Map** (MVP) — wizualny widok tablicy, siatka 2D (Activity → Task → Epic × Release), karty historii z kaskadowym tytułem, grupowanie „Unassigned", edycja wyłącznie w Markdown, 100% lokalność danych.

## Clarifications

### Session 2026-10-15

- Q: Jak parser tablicy ma traktować linie w pliku `board.md`, które nie są linkami wiki do historii (np. nagłówki `#`, zwykły tekst, komentarze)? → A: Ignoruj wszystkie linie, które nie są linkami wiki — mapa budowana jest wyłącznie z linków do historii.
- Q: Co mapa powinna zrobić, gdy ta sama historia jest powiązana wielokrotnie (duplikowany link wiki) w pliku `board.md`? → A: Wyświetl kartę za każde wystąpienie linku — duplikaty są widoczne na mapie jako osobne karty.
- Q: Co powinno się stać, gdy użytkownik kliknie kartę historii na mapie? → A: W MVP kliknięcie karty otwiera powiązaną notatkę historii; w późniejszych iteracjach kliknięcie w trybie graficznym będzie otwierać kartę/dialog/popup z graficznym przedstawieniem informacji z notatki, bez wychodzenia z trybu board.
- Q: Jaka jest docelowa granica skali (liczba historii) dla MVP, powyżej której wtyczka nie gwarantuje płynności działania? → A: Brak sztywnej granicy skali w MVP; wtyczka musi działać również na słabszych urządzeniach mobilnych (tablet/telefon); dodano tryb debug/dev wyświetlający metryki płynności (np. fps, liczba wyświetlanych historii); optymalizacja jest priorytetem, ale również czystość kodu, uniwersalność i generyczność architektury; testy wydajności zostaną dodane później.
- Q: W jaki sposób użytkownik włącza opcjonalne sortowanie alfabetyczne wierszy Release (FR-006)? → A: Konfiguracja tablicy (w tym sortowanie) jest zapisywana jako atrybuty w nagłówku pliku tablicy (board-xyz.md), aby przetrwała synchronizację i kopiowanie oraz była czytelna również dla agentów AI bez wtyczki.
- Q: Co dokładnie powinno być wyświetlane w badge w stopce karty historii (FR-010)? → A: W MVP badge pokazuje wyłącznie wartość Release; osobny atrybut „status" jest poza zakresem MVP.
- Q: Jaki język powinny mieć etykiety interfejsu mapy (nagłówki sekcji, etykieta „Unassigned", teksty komend i ikon)? → A: W MVP interfejs bazuje wyłącznie na nazewnictwie angielskim — terminologia, etykiety i komunikaty są przechowywane w pojedynczym słowniku „en"; mechanizm słowników stanowi podstawę pod przyszłą wielojęzyczność (dodatkowe wersje słowników będą rozwijane w późniejszych iteracjach).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Otwarcie notatki tablicy jako wizualnej mapy (Priority: P1)

Użytkownik posiada notatkę `board.md` z flagą `usm-board: true` w nagłówku oraz listą linków wiki do notatek historii. Otwiera notatkę i chce zobaczyć wizualną mapę 2D zamiast surowego Markdownu.

**Why this priority**: To jest główna wartość wtyczki — wizualna mapa. Bez niej wtyczka nie dostarcza żadnej wartości.

**Independent Test**: Utwórz `board.md` z flagą i trzema linkami do historii, otwórz notatkę i zweryfikuj, że mapa renderuje się z historiami rozmieszczonymi w siatce.

**Acceptance Scenarios**:

1. **Given** notatka z flagą `usm-board: true` w nagłówku, **When** użytkownik otwiera notatkę, **Then** notatka jest wyświetlana w widoku wizualnej mapy (nie surowym Markdownem).
2. **Given** notatka bez flagi, **When** użytkownik otwiera ją, **Then** jest wyświetlana jako zwykły Markdown (wtyczka nie ingeruje).
3. **Given** notatka tablicy otwarta w widoku mapy, **When** użytkownik wybierze „Open as Markdown" (ikona w nagłówku panelu lub paleta komend), **Then** ta sama notatka przełącza się na widok surowego Markdownu bez jakiejkolwiek zmiany treści.
4. **Given** notatka z flagą otwarta w widoku Markdown, **When** użytkownik wybierze „Open as User Story Map", **Then** przełącza się na widok wizualnej mapy.

---

### User Story 2 - Podgląd historii ułożonych w siatce 2D (Priority: P1)

Użytkownik chce zobaczyć swoją ścieżkę użytkownika (user journey) ułożoną: kolumny grupowane wg Activity → Task → Epic (oś pozioma), wiersze wg Release (oś pionowa).

**Why this priority**: Układ 2D jest esencją „mapy historii" — to odróżnia mapę od zwykłej listy.

**Independent Test**: Utwórz historie z atrybutami Activity/Task/Epic/Release obejmującymi wiele wartości, otwórz tablicę i zweryfikuj, że siatka grupuje je poprawnie z właściwą kolejnością kolumn i wierszy.

**Acceptance Scenarios**:

1. **Given** historie z różnymi wartościami Activity, **When** mapa się renderuje, **Then** kolumny są grupowane wg Activity w kolejności pierwszego wystąpienia w `board.md`.
2. **Given** historie w tej samej Activity z różnymi wartościami Task, **When** mapa się renderuje, **Then** podkolumny są grupowane wg Task (zagnieżdżone pod Activity).
3. **Given** historie z różnymi wartościami Release, **When** mapa się renderuje, **Then** tworzone są wiersze per Release.
4. **Given** historia z ustawionymi Activity, Task, Epic i Release, **When** mapa się renderuje, **Then** karta historii pojawia się w polu na przecięciu kolumny Epic i wiersza Release.

---

### User Story 3 - Karty historii z czytelnymi tytułami (Priority: P2)

Każda historia pojawia się jako karta z tytułem (z ograniczeniem liczby linii) oraz stopką (badge wydania/statusu).

**Why this priority**: Karty czynią mapę skanowalną; tytuły to główna treść, którą użytkownik czyta.

**Independent Test**: Utwórz historie z atrybutem `Story` i bez niego, otwórz tablicę i zweryfikuj, że każda karta pokazuje poprawny tytuł (wg kaskady) oraz badge w stopce.

**Acceptance Scenarios**:

1. **Given** historia z atrybutem `Story` w nagłówku, **When** karta się renderuje, **Then** tytułem karty jest wartość `Story`.
2. **Given** historia bez `Story`, ale z atrybutem `title` lub pierwszym aliasem, **When** karta się renderuje, **Then** tytuł jest pobierany z tej wartości.
3. **Given** historia bez żadnej z powyższych wartości, **When** karta się renderuje, **Then** tytułem jest nazwa pliku notatki.
4. **Given** historia z długim tytułem, **When** karta się renderuje, **Then** tytuł jest ograniczony do niewielkiej liczby linii.
5. **Given** historia z wartością Release, **When** karta się renderuje, **Then** badge w stopce pokazuje wartość Release.
6. **Given** karta historii na mapie, **When** użytkownik kliknie kartę, **Then** otwiera się powiązana notatka historii w standardowym widoku.

---

### User Story 4 - Nawigacja po mapie w 2D (Priority: P2)

Użytkownik może przewijać dużą mapę w poziomie i w pionie, z nagłówkami, które pozostają widoczne podczas przewijania.

**Why this priority**: Rzeczywiste mapy są duże; nawigacja jest wymagana dla użyteczności.

**Independent Test**: Utwórz tablicę z wieloma aktywnościami i wydaniami, otwórz ją, przewijaj w obu kierunkach i zweryfikuj, że nagłówki pozostają widoczne.

**Acceptance Scenarios**:

1. **Given** mapa szersza niż obszar widoku, **When** użytkownik przewija w poziomie, **Then** wszystkie kolumny są osiągalne, a nagłówki kolumn pozostają widoczne.
2. **Given** mapa wyższa niż obszar widoku, **When** użytkownik przewija w pionie, **Then** wszystkie wiersze są osiągalne, a nagłówki wierszy pozostają widoczne.

---

### User Story 5 - Obsługa niekompletnych danych historii (Priority: P2)

Historie z brakującym jednym lub więcej atrybutami nie psują mapy; są grupowane w sekcjach „Unassigned".

**Why this priority**: Rzeczywiste dane są niekompletne; odporność jest wymogiem konstytucji (defensywne grupowanie).

**Independent Test**: Utwórz historie z brakującym Activity, Task, Epic lub Release, otwórz tablicę i zweryfikuj, że pojawiają się w sekcjach „Unassigned" bez błędów.

**Acceptance Scenarios**:

1. **Given** historia bez Release, **When** mapa się renderuje, **Then** historia pojawia się w wierszu „Unassigned" i nie jest wyświetlany żaden błąd.
2. **Given** historia bez Activity, **When** mapa się renderuje, **Then** historia pojawia się w grupie kolumn „Unassigned".
3. **Given** historia z kilkoma brakującymi atrybutami, **When** mapa się renderuje, **Then** historia jest umieszczana w odpowiednich sekcjach „Unassigned" dla każdego brakującego poziomu.

---

### User Story 6 - Edycja wyłącznie w Markdown (mapa tylko do odczytu) (Priority: P3)

Mapa jest tylko do odczytu; cała edycja odbywa się w źródle Markdown. Mapa automatycznie odzwierciedla zmiany.

**Why this priority**: Gwarantuje integralność danych (konstytucja: operacje nieniszczące, brak ryzyka uszkodzenia źródła). Edycja w widoku wizualnym jest poza zakresem MVP.

**Independent Test**: Edytuj nagłówek (frontmatter) notatki historii lub listę linków w tablicy i zweryfikuj, że mapa aktualizuje się automatycznie, bez dotykania mapy.

**Acceptance Scenarios**:

1. **Given** tablica otwarta w widoku mapy, **When** użytkownik edytuje atrybuty notatki historii w widoku Markdown, **Then** mapa aktualizuje się, odzwierciedlając zmianę (po krótkim opóźnieniu).
2. **Given** tablica otwarta w widoku mapy, **When** użytkownik dodaje nowy link do historii w `board.md`, **Then** nowa historia pojawia się na mapie.
3. **Given** tablica otwarta w widoku mapy, **When** użytkownik próbuje edytować kartę bezpośrednio na mapie, **Then** edycja nie jest dostępna (mapa jest tylko do odczytu).

---

### Edge Cases

- Co się dzieje, gdy notatka tablicy zawiera link wiki do nieistniejącej notatki (złamany link)? → Link jest pokazywany jako nierozpoznawalny (placeholder); mapa nie zawiesza się.
- Jak system obsługuje historię, której pole nagłówka jest linkiem wiki (np. `Epic: "[[Logowanie]]"`)? → Nagłówek jest klikalny i otwiera powiązaną notatkę; jeśli to zwykły tekst, działa wyłącznie jako etykieta wizualna.
- Co się dzieje, gdy ta sama wartość Activity/Task/Epic/Release występuje w różnej wielkości liter lub z polską/angielską nazwą pola? → Dopasowanie niezależne od wielkości liter normalizuje je, aby były grupowane razem.
- Co się dzieje, gdy notatka tablicy ma flagę, ale pustą listę linków? → Mapa renderuje pustą siatkę (bez historii) bez błędu.
- Co się dzieje, gdy plik tablicy zawiera nagłówki, zwykły tekst lub komentarze między linkami? → Te linie są ignorowane; mapa budowana jest wyłącznie z linków wiki do historii.
- Co się dzieje, gdy ta sama historia jest powiązana wielokrotnie (duplikowany link) w pliku tablicy? → Każde wystąpienie linku renderuje osobną kartę historii w kolejności wystąpienia.
- Co się dzieje, gdy notatka historii nie ma w ogóle nagłówka (frontmatter)? → Wszystkie atrybuty są traktowane jako brakujące; historia jest grupowana w sekcjach „Unassigned".
- Jak system obsługuje bardzo dużą liczbę historii? → Nie ma sztywnej granicy skali; mapa ma pozostać użyteczna również na słabszych urządzeniach mobilnych (tablet/telefon). Płynność można mierzyć za pomocą metryk z trybu debug/dev (np. fps, liczba wyświetlanych historii).
- Co się dzieje, gdy plik tablicy zawiera nieznany atrybut konfiguracji? → Nieznane atrybuty są ignorowane; mapa renderuje się z domyślnymi wartościami.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST wykrywać flagę `usm-board: true` w nagłówku notatki i renderować taką notatkę w widoku wizualnej mapy po jej otwarciu.
- **FR-002**: System MUST zapewniać bezszwowe przełączanie między widokiem surowego Markdownu a widokiem wizualnej mapy dla notatki z flagą, za pomocą ikony w nagłówku panelu oraz komendy w palecie komend, bez modyfikowania treści notatki.
- **FR-003**: System MUST odczytywać listę linków do historii z notatki tablicy i rozwiązywać każdy link do jego notatki docelowej; wszystkie linie, które nie są linkami wiki (nagłówki, zwykły tekst, komentarze), są ignorowane.
- **FR-004**: System MUST odczytywać atrybuty każdej notatki historii (Activity, Task, Epic, Release) z jej nagłówka (frontmatter).
- **FR-005**: System MUST dynamicznie budować hierarchię kolumn poziomych (Activity → Task → Epic) w pamięci na podstawie atrybutów historii, w kolejności pierwszego wystąpienia w notatce tablicy.
- **FR-006**: System MUST budować wiersze pionowe na podstawie atrybutu Release; kolejność wierszy jest określana atrybutem konfiguracji w nagłówku pliku tablicy (domyślnie: kolejność pierwszego wystąpienia, opcjonalnie: sortowanie alfabetyczne).
- **FR-007**: System MUST akceptować zarówno zwykły tekst, jak i linki wiki jako wartości pól nagłówkowych; wartość typu link wiki czyni nagłówek klikalnym (otwiera powiązaną notatkę), podczas gdy zwykły tekst renderowany jest jako etykieta wizualna.
- **FR-008**: System MUST renderować każdą historię jako kartę z sekcją nagłówka (tytuł) i sekcją stopki (miejsce na badge).
- **FR-009**: System MUST ustalać tytuł karty wg kaskady: atrybut `Story` → atrybut `title` / pierwszy alias → nazwa pliku notatki, oraz ograniczać tytuł do niewielkiej liczby linii.
- **FR-010**: System MUST wyświetlać wartość Release w badge w stopce karty (w MVP badge pokazuje wyłącznie wartość Release; osobny atrybut „status" jest poza zakresem MVP).
- **FR-011**: System MUST grupować historie z brakującym dowolnym atrybutem w dedykowanych sekcjach „Unassigned", bez zgłaszania błędu ani przerywania renderowania.
- **FR-012**: System MUST używać dopasowania pól niezależnego od wielkości liter, rozpoznającego polskie i angielskie nazwy pól (np. activity/aktywność, task/zadanie, epic/epik, release/wydanie/row).
- **FR-013**: System MUST automatycznie aktualizować mapę w odpowiedzi na zmiany w notatce tablicy lub powiązanych notatkach historii, bez konieczności ręcznego przeładowania i bez nadmiernego ponownego renderowania podczas aktywnej edycji.
- **FR-014**: System MUST umożliwiać nawigację 2D (przewijanie w poziomie i w pionie) z nagłówkami kolumn i wierszy pozostającymi widocznymi podczas przewijania.
- **FR-015**: System MUST utrzymywać wizualną mapę jako tylko do odczytu; cała edycja treści odbywa się w źródle Markdown.
- **FR-016**: System MUST renderować całą treść pochodzącą z notatek w sposób bezpieczny, tak aby żadna osadzona w notatce znacznikowość ani skrypt nie mogły zostać wykonane w interfejsie.
- **FR-017**: System MUST zapewniać, że po wyłączeniu wtyczki notatka tablicy pozostaje czytelną, wypunktowaną listą linków w standardowym Markdownie.
- **FR-018**: System MUST wyświetlać kartę historii za każde wystąpienie linku do niej w notatce tablicy; powtórzone (duplikowane) linki renderowane są jako osobne karty w kolejności wystąpienia.
- **FR-019**: System MUST otwierać powiązaną notatkę historii w standardowym widoku po kliknięciu karty historii na mapie (zachowanie MVP).
- **FR-020**: System MUST udostępniać tryb debug/dev, który wyświetla metryki płynności renderowania mapy (np. fps, liczba wyświetlanych historii), aby umożliwić pomiar i optymalizację wydajności.
- **FR-021**: System MUST przechowywać konfigurację tablicy (np. kolejność wierszy) jako atrybuty w nagłówku pliku tablicy, tak aby plik tablicy był samoopisujący się i przenośny — konfiguracja przetrwa synchronizację i kopiowanie oraz pozostanie czytelna również bez zainstalowanej wtyczki (np. dla agentów AI odczytujących notatki).

### Key Entities

- **Notatka tablicy (Board Note)**: Notatka Markdown z flagą `usm-board: true`, zawierająca uporządkowaną listę linków wiki do notatek historii oraz atrybuty konfiguracji tablicy (np. kolejność wierszy). Określa, które historie znajdują się na mapie, w jakiej kolejności i jak je interpretować; plik jest samoopisujący się i przenośny.
- **Notatka historii (Story Note)**: Notatka Markdown reprezentująca pojedynczą historię użytkownika, z atrybutami w nagłówku (Activity, Task, Epic, Release, opcjonalnie Story/title) oraz treścią (opis/kryteria akceptacji).
- **Karta historii (Story Card)**: Wizualna reprezentacja notatki historii na mapie, z nagłówkiem (tytuł) i stopką (badge).
- **Hierarchia kolumn (Activity → Task → Epic)**: Pozioma struktura grupowania budowana dynamicznie z atrybutów historii.
- **Wiersz wydania (Release Row)**: Poziomy wiersz mapy odpowiadający wartości Release.
- **Sekcja „Unassigned"**: Zastępcza grupa kolumn/wierszy zbierająca historie z brakującym danym atrybutem.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Użytkownik może otworzyć notatkę tablicy z flagą i zobaczyć wizualną mapę; płynność renderowania jest mierzalna za pomocą metryk z trybu debug/dev (np. fps, liczba wyświetlanych historii), a docelowe progi wydajnościowe zostaną ustalone na podstawie tych metryk i testów.
- **SC-002**: 100% historii z kompletnymi atrybutami pojawia się w prawidłowym polu siatki (poprawna kolumna Activity/Task/Epic i wiersz Release) przy pierwszym renderowaniu.
- **SC-003**: 100% historii z jednym lub więcej brakującymi atrybutami jest umieszczanych w odpowiedniej sekcji „Unassigned" bez błędu ani zawieszenia.
- **SC-004**: Użytkownik może przełączać się między widokiem mapy a widokiem Markdownu i z powrotem bez jakiejkolwiek zmiany treści notatki (zweryfikowane porównaniem treści).
- **SC-005**: Po edycji notatki historii lub notatki tablicy mapa odzwierciedla zmianę w ciągu 2 sekund (po opóźnieniu) bez ręcznego przeładowania.
- **SC-006**: Użytkownik może przewijać mapę o co najmniej 10 kolumnach i 5 wierszach w obu kierunkach, z nagłówkami pozostającymi widocznymi.
- **SC-007**: Treść notatek nigdy nie opuszcza lokalnej maszyny (działanie w 100% lokalne, bez wysyłania danych na zewnątrz).
- **SC-008**: 90% użytkowników poprawnie identyfikuje Activity i Release danej historii, czytając mapę, bez otwierania leżącej pod spodem notatki.

## Assumptions

- Docelowi użytkownicy to użytkownicy Obsidian, którzy już organizują swoją pracę w notatkach Markdown i linkach wiki; w MVP nie jest wymagany nowy interfejs wprowadzania danych.
- Notatka tablicy i notatki historii znajdują się w tej samej kryptcie (vault); odniesienia między kryptami są poza zakresem.
- Wizualna mapa w MVP jest tylko do odczytu; przeciąganie i upuszczanie (drag-and-drop), edycja inline oraz tworzenie notatek z mapy są poza zakresem tego kamienia milowego.
- W późniejszych iteracjach kliknięcie karty w trybie graficznym będzie otwierać dialog/popup z graficznym przedstawieniem treści notatki bez wychodzenia z trybu board; w MVP kliknięcie karty otwiera notatkę w standardowym widoku.
- Wydajność jest priorytetem, ale w MVP równie ważna jest czystość kodu, uniwersalność i generyczność architektury zapewniająca zdrowy rozwój; sztywne progi wydajnościowe zostaną ustalone później na podstawie metryk z trybu debug/dev i testów.
- Rozsądna domyślna wartość ograniczenia liczby linii tytułu to mała, stała liczba (np. 2–3 linie); dokładna wartość jest detalem interfejsu.
- Konfiguracja tablicy (np. kolejność wierszy Release) jest zapisywana jako atrybuty w nagłówku pliku tablicy; domyślna kolejność to kolejność pierwszego wystąpienia, opcjonalnie sortowanie alfabetyczne. Dzięki temu konfiguracja przetrwa synchronizację i kopiowanie oraz pozostanie czytelna również bez zainstalowanej wtyczki (np. dla agentów AI odczytujących notatki).
- Wtyczka wspiera zarówno Desktop, jak i Mobile; nie są używane API Node.js/Electron.
- Dopasowanie nazw pól domyślnie opiera się na wbudowanym słowniku synonimów po polsku i angielsku; użytkownik nie musi go konfigurować w MVP.
- Etykiety interfejsu mapy (nagłówki sekcji, etykieta „Unassigned", teksty komend i ikon) są w MVP wyłącznie po angielsku i przechowywane w pojedynczym słowniku „en"; mechanizm słowników jest podstawą pod przyszłą wielojęzyczność — dodatkowe wersje słowników będą opracowywane w późniejszych iteracjach.
