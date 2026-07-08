# Feature Specification: Wire Ruby/ERB Parser

**Feature Branch**: `ym/wire-ruby-parser`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Wire the herb Ruby/ERB parser into design-lint so the existing lint-color token rules run against Ruby ERB/HTML templates. Reuse the parser-agnostic inner pipeline (checkTailwindClasses → checkTailwindToken → the 7 token rules) unchanged; add a herb-based class-attribute extractor for .erb/.html.erb files. Scope first cut to color-in-class-attribute linting only; defer no-style-color, no-component-color-override, no-useless-hover. Full research and cited seam analysis in .scratch/wire-ruby-parser/research.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lint color tokens in ERB templates (Priority: P1)

A developer working on a Tailwind-styled Rails/ERB codebase runs the linter over their
project. Color classes written in `class="..."` attributes of `.erb`/`.html.erb`
templates are checked by the same color-token rules that already govern JSX/TS files, so a
non-semantic color used in a template is reported just as it would be in a component.

**Why this priority**: This is the whole point of the feature — extend existing color
enforcement to a second file ecosystem (server-rendered templates) that is currently
invisible to the linter. Without it, ERB templates are an unguarded gap where non-token
colors leak in.

**Independent Test**: Point the linter at a fixture directory containing an `.erb` file
whose `class` attribute uses a raw/non-semantic color (e.g. `text-red-500`) and a
semantic-token color (e.g. `text-primary`). The run reports exactly the non-semantic usage,
with the correct file, line, rule name, and message — and reports nothing for the token
usage.

**Acceptance Scenarios**:

1. **Given** an `.erb` template with `class="text-red-500"`, **When** the linter runs over
   the directory, **Then** it reports one violation naming that file, the correct line, the
   relevant color-token rule, and a message in the project's vocabulary.
2. **Given** an `.erb` template with `class="text-primary"` (a semantic token), **When** the
   linter runs, **Then** it reports no violation for that attribute.
3. **Given** a `.html.erb` template alongside existing `.tsx` files, **When** the linter runs
   over the project, **Then** violations from both file types appear in one combined result,
   each tagged with its own file and line.
4. **Given** an `.erb` template with multiple color classes in one attribute
   (`class="text-red-500 bg-blue-600 p-4"`), **When** the linter runs, **Then** each
   offending color token is reported and non-color utility classes are ignored.

---

### User Story 2 - Static-only linting with dynamic ERB left untouched (Priority: P2)

A developer has templates that interpolate Ruby into class attributes
(`class="text-red-500 <%= dynamic_class %>"`). The linter checks the static, fully-formed
color tokens it can see and does not emit false positives for the interpolated (dynamic)
portion it cannot resolve.

**Why this priority**: Interpolation is common in real ERB. If the linter guesses at
dynamic values it produces noise and gets disabled. Correct, conservative handling of the
static/dynamic boundary is what makes P1 trustworthy in practice, but the core value (P1)
still stands for fully-static attributes even before this is polished.

**Independent Test**: Lint an `.erb` file whose `class` attribute mixes a static
non-semantic color token with an ERB interpolation. The static offending token is reported;
no violation is invented for the interpolated hole or for the partial fragments adjacent to
it.

**Acceptance Scenarios**:

1. **Given** `class="text-red-500 <%= foo %>"`, **When** the linter runs, **Then** it reports
   the static `text-red-500` violation and nothing about the interpolated segment.
2. **Given** a token split across an interpolation (`class="text-<%= shade %>-500"`), **When**
   the linter runs, **Then** it reports no violation for the partial fragments (they are
   dynamic and out of scope), consistent with the existing static-only stance.

---

### Edge Cases

- **Interpolation adjacent to a token**: a class value like `text-<%= x %>-500` yields partial
  static fragments around a dynamic hole; these MUST NOT be linted as if they were complete
  tokens (no `text-` / `-500` false positives).
- **No color classes**: a template with only non-color utilities (`class="p-4 flex"`) or no
  `class` attribute at all produces no violations and no errors.
- **Malformed / unparseable template**: a template the parser cannot fully parse MUST NOT
  crash the run; the file is reported as a parse problem or skipped, and other files still lint.
- **Empty or whitespace-only class attribute**: produces no violations.
- **Suppression**: an existing ignore directive applied to a line in an ERB template
  suppresses violations on that line, consistent with how suppression works for other files.
- **Mixed project**: running over a tree with `.tsx`, `.ts`, `.css`, and `.erb` files lints
  all of them in one pass with a single combined, correctly-attributed result.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The linter MUST discover and lint Ruby ERB template files (extensions `.erb`
  and `.html.erb`) when run over a project directory, in the same pass as existing file types.
- **FR-002**: For each ERB template, the linter MUST extract the static color-relevant class
  tokens from HTML `class` attributes and evaluate them with the existing color-token rule
  pipeline, producing the same kinds of violations it produces for JSX/TS `class`/`className`.
- **FR-003**: The linter MUST reuse the existing parser-agnostic token-checking logic without
  changing rule behavior — a given class token produces the same verdict whether it came from
  an ERB template or a JSX/TS file.
- **FR-004**: Every ERB-sourced violation MUST report file, line, rule name (kebab-case), and
  a message, in the identical shape used for all other rules (per the output contract).
- **FR-005**: The linter MUST treat ERB interpolation (`<% %>` / `<%= %>`) inside a class
  attribute as a boundary: only fully-static, whitespace-complete tokens are linted; fragments
  adjacent to an interpolation MUST NOT be evaluated as complete tokens.
- **FR-006**: A template that cannot be parsed MUST NOT abort the overall run; the linter MUST
  continue linting remaining files and surface the parse failure rather than crash.
- **FR-007**: Line numbers reported for ERB violations MUST point at the line of the offending
  class attribute in the source template.
- **FR-008**: The first cut is scoped to color-in-`class`-attribute linting only. The
  `no-style-color`, `no-component-color-override`, and `no-useless-hover` rules are NOT
  required to operate on ERB templates in this feature and MUST NOT produce spurious ERB output.
- **FR-009**: Existing linting of `.css`, `.ts`, `.tsx`, and `.jsx` files MUST be unchanged by
  this feature — no regression in violations, counts, messages, or exit codes for those files.

### Key Entities *(include if feature involves data)*

- **ERB template file**: a server-rendered HTML template (`.erb` / `.html.erb`) containing
  HTML elements, `class` attributes, and optional embedded Ruby interpolation. The unit of
  input for this feature.
- **Class token**: a single whitespace-delimited utility class extracted from a `class`
  attribute (e.g. `text-red-500`). The unit the color-token rules evaluate.
- **Violation**: an existing reported finding — file, line, rule name, message — now also
  emitted for ERB-sourced class tokens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Given a fixture set of ERB templates with a known list of non-semantic color
  usages, the linter reports 100% of those usages and 0 false positives on the accompanying
  semantic-token usages.
- **SC-002**: A class token that is a violation in a JSX/TS file produces an equivalent
  violation (same rule, same message) when it appears in an ERB template — verified by paired
  fixtures.
- **SC-003**: Interpolated/dynamic class segments produce 0 violations across the interpolation
  fixture set (no false positives on dynamic content).
- **SC-004**: Running the linter over the existing (non-ERB) demo fixture yields byte-identical
  output to before this feature — 0 regressions in existing behavior.
- **SC-005**: A malformed ERB template in a directory does not prevent the remaining files in
  that run from being linted (run completes, other files reported).

## Assumptions

- Target templates are Tailwind-styled ERB where UI color is expressed through utility classes
  in HTML `class` attributes — the same convention the color rules already assume for JSX/TS.
- Dynamic classes assembled through interpolation are a deliberate non-goal for v1, consistent
  with the existing static-only stance for JSX/TS (`cn()`/ternary class assembly is already
  out of scope).
- The inner color-token pipeline (`checkTailwindClasses` → `checkTailwindToken` → the seven
  token rules) is genuinely parser-agnostic and can be fed strings + line numbers unchanged;
  the research doc confirms this seam (`.scratch/wire-ruby-parser/research.md`).
- A published JavaScript/WASM binding of the herb parser is available and can be added as a
  dependency; the portable (no native compile) binding is preferred. Version is pinned because
  the parser is pre-1.0.
- `style="..."` attributes in ERB are plain strings (not JS object literals), so the
  JSX-shaped `no-style-color` rule does not transfer without new logic and is out of scope here.

## Dependencies

- A JavaScript-consumable build of the herb HTML+ERB parser (portable/WASM binding preferred),
  added as a pinned project dependency.
- The existing color-token rule pipeline and its fixtures/tests, reused unchanged.
