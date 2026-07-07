# Contract: Rule Module (`lint-color/rules/<name>.ts`)

The interface each migrated rule exposes to the linter registry. This contract is **preserved
exactly** by the migration — it is the reason the registry, the cross-rule importer, and every
test keep working unchanged. The dispatch shapes below are the ones the linter factory
(`linter.ts`) already declares and reads off each `import * as rule…` namespace; the rule's
own `parts`/`tokens` types come from `classify.ts`, and its `ctx`/`Ansi` are small local types.

## Namespace shape (how the registry consumes a rule)

The registry loads each rule as `import * as rule… from "./rules/<name>.ts"`, then reads the
members below. `linter.ts` types these dispatch shapes locally and matches the rule methods
**bivariantly**, so a rule may declare narrower `ctx`/`tokens` types and still be accepted:

```ts
// as seen by the registry:
id: number;                 // stable, unique; unchanged by migration
name: string;               // kebab-case; unchanged by migration
lintSource?: (source: string, filePath: string, ctx) => void;   // source-walking rules
checkToken?: (rawTok: string, parts: ColorParts, ctx) => string | null;  // token rules
checkValue?: (value: string, ctx: { ansi }) => string | null;   // CSS-value path (no-raw-css-color)
```

A rule exports **exactly the members it exports today** — no member added or removed by the
migration. `ColorParts` is imported from `classify.ts` (the same type `linter.ts` passes in).

## Entrypoint contracts (name, arity, return type preserved)

```ts
// Source-walking rules (no-style-color, no-useless-hover, no-component-color-override):
export function lintSource(source: string, filePath: string, ctx: Ctx): void;
//   reports violations via ctx.report(line, message); returns nothing.

// Token rules (no-raw-css-color, no-opacity-modifier, token-constraints,
//              no-var-color, no-dark-variant, no-undefined-token):
export function checkToken(rawTok: string, parts: ColorParts, ctx: Ctx): string | null;
//   returns the violation message, or null when the token is clean.

// CSS-value path (no-raw-css-color):
export function checkValue(value: string, ctx: { ansi: Ansi }): string | null;
```

`Ctx` and `Ansi` are declared locally in each rule, carrying exactly the fields it reads
(matching `no-spectral-color.ts` and `linter.ts`); `ColorParts`/`Tokens` come from `classify.ts`.

## Cross-rule export (no-raw-css-color)

```ts
export function findRawColor(value: string): string | null;   // signature unchanged
```

Imported by `no-component-color-override`. Signature preserved; only the import specifier
extension changes (`.js` → `.ts`).

## Registry import sites (must resolve post-migration)

```ts
// lint-color/linter.ts AND lint-color/index.ts — one line per rule, specifier flips .js→.ts:
import * as ruleStyleColor       from "./rules/no-style-color.ts";
import * as ruleRawCssColor      from "./rules/no-raw-css-color.ts";
import * as ruleVarColor         from "./rules/no-var-color.ts";
import * as ruleAlphaModifier    from "./rules/no-opacity-modifier.ts";
import * as ruleSpectralColor    from "./rules/no-spectral-color.ts";   // already .ts (unchanged)
import * as ruleColorRules       from "./rules/token-constraints.ts";
import * as ruleDarkModifier     from "./rules/no-dark-variant.ts";
import * as ruleHoverInteractive from "./rules/no-useless-hover.ts";
import * as ruleUiColorOverride  from "./rules/no-component-color-override.ts";
import * as ruleUndefinedToken   from "./rules/no-undefined-token.ts";
```

## Conformance

- `pnpm typecheck` — zero errors; each rule's namespace assignable to its dispatch shape in `linter.ts`.
- `pnpm test` — every rule's `*.test.ts` (which imports the module and asserts exact output) passes with no assertion edits.
- `pnpm lint:demo` — 23 violations / 1 suppressed, exit 1 (unchanged).
