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
  - III. Lifecycle, resource cleanup, and code quality
    (added: Language policy for documentation and code + Source code readability)

Added sections:
  - None

Removed sections:
  - None

Deferred TODOs:
  - None. All placeholders resolved.
-->

# Obsidian User Story Map Plugin Constitution

This constitution governs the development, maintenance, and evolution of the **Obsidian User Story Map** plugin, distributed as a Community Plugin via GitHub Releases and the official Obsidian catalog. The document defines the supreme, immutable architectural, quality, and security principles.

## Core Principles

### I. Compliance with the Obsidian ecosystem and view architecture

- The plugin MUST strictly adhere to the official Obsidian API guidelines and the Community Plugins catalog publishing rules.
- The project assumes maintenance-free installation and updates through Obsidian's native mechanism based on the release listing (GitHub Releases), semantic versioning (SemVer), and the `manifest.json` and `versions.json` files.
- The plugin MUST support multiplatform operation (Desktop and Mobile). Direct references to Node.js / Electron modules (e.g., `fs`, `path`) are forbidden, unless the plugin is explicitly marked as `"isDesktopOnly": true` in `manifest.json`.
- All file-system and note-structure operations MUST be performed exclusively through the official Vault API abstraction (`this.app.vault` / `this.app.vault.adapter`).
- **Dual-mode view (View Architecture):** The plugin MUST provide a seamless mechanism for switching between the raw Markdown file view (the board source file containing links to notes) and the dedicated visual map view, guaranteeing full data integrity and no risk of corrupting the source file.
- The interface MUST use native Obsidian API components (`Modal`, `Notice`, `SettingTab`, `ItemView`, `Menu`) and CSS style variables (Obsidian CSS Variables), ensuring smooth adaptation to light and dark themes.

### II. Security, privacy, and user data protection

- **Locality and privacy:** The vault content and note metadata are treated as strictly confidential. The plugin operates 100% locally. Sending telemetry, statistics, or note content to external servers is forbidden.
- **Prohibition of dynamic code execution:** The use of `eval()`, `Function()`, or fetching and running external JavaScript code during the plugin's operation is not allowed. All executable code MUST reside in the compiled `main.js` file.
- **Safe preview and sanitization (XSS Prevention):** All content extracted from notes and rendered in the DOM interface MUST undergo rigorous sanitization to prevent the execution of dangerous HTML/JS code.
- **Non-destructive file operations:** Changes made to note files MUST be performed defensively (e.g., via `vault.process()`), preventing data loss in the event of write conflicts.

### III. Lifecycle, resource cleanup, and code quality

- **Strict lifecycle management (`onload` / `onunload`):** Disabling the plugin MUST completely clean up the environment. All events (`registerEvent`), intervals (`registerInterval`), DOM listeners (`registerDomEvent`), and commands MUST be registered through the Obsidian API helper methods.
- **TypeScript and typing:** All application code is written in TypeScript with strict mode enabled (`strict: true`). The use of the `any` type MUST be avoided at all costs. Metadata models and visualization states MUST have unambiguous type definitions.
- **Bundling and optimization:** The source code is built into a single production `main.js` file (using `esbuild`), ensuring minimal size and instant plugin startup.
- **Language policy for documentation and code (Language Policy):** SpecKit documentation, source code comments, and the reasoning process of AI agents (chain-of-thought) MUST be conducted in English — in order to speed up agent operation and ensure the readability of documentation for the international community. The AI agent's responses to the user in the IDE MAY be in the language used by the user.
- **Source code readability (Code Readability):** The source code MUST be readable and easy for a human to understand. Required: adding explanations and comments that clarify intent (not just syntax), dividing the code into logical, coherent parts (modules/functions), and semantic naming of variables, functions, and types.

### IV. UX/UI, ergonomics, and handling of incomplete data

- **Obsidian application Look & Feel:** The visual interface of the map MUST feel like a native element of the application. Components use Obsidian's color variables (`var(--text-normal)`, `var(--background-primary)`, etc.).
- **Defensive grouping (Unassigned & Fallback Bucketing):** When a note lacks the defined column or row hierarchy attributes, the plugin MUST NOT interrupt rendering or report an error. Missing metadata is treated as empty values and automatically grouped into dedicated placeholder sections (e.g., "Unassigned" / "No category").
- **Freedom of 2D navigation:** The map interface MUST enable smooth scrolling both horizontally (for elaborate column structures) and vertically (for many rows/divisions), maintaining readability across different screen sizes.
- **Non-intrusiveness principle:** Error messages or warnings about invalid note structure SHOULD be displayed in a non-intrusive way, avoiding excessive use of `Notice` notifications.
- **Accessibility and UX/UI best practices:** The interface MUST respect common accessibility best practices (sufficient contrast, keyboard navigation, readability) and fully respect Obsidian's theme and style settings, not imposing hard color values where Obsidian provides style variables.

### V. Performance, reactivity, and handling of large vaults

- **Use of `metadataCache`:** Synchronously reading files from disk in order to build the map structure is not allowed. Fetching links and frontmatter attributes MUST be done exclusively through Obsidian's fast in-memory cache (`app.metadataCache`).
- **Event-driven reactivity (Event-Driven Architecture):** The map MUST automatically update its state in response to changes in source files or linked files, listening to `metadataCache` and `vault` events. Changes MUST be filtered and rate-limited (using `debounce`/`throttle`).
- **Grid layout performance (Layout Performance):** Rendering the two-dimensional map MUST rely on native browser layout mechanisms (CSS Grid, Flexbox, `overflow: auto`), minimizing manual geometry calculations in JavaScript.

### VI. Data portability and self-describing configuration

- **Self-describing board file:** General board settings (including row order, sorting, and the interpretation of relationships between stories) MUST be stored as attributes in the board file's header (frontmatter). The board file stores board-level settings; individual story-level attributes (e.g., priority, status) are stored in the headers of the story notes themselves. The board file is not a repository of all data (it is not a CSV file) — it is a self-describing indicator of the structure and general settings of the map.
- **Portability and transferability:** The board file MUST be fully portable — the configuration survives synchronization, copying, and transfer between vaults and between devices, regardless of whether the plugin is installed, uninstalled, or updated.
- **Readability without the plugin:** The board file MUST remain readable and interpretable by a user or an AI agent that has no access to the plugin, only to plain Markdown notes. The reader MUST be able to recognize the order of stories and releases, the way the content is interpreted, and the relationships between them based solely on the file's content.
- **Reproducibility after reinstallation:** Reinstalling the plugin MUST reproduce the map view identically to before uninstallation — no data, configuration, or structure may be lost in the install → uninstall → reinstall cycle.

## Additional requirements and constraints

- **Minimization of dependencies:** The project avoids overloading the `package.json` file. External NPM libraries are added only when their functionality cannot be easily implemented natively or with the Obsidian API.
- **License compatibility of dependencies:** Every external dependency MUST have an open-source license compatible with the project license defined in the `LICENSE` file. Including dependencies with conflicting licenses is forbidden without explicit justification and acceptance.
- **Documentation quality:** The repository MUST contain a `README.md` file with screenshots and usage instructions, as well as a `CHANGELOG.md` file recording changes across versions.
- **Community friendliness:** The project is open to bug reports (Issues) and change proposals (Pull Requests).

## Development workflow and quality

- **Local verification:** Before creating a release, the plugin MUST be tested on a clean Obsidian instance in both the Desktop and Mobile environments.
- **Release process:** Every production release generates a Git tag (compliant with SemVer), and an automated or manual pipeline attaches the following files to the GitHub Release: `manifest.json`, `main.js`, and `styles.css`.
- **ID persistence:** The plugin identifier (`id` in `manifest.json`) MUST NOT be changed once established.

## Governance

- This constitution is the supreme architectural document of the project.
- Changes to the constitution require justification arising from changes in the Obsidian API, security requirements, or significant user needs.
- A constitution compliance review is a mandatory checkpoint when accepting a PR and before releasing any production version.

**Version**: 1.3.0 | **Ratified**: 2026-10-14 | **Last Amended**: 2026-10-15
