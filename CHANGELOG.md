# Changelog

## 0.1.0 — 2026-07-08

### Added

- `--format json` — the lint-color CLI emits one deterministic JSON run record
  (summary, violations, ignores, warnings, missing source dirs) on stdout;
  diagnostics stay on stderr. `--format human` (the default) is unchanged.
- Human report now opens with a summary: total violations, affected-file count,
  and per-rule counts in descending order.

### Changed — exit-code contract (breaking)

Exit codes now distinguish run outcome grep-style:

| Code | Meaning |
|---|---|
| 0 | Clean run — no violations, all configured dirs present |
| 1 | Violations found |
| 2 | Run error — malformed `sourceDirectories` config, configured dir missing, no scannable dirs, unrecognized `--format` |

**Migration**: scripts testing `exit != 0` keep working. Scripts testing
`exit == 1` to mean "violations" are now correct where they were previously
ambiguous. The one observable change: a clean scan with a missing configured
source directory exited 1, now exits 2.
