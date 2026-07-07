# Phase 1 Data Model: `linter.ts`

This module has no persistent data. The "entities" are the in-memory value shapes the factory
and its five methods produce and consume — the types the migration makes explicit. All are
derived from `classify.ts` or defined locally in `linter.ts`; none come from the test-scoped
`helpers.ts` (research Decision 4).

## Violation record — `{ line, message, ruleId }`

The atom the engine assembles for every finding and the CLI entrypoint consumes.

- **Shape**: `{ line: number; message: string; ruleId: number }`
- **Produced by**: the per-token pipeline (`checkTailwindClasses` attaches `line` to each rule's `{ message, ruleId }`), the `lint*Source` methods (attach `ruleId` to each `{ line, message }` from `lintSourceIfEnabled`), and the CSS path (`lintCssSource`).
- **Consumed by**: `index.js` `accumulate` — reads `line`, `message`, `ruleId` (as `rule`).
- **Invariant**: unchanged from JS; `ruleId` is the rule module's numeric `id`.
- **Intermediate shape**: token rules first yield `{ message, ruleId }` (no `line`) inside `checkTailwindToken`; `line` is attached one level up in `checkTailwindClasses`. Both shapes are typed.

## Lint result — `{ violations, ignores }`

The object every public method returns.

- **Shape**: `{ violations: Violation[]; ignores: number[] }`
- **`violations`**: the findings for the source (possibly empty).
- **`ignores`**: suppressed line numbers — the sorted `color-lint-ignore` line set for `lintTailwindSource`/`lintCssSource`, and `[]` for the single-rule methods (`lintStyleSource`, `lintHoverSource`, `lintComponentSource`).
- **Invariant**: both fields and element types explicit and identical to today's runtime values, including the empty-`ignores` cases and the malformed-CSS `{ [], [] }` early return.

## Token set — `tokens`

The resolved object the factory receives and threads to `composeColorParts` and every rule.

| Field | Type | Use in module |
|-------|------|---------------|
| `semanticSet` | `Set<string>` | passed to rules as `ctx.tokens` (classifier reads it) |
| `spectralSet` | `Set<string>` | passed to rules as `ctx.tokens` |
| `colorPrefixes` | `string[]` | `composeColorParts(rawTok, tokens.colorPrefixes)` |
| `uiComponents` | `Set<string>` | passed to `no-component-color-override` via `ctx.tokens` |
| `isValidTailwindCandidate` | `(tok: string) => boolean` \| `null` | passed to rules via `ctx.tokens` |

- **Source**: built by `index.js` (from `colors.json` + Tailwind design system) and by the tests as `minimalTokens`. The engine's type must admit both. Members are widened (optional / `Record<string, unknown>`-compatible where variance requires) to satisfy the typed `no-spectral-color.ts` `Ctx` while accepting the runtime object — matching the proven approach in `helpers.ts`. See research Decision 4.

## Color parts — `ColorParts` (from `classify.ts`)

The decomposed token shape `composeColorParts` returns and every `checkToken` rule reads.

- **Shape**: `ColorParts` = `NonNullable<ReturnType<typeof composeColorParts>>` (the classifier's exported type; identical to the `Parts` alias `no-spectral-color.ts` derives).
- **Use**: `checkTailwindToken` calls `composeColorParts(rawTok, colorPrefixes)` once per token; guards `parts === null` (not a Tailwind candidate → no rule runs) and `!parts.base` (no color base → the color-part rules skip); passes the non-null `parts` to each token rule.
- **Invariant**: the two short-circuits and the single compose-per-token are preserved exactly (FR-005).

## Rule module — `import * as ruleX` namespace

Each of the ten rule namespaces the dispatch helpers call.

| Member | Type | Notes |
|--------|------|-------|
| `id` | `number` | becomes the violation `ruleId` |
| `name` | `string` | keyed into `config` and the disabled-rules set |
| `lintSource?` | `(source, filePath, ctx) => void` | source-scanning rules (`no-style-color`, `no-useless-hover`, `no-component-color-override`) |
| `checkToken?` | `(rawTok, parts, ctx) => string \| null` | per-token rules (six) |
| `checkValue?` | `(value, ctx) => string \| null` | CSS-value rule (`no-raw-css-color`) |

- **Source**: nine `.js` (permissive `any`-param signatures under `allowJs`/`checkJs:false`) and one `.ts` (`no-spectral-color.ts`) among the ten. Not migrated (FR-008). The dispatch helpers are typed to accept these namespaces and read `name`/`id` plus the relevant method.

## Per-rule config — `config`

The map the factory receives (`config.rules` from the caller).

- **Shape**: `Record<string, RuleConfig>` where `RuleConfig = { enabled?: boolean; [key: string]: unknown }`.
- **Use**: `buildDisabledRules` collects the names whose entry has `enabled === false`; each rule is passed its own `config[ruleModule.name]` as `ruleConfig`.
- **Invariant**: the `enabled === false` (strict) disabled test and the per-rule `ruleConfig` passing are preserved exactly (FR-005).

## Public surface (unchanged)

```text
createLinter(config, tokens, ansi): {
  lintTailwindSource(source: string, filePath: string): { violations: Violation[]; ignores: number[] }
  lintStyleSource(source: string, filePath: string):    { violations: Violation[]; ignores: number[] }
  lintHoverSource(source: string, filePath: string):    { violations: Violation[]; ignores: number[] }
  lintComponentSource(source: string, filePath: string):{ violations: Violation[]; ignores: number[] }
  lintCssSource(source: string, isExempt: boolean):     { violations: Violation[]; ignores: number[] }
}
```

Names and call signatures are identical to the JavaScript module (FR-002); only type
annotations are added. See `contracts/linter-module.md`.
