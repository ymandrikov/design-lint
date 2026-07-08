# Data Model: Structured Lint Output

One new central type (`RunResult`), one widened existing type (`LintResult`).
All types live in `lint-color/report.ts` unless noted.

## RunResult

The complete result of one lint run. Built once in `index.ts` after all lint passes;
sole input to both renderers.

| Field | Type | Notes |
|---|---|---|
| `violations` | `RunViolation[]` | Accumulation order as built; `renderJson` sorts canonically (file → line → rule → message); `renderHuman` groups by rule |
| `ignores` | `RunIgnore[]` | Lines suppressed via `color-lint-ignore` |
| `warnings` | `string[]` | Run diagnostics surfaced during linting (today: ERB parse notes), already file-prefixed |
| `missingSourceDirs` | `string[]` | Configured source dirs that don't exist on disk |
| `ruleLabels` | `Record<string, string>` | rule name → designer-facing description from `colors.json` (fallback: rule name). Human renderer only; never serialized |

Derived (not stored): total violation count, affected-file count, per-rule counts —
computed by renderers from `violations`.

## RunViolation

| Field | Type | Notes |
|---|---|---|
| `file` | `string` | Target-root-relative path (existing `relative(ROOT, filePath)` behavior) |
| `line` | `number` | 1-based |
| `rule` | `string` | Kebab-case rule name (translated from internal numeric `ruleId` via the existing `ruleModules` array) |
| `message` | `string` | Existing message text; plain (no ANSI) in JSON mode via identity-ansi injection |

Validation: `rule` values are exactly the 10 rule-module `name` exports, which match
`colors.json` `rules` keys.

## RunIgnore

| Field | Type | Notes |
|---|---|---|
| `file` | `string` | Target-root-relative path |
| `line` | `number` | Suppressed line |

## LintResult (widened — `lint-color/linter.ts`)

Existing per-file result. Gains warnings:

| Field | Type | Change |
|---|---|---|
| `violations` | `{ line, message, ruleId }[]` | unchanged |
| `ignores` | `number[]` | unchanged |
| `warnings` | `string[]` | NEW — replaces `console.warn` side effect; empty for all methods except `lintErbSource` today |

State transitions: none — all values are built once, rendered once, process exits.

## Relationships

```text
colors.json rules{} ──descriptions──▶ RunResult.ruleLabels
rule modules {id,name} ──id→name map──▶ RunViolation.rule
linter LintResult ──accumulate()──▶ RunResult.{violations,ignores,warnings}
files.ts resolveExistingSourceDirs ──▶ RunResult.missingSourceDirs
RunResult ──renderJson──▶ stdout doc (JSON mode)
RunResult ──renderHuman──▶ stdout report (human mode)
```
