# Quickstart — Validate the `no-spectral-color` refactor

Behavior-preserving refactor. Validation = the existing oracle stays green, the new
helper is pinned, and the demo-app output is unchanged. No new runtime behavior to drive.

## Prerequisites

- Repo deps installed (`pnpm install`).
- Node `^26.1.0`.

## Steps

1. **Rule oracle (must stay green, zero edits to the test file)**
   ```
   pnpm vitest run lint-color/rules/no-spectral-color.test.ts
   ```
   Expect: all cases pass — violations, non-violations, replacement hints, suppression.
   See [contracts/check-token.md](./contracts/check-token.md) for the case table.

2. **New helper pinned**
   ```
   pnpm vitest run lint-color/classify.test.ts
   ```
   Expect: `findSpectralMatch` returns the matched `{ name, shade }` / `null` per
   [contracts/find-spectral-match.md](./contracts/find-spectral-match.md), and the
   classifier's `"spectral"` verdict still matches the helper.

3. **Full suite + typecheck (constitution gates)**
   ```
   pnpm test
   pnpm typecheck
   ```
   Expect: all green, zero type errors.

4. **Demo-app exact-output parity (zero violation delta)**
   ```
   pnpm lint:demo
   ```
   Expect: the spectral-color violation set is identical to `main`. `tests/e2e.test.ts`
   asserts exact violations/messages/counts — it passing is the parity proof.

## Done when

- Steps 1–4 all pass.
- `rules/no-spectral-color.js` contains no `split("-")` scan of its own — detection via
  `classifyParts`, hint name/shade via `findSpectralMatch`.
- No change to `name`, `id`, `checkToken` signature, message wording, or demo-app output.
