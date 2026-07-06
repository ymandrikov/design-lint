# 01 — Capture demo-app lint baseline

Status: done
Type: task

## Parent

`.scratch/phase-a-token-splitter/PRD.md`

## What to build

The drift-gate precondition. On unchanged code, run the end-to-end demo lint and save its full output into this feature directory as the baseline artifact (`baseline-demo.txt`). Later slices diff against it to prove that only the targeted trigger cases change.

Verify the output is deterministic (run twice, identical) so later diffs are trustworthy; note any nondeterminism (ordering, ANSI when non-TTY) in a comment on this issue instead of "fixing" it here.

## Acceptance criteria

- [x] Baseline file exists in the feature directory containing the demo lint output from unmodified code
- [x] Two consecutive runs produce byte-identical output (or deviations documented in a comment)
- [x] No source code changed

## Blocked by

None - can start immediately.

## Comments

**2026-07-06 — baseline captured.** Artifact: `.scratch/phase-a-token-splitter/baseline-demo.txt` (34 lines, 1936 bytes).

- Command: `node lint-color/index.js fixtures/demo-app` (= `pnpm lint:demo`). Exit code 1 (linter reports violations found; expected, not an error).
- **Determinism confirmed:** ran twice, `diff` reports byte-identical. Order is stable (rules emitted in fixed registration order; per-rule findings in file-walk order).
- **ANSI:** none. Output is plain text when stdout is non-TTY (redirected to file / piped), so the baseline has no escape codes to strip. A future diff run must also be non-TTY (redirect to file) to match.
- **Working-tree note:** `lint-color/index.js` + `design-system/lint/colors.json` carry pre-existing (pre-Phase-A) infra mods — the `target-root` arg that lets the linter point at `fixtures/demo-app`, plus a whitespace-only change. These are the starting point Phase A diffs against, not Phase A logic. No source changed by this task.
