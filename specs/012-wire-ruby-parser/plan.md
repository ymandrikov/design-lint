# Implementation Plan: Wire Ruby/ERB Parser

**Branch**: `012-wire-ruby-parser` (working branch `ym/wire-ruby-parser`) | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-wire-ruby-parser/spec.md`

## Summary

Extend the existing color-token linter to Ruby ERB/HTML templates (`.erb`, `.html.erb`).
The color-rule engine already splits into a parser-agnostic inner pipeline
(`checkTailwindClasses` → `checkTailwindToken` → seven token rules) and an oxc/JSX-bound
outer extractor. We add a **second outer extractor** built on the herb parser
(`@herb-tools/node-wasm`) that walks the ERB AST, pulls static class tokens from HTML `class`
attributes (treating ERB interpolation as a boundary), and feeds them to the unchanged inner
pipeline. No rule logic changes. herb's own exported helpers (`getStaticAttributeName`,
`splitLiteralsAtWhitespace`, `groupNodesByClass`, `isLiteralNode`) do the tokenization the
same way herb's own linter does — see `.scratch/wire-ruby-parser/research.md` (Addendum A).

## Technical Context

**Language/Version**: TypeScript 6 on Node ^26.1.0, ESM (`"type":"module"`), run via `node lint-color/*.ts`.

**Primary Dependencies**: `@herb-tools/node-wasm` (NEW, pinned — pre-1.0, currently `0.10.1`) for ERB parsing; existing `oxc-parser`, `tailwindcss`, `postcss` unchanged.

**Storage**: N/A (stateless CLI over source files).

**Testing**: vitest. New unit/e2e tests over `.erb` fixtures; paired JSX↔ERB fixtures assert identical verdicts.

**Target Platform**: Node CLI (dev machines + CI). node-wasm chosen over node native addon for portability (no per-platform compile).

**Project Type**: Single-project CLI linter (`lint-color/`).

**Performance Goals**: One herb parse per `.erb` file, reused across the class-attribute pass; linear in tokens; short-circuits non-`class` attributes and non-literal (interpolation) groups. One-time `Herb.load()` WASM init at startup.

**Constraints**: Zero regression on existing `.css`/`.ts`/`.tsx`/`.jsx` output (byte-identical demo run). A malformed template must not abort the run.

**Scale/Scope**: First cut = color-in-`class`-attribute only. `no-style-color`, `no-component-color-override`, `no-useless-hover` explicitly out of scope for ERB (FR-008).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality & Simplicity** — PASS. New extractor is single-concern (`ast-erb.ts`), matches
  the existing `ast.ts`/`lintTailwindSource` idiom. Reuses herb's exported helpers rather than
  reimplementing tokenization (YAGNI; deleting-over-adding). Vendored/external parse logic cites its
  upstream (herb `config.yml` + `ast-utils.ts`) per the constitution's parse-parity clause.
  `pnpm typecheck` must stay green.
- **II. Testing Standards (NON-NEGOTIABLE)** — PASS by plan. Every new behavior ships with tests:
  exact-output e2e over `.erb` fixtures, paired JSX↔ERB parity fixtures (SC-002), interpolation
  fixtures (SC-003), malformed-template fixture (SC-005). No `.only`/skip.
- **III. User Experience Consistency** — PASS. ERB violations use the identical
  `{file, line, rule (kebab), message}` shape via the same `accumulate`/report path; messages come
  from the same rules, so vocabulary already matches `CONTEXT.md`. Exit codes unchanged.
- **IV. Performance Requirements** — PASS. Parse once per file, reuse; rules short-circuit on
  out-of-scope attributes/tokens; no super-linear walk (herb `Visitor` is linear in nodes). WASM load
  is one-time and amortized.

**No violations → Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/012-wire-ruby-parser/
├── plan.md              # This file
├── spec.md              # Feature spec (+ spec.ru.md sidecar)
├── research.md          # Phase 0 — decisions (source: .scratch/wire-ruby-parser/research.md)
├── data-model.md        # Phase 1 — entities
├── quickstart.md        # Phase 1 — runnable validation
├── contracts/
│   └── erb-linting.md   # Phase 1 — extractor + output contract
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
lint-color/
├── ast.ts                     # (unchanged) oxc/JSX seam
├── ast-erb.ts                 # NEW — herb load + parse + class-attr extraction → {token, line}
├── linter.ts                  # EDIT — add lintErbSource() method inside createLinter()
├── index.ts                   # EDIT — await herb load once; add .erb glob + dispatch
├── files.ts                   # (unchanged) getAllFiles(".erb") also matches ".html.erb"
├── classify.ts / rules/*      # (unchanged) inner pipeline reused verbatim
├── linter.lintErb.test.ts     # NEW — extractor + interpolation + parity unit tests
└── vendor/                     # (unchanged)

fixtures/
└── erb-app/                   # NEW — .erb/.html.erb fixtures (static, interpolation, malformed, parity)

tests/
└── e2e.test.ts                # EDIT — assert exact ERB violations in a combined run
```

**Structure Decision**: Single project. Mirror the existing oxc seam: `ast-erb.ts` is the herb
analog of `ast.ts`; `lintErbSource` is the analog of `lintTailwindSource`, added as a method on the
`createLinter` closure so it reaches the private `checkTailwindClasses` directly (no rule change).
`getAllFiles` needs no change — `extname("x.html.erb") === ".erb"`, so a single `.erb` glob covers both.

## Key Design Decisions (from research)

1. **Binding**: `@herb-tools/node-wasm`, pinned. `await Herb.load()` once at startup (index.ts is
   already top-level-`await`); `Herb.parse(source)` is synchronous thereafter, so `lintErbSource`
   stays sync like its siblings. Tests `await` the same one-time load in setup.
2. **Extraction**: subclass herb's `Visitor` (plain, to avoid coupling to `@herb-tools/linter`'s
   mixin unless it proves cleanly importable). Override `visitHTMLAttributeNode`; filter
   `getStaticAttributeName(node.name) === "class"`; run `splitLiteralsAtWhitespace(node.value.children)`
   → `groupNodesByClass`; keep only groups where `group.every(isLiteralNode)`; join each such group's
   `content` into a token string; report at `node.location.start.line` (or the literal's line).
3. **Interpolation boundary (FR-005)**: falls out of decision 2 — any group containing a non-literal
   (ERBContentNode / ERB control-flow) is skipped whole. `text-<%= x %>-500` → one mixed group →
   skipped; `text-red-500 <%= foo %>` → static group linted + ERB group skipped. This is herb's own
   tested behavior.
4. **Parse errors (FR-006)**: `Herb.parse` returns a `ParseResult` with an `errors` array (never
   throws). `lintErbSource` lints `result.value` regardless; if `result.errors` is non-empty, surface
   it (a parse note) and continue — the run never aborts.
5. **Suppression** (edge case): an ERB comment parses as an `ERBContentNode` with
   `tag_opening === "<%#"` (verified: herb fixtures `graph_ql_test/test_0002`,
   `attributes_test/test_0063`). Collect the `location.start.line` of every such node whose `content`
   trims to `color-lint-ignore`, building an ignored-lines set — the ERB analog of `ignoredLines(ast)`
   (JSX) and CSS `walkComments`. Directive syntax in ERB: `<%# color-lint-ignore %>`. (HTML comments
   are a distinct `HTMLCommentNode`, `config.yml:739` — not used for the directive.)

## Complexity Tracking

*No constitution violations — not applicable.*
