# Contract: CLI entrypoint (`lint-color/index.ts`)

Unlike the sibling modules, the entrypoint exposes **no importable surface** — nothing in-repo
imports it. Its contract is its *invocation* and its *observable I/O*. The migration preserves
all of it; only the file extension (and the `lint:demo` script path that names it) changes.

## Invocation

| Aspect | Contract | Migration effect |
|--------|----------|------------------|
| Command | `node lint-color/index.<ext> [target-root]` | `.js` → `.ts`; run directly via Node native type stripping, no build step. |
| `pnpm lint:demo` | `node lint-color/index.js fixtures/demo-app` | EDIT → `node lint-color/index.ts fixtures/demo-app`. The **only** external file edited. |
| Argument | `argv[2]` = target root; absent → two dirs up (`join(__dirname, "../..")`) | Unchanged. `SRC = join(ROOT, "src")`. |
| Shebang | `#!/usr/bin/env node` | Preserved verbatim; cosmetic (no `bin` entry). |
| No importer | No in-repo module imports the entrypoint | Confirmed by `grep -rn "index\.js"` (only the `lint:demo` script + past-spec prose). No import-specifier edits anywhere. |

## Inputs read (unchanged)

- `design-system/lint/colors.json` — the lint config.
- Each `config.colorTokenFiles[*]` — CSS files: exempt-CSS set + `--color-*` semantic-token source; `[0]` is the design-system entry CSS for the Tailwind candidate validator.
- `config.rules["no-component-color-override"].componentsDirectory` — `.tsx` files → PascalCase UI component names.
- The `src/` tree under `ROOT` — walked twice: `.css` (Storybook-filtered), then `.ts`/`.tsx` (Storybook-filtered).

## Output contract (unchanged — the UX surface)

| Case | stdout | Exit code |
|------|--------|-----------|
| No violations | `✓ No color lint violations found.` (+ suppression summary if any ignores) | `0` |
| Violations | Per-rule groups (`bold` label + count), each `  dim(file:line)  message`, sorted ascending by rule id; then `N violations found.` (+ suppression summary) | `1` |
| Suppressions | `(K line(s) suppressed with color-lint-ignore…)`; the `…— consider revisiting…` hint appended when `K > 10` | (rides on the above) |

- Rule labels come from `colors.json` `description`, falling back to `Rule ${id}`.
- Singular/plural wording (`line`/`lines`, `violation`/`violations`) preserved.
- Non-TTY vs TTY coloring (`ansi.blue` gates on `process.stdout.isTTY`) preserved.

## Type contract (new — what the migration adds)

- `config` carries a declared shape at the `JSON.parse` boundary (see data-model.md).
- The `tokens` bundle type-satisfies `createLinter`'s declared `tokens` parameter — **no cast**.
- `accumulate(result, filePath)` typed against the `{ violations, ignores }` result `linter.ts` returns.
- Loader resolver callbacks (`loadStylesheet`/`loadModule`) and the returned predicate are typed; the `ds` handle and the ten `.js` rule namespaces remain permissive seams with inline-justified `any` where unavoidable.
- `pnpm typecheck` → zero errors.

## Parity oracle

`pnpm lint:demo` over `fixtures/demo-app` — **23 violations found, 1 line suppressed**, exit 1 —
byte-for-byte identical before and after. `pnpm test` green. `pnpm typecheck` clean.
