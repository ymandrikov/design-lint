# Phase 1 Data Model: `index.ts` entrypoint

This module is CLI wiring, not a data store. The "entities" below are the in-memory shapes the
entrypoint constructs and threads through a run. Each row records the shape the migration
declares and where its type comes from. No runtime value changes — the migration adds types
over the existing structures.

## Lint config (parsed from `colors.json`)

The object `JSON.parse(readFileSync("design-system/lint/colors.json"))` yields. Given a
declared shape at the parse boundary (the one external-data seam; `JSON.parse` is `any`).

| Field | Type | Notes |
|-------|------|-------|
| `colorTokenFiles` | `string[]` | CSS files defining `--color-*` aliases; also the exempt-CSS set and the semantic-token source. |
| `rules` | `Record<string, { description?: string }>` | Keyed by rule name; `description` is the designer-facing label surfaced in the report. Passed as `config.rules ?? {}` to `createLinter`. |
| `rules["no-component-color-override"]` | `{ componentsDirectory?: string }` | Sub-config read by `loadUiComponents`. Absent → empty component set. |

- **Validation/behavior**: unchanged. Missing `rules` → `{}`; missing `componentsDirectory` → empty `Set`; a rule with no `description` → label falls back to `Rule ${id}`.

## Tokens bundle (assembled → `createLinter`)

The `{ … }` object passed as `createLinter`'s second argument. Its type MUST satisfy the
`tokens` parameter `linter.ts` declares — **no cast** bridges the seam (Decision 5).

| Field | Type | Source |
|-------|------|--------|
| `semanticSet` | `Set<string>` | Built locally from `--color-([\w-]+):` matches across `colorTokenFiles`. |
| `spectralSet` | `TAILWIND_SPECTRAL_COLORS`' type | Imported from `classify.ts`. |
| `colorPrefixes` | `TAILWIND_COLOR_PREFIXES`' type | Imported from `classify.ts`. |
| `uiComponents` | `Set<string>` | From `loadUiComponents` — PascalCase component names from `.tsx` files. |
| `isValidTailwindCandidate` | `((tok: string) => boolean) \| null` | From `buildIsValidTailwindCandidate(...).catch(() => null)` — `null` on loader failure. |

## Violation & ignore accumulators

The two arrays the run loop pushes into via `accumulate(result, filePath)`.

| Record | Shape | Notes |
|--------|-------|-------|
| Violation | `{ file: string; line: number; rule: <ruleId>; message: string }` | `file` is `relative(ROOT, filePath)`; `rule`/`line`/`message` come from the linter result's `{ line, message, ruleId }`. |
| Ignore | `{ file: string; line: number }` | `line` from the result's ignore line numbers. |

- `accumulate({ violations, ignores }, filePath)` — parameter typed against the `{ violations, ignores }` shape `linter.ts`'s `lint*Source` methods return.

## Rule-namespace view (report labels)

The ten `import * as ruleX from "./rules/*"` namespaces are reduced into `ruleLabel`
(`Record<ruleId, string>`) via `[…].map((r) => [r.id, config.rules[r.name]?.description ?? ...])`.

- **Type**: each `r` is read for `.id` (number) and `.name` (string). Under `checkJs:false` the `.js` namespaces are permissive; a local view type (`{ id: number; name: string }`) or one inline-justified `any` covers the read (Decision 3). Out of scope to type the rule bodies.

## Report-formatting locals

| Local | Type | Notes |
|-------|------|-------|
| `byRule` | `Map<ruleId, Violation[]>` | From `Map.groupBy(violations, v => v.rule)` (es2024 lib). |
| `ruleLabel` | `Record<ruleId, string>` | Rule id → designer label. |
| `ignoreHint` / `ignoresSummary` | `string` | Suppression summary; `ignores.length > 10` triggers the revisit hint. |
| `total` | `number` | Printed violation count; drives the singular/plural wording and nothing else. |

## Loader-callback locals (`buildIsValidTailwindCandidate`)

| Local | Type | Notes |
|-------|------|-------|
| `entryCSS` | `string` | `readFileSync` of the entry CSS. |
| `loadStylesheet(id, base)` params | `string`, `string` | Returns `{ content: string; base: string }`. |
| `loadModule(id, base)` params | `string`, `string` | Returns `{ module: unknown; base: string }`; `mod.default ?? mod`. |
| `ds` | Tailwind package's type (possibly `any`) | Third-party `__unstable__` seam — not owned (Decision 4). |
| returned predicate | `(tok: string) => boolean` | `ds.candidatesToCss([tok]).some(r => r !== null && r !== "")`. |

## Out of scope (unchanged)

- The ten rule modules under `rules/` (nine `.js`, one `.ts`) — imported as namespaces, not migrated.
- The Tailwind internal `__unstable__loadDesignSystem` / `ds` shape.
- The sibling modules `ansi.ts`, `files.ts`, `classify.ts`, `linter.ts` — their types are consumed, not changed.
