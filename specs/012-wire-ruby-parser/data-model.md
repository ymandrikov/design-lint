# Phase 1 Data Model: Wire Ruby/ERB Parser

This feature adds no persistent storage. "Entities" are the in-memory shapes on the extraction
path. Existing shapes (`Violation`, `LintResult`) are reused unchanged; only the herb-side input
shapes are new.

## Reused (unchanged) — from `lint-color/linter.ts`

- **Violation**: `{ line: number; message: string; ruleId: number }`. Produced by
  `checkTailwindClasses`; ERB path emits the identical shape.
- **LintResult**: `{ violations: Violation[]; ignores: number[] }`. Returned by every `lint*Source`
  method, including the new `lintErbSource`.
- **OutViolation** (index.ts): `{ file, line, rule, message }` — the reported line. ERB violations flow
  through the same `accumulate()` → identical output contract (FR-004).

## New — herb AST input (from `@herb-tools/core`, read-only)

These are herb's own node classes; we consume, not define, them. Fields verified against herb
`config.yml` and parser fixtures (see `.scratch/wire-ruby-parser/research.md` Addendum B/C).

- **ParseResult**: `{ value: DocumentNode; source: string; warnings: HerbWarning[]; errors: HerbError[] }`.
  `errors` non-empty ⇒ malformed template; still lint `value` (D4).
- **HTMLAttributeNode**: `{ name: HTMLAttributeNameNode; equals; value: HTMLAttributeValueNode; location }`.
  The unit `visitHTMLAttributeNode` receives.
- **HTMLAttributeValueNode**: `{ open_quote; children: Node[]; close_quote; quoted; location }`.
  `children` is the `LiteralNode | ERBContentNode | …` sequence tokenized into class groups.
- **LiteralNode**: `{ content: string; location }`. Static text run; `content` holds the class chars
  (trailing whitespace glued).
- **ERBContentNode**: `{ tag_opening; content; tag_closing; location; … }`. `tag_opening` distinguishes
  `<%=` (output), `<%` (silent), `<%#` (comment). Presence in a group ⇒ dynamic ⇒ skipped.
- **Location**: `{ start: Position; end: Position }`; **Position**: `{ line: number; column: number }`.
  Reported line = `node.location.start.line`.

## Derived (produced by the new extractor) — `lint-color/ast-erb.ts`

- **ClassToken**: `{ text: string; line: number }` — one static, whitespace-complete class token plus
  its source line. The herb-side analog of the `{ text, node }` pairs from `classNameStatics`. Built by:
  `getStaticAttributeName(name) === "class"` → `splitLiteralsAtWhitespace(value.children)` →
  `groupNodesByClass` → keep `group.every(isLiteralNode)` → `text = group.map(n => n.content).join("")`,
  `line = group[0].location.start.line`.
- **IgnoredLines**: `Set<number>` — lines carrying `<%# color-lint-ignore %>` (D5). Filters ClassTokens
  before they reach `checkTailwindClasses`.

## Validation rules (from requirements)

- A ClassToken is emitted **only** when its group is entirely `LiteralNode` (FR-005, D3).
- Attribute name must resolve statically to `class` (dynamic attr names skipped).
- A ClassToken on an ignored line is dropped before rule evaluation (D5).
- `text` is passed verbatim to `checkTailwindClasses`, which re-splits on `\s+` and runs the seven
  token rules — identical verdict to the JSX path for the same token string (FR-003, SC-002).
