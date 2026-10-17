# User Story Map for Obsidian

Renders a board note as a **2D visual user story map**: columns grouped by
**Activity → Task → Epic**, rows by **Release**. The map is a read-only,
auto-updating projection of your Markdown — the source file is never
modified, and with the plugin disabled it remains a plain, readable list of
links.

## Screenshots

| Map view | Debug mode |
|----------|------------|
| ![User story map view](docs/screenshots/map-view.png) | ![Debug metrics panel](docs/screenshots/debug-panel.png) |

> Screenshots are captured from a real Obsidian instance (Desktop). Replace
> the files in `docs/screenshots/` with your own captures before release.

## Features

- **2D grid** — hierarchical column headers (Activity → Task → Epic) and one
  row per Release, laid out with CSS Grid (no manual geometry).
- **Sticky headers** — column headers stay pinned while scrolling down, row
  headers while scrolling right; the corner cell pins to both.
- **Read-only by design** — the map is a navigation surface. Click a card (or
  a wikilink header) to open the linked note in the standard view. All
  editing happens in the editor.
- **Live updates** — edit a story's frontmatter or add a wikilink to the
  board and the map re-renders automatically (debounced), no reload needed.
- **Incomplete-data resilience** — a story missing any attribute (or with no
  frontmatter at all) is grouped into a dedicated **Unassigned** section at
  that level. Broken links render as dimmed placeholder cards. Nothing
  crashes, nothing is written.
- **PL/EN field synonyms** — `activity`/`aktywność`, `task`/`zadanie`,
  `epic`/`epik`, `release`/`wydanie`/`row` are all recognized
  (case-insensitive).
- **XSS-safe** — every note-derived string is inserted as a text node; note
  content can never execute as markup.
- **100% local** — no network calls, no telemetry, no data leaves the vault.
- **Mobile-friendly** — responsive column sizing keeps the map usable on
  phones and tablets.

## Installation

### From the community plugin list

1. In Obsidian: **Settings → Community plugins** (turn off Restricted mode if
   prompted).
2. Select **Browse** and search for **User Story Map**.
3. Select **Install**, then **Enable**.

### Manual

1. Build the plugin (see [Development](#development)) or download the release
   assets.
2. Copy `main.js`, `manifest.json`, and `styles.css` into
   `<Vault>/.obsidian/plugins/obsidian-usm-plugin/`.
3. In Obsidian: **Settings → Community plugins** → enable **User Story Map**.

## Usage

### 1. Create a board note

A board is any note whose frontmatter contains `usm-board: true`. The body is
an ordered list of wikilinks — one story per line:

```markdown
---
usm-board: true
usm-release-order: appearance
---

- [[S1]]
- [[S2]]
- [[S1]]
- [[Missing story]]
```

| Frontmatter attribute | Type | Default | Description |
|-----------------------|------|---------|-------------|
| `usm-board` | boolean | — | Required. Only `true` activates the map view. |
| `usm-release-order` | string | `appearance` | `appearance` (order of first appearance) or `alphabetical` (case-insensitive sort). Unknown values fall back to `appearance`. |

Rules:

- **Order matters** — the wikilink sequence defines the column grouping order
  (Activity → Task → Epic) and the default Release row order.
- **Duplicates are allowed** — each occurrence renders a separate card.
- **Broken links** (target note does not exist) render a dimmed placeholder
  card; the map never crashes.
- Non-wikilink lines (headers, text, comments) are ignored.

### 2. Add attributes to story notes

Each story note's frontmatter positions it on the map:

```markdown
---
activity: Onboarding
task: First run
epic: "[[Onboarding flow]]"
release: "1.0 MVP"
story: Create first board
---

As a user I want to create my first board so that I can map my user journey.
```

| Attribute | Accepted names (case-insensitive) | Role |
|-----------|-----------------------------------|------|
| Activity | `activity`, `aktywność` | Top-level column group |
| Task | `task`, `zadanie` | Second-level column group |
| Epic | `epic`, `epik` | Third-level column group |
| Release | `release`, `wydanie`, `row` | Row; also the card footer badge |
| Story | `story` | Explicit card title (first in the cascade) |
| Title | `title` | Card title fallback (second in the cascade) |

- **Value matching is case-insensitive** — `Login` and `login` group
  together.
- **Wikilink values** (e.g. `epic: "[[Onboarding flow]]"`) render as
  clickable headers that open the linked note.
- **Missing attributes** place the story in the **Unassigned** section at that
  level — no error, no crash.
- The note **body is not rendered** on the map in the MVP; the card shows the
  title and the Release badge only.

### Card title cascade

The card title is resolved in this order (first non-empty value wins):

1. `story` frontmatter attribute
2. `title` frontmatter attribute
3. First alias of the note
4. File name (without extension)

### 3. Open the map

Open the board note — it renders in the visual map view automatically. Toggle
to the raw Markdown with the pane header icon or the **Open as Markdown**
command, and back with **Open as User Story Map**. The file content is never
modified by the toggle.

## Commands

| Command | Description |
|---------|-------------|
| **Open as User Story Map** | Render the current board note as the map. |
| **Open as Markdown** | Show the board note as raw Markdown. |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Debug mode** | off | Shows a metrics overlay on the map view: FPS, rendered story count, and last render duration (ms). |

## Development

```bash
npm install        # install dependencies
npm run dev        # compile in watch mode (src/main.ts → main.js)
npm run build      # type-check + production build
npm run lint       # ESLint (eslint-plugin-obsidianmd)
npm test           # full suite: unit + integration + performance
npm run test:unit       # core logic (parser, attributes, model, sanitize)
npm run test:integration  # full pipeline against the fixtures
npm run test:perf       # render performance on a defined board size
```

The automated suite runs in Node.js (no Obsidian instance required) against
the versioned fixtures in `tests/fixtures/`.

## Privacy

The plugin operates 100% locally. It makes no network requests, collects no
telemetry, and never sends vault content or note metadata anywhere.

## License

[0-BSD](LICENSE)
