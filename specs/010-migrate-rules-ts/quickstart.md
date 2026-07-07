# Quickstart: Validate the `lint-color/rules/**` JS → TS migration

A parity guide. Every check must produce the **same** result before and after the migration —
this is a behavior-preserving language migration.

## Prerequisites

- Node v26.1.0 (native `.ts` type stripping — no build step)
- `pnpm install` already run
- Working from repo root `/Users/ym/work/repos/design-lint`

## Baseline (captured before the change)

| Check | Command | Expected |
|-------|---------|----------|
| Type check | `pnpm typecheck` | exit 0, zero errors |
| Test suite | `pnpm test` | **20 files, 393 tests passing** |
| Demo parity | `pnpm lint:demo` | **23 violations, 1 suppressed**, exit 1 |

## Validation after migration

Run the same three commands; every number must be identical.

```bash
pnpm typecheck        # → 0 errors (now also covers the 9 rule bodies)
pnpm test             # → 20 files / 393 tests passing, 0 assertion edits
pnpm lint:demo        # → 23 violations, 1 suppressed, exit 1
```

### Structural checks

```bash
# 1. No JavaScript rule source remains:
ls lint-color/rules/*.js            # → no such file (only *.ts and *.test.ts)

# 2. All nine migrated rules exist as .ts:
ls lint-color/rules/{no-style-color,no-raw-css-color,no-opacity-modifier,\
token-constraints,no-var-color,no-dark-variant,no-useless-hover,\
no-component-color-override,no-undefined-token}.ts

# 3. Registry points at .ts specifiers (no stale .js):
grep -n 'rules/.*\.js"' lint-color/linter.ts lint-color/index.ts   # → no matches

# 4. Cross-rule import resolved to .ts:
grep -n 'no-raw-css-color' lint-color/rules/no-component-color-override.ts  # → ".ts"

# 5. No unjustified `any` (any `any` must sit next to a justification comment):
grep -rn ': any\| as any' lint-color/rules/*.ts | grep -v test
```

## Per-rule spot check (optional)

Each rule has a dedicated suite; run one in isolation to confirm its detection is intact:

```bash
pnpm test no-raw-css-color        # checkToken + findRawColor + checkValue paths
pnpm test no-useless-hover        # interactive-element detection
pnpm test no-component-color-override   # exercises the cross-rule findRawColor reuse
```

## Success = all green, all numbers identical

- `pnpm typecheck` clean, now covering the rule bodies.
- `pnpm test` 393/393 with zero assertion edits.
- `pnpm lint:demo` 23 / 1, exit 1 — zero net delta.
- No `.js` under `lint-color/rules/`; registry and cross-rule imports resolve by `.ts`.
