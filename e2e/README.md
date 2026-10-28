# E2E Test Environment

An isolated, reproducible environment for exercising the User Story Map plugin
in a real Obsidian instance and verifying it automatically over the Chrome
DevTools Protocol (CDP). It is part of feature
[`002-e2e-test-env`](../specs/002-e2e-test-env/spec.md) (consolidated with
`003-manual-test-workflow`).

Everything here is **Node built-ins only** (Node 22+) — no extra NPM
dependencies. The CDP transport is a minimal client in [`cdp.mjs`](./cdp.mjs).

## Prerequisites

- **macOS** with the **Obsidian desktop** app installed (launch uses `open -a`).
- **Node.js 22+** — the verification script uses the global `WebSocket`.
- A clean checkout of the repository.
- **No private vault is touched.** Every command targets the committed
  `test-vault/` fixture vault explicitly (SC-002-002).

## The three commands

| Command | What it does |
|---------|--------------|
| `npm run e2e:setup` | Builds the plugin and installs `main.js`, `manifest.json`, and `styles.css` into `test-vault/.obsidian/plugins/obsidian-usm-plugin/`, verifying each file's SHA-256. |
| `npm run e2e:launch` | Opens Obsidian on the test vault with a CDP remote-debugging port. Idempotent — re-running while an instance is up exits 0 without spawning a duplicate. |
| `npm run e2e:verify` | Connects over CDP, opens the board in map view, runs the standard checks, and emits a machine-readable JSON report. |

### Options

All three accept `--port <number>` (default `9222`):

```bash
npm run e2e:launch -- --port 9333   # launch on an alternate port
npm run e2e:verify -- --port 9333   # verify against that instance
```

`--port` must be an integer in `1–65535`.

### Typical flow

```bash
npm install
npm run e2e:setup     # one-time (or after a plugin change)
npm run e2e:launch    # opens a debuggable instance on the test vault
npm run e2e:verify    # runs the checks, writes the report
```

## Ad-hoc inspection (`e2e/inspect.mjs`)

`e2e/inspect.mjs` is a deterministic CLI for inspecting and driving the running
instance (Node 22+ built-ins only, reuses [`cdp.mjs`](./cdp.mjs)). It is the
canonical way to perform ad-hoc checks and interactions.

```bash
node e2e/inspect.mjs <operation> [args] [--port <number>]
# or: npm run e2e:inspect -- <operation> [args] [--port <number>]
```

| Operation | What it does | Output |
|-----------|--------------|--------|
| `eval <expression>` | Evaluates JS in the page context | the value as one-line JSON on stdout |
| `wait <css-selector> [--timeout <ms>]` | Polls until the selector matches (default `15000` ms, `200` ms poll) | `ok: <selector> found` |
| `screenshot <path>` | Captures a PNG (parent directories created) | the written path |

`--port` is accepted by every operation (default `9222`, integer `1–65535`).
Exit codes: `0` = success, `1` = operation failed (wait timeout, page
evaluation exception), `2` = environment error before the operation ran (no CDP
instance on the port, invalid arguments). Every environment error includes the
hint `(run npm run e2e:launch)`.

The full workflow — environment preparation, standard checks, ad-hoc
inspection, the manual-assist protocol, mobile emulation, and on-demand
preview — is documented in the
[`usm-e2e` skill](../.github/skills/usm-e2e/SKILL.md). The runnable end-to-end
scenarios are in
[`specs/002-e2e-test-env/quickstart.md`](../specs/002-e2e-test-env/quickstart.md).

## CDP endpoints

Once `e2e:launch` succeeds, the instance serves (FR-002-009):

- `http://127.0.0.1:<port>/json/version` — browser/version info (readiness probe).
- `http://127.0.0.1:<port>/json` — list of page targets, each with a
  `webSocketDebuggerUrl` used by the verification script and by an agent's
  ad-hoc CDP inspection (FR-002-017).

## Output

Generated artifacts are written to `e2e/output/` (gitignored — never committed):

- `e2e/output/report.json` — the machine-readable verification report
  (schema in
  [`contracts/verification-report.md`](../specs/002-e2e-test-env/contracts/verification-report.md)).
- `e2e/output/board.png` — a screenshot of the map view for human confirmation.

The report's `status` (`"pass"` / `"fail"`) and `checks[]` are sufficient to
determine the outcome without opening the screenshot.

## Exit codes

- `e2e:launch` — `0` = ready or already available; non-zero = build
  missing/outdated, port conflict, or launch/readiness failure.
- `e2e:verify` — `0` = `status: "pass"`; `1` = one or more checks failed;
  `2` = environment error before checks ran (CDP unreachable, build
  missing/outdated).

## Full validation

See the runnable end-to-end scenarios in
[`specs/002-e2e-test-env/quickstart.md`](../specs/002-e2e-test-env/quickstart.md)
(launch + idempotency, standard verification, agent ad-hoc inspection, and the
build-missing guard).
