# Quickstart: Validate the `index.js` → `index.ts` migration

Runnable checks that prove the entrypoint migration is behavior-preserving. Run from repo root.

## Prerequisites

- Node `^26.1.0` (native `.ts` type stripping — no build step).
- Deps installed (`pnpm install`).

## 0. Capture the baseline (before any edit)

```bash
pnpm typecheck                                   # expect: zero errors
node lint-color/index.js fixtures/demo-app | tail -3
#   expect:
#     23 violations found.
#       (1 line suppressed with color-lint-ignore)
pnpm test                                        # expect: all green
```

## 1. Confirm the module moved to TypeScript

```bash
test -f lint-color/index.ts && echo "OK: index.ts exists"
test ! -f lint-color/index.js && echo "OK: index.js removed"
```

## 2. Confirm the only external edit — the `lint:demo` script path

```bash
grep -n '"lint:demo"' package.json
#   expect the script to name lint-color/index.ts (not index.js)

# No in-repo module imports the entrypoint, so there are NO import-specifier edits:
grep -rn 'lint-color/index\.js' package.json && echo "FAIL: stale .js path" || echo "OK: no stale index.js path"
```

## 3. Typecheck now covers the entrypoint body

```bash
pnpm typecheck        # expect: zero errors, with index.ts within coverage
```

## 4. Demo run is byte-for-byte identical (the parity oracle)

```bash
# via the package script (uses the migrated path)
pnpm lint:demo | tail -3
#   expect (unchanged):
#     23 violations found.
#       (1 line suppressed with color-lint-ignore)
echo "exit=$?"       # pnpm masks it; check the direct invocation below for the code

# direct invocation of the .ts entrypoint
node lint-color/index.ts fixtures/demo-app > /tmp/demo-after.txt 2>&1; echo "exit=$?"   # expect exit=1
```

To assert full parity, diff a captured before/after:

```bash
# (run BEFORE migrating) node lint-color/index.js fixtures/demo-app > /tmp/demo-before.txt 2>&1
node lint-color/index.ts fixtures/demo-app > /tmp/demo-after.txt 2>&1
diff /tmp/demo-before.txt /tmp/demo-after.txt && echo "OK: identical output"
```

## 5. Exit codes preserved

```bash
node lint-color/index.ts fixtures/demo-app > /dev/null 2>&1; echo "violations exit=$?"   # expect 1
# a clean target (no color violations) should exit 0 — verify against any known-clean root if available
```

## 6. Full suite green

```bash
pnpm test             # expect: all green, no regressions
```

## Success = all of

- `index.ts` present, `index.js` gone (step 1).
- `lint:demo` names `index.ts`; no stale `index.js` path anywhere (step 2).
- `pnpm typecheck` zero errors (step 3).
- Demo output identical, exit 1 on violations (steps 4–5).
- `pnpm test` green (step 6).
