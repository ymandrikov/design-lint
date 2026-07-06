# Vendor `is-color` + `decodeArbitraryValue`; `raw` verdict in classes and CSS declarations

Status: done
Date: 2026-07-07
Source: `.scratch/tailwind-parse-parity/PRD.md` (user stories 3, 5, 7, 8, 9, 12)

## Parent

`.scratch/tailwind-parse-parity/PRD.md`

## What to build

One definition of "literal color" everywhere. Vendor Tailwind's `is-color` logic (named-color set, hex, color-function roots) and `decodeArbitraryValue` (underscore-to-space with the `url()` / `var()`-and-`theme()` first-argument exceptions, built on the existing postcss-value-parser dependency), both pinned to `9b0e8af` with provenance headers.

The classifier's opaque `arbitrary` verdict is replaced: a bracketed or paren value behind a color prefix is decoded, checked for an explicit dataType typehint, then classified `raw` when it is a literal color — hex, color function, CSS named color, `color:`-hinted content, or a variable reference with a literal fallback (`var(--x,red)`). Explicitly non-color typehints (`length:`, `image:`) and non-color values classify as not-a-color and rules skip them. Clean variable references classify `var` (consumed by issue 04 — no rule fires on them yet in this slice).

`no-raw-css-color` consumes the classification for class strings (its naive bracket regex is deleted) and swaps its private color-function/hex constants for the shared `is-color` on the CSS-declaration path — which extends CSS linting to named colors (`color: red` now flagged like `color: #f00`).

## Acceptance criteria

- [x] Vendored `is-color` and `decodeArbitraryValue` carry provenance headers; ported upstream test cases pass (decode exceptions included).
- [x] `classifyColorPart` returns `raw` for `bg-[#123456]`, `bg-[rgb(0_0_0)]`, `bg-[red]`, `text-[color:red]`, `bg-[var(--x,red)]`; not-a-color for `bg-[url(hero.png)]`, `bg-[length:200px]`, `bg-[image:url(x)]`.
- [x] `bg-[var(--my_var)]` classifies `var` (underscore preserved in the variable name), not `raw`.
- [x] `no-raw-css-color` flags all `raw` classifications in className strings; its naive `\[([^\]]+)\]` regex is gone.
- [x] CSS path: `color: red` in component CSS flagged; `url(#id)` and non-color idents still not flagged; color-token files still exempt.
- [x] Rule suites for `no-raw-css-color` extended per the above; all existing suites pass.

## Blocked by

- `01-vendor-segment-rebuild-splitter.md`
- `02-invalid-candidates-null.md`
