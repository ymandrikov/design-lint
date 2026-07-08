# Feature Specification: Structured Lint Output

**Feature Branch**: `015-structured-lint-output`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "structured output for design-lint runs" — refined through a grilling session that resolved format, selection mechanism, payload shape, exit-code contract, and human-report improvements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Machine-readable run results (Priority: P1)

An agent or script runs the linter against a target codebase and receives the complete run result as a single machine-readable document: every violation, every suppressed line, every run diagnostic, and summary counts. It never scrapes prose or diagnostic text to learn what happened.

**Why this priority**: This is the core ask. Runs are already being piped to text files and fed to tooling; today that tooling must parse human-oriented prose. A machine format unlocks automated gating, fix queues, and run-over-run comparison.

**Independent Test**: Run the linter with machine output requested against the demo fixture; parse the output as a document and read the violation count, per-file violation lists, and suppression list without any text scraping.

**Acceptance Scenarios**:

1. **Given** a target with violations, **When** the linter runs with machine output requested, **Then** standard output contains exactly one well-formed document and nothing else, and the document lists every violation with its file, line, rule name, and message.
2. **Given** a target with suppressed lines and template parse warnings, **When** the linter runs with machine output requested, **Then** the document includes the suppressions, the warnings, and summary counts — the full truth of the run in one place.
3. **Given** a clean target, **When** the linter runs with machine output requested, **Then** the document is still emitted, with zero violations and accurate counts.
4. **Given** the same target state, **When** the linter runs twice with machine output requested, **Then** both outputs are byte-identical (violations ordered by file, then line, then rule).
5. **Given** no output format is requested, **When** the linter runs, **Then** the existing human-readable report is produced (default unchanged).

---

### User Story 2 - Run outcome distinguishable by exit code (Priority: P2)

A CI pipeline or wrapping script tells apart "the code has violations" from "the lint run itself failed" (bad configuration, missing configured directory) using the exit code alone, without parsing any output.

**Why this priority**: Gating decisions differ — violations block a merge; a broken run pages whoever owns the lint setup. Today both exit identically, so automation cannot route the failure.

**Independent Test**: Run the linter three ways — clean target, target with violations, target with a nonexistent configured source directory — and observe three distinct exit codes.

**Acceptance Scenarios**:

1. **Given** a clean target and valid configuration, **When** the linter runs, **Then** it exits 0.
2. **Given** a target with violations, **When** the linter runs, **Then** it exits 1.
3. **Given** a run-level failure (malformed source-directory configuration, a configured directory that does not exist, or an unrecognized output-format value), **When** the linter runs, **Then** it exits 2 — even when everything that could be scanned was clean.

---

### User Story 3 - Human report opens with a summary (Priority: P3)

A developer running the linter in a terminal sees, before the detail listing, a summary: total violations, number of files affected, and a per-rule count table — so a 500-violation run communicates its shape at a glance instead of burying it under pages of detail.

**Why this priority**: Real runs today produce ~500 findings; the shape of the problem (which rules dominate) is currently only discoverable by scrolling to per-rule headers scattered through the dump.

**Independent Test**: Run the linter in human mode against the demo fixture; verify the first lines show total count, affected-file count, and per-rule counts matching the detail listing below.

**Acceptance Scenarios**:

1. **Given** a target with violations across multiple rules, **When** the linter runs in human mode, **Then** the report begins with the total violation count, the count of affected files, and one line per triggered rule with its count, followed by the existing rule-grouped detail listing.
2. **Given** a clean target, **When** the linter runs in human mode, **Then** the existing "no violations" message is shown (no summary table).

---

### Edge Cases

- Clean run with a missing configured source directory: machine document still emitted with the missing directory recorded; exit code reports run failure (2), not success.
- Unrecognized output-format value: run error with a clear message naming the accepted values; exits 2.
- Machine mode with template parse warnings: warnings appear in the document *and* are mirrored to the diagnostic stream so humans watching CI logs still see them; standard output stays a single well-formed document.
- Zero violations but suppressions present: suppressions and their count appear in the machine document; human mode keeps its existing suppression summary line.
- Machine output must not vary with terminal capabilities — no styling or color codes ever appear in the document.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The linter MUST accept an output-format option with values `human` (default) and `json`; the existing positional target-root argument keeps working unchanged.
- **FR-002**: In JSON mode, standard output MUST carry exactly one well-formed JSON document and nothing else; all diagnostics go to the error stream.
- **FR-003**: The JSON document MUST be a full run record containing: summary counts (violations, suppressions), the violations list, the suppressions list (file + line), run warnings (e.g. template parse notes), and any configured-but-missing source directories.
- **FR-004**: Each violation in the JSON document MUST carry exactly: file (target-root-relative path), line, rule (kebab-case rule name matching the configuration keys), and message. No numeric rule ids are exposed.
- **FR-005**: Violations in the JSON document MUST be sorted by file, then line, then rule, so identical target states yield byte-identical output.
- **FR-006**: Exit codes MUST follow: 0 = clean run, 1 = violations found, 2 = run error (invalid configuration, missing configured directory, unrecognized format value). A clean scan with a missing configured directory exits 2.
- **FR-007**: The human report MUST open with a summary — total violations, affected-file count, and per-rule counts — before the existing rule-grouped detail listing; the clean-run message stays as-is.
- **FR-008**: Template parse warnings MUST be captured as part of the run result (not emitted as a side effect during linting) so both output modes can report them; human mode keeps surfacing them on the error stream.
- **FR-009**: Human and JSON output for the same run MUST agree on every count and every violation — one run, two renderings.
- **FR-010**: An unrecognized output-format value MUST fail the run with a message naming the accepted values.

### Key Entities

- **Run record**: The complete result of one lint run — summary counts, violations, suppressions, warnings, missing source directories. Single source both renderings draw from.
- **Violation**: One finding — file, line, rule name, message. Shape identical in both renderings (constitution III already mandates this reporting shape).
- **Suppression**: A source line excluded via the suppression directive — file and line, counted in the summary.
- **Run diagnostic**: A non-violation problem with the run itself — a template parse warning or a missing configured directory.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A script consumer extracts the total violation count and a per-file violation list from a run's machine output with zero prose parsing.
- **SC-002**: Two runs over an identical target tree produce byte-identical machine output — diffable run-over-run with standard text tools.
- **SC-003**: Automation distinguishes "violations found" from "run failed" from "clean" using the exit code alone, with no output parsing.
- **SC-004**: A developer reading the human report states the total violation count and the dominant rule within the first screenful of output.
- **SC-005**: For any given run, every count and every violation in the human report matches the machine document exactly.

## Assumptions

- Primary machine consumers are agents and CI scripts; editor/LSP integration and SARIF are out of scope for this feature (SARIF can be layered on the machine format later).
- The violation payload stays file/line/rule/message — no offending-token field, no column/span data. Enriching the payload is a future additive change once an auto-fixer needs it.
- No format-version field in the document for now (explicitly declined during requirements review); a future breaking shape change will introduce one.
- No files-scanned count in the summary (explicitly declined during requirements review).
- The exit-code change (missing-directory-but-clean moves from 1 to 2) is a public-contract change per constitution quality gates: it ships with a version bump and a migration note.
- A convenience script for running the demo fixture in JSON mode ships alongside the feature.
- Machine format choice (single JSON document, not line-delimited or SARIF), flag mechanism, rule-name identity, sort order, and exit-code convention were all resolved with the requester in the preceding grilling session — no open decisions remain.
