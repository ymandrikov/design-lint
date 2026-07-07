# Contract: `lint-color/classify.ts` exported surface

The migration MUST preserve every export below — name, arity, runtime behavior — so the CLI
entrypoint, linter factory, shared helpers, five rule modules, and all tests keep working
unchanged (FR-002). Signatures are the post-migration typed form; the JS today has the same
names and runtime shapes (documented in JSDoc).

## Constants

| Export | Type | Value (unchanged) |
|--------|------|-------------------|
| `TAILWIND_SPECTRAL_COLORS` | `Set<string>` | 22 palette names (`red`…`stone`) |
| `TAILWIND_STATIC_COLORS` | `Set<string>` | `black white transparent current inherit` |
| `CSS_COLOR_PROPERTIES` | `Set<string>` | `color background-color` |
| `TAILWIND_COLOR_PREFIXES` | `string[]` | ordered color-utility prefixes (`bg`…`placeholder`…`shadow`) |

## Functions

| Export | Signature | Behavior held |
|--------|-----------|---------------|
| `splitColorToken` | `(rawTok: string) => SplitToken` | variant peel on `:`, v4 trailing / v3 leading important strip, single `/`-modifier extraction; second modifier left in `base`; never throws (FR-005) |
| `findSpectralMatch` | `(colorPart: string, spectralSet?: Set<string>) => SpectralMatch \| null` | first left-to-right palette-name+numeric-shade; `null` when part empty or set missing (FR-010) |
| `classifyColorPart` | `(colorPart: string \| null, tokens: Tokens) => ColorVerdict` | verdict order semantic → static → arbitrary/var → spectral (FR-006) |
| `parseArbitraryProperty` | `(base: string) => ArbitraryProperty \| null` | whole-base `[prop:value]` parse; `null` if not one / malformed (FR-008) |
| `classifyParts` | `(parts: { colorPart: string \| null; arbitraryProperty: string \| null; arbitraryValue: string \| null }, tokens: Tokens) => ColorVerdict` | arbitrary-property path gated by `isColorProperty`, else `classifyColorPart` (FR-008) |
| `findColorPrefix` | `(base: string, colorPrefixes: string[]) => string \| null` | longest prefix whose `prefix-` leads `base`, else `null` (FR-010) |
| `composeColorParts` | `(rawTok: string, colorPrefixes?: string[]) => ColorParts \| null` | `null` for non-candidates (invalid variant / 2nd modifier / invalid modifier / bad arbitrary group / malformed arbitrary property); else full parts record (FR-009) |

## Internal helpers (not exported; typed, behavior unchanged)

`isColorProperty`, `isTwV3Important`, `isTwV4Important`, `isArbitraryOrVarShorthand`,
`isNonColorTypehint`, `hasSecondModifier`, `isMalformedArbitraryProperty`,
`classifyArbitraryColor`, `classifyVarShorthand`, `extractTypehint`, `classifyVarReference`,
`classifyColorValue`, `isDiscardedCandidate`, `isValidModifier`, `isValidArbitraryGroup`,
`isArbitraryDiscarded`. Recursive `var()`-fallback detection in `classifyVarReference`
(FR-007) and the arbitrary-group discard rules in `isArbitraryDiscarded` (FR-009) are held.

## Consumers (must keep resolving)

Runtime (specifier → `.ts`): `lint-color/index.js`, `lint-color/linter.js`,
`lint-color/helpers.ts`, `lint-color/rules/no-var-color.js`,
`lint-color/rules/no-component-color-override.js`, `lint-color/rules/no-opacity-modifier.js`,
`lint-color/rules/no-raw-css-color.js`, `lint-color/rules/no-spectral-color.ts`.

Tests (specifier → `.ts`, assertions unchanged): `classify.test.ts`, `linter.test.ts`,
`linter.lintCss.test.ts`, `rules/{no-var-color,no-spectral-color,no-raw-css-color,no-opacity-modifier,token-constraints}.test.ts`.

## Verification

- `pnpm typecheck` → 0 errors, module body now covered.
- `pnpm test` → all green, no assertion edits (`classify.test.ts` 115 cases).
- `pnpm lint:demo` → 23 violations, 1 suppressed — identical to baseline.
