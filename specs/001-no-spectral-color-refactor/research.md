# Phase 0 Research — Refactor `no-spectral-color`

The spec carries no `[NEEDS CLARIFICATION]` markers. The stack, test framework, and
seam are all known from the codebase. One genuine design decision needed resolving.

## Decision 1 — How the rule gets the matched palette name + shade for the hint

**Context**: The classifier's `classifyColorPart` returns a string verdict
(`"spectral" | "semantic" | ...`). The `"spectral"` verdict is a yes/no gate — it does
**not** carry *which* palette name matched (`green`) or *which* shade (`500`). But the
rule's replacement hint (`findReplacement(prefix, name, shade)`) needs both. So pure
verdict-delegation (as `no-var-color` does — it needs no extra data) is insufficient here.

**Decision**: Extract the palette scan currently inlined in `classifyColorPart` into a
single exported helper:

```
findSpectralMatch(colorPart, spectralSet) → { name, shade } | null
```

- `classifyColorPart` calls it internally: `if (findSpectralMatch(colorPart, tokens.spectralSet)) return "spectral"`.
- The rule **gates** on the classifier verdict (`classifyParts(parts, tokens) !== "spectral"` → skip), mirroring `no-var-color` / `no-raw-css-color`.
- On the violation path only, the rule calls `findSpectralMatch(parts.colorPart, tokens.spectralSet)` to get `{ name, shade }` for the hint lookup.

**Rationale**:
- Single-sources the scan — the palette-name-plus-shade logic lives in exactly one place (`classify.js`), satisfying spec FR-003. The rule's private `for` loop is deleted.
- Keeps the classifier's verdict signature untouched (a boolean-ish enum, per the parse-parity PRD's locked shape) — no ripple to sibling rules or the classifier's other callers.
- Keeps all three color-verdict rules the same shape (`classify → act on verdict`), satisfying SC-005.
- The helper has two real callers on introduction (classifier + rule), clearing the constitution's YAGNI "second caller" bar.

**Alternatives considered**:
- *Enrich the verdict* (return `{ verdict, name, shade }`): rejected — changes a signature consumed by other rules and the classifier's own tests; blast radius far exceeds the win.
- *Rule keeps its own scan for the hint only*: rejected — reintroduces the very duplication the refactor removes (two copies of "spectral name + shade" logic).
- *Rule gates on `findSpectralMatch` directly, skipping `classifyParts`*: rejected — breaks symmetry with the sibling rules (spec FR-002 mandates gating on the classifier verdict) and would miss any future centralization of the verdict decision.

**Accepted cost**: On a violation, the scan runs twice (once inside the classifier gate,
once for hint data). This is violation-path-only, linear in a single token's segments, and
never touches clean tokens — negligible under Constitution IV. Not worth threading match
data through the verdict to avoid.

## Non-decisions (already settled by spec / codebase)

- **Replacement-hint logic stays in the rule** — presentation, not color vocabulary (spec Assumption). `findReplacement` and its range parsing are untouched.
- **Detection narrows to "behind a color prefix"** — `composeColorParts` only yields a
  `colorPart` when a color prefix matched, so a spectral name in a prefix-less base no
  longer fires. Intended (spec Assumption; Constitution IV). No existing test depends on
  the removed path — verified against `no-spectral-color.test.ts`.
- **No output/contract change** — message string, `name`, `id`, `checkToken` signature all
  preserved, so no version bump (Constitution III).
