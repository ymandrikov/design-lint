# Quickstart: ERB Color Linting

Runnable validation that the feature works end-to-end. See [contracts/erb-linting.md](./contracts/erb-linting.md)
and [data-model.md](./data-model.md) for detail; this is the run/verify guide only.

## Prerequisites

- Node ^26.1.0, pnpm 11.
- `pnpm add @herb-tools/node-wasm@<pinned>` (pre-1.0 — pin exact).
- Existing `pnpm install` deps.

## Setup — fixtures

Create `fixtures/erb-app/src/` templates (used by e2e + the demo run):

- `static.html.erb` — a `class` with a non-semantic color (`text-red-500`) and a semantic token
  (`text-primary`).
- `interpolation.html.erb` — `class="text-red-500 <%= dynamic %>"` and `class="text-<%= s %>-500"`.
- `suppressed.html.erb` — a violation line preceded/annotated with `<%# color-lint-ignore %>`.
- `malformed.html.erb` — an unclosed tag, plus a sibling valid file to prove the run continues.
- `parity/` — a `.tsx` and a `.html.erb` using the **same** offending class, to assert identical verdicts.

## Run

```bash
pnpm typecheck                       # gate: zero errors
pnpm test                            # gate: all vitest green (incl. new ERB tests)
node lint-color/index.ts fixtures/erb-app   # exercise the CLI over ERB
pnpm lint:demo                       # gate: existing demo output byte-identical (no regression)
```

## Expected outcomes (maps to Success Criteria)

- **SC-001** — `static.html.erb`: exactly one violation (`text-red-500`), none for `text-primary`.
- **SC-002** — `parity/`: the `.tsx` and `.html.erb` produce the same rule + message for the shared token.
- **SC-003** — `interpolation.html.erb`: only the static `text-red-500` reported; `<%= dynamic %>` and
  the split `text-<%= s %>-500` produce zero violations (no `text-`/`-500` fragments).
- **SC-004** — `pnpm lint:demo` output unchanged vs pre-feature (diff is empty).
- **SC-005** — `malformed.html.erb`: run completes, the sibling valid file is still linted, the parse
  problem is surfaced (not a crash).
- **Suppression** — `suppressed.html.erb`: the annotated line reports no violation and is counted in the
  suppressed summary.

## Validation checklist

- [ ] `.erb` and `.html.erb` both discovered by one glob.
- [ ] ERB violations render as `<file>:<line>  <message>` under the correct rule label, non-zero exit.
- [ ] `Herb.load()` awaited once before linting; no per-file async.
- [ ] No new violations/regressions on `.css`/`.ts`/`.tsx`.
