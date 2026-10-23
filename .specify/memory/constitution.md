# Obsidian User Story Map Plugin Constitution

This constitution governs the development, maintenance, and evolution of the **Obsidian User Story Map** plugin, distributed as an Obsidian Community Plugin via GitHub Releases and the official Obsidian catalog. The document defines the supreme, immutable architectural, quality, and security principles.

## Core Principles

### I. Compliance with the Obsidian ecosystem and view architecture

- The plugin MUST strictly adhere to the official Obsidian API guidelines and the Community Plugins catalog publishing rules.
- The project assumes maintenance-free installation and updates through Obsidian's native mechanism based on the release listing (GitHub Releases), semantic versioning (SemVer), and the `manifest.json` and `versions.json` files, with a clear, maintained changelog.
- The plugin MUST support multiplatform operation (Desktop and Mobile). Direct references to Node.js / Electron modules (e.g., `fs`, `path`) are forbidden, unless the plugin is explicitly marked as `"isDesktopOnly": true` in `manifest.json`.
- All file-system and note-structure operations MUST be performed exclusively through the official Vault API abstraction (`this.app.vault` / `this.app.vault.adapter`).
- **Dual-mode view (View Architecture):** The plugin MUST provide a seamless mechanism for switching between the raw Markdown file view (the board source file containing links to notes) and the dedicated visual map view, guaranteeing full data integrity and no risk of corrupting the source file.
- The board MUST behave predictably in both the visual board mode and the plain-text Markdown editing mode, and MUST NOT negatively affect other plugins or application features.
- Board configuration MUST NOT break or override existing Obsidian patterns.
- The interface MUST use native Obsidian API components (`Modal`, `Notice`, `SettingTab`, `ItemView`, `Menu`) and CSS style variables (Obsidian CSS Variables), ensuring smooth adaptation to light and dark themes.
- Wherever possible, the plugin MUST reuse Obsidian's built-in solutions, standards, visual styles, behaviors, libraries, and APIs rather than reimplementing them.

### II. Security, privacy, and fault tolerance

- **Locality and privacy:** The vault content and note metadata are treated as strictly confidential. The plugin operates 100% locally. Sending telemetry, statistics, or note content to external servers is forbidden.
- **Untrusted data and sanitization (XSS Prevention):** Vault files — including board files and story notes — are treated as untrusted data. All content extracted from notes and rendered in the DOM interface MUST undergo rigorous sanitization and validation to prevent the execution of dangerous HTML/JS code (XSS, HTML filtering, direct script injection, and dangerous attributes).
- **Prohibition of dynamic code execution:** The use of `eval()`, `Function()`, or fetching and running external JavaScript code during the plugin's operation is not allowed. All executable code MUST reside in the compiled `main.js` file.
- **No sensitive data leakage:** Configuration data and internal state MUST NOT contain sensitive information that is exposed in the UI, logs, or error messages.
- **Fault tolerance:** The plugin MUST be resilient to missing, inconsistent, or unusual files and data, as well as to misconfigurations.
- **Defensive data operations:** All data operations MUST be defensive — checking types, ranges, and attribute presence, with sensible default values and "graceful degradation" variants that do not block the operation of the whole plugin.
- **Non-destructive file operations:** Changes made to note files MUST be performed defensively (e.g., via `vault.process()`), preventing data loss in the event of write conflicts.
- **Diagnostic logging:** Errors SHOULD be logged in a way that aids diagnosis, without exposing private data.
- **Popout Windows compatibility (Multi-window DOM context):** When creating DOM elements dynamically, code MUST use the target container's document context (`containerEl.ownerDocument`) instead of the global `document` object, ensuring full compatibility with detached Obsidian windows.

### III. Lifecycle, resource cleanup, and code quality

- **Strict lifecycle management (`onload` / `onunload`):** Disabling the plugin MUST completely clean up the environment. All events (`registerEvent`), intervals (`registerInterval`), DOM listeners (`registerDomEvent`), and commands MUST be registered through the Obsidian API helper methods.
- **TypeScript and typing:** All application code is written in TypeScript with strict mode enabled (`strict: true`). The use of the `any` type MUST be avoided at all costs. Metadata models and visualization states MUST have unambiguous type definitions.
- **Bundling and optimization:** The source code is built into a single production `main.js` file (using `esbuild`), ensuring minimal size and instant plugin startup.
- **Modular, readable code:** Frontend code MUST be modular, readable, and consistently formatted, built on the technologies recommended for Obsidian plugins (TypeScript + the Obsidian API).
- **Language policy for documentation and code (Language Policy):** SpecKit documentation, source code comments, and the reasoning process of AI agents (chain-of-thought) MUST be conducted in English — in order to speed up agent operation and ensure the readability of documentation for the international community. The AI agent's responses to the user in the IDE MAY be in the language used by the user.
- **Source code readability (Code Readability):** The source code MUST be readable and easy for a human to understand. Required: adding explanations and comments that clarify intent (not just syntax), dividing the code into logical, coherent parts (modules/functions), and semantic naming of variables, functions, and types.
- **Documentation on functional changes:** Functional changes MUST be accompanied by updates to the documentation, configuration examples, and — where applicable — screenshots.
- **Configuration as a public contract:** The documentation, the board configuration, and the configuration of individual stories are treated as a public contract. Changes that break compatibility MUST be clearly marked in the versioning and documentation, together with a description of the migration path.
- **Test-Driven Development (Red-Green-Refactor, test-first):** All business logic and data transformations (Markdown file parsing, metadata extraction, cascading card title processing, 2D matrix construction, and Unassigned zone handling) MUST be developed using TDD. Writing production code for domain logic without a previously written, failing unit test (Red state) is forbidden. *Grandfathering (v1.6.2):* the foundational data pipeline (sanitization, story-attribute reading, board parsing, grid model) implemented on 2026-10-16 — before this rule was ratified in v1.5.0 — is a documented one-time exception; its regression tests were added afterwards to establish the baseline. All subsequent domain logic MUST follow TDD.
- **Domain isolation from the Obsidian API (Testability by Design):** The code architecture MUST clearly separate pure business logic from the Obsidian API. Map structure computation modules MUST NOT be directly coupled to application interface objects. Access to `metadataCache` and `vault` MUST go through an abstraction layer or interfaces that are easy to mock in the test runtime (e.g., Vitest).

### IV. UX/UI, accessibility, and data visualization

- **Obsidian application Look & Feel:** The visual interface of the map MUST feel like a native element of the application, with consistent typography, spacing, colors, and components, and full respect for light and dark themes. Components use Obsidian's color variables (`var(--text-normal)`, `var(--background-primary)`, etc.).
- **Concise, hierarchical presentation:** Information MUST be presented concisely and hierarchically. Key data (e.g., story title, release, status) is the most exposed; details are available on demand (hover, click, expansion).
- **Data-driven visual choices:** The choice of UI elements, colors, and scale MUST support the comprehension of the data and information, not only aesthetics (e.g., consistent use of color to distinguish different object types such as story, activity, task, epic).
- **Defensive grouping (Unassigned & Fallback Bucketing):** When a note lacks the defined column or row hierarchy attributes, the plugin MUST NOT interrupt rendering or report an error. Missing metadata is treated as empty values and automatically grouped into dedicated placeholder sections (e.g., "Unassigned" / "No category").
- **Freedom of 2D navigation:** The map interface MUST enable smooth scrolling both horizontally (for elaborate column structures) and vertically (for many rows/divisions), maintaining readability across different screen sizes.
- **Responsiveness:** The board and its elements MUST be responsive and readable across different tile and screen sizes, from a phone to a large monitor.
- **Non-intrusiveness principle:** Error messages or warnings about invalid note structure SHOULD be displayed in a non-intrusive way, avoiding excessive use of `Notice` notifications.
- **Accessibility and UX/UI best practices:** The interface MUST respect common accessibility best practices (sufficient contrast, keyboard navigation, readability) and fully respect Obsidian's theme and style settings, not imposing hard color values where Obsidian provides style variables.

### V. Performance, simplicity, and observability

- **Use of `metadataCache`:** Synchronously reading files from disk in order to build the map structure is not allowed. Fetching links and frontmatter attributes MUST be done exclusively through Obsidian's fast in-memory cache (`app.metadataCache`).
- **Event-driven reactivity (Event-Driven Architecture):** The map MUST automatically update its state in response to changes in source files or linked files, listening to `metadataCache` and `vault` events. Changes MUST be filtered and rate-limited (using `debounce`/`throttle`).
- **Grid layout performance (Layout Performance):** Rendering the two-dimensional map MUST rely on native browser layout mechanisms (CSS Grid, Flexbox, `overflow: auto`), minimizing manual geometry calculations in JavaScript.
- **Efficient data processing:** Data processing MUST be efficient — minimize the number of refreshes, avoid unnecessary re-renders, and do not block the main thread with heavy computation.
- **Simplicity over "magic":** Universal, simple, and understandable solutions are preferred over "magic". Every additional complexity MUST bring clear value to the user.
- **Transparent problem handling and observability:** The board SHOULD react in a transparent way to typical problems (missing data, misconfiguration) and provide signals that ease debugging (logs, in-UI messages, and a "troubleshooting" section in the documentation).
- **Reversible optimizations:** Any caching, aggregation, or data-optimization mechanism MUST be clearly implemented and easy to disable or redesign in the future.

### VI. Data portability and self-describing configuration

- **Self-describing board file:** General board settings (including row order, sorting, and the interpretation of relationships between stories) MUST be stored as attributes in the board file's header (frontmatter). The board file stores board-level settings; individual story-level attributes (e.g., priority, status) are stored in the headers of the story notes themselves. The board file is not a repository of all data (it is not a CSV file) — it is a self-describing indicator of the structure and general settings of the map.
- **Portability and transferability:** The board file MUST be fully portable — the configuration survives synchronization, copying, and transfer between vaults and between devices, regardless of whether the plugin is installed, uninstalled, or updated.
- **Readability without the plugin:** The board file MUST remain readable and interpretable by a user or an AI agent that has no access to the plugin, only to plain Markdown notes. The reader MUST be able to recognize the order of stories and releases, the way the content is interpreted, and the relationships between them based solely on the file's content.
- **Reproducibility after reinstallation:** Reinstalling the plugin MUST reproduce the map view identically to before uninstallation — no data, configuration, or structure may be lost in the install → uninstall → reinstall cycle.
- **Three-tier state architecture:** Plugin state MUST be strictly categorized into three levels: (1) Global configuration stored in `data.json`, (2) Board structure and domain configuration stored in the board note's frontmatter, and (3) Ephemeral UI state (e.g., scroll position, active panel zoom) held purely in-memory within the view instance.`

### VII. Pragmatic Architecture & Anti-Over-Engineering (AI Guardrails)

- **Pure Functions over Class Hierarchies:** Domain logic MUST be implemented using simple, exported pure functions rather than complex class hierarchies, factories, or dependency injection frameworks.
- **Strict 3-Layer Directory Structure:** Code MUST strictly adhere to three directory boundaries:
  1. `src/domain/` — Pure TypeScript data transformations and matrix calculations (Zero Obsidian imports allowed).
  2. `src/obsidian/` — Adapters connecting Obsidian events (`metadataCache`, `vault`) to domain functions.
  3. `src/ui/` — Native DOM rendering and CSS class application.
- **No Inline JS Styling:** Direct manipulation of `element.style` in JS is forbidden. All styling MUST use CSS classes defined in `styles.css` relying on Obsidian CSS variables. *Clarification (v1.6.1):* setting CSS custom properties (e.g., `--usm-col`, `--usm-row`, `--usm-grid-cols`) to encode **structural geometry** (grid item positions, spans, track counts) is permitted, provided that all **visual styling** (colors, fonts, spacing, borders, backgrounds, shadows) is defined exclusively in `styles.css` using Obsidian CSS variables. The prohibition targets direct assignment of visual style properties (e.g., `el.style.color = 'red'`) and the use of inline `style` attributes for presentation.
- **Popout Window Compatibility:** Dynamic DOM element creation MUST use the container's document context (`containerEl.ownerDocument`) instead of the global `document` object.
- **Three-Tier State Allocation:**
  1. Global plugin options -> `data.json`
  2. Board structure & configuration -> Board note frontmatter
  3. Ephemeral UI state (e.g., scroll position, zoom) -> In-memory view instance

## Additional requirements and constraints

- **Minimization of dependencies:** The project avoids overloading the `package.json` file. External NPM libraries are added only when their functionality cannot be easily implemented natively or with the Obsidian API.
- **Careful dependency selection:** External libraries are chosen deliberately — prefer light, well-maintained, widely used packages; avoid excessive dependencies and "vendor lock-in". Every new NPM dependency MUST be justified and MUST NOT duplicate functionality available natively in Obsidian or already present in the existing code.
- **License compatibility of dependencies:** Every external dependency MUST have an open-source license compatible with the project license defined in the `LICENSE` file. Including dependencies with conflicting licenses is forbidden without explicit justification and acceptance.
- **Documentation quality:** The repository MUST contain a `README.md` file with screenshots and usage instructions, as well as a `CHANGELOG.md` file recording changes across versions.
- **Open-source workflow:** The project maintains a consistent open-source workflow: a transparent `README`, a maintained changelog, a GitHub wiki, clear rules for reporting issues and contributing, and respect for users and co-creators.
- **Community friendliness:** The project is open to bug reports (Issues) and change proposals (Pull Requests).
- **Experimental features:** Experimental or "advanced" features MUST be clearly marked and, by default, MUST NOT complicate the basic user experience.

## Development workflow and quality

- **Local verification:** Before creating a release, the plugin MUST be tested on a clean Obsidian instance in both the Desktop and Mobile environments.
- **Release process:** Every production release generates a Git tag (compliant with SemVer), and an automated or manual pipeline attaches the following files to the GitHub Release: `manifest.json`, `main.js`, and `styles.css`.
- **ID persistence:** The plugin identifier (`id` in `manifest.json`) MUST NOT be changed once established.
- **Use-case and impact requirement:** Every new feature or significant change to an existing one MUST be supported by a description of the use case and of its impact on UX, performance, and compatibility with existing configurations.
- **Test requirements in the release pipeline:** Every Pull Request that modifies business logic MUST include corresponding unit or integration tests. All tests MUST pass automatically before release artifacts (`main.js`) are built.

## Task Breakdown & Execution Rules (Logical Atomicity Protocol)

- **Logical task granularity (Functional Cohesion):**
  - **Single Behavioral Increment:** Every task in `tasks.md` MUST represent a single, coherent behavioral change or architectural step (e.g., "create the parser module with tests", "configure the project structure", "add commands to the palette").
  - **Self-Contained & Compilable:** After completing a single task, the project code MUST compile and be in a verifiable state. It is forbidden to split tasks in a way that leaves the project in an unbuildable state (e.g., a separate task for an interface and a separate task for its usage).
  - **No Feature Bundling:** If a task covers separate components of business logic, user interface, and internationalization (i18n), it MUST be split into coherent functional steps.
- **Immediate Checkpointing & Progress Tracking:**
  - **Sequential Execution:** The agent executes tasks sequentially, step by step.
  - **Immediate Task Checkoff:** Immediately after successfully completing and verifying a task, the agent MUST edit `tasks.md` and change the task status from `` `[ ]` `` to `` `[x]` ``. Batch checkoff of tasks at the end of a session is forbidden.
  - **Sequencing Gate (v1.6.3):** The agent MUST NOT begin task N+1 until task N is marked `[x]` in `tasks.md`. The checkoff and the task's code changes MUST land in the same commit, so the git history is an auditable per-task trail. After any session interruption or context compaction, the agent MUST re-read `tasks.md` and check off completed-but-unmarked tasks before starting new work.

## Governance

- This constitution is the supreme architectural document of the project.
- **Amendment procedure:** Changes to the constitution require justification arising from changes in the Obsidian API, security requirements, or significant user needs. Amendments are proposed, reviewed, and recorded with a version bump and a changelog entry.
- **Versioning policy:** The constitution version follows semantic versioning (MAJOR.MINOR.PATCH). MAJOR: backward-incompatible removal or redefinition of a principle. MINOR: a new principle/section added or materially expanded guidance. PATCH: clarifications, wording, or typo fixes.
- **Compliance review:** A constitution compliance review is a mandatory checkpoint when accepting a PR and before releasing any production version.

**Version**: 1.6.3 | **Ratified**: 2026-10-14 | **Last Amended**: 2026-10-23
