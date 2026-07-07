# Quickstart: Validate the `linter.js` → `linter.ts` migration

Runnable checks proving the migration is behavior-preserving. Run from the repo root.

## Prerequisites

- Node `^26.1.0` (native `.ts` type stripping), `pnpm` installed, deps installed (`pnpm install`).

## Baseline (capture BEFORE the change)

```sh
pnpm typecheck                      # expect: zero errors
pnpm lint:demo | tail -3            # expect: "23 violations found." + "(1 line suppressed …)"
pnpm test                           # expect: all suites green
```

Record the full `pnpm lint:demo` output and the test summary — they are the parity oracle.

## After the change

The migration is done when all of the following hold:

1. **Module is TypeScript**
   ```sh
   test -f lint-color/linter.ts && ! test -f lint-color/linter.js && echo OK
   ```
   Expect `OK` — `linter.ts` exists, `linter.js` is gone (SC-001).

2. **All three importers resolve the `.ts` module**
   ```sh
   grep -rn 'from "./linter' lint-color/index.js lint-color/linter.test.ts lint-color/linter.lintCss.test.ts
   ```
   Expect every specifier to read `./linter.ts`; `grep -rn 'linter\.js' lint-color` finds no reference to the deleted module (FR-003).

3. **Type gate passes**
   ```sh
   pnpm typecheck
   ```
   Expect zero errors, now covering the engine body (SC-002).

4. **No unjustified `any`**
   ```sh
   grep -n ':\s*any\|as any' lint-color/linter.ts || echo "no any"
   ```
   Expect `no any` (or, if any `any` appears, an adjacent inline justification) (SC-006).

5. **Full suite green — the two engine suites resolve the `.ts` module and pass unchanged**
   ```sh
   pnpm test
   ```
   Expect all suites passing, including `linter.test.ts` and `linter.lintCss.test.ts`, with no assertion edits (SC-004).

6. **End-to-end parity — the linter still runs and reports identically**
   ```sh
   pnpm lint:demo | tail -3
   ```
   Expect the identical **23 violations / 1 suppressed** result and exit code as the baseline (SC-003, SC-005).

## Rollback

`git checkout -- lint-color/` restores the JavaScript module and the three import specifiers.
