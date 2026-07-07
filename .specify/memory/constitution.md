<!--
Sync Impact Report
==================
Version change: (template, unversioned) → 1.0.0
Bump rationale: Initial ratification. First concrete constitution replacing the
  placeholder template — MAJOR baseline established.

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Code Quality & Simplicity
  - [PRINCIPLE_2_NAME] → II. Testing Standards (NON-NEGOTIABLE)
  - [PRINCIPLE_3_NAME] → III. User Experience Consistency
  - [PRINCIPLE_4_NAME] → IV. Performance Requirements
  - [PRINCIPLE_5_NAME] → (removed; user requested four focused principles)

Added sections:
  - Quality Gates (was [SECTION_2_NAME])
  - Development Workflow (was [SECTION_3_NAME])

Removed sections:
  - Fifth core principle slot (template had 5; scope is 4)

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check gate references the
    constitution file generically; no hardcoded principle names, stays aligned.
  - ✅ .specify/templates/spec-template.md — no constitution references; no change.
  - ✅ .specify/templates/tasks-template.md — no constitution references; no change.

Follow-up TODOs: none. Ratification date set to first-adoption date.
-->

# Design Lint Constitution

## Core Principles

### I. Code Quality & Simplicity

Every change MUST leave the codebase readable by the next agent or human with no
extra context. Rules:

- Each rule module is single-concern — one check over source, named in kebab-case,
  matching the domain vocabulary in `CONTEXT.md`. No rule may bundle unrelated checks.
- New code MUST match the idiom, naming, and comment density of the code around it.
  Comments explain *why*, never restate *what* the code does.
- `pnpm typecheck` MUST pass with zero errors before any change is considered done.
  TypeScript types are the primary contract; `any` requires an inline justification.
- Complexity MUST be justified. Prefer deleting code over adding it; prefer a plain
  function over an abstraction until a second caller exists (YAGNI).
- Vendored parsing logic (e.g. Tailwind parse-parity) MUST cite its upstream source
  and note the parity it preserves, so drift is auditable.

Rationale: A linter is only trusted if its own source is exemplary. Single-concern
rules and honest types keep the rule surface navigable as domains beyond color are added.

### II. Testing Standards (NON-NEGOTIABLE)

Behavior is defined by tests, not by intention. Rules:

- Every rule and every bug fix MUST ship with tests. New behavior without a failing
  test that it turns green is not accepted.
- End-to-end tests over realistic fixtures (`fixtures/demo-app`, `tests/e2e.test.ts`)
  are the source of truth for linter output — they MUST assert the exact violations,
  messages, and counts a run produces, not just pass/fail.
- `pnpm test` MUST be green before merge. A skipped or `.only` test blocks merge.
- Parity-critical logic MUST be pinned by before/after fixtures so regressions in
  Tailwind candidate parsing are caught, not discovered in the field.
- Tests MUST be deterministic — no reliance on wall-clock, network, or ordering of
  filesystem reads.

Rationale: A linter that miscounts or misreports silently erodes all trust in it.
Exact-output tests are the only defense against quiet drift.

### III. User Experience Consistency

The linter's UX is its output contract. Rules:

- Every violation MUST report file, line, rule name (kebab-case), and a message —
  in that shape, for every rule. No rule invents its own reporting format.
- Messages name the fix in the project's vocabulary (e.g. "use a semantic token"),
  never just the offense. Terminology MUST match `CONTEXT.md`; forbidden synonyms
  listed there MUST NOT appear in output.
- Exit codes are stable and documented: clean source exits 0, violations exit
  non-zero. Suppressions are counted and surfaced in the summary — never silent.
- CLI flags, config keys (e.g. `colorTokenFiles`), and suppression directives
  (`color-lint-ignore`) are a public contract; changing them is a breaking change
  requiring a version bump and a migration note.
- Both human-readable and machine-readable (structured) output MUST stay consistent
  for the same run.

Rationale: Developers act on linter output dozens of times a day. Predictable,
consistent, vocabulary-accurate reporting is what makes the tool usable rather than noise.

### IV. Performance Requirements

The linter MUST be fast enough to run on every save and in CI without friction. Rules:

- Linting scales linearly with the number of files and classes inspected; no rule may
  introduce super-linear blowup over a file's candidates.
- Parsing and Tailwind candidate compilation MUST be done once per input and reused
  across rules — rules inspect shared parsed structures, they do not re-parse source.
- Only classes behind a color prefix (and other in-scope constructs) are inspected;
  rules MUST short-circuit on out-of-scope input rather than analyze everything.
- Any change that regresses runtime on the demo fixture MUST be measured and justified;
  performance is a feature, not an afterthought.
- No unbounded memory growth — parsed artifacts for a file are released once its rules
  have run.

Rationale: A linter that is slow gets disabled. Running cleanly on every save and in
CI is a hard requirement, so per-file cost and shared parsing are first-class concerns.

## Quality Gates

Every change MUST clear these gates before it is considered complete:

- `pnpm typecheck` — zero errors.
- `pnpm test` — all tests green, no skipped or `.only` tests.
- `pnpm lint:demo` — the demo fixture produces the expected, reviewed output.
- New behavior is covered by a test that fails without the change.
- Public contract changes (CLI flags, config keys, rule names, exit codes,
  suppression syntax) carry a version bump and a migration note.

Gates are non-negotiable. A change that cannot clear a gate is not merged; the gate
is not weakened to fit the change.

## Development Workflow

- Issues and PRDs live as local markdown under `.scratch/<feature-slug>/`, each
  carrying a `Status:` triage line. External PRs are not a triage surface.
- Domain terminology is single-sourced in `CONTEXT.md`; architectural decisions in
  `docs/adr/`. Code, tests, and output MUST use that vocabulary.
- Reviews MUST verify compliance with the four core principles. A reviewer citing a
  principle violation blocks merge until resolved or the principle is formally amended.
- Commit or push only when the human asks; branch off `main` for feature work.

## Governance

This constitution supersedes ad-hoc practice. When guidance conflicts, the
constitution wins.

- **Amendments** require a written rationale, an updated version per the policy below,
  and propagation to dependent templates (`plan`, `spec`, `tasks`) in the same change.
- **Versioning policy** (semantic):
  - MAJOR — a principle is removed or redefined in a backward-incompatible way.
  - MINOR — a principle or section is added, or guidance is materially expanded.
  - PATCH — clarifications, wording, and non-semantic refinements.
- **Compliance review** — every PR and review verifies adherence to the core
  principles and quality gates. Complexity that appears to violate a principle MUST be
  justified in writing or removed.
- Runtime development guidance for agents lives in `CLAUDE.md` and `docs/agents/`;
  it MUST stay consistent with this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-07-07 | **Last Amended**: 2026-07-07
