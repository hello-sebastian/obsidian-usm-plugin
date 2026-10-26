# Koncepcja: Refaktoryzacja wyglądu i struktury tablicy USM

**Cecha**: `001-user-story-map` (refaktoryzacja frontendu / warstwy wizualnej)
**Data**: 2026-10-26
**Status**: Wstępna koncepcja — baza dla `/speckit-specify`. **Nic nie jest implementowane.**
**Źródła**: design Figma (fileKey `J3R2VCQfxw6crtOqMm76yY`, node `76:421`), `figma-agent-manual.md` (kontrakt tokenów), bieżąca implementacja (`src/ui/board-renderer.ts`, `src/domain/*`, `styles.css`).

---

## 1. Cel

Przeprojektowanie warstwy wizualnej tablicy (widoku mapy) tak, aby:

1. **Nagłówek tablicy (sticky) był zapisany w poziomych wierszach** — zamiast zajmować dużo miejsca na urządzeniach mobilnych (pionowy ekran). Konkretnie: nagłówek Release przestaje być sticky kolumną z lewej i staje się poziomym wierszem (nagłówkiem sekcji); blok nagłówków kolumn (Activity/Task/Epic) pozostaje sticky na górze.
2. **Struktura tablicy odwzorowuje zależności między obiektami**: współrzędne Story — w pionie: `release` + kolejność w releasie; w poziomie: `task` (i jego rodzic `activity`).
3. **Struktura DOM jest przygotowana pod przyszłe funkcje** (collapse releasu, drag&drop, dodawanie/usuwanie, nawigacja klawiaturą) — bez ich implementacji, tak by nie utrudniały późniejszego wdrożenia.
4. **Wygląd odpowiada designowi Figma**, a tokeny są interpretowane zgodnie z kontraktem z `figma-agent-manual.md` (kod konsumuje wyłącznie nazwy L2 = natywne `--*` Obsidian; żywe `var(--...)`; bez hex, bez cache'owania kolorów).

**Poza zakresem tej koncepcji**: implementacja przyszłych funkcji (DnD, CRUD, klawiatura), zmiana formatu plików (board/story), logika domeny poza zmianą modelu siatki wymuszoną nową hierarchią kolumn.

---

## 2. Analiza bieżącego stanu

Bieżąca implementacja (T013/T017, `board-renderer.ts` + `styles.css`):

- Pojedynczy kontener scrolla `.usm-board-map` (`overflow: auto`, obie osie).
- Pojedyncza siatka CSS `.usm-board-grid` (`width: max-content`), dynamiczne szablony przez `--usm-grid-cols` / `--usm-grid-rows` (ustawiane per render).
- **3 wiersze nagłówków kolumn** (Activity / Task / Epic) — sticky na górze, stała wysokość `--usm-header-h: 28px` (mobile 24px).
- **1 kolumna nagłówków wierszy** (Release) — sticky z lewej, `--usm-rowheader-w: 140px` (mobile 96px).
- Komórka = przecięcie kolumny **Epic** × wiersza Release; klucz komórki `activity::task::epic::release`.
- Hierarchia kolumn: **Activity → Task → Epic** (Epic = kolumna liściowa).

**Problem mobilny (główny motyw refaktora)**: na pionowym ekranie (np. 375 px) sticky kolumna Release (96 px) + 3 wiersze nagłówków (3 × 24 px + luki) pochłaniają dużą część przestrzeni; na same kolumny z kartami zostaje mało miejsca.

---

## 3. Cel wizualny (Figma, node 76:421)

Design pokazuje:

- **Góra — blok nagłówków kolumn w poziomych wierszach**: wiersz Activity (nagłówki rozpięte na swoje Taski) + wiersz Task (rozpięte na swoje Epiki) + wiersz Epic (po jednym na kolumnę liściową). Każdy nagłówek to karta z nazwą + badge (chip). W designie Figma **2 wiersze** (Activity, Task) — to uproszczony mockup; zgodnie z decyzją Epic pozostaje poziomem grupowania (3 wiersze w implementacji).
- **Dół — sekcje Release ułożone pionowo**: każda sekcja = nagłówek releasu (poziomy wiersz: chevron + pogrubiona nazwa, z górną krawędzią-dividerem) + siatka kolumn Epic (każda kolumna = kontener z kartami Story).
- Kolumny mają **stałą szerokość** (w designie ~243 px), karty Story ~224 px.
- Chevron w nagłówku releasu (`chevron_forward` obrócony o 90° = chevron-down) sugeruje collapse/expand.

**Kluczowa zmiana strukturalna**: nagłówek Release przestaje być sticky kolumną z lewej → staje się poziomym wierszem (nagłówkiem sekcji). Znika sticky kolumna z lewej → cała szerokość ekranu jest dostępna na kolumny. Blok nagłówków kolumn (Activity/Task/Epic) pozostaje sticky na górze.

---

## 4. Nowa struktura DOM

```
.usm-board-map                          (kontener scrolla, overflow: auto, obie osie)
  .usm-board                            (width: max-content — umożliwia scroll poziomy + sticky)
    .usm-board-header                   (position: sticky; top: 0; z-index: 3 — sticky blok nagłówków kolumn)
      .usm-header-row.usm-header-row--activity
        .usm-header-cell.usm-header-cell--activity   (per Activity; grid-column: span = liczba jego Tasków)
          [REZERWA: uchwyt DnD, przycisk dodawania, przycisk usuwania]
      .usm-header-row.usm-header-row--task
        .usm-header-cell.usm-header-cell--task       (per Task; grid-column: span = liczba jego Epiców)
          [REZERWA: uchwyt DnD, przycisk dodawania, przycisk usuwania]
      .usm-header-row.usm-header-row--epic
        .usm-header-cell.usm-header-cell--epic       (per Epic; kolumna liściowa)
          [REZERWA: uchwyt DnD, przycisk dodawania, przycisk usuwania]
    .usm-board-releases                 (pionowy stos sekcji Release)
      section.usm-release               (per Release)
        .usm-release-header             (poziomy wiersz: chevron + nazwa releasu; górna krawędź-divider)
          button.usm-release-toggle     (chevron; REZERWA: collapse/expand)
          .usm-release-title            (nazwa releasu; opcjonalnie sticky-left)
          [REZERWA: uchwyt DnD do zmiany kolejności releasów]
        .usm-release-body               (REZERWA: ukryty po zwinięciu sekcji)
          .usm-release-grid             (siatka; TEN SAM szablon kolumn co .usm-board-header)
            .usm-epic-column            (per kolumna Epic; kolumna liściowa; ta sama kolejność co w nagłówku)
              .usm-epic-column-cards    (pionowy stos kart Story)
                .usm-story-card         (per Story, w kolejności appearance)
                  .usm-story-card-header (tytuł)
                  .usm-story-card-footer (badge — roboczy, bez zmian w tej iteracji)
                  [REZERWA: uchwyt DnD karty]
```

**Zasady strukturalne**:

- `.usm-board-header` i każda `.usm-release-grid` używają **tego samego szablonu kolumn** (`grid-template-columns: repeat(N, var(--usm-col-w))`) → kolumny w nagłówku i we wszystkich sekcjach są idealnie wyśrodkowane/wyrównane.
- `N` = liczba kolumn Epic (kolumny liściowe w hierarchii Activity → Task → Epic). Nagłówek Activity rozpięty jest na kolejne kolumny jego Tasków, nagłówek Task na kolejne kolumny jego Epiców.
- Elementy oznaczone `[REZERWA]` to miejsca w DOM pod przyszłe funkcje — istnieją strukturalnie, ale są nieaktywne/niewidoczne do momentu wdrożenia (patrz sekcja 8).

---

## 5. Architektura scroll / sticky

**Kontener**: jeden kontener scrolla `.usm-board-map` (`overflow: auto`, obie osie) — spójnie z bieżącym podejściem (research R-04, bez geometrii w JS).

**Sticky**:
- `.usm-board-header` → `position: sticky; top: 0` (zostaje na górze przy scrollu pionowym).
- `.usm-release-header` → **nie jest sticky** (przewija się z treścią sekcji) — to nagłówek sekcji, nie nagłówek tabeli. Opcjonalnie: `.usm-release-title` jako `position: sticky; left: 0`, aby nazwa releasu pozostała widoczna przy scrollu poziomym (decyzja otwarta, patrz sekcja 9).

**Architektura siatki (rozstrzygnięto: wiele siatek / sekcje)**: nagłówek kolumn i każda sekcja Release to osobne siatki. Rozważona alternatywa: pojedyncza siatka z pełnoszerokościowymi wierszami nagłówków Release (`grid-column: 1 / -1`) — osiąga ten sam układ wizualny, ale odrzucona, bo:

- **Release bez spójnego elementu DOM**: w pojedynczej siatce Release to tylko zbiór wierszy (nagłówek + karty). Collapse/expand wymagałoby ukrycia wierszy (ukryty track i tak zostawia podwójny gap — `row-gap` między wierszami) i przeliczenia `--usm-grid-rows`; DnD releasu pionowo = przeliczenie szablonu + re-pozycjonowanie wszystkich komórek. W sekcji: `display: none` na `.usm-release-body` / reorder elementów `section`.
- **Lazy render / wirtualizacja per release**: `IntersectionObserver` per sekcja — jedyna realistyczna ścieżka skalowalności dla dużych boardów; w pojedynczej siatce wirtualizacja 2D jest skomplikowana.
- **Metadane releasu** (data, postęp, badge — przyszłość): naturalne miejsce w nagłówku sekcji.
- **Kompozycyjność**: `ReleaseSection` jako samodzielny komponent — testowalny i rozszerzalny niezależnie.

DnD kolumn Task i DnD Story są porównywalne w obu architekturach (re-render / zmiana pozycji), więc nie przesądzają wyboru. Koszt wielu siatek: stała szerokość kolumn (patrz niżej) — akceptowalny, bo stała szerokość kolumn to standard branżowy (Notion, Trello).

**Nuans implementacyjny**: nagłówek (Activity/Task/Epic) musi pozostać grid (wymaga `span`); ciała sekcji mogą być grid lub flex columns — kluczowe jest opakowanie w `section`.

**Wyrównanie kolumn (kluczowy problem)**: w bieżącym modelu jedna siatka współdzieli tracki, więc kolumny są spójne. W nowym układzie nagłówek i każda sekcja to **osobne siatki** — przy rozmiarze opartym o treść (`max-content`) ich szerokości kolumn mogłyby się różnić. Rozwiązanie:

- **Stała szerokość kolumn** (`--usm-col-w`, np. 240 px; mobile ~160 px przez media query). Wszystkie siatki (nagłówek + sekcje) używają tego samego szablonu → wyrównanie gwarantowane, bez JS. Zgodne z designem Figma (stałe 243 px). Długi tytuł zawija się / jest przycinany (clamp) w obrębie stałej szerokości — design i tak clampuje tytuły.
- Odrzucone alternatywy: pojedyncza siatka z pełnoszerokościowymi wierszami Release (Release bez spójnego elementu DOM — patrz wyżej), CSS subgrid (eleganckie, ale sticky + subgrid jest kapryśne i zależne od wersji Chromium w Obsidian) oraz mierzenie szerokości w JS (narusza R-04 „bez geometrii w JS").

**Zysk mobilny**: znika sticky kolumna z lewej (96 px na mobile) + nagłówek Release jest cienkim poziomym wierszem (~24 px) zamiast kolumny. Blok nagłówków kolumn pozostaje 3 wiersze (Activity, Task, Epic) — zgodnie z decyzją, że Epic jest poziomem grupowania jak Activity i Task.

---

## 6. Hierarchia kolumn i los Epica (rozstrzygnięto: Wariant B)

**Decyzja**: Epic grupuje tak samo jak Activity i Task — jest po prostu niżej w hierarchii. Hierarchia kolumn: **Activity → Task → Epic**, kolumna liściowa = **Epic** (bez zmian względem bieżącego modelu). Blok nagłówków = 3 wiersze (Activity, Task, Epic).

- Design Figma (2 wiersze: Activity, Task) to uproszczony mockup („roboczy wygląd”); w implementacji Epic pozostaje poziomem grupowania.
- **Wpływ na domenę**: minimalny — klucz komórki `activity::task::epic::release` bez zmian, `GridModel` / `buildGridModel` (`src/domain/board-model.ts`, `src/domain/types.ts`) bez zmian strukturalnych. Zmiana dotyczy głównie warstwy wizualnej (renderer + styles.css).
- Jeśli w trakcie specify okaże się, że potrzebne są większe zmiany — akceptowalne, wywołujemy pełny cykl specify.

---

## 7. Tokeny i ikony

### 7.1 Tokeny (wg `figma-agent-manual.md`)

Kod konsumuje **wyłącznie nazwy L2** (natywne `--*` Obsidian). L1 (`color/fiolet-light/*`, `color/wb-light/*`) **nie jest konsumowana bezpośrednio** — odcienie akcentu wyprowadza się przez `color-mix()` z `var(--interactive-accent)`.

| Element (Figma) | Token Figma | Warstwa | W kodzie (L2 / CSS var) |
|---|---|---|---|
| Karta Story — tło | `story-surface-bg` | L3 | `var(--background-secondary)` |
| Karta Story — ramka | `#e7e7e7` (hardkod w mocku) | — | `var(--background-modifier-border)` |
| Badge w karcie — tło | `badge-bg` | L3 | `var(--background-primary-alt)` |
| Kolumna Epic — tło | `color/wb-light/50` (#ededed) | **L1** | najbliższy L2 — `var(--background-primary-alt)` lub `var(--background-secondary)` (L1 niedozwolone); do dopracowania |
| Nagłówek Activity/Task/Epic — tło | `color/fiolet-light/50` / `/75` | **L1** | odcień akcentu: `color-mix(in oklch, var(--interactive-accent) X%, var(--background-primary))` |
| Nagłówek — tekst | `color/fiolet-light/500` | **L1** | `var(--interactive-accent)` |
| Nagłówek — ramka | `color/fiolet-light/300` | **L1** | odcień akcentu przez `color-mix()` |
| Badge w nagłówku — tło | `color/fiolet-light/100` | **L1** | odcień akcentu przez `color-mix()` |
| Divider releasu | `release-divider` | L3 | `var(--background-modifier-border)` |
| Tytuł releasu / tytuł karty | `text-and-icons/primary` | L3 | `var(--text-normal)` |
| Tekst wtórny (badge) | `text-and-icons/secondary` | L3 | `var(--text-muted)` |

**Decyzje tokenowe (rozstrzygnięte)**: preferowane są natywne standardy/tokeny Obsidian (L2); tam gdzie brak odpowiednika — konwencje zgodne z kontraktem tokenów (L2 + `color-mix()` z `var(--interactive-accent)`). Dokładne procenty odcieni i wybór L2 dla tła kolumny zostaną dopracowane później (poza krytyczną ścieżką MVP).

### 7.2 Ikony

Zasada: **ikony Obsidian**, a gdy brak semantycznie odpowiedniej — **propozycja z Lucide** (Obsidian bundle'uje zestaw oparty o Lucide, więc wiele ikon Lucide jest dostępnych pod nazwami kebab-case; dostępność zweryfikować pod zainstalowaną wersję).

| Funkcja (przyszła) | Ikona Obsidian | Fallback Lucide |
|---|---|---|
| Collapse/expand releasu | `chevron-down` / `chevron-right` | `ChevronDown` / `ChevronRight` |
| Uchwyt DnD karty Story | (do weryfikacji `grip-vertical`) | `GripVertical` |
| Uchwyt DnD nagłówka Task/Activity/Release | (do weryfikacji `grip-vertical` / `grip-horizontal`) | `GripVertical` / `GripHorizontal` |
| Dodawanie (Story/Epic/Task/Activity) | `plus` | `Plus` |
| Usuwanie | `trash` | `Trash2` |
| Nawigacja klawiaturą | — (strzałki, brak ikony) | — |

---

## 8. Przygotowanie pod przyszłe funkcje (tylko struktura DOM)

Każda przyszła funkcja ma zapewnione miejsce w DOM (sekcja 4), bez implementacji logiki:

1. **Collapse/expand releasu (chevron)**: `button.usm-release-toggle` w `.usm-release-header` + zawijająca treść `.usm-release-body`. Po zwinięciu: ukryta `.usm-release-body`, widoczny tylko nagłówek releasu. Stan zwinięcia = przyszły atrybut pliku board (poza zakresem).
2. **DnD pojedynczych Story (między Taskami i Release'ami)**: karta `.usm-story-card` z rezerwowym uchwytem; strefy upuszczania = kolumny Epic (`.usm-epic-column`) w sekcjach. Kolejność w komórce = pionowy stos kart (kolejność appearance; różne kolejności — użytkownika, po priorytecie, alfabetycznie — w kolejnych iteracjach).
3. **DnD kolumn Task (poziomo, za nagłówek Task)**: nagłówek `.usm-header-cell--task` = uchwyt grupy kolumn Epic tego Taska. Kolejność kolumn jest **globalna** (zdefiniowana w nagłówku, wspólna dla wszystkich sekcji) → przeniesienie kolumny zmienia jej pozycję we wszystkich releasach; wszystkie Story wędrują z kolumną. Działa w obrębie Activity i między Activity.
4. **DnD Activity (analogicznie)**: nagłówek `.usm-header-cell--activity` = uchwyt grupy kolumn.
5. **DnD Release (pionowo, za nagłówek Release)**: `.usm-release-header` = uchwyt całej sekcji; wszystkie kolumny wędrują z releasem.
6. **Dodawanie / usuwanie Story, Epic, Task, Activity**: rezerwowe przyciski (`plus` / `trash`) w nagłówkach i kolumnach.
7. **Nawigacja klawiaturą (strzałki, focus pion/poziom)**: karty i nagłówki fokusowalne; model roving-tabindex na siatce (kolumna Epic × wiersz Release).
8. **Analogiczne interakcje dla Epics**: kolumny Epic (`.usm-epic-column`) i nagłówki Epic (`.usm-header-cell--epic`) z rezerwowymi uchwytami/przyciskami — Epic jest poziomem grupowania jak Activity i Task.

---

## 9. Ryzyka i otwarte pytania

**Decyzje blokujące (rozstrzygnięte)**:

1. **Wariant A vs B** (sekcja 6): **Wariant B** — kolumna liściowa = Epic (Activity → Task → Epic), 3 wiersze nagłówków. Epic jest poziomem grupowania jak Activity i Task, po prostu niżej w hierarchii.
2. **Stała vs. content-based szerokość kolumn** (sekcja 5): stała (`--usm-col-w`), zgodna z Figma.
3. **Token tła kolumny** (sekcja 7.1): natywne tokeny Obsidian (L2); brak odpowiednika → konwencje zgodne z kontraktem (L2 + `color-mix()`). Dopracowanie później.
4. **Sticky-left nazwy releasu** (sekcja 5): opcjonalne; do dopracowania później.
5. **Badge w nagłówkach** (Figma „Badge 1”): badge jest wdrożony roboczo (przykładowa informacja); Figma odwzorowuje roboczy wygląd. Badge nie jest istotny w tej iteracji — zostaje bez zmian.
6. **Architektura siatki** (sekcja 5): **wiele siatek (sekcje)** — nagłówek kolumn + osobna siatka per Release; Release jako spójny element DOM (`section.usm-release`) pod przyszłe collapse/DnD/lazy render. Pojedyncza siatka odrzucona (Release bez spójnego elementu DOM).

**Dodatkowe rozstrzygnięcia**:
- **Kolejność Story w releasie**: bez zmian (kolejność appearance w pliku board). W kolejnych iteracjach: różne kolejności (użytkownika, po priorytecie, alfabetycznie itd.).
- **Zakres zmian domeny**: jeśli potrzebne większe zmiany — OK, wywołujemy pełny cykl specify. Przy wariancie B zmiana modelu domeny jest minimalna.
- **FR-y**: zostają jak do tej pory (FR-011 Unassigned, FR-014 sticky, FR-016 bezpieczeństwo, FR-019 klik karty). „Read-only" w tej iteracji = brak rozwijania dodawania/usuwania/modyfikacji w wizualnym podglądzie; skupienie na MVP wyświetlającym gotowe stories. Klik vs. drag mogą współistnieć (gotowe wzorce: Notion, Obsidian, Todoist, Miro).
- **Motywy**: plugin już obsługuje ciemny i jasny motyw — należy to utrzymać.

**Ryzyka**:

- **Zmiana modelu domeny**: przy wariancie B minimalna (klucz komórki `activity::task::epic::release` bez zmian); zmiana dotyczy głównie renderera i styles.css. Testy jednostkowe/integracyjne i fixture'y mogą wymagać drobnych aktualizacji (zmiana struktury DOM).
- **Wyrównanie kolumn**: przy stałej szerokości — niskie ryzyko; przy content-based — wysokie (stąd rekomendacja stałej).
- **Sticky + osobne siatki**: nagłówek i sekcje to osobne siatki; sticky top na bloku nagłówków jest standardowe, ale zgranie z paddingiem kontenera i z-index wymaga weryfikacji w przeglądarce (jak T017).
- **Dostępność ikon**: zestaw ikon Obsidian zależy od wersji; `grip-*` do weryfikacji.
- **Wydajność**: więcej osobnych siatek (po jednej na sekcję) vs. jedna duża siatka — potencjalnie więcej elementów DOM; do zmierzenia w testach wydajności (SC-001, baseline `tests/performance/baseline.json`).

---

## 10. Ocena prompta (co jest, czego brakuje, mocne/słabe strony)

### Mocne strony prompta

- **Jasny, mierzalny motyw** (mobile: nagłówek zajmuje za dużo miejsca) — łatwy do zweryfikowania po refaktorze.
- **Wskazanie źródła wizualnego (Figma + node) i kontraktu tokenów (manual)** — eliminuje domysły dotyczące wyglądu i kolorów.
- **Wymóg „przygotuj DOM pod przyszłe funkcje, ale nie implementuj”** — dojrzałe podejście; pozwala zaprojektować strukturę bez rozrostu zakresu.
- **Wyliczenie przyszłych funkcji** (collapse, DnD na 3 poziomach, CRUD, klawiatura) — daje konkretny checklist rezerw w DOM.
- **Zasada ikon (Obsidian → Lucide)** — czytelna i zgodna z duchem „reuse natywnego”.

### Czego brakuje / co pominięto

1. **Los Epica w nowej hierarchii** — największa luka. Prompt mówi „w poziomie: task (i jego rodzice)”, co sugeruje kolumnę liściową = Task, ale Epic jest atrybutem rdzeniowym (FR-005) i ma „analogiczne interakcje”. Brak jednoznacznej odpowiedzi: czy Epic to podgrupa w kolumnie, osobny poziom kolumn, czy znika? (sekcja 6).
2. **Znaczenie badge w nagłówkach Activity/Task** (Figma „Badge 1”) — nieokreślone (licznik? link? atrybut?).
3. **Kolejność Story w releasie** — prompt wspomina „kolejność w releasie” jako współrzędną pionową, ale nie mówi, skąd się bierze (appearance w pliku board vs. jawna, persystentna kolejność potrzebna pod przyszłe DnD).
4. **Zakres zmiany modelu domeny** — prompt traktuje to jako „refaktor frontendu”, ale zmiana kolumny liściowej (Epic→Task) dotyka `board-model.ts`/`types.ts` i testów. Warto to nazwać wprost.
5. **Kryteria akceptacji / miary sukcesu** — brak (np. „nagłówek zajmuje ≤ X px na mobile”, „kolumny wyrównane w nagłówku i sekcjach”, „brak regresji wydajności > 20%”).
6. **Zachowanie istniejących FR** — brak wprost, ale krytyczne: FR-014 (sticky headers przy scrollu 2D), FR-011 (Unassigned), FR-016 (bezpieczeństwo), FR-015 (read-only w MVP). Refaktor nie może ich złamać; „Unassigned” w nowej strukturze (sekcja/kolumna) wymaga doprecyzowania.
7. **Ciemny motyw** — manual podkreśla auto-przełączanie motywu; prompt nie wspomina, że nowy wygląd musi działać w obu motywach (kontrakt tokenów to gwarantuje, ale warto nazwać).
8. **Strategia migracji / kompatybilność** — brak: czy to „big bang” (nowy renderer) czy inkrementalnie; co z istniejącymi testami i baseline'em wydajności.
9. **Dostępność (a11y)** — poza „nawigacja klawiaturą” brak wprost: role ARIA, roving-tabindex, focus-visible, kontrast (kontrakt tokenów pomaga, ale struktura DnD/collapse wymaga oznaczeń).
10. **Zachowanie klikania karty (FR-019)** — w MVP klik otwiera notatkę; przyszłe DnD nie może konfliktować z kliknięciem (rozróżnienie drag vs. click). Prompt nie wspomina o tym konflikcie.

### Słabe strony prompta

- **Jednoznaczność hierarchii**: „task (i jego rodzice)” jest zbyt ogólne — nie rozstrzyga Epic (patrz wyżej).
- **Brak priorytetyzacji**: wszystkie przyszłe funkcje są wyliczone równorzędnie; brak wskazania, które rezerwy DOM są krytyczne, a które opcjonalne.
- **Brak miar**: „zajmuje dużo miejsca” jest subiektywne — brak celu (np. maksymalna wysokość nagłówka na mobile).
- **Ryzyko zakresu**: „przeorganizuj strukturę uwzględniając przyszłe funkcje” może zostać odczytane jako „zaimplementuj przyszłe funkcje” — prompt częściowo to ogranicza („nie implementujemy”), ale bez listy rezerw DOM granica jest rozmyta.

### Rekomendacja przed `/speckit-specify`

Decyzje blokujące zostały rozstrzygnięte (sekcja 9): architektura wiele siatek (sekcje), Wariant B (Epic jako poziom grupowania), badge bez zmian, kolejność bez zmian, tokeny natywne + dopracowanie później, FR-y bez zmian, motywy utrzymane. Pozostało: dodać kryteria akceptacji (wysokość nagłówka na mobile, wyrównanie kolumn, brak regresji FR-011/014/016/019) i nazwać zakres zmiany modelu domeny (minimalny przy wariancie B). Koncepcja jest gotowa do przełożenia na spec.
