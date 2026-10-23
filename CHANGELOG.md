# Changelog

All notable changes to the **User Story Map** plugin are documented in this
file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Constitution v1.6.3 (PATCH)** — added the *Sequencing Gate* to the
  Logical Atomicity Protocol (*Immediate Checkpointing & Progress Tracking*):
  the agent MUST NOT begin task N+1 until task N is marked `[x]` in
  `tasks.md`; the checkoff and the task's code changes land in the same
  commit; after any interruption or context compaction the agent re-reads
  `tasks.md` and checks off completed-but-unmarked tasks first. Enforced via
  the project-local `usm.task-protocol` SpecKit extension
  (`.specify/extensions.yml` + `.github/skills/usm-task-protocol/`), which
  survives `speckit update`.
- **Constitution v1.6.2 (PATCH)** — recorded the one-time TDD grandfathering
  for the foundational data pipeline (implemented 2026-10-16, before the TDD
  rule was ratified in v1.5.0); its regression tests establish the baseline.
  All subsequent domain logic MUST follow TDD.
- **Constitution v1.6.1 (PATCH)** — clarified the "No Inline JS Styling" rule
  (Principle VII): setting CSS custom properties to encode structural
  geometry (grid positions, spans, track counts) is permitted; the
  prohibition targets direct assignment of visual style properties. All
  visual styling remains exclusively in `styles.css` with Obsidian CSS
  variables.
- **Source layout aligned with Constitution Principle VII** — `src/`
  restructured into the strict 3-layer directory structure: `src/domain/`
  (pure data transformations, zero Obsidian imports), `src/obsidian/`
  (adapters connecting Obsidian events to domain functions), and `src/ui/`
  (native DOM rendering and CSS class application). No behavioral change.

### Fixed

- **Plugin failed to load on enable** — the settings tab extended the base
  `SettingTab` instead of `PluginSettingTab`, so Obsidian's `addSettingTab()`
  crashed with `TypeError: Cannot read properties of undefined (reading
  'refreshSearch')` when the plugin was enabled. The tab now extends
  `PluginSettingTab` and calls `super(app, plugin)`.

## [0.1.0] - 2026-10-17

### Added

- **Board view** — a note with `usm-board: true` in its frontmatter opens in
  a dedicated 2D visual map view instead of the raw Markdown editor.
- **2D grid layout** — columns grouped by Activity → Task → Epic (first
  appearance order), one row per Release, rendered with CSS Grid.
- **Sticky headers** — column headers stay pinned while scrolling vertically,
  row headers while scrolling horizontally; the corner cell pins to both axes.
- **Story cards** — clamped title (resolved via the `story` → `title` → alias
  → file name cascade), Release badge in the footer, click / Enter / Space
  opens the linked note in the standard view.
- **Wikilink attribute headers** — an attribute value that is a wikilink
  renders as a clickable, keyboard-accessible header that opens the linked
  note.
- **Unassigned sections** — stories missing any attribute (or with no
  frontmatter at all) are grouped into a visually distinct "Unassigned"
  section at that level; broken links render as dimmed placeholder cards.
  Nothing crashes and no intrusive notifications are shown.
- **PL/EN field synonyms** — `activity`/`aktywność`, `task`/`zadanie`,
  `epic`/`epik`, `release`/`wydanie`/`row` are recognized
  (case-insensitive); value matching is case-insensitive.
- **Live updates** — the map re-renders automatically (debounced) when the
  board file or any linked story file changes; no reload required.
- **Read-only guarantee** — the map is a projection of the Markdown source;
  the plugin never writes to board or story files, and the map / Markdown
  toggle never modifies the file.
- **Commands** — "Open as User Story Map" and "Open as Markdown".
- **Debug mode** — a plugin setting that shows a metrics overlay on the map
  view (FPS, rendered story count, last render duration in ms).
- **XSS hardening** — every note-derived string is inserted as a text node or
  escaped; note content can never execute as markup.
- **Mobile-friendly sizing** — responsive column widths keep the map usable on
  small screens.
- **Automated test suite** — unit, integration, and performance tests running
  in Node.js against versioned fixtures (no Obsidian instance required).

[0.1.0]: https://github.com/obsidian-usm-plugin/releases/tag/0.1.0
