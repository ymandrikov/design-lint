# Feature Specification: Namespace-Aware Color Classification

**Feature Branch**: `014-namespace-color-classify`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "mirror Tailwind: a class is a color reference only if its value resolves under --color-*/--*-color-*, not under --text-*/--shadow-*/--border-width. Needs the linter to know the size namespaces. Matches Tailwind semantics exactly, no false positives on future scales."

## Context

The linter today decides whether a class is a **color class** by its **color prefix** alone — `text`, `bg`, `border`, `ring`, `shadow`, etc. But Tailwind overloads those prefixes: the same prefix carries a color *or* a non-color scale. `text-red-500` is a color; `text-sm` is a font size. `shadow-lg` is a shadow size; `shadow-danger` is a shadow color. `border-2` is a width; `border-danger` is a color.

Because the linter treats every prefixed class as a color reference, non-color utilities are misread: their scale value (`sm`, `lg`, `2`) is checked as if it were a semantic token, and the class is reported as a bad token, a token-constraint violation, or an undefined token. On the `solaris` target this produces ~1946 false findings (e.g. 678 × `text-base`, 572 × `text-sm`, 543 × `text-xs`), roughly 43% of all output — enough noise to erode trust in the tool.

Tailwind never guesses from the class name. It **resolves the value against theme namespaces**: a synthesized custom-property name (`--color-sm`, `--text-sm`) is looked up, and the first namespace that has it wins, in a fixed per-prefix order. A class is a color only when its value resolves under a color namespace (`--color-*` or the prefix's dedicated `--*-color-*`). This feature makes the linter classify the same way.

## Clarifications

### Session 2026-07-08

- Q: Is a color-prefix class whose value resolves under no namespace at all (e.g. a typo like `text-accnt`) still a color violation? → A: Yes — a class is a color reference if its value resolves under a color namespace OR under no namespace; only values resolving under a *known non-color* namespace (font-size, box-shadow size, width, background image) are dropped. This preserves the undefined-token rule's job of catching typo'd / undefined token names while removing the non-color-scale false positives.
- Q: Which overloaded prefixes must the feature cover? → A: All of them, via one general namespace-resolution mechanism (not a per-prefix hardcode). Any prefix that reads both a color and a non-color namespace is disambiguated by resolution, so `outline`, `decoration`, `stroke`, gradient stops (`from`/`via`/`to`), `inset-shadow`, `drop-shadow`, `text-shadow` are covered by the same code path as `text`/`shadow`/`border`/`ring`/`divide`/`bg`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Non-color utilities are not flagged as color problems (Priority: P1)

A developer runs the linter over a real Tailwind codebase that mixes color classes (`bg-accent`) with size and width utilities (`text-sm`, `text-base`, `shadow-lg`, `border-2`). The developer expects findings only about color. Today they get hundreds of findings about `sm`, `base`, `lg`, `2` "not being defined tokens."

**Why this priority**: This is the defect. Eliminating the ~43% false-positive volume is the entire point — without it the linter output is unusable on any codebase that uses font-size, shadow-size, or border-width utilities (i.e. every real one).

**Independent Test**: Lint a fixture containing `text-sm`, `text-base`, `text-lg`, `shadow-lg`, `border-2`, `ring-2`, `divide-y-2` and assert zero color violations are reported for those classes.

**Acceptance Scenarios**:

1. **Given** a source file with `class="text-sm"`, **When** the linter runs, **Then** no color violation is reported for it (the value resolves as a font size, not a color).
2. **Given** a source file with `class="shadow-lg"`, **When** the linter runs, **Then** no color violation is reported (resolves as a box-shadow size).
3. **Given** a source file with `class="border-2 ring-2 divide-y-2"`, **When** the linter runs, **Then** none of the three is reported (each resolves as a width).
4. **Given** a source file with `class="text-base"`, **When** the linter runs, **Then** no token-constraint violation is reported (`base` is a font size, not a mis-scoped color token).

---

### User Story 2 - Genuine color references are still caught (Priority: P1)

A developer relies on the linter to catch spectral colors (`text-red-500`), token-constraint breaks (`text-danger` where `text-` forbids `danger`), opacity modifiers (`bg-accent/50`), and references to colors that are not semantic tokens (`bg-black`, `text-white`). None of these may be silenced by the new classification.

**Why this priority**: A false-positive fix that also drops true positives is a regression, not a fix. Preserving every genuine color finding is co-equal with removing the noise.

**Independent Test**: Lint a fixture of known color violations and assert the exact same violations, messages, and counts as before this change.

**Acceptance Scenarios**:

1. **Given** `class="text-red-500"`, **When** the linter runs, **Then** it is still reported as a spectral color (`red-500` resolves under a color namespace).
2. **Given** `class="text-danger"` under token constraints that forbid `danger` behind `text-`, **When** the linter runs, **Then** the token-constraint violation is still reported.
3. **Given** `class="bg-accent/50"`, **When** the linter runs, **Then** the opacity-modifier violation is still reported.
4. **Given** `class="bg-black"` where `black` is a color but not a semantic token in the target, **When** the linter runs, **Then** it is still reported (it resolves under a color namespace, so it is in scope).

---

### User Story 3 - New scale values need no linter change (Priority: P2)

Tailwind (or the target's design system) adds a new font size, shadow size, or width step — e.g. a `text-4xl` or a new `shadow-3xl`. The developer upgrades and re-lints. No new false positives appear, and no linter code had to change.

**Why this priority**: A hardcoded list of "known size suffixes" would rot: every new scale value Tailwind ships would reintroduce the bug until someone patched the list. Classifying by namespace resolution (does it resolve under a color namespace?) is forward-compatible by construction. This is the durability guarantee that separates a real fix from a patch.

**Independent Test**: Add a size value to the fixture's design system that the linter has never seen, use it behind an overloaded prefix, and assert zero color violations without editing linter source.

**Acceptance Scenarios**:

1. **Given** the target defines a new font size the linter has no prior knowledge of, and a class uses it behind `text-`, **When** the linter runs, **Then** no color violation is reported and no linter code changed.
2. **Given** a new shadow size behind `shadow-`, **When** the linter runs, **Then** no color violation is reported.

---

### Edge Cases

- **Same value in two namespaces (collision)**: A value defined both as a color and as a size (e.g. a token `sm` that is both `--color-sm` and `--text-sm`). Classification MUST resolve it the way Tailwind does — following the prefix's namespace priority order (color-first for `text`/`bg`/`border`/`ring`; size-first for `shadow`) — so the linter and Tailwind never disagree about what a class means.
- **Value in no namespace (truly unknown)**: A value that resolves under neither a color nor a known non-color namespace (`text-blahblah`) — Tailwind would discard the class as invalid. The linter MUST treat it under existing candidate handling (an undefined color reference is still flaggable; a string Tailwind discards outright is not inspected), unchanged by this feature.
- **Bare prefix**: A prefix with no value (`border`, `ring`, `divide`) means width in Tailwind, never color. It MUST NOT be treated as a color reference.
- **Arbitrary values**: `text-[14px]` (a length) vs `text-[#123]` / `bg-[var(--x)]` (a color). Classification of arbitrary values MUST match their resolved type — length/size out of scope, color in scope (raw-color and css-variable-reference rules still apply to the color ones).
- **Non-overloaded color prefixes**: Prefixes that are always color (`fill`, `caret`, `accent`, `placeholder`) keep current behavior — every value behind them is a color reference.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The linter MUST classify a prefixed class as a **color reference** when its value resolves under a color namespace — the shared color palette (`--color-*`) or the prefix's dedicated color namespace (`--*-color-*`, e.g. `--text-color-*`, `--border-color-*`) — OR resolves under no known namespace at all (e.g. a typo'd token name). A class is NOT a color reference only when its value resolves under a known **non-color** namespace.
- **FR-002**: The linter MUST cover **every** prefix overloaded between color and a non-color scale through one general namespace-resolution mechanism — not a per-prefix hardcoded list. Any prefix that reads both a color and a non-color namespace is disambiguated the same way, so classes resolving under the non-color namespace are out of scope for all color rules. The full set includes at least: `text-` → font size, `shadow-`/`inset-shadow-`/`drop-shadow-`/`text-shadow-` → shadow size, `border-`/`ring-`/`divide-`/`outline-`/`stroke-` → width, `bg-` → background image, `decoration-` → thickness, `from-`/`via-`/`to-` → gradient-stop position.
- **FR-003**: No color rule (spectral-color, token-constraints, undefined-token, opacity-modifier, raw-color, css-variable-reference) may emit a violation for a class the linter classifies as NOT a color reference.
- **FR-004**: The linter MUST continue to report every genuine color reference exactly as before — spectral palette colors, semantic-token uses subject to token constraints, opacity modifiers, and color values that are not defined semantic tokens. This feature removes false positives only; it changes no true positive.
- **FR-005**: When a value could resolve under both a color and a non-color namespace, classification MUST follow Tailwind's per-prefix namespace priority order, so the linter's notion of "color class" always matches what Tailwind actually compiles.
- **FR-006**: The set of recognized color and non-color namespaces MUST be derived from Tailwind's namespace model and the target's design system — NOT a hardcoded list of value suffixes. A scale value the linter has never seen before MUST be classified correctly with no linter code change.
- **FR-007**: A value that resolves under no known namespace (color or non-color) MUST still be treated as a color reference, so the undefined-token rule continues to flag typo'd or undefined token names (e.g. `text-accnt`). Only a value resolving under a known non-color namespace removes a class from color-rule scope. Strings Tailwind would discard outright for reasons unrelated to namespace resolution (malformed syntax, double modifier) remain out of scope per existing candidate handling.
- **FR-008**: Classification MUST reuse the already-parsed candidate for each class; it MUST NOT re-parse source or add a super-linear pass over a file's candidates.
- **FR-009**: The classification behavior MUST be pinned by before/after fixtures that assert the exact set of violations for a corpus mixing color and non-color utilities, so the parity is regression-tested.

### Key Entities

- **Namespace**: A category a class value resolves into, identified by a custom-property prefix. Split into **color namespaces** (`--color-*`, `--*-color-*`) and **non-color namespaces** (font size `--text-*`, box-shadow size `--shadow-*`, width `--*-width`, background image `--background-image`, …). Resolution is existence-lookup of a synthesized property name, tried in a fixed per-prefix order.
- **Color reference**: A class whose value resolves under a color namespace — the only classes the color rules inspect. Replaces the current, looser "any class behind a color prefix."
- **Overloaded prefix**: A color prefix that also carries a non-color scale (`text`, `bg`, `border`, `ring`, `shadow`, `divide`). Disambiguated by namespace resolution rather than by the prefix name.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the `solaris` target, the ~1268 findings caused by non-color utilities that resolve to a non-color namespace (`text-sm`, `text-xs`, `text-lg`, `text-xl`, `shadow-*`) drop to zero.
- **SC-002**: On the same target, every genuine finding is preserved — all 496 opacity-modifier findings and all real spectral / token-constraint / undefined-color findings remain, with identical messages and counts. This explicitly includes the 678 `text-base` findings: the target defines `--color-base`, and Tailwind resolves `text-` color-first, so `text-base` compiles to `color: var(--color-base)` — a genuine color reference the `token-constraints` rule correctly reports, not a false positive.
- **SC-003**: Introducing a scale value the linter has never seen (a new font size, shadow size, or width step) behind an overloaded prefix produces zero color violations with no change to linter source.
- **SC-004**: The change adds no measurable per-file runtime regression on the demo fixture — classification reuses existing parsed candidates and stays linear in the number of candidates.
- **SC-005**: A before/after fixture over a mixed color + non-color corpus asserts the exact expected violation set and stays green, so any future regression in classification is caught by tests, not in the field.

## Assumptions

- The linter already compiles each class to a Tailwind candidate (the vendored Tailwind parse-parity logic), so the resolved CSS property / namespace of a class is available without new parsing infrastructure; this feature consumes that resolution rather than reinventing it.
- Tailwind's namespace priority per prefix is authoritative and is mirrored: color-first for `text`/`bg`/`border`/`ring`/`outline`/`decoration`, size-first for `shadow`; `divide` is split into color (`divide-`) and width (`divide-x`/`divide-y`) roots.
- The target's design system (its color token files plus Tailwind defaults) is the source of which values exist in which namespace; the linter does not invent tokens.
- Scope is the color domain only. Non-color rules for future domains (spacing, typography) are out of scope and unaffected.
- The `--color-*` and `--*-color-*` split, and the non-color namespaces named in FR-002, follow Tailwind v4 semantics as validated against the vendored upstream (`.repos/tailwindcss`).
