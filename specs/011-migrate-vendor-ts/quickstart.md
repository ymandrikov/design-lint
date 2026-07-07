# Quickstart: Validate the vendored-primitive migration

**Feature**: 011-migrate-vendor-ts | **Date**: 2026-07-07

This guide proves the migration is behavior-preserving. Run the baseline **before** touching
code, migrate, then run the same commands and confirm identical results (zero net delta).

## Prerequisites

- Node v26.1.0 (native `.ts` type stripping), `pnpm` installed, deps installed (`pnpm install`).
- Clean working tree on branch `ym/explore`.

## Baseline (capture before migrating)

```bash
pnpm typecheck          # expect: clean (no output, exit 0)
pnpm test               # expect: Test Files 20 passed (20), Tests 393 passed (393)
pnpm lint:demo          # expect: "23 violations found." + "(1 line suppressed …)", exit 1
```

## After migrating

Run the same three commands. Every result must match the baseline exactly:

| Check | Command | Expected (unchanged) |
|---|---|---|
| Types | `pnpm typecheck` | clean, exit 0 — now covering the four primitives' bodies |
| Tests | `pnpm test` | 393 passed / 20 files, zero assertion edits |
| Demo parity | `pnpm lint:demo` | 23 violations, 1 suppressed, exit 1 |

## Targeted checks

```bash
# 1. No JavaScript source remains under vendor/ (SC-001)
ls lint-color/vendor/*.js 2>/dev/null && echo "FAIL: .js still present" || echo "OK: all .ts"

# 2. All four primitives are .ts
ls lint-color/vendor/{is-color,segment,is-valid-arbitrary,decode-arbitrary-value}.ts

# 3. Consumers import by .ts specifier (FR-003) — expect 4 hits in classify, 1 in the rule
grep -n 'vendor/.*\.ts' lint-color/classify.ts lint-color/rules/no-raw-css-color.ts

# 4. No leftover .js vendor specifier anywhere (source or tests)
grep -rn 'vendor/[a-z-]*\.js' lint-color && echo "FAIL: stale .js specifier" || echo "OK"

# 5. Zero unjustified `any` in the migrated files (SC-006)
grep -n ': any\| any\b' lint-color/vendor/*.ts || echo "OK: no any"

# 6. Provenance headers preserved, "plain JS" wording gone (FR-009)
grep -l 'ADR 0002' lint-color/vendor/*.ts        # expect all four
grep -rn 'plain JS' lint-color/vendor/*.ts && echo "FAIL: stale wording" || echo "OK"

# 7. No new dependency added
git diff --stat package.json | grep -q . && echo "FAIL: package.json changed" || echo "OK"
```

## Per-primitive test suites

```bash
pnpm exec vitest run lint-color/vendor/is-color.test.ts
pnpm exec vitest run lint-color/vendor/segment.test.ts
pnpm exec vitest run lint-color/vendor/is-valid-arbitrary.test.ts
pnpm exec vitest run lint-color/vendor/decode-arbitrary-value.test.ts
```

All four pass with no assertion changes (SC-003).

## Success = all of

- Baseline and post-migration outputs match for all three top-level commands.
- Targeted checks 1–7 print `OK` (no `FAIL`).
- The four vendor `*.test.ts` suites pass unchanged.

If any check fails, the migration is not behavior-preserving — fix before proceeding to commit.
