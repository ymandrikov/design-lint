# Quickstart: Configurable Source Directories

Runnable validation that the feature works end-to-end. See
[contracts/source-dirs.md](./contracts/source-dirs.md) and [data-model.md](./data-model.md)
for detail; this is the run/verify guide only.

## Prerequisites

- Node ^26.1.0, pnpm 11.
- Existing `pnpm install` deps (no new dependency).

## Setup — fixtures

- `fixtures/rails-app/` — a Rails-style target: `design-system/lint/colors.json` with
  `sourceDirectories: ["app"]`, sources under `app/` (a `.html.erb` with a spectral
  color violation), **no `src/`**, and a token CSS entry so the candidate loader
  resolves. Proves US1 / SC-001.
- `fixtures/multi-src-app/` — two configured directories including a nested pair (e.g.
  `["app", "app/components"]` or `["app", "lib"]`), each seeding a violation, to prove a
  single consolidated run with per-file attribution and no duplication. Proves US2 /
  SC-003.
- Misconfiguration cases (missing dir, empty list, absolute/`..` path, wrong type) are
  exercised in `tests/e2e.test.ts` by running against a bad config and asserting the
  message + non-zero exit.

## Run

```bash
pnpm typecheck                          # gate: zero errors
pnpm test                               # gate: all vitest green (validator unit + e2e)
node lint-color/index.ts fixtures/rails-app       # lint an app/-layout target
node lint-color/index.ts fixtures/multi-src-app   # lint two dirs in one run
pnpm lint:demo                          # gate: demo output byte-identical (no regression)
```

## Expected outcomes (maps to Success Criteria)

- **SC-001** — `fixtures/rails-app`: the `app/` violation is reported (file relative to
  root), even though there is no `src/`. Setting one config value was enough.
- **SC-002** — `pnpm lint:demo`: output byte-for-byte unchanged vs pre-feature (the demo
  config has no `sourceDirectories` key → default `["src"]`).
- **SC-003** — `fixtures/multi-src-app`: both directories' violations appear in one run,
  each attributed to its file, with no duplication even for the nested pair.
- **SC-004** — misconfiguration runs: a nonexistent directory, an empty list, an
  absolute/escaping path, or a wrong-typed value each prints an actionable message
  (naming the problem) and exits non-zero — never a silent clean pass, never a crash.

## Validation checklist

- [ ] Absent key ⇒ scans `src` (legacy behavior); demo diff empty.
- [ ] `sourceDirectories: ["app"]` ⇒ scans `app/`, not `src/`.
- [ ] Multiple dirs scanned in one run; nested/overlapping files linted once.
- [ ] Missing dir ⇒ named error + non-zero exit; existing siblings still linted.
- [ ] Empty list / absolute / `..` / non-array / non-string ⇒ named error + non-zero exit.
- [ ] Violation file paths remain relative to the target root.
