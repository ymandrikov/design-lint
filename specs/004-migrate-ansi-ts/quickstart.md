# Quickstart: validate the `ansi` JS → TS migration

Runnable checks that prove the migration preserved behavior. Run from repo root. See
[contracts/ansi.md](./contracts/ansi.md) for the surface and [data-model.md](./data-model.md)
for the escape-sequence table.

## Prerequisites

- Node `^26.1.0` (native `.ts` type stripping; `node --version` should be ≥ 23.6).
- Deps installed (`pnpm install`).

## Step 0 — Capture the baseline (before touching code)

```sh
pnpm lint:demo > /tmp/ansi-before.txt 2>&1; echo "exit=$?"
```

Records the exact terminal output (including ANSI escapes) and exit code of the current
JS module against the demo fixture.

> Note: `pnpm lint:demo` runs via `node` piped to a file → non-TTY, so output is plain.
> To also capture the colored (TTY) path, run `node lint-color/index.js fixtures/demo-app`
> directly in your terminal and eyeball that red/blue/dim coloring still appears after migration.

## Step 1 — Type coverage (FR-004, SC-002)

```sh
pnpm typecheck
```

**Expected**: zero errors, and `lint-color/ansi.ts` is now within coverage. If tsc rejects the
`.ts`-extension import, add `"allowImportingTsExtensions": true` to `tsconfig.json`
`compilerOptions` (see research R3) and re-run.

## Step 2 — Source is TypeScript, no JS remains (FR-001, SC-001)

```sh
test -f lint-color/ansi.ts && ! test -f lint-color/ansi.js && echo "OK: migrated"
grep -n 'ansi\.js' lint-color/index.js && echo "FAIL: stale .js specifier" || echo "OK: importer updated"
```

**Expected**: `OK: migrated` and `OK: importer updated`.

## Step 3 — Output is byte-for-byte identical (FR-007, SC-003)

```sh
pnpm lint:demo > /tmp/ansi-after.txt 2>&1; echo "exit=$?"
diff /tmp/ansi-before.txt /tmp/ansi-after.txt && echo "OK: zero delta"
```

**Expected**: empty diff (`OK: zero delta`) and the same exit code as Step 0.

## Step 4 — Full suite stays green (Constitution Quality Gates)

```sh
pnpm test
```

**Expected**: all tests pass (no `ansi` suite exists; this confirms no consumer regressed).

## Done

All four steps pass → migration validated: typed source, updated importer, identical output,
green suite, no new build step.
