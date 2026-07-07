# Quickstart / Validation: `no-spectral-color` JS → TS

Runnable checks that prove the migration is behavior-preserving and type-clean. Run from the
repo root.

## Prerequisites

- Node v26.1.0 (native `.ts` type stripping — `node --version` to confirm).
- `pnpm install` already run.

## 0. Baseline (before the change)

Capture the demo-app spectral output to diff against later:

```sh
pnpm lint:demo > /tmp/spectral-before.txt 2>&1 || true
```

## 1. Type gate

```sh
pnpm typecheck
```

**Expect**: zero errors. If tsc reports an error on the `.ts`-extension import, add
`"allowImportingTsExtensions": true` to `tsconfig.json` `compilerOptions` and re-run
(see research R3).

## 2. Behavior suite (unchanged tests)

```sh
pnpm test -- no-spectral-color
```

**Expect**: every case in `lint-color/rules/no-spectral-color.test.ts` passes, with **no
edits** to that file (SC-003).

## 3. End-to-end demo diff

```sh
pnpm lint:demo > /tmp/spectral-after.txt 2>&1 || true
diff /tmp/spectral-before.txt /tmp/spectral-after.txt
```

**Expect**: empty diff — identical spectral-color violations, messages, and counts (SC-004).

## 4. Full suite

```sh
pnpm test
```

**Expect**: all green, no skipped / `.only` (Constitution II quality gate).

## Sanity checks

- `lint-color/rules/no-spectral-color.js` no longer exists; `no-spectral-color.ts` does (SC-001).
- `grep -n "no-spectral-color" lint-color/index.js lint-color/linter.js` → both specifiers end `.ts`.
- No new dependency, build script, or loader flag added to `package.json` (SC-005).
- `grep -n "any" lint-color/rules/no-spectral-color.ts` → none, or each with an inline justification (SC-006).
