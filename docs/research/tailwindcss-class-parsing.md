# How Tailwind CSS parses class names (v4 source study)

Research notes against the local clone at `.repos/tailwindcss`.

- **Pinned commit:** `9b0e8af25861ad5b8f5af420ad3ee0b188665027` (branch `main`, origin/HEAD, 2026-07-06)
- **Package version:** `tailwindcss@4.3.2` (`packages/tailwindcss/package.json`)
- All file paths below are relative to `.repos/tailwindcss`.

Tailwind's pipeline has two distinct layers that are easy to conflate:

1. **Extraction** (Rust, `crates/oxide`) — scan raw source files and pull out strings that *look like* candidates (`dark:hover:bg-red-500/50`). Fast, permissive, no theme knowledge.
2. **Candidate parsing** (TypeScript, `packages/tailwindcss/src/candidate.ts`) — turn an extracted string into a structured `Candidate` object, validated against the configured `DesignSystem` (utility roots, variant roots, theme prefix).

---

## 1. Candidate parsing — `candidate.ts`

### 1.1 Data model

Three candidate kinds, discriminated on `kind` (`packages/tailwindcss/src/candidate.ts:165-219`):

```ts
export type Candidate =
  // `[color:red]`, `[color:red]/50!`
  | { kind: 'arbitrary'; property: string; value: string;
      modifier: ArbitraryModifier | NamedModifier | null;
      variants: Variant[]; important: boolean; raw: string }
  // `underline`, `box-border`
  | { kind: 'static'; root: string; variants: Variant[]; important: boolean; raw: string }
  // `bg-red-500`, `bg-[#0088cc]`, `w-1/2`
  | { kind: 'functional'; root: string;
      value: ArbitraryUtilityValue | NamedUtilityValue | null;
      modifier: ArbitraryModifier | NamedModifier | null;
      variants: Variant[]; important: boolean; raw: string }
```

Utility values are either arbitrary or named (`candidate.ts:16-66`):

- `ArbitraryUtilityValue` — `{ kind: 'arbitrary', dataType: string | null, value: string }`; `dataType` is the explicit typehint in `bg-[color:var(--my-color)]` (`candidate.ts:16-43`).
- `NamedUtilityValue` — `{ kind: 'named', value: string, fraction: string | null }`; `fraction` preserves `1/2` from `w-1/2` because a `/` is ambiguous between fraction and modifier (`candidate.ts:45-66`, `596-599`).

Modifiers are `{ kind: 'arbitrary' | 'named', value }` (`candidate.ts:68-92`).

Variants have four kinds (`candidate.ts:104-163`): `arbitrary` (`[&_p]`, with a `relative` flag for `>`/`+`/`~` selectors), `static` (`hover`), `functional` (`aria-disabled`, `@container-[inline-size]`, with optional value + modifier), and `compound` (`group-*`, `has-[&_p]` — carries a nested `variant: Variant`).

### 1.2 `parseCandidate` walkthrough (`candidate.ts:317-613`)

`parseCandidate(input, designSystem)` is a **generator** — it can yield multiple interpretations of one string (e.g. root ambiguity), and the caller picks the one that compiles. Steps:

1. **Split variants:** `let rawVariants = segment(input, ':')` (`candidate.ts:321`) — bracket-aware split (see §3), so `[&:hover]:flex` and `data-[state=open]:flex` survive. The last segment is the base; the rest are parsed right-to-left via `designSystem.parseVariant` (`candidate.ts:337-346`). Any unparseable variant aborts the whole candidate.
2. **Theme prefix:** if a prefix is configured it must be the first "variant" segment and is shifted off (`candidate.ts:326-331`).
3. **Important:** trailing `!` (`mx-4!`) is the v4 syntax; a leading `!` (`!mx-4`) is accepted as legacy (`candidate.ts:348-361`).
4. **Static utility:** if the base (sans `!`) matches a registered static utility and contains no `[`, yield a `static` candidate — then *keep going*, since a functional interpretation may also exist (`candidate.ts:363-373`).
5. **Modifier split:** `segment(base, '/')` — exactly one `/` at top level is allowed; `bg-red-500/50/50` is rejected (`candidate.ts:384-391`). The modifier segment is parsed by `parseModifier` (§4).
6. **Arbitrary property** (`[color:red]`): base starts with `[`, must end with `]`; char after `[` must be `a-z` or `-` (vendor prefixes); property/value split on first `:`; value run through `decodeArbitraryValue` and `isValidArbitrary` (`candidate.ts:402-445`).
7. **Arbitrary value** (`bg-[#0088cc]`): base ends with `]` → root is everything before the first `-[`; root must exist as a functional utility in the design system (`candidate.ts:466-479`).
8. **CSS-variable shorthand** (`bg-(--my-var)`): base ends with `)` → root before `-(`; content may carry an optional `dataType:` prefix (split via `segment(value, ':')`), must start with `--`, and is normalized to `[var(--my-var)]` / `[type:var(--my-var)]` before continuing (`candidate.ts:492-520`).
9. **Named values — root discovery:** otherwise `findRoots` (see below) enumerates root/value splits. For each root: if the value contains `[`, it's parsed as an arbitrary value with an optional lowercase-`a-z`/`-` typehint before a `:` (`candidate.ts:546-591`); otherwise it's a named value validated against `IS_VALID_NAMED_VALUE = /^[a-zA-Z0-9_.%-]+$/` (`candidate.ts:14`, `592-608`).

### 1.3 Root discovery — `findRoots` (`candidate.ts:862-906`)

There is **no fixed grammar for where the utility root ends** — it's resolved against the registry by repeatedly chopping at the last dash:

```ts
function* findRoots(input: string, exists: (input: string) => boolean): Iterable<Root> {
  if (exists(input)) yield [input, null]
  let idx = input.lastIndexOf('-')
  // `bg-red-500` -> No match
  // `bg-red`     -> No match
  // `bg`         -> Match
  while (idx > 0) {
    let maybeRoot = input.slice(0, idx)
    if (exists(maybeRoot)) {
      let root: Root = [maybeRoot, input.slice(idx + 1)]
      if (root[1] === '') break
      ...
      yield root
    }
    idx = input.lastIndexOf('-', idx - 1)
  }
  ...
}
```

Consequence: parsing `bg-red-500` *requires a utility registry* (`designSystem.utilities.has(root, 'functional')`). The same mechanism handles variants via `designSystem.variants.has(root)` in `parseVariant` (`candidate.ts:722-724`).

### 1.4 Negative values

`parseCandidate` never special-cases a leading `-`. Instead, `utilities.ts` registers each functional utility twice — `mx` and `-mx` — and the negative handler wraps the resolved value in `calc(<value> * -1)` (`packages/tailwindcss/src/utilities.ts:454-465`). So `-mx-4` is just a functional candidate whose root is `-mx`.

### 1.5 `parseVariant` (`candidate.ts:662-850`)

- `[...]` → arbitrary variant; selector decoded, bare selectors wrapped as `&:is(…)`, `relative: true` for `>`/`+`/`~` prefixes (`candidate.ts:664-706`).
- Otherwise `segment(variant, '/')` splits off a variant modifier (e.g. `group-hover/name`); more than one `/` is invalid (`candidate.ts:713-720`).
- `findRoots` over the variant registry, then dispatch on registered kind: `static` (no value, no modifier allowed), `functional` (named / `[...]` / `(--var)` values), `compound` (recursively `parseVariant` the remainder; `not-`/`has-`/`in-` forward the modifier to the sub-variant, `candidate.ts:822-825`).

---

## 2. Candidate extraction from source files — `crates/oxide`

The oxide scanner extracts candidate-looking spans from arbitrary text with a set of composable byte-level state machines (`crates/oxide/src/extractor/mod.rs:8-22`): `CandidateMachine` drives `VariantMachine` + `UtilityMachine`, which in turn use `NamedUtilityMachine`, `ArbitraryValueMachine` (`[...]`), `ArbitraryVariableMachine` (`(...)`), `ModifierMachine`, `StringMachine`, and a fixed-size `BracketStack`.

- `Extractor::extract` walks a byte cursor and yields `Extracted::Candidate(&[u8])` or `Extracted::CssVariable(&[u8])` spans (`crates/oxide/src/extractor/mod.rs:24-80`).
- `CandidateMachine` skips whitespace and characters that can never start a candidate (`:`, quotes, backticks), and jumps ahead on known-bad starts like `<` or uppercase letters (`crates/oxide/src/extractor/candidate_machine.rs:30-60`).
- **Boundary validation:** a span only counts if the characters immediately before/after it are valid boundaries — whitespace, quotes/backticks, `\0`, plus template-language cases (`.` for Angular `[class.foo]`, `}` for Twig, etc.). See the `Class` enum and `has_valid_boundaries` (`crates/oxide/src/extractor/boundary.rs:5-80`).
- `BracketStack` is a fixed 32-byte stack that pushes the *expected closing* bracket on `(`/`[`/`{` and fails a pop on mismatch (`crates/oxide/src/extractor/bracket_stack.rs:1-56`) — the Rust twin of the TS `segment` stack.
- `pre_processors/` contains per-language preprocessing (Pug, Slim, Svelte, etc.) that rewrites source so class positions survive.

Extraction is intentionally over-permissive: false positives are fine because `parseCandidate` filters them against the design system later.

Node bindings: `@tailwindcss/oxide` (`crates/node/package.json:2`) exposes a `Scanner` class with `scan()`, `scanFiles()`, and notably `getCandidatesWithPositions()` (`crates/node/src/lib.rs:111-166`) — candidate strings plus byte offsets for a given file content, useful for linters.

---

## 3. Segmenting — `segment()` (`packages/tailwindcss/src/utils/segment.ts:29-102`)

The single splitting primitive used everywhere (`:` for variants, `/` for modifiers, `,` in values). Splits on a one-character separator only at bracket depth 0, with quote and backslash awareness. Depth is tracked with a shared preallocated `Uint8Array(256)` stack of *expected closing* brackets (`segment.ts:15`):

```ts
export function segment(input: string, separator: string) {
  let stackPos = 0
  let parts: string[] = []
  let lastPos = 0
  ...
  for (let idx = 0; idx < len; idx++) {
    let char = input.charCodeAt(idx)
    if (stackPos === 0 && char === separatorCode) {
      parts.push(input.slice(lastPos, idx))
      lastPos = idx + 1
      continue
    }
    switch (char) {
      case BACKSLASH: idx += 1; break            // skip escaped char
      case SINGLE_QUOTE: case DOUBLE_QUOTE:      // consume string, honoring \escapes
        while (++idx < len) { ... }
        break
      case OPEN_PAREN:  closingBracketStack[stackPos++] = CLOSE_PAREN; break
      case OPEN_BRACKET: closingBracketStack[stackPos++] = CLOSE_BRACKET; break
      case OPEN_CURLY:  closingBracketStack[stackPos++] = CLOSE_CURLY; break
      case CLOSE_BRACKET: case CLOSE_CURLY: case CLOSE_PAREN:
        if (stackPos > 0 && char === closingBracketStack[stackPos - 1]) stackPos--
        break
    }
  }
  parts.push(input.slice(lastPos))
  return parts
}
```

Key details:

- Mismatched closers are simply ignored (no error) — `segment` never fails; validity is checked separately.
- Quotes suspend all bracket tracking until the matching quote.
- The companion `isValidArbitrary` (`packages/tailwindcss/src/utils/is-valid-arbitrary.ts:27-93`) is the *validator*: same stack walk, but rejects unbalanced closers, top-level `;`, and deliberately does **not** push `{` so `[&{color:red}]:flex` is invalid (`is-valid-arbitrary.ts:68-71`).

---

## 4. Modifier and arbitrary-value handling

### 4.1 `parseModifier` (`candidate.ts:615-660`)

Three accepted shapes, in order:

1. `[...]` → arbitrary modifier; content decoded via `decodeArbitraryValue`, must be non-empty and pass `isValidArbitrary` (`candidate.ts:616-630`).
2. `(...)` → CSS-variable shorthand; content must start with `--` and is rewritten to `var(--x)`, still kind `'arbitrary'` (`candidate.ts:632-652`).
3. Otherwise a named modifier, validated by `IS_VALID_NAMED_VALUE` (`/^[a-zA-Z0-9_.%-]+$/`, `candidate.ts:14`, `654-659`).

So `bg-red-500/50` → `{ kind: 'named', value: '50' }`, `bg-red-500/[50%]` → `{ kind: 'arbitrary', value: '50%' }`, `bg-red-500/(--opacity)` → `{ kind: 'arbitrary', value: 'var(--opacity)' }`.

### 4.2 Arbitrary value decoding — `decodeArbitraryValue` (`packages/tailwindcss/src/utils/decode-arbitrary-value.ts:4-17`)

Underscores encode spaces in class names. Decoding rules (`decode-arbitrary-value.ts:23-89`):

- `_` → ` `, `\_` → `_`.
- Exception: inside `url(...)` and the first argument of `var(...)`/`theme(...)` underscores are preserved (they're real identifier characters there). Implemented by parsing the value with the internal `value-parser` and walking function nodes.
- After decoding, math operators get whitespace re-added (`math-operators.ts`).

### 4.3 Data-type inference

When an arbitrary value has no explicit typehint, utility implementations call `inferDataType(value, types)` (`packages/tailwindcss/src/utils/infer-data-type.ts:47`) to disambiguate e.g. `bg-[…]` between `color`, `image`, `position`, etc. Color detection lives in `packages/tailwindcss/src/utils/is-color.ts` — a `#` prefix check, a full named-color set, and color-function roots. Relevant to design-lint: this is exactly the classification a raw-color rule needs for arbitrary values.

### 4.4 Public API surface

`parseCandidate`, `parseVariant`, `segment`, etc. are **not exported** from the `tailwindcss` package. `packages/tailwindcss/package.json` `exports` only exposes `.` (→ `src/index.ts` / `dist/lib.js`), `./colors`, `./defaultTheme`, `./plugin`, and CSS files. `src/index.ts` exports only `compile`, `compileAst`, `postcss` plugin warning, and `__unstable__loadDesignSystem` (`packages/tailwindcss/src/index.ts:710,820,858`). The `DesignSystem` returned by `__unstable__loadDesignSystem` *does* expose `parseCandidate(candidate): Readonly<Candidate>[]` and `candidatesToCss(classes)` (`packages/tailwindcss/src/design-system.ts:49,63,173`), but the function is explicitly unstable and requires compiling the user's CSS first.

---

## 5. Recommendations for design-lint

design-lint already has a bracket-aware token splitter (commits `2e421ea`, `aa4cc8a`; ADR `docs/adr/0001-hand-rolled-token-splitter.md`). Findings that bear on it:

1. **Adopt `segment`'s exact algorithm as the reference.** Our splitter should match its semantics precisely: shared closing-bracket stack, backslash escape skip, quote scanning that ignores brackets, silent tolerance of mismatched closers. `segment.ts` is ~70 lines, MIT-licensed, dependency-free — vendoring it (or asserting parity in tests against its test file `segment.test.ts`) is the cheapest correctness win. Same for `isValidArbitrary` as a candidate-validity gate.

2. **Adopt the `Candidate`/`Variant` data model.** The three-way `static | functional | arbitrary` candidate split, `value: named | arbitrary`, `modifier: named | arbitrary`, `important`, `raw` is a proven shape for rule logic. For color rules, the useful invariants: variants come from `segment(raw, ':')` with the base last; at most one top-level `/`; `fraction` explains why `w-1/2` isn't "a modifier".

3. **Do not try to split roots grammatically.** `findRoots` proves the root/value boundary is registry-driven (`bg` vs `bg-red` is decided by lookup, and negatives are separate `-mx` roots registered in `utilities.ts:463-465`). design-lint has two viable options:
   - **tailwind-merge-style reimplementation** (recommended): maintain our own small registry of color-bearing roots (`bg`, `text`, `border`, `ring`, `fill`, …) and apply last-dash chopping against it. We only care about color utilities, so the registry is small and stable.
   - `__unstable__loadDesignSystem(css).parseCandidate(...)` gives Tailwind's real answer but requires the user's compiled CSS, is marked unstable, and drags the whole compiler in. Reasonable later for "resolve against the user's actual theme", not for the core splitter.

4. **`@tailwindcss/oxide` is practical for extraction, not parsing.** Its `Scanner.getCandidatesWithPositions()` (`crates/node/src/lib.rs:136`) returns candidate strings + byte offsets from raw file content — a shortcut for scanning non-JSX/CSS sources. But design-lint's oxc-AST approach (commit `ca4cdce`) is *more* precise for JSX because oxide is deliberately over-permissive (it extracts anything candidate-shaped anywhere in the file, relying on boundary chars only — `crates/oxide/src/extractor/boundary.rs`). Keep AST-scoped extraction; consider oxide only if we ever need template-language coverage (Pug/Slim/Twig pre-processors already exist there).

5. **Reuse the arbitrary-value conventions for color classification.** For `bg-[...]` / `text-(...)`: honor the explicit `dataType:` typehint (lowercase `a-z` + `-` before a top-level `:`), decode underscores per `decodeArbitraryValue` rules before matching color syntax, and port `is-color.ts` + the color branch of `inferDataType` for hint-less values. `(...)` shorthand always means `var(--x)` — for design-lint that's a CSS-variable reference and typically *token-shaped*, which matters for rule severity.

6. **Modifier rule detail worth copying:** Tailwind rejects a second top-level `/` (`candidate.ts:384-391`) and empty `[]`/`()` modifiers (`candidate.ts:395-399`). Matching this keeps our opacity-modifier rule (`7f8c41a`) from firing on strings Tailwind itself would discard.
