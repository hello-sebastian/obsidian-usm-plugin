<!--
Sync Impact Report (temporary scratch — REMOVE before committing this file)
============================================================================
Version change: 1.2.1 → 1.3.0
Bump rationale: MINOR. Two new normative rules added to Principle III
  (materially expanded guidance): (1) language policy — SpecKit docs,
  code comments, and AI agent reasoning in English; user-facing IDE
  responses may use user's language. (2) Code readability — human-readable
  source with explanations, comments, logical division, semantic naming.

Modified principles (titles unchanged, content expanded):
  - III. Cykl życia, czyszczenie zasobów i jakość kodu
    (added: Język dokumentacji i kodu + Czytelność kodu źródłowego)

Added sections:
  - None

Removed sections:
  - None

Deferred TODOs:
  - None. All placeholders resolved.
-->

# Obsidian User Story Map Plugin Constitution

Konstytucja dotyczy rozwoju, utrzymania i ewolucji wtyczki **Obsidian User Story Map**, dystrybuowanej jako wtyczka społecznościowa (Community Plugin) poprzez GitHub Releases oraz oficjalny katalog Obsidian. Dokument określa nadrzędne, niezmienne zasady architektoniczne, jakościowe i bezpieczeństwa.

## Core Principles

### I. Zgodność z ekosystemem Obsidian i architekturą widoku

- Wtyczka musi ściśle przestrzegać oficjalnych wytycznych Obsidian API oraz zasad publikacji w katalogu Community Plugins.
- Projekt zakłada bezobsługową instalację i aktualizację poprzez natywny mechanizm Obsidian oparty na wykazie wydań (GitHub Releases), semantycznym wersjonowaniu (SemVer) oraz plikach `manifest.json` i `versions.json`.
- Wtyczka musi wspierać wieloplatformowość (Desktop oraz Mobile). Zabronione jest bezpośrednie odwoływanie się do modułów Node.js / Electron (np. `fs`, `path`), chyba że wtyczka zostanie jawnie oznaczona jako `"isDesktopOnly": true` w `manifest.json`.
- Wszystkie operacje na systemie plików i strukturze notatek muszą odbywać się wyłącznie poprzez oficjalną abstrakcję Vault API (`this.app.vault` / `this.app.vault.adapter`).
- **Dwutrybowość widoku (View Architecture):** Wtyczka musi dostarczać bezszwowy mechanizm przełączania się między widokiem surowego pliku Markdown (plikiem źródłowym tablicy zawierającym odnośniki do notatek) a dedykowanym wizualnym widokiem mapy, gwarantując pełną integralność danych i brak ryzyka uszkodzenia pliku źródłowego.
- Interfejs musi wykorzystywać natywne komponenty Obsidian API (`Modal`, `Notice`, `SettingTab`, `ItemView`, `Menu`) oraz zmienne stylów CSS (Obsidian CSS Variables), zapewniając płynną adaptację do motywów jasnych i ciemnych.

### II. Bezpieczeństwo, prywatność i ochrona danych użytkownika

- **Lokalność i prywatność:** Treść krypty (Vault) oraz metadane notatek są traktowane jako ściśle poufne. Wtyczka działa w 100% lokalnie. Zabronione jest wysyłanie telemetrii, statystyk czy zawartości notatek do zewnętrznych serwerów.
- **Zakaz dynamicznego wykonywania kodu:** Niedozwolone jest stosowanie `eval()`, `Function()`, czy pobieranie i uruchamianie zewnętrznego kodu JavaScript w czasie działania wtyczki. Cały kod wykonywalny musi znajdować się w skompilowanym pliku `main.js`.
- **Bezpieczny podgląd i sanityzacja (XSS Prevention):** Wszelkie treści wyciągane z notatek i renderowane w interfejsie DOM muszą podlegać rygorystycznej sanityzacji, aby uniemożliwić wykonanie niebezpiecznego kodu HTML/JS.
- **Nieniszczące operacje na plikach:** Zmiany wprowadzane w plikach notatek muszą być wykonywane defensywnie (np. poprzez `vault.process()`), zapobiegając utracie danych przy ewentualnych konfliktach zapisu.

### III. Cykl życia, czyszczenie zasobów i jakość kodu

- **Ścisłe zarządzanie cyklem życia (`onload` / `onunload`):** Wyłączenie wtyczki musi całkowicie czyścić środowisko. Wszystkie zdarzenia (`registerEvent`), interwały (`registerInterval`), nasłuchiwacze DOM (`registerDomEvent`) oraz komendy muszą być rejestrowane przez metody pomocnicze API Obsidianu.
- **TypeScript i typowanie:** Cały kod aplikacyjny tworzony jest w TypeScript z włączonym trybem ścisłym (`strict: true`). Należy bezwzględnie unikać stosowania typu `any`. Modele metadanych oraz stany wizualizacji muszą posiadać jednoznaczne definicje typów.
- **Pakowanie i optymalizacja:** Kod źródłowy jest budowany do jednego pliku produkcyjnego `main.js` (z wykorzystaniem `esbuild`), zapewniając minimalny rozmiar oraz natychmiastowy start wtyczki.
- **Język dokumentacji i kodu (Language Policy):** Dokumentacja SpecKit, komentarze w kodzie źródłowym oraz proces myślenia agentów AI (chain-of-thought) MUSI być prowadzona w języku angielskim — w celu przyspieszenia działania agentów oraz zapewnienia czytelności dokumentacji dla międzynarodowej społeczności. Odpowiedzi agenta AI dla użytkownika w IDE mogą być w języku używanym przez użytkownika.
- **Czytelność kodu źródłowego (Code Readability):** Kod źródłowy MUSI być czytelny i wygodny do zrozumienia dla człowieka. Wymagane jest: dodawanie objaśnień i komentarzy wyjaśniających intencję (nie tylko syntaksis), dzielenie kodu na logiczne, spójne części (moduły/funkcje), oraz semantyczne nazywanie zmiennych, funkcji i typów.

### IV. UX/UI, ergonomia i obsługa danych niekompletnych

- **Look & Feel aplikacji Obsidian:** Interfejs wizualny mapy musi sprawiać wrażenie natywnego elementu programu. Komponenty korzystają ze zmiennych kolorystycznych Obsidianu (`var(--text-normal)`, `var(--background-primary)` itp.).
- **Defensywne grupowanie (Unassigned & Fallback Bucketing):** Gdy notatka nie posiada określonych atrybutów hierarchii kolumnowej lub wierszowej, wtyczka nie może przerywać renderowania ani zgłaszać błędu. Brakujące metadane są traktowane jako puste wartości i automatycznie grupowane w dedykowanych sekcjach zastępczych (np. „Unassigned" / „Brak kategorii").
- **Swoboda nawigacji w 2D:** Interfejs mapy musi umożliwiać płynne przewijanie zarówno w poziomie (dla rozbudowanych struktur kolumnowych), jak i w pionie (dla wielu wierszy/podziałów), zachowując czytelność na różnych rozmiarach ekranów.
- **Zasada nienarzucania się:** Komunikaty błędów lub ostrzeżenia o niepoprawnej strukturze notatek powinny być wyświetlane w sposób nienachalny, unikając nadmiernego używania powiadomień `Notice`.
- **Dostępność i dobre praktyki UX/UI:** Interfejs musi respektować powszechne dobre praktyki dostępności (wystarczający kontrast, nawigacja klawiaturą, czytelność) oraz w pełni respektować ustawienia skórek i motywów stylistycznych Obsidianu, nie narzucając sztywnych wartości kolorystycznych tam, gdzie Obsidian udostępnia zmienne stylów.

### V. Wydajność, reaktywność i obsługa dużych krypt

- **Wykorzystanie `metadataCache`:** Niedozwolone jest synchroniczne odczytywanie plików z dysku w celu zbudowania struktury mapy. Pobieranie linków oraz atrybutów z frontmattera musi odbywać się wyłącznie za pośrednictwem szybkiej pamięci podręcznej Obsidianu (`app.metadataCache`).
- **Reaktywność na zdarzenia (Event-Driven Architecture):** Mapa musi automatycznie aktualizować swój stan w odpowiedzi na zmiany w plikach źródłowych lub plikach połączonych, nasłuchując zdarzeń `metadataCache` oraz `vault`. Zmiany muszą być filtrowane i ograniczane częstotliwościowo (z użyciem `debounce`/`throttle`).
- **Wydajność układu siatki (Layout Performance):** Renderowanie dwuwymiarowej mapy musi opierać się na natywnych mechanizmach układu przeglądarki (CSS Grid, Flexbox, `overflow: auto`), minimalizując ręczne obliczenia geometrii w JavaScript.

### VI. Portowalność danych i samoopisująca się konfiguracja

- **Samoopisujący się plik tablicy:** Ogólne ustawienia tablicy (w tym kolejność wierszy, sortowanie, interpretacja relacji między historiami) MUSI być przechowywane jako atrybuty w nagłówku (frontmatter) pliku tablicy. Plik tablicy przechowuje ustawienia poziomu tablicy; atrybuty poziomu poszczególnych historii (np. priorytet, status) są przechowywane w nagłówkach samych notatek historii. Plik tablicy nie jest magazynem wszystkich danych (nie jest plikiem CSV) — jest samoopisującym się wskaźnikiem struktury i ogólnych ustawień mapy.
- **Portowalność i przenośność:** Plik tablicy MUSI być w pełni przenośny — konfiguracja przetrwa synchronizację, kopiowanie i przenoszenie między kryptami (vaults) oraz między urządzeniami, niezależnie od tego, czy wtyczka jest zainstalowana, odinstalowana, czy zaktualniona.
- **Czytelność bez wtyczki:** Plik tablicy MUSI pozostać czytelnym i interpretowalnym przez użytkownika lub agenta AI, który nie ma dostępu do wtyczki, a jedynie do czystych notatek Markdown. Odbiorca musi móc rozpoznać kolejność historii i wydań, sposób interpretacji treści oraz relacje między nimi wyłącznie na podstawie zawartości pliku.
- **Odtwarzalność po reinstalacji:** Ponowna instalacja wtyczki MUSI odtworzyć widok mapy identycznie jak przed odinstalowaniem — żadne dane, konfiguracja ani struktura nie mogą zostać zgubione w cyklu instalacja → odinstalacja → reinstalacja.

## Dodatkowe wymagania i ograniczenia

- **Minimalizacja zależności:** Projekt unika przeładowania pliku `package.json`. Zewnętrzne biblioteki NPM są dodawane tylko wtedy, gdy ich funkcjonalność nie może być łatwo zaimplementowana natywnie lub za pomocą Obsidian API.
- **Zgodność licencyjna zależności:** Każda zewnętrzna zależność musi posiadać licencję otwartoźródłową zgodną z licencją projektu określoną w pliku `LICENSE`. Zabronione jest włączanie zależności o licencjach konfliktowych bez jawnego uzasadnienia i akceptacji.
- **Jakość dokumentacji:** Repozytorium musi zawierać plik `README.md` ze zrzutami ekranu i instrukcją obsługi, a także plik `CHANGELOG.md` rejestrujący zmiany w kolejnych wersjach.
- **Przyjazność dla społeczności:** Projekt jest otwarty na zgłoszenia błędów (Issues) i propozycje zmian (Pull Requests).

## Workflow rozwojowy i jakość

- **Weryfikacja lokalna:** Przed utworzeniem wydania wtyczka musi zostać przetestowana na czystej instancji Obsidian w środowisku Desktop oraz Mobile.
- **Proces wydań:** Każde wydanie produkcyjne generuje tag w Git (zgodny z SemVer), a automatyczny lub ręczny pipeline dołącza do wydania w GitHub Releases pliki: `manifest.json`, `main.js` oraz `styles.css`.
- **Trwałość ID:** Identyfikator wtyczki (`id` w `manifest.json`) raz ustalony nie może zostać zmieniony.

## Governance

- Niniejsza konstytucja stanowi nadrzędny dokument architektoniczny projektu.
- Zmiany konstytucji wymagają uzasadnienia wynikającego ze zmian w Obsidian API, wymogów bezpieczeństwa lub istotnych potrzeb użytkowników.
- Przegląd zgodności z konstytucją jest obowiązkowym punktem przy akceptacji PR oraz przed wypuszczeniem każdej wersji produkcyjnej.

**Version**: 1.3.0 | **Ratified**: 2026-10-14 | **Last Amended**: 2026-10-15
