# Design Lint

A design-system linter for Tailwind-based codebases. It enforces that UI color comes only from semantic design tokens — color is the first domain; spacing, typography, and others may follow.

## Language

### Tokens & colors

**Semantic token**:
A named color defined as a `--color-*` custom property in a color token file (e.g. `primary`, `success-content`). The only sanctioned way to apply color.
_Avoid_: CSS variable, theme color, custom color

**Color token file**:
A CSS file listed in the config's `colorTokenFiles`; the source of truth semantic tokens are derived from. Exempt from raw-color rules.
_Avoid_: theme file, exempt file

**Spectral color**:
A Tailwind built-in palette color class (e.g. `bg-red-500`, `text-sky-200`). Forbidden in app code; a semantic token must be used instead.
_Avoid_: palette color, raw Tailwind color

**Raw color**:
A literal color value — hex, `rgb()`, `hsl()`, `oklch()`, etc. — whether in CSS, an arbitrary-value class (`bg-[#123456]`), or a `style=` prop. Forbidden outside color token files.
_Avoid_: hardcoded color, inline color

**Color prefix**:
A Tailwind utility prefix that _can_ carry a color value (`bg`, `text`, `border`, `ring`, `fill`, …). A prefix match makes a class a color _candidate_, not a color _reference_ — many of these prefixes are overloaded (`text-sm`, `shadow-lg`, `border-2` are sizes, not colors). Whether a class is actually a color is decided by namespace resolution (see **Namespace kind**), not by the prefix alone.

**Namespace kind**:
What a candidate's value resolves to when compiled against Tailwind's default theme merged with the target's color tokens. `color` — resolves to ≥1 color CSS property (`bg-accent`, `text-red-500`, and `text-base` where `--color-base` shadows the size). `non-color` — resolves only to non-color properties (`text-sm` → `font-size`, `shadow-lg` → `box-shadow`); dropped before any color rule runs. `unresolved` — compiles to nothing (a typo like `text-accnt`); kept, so undefined-token still flags it. **A class is a color reference only if its value resolves under a color namespace or under none** — never by prefix presence.

**Candidate**:
A class string that Tailwind can compile to CSS for the target's design system. A color class that is not a valid candidate references an undefined token. A string Tailwind would discard outright (malformed syntax, double modifier) is not a candidate; rules do not inspect it. A candidate whose **Namespace kind** is `non-color` is filtered out before the color rules — it is a size/width/shadow utility, not a color.

**CSS-variable reference**:
A color applied by referencing a custom property from a class — `bg-[var(--x)]` or the `bg-(--x)` shorthand — instead of the token's utility class. Forbidden even when the variable is a semantic token; use the utility form (`bg-primary`).
_Avoid_: var shorthand (as a violation name), arbitrary token reference

**Tailwind variant**:
A condition prefix on a class, separated by `:` (`hover:`, `dark:`, `md:`). Not to be confused with a component **Variant** (a styling prop on a protected component).
_Avoid_: variant (unqualified, when a component Variant could be meant), state prefix

**Modifier**:
The part of a class after a top-level `/` (`bg-primary/50`, `bg-primary/[0.5]`) — in color classes, an opacity modifier. Forbidden on color classes; use a dedicated token.
_Avoid_: opacity suffix, alpha

### Rules & findings

**Rule**:
A single-concern check over source (e.g. `no-spectral-color`). The kebab-case **name** is the canonical identifier — used in config, docs, and future plugin adapters. The numeric `id` is a display sort key only.
_Avoid_: rule number as identifier

**Domain**:
A design-system aspect a rule group covers. Color is the first domain; each domain gets its own rule namespace and suppression directive.

**Violation**:
A single rule finding, reported as file, line, rule, and message.
_Avoid_: error, issue

**Suppression**:
A `color-lint-ignore` comment that silences all color rules for its line. Suppressions are counted and surfaced in the summary, never silent.
_Avoid_: disable comment

**Token constraints**:
Config-defined allow/deny patterns restricting which semantic tokens may appear behind which color prefix (e.g. only `*-content` tokens behind `text-`).

**Target**:
The host project being linted — a directory with a lint config and one or more **source directories**. The linter runs against a target; it does not live inside it.
_Avoid_: host app, root

**Source directory**:
A target-root-relative directory the linter walks for lintable files. Configured as the `sourceDirectories` list in the lint config; absent ⇒ default `["src"]`. When set, the list fully replaces the default (it does not augment `src`). A configured directory that is missing fails loud and forces a non-zero exit; a file reachable through overlapping or nested directories is linted exactly once.
_Avoid_: scan root, search path

**ERB template**:
A Ruby `.erb`/`.html.erb` source file. Color rules inspect only its static HTML `class` attributes, via the herb parser; `style=` and component-shaped rules do not apply. A malformed template surfaces a parse note and still lints its recovered content — it never aborts the run.
_Avoid_: Rails view, HTML file

**Interpolation boundary**:
An ERB hole (`<%= %>`) or control-flow tag (`<% %>`) inside a `class` value. Only whitespace-complete static class tokens are linted; any token touching interpolation is skipped whole, so no partial-token (`text-`, `-500`) is ever reported.
_Avoid_: dynamic class (as a violation name), template hole

### Components

**Protected component**:
A UI component discovered in the config's `componentsDirectory` (shadcn-style). Overriding its color via `className` or `style=` is a violation — a variant must be added instead.
_Avoid_: UI component (ambiguous)

**Variant**:
A sanctioned styling option a protected component exposes as a prop. The only approved way to change a protected component's colors. Not to be confused with a **Tailwind variant** (`hover:`, `dark:`).

**Interactive element**:
An element or component where `hover:` feedback is meaningful — natively interactive tags, trigger-style components, or anything with interaction props/roles. `hover:` elsewhere is a violation.
