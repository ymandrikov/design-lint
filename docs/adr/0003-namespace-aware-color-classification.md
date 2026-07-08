# Color classification is by resolved namespace, not by prefix presence

**Status:** accepted

Non-color Tailwind utilities that share a prefix with a color utility
(`text-sm`, `text-xs`, `shadow-lg`, `border-2`, `ring-2`) were reported as
color-token problems — ~43% of the linter's output on a real target (`../solaris`:
1386 `is not defined` lines, dominated by `text-sm`/`text-xs`/`text-lg`). Root
cause: `no-undefined-token` and `token-constraints` fired on **color-prefix
presence**, independent of whether the class was actually a color. We add one
**namespace-complete resolver** and a single filter seam that drops a candidate
whose value resolves to a non-color CSS property before any color rule runs. See
`specs/014-namespace-color-classify/research.md`.

**Classify by resolved property, never by a suffix list (D1).** The resolver
compiles `<prefix>-<value>` against Tailwind's default theme and inspects the
emitted declarations: a class whose compiled output contains only non-color
properties (`font-size`, `box-shadow`, `border-width`) is not a color reference.
This mirrors Tailwind's own namespace resolution (`.repos/tailwindcss`
`theme.ts` `#resolveKey`), so a scale value Tailwind adds later is classified
automatically with no linter change (FR-006). A hardcoded suffix denylist (`sm`,
`xs`, `lg`, …) was rejected — it rots on every new Tailwind release.

**Two separate design systems (D2).** The existing color-token-only oracle
behind `isValidTailwindCandidate` is kept **as-is**; the namespace-complete
resolver is added alongside as a purely additive filter. The oracle must keep
rejecting Tailwind's default-palette colors (`bg-black`, `text-white`) and typos
so those genuine problems stay flagged — enriching it to a full theme would make
`bg-black` a "valid candidate" and silently stop flagging it. Keeping the two
systems separate preserves every true positive while removing the false ones.

**The two systems must resolve Tailwind from different places.** A target whose
color-token file does `@import "tailwindcss"` will not necessarily resolve that
import from its own directory (`../solaris` has no local `tailwindcss` install),
which is precisely why its oracle is accidentally color-only — and correct. The
oracle therefore resolves packages **only from the target root**. The
namespace-complete resolver, which _needs_ the default theme to classify
non-color utilities, resolves `tailwindcss` from the **linter's own install**
(`__dirname`) so the default namespaces always load regardless of the target's
setup. Conflating the two resolution paths would regress `bg-black`.

**`text-base` stays flagged — strict Tailwind mirroring (D3).** The target
defines `--color-base`. For the `text-` utility Tailwind checks the color
namespace **before** font-size (`utilities.ts` color branch precedes the
font-size branch), so `--color-base` shadows the `text-base` font size:
`text-base` compiles to `color: var(--color-base)`, a color. The resolver
classifies it `color` and `token-constraints` correctly flags it — the
developer's intended size silently became a disallowed color. This revised the
metric: the false-positive removal is **~1268** (`text-sm`/`xs`/`lg`/`xl`,
`shadow-*`), not ~1946; the 678 `text-base` findings are Tailwind-correct and
remain. Measured on `../solaris`: `is not defined` dropped 1386 → 19 (all
genuine: `bg-black`, `text-white`, `border-strong`, `ring-*`), `text-base` (678)
unchanged.

**Consequences:** one additive filter seam in `linter.ts`, one resolver in
`index.ts`, and an extended color-property predicate + pure classifier in
`classify.ts`. The color-property predicate over compiled declarations is
explicit (no blanket `--*`): a size utility's helper vars (`--tw-shadow`,
`--tw-ring-shadow`) read as non-color while a color utility's `--tw-shadow-color`
/ `--tw-ring-color` reads as color. Rule messages, exit codes, and every other
verdict are unchanged (INV-2) — the only output delta is the intended
false-positive removal. Demo fixture output unchanged (23 violations); the mixed
`fixtures/mixed-namespaces` corpus pins the exact before/after set (SC-005).
