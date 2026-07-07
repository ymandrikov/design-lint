# classify.js comment review — before/after log

Comment-by-comment pass over `lint-color/classify.js`. Each entry: the original
comment, what replaced it (if anything), and why. Some entries also refactored
code so the comment became unnecessary. All 388 tests pass after the pass.

Verdict legend: **KILL** (removed, code/name self-explains) · **JSDoc**
(prose → JSDoc type annotations) · **REFACTOR** (extracted a named helper, comment
died with it) · **KEEP/REWRITE** (non-obvious *why* preserved, trimmed).

---

## C1 — file header · KILL

**Before**
```js
// Classification layer between raw Tailwind candidate strings and the color
// rules. Pure, synchronous, independent of the loaded Tailwind design system.
//
// Tailwind's `parseCandidate` is a test oracle only (ADR 0001); splitting uses
// the vendored `segment` primitive (ADR 0002).
```
**After** — removed.
**Reason** — restates what imports + exports already show. ADR pointers live in the
ADRs themselves.

## C2 — TAILWIND_SPECTRAL_COLORS · KILL

**Before**
```js
// Tailwind v3/v4 palette colors — the ones with numeric shade scales.
```
**After** — removed.
**Reason** — any dev recognizes these as Tailwind colors; the set name says the rest.

## C3 — TAILWIND_STATIC_COLORS · KILL

**Before**
```js
// Tailwind keyword colors with no numeric shade (black, white, transparent,
// current, inherit). Forbidden like spectral colors, but classified separately —
// the shade-scan in classifyColorPart can't see them.
```
**After** — removed.
**Reason** — variable name descriptive enough; the "classified separately" rationale
is readable from the static-check branch in `classifyColorPart`.

## C4 — CSS_COLOR_PROPERTIES · REWRITE (→ example)

**Before**
```js
// CSS color-carrying properties for arbitrary-property candidates ("[color:red]").
// Seeded from what no-style-color forbids inline, in kebab spelling. Custom
// properties ("--*") always count (see isColorProperty): they can hold a color,
// and a token's only sanctioned spelling is the utility class, so its variable
// form is a violation too.
```
**After**
```js
// e.g. [color:red], [background-color:#123]
```
**Reason** — a short comment with a correct example beats a paragraph. Original
example risked confusion; fixed to a true arbitrary-*property* form (whole-base,
no prefix), not `bg-[color:red]` (a typehinted arbitrary *value* — different path).
**Dropped-rationale flag** — the "`--*` always counts" *why* now lives nowhere;
park in CONTEXT.md if the team needs it.

## C5 — isColorProperty · KILL

**Before**
```js
// A declaration property that can carry color, for arbitrary-property candidates.
```
**After** — removed.
**Reason** — the body is a two-clause OR; devs read it directly. (Same dropped-`--*`
rationale flag as C4.)

## C6 — TAILWIND_COLOR_PREFIXES · KILL

**Before**
```js
// Tailwind utility prefixes that carry a color value.
```
**After** — removed.
**Reason** — prefix names are self-evident.

## C7 — SHADE_RE / VAR_REF_RE · KILL

**Before**
```js
// A numeric Tailwind shade segment ("500") and a leading `var(` reference.
```
**After** — removed.
**Reason** — regex names are self-evident.

## C8 — splitColorToken doc · JSDoc (types only)

**Before**
```js
// splitColorToken(rawTok) → { variants: string[], base: string, modifier: string | null }
//
// Splits with the vendored `segment` primitive (ADR 0002), so ":" and "/" inside
// arbitrary values, var shorthand, quoted strings, escapes, and "{}" groups are
// never mistaken for a variant or Modifier separator. Acceptance still differs
// from parseCandidate: this best-effort-decomposes strings it rejects (see
// oracleParses in edge-tokens.ts).
//
// Contract:
//   1. Variants: split on every top-level ":", in source order.
//   2. Modifier: split on the last top-level "/"; null when absent.
//   3. Important "!" (leading or trailing) stripped from base.
//   4. Unbalanced input never throws — best-effort decomposition returned.
```
**After**
```js
/**
 * @param {string} rawTok
 * @returns {{ variants: string[], base: string, modifier: string | null }}
 */
```
**Reason** — user chose types-only; the contract is exercised by tests and readable
from the body.

## C9 — inside splitColorToken · KILL

**Before**
```js
// Leading top-level ":" segments are variants; the last carries base + Modifier.
```
**After** — removed.
**Reason** — the two slice lines directly under it say exactly this.

## C10 — v4 important marker · REFACTOR

**Before**
```js
// v4 important marker sits after the Modifier ("bg-primary/50!") — strip first.
if (rest.endsWith("!")) rest = rest.slice(0, -1);
```
**After**
```js
if (isTwV4Important(rest)) rest = rest.slice(0, -1);
```
with a module-scope helper:
```js
// Tailwind important markers: v3 leads with "!" ("!bg-primary"), v4 trails ("bg-primary/50!").
const isTwV3Important = (s) => s.startsWith("!");
const isTwV4Important = (s) => s.endsWith("!");
```
**Reason** — named predicate carries the intent the raw `endsWith("!")` didn't.

## C11 — Modifier split · KILL

**Before**
```js
// Modifier: the last top-level "/" in the remaining segment.
const slashParts = segment(rest, "/");
```
**After** — comment removed, code kept.
**Reason** — `slashParts` + the `length > 1` block below already say it.

## C12 — v3 important block · REFACTOR

**Before**
```js
// v3 important marker prefixes the base ("!bg-primary"); tolerate a stray
// trailing "!" left when there was no Modifier ("bg-primary!").
if (base.startsWith("!")) base = base.slice(1);
if (base.endsWith("!")) base = base.slice(0, -1);
```
**After**
```js
if (isTwV3Important(base)) base = base.slice(1);
if (isTwV4Important(base)) base = base.slice(0, -1);
```
**Reason** — reuses the C10 predicates; names replace the comment.

## C13 — classifyColorPart doc · JSDoc + brief verdict gloss

**Before** — signature line + full per-verdict paragraph (semantic/spectral/static/
raw/var/null, each with multi-clause description).
**After**
```js
/**
 * Verdicts:
 *   "semantic" — design-token name ("primary")
 *   "spectral" — palette color + shade ("red-500")
 *   "static"   — keyword color ("black", "transparent")
 *   "raw"      — literal color ("[#fff]", "[var(--x,red)]")
 *   "var"      — clean CSS-var reference ("(--x)", "[var(--x)]")
 *   null       — not a color ("[url(…)]", "red-foo")
 * @param {string} colorPart  base with color prefix removed ("primary", "red-500", "[color:red]")
 * @param {{ semanticSet?: Set<string>, spectralSet?: Set<string> }} tokens
 * @returns {"semantic" | "spectral" | "static" | "raw" | "var" | null}
 */
```
**Reason** — user wanted the union types kept and each verdict meaning kept, but
concise, one-per-line, with a single example each.

## C14 — arbitrary-value guard · REFACTOR

**Before**
```js
// Decode + color-check arbitrary values before the segment scan, else a
// bracketed interior with a "<spectral>-<digits>" run ("(--red-500-rgb)")
// reads as spectral. Order: decode → typehint → var-shape → is-color.
if (colorPart[0] === "[" || colorPart[0] === "(") {
```
**After**
```js
// Before the segment scan, else "(--red-500-rgb)" misreads as spectral.
if (isArbitraryOrVarShorthand(colorPart)) {
```
with helper:
```js
// A bracketed arbitrary value ("[…]") or v4 var shorthand ("(…)").
const isArbitraryOrVarShorthand = (s) => s[0] === "[" || s[0] === "(";
```
**Reason** — extract the predicate (name = *what*); keep one line of the *why* (the
misread risk isn't self-evident).

## C15 — classifyArbitraryColor doc · KILL

**Before**
```js
// classifyArbitraryColor(colorPart) → "raw" | "var" | null
//
// colorPart is a bracketed arbitrary value ("[…]") or v4 var shorthand ("(…)").
// Mirrors parseCandidate's value order for an arbitrary color utility: decode,
// peel dataType typehint, recognize a var reference, fall back to is-color.
```
**After** — removed.
**Reason** — clear without a comment after the var-shorthand branch was extracted.

## C16 — var-shorthand branch · REFACTOR (→ classifyVarShorthand)

**Before** — inline `(` branch inside `classifyArbitraryColor` with a 3-line comment.
**After**
```js
return classifyColorValue(colorPart.slice(1, -1)); // e.g. [#fff], [var(--x)]
...
// v4 var shorthand, e.g. (--x), (color:--x) → var(--x). "raw" if it carries a
// literal-color fallback (--x,red), else "var".
function classifyVarShorthand(colorPart) { ... }
```
**Reason** — extract the branch to a named helper; comment reduced to an example.

## C17 — non-color typehint check · REFACTOR (→ isNonColorTypehint)

**Before**
```js
// Non-color typehint (length:--x) is not a color — as in the bracket branch.
if (typehint !== null && typehint !== "color") return null;
```
**After**
```js
if (isNonColorTypehint(typehint)) return null;
```
with helper (also DRYs the identical check in `classifyColorValue`):
```js
// e.g. (length:--x), (image:--x)
const isNonColorTypehint = (typehint) => typehint !== null && typehint !== "color";
```
**Reason** — descriptive name + full-form examples; one predicate, two call sites.

## C18 — extractTypehint doc + inner comments · REFACTOR (kill magic numbers)

**Before**
```js
// extractTypehint(value) → { typehint: string | null, value: string }
// ...dataType typehint... Mirrors candidate.ts...
function extractTypehint(value) {
  ... const code = value.charCodeAt(i);
  if (code === 0x3a /* ":" */) { ... }
  // a-z or "-" — still inside a possible typehint.
  if (code === 0x2d || (code >= 0x61 && code <= 0x7a)) continue;
```
**After**
```js
/**
 * Peel a leading dataType typehint ("color:red", "length:200px").
 * @returns {{ typehint: string | null, value: string }}
 */
function extractTypehint(value) {
  ... const ch = value[i];
  if (ch === ":") return { ... };
  if (ch === "-" || (ch >= "a" && ch <= "z")) continue;
```
**Reason** — the `0x3a`/`0x2d`/`0x61-0x7a` charcodes forced all three inline comments.
Char compares are self-evident, so the comments delete themselves.

## C19 — classifyVarReference doc · JSDoc + recursion note

**Before** — signature + paragraph on var/raw/null and recursion.
**After**
```js
/**
 * Fallbacks recurse, so a color nested any depth is caught (var(--x, var(--y, red))).
 * @param {string} value  decoded arbitrary interior
 * @returns {"var" | "raw" | null}  "raw" if a literal-color fallback, null if not a var ref
 */
```
**Reason** — types-only, but the recursion behavior is non-obvious → kept as one line.

## C20 — parseArbitraryProperty doc + inner comment · REFACTOR/JSDoc

**Before** — full doc paragraph + `const c = base.charCodeAt(1);` with a `// a-z or "-"`
comment and hex compares.
**After**
```js
/**
 * Parse a whole-base arbitrary property ("[color:red]", "[--x:red]"). Value
 * returned undecoded (classifyColorValue decodes). null if not one / malformed.
 * @returns {{ property: string, value: string } | null}
 */
export function parseArbitraryProperty(base) {
  ...
  const c = base[1]; // property starts a-z or "-" (custom props lead "--")
  if (c !== "-" && !(c >= "a" && c <= "z")) return null;
```
**Reason** — kill `charCodeAt` magic; keep the "undecoded" contract (genuinely
non-obvious). Concise for senior readers.

## C21 — classifyColorValue doc · JSDoc (types only)

**Before** — doc paragraph incl. "no paren shorthand here" note.
**After**
```js
/**
 * @param {string} rawValue  undecoded value side of an arbitrary property ("[prop:value]")
 * @returns {"raw" | "var" | null}
 */
```
**Reason** — user chose types-only.

## C22 — classifyParts doc · JSDoc (types only)

**Before** — doc paragraph incl. non-color-property note.
**After**
```js
/**
 * @param {{ colorPart: string|null, arbitraryProperty: string|null, arbitraryValue: string|null }} parts
 * @param {{ semanticSet?: Set<string>, spectralSet?: Set<string> }} tokens
 * @returns {"semantic" | "spectral" | "static" | "raw" | "var" | null}
 */
```
**Reason** — user chose types-only.

## C23 — findColorPrefix doc · JSDoc (types only)

**Before**
```js
// findColorPrefix(base, colorPrefixes) → prefix string | null
//
// Longest match wins regardless of array order, so "ring-offset" beats "ring"
// for "ring-offset-2" and "divide-x" is not shadowed by "divide".
```
**After**
```js
/**
 * Longest match wins.
 * @param {string} base
 * @param {string[]} colorPrefixes
 * @returns {string | null}
 */
```
**Reason** — examples disputed (`ring-offset-2` is a width not a color; `ring-offset`
questioned as a v4 utility; `divide-x` isn't even in the prefix list). Dropped the
examples rather than ship a wrong one.
**Code flag** — if `ring-offset` is truly gone in Tailwind v4, `TAILWIND_COLOR_PREFIXES`
carries a dead prefix. Separate code fix, not a comment issue.

## C24 — isDiscardedCandidate doc · KILL

**Before** — signature + "not a Candidate / registry-free" paragraph + bulleted
list of reject cases.
**After** — removed.
**Reason** — function name + the guard sequence in the body explain the purpose.

## C25 — second-Modifier check · REFACTOR (→ hasSecondModifier)

**Before**
```js
// A top-level "/" left in the base means a second Modifier survived the split.
if (segment(base, "/").length > 1) return true;
```
**After**
```js
if (hasSecondModifier(base)) return true;
```
with helper:
```js
// A leftover top-level "/" means a second Modifier survived the split ("bg-red/50/50").
const hasSecondModifier = (base) => segment(base, "/").length > 1;
```
**Reason** — the raw `segment(...).length > 1` didn't say "second Modifier"; the name
now does.

## C26 — malformed arbitrary-property check · REFACTOR (→ isMalformedArbitraryProperty)

**Before**
```js
// A whole-base bracket group is an arbitrary-property candidate; a malformed
// one ("[Color:red]", "[foo]", "[color:]") is discarded. arbitrary is threaded
// from composeColorParts so the base is parsed once.
if (base[0] === "[" && arbitrary === null) return true;
```
**After**
```js
if (isMalformedArbitraryProperty(base, arbitrary)) return true;
```
with helper:
```js
// Looks like an arbitrary property ("[…]") but parseArbitraryProperty rejected it → discard.
const isMalformedArbitraryProperty = (base, arbitrary) => base[0] === "[" && arbitrary === null;
```
**Reason** — the two-term condition was opaque; the name states the intent.

## C27 — isValidModifier doc · KILL

**Before**
```js
// isValidModifier(mod) → boolean. The Modifier after the top-level "/". Bracket/
// paren Modifiers must be non-empty and valid; a named Modifier need only be
// non-empty ("bg-primary/" yields ""). Full IS_VALID_NAMED_VALUE is out of scope.
```
**After** — removed.
**Reason** — name + body explain purpose.

## C28 — isValidArbitraryGroup doc · KILL

**Before**
```js
// isValidArbitraryGroup(inner) → boolean. A bracket/paren interior is well-formed
// when non-empty and isValidArbitrary (balanced brackets, no top-level ";"). Used
// for both Modifier groups and arbitrary base groups.
```
**After** — removed.
**Reason** — one-line body; name says it.

## C29 — isArbitraryDiscarded doc + inner comment · KILL doc / REWRITE inner (why)

**Before**
```js
// isArbitraryDiscarded(base) → boolean. True when the base's arbitrary syntax ...
function isArbitraryDiscarded(base) {
  ...
  // Must close with the matching bracket as the final character.
  if (base[base.length - 1] !== closeCh) return true;
```
**After**
```js
function isArbitraryDiscarded(base) {
  ...
  // The arbitrary group must close at the very last char, else it is
  // unterminated or has trailing junk ("bg-[#fff", "bg-[#fff]x").
  if (base[base.length - 1] !== closeCh) return true;
```
**Reason** — empirically tested: a blank-context sub-agent read the comment-stripped
function and rated it **2/5**. It recovered the *what* from the name but called the
trailing-close line's *why* "entirely implicit" — the grammar assumption that the
arbitrary group is always the trailing token. So doc block = redundant (KILL), but
the inner comment upgraded from *what* ("must close with matching bracket") to *why*
(the trailing-token invariant, with examples). First draft used a `bg-[#fff]/50`
example — corrected, because the Modifier is stripped upstream and never reaches
`base` here.

## C30 — composeColorParts doc · JSDoc (types only)

**Before** — signature + paragraph + per-field bullet list.
**After**
```js
/**
 * @param {string} rawTok
 * @param {string[]} [colorPrefixes]
 * @returns {{ variants: string[], base: string, modifier: string|null, colorPrefix: string|null, colorPart: string|null, arbitraryProperty: string|null, arbitraryValue: string|null } | null} null when rawTok is not a Candidate
 */
```
The inner "parse the arbitrary-property shape once" comment was left in place
(types-only was the ask for the doc block).
**Reason** — the field list duplicated the return type; JSDoc encodes it once.

---

## Open code flags (not comment issues)

1. **`ring-offset` in `TAILWIND_COLOR_PREFIXES`** — reported gone in Tailwind v4. If
   so, it's a dead prefix in live code. Confirm and remove.
2. **`--*` "why every custom property counts"** rationale (dropped at C4/C5) now
   lives nowhere. Park in `CONTEXT.md` if non-obvious to the team.
