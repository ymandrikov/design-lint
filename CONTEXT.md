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
A Tailwind utility prefix that carries a color value (`bg`, `text`, `border`, `ring`, `fill`, …). Rules only inspect classes behind a color prefix.

**Candidate**:
A class string that Tailwind can compile to CSS for the target's design system. A color class that is not a valid candidate references an undefined token. A string Tailwind would discard outright (malformed syntax, double modifier) is not a candidate; rules do not inspect it.

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
The host project being linted — a directory with `src/` and a lint config. The linter runs against a target; it does not live inside it.
_Avoid_: host app, root

### Components

**Protected component**:
A UI component discovered in the config's `componentsDirectory` (shadcn-style). Overriding its color via `className` or `style=` is a violation — a variant must be added instead.
_Avoid_: UI component (ambiguous)

**Variant**:
A sanctioned styling option a protected component exposes as a prop. The only approved way to change a protected component's colors. Not to be confused with a **Tailwind variant** (`hover:`, `dark:`).

**Interactive element**:
An element or component where `hover:` feedback is meaningful — natively interactive tags, trigger-style components, or anything with interaction props/roles. `hover:` elsewhere is a violation.
