# Research: Structured Lint Output

No NEEDS CLARIFICATION markers remained after the requirements grilling session.
This file records the resolved decisions and the codebase findings that shape the design.

## D1 — Machine format: single JSON document

- **Decision**: One JSON object on stdout: `summary` + `violations[]` + `ignores[]` + `warnings[]` + `missingSourceDirs[]`.
- **Rationale**: Batch tool, no streaming need; atomic doc is trivially `jq`-able and snapshot-testable; run-level summary rides along.
- **Alternatives considered**: JSONL (streams, but loses run-level summary without a trailer convention; overkill for batch); SARIF (GitHub-native but verbose and hostile to hand-reading — can be layered on later as an adapter over the run record).

## D2 — Format selection: `--format json` flag via `node:util` parseArgs

- **Decision**: `node lint-color/index.ts [target-root] --format json`; default `human`. Parse with stdlib `parseArgs` (`allowPositionals: true` keeps the existing positional target-root working).
- **Rationale**: Extensible when a second format lands (vs. dead-end `--json` boolean); visible in shell history (vs. env var); no magic (vs. TTY autodetect, which would break the user's existing `> file.txt` piping habit that expects human text). Node 26 ships `parseArgs` stable — zero new deps.
- **Alternatives considered**: `--json` boolean, `LINT_FORMAT` env var, TTY-based autodetection — all rejected above.

## D3 — Rule identity: kebab-case name string only

- **Decision**: `"rule": "no-opacity-modifier"` in each violation. Numeric `ruleId` stays internal.
- **Rationale**: Names are stable across reorders and match `colors.json` config keys — a consumer can cross-reference config directly. Exposing the numeric id invites depending on plumbing. Matches constitution III ("rule name (kebab-case)").
- **Finding**: index.ts already imports all 10 rule modules, each exporting `{ id, name }` (`lint-color/index.ts:300-304`) — the id→name map needed to translate accumulated `ruleId`s falls out of the existing `ruleModules` array.
- **Alternatives considered**: name+id both (invites id dependence); id only (meaningless, brittle).

## D4 — Violation payload: file/line/rule/message, nothing more

- **Decision**: No `token`, no column/span fields.
- **Rationale**: Ships structure around existing data with zero rule-module churn; offending token is consistently greppable from the `token — prose` message convention. Enrichment is additive later if an auto-fixer materializes. Columns are editor-grade data no selected consumer needs.
- **Alternatives considered**: `token` field now (touch all 10 rules, speculative); full spans (rules don't track columns; LSP not a consumer).

## D5 — Doc scope: full run record

- **Decision**: summary counts, ignores list, ERB parse warnings, missing source dirs all in the doc. Diagnostics additionally mirror to stderr in JSON mode.
- **Rationale**: One doc = complete run truth; an agent never scrapes stderr. Humans watching CI logs still see warnings.
- **Alternatives considered**: violations+summary only / bare array — both push run-health data back into stderr text scraping.

## D6 — Exit codes: 0/1/2 grep-style

- **Decision**: 0 clean, 1 violations, 2 run error (invalid `sourceDirectories` config, missing configured dir, unknown `--format` value).
- **Rationale**: grep/eslint convention; automation routes gate-fail vs infra-fail on code alone. Behavior change: missing-dir-but-clean moves 1→2 (`lint-color/index.ts:296` today). Public contract per constitution → version bump + migration note.
- **Alternatives considered**: keep 0/1 (conflates failure kinds); "always emit JSON even on exit-2" (stronger contract, more wiring on early-exit paths — declined for now; config-validation failure exits before a run record exists).

## D7 — Ordering: canonical sort file → line → rule

- **Decision**: `renderJson` sorts violations by (file, line, rule name); ties impossible beyond rule (one rule fires once per token per line at most — and if duplicates ever occur, message is a final tiebreak for full determinism).
- **Rationale**: Identical tree ⇒ byte-identical doc ⇒ run-over-run diffable. Accumulation order today interleaves css→tsx→erb passes — diff noise.
- **Alternatives considered**: accumulation order (pass-order noise); rule-grouped object (derivable client-side, harder to jq flat).

## D8 — Warnings out of the linter as return values

- **Decision**: `lintErbSource` returns `warnings: string[]` in `LintResult` (empty for other lint methods); `console.warn` at `lint-color/linter.ts:243` removed. index.ts accumulates warnings into the RunResult; the reporter layer decides destination.
- **Rationale**: Pure linter, no console side effects; JSON doc gets warnings (D5); unit tests can finally assert warning behavior. Callback injection rejected — a return value suffices where the linter already returns structured results.
- **Impact**: `LintResult` consumers — index.ts `accumulate()` and linter unit tests — updated; `warnings` optional or defaulted-empty keeps churn minimal.

## D9 — Reporting extracted to `report.ts`

- **Decision**: index.ts builds one `RunResult`; `report.ts` exports pure `renderHuman(run, ansi)` and `renderJson(run)` returning strings. index.ts prints and exits.
- **Rationale**: Two formats + summary table outgrow inline printing (`index.ts:281-323` today); pure functions unit-test without spawning the CLI; matches repo one-module-one-job style. Two-file `reporters/` split deferred until a third format (SARIF) exists — YAGNI.

## D10 — ANSI codes must never reach the JSON doc

- **Finding**: Rules embed ansi styling *inside messages* (linter and rules receive an `ansi` object; `ansi.ts` keys styling off `process.stdout.isTTY`). Piped output is already plain, but `--format json` on a TTY would embed escape codes in the doc.
- **Decision**: In JSON mode, index.ts passes an identity ansi object (`s => s`) into `createLinter`, guaranteeing plain messages regardless of TTY. Human mode keeps the TTY-sensitive ansi. One run only ever renders one format, so choosing ansi at startup is safe.
- **Alternatives considered**: strip-ANSI regex in `renderJson` (treats symptom; regex over every message vs. never generating codes).

## D11 — Human summary table

- **Decision**: Violations-present human report opens with `Color lint: N violations in M files`, then per-rule counts (descending count) using the designer-facing rule labels from `colors.json` descriptions, then the existing rule-grouped detail listing. Clean-run output unchanged.
- **Rationale**: ~500-finding real runs bury the shape of the problem; per-rule counts up front answer "what dominates" in one screenful (SC-004).

## Explicitly declined (recorded for posterity)

- `formatVersion` field — declined by requester; introduce with the first breaking shape change.
- `filesScanned` count — declined by requester.
- Per-rule truncation ("…and N more") in human mode — not selected.
- `--group-by file` human mode — not selected.
