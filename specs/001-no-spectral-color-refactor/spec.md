# Feature Specification: Refactor `no-spectral-color` onto the shared classifier

**Feature Branch**: `ym/explore`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "I want to refactor the \"no-spectral-color\" rule. Test cases and purpose can be found at lint-color/rules/no-spectral-color.test.ts."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One source of truth for what "spectral" means (Priority: P1)

A rule author reads `no-spectral-color` and finds that whether a class is a spectral (palette) color is decided by the shared classification layer — the same layer that already decides `spectral`, `semantic`, `static`, `raw`, and `var` for every other color rule. The rule no longer carries its own copy of the palette-name-plus-shade scan.

**Why this priority**: This is the whole point of the refactor. The classification layer already owns the color vocabulary and already returns a `spectral` verdict; the rule duplicating that scan is the defect being removed. Sibling rules (`no-var-color`, `no-raw-css-color`) already consume the classifier — this rule is the last holdout. If only this ships, the codebase is more consistent and the duplication is gone.

**Independent Test**: Read the rule module; confirm the spectral decision is delegated to the shared classifier and no palette-scan loop remains in the rule. Run the existing rule test suite and confirm every case still passes with no assertion changes.

**Acceptance Scenarios**:

1. **Given** the shared classifier returns the `spectral` verdict for a class part, **When** the rule inspects that token, **Then** the rule reports a violation.
2. **Given** the shared classifier returns any non-`spectral` verdict (`semantic`, `static`, `raw`, `var`, or none), **When** the rule inspects that token, **Then** the rule reports nothing.
3. **Given** the full existing `no-spectral-color` test suite, **When** it runs against the refactored rule, **Then** every test passes unchanged.

---

### User Story 2 - Replacement hints keep working (Priority: P1)

A design-system maintainer configures a replacement map (e.g. `text-green-400...600 → success-content`, `bg-green-500 → success`). When app code uses a spectral class that falls inside a configured range, the violation message names the semantic token to switch to; when it falls outside every range, or the prefix has no configured entry, the message reports the violation with no hint.

**Why this priority**: The replacement-hint behavior is the rule's distinctive value beyond simple detection and is exercised directly by the test suite. It must survive the refactor byte-for-byte in observable behavior.

**Independent Test**: With the sample replacement config, lint `text-green-400`, `text-green-600`, and `bg-green-500` and confirm each message contains both the offending class and its mapped token; lint `bg-blue-500` (no mapping) and confirm the message contains no hint text.

**Acceptance Scenarios**:

1. **Given** a replacement entry whose range covers the class's shade, **When** the class is flagged, **Then** the message names the mapped semantic utility.
2. **Given** a class whose shade is outside every configured range for its prefix, **When** the class is flagged, **Then** the message names no replacement.
3. **Given** a prefix with no replacement entry at all, **When** a class with that prefix is flagged, **Then** the message names no replacement.

---

### User Story 3 - Detection and suppression behavior is preserved (Priority: P2)

An app developer sees the same violations after the refactor as before it: spectral classes behind any color prefix are flagged (including compound prefixes like `ring-offset-` and multi-segment bases like `divide-…`), palette names without a shade are allowed, non-color utilities that merely share a prefix are allowed, and a `color-lint-ignore` line stays silent.

**Why this priority**: Preserving observable behavior is the contract of a refactor. It is P2 only because Stories 1 and 2 already assert the core mechanics; this story pins the remaining boundary and suppression cases.

**Independent Test**: Run the linter over the demo-app fixture before and after the change and confirm the spectral-color violation set is identical.

**Acceptance Scenarios**:

1. **Given** `ring-offset-blue-200`, **When** linted, **Then** one violation naming that class is reported.
2. **Given** `text-red` (name, no shade) or `text-sm` / `bg-cover` (non-color utility sharing a color prefix), **When** linted, **Then** no violation is reported.
3. **Given** a spectral class on a line carrying a `color-lint-ignore` comment, **When** linted, **Then** no violation is reported.

---

### Edge Cases

- **Palette name without a shade** (`text-red`): not a spectral color; no violation.
- **Non-color utility sharing a color prefix** (`text-sm`, `bg-cover`): not a color at all; no violation.
- **Compound / multi-segment prefixes** (`ring-offset-blue-200`, `divide-green-100`): the color part is classified after the longest color prefix is removed, so the palette name is still found.
- **Shade outside all replacement ranges** (`bg-green-700`) or **prefix absent from the replacement map** (`border-green-500`): still a violation, but with no hint appended.
- **Spectral name not behind a color prefix**: the shared classifier only receives a color part when a color prefix is present, so such a token yields no color part and no violation. This matches the domain rule that rules only inspect classes behind a color prefix (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The rule MUST determine whether a token is a spectral color by consuming the shared classification layer's verdict, not by re-scanning the token's segments itself.
- **FR-002**: The rule MUST report a violation when, and only when, the shared classifier returns the `spectral` verdict for the token.
- **FR-003**: The rule MUST NOT contain any independent copy of palette-name-plus-shade detection logic once the refactor is complete.
- **FR-004**: The rule MUST continue to append a replacement hint naming the mapped semantic token when the offending class's prefix, palette name, and shade match a configured replacement entry (single shade or range).
- **FR-005**: The rule MUST omit the replacement hint when the prefix has no replacement entry, or the shade falls outside every configured range for that prefix, while still reporting the violation.
- **FR-006**: The violation message MUST continue to include the offending class text and MUST NOT change its wording, coloring, or structure for cases already covered by the test suite.
- **FR-007**: The refactor MUST NOT change the rule's public surface — its `name`, numeric `id`, and `checkToken` signature — so the linter pipeline and configuration keep working unchanged.
- **FR-008**: All existing `no-spectral-color` tests MUST pass without modification, and the demo-app spectral-violation set MUST be unchanged.

### Key Entities *(include if feature involves data)*

- **Spectral verdict**: the `spectral` result the shared classifier returns for a Tailwind palette color part (a palette name followed by a numeric shade). The rule's single input signal for whether to fire.
- **Color part**: the base of a class with its color prefix removed (e.g. `blue-200` from `ring-offset-blue-200`); what the classifier evaluates.
- **Replacement map**: the configured mapping from `prefix` → list of `{ "name-shadeOrRange": semanticToken }` entries used to derive the message hint.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the existing `no-spectral-color` test cases pass with zero edits to the test file.
- **SC-002**: The rule module contains zero independent palette-scan loops after the change (the spectral decision comes entirely from the shared classifier).
- **SC-003**: The demo-app fixture produces an identical set of spectral-color violations before and after the change (zero net delta).
- **SC-004**: `pnpm typecheck` passes with zero errors.
- **SC-005**: A reader comparing `no-spectral-color` against `no-var-color` and `no-raw-css-color` finds all three follow the same "classify, then act on the verdict" shape.

## Assumptions

- The shared classification layer already exposes a `spectral` verdict and is the intended single source of truth for the color vocabulary (confirmed by the classifier and by the two sibling rules that already consume it).
- Narrowing detection to "only classes behind a color prefix" is acceptable and desired. The current hand-rolled scan can in principle fire on a spectral name in a base with no color prefix; delegating to the classifier removes that path, which aligns with the domain rule that rules only inspect classes behind a color prefix. No existing test depends on the removed path.
- The replacement-hint logic (range parsing and prefix lookup) remains inside the rule; it is rule-specific presentation, not part of the shared color vocabulary, so it is out of scope for the classifier.
- This is a behavior-preserving refactor: no new detections, no new configuration surface, and no message-wording changes beyond what existing tests already assert.
