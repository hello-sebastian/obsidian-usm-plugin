# Contract: Launch Command CLI

**Feature**: `002-e2e-test-env` | **Date**: 2026-10-27

The launch command is a Node ESM script (`e2e/launch.mjs`) exposed as the npm script `e2e:launch`. It opens Obsidian on the test vault with a CDP remote-debugging port.

## Invocation

```bash
npm run e2e:launch                 # default port 9222
npm run e2e:launch -- --port 9333  # alternate port (FR-008)
```

Direct invocation: `node e2e/launch.mjs [--port <number>]`.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--port` | number | `9222` | CDP remote-debugging port. Must be a free TCP port on `127.0.0.1`. |

## Behavior

1. **Pre-flight (build check)**: verify `test-vault/.obsidian/plugins/obsidian-usm-plugin/main.js` exists and its `manifest.json` version equals the repository `manifest.json` version. On failure, print an actionable error (`run npm run e2e:setup`) and exit non-zero (FR-015, SC-008).
2. **Idempotency probe**: `fetch http://127.0.0.1:<port>/json/version` with a short timeout.
   - If it responds **and** `GET /json` lists at least one page target → print `Instance already available on port <port>` and exit `0` without launching (FR-007, SC-007).
   - If it responds but **no page target exists** (the app is alive in the background with no window) → open the test vault window (`open -a Obsidian <absolute test-vault path>`), then poll `GET /json` for a page target (bounded, 30 s). On success, exit `0`; on timeout, exit non-zero with an actionable error. This keeps the command idempotent (no duplicate process) while guaranteeing a visible, connectable window (T016).
3. **Launch**: `open -a Obsidian --args --remote-debugging-port=<port> <absolute test-vault path>`.
4. **Readiness wait**: poll `/json/version` until it responds (bounded wait, e.g. 30 s) or report failure.
5. **Port-conflict detection**: if the port is bound but does not serve a CDP endpoint after launch, print an actionable error suggesting `--port <alternate>` and exit non-zero (spec edge case).

## Output

- Human-readable lines on stdout (status, port, vault path).
- Exit codes: `0` = ready or already available; non-zero = build missing/outdated, port conflict, or launch/readiness failure.
- The command MUST target the test vault explicitly and MUST NOT attach to or modify any other (private) vault instance (spec edge case).

## CDP endpoint exposed (FR-009)

On success, the instance serves:
- `http://127.0.0.1:<port>/json/version` — browser/version info (readiness probe).
- `http://127.0.0.1:<port>/json` — list of page targets, each with a `webSocketDebuggerUrl` used by the verification script and the agent's browser tool.
