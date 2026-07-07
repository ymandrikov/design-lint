# Quickstart: validate the classify.js → TypeScript migration

Prerequisites: repo installed (`pnpm install`), Node v26.1.0. All commands run from repo root.

## 1. Capture the baseline (before the change)

```bash
pnpm typecheck                 # expect: 0 errors
pnpm test                      # expect: all green; classify.test.ts = 115 passed
pnpm lint:demo                 # expect: "23 violations found." + "(1 line suppressed…)", exit 1
```

## 2. Confirm the module moved to TypeScript

```bash
ls lint-color/classify.*       # expect: classify.ts and classify.test.ts — NO classify.js
```

## 3. Confirm no dangling `.js` specifier for the module

```bash
grep -rn "classify\.js" lint-color   # expect: no matches (all importers now ./classify.ts / ../classify.ts)
```

## 4. Confirm no unjustified `any`

```bash
grep -n "any" lint-color/classify.ts # expect: no matches (or each with an inline justification comment)
```

## 5. Re-run the gates (after the change)

```bash
pnpm typecheck                 # expect: 0 errors, module body now type-checked
pnpm test                      # expect: identical pass set, zero assertion edits
pnpm lint:demo                 # expect: byte-identical — 23 violations, 1 suppressed, exit 1
```

## Pass criteria

- `classify.ts` exists, `classify.js` gone (SC-001).
- Typecheck clean (SC-002); no unjustified `any` (SC-006).
- Every test passes unchanged (SC-003).
- Demo output identical: 23 violations, 1 suppressed (SC-004).
- No new build/loader step — `node lint-color/index.js` runs as before (SC-005).

See [contracts/classify-module.md](./contracts/classify-module.md) for the exact exported
surface and [data-model.md](./data-model.md) for the named types.
