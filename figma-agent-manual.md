# Figma → Code: Manual systemu tokenów

> Plik źródłowy w Figma: fileKey `J3R2VCQfxw6crtOqMm76yY`.
> Stan: wdrożone 2026-10-25.

Ten dokument opisuje: (1) architekturę systemu tokenów w Figma, (2) podjęte decyzje
i ich uzasadnienie, (3) instrukcję tłumaczenia tokenów z Figma na kod (CSS/JS),
(4) kontrakt kodu, (5) zasady utrzymania.

---

## 1. Architektura: 3 warstwy = 3 kolekcje Figma

System tokenów jest trójwarstwowy. Kierunek aliasów: **L3 → L2 → L1**.

| Warstwa | Kolekcja Figma | Rola | Zmienne | Tryb |
|---|---|---|---|---|
| **L1** (prymitywy) | `primitives` | Surowe palety i skale. Tylko cele aliasów — kod NIGDY ich nie konsumuje bezpośrednio. | 75 | `Mode 1` |
| **L2** (kontrakt) | `obsidian` | **Kontrakt dla kodu.** Nazwy = dokładne CSS custom properties Obsidian. Agent zatrzymuje się tutaj. | 55 | `Light` |
| **L3** (semantyka) | `semantic-colors` | Intencja projektowa (`story-surface-bg`, `Text/*`, `Border/*`, `Brand/*`, `State/*`). **Elementy UI wiążą się TYLKO z L3.** | 38 | `Light` |

Dodatkowo: kolekcja `typo` (46 zmiennych, tryb `Mode 1`) — system typografii,
zostawiona bez zmian (decyzja #2). Nie jest częścią łańcucha L3→L2→L1.

```
Element UI (w Figma)
   │  bind TYLKO do L3
   ▼
L3 semantic-colors  ──alias──▶  L2 obsidian  ──alias/wartość──▶  L1 primitives
   (intencja)                    (kontrakt kodu)                  (palety)
                                    │
                                    ▼  nazwa L2 = nazwa CSS var
                              styles.css: var(--text-normal)
```

**Złota zasada agenta:** rozwiązując łańcuch aliasów od elementu, **zatrzymaj się
na L2**. Nazwa zmiennej L2 (z `/` zamienionym na `-` i prefiksem `--`) jest
dokładną nazwą CSS custom property w `styles.css`. Nie schodź do L1.

---

## 2. Podjęte decyzje

| # | Decyzja | Uzasadnienie |
|---|---|---|
| 1 | **3 kolekcje** (nie 2 + dokument w repo) | Warstwa L2 jako osobna kolekcja Figma jest czytelna dla użytkownika Figma (panel Variables) i dla agenta (łańcuch aliasów = mapa Figma→CSS bez zewnętrznego dokumentu). |
| 2 | **Typografia zostaje** (kolekcja `typo`, 46 tokenów) | Design system nie jest jeszcze w pełni wdrożony; nieużywane ≠ niepotrzebne. Cel: dojrzały projekt oparty na tokenach. L2 zyskała warstwę typograficzną mapującą na natywne tokeny Obsidian (`--font-ui-*`, `--font-*`). |
| 3 | **Odcienie akcentu wyprowadzane z jednego akcentu** | `fiolet/75`, `fiolet/100`, `fiolet/300` nie mają natywnego odpowiednika w Obsidian. W Figma: L2 `accent/tint-*` aliasuje do palety fiolet (paleta tworzona na podstawie akcentu). W kodzie: odcienie powstają przez `color-mix()` / opacity z `var(--interactive-accent)`. |
| 4 | **Audyt = cały plik** | Wynik: 2 strony (Design + Palettes), 1725 węzłów, 18/159 lokalnych zmiennych używanych, 141 martwych, 223 zmienne z zewnętrznej biblioteki. Strona `Palettes` = swatche referencyjne, **nie** źródło kodu. |
| 5 | **Brak niezależnego dokumentu tokenów** | Strategia włączana do `/speckit-specify`; ten manual jest załącznikiem, nie osobnym artefaktem. |

### Decyzje dodatkowe (kontrakt tematyczny)

- **Figma modeluje TYLKO jasny motyw.** Obsidian obsługuje jasny i ciemny i
  **przełącza je automatycznie w trakcie dnia** (temat systemowy) — motyw może
  zmienić się w każdej chwili bez przeładowania.
- **L2 jest tematycznie agnostyczna z definicji:** CSS zmienne Obsidian
  rozwiązują się per motyw, więc ciemny motyw „dostaje się za darmo" na L2.
  Przyszłe tryby Figma (light/dark) zmieniłyby tylko wartości L1; L2/L3
  pozostałyby nietknięte.
- **Wartości L1 w Figma = referencja jasnego motywu.** Kod nigdy nie konsumuje
  wartości L1 bezpośrednio.
- **`Background/inverse`:** Obsidian **nie ma** zmiennej `--background-inverse`
  (zweryfikowane w `obsidian.asar`). L3 `Background/inverse` zmapowane na
  `text/normal` (#222222 — najciemniejszy neutral jasnego motywu).

---

## 3. Jak czytać system tokenów w Figma

1. **Panel Variables** (Figma → Variables): cztery kolekcje.
   - `primitives` — palety: `color/fiolet-light/*`, `color/wb-light/*`,
     `color/red-dark/*`, skale `sizes/space-scale/*`, `sizes/text-scale/*`,
     `text-weight/*`. Nie dotykaj.
   - `obsidian` — kontrakt kodu (55 tokenów). Nazwy z `/` tworzą grupy
     w panelu (`text/`, `background/`, `background-modifier/`, `interactive/`,
     `accent/`, `font-ui/`, `font/`, `radius/`, `size/`).
   - `semantic-colors` — intencja (38 tokenów). Grupy: `Text and icons/`,
     `Border/`, `Brand/`, `Background/`, `State/` + tokeny domenowe
     (`story-surface-bg`, `badge-bg`, `task-column-bg`, `release-divider`,
     `top-entity-bg-color`).
   - `typo` — typografia (46 tokenów). Nie dotykaj.
2. **Każdy token L2/L3 ma opis** (pole `description`) — to dokumentacja dla
   agenta: nazwa CSS var + krótki komentarz.
3. **Tryb `Light`** w kolekcjach `obsidian` i `semantic-colors` — jedyny tryb
   (patrz sekcja 5, tematowanie).
4. **Alias = wartość wskazująca na inną zmienną.** W panelu Variables alias
   pokazuje się jako odwołanie do nazwy docelowej.

---

## 4. Tłumaczenie tokenów Figma → kod

### 4.1 Algorytm (dla agenta generującego kod)

1. Weź element UI w Figma i odczytaj, do której **zmiennej L3** jest
   przypięty (fill/stroke/spacing/radius/font).
2. Rozwiąż łańcuch aliasów: L3 → (alias) → L2. **Zatrzymaj się na L2.**
3. Przekształć nazwę L2 na CSS custom property:
   - zamień `/` na `-`,
   - dodaj prefiks `--`.
4. W `styles.css` użyj `var(--nazwa)`. **Koniec.**

### 4.2 Reguła nazewnictwa (Figma → CSS)

| Figma (L2) | CSS custom property |
|---|---|
| `text/normal` | `--text-normal` |
| `background/primary-alt` | `--background-primary-alt` |
| `background-modifier/border` | `--background-modifier-border` |
| `interactive/accent-hover` | `--interactive-accent-hover` |
| `size/4-2` | `--size-4-2` |
| `radius/m` | `--radius-m` |
| `font-ui/small` | `--font-ui-small` |
| `font/semibold` | `--font-semibold` |

Nazwy L2 zostały dobrane **1:1** do natywnych CSS custom properties Obsidian
(wyodrębnionych z `obsidian.asar`), więc `var(--...)` w `styles.css` rozwiązuje
się automatycznie w obu motywach.

### 4.3 Przykłady

**Przykład 1 — tło karty historii:**
Element w Figma ma fill = `story-surface-bg` (L3).
Łańcuch: `story-surface-bg` → `background/secondary` (L2).
Kod: `background: var(--background-secondary);`

**Przykład 2 — akcentowy przycisk:**
Fill = `Brand/primary` (L3).
Łańcuch: `Brand/primary` → `interactive/accent` (L2).
Kod: `background: var(--interactive-accent);`

**Przykład 3 — odcień akcentu (tint):**
Fill = `Background/surface-brand-1` (L3).
Łańcuch: `surface-brand-1` → `accent/tint-75` (L2) → `color/fiolet-light/75` (L1, #f3e9fd).
Kod: **nie** używaj `var(--accent-tint-75)` — w Obsidianie taki token nie istnieje.
Odcień twórz z akcentu:
`background: color-mix(in oklch, var(--interactive-accent) 12%, var(--background-primary));`
(patrz 4.4).

**Przykład 4 — spacing/radius:**
Padding = `size/4-3` (L2, 12px) → `padding: var(--size-4-3);`
Corner = `radius/m` (L2, 8px) → `border-radius: var(--radius-m);`

### 4.4 Odcienie akcentu w kodzie (decyzja #3)

L2 `accent/tint-75|100|300` istnieją **tylko w Figma** (aliasy do palety fiolet,
która jest wyprowadzona z akcentu). W kodzie **nie ma** odpowiadających im
natywnych zmiennych Obsidian — odcienie powstają dynamicznie:

```css
/* jasny odcień akcentu na tle (odpowiednik accent/tint-100) */
background: color-mix(in oklch, var(--interactive-accent) 15%, var(--background-primary));
/* akcentowy hover (odpowiednik background-modifier/active-hover) */
background: color-mix(in oklch, var(--interactive-accent) 10%, transparent);
```

`color-mix()` z `var()` jest bezpieczne — rozwiązuje się w czasie renderowania,
per motyw.

---

## 5. Kontrakt kodu (obowiązkowy)

1. **`styles.css` używa WYŁĄCZNIE żywych odwołań `var(--...)`.**
2. **NIGDY nie cachuj rozwiązanych kolorów w JS** (zakaz
   `getComputedStyle` przy starcie i trzymania hex w pamięci) — motyw
   Obsidian zmienia się automatycznie w trakcie dnia bez przeładowania.
3. **NIGDY nie hardkoduj hex** w CSS ani JS (zakaz `#1a1a1a`, `#ffffff`,
   `rgba(...)` dla kolorów interfejsu).
4. **Kod konsumuje TYLKO nazwy L2** (czyli natywne `--*` Obsidian).
   L1 i L3 są po stronie Figma — agent schodzi do nich tylko po to,
   żeby rozwiązać łańcuch do L2.
5. **Elementy UI w Figma wiążą się TYLKO z L3** (zakaz bezpośredniego
   bindu do L1/L2 na elementach).
6. **Zewnętrzna biblioteka Figma = wyłącznie referencja wizualna**,
   nigdy źródło kodu. (Po wdrożeniu: L3 nie ma już żadnych odwołań
   do zewnętrznych zmiennych.)
7. **Radius ma własne tokeny** (`radius/s|m|l|xl` → `--radius-s|m|l|xl`);
   `ss-8` z L1 nie podwaja się jako radius.
8. **Każdy token L2/L3 ma opis** — przy dodawaniu nowego tokenu opis
   jest obowiązkowy.

---

## 6. Tematowanie (jasny/ciemny)

- Figma: **tylko `Light`**. Ciemny motyw nie jest lustrzany w Figma (może
  pojawić się w przyszłości jako dodatkowy tryb L1).
- Obsidian: **auto-przełączenie** jasny/ciemny w trakcie dnia (temat systemowy).
- Konsekwencja: kontrakt kodu (sekcja 5) jest jedyną gwarancją poprawności
  w ciemnym motywie — żywe `var(--...)` rozwiązują się per motyw.
- Przyszły tryb `Dark` w Figma zmieniłby **tylko wartości L1**;
  L2 i L3 (nazwy, aliasy, opisy) pozostałyby nietknięte.

---

## 7. Pełna referencja tokenów

### 7.1 L2 `obsidian` — 55 tokenów (wartości = jasny motyw Obsidian)

**text/**

| Token | Wartość (Light) | CSS var | Opis |
|---|---|---|---|
| `text/normal` | `#222222` | `--text-normal` | Podstawowy tekst (base-100). |
| `text/muted` | `#5c5c5c` | `--text-muted` | Tekst wtórny (base-70). |
| `text/faint` | `#ababab` | `--text-faint` | Tekst trzeciorzędny / disabled (base-50). |
| `text/accent` | alias → `fiolet/500` | `--text-accent` | Tekst w kolorze akcentu. |
| `text/error` | `#e93147` | `--text-error` | Kolor błędu (color-red). |
| `text/success` | `#08b94e` | `--text-success` | Kolor sukcesu (color-green). |
| `text/warning` | `#ec7500` | `--text-warning` | Kolor ostrzeżenia (color-orange). |
| `text/on-accent` | `#ffffff` | `--text-on-accent` | Tekst na tle akcentu. |

**background/**

| Token | Wartość (Light) | CSS var | Opis |
|---|---|---|---|
| `background/primary` | `#ffffff` | `--background-primary` | Główne tło (base-00). |
| `background/primary-alt` | `#fafafa` | `--background-primary-alt` | Tło alternatywne (base-10). |
| `background/secondary` | `#f6f6f6` | `--background-secondary` | Tło wtórne (base-20). |
| `background/secondary-alt` | `#fcfcfc` | `--background-secondary-alt` | Tło wtórne alternatywne (base-05). |

**background-modifier/**

| Token | Wartość (Light) | CSS var | Opis |
|---|---|---|---|
| `background-modifier/border` | `#e4e4e4` | `--background-modifier-border` | Domyślna ramka (base-30). |
| `background-modifier/border-hover` | `#dadada` | `--background-modifier-border-hover` | Ramka hover (base-35). |
| `background-modifier/hover` | `rgba(0,0,0,0.067)` | `--background-modifier-hover` | Subtelna nakładka hover. |
| `background-modifier/active-hover` | `rgba(159,123,199,0.10)` | `--background-modifier-active-hover` | Akcentowa powierzchnia (color-mix accent 10%). |
| `background-modifier/error` | `#e93147` | `--background-modifier-error` | Tło błędu. |
| `background-modifier/success` | `#08b94e` | `--background-modifier-success` | Tło sukcesu. |
| `background-modifier/warning` | `#ec7500` | `--background-modifier-warning` | Tło ostrzeżenia. |
| `background-modifier/box-shadow` | `rgba(0,0,0,0.10)` | `--background-modifier-box-shadow` | Cień. |
| `background-modifier/cover` | `rgba(220,220,220,0.40)` | `--background-modifier-cover` | Przykrycie. |
| `background-modifier/form-field` | `#ffffff` | `--background-modifier-form-field` | Tło pól formularza. |

**interactive/**

| Token | Wartość (Light) | CSS var | Opis |
|---|---|---|---|
| `interactive/accent` | alias → `fiolet/500` | `--interactive-accent` | Główny akcent. |
| `interactive/accent-hover` | alias → `fiolet/600` | `--interactive-accent-hover` | Akcent hover. |
| `interactive/hover` | `#fafafa` | `--interactive-hover` | Hover neutralny (base-10). |
| `interactive/normal` | `#ffffff` | `--interactive-normal` | Stan normalny (base-00). |

**accent/** (odcienie wyprowadzone z akcentu — patrz 4.4)

| Token | Wartość (Light) | Uwagi |
|---|---|---|
| `accent/tint-75` | alias → `fiolet/75` (#f3e9fd) | Najjaśniejszy odcień. |
| `accent/tint-100` | alias → `fiolet/100` (#edddff) | Odcień 100. |
| `accent/tint-300` | alias → `fiolet/300` (#d3aaff) | Odcień 300. |

**font-ui/** i **font/**

| Token | Wartość | CSS var | Opis |
|---|---|---|---|
| `font-ui/small` | `13` | `--font-ui-small` | 13px. |
| `font-ui/smaller` | `12` | `--font-ui-smaller` | 12px. |
| `font-ui/medium` | `15` | `--font-ui-medium` | 15px. |
| `font-ui/large` | `20` | `--font-ui-large` | 20px. |
| `font/small` | `0.933` | `--font-small` | 0.933em. |
| `font/smaller` | `0.875` | `--font-smaller` | 0.875em. |
| `font/smallest` | `0.8` | `--font-smallest` | 0.8em. |
| `font/normal` | `regular` | `--font-normal` | Waga 400. |
| `font/medium` | `medium` | `--font-medium` | Waga 500. |
| `font/semibold` | `semiBold` | `--font-semibold` | Waga 600. |
| `font/bold` | `bold` | `--font-bold` | Waga 700. |

**radius/**

| Token | Wartość | CSS var |
|---|---|---|
| `radius/s` | `4` | `--radius-s` |
| `radius/m` | `8` | `--radius-m` |
| `radius/l` | `12` | `--radius-l` |
| `radius/xl` | `24` | `--radius-xl` |

**size/** (spacing)

| Token | Wartość | CSS var |
|---|---|---|
| `size/2-1` | `2` | `--size-2-1` |
| `size/2-2` | `4` | `--size-2-2` |
| `size/2-3` | `6` | `--size-2-3` |
| `size/4-1` | `4` | `--size-4-1` |
| `size/4-2` | `8` | `--size-4-2` |
| `size/4-3` | `12` | `--size-4-3` |
| `size/4-4` | `16` | `--size-4-4` |
| `size/4-5` | `20` | `--size-4-5` |
| `size/4-6` | `24` | `--size-4-6` |
| `size/4-8` | `32` | `--size-4-8` |
| `size/4-9` | `36` | `--size-4-9` |

### 7.2 L3 `semantic-colors` → L2 (38 aliasów)

| L3 (elementy wiążą się tutaj) | → L2 |
|---|---|
| `Text and icons/primary` | `text/normal` |
| `Text and icons/secondary` | `text/muted` |
| `Text and icons/tertiary` | `text/faint` |
| `Text and icons/description` | `text/faint` |
| `Text and icons/disabled` | `text/faint` |
| `Text and icons/brand` | `text/accent` |
| `Text and icons/success` | `text/success` |
| `Text and icons/error` | `text/error` |
| `Text and icons/warning` | `text/warning` |
| `Text and icons/info` | `text/accent` |
| `Text and icons/inverse` | `text/on-accent` |
| `Border/default` | `background-modifier/border` |
| `Border/light` | `background-modifier/border` |
| `Border/hoover` | `background-modifier/border-hover` |
| `Border/strong` | `background-modifier/border-hover` |
| `Border/strong-hoover` | `background-modifier/border-hover` |
| `Brand/primary` | `interactive/accent` |
| `Brand/hoover` | `interactive/accent-hover` |
| `Brand/secondary` | `accent/tint-300` |
| `Brand/accent` | `accent/tint-100` |
| `Background/base` | `background/primary` |
| `Background/surface-1` | `background/primary-alt` |
| `Background/surface-2` | `background/secondary` |
| `Background/surface-3` | `background/secondary-alt` |
| `Background/surface-4` | `background/secondary` |
| `Background/surface-brand-1` | `accent/tint-75` |
| `Background/inverse` | `text/normal` |
| `Background/brand` | `interactive/accent` |
| `Background/disabled` | `background/secondary` |
| `State/error` | `background-modifier/error` |
| `State/success` | `background-modifier/success` |
| `State/warning` | `background-modifier/warning` |
| `State/info` | `accent/tint-300` |
| `top-entity-bg-color` | `accent/tint-100` |
| `story-surface-bg` | `background/secondary` |
| `task-column-bg` | `background/primary-alt` |
| `badge-bg` | `background/primary-alt` |
| `release-divider` | `background-modifier/border` |

---

## 8. Utrzymanie systemu

### 8.1 Dodanie nowego tokenu

1. Ustal warstwę: intencja → L3; nazwa CSS var → L2; surowa wartość → L1.
2. Utwórz zmienną w odpowiedniej kolekcji (nazwa z `/` dla grupowania).
3. Ustaw wartość lub alias (kierunek: L3→L2→L1, nigdy odwrotnie).
4. **Dodaj opis** (nazwa CSS var + komentarz) — obowiązkowe.
5. Jeśli token ma odpowiednik w kodzie: nazwa L2 musi być dokładną nazwą
   istniejącego CSS custom property Obsidian (albo nowego, zdefiniowanego
   w `styles.css` z żywym `var(--...)` wewnątrz).

### 8.2 Zmiana akcentu

Zmień wartości palety `color/fiolet-light/*` w L1 (albo aliasy L2
`interactive/accent*` i `accent/tint-*` na nową paletę). Cały łańcuch
L3→L2→L1 rozwiąże się automatycznie — L3 nie wymaga zmian.
W kodzie nic się nie zmienia (akcent płynie przez `var(--interactive-accent)`).

### 8.3 Przyszły ciemny motyw w Figma

Dodaj tryb `Dark` do kolekcji L1 i podaj wartości ciemnego motywu.
L2/L3 (nazwy, aliasy, opisy) pozostają nietknięte. Kod nie wymaga zmian.

### 8.4 Weryfikacja spójności

- W panelu Variables: każdy token L3 musi mieć alias do tokenu L2
  (zero odwołań do L1 i do zewnętrznych bibliotek).
- Każdy token L2 musi mieć wartość lub alias do L1 oraz opis.
- W kodzie: `grep -rE '#[0-9a-fA-F]{3,8}\b' src/ styles.css` nie może
  zwracać kolorów interfejsu; `getComputedStyle` nie może być używany
  do cache'owania kolorów.

---

## 9. Apendyks: notatki API Figma (dla agentów edytujących plik)

Potwierdzone w sesji wdrożeniowej:

- `figma.variables.createVariableCollection(name, modes)` — **argumenty
  pozycyjne** (obiekt `{name, modes}` odrzucany przez walidację).
- `figma.variables.createVariable(name, collectionId, resolvedType)` —
  pozycyjnie; `resolvedType` ∈ `COLOR` | `FLOAT` | `STRING`.
- `variable.setValueForMode(modeId, value)` — `value`: `number` (FLOAT),
  `{r,g,b,a}` 0–1 (COLOR), `{type:'VARIABLE_ALIAS', id:'VariableID:...'}`
  (alias).
- `variable.description = '...'` — nadawalne.
- `variable.valuesByMode` — read-only, mapa `modeId → wartość/alias`.
- `collection.renameMode(modeId, name)` — działa.
- Node ID (np. `26:1158`) ≠ Variable ID — do API dodaj prefiks
  `VariableID:`.
- Przed masowymi zmianami: utwórz inwentarz `id → nazwa → wartość/alias`
  (możliwy rollback).
