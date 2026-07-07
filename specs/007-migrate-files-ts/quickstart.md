# Quickstart: Validate the `files.js` → `files.ts` migration

Runnable checks proving the migration is behavior-preserving. Run from the repo root.

## Prerequisites

- Node `^26.1.0` (native `.ts` type stripping), `pnpm` installed, deps installed (`pnpm install`).

## Baseline (capture BEFORE the change)

```sh
pnpm typecheck                      # expect: zero errors
pnpm lint:demo | tail -3            # expect: "23 violations found." + "(1 line suppressed …)"
```

Record the full `pnpm lint:demo` output — it is the parity oracle.

## After the change

The migration is done when all of the following hold:

1. **Module is TypeScript**
   ```sh
   test -f lint-color/files.ts && ! test -f lint-color/files.js && echo OK
   ```
   Expect `OK` — `files.ts` exists, `files.js` is gone (SC-001).

2. **Sole importer resolves the `.ts` module**
   ```sh
   grep -n 'from "./files' lint-color/index.js
   ```
   Expect the specifier to read `./files.ts` (FR-003).

3. **Type gate passes**
   ```sh
   pnpm typecheck
   ```
   Expect zero errors, now covering the module body (SC-002).

4. **No unjustified `any`**
   ```sh
   grep -n ':\s*any\|as any' lint-color/files.ts || echo "no any"
   ```
   Expect `no any` (or, if any `any` appears, an adjacent inline justification) (SC-005).

5. **End-to-end parity — the linter still runs and reports identically**
   ```sh
   pnpm lint:demo | tail -3
   ```
   Expect the identical **23 violations / 1 suppressed** result and exit code as the baseline (SC-003, SC-004).

6. **Full suite green**
   ```sh
   pnpm test
   ```
   Expect all tests passing (this module has no test, but the gate must stay green).

## Rollback

`git checkout -- lint-color/` restores the JavaScript module and the `index.js` specifier.
