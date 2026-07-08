# Quickstart: Namespace-Aware Color Classification

**Feature**: 014-namespace-color-classify | **Date**: 2026-07-08

Validation guide proving the false positives are gone and every true positive
survives. Implementation details live in `tasks.md` / the code; this is the
run-and-observe checklist.

## Prerequisites

- Repo deps installed (`pnpm install`).
- Node with `.ts` execution (as used by the existing suite).
- A target project available for the real-world check (`../solaris` was the
  motivating case; any Tailwind v4 target works).

## Gate commands

```sh
pnpm typecheck        # zero errors (Constitution)
pnpm test             # all green, no skipped / .only
pnpm lint:demo        # demo fixture output reviewed & expected
```

## Scenario 1 — non-color utilities are silent (US1, SC-001)

1. Ensure the mixed fixture contains `text-sm`, `text-lg`, `text-xs`,
   `shadow-lg`, `border-2`, `ring-2`, `outline-2`.
2. Run the linter over the fixture.
3. **Expect**: zero violations mentioning `sm`, `lg`, `xs`, `2`, or any
   non-color scale value. No `no-undefined-token` or `token-constraints` line
   for those classes.

## Scenario 2 — genuine color findings preserved (US2, SC-002)

1. Fixture also contains `text-red-500`, `bg-accent/50`, `bg-black`, a
   token-constraint break (e.g. `text-danger` where `text-` forbids it), and a
   typo (`text-accnt`).
2. Run the linter.
3. **Expect**, unchanged from before this feature:
   - `text-red-500` → spectral-color violation.
   - `bg-accent/50` → opacity-modifier violation.
   - `bg-black` → still reported (color namespace, not a semantic token).
   - `text-danger` → token-constraints violation.
   - `text-accnt` → undefined-token violation (typo still caught, Q1=B).

## Scenario 3 — future scale values need no code change (US3, SC-003)

1. Add a new size to the fixture's design system (e.g. a `--text-4xl` or a novel
   `--shadow-3xl`), and a class using it behind an overloaded prefix.
2. Run the linter **without editing any `lint-color/` source**.
3. **Expect**: zero color violations for the new class — the namespace-complete
   resolver classifies it as `non-color` automatically.

## Scenario 4 — `text-base` collision is Tailwind-correct (research D3)

1. Fixture's design system defines `--color-base` and a class uses `text-base`.
2. Run the linter.
3. **Expect**: `text-base` **is** reported by `token-constraints` (Tailwind
   resolves it color-first to `var(--color-base)`; the developer's intended font
   size was silently shadowed). This confirms strict mirroring, not a
   regression. See SC-001 note.

## Real-world check (SC-001 magnitude)

```sh
node lint-color/index.ts ../solaris 2>&1 | grep -c "is not defined"
```

- **Before**: bucket 3 (`no-undefined-token`) ≈ 1386 lines, dominated by
  `text-sm` / `text-xs` / `text-lg`.
- **After**: the ~1268 non-color lines (`text-sm/xs/lg/xl`, `shadow-*`) are gone;
  the ~19 genuine `bg-black`/`text-white`/typo lines remain. `text-base` (678,
  bucket 2) is unchanged — see D3.

## Definition of done

- [ ] Scenarios 1–4 pass on the committed fixture.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm lint:demo` green.
- [ ] e2e test asserts the exact before/after violation set (SC-005, FR-009).
- [ ] SC-001 wording reconciled to ~1268 (research D3) — confirmed with user.
- [ ] No per-file runtime regression on the demo fixture (SC-004).
