# CLI Contract: lint-color

Public contract after this feature. Changes from today are marked **(new)** / **(changed)**.

## Invocation

```sh
node lint-color/index.ts [target-root] [--format <human|json>]
```

- `target-root` — positional, optional; defaults to two directories up (legacy in-host layout). Unchanged.
- `--format` **(new)** — `human` (default) or `json`. Any other value is a run error: message on stderr naming accepted values, exit 2. Parsed with `node:util` `parseArgs` (`allowPositionals: true`); unknown flags error (parseArgs default) — also exit 2.

## Streams

| Mode | stdout | stderr |
|---|---|---|
| `human` | Report: summary table (violations present) or clean message; rule-grouped detail; suppression summary | Config errors, missing-dir notices, ERB parse warnings (as today) |
| `json` **(new)** | Exactly one JSON document per [run-record.schema.json](./run-record.schema.json); no ANSI, byte-deterministic | Same diagnostics mirrored (config errors, missing dirs, warnings) so CI logs stay readable |

JSON-mode guarantee: a consumer may `JSON.parse(stdout)` unconditionally on exit codes 0 and 1.
On exit 2 from pre-scan failures (config validation, no scannable dirs, bad `--format`),
stdout may be empty — the error is on stderr.

## Exit codes **(changed)**

| Code | Meaning | Today |
|---|---|---|
| 0 | Clean run — no violations, all configured dirs present | 0 (unchanged) |
| 1 | Violations found | 1 (unchanged) |
| 2 | Run error — malformed `sourceDirectories` config, configured dir missing, no scannable dirs, unrecognized `--format` | was 1 |

**Migration note (required by constitution quality gates)**: scripts testing `exit != 0`
keep working. Scripts testing `exit == 1` to mean "violations" are now correct where
they were previously ambiguous. The one observable change: a clean scan with a missing
configured source directory exited 1, now exits 2. Ships with a version bump.

## Human report shape **(changed: summary header added)**

```text
Color lint: 512 violations in 143 files

  496  No opacity modifiers on color classes. Add a semantic token instead
   12  No spectral colors
    4  No dark: variants

<existing rule-grouped detail listing, unchanged>

512 violations found.
  (3 lines suppressed with color-lint-ignore)
```

- Per-rule lines sorted by descending count; labels are `colors.json` rule descriptions (fallback: rule name).
- Clean run: existing `✓ No color lint violations found.` message, no summary table.
- Suppression summary line unchanged.

## Convenience script **(new)**

```json
"lint:demo:json": "node lint-color/index.ts fixtures/demo-app --format json"
```
