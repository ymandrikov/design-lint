# Quickstart: Validate the AST-layer TypeScript migration

Proves the migration preserves behavior and adds type coverage, with no new build step.

## Prerequisites

- Node v26.1.0 (native `.ts` type stripping), pnpm, deps installed (`pnpm install`).
- Clean working tree on branch `ym/explore`.

## Baseline (capture BEFORE the change)

```bash
pnpm typecheck                     # expect: 0 errors
node lint-color/index.js fixtures/demo-app | tail -3
# expect: "23 violations found."  and  "(1 line suppressed with color-lint-ignore)"
pnpm test                          # expect: all green
```

## After the change

1. **TypeScript module exists, JS gone**
   ```bash
   test -f lint-color/ast.ts && ! test -f lint-color/ast.js && echo OK   # SC-001
   ```

2. **Type gate passes, module in coverage**
   ```bash
   pnpm typecheck                  # expect: 0 errors (SC-002)
   grep -c ": any" lint-color/ast.ts   # each hit, if any, must have an inline // justification (SC-006)
   ```

3. **All importers resolve (linter runs end-to-end)**
   ```bash
   grep -rn 'ast\.js' lint-color   # expect: no matches (all specifiers now ast.ts) (FR-003)
   pnpm lint:demo | tail -3        # expect: 23 violations, 1 suppressed — identical (SC-004)
   ```

4. **Behavior contract green, unchanged**
   ```bash
   git diff --name-only -- '*.test.ts'   # expect: empty (no test edits) (SC-003)
   pnpm test                              # expect: all green
   ```

5. **No new build/loader step** (SC-005)
   ```bash
   git diff -- package.json tsconfig.json   # expect: no new bundler/loader/tsconfig resolution flags
   ```

## Behavior spot-checks (map to User Story 3)

- **LRU-1 cache**: the four rule passes over one file trigger a single `parseSync` — covered by
  existing linter tests; unchanged.
- **Lang-by-extension**: a `.ts` file with a generic arrow or angle-bracket cast still parses
  fully (no dropped tail).
- **Suppression**: `color-lint-ignore-panel` (className superstring) suppresses nothing; a bare
  `// color-lint-ignore` comment suppresses only its own line — the demo's 1 suppressed line
  count holds.
- **Style desync**: a `style={{…}}` value with a `{` inside a string yields correct props (bug #2
  stays fixed).

## Done when

All five numbered checks pass and every Success Criterion (SC-001…SC-006) in
[spec.md](./spec.md) is satisfied.
