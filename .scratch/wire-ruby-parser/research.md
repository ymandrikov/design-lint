# Wiring the herb Ruby/ERB parser into design-lint

Research to let the existing `lint-color` token pipeline run against Ruby ERB/HTML
templates via the [herb](https://github.com/marcoroth/herb) parser.

- **Date:** 2026-07-08
- **Local code cited** as `path:line`, relative to repo root `/Users/ym/work/repos/design-lint`.
- **External facts** cite a URL or a `gh api`-fetched herb source path (herb pinned at `main`, npm `@herb-tools/*@0.10.1`).
- **Verified** = read in source/docs. **Inferred** = reasoned from verified facts, not directly stated. **Unconfirmed** = could not verify.

---

## Strand 1 — Current design-lint architecture (verified against source)

### 1.1 Where it lives, what parses today

The tool is the `lint-color/` package. The parser is **oxc-parser** (`parseSync`),
used only for the JS/TS/JSX inputs; CSS goes through **PostCSS** separately.

- Parse call: `lint-color/ast.ts:8` (`import { parseSync } from "oxc-parser"`) and
  `lint-color/ast.ts:74` — `const { program, comments } = parseSync(filePath, source, { lang })`.
- oxc nodes are **ESTree-shaped**; the `.type` discriminants (`"Literal"`, `"JSXAttribute"`, …)
  are runtime strings (`lint-color/ast.ts:9-20`).
- Language is picked by extension: `.tsx`/`.jsx` → `"tsx"`, else `"ts"` (`lint-color/ast.ts:63-65`).
- oxc nodes carry **byte offsets** (`Span`), not lines, so `ast.ts` builds a `lineStarts`
  table and binary-searches offset→line (`lint-color/ast.ts:36-53`, `ParsedAst.lineStarts` at `ast.ts:22-27`).
- CSS path is independent: `postcss.parse` + `walkDecls`/`walkAtRules("apply")`
  (`lint-color/linter.ts:227-269`). Not relevant to herb.

### 1.2 Traversal / visitor mechanism

A single generic recursive walker, **not** an oxc visitor:

- `walk(node, enter)` at `lint-color/ast.ts:81-95`: recurses any object, calls `enter`
  on every value whose `.type` is a string, iterates own keys, **skips `parent` and `type`**.
  This works because oxc nodes are **plain enumerable objects**.
- One parse per file is cached LRU(1) (`ast.ts:56-78`) since `index.ts` runs four passes.

### 1.3 THE SEAM (this is what a herb adapter must reproduce)

The color logic is in **two layers**, and only the outer one is parser-coupled:

**Inner layer — parser-agnostic, operates on plain strings.** `createLinter(...)` in
`lint-color/linter.ts:127-175` exposes:
- `checkTailwindToken(rawTok: string)` (`linter.ts:132-163`) — runs the whole rule stack
  (dark-variant, raw-css-color, var-color, opacity-modifier, spectral-color, undefined-token,
  token-constraints) against **one class token string**. Knows nothing about any AST.
- `checkTailwindClasses(classesStr, lineNum)` (`linter.ts:165-174`) — `classesStr.split(/\s+/)`,
  runs `checkTailwindToken` on each non-empty token, tags each violation with `lineNum`.

  → **This inner layer is reusable verbatim for ERB.** It is the target the adapter feeds.

**Outer layer — oxc-coupled.** `lintTailwindSource` (`linter.ts:180-201`) is the class-attribute
extractor bound to oxc/JSX:
- `walk(ast.program, …)`, filter `node.type === "JSXOpeningElement"` (`linter.ts:185-186`).
- iterate `node.attributes`, keep `attr.type === "JSXAttribute"` (`linter.ts:187-188`).
- resolve attribute name via `jsxName(attr.name)`, keep only `"className"`/`"class"` (`linter.ts:189-190`).
- pull static strings via `classNameStatics(attr.value)` (`linter.ts:191`), then per string:
  `offsetToLine(lineStarts, strNode.start)`, skip if line is ignored, `checkTailwindClasses(text, line)` (`linter.ts:192-195`).

**What the rules actually read from the AST** (the minimal contract a herb adapter must satisfy):
- **element/attribute name strings** — `jsxName` resolves `JSXIdentifier`/`JSXNamespacedName`/`JSXMemberExpression` (`ast.ts:99-111`).
- **static class strings** — `classNameStatics`/`collectClassStatics` (`ast.ts:140-157`) collects only:
  a string `Literal` (`node.value`, `ast.ts:148-149`), a `JSXExpressionContainer`'s inner expression,
  and a `TemplateLiteral`'s **static quasis** (`ast.ts:152-156`). Dynamic class strings reached through
  `cn()`/ternary/logical are a deliberate v1 non-goal (`ast.ts:136-138`).
- **a source position** to map to a line — currently a byte offset (`strNode.start`).

So the seam is exactly: **`(class attribute) → list of {static class string, line number}` → `checkTailwindClasses`.**

### 1.4 Other outer-layer passes (JSX/TS-specific, NOT reusable for ERB as-is)

- `lintStyleSource` → `no-style-color`: inspects `style={{ … }}` **object literals** (`ast.ts:184-219`, `linter.ts:204-208`). ERB `style="…"` is a plain string; different path.
- `lintComponentSource` → `no-component-color-override`: shadcn `.tsx` components + `cn()`/`clsx()` deep walk (`ast.ts:169-179`).
- `lintHoverSource` → `no-useless-hover`.
- These are TS/JSX/React concepts and do not map to ERB without new rule logic. **Inferred.**

### 1.5 CLI file discovery / dispatch

- `getAllFiles(dir, ...exts)` — `readdirSync(dir, { recursive: true })` filtered by `extname` (`lint-color/files.ts:4-11`).
- `index.ts` globs `.css` then `.tsx`/`.ts` under `<ROOT>/src` (`index.ts:165-176`), reads each with `readFileSync`, dispatches to the `lint*Source` methods, accumulates `{file, line, rule, message}` (`index.ts:156-176`).
- No `.erb`/`.html.erb` extension is scanned today (`index.ts:165,170`) — a herb pass needs a new glob + dispatch line here.

---

## Strand 2 — The herb parser (verified against herb source + npm + docs)

### 2.1 What it is / language / bindings

- herb = HTML-aware ERB toolchain by Marco Roth. Repo confirmed: <https://github.com/marcoroth/herb>. Docs: <https://herb-tools.dev>.
- **Core written in C** — "a fast, portable, and HTML-aware ERB parser written in C" (<https://herb-tools.dev/overview>; <https://marcoroth.dev/posts/introducing-herb>). Verified.
- **JS/Node bindings exist and are published** (all `0.10.1`, latest at time of research):
  - **`@herb-tools/node`** — "Native Node.js addon for HTML-aware ERB parsing using Herb." Deps include `node-addon-api`, `@mapbox/node-pre-gyp`, `node-pre-gyp-github` (prebuilt-binary download). Depends on `@herb-tools/core`. (`npm view @herb-tools/node`.) Verified.
  - **`@herb-tools/node-wasm`** — "WebAssembly-based HTML-aware ERB parser for Node.js." No native compile. `0.10.1`. Verified.
  - **`@herb-tools/browser`** — WASM build for browsers. Verified (search + npm).
  - **`@herb-tools/core`** — "Core module exporting shared interfaces, AST node definitions, and common utilities." `0.10.1`. Verified. This is where the `Node`/`Visitor`/node classes are re-exported from.
- Maturity: **pre-1.0** (`0.10.1`), first published 2025-04-15, last modified 2026-04-25 (`npm view @herb-tools/node time`). Actively developed.

### 2.2 JS parse API (verified: docs reference page + herb source)

From <https://herb-tools.dev/bindings/javascript/reference.html> and `parse-result.ts`:

```js
import { Herb } from "@herb-tools/node"   // or "@herb-tools/node-wasm" / "@herb-tools/browser"
await Herb.load()                          // async init REQUIRED before use
const result = Herb.parse(source)          // ParseResult;  also Herb.parseFile(path)
```

- API is identical across the node / node-wasm / browser packages (docs reference). `Herb.version`, `Herb.lex`, `Herb.extractRuby/extractHTML` also exist.
- `ParseResult.value` is the **root `DocumentNode`** (`gh:javascript/packages/core/src/parse-result.ts:29`).
- `ParseResult.visit(visitor)` traverses — it calls `visitor.visit(this.value)` (`parse-result.ts:111-112`). Verified.

### 2.3 AST node shapes (verified: herb `config.yml`, the generator source of truth)

Node classes are **code-generated** from the repo-root `config.yml` `nodes:` section via
`templates/javascript/packages/core/src/nodes.ts.erb`. Field names below are quoted verbatim
from `config.yml` (fetched via `gh api repos/marcoroth/herb/contents/config.yml`). Verified.

Base `Node` (`templates/.../nodes.ts.erb:25-78`): every node has
`readonly type: NodeType` (a string, e.g. `"HTMLAttributeNode"`), `readonly location: Location`,
`readonly errors`, and methods `accept(visitor)`, `childNodes()`, `compactChildNodes(): Node[]`.
`Location` has `.start`/`.end` positions with **`.line` and `.column`** (`location.js`/`position.js`).

Key node types for color-in-class extraction:

| Node | Fields (verbatim) |
|------|-------------------|
| `DocumentNode` | `children: Node[]` |
| `HTMLElementNode` | `open_tag`, `tag_name` (token), `body: Node[]`, `close_tag`, `is_void` |
| `HTMLOpenTagNode` | `tag_opening` (token), `tag_name` (token), `tag_closing` (token), `children: Node[]`, `is_void` — **the attributes live in `children`** |
| `HTMLAttributeNode` | `name: HTMLAttributeNameNode`, `equals` (token), `value: HTMLAttributeValueNode` |
| `HTMLAttributeNameNode` | `children: (LiteralNode \| ERBContentNode)[]` |
| `HTMLAttributeValueNode` | `open_quote` (token), `children: Node[]`, `close_quote` (token), `quoted` (boolean) |
| `LiteralNode` | `content: string` — static text runs |
| `HTMLTextNode` | `content: string` |
| `ERBContentNode` | `tag_opening` (token), `content` (token), `tag_closing` (token), `analyzed_ruby`, `parsed`, `valid` |

- **Token** (`javascript/packages/core/src/token.ts:11-15`): `readonly value: string`, `readonly location`, `readonly range`, `readonly type`. → get a tag/attr-name literal token's text via `token.value`.
- `<%= %>` vs `<% %>` is distinguished by the ERB node's `tag_opening` token value (e.g. `"<%="` vs `"<%"`), per herb's Ruby API docs. Verified (herb-tools search; also `ERBContentNode.tag_opening`).

**How `class="text-red-500 hover:bg-primary"` looks:**
`HTMLAttributeNode` → `name.children = [LiteralNode{content:"class"}]`,
`value: HTMLAttributeValueNode{ children: [ LiteralNode{content:"text-red-500 hover:bg-primary"} ], quoted:true }`.
The class string is `value.children`, filtered to `LiteralNode`, `.content`. Verified from shapes.

**With ERB interpolation** `class="text-red-500 <%= dynamic %>"`:
`value.children = [ LiteralNode{content:"text-red-500 "}, ERBContentNode{…} ]`.
The static part is the `LiteralNode.content`; the `ERBContentNode` is a hole. Inferred from the
`HTMLAttributeValueNode.children` / `HTMLAttributeNameNode.children` union `LiteralNode | ERBContentNode` in `config.yml`.

### 2.4 Traversal from JS (verified: visitor template)

herb nodes are **class instances** and are walked with a **Visitor**, not a generic key walk
(`templates/javascript/packages/core/src/visitor.ts.erb`):

```js
import { Herb } from "@herb-tools/node"
import { Visitor } from "@herb-tools/core"   // re-exported by node/browser too

class ClassAttrVisitor extends Visitor {
  visitHTMLAttributeNode(node) {
    // inspect node.name.children / node.value.children
    this.visitChildNodes(node)   // keep descending
  }
}
await Herb.load()
Herb.parse(source).visit(new ClassAttrVisitor())
```

- The generated `Visitor` provides a `visit<NodeName>(node)` method **per node type** (e.g.
  `visitHTMLElementNode`, `visitHTMLOpenTagNode`, `visitHTMLAttributeNode`, `visitHTMLAttributeValueNode`,
  `visitLiteralNode`, `visitERBContentNode`, `visitHTMLTextNode`). Default behaviour of each is
  `visitNode(node)` then `visitChildNodes(node)`, and `visitChildNodes` calls
  `node.compactChildNodes().forEach(n => n.accept(this))` (`visitor.ts.erb`, base `visit`/`visitChildNodes`). Verified.
- You override only the methods you care about and call `this.visitChildNodes(node)` to recurse.
  Alternatively drive it manually via `node.compactChildNodes()` (`nodes.ts.erb:78`).

---

## Strand 3 — Integration seam / approach

### 3.1 How much of lint-color is reusable

**Reusable unchanged:** the whole inner token pipeline —
`createLinter(...).checkTailwindClasses` → `checkTailwindToken` → all seven token rules and
`composeColorParts` (`linter.ts:132-174`, `classify.ts`). It takes **strings + a line number**;
it is not coupled to oxc. This is the payoff: the color rules run on ERB with zero rule changes.

**Not reusable:** `ast.ts` (`parseSource`, `walk`, `jsxName`, `classNameStatics`, offset→line) and
`lintTailwindSource`'s extraction loop are oxc/ESTree-specific. In particular the generic `walk`
(`ast.ts:81-95`) **will not work on herb nodes** — herb nodes are class instances with typed child
fields and getters (not the plain enumerable `.type` objects `walk` assumes), so traversal must use
herb's `Visitor`/`compactChildNodes`, not `walk`. Inferred from `ast.ts:88-93` vs `nodes.ts.erb:25-78`.

### 3.2 Where the adapter plugs in

Add a herb-side sibling to `ast.ts` (e.g. `ast-erb.ts`) and one new method on the linter
(e.g. `lintErbSource(source, filePath)`), mirroring `lintTailwindSource` (`linter.ts:180-201`)
but built on a herb `Visitor`:

1. `await Herb.load()` once at startup (async — `index.ts` is already top-level `await`, see `index.ts:141`).
2. `const result = Herb.parse(source)`.
3. Visitor overrides `visitHTMLAttributeNode(node)`:
   - **attribute name** = concat `node.name.children` `LiteralNode.content` (skip if it contains an
     `ERBContentNode`, i.e. dynamic attr name). Keep only `"class"` (ERB/HTML uses `class`, never
     `className`) — the analog of `jsxName(...) === "class"` (`linter.ts:190`).
   - **class strings** = from `node.value.children`, take each `LiteralNode.content`
     (the analog of `classNameStatics` collecting string `Literal`s, `ast.ts:148-149`).
   - **line** = `node.value.location.start.line` (or the specific `LiteralNode`'s
     `location.start.line`). **Simpler than oxc:** herb gives a line directly, so the entire
     `lineStarts`/`offsetToLine` machinery (`ast.ts:36-53`) is unnecessary on this path.
   - call the existing `checkTailwindClasses(classString, line)`.
4. `result.visit(visitor)`.
5. In `index.ts`, add `.erb`/`.html.erb` to the glob (`getAllFiles`, `files.ts:4-11`; caller `index.ts:170`)
   and a dispatch line `accumulate(linter.lintErbSource(source, f), f)` (analog of `index.ts:173`).

### 3.3 Extracting color classes: ERB vs JSX side by side

| | JSX/TS (today) | ERB/HTML (herb) |
|---|---|---|
| element/attr node | `JSXOpeningElement` / `JSXAttribute` (`linter.ts:185-188`) | `HTMLOpenTagNode.children` → `HTMLAttributeNode` |
| attr name | `jsxName(attr.name)` == `className`/`class` (`ast.ts:99-111`) | concat `name.children` `LiteralNode.content` == `class` |
| static class strings | string `Literal.value` + `TemplateLiteral` quasis (`ast.ts:148-156`) | `value.children` `LiteralNode.content` |
| position | byte offset → `offsetToLine` (`ast.ts:44-53`) | `location.start.line` directly |
| then | `checkTailwindClasses(text, line)` | **same** `checkTailwindClasses(text, line)` |

### 3.4 Risks / unknowns

- **ERB interpolation inside a class string (the hard one).** `class="text-<%= c %>-500"` splits into
  `LiteralNode{"text-"}` + `ERBContentNode` + `LiteralNode{"-500"}`. Naively concatenating the literals
  yields `text--500` (a false candidate); ignoring the hole and splitting each literal on whitespace
  yields partial tokens `text-` and `-500`. **Decision needed:** treat every `ERBContentNode` in a value
  as a token boundary AND drop the tokens immediately adjacent to it (they are dynamic), only linting
  whitespace-complete static tokens. This matches lint-color's existing "static-only, dynamic classes are
  a v1 non-goal" stance (`ast.ts:136-138`). Unconfirmed how often partial-interpolation occurs in the target
  codebase.
- **`checkTailwindClasses` split boundary.** It does `classesStr.split(/\s+/)` on one string
  (`linter.ts:167`). If literals around an ERB hole are passed as separate strings, a token split across
  the hole is never rejoined — which is the desired safe behaviour, but must be deliberate.
- **Native vs WASM binding.** `@herb-tools/node` needs a prebuilt native binary (node-pre-gyp) or a local
  compile; on unsupported platforms install can fail. **`@herb-tools/node-wasm` avoids native compilation**
  and is the safer default for a portable linter; same API. Recommend node-wasm unless perf demands native.
- **Async init.** `Herb.load()` is async and must complete before `parse`; fine here (`index.ts` uses top-level await).
- **Maturity.** Pre-1.0 (`0.10.1`); AST field names are generated and could shift between minor versions —
  pin the version. The generator (`config.yml`) is the source of truth if fields drift.
- **Performance.** C core is designed for tooling and is fast; overhead is the per-file `parse` + visitor
  allocation. **Unmeasured** — no benchmark gathered.
- **Scope.** Only the class-attribute token pipeline ports cleanly. `no-style-color` (ERB `style="…"` is a
  plain string, not a JS object), `no-component-color-override`, and `no-useless-hover` are JSX/React-shaped
  and would need new ERB-specific logic (out of scope for a first cut). Inferred (§1.4).

### 3.5 Minimal first cut (recommended)

Reuse `checkTailwindClasses` as-is. Add `ast-erb.ts` (herb Visitor collecting `{classString, line}` from
`class` attributes, ERB holes as token boundaries) + `linter.lintErbSource` + an `.erb` glob/dispatch in
`index.ts`. Use `@herb-tools/node-wasm`, pinned. Ships spectral/undefined-token/raw-css/var/opacity/
dark-variant/token-constraints over ERB class attributes with **no rule changes**.

---

## Addendum — verified against local clone `.repos/herb` (@herb-tools/*@0.10.1)

Second research pass ran three sub-agents over a full local clone (`.repos/herb`), not just
`gh api`. Citations here are `path:line` relative to `.repos/herb`. This **upgrades several
Strand-2/3 "Inferred" claims to fixture-verified** and surfaces reusable prior art that
changes the recommended approach.

### A. Prior art exists — reuse herb's own class-attribute logic (biggest update)

herb's monorepo already extracts and tokenizes Tailwind classes from ERB `class` attributes.
`@herb-tools/core` **exports** the exact helpers we need — do not reimplement:

- `getStaticAttributeName(node.name)` — resolves an attribute name, returns `"class"` only when
  the name is fully static (skips dynamic attr names). Analog of `jsxName(...) === "class"`.
- `splitLiteralsAtWhitespace(nodes)` (`core/src/ast-utils.ts:553`) — splits each `LiteralNode.content`
  on `/(\S+|\s+)/g`; non-literal nodes pass through. `"a b"` → `["a"," ","b"]`.
- `groupNodesByClass(nodes)` (`ast-utils.ts:588`) — groups the split nodes into one array per class
  token. Boundary heuristic (`:604-624`): leading whitespace → new group; **a hyphen at a node
  boundary keeps nodes in the same group** (`text-` + ERB + `-500` = ONE group); ERB adjacent to a
  non-hyphen literal or whitespace → boundary.
- `isLiteralNode` / `isPureWhitespaceNode` node predicates.
- `AttributeVisitorMixin` (`linter/src/rules/rule-utils.ts:549`) — a `Visitor` subclass that walks
  `HTMLOpenTagNode`, iterates `forEachAttribute`, classifies name×value static/dynamic, and dispatches
  to overridable hooks `checkStaticAttributeStaticValue` (plain `class="a b c"`) and
  `checkStaticAttributeDynamicValue({attributeName, valueNodes, attributeNode})` (`class="… <%= %>"`).

**Model rule to copy:** `linter/src/rules/erb-no-interpolated-class-names.ts` — a read-only
`ParserRule` that news up a visitor, calls `visitor.visit(result.value)`, returns `visitor.offenses`,
and uses exactly the `split → group` pipeline above on `class`.

**Our extractor, restated:** subclass `AttributeVisitorMixin` (or plain `Visitor`), filter
`getStaticAttributeName === "class"`, run `splitLiteralsAtWhitespace` → `groupNodesByClass`, then
**keep only groups where `group.every(isLiteralNode)`** as safe static tokens; any group containing a
non-literal node is an interpolation boundary → skip. This IS FR-005, implemented with herb's own
battle-tested logic. `text-<%= shade %>-500` collapses to one mixed group → skipped whole (no
`text-`/`-500` false fragments). `text-red-500 <%= foo %>` → `["text-red-500"]` (static, linted) +
`[ERB]` (skipped).

### B. ERB-in-attribute parse shape — now fixture-verified

- `class="text-white <%= "bg-black" %>"` → `HTMLAttributeValueNode.children` = **2 nodes**:
  `LiteralNode{content:"text-white "}` (**trailing space glued to the literal**) + `ERBContentNode`.
  Verified: `test/snapshots/parser/erb_test/test_0013_interpolate_inside_attribute_value_with_static_content_before_*.txt:27-35`.
- Token split by interpolation: attribute-*name* fixture `data-<%= key %>-name` →
  **3 nodes** `LiteralNode{"data-"}` + `ERBContentNode` + `LiteralNode{"-name"}`
  (`test/snapshots/parser/erb_test/test_0010_*.txt:17-29`). Value side uses the same
  `LiteralNode | ERBContentNode` grammar → the `text-<%= shade %>-500` value split is the same shape
  (verified for names, inferred for values — but `groupNodesByClass` handles it regardless).
- `<%= %>` vs `<% %>` vs `<%- -%>` distinguished by the **`tag_opening` token string** on the ERB node
  (`"<%="` / `"<%"` / `"<%-"`), `test_0013.txt:31`. **Silent `<% %>` inside an attribute becomes
  control-flow nodes** (`ERBIfNode`/`ERBElseNode`/`ERBEndNode`), NOT `ERBContentNode`
  (`test/snapshots/analyze/ternary_conditional_test/test_0008_*.txt:33,47,61`). The `every(isLiteralNode)`
  filter skips these correctly too.

### C. Node fields & location — verified from `config.yml`

- Attributes live in `HTMLOpenTagNode.children` (`config.yml:543`). `HTMLAttributeNode{ name, equals, value }`
  (`:690`); `HTMLAttributeValueNode{ open_quote, children, close_quote, quoted }` (`:667`); `LiteralNode{ content }` (`:538`);
  `ERBContentNode{ tag_opening, content, tag_closing, analyzed_ruby, parsed, valid }` (`:792`).
- **Line info correction:** every node carries a single `readonly location: Location`
  (`templates/javascript/packages/core/src/nodes.ts.erb:27`), where `Location = { start: Position, end: Position }`
  (`core/src/location.ts:9-11`) and `Position = { line, column }` (`position.ts:6-8`). So report with
  `node.location.start.line` — confirmed present on `LiteralNode`, `HTMLAttributeNode`, `ERBContentNode`
  (all show `(line:col)-(line:col)` in `test_0013.txt`). (Earlier draft wrote `location.start.line`
  loosely; the field is `location`, nested `.start.line`.)

### D. Binding consumption — verified from source

- **API:** `import { Herb } from "@herb-tools/node-wasm"`; `await Herb.load()` is **required and async**
  (`core/src/herb-backend.ts:41-45`; `parse` throws `"Herb backend is not loaded…"` if skipped).
  `Herb.parse(source, options?)` is **synchronous** → `ParseResult` (`herb-backend.ts:73`).
  `Herb.parseFile(path)` reads sync then parses (`node-backend.ts:12-14`).
- **Parse errors do NOT throw (FR-006 ✓).** `ParseResult{ value: DocumentNode, source, warnings, errors, options }`
  (`parse-result.ts:27`); errors collected on `.errors` + nested nodes via `recursiveErrors()` (`:95-97`);
  `failed`/`successful` getters (`:74-85`). Error-recovering parser → a malformed template yields a
  ParseResult with non-empty `errors`; keep linting other files, surface the error.
- **Package choice:** use **`@herb-tools/node-wasm`** — only dep is `@herb-tools/core`, pure-WASM, no
  per-platform native compile. `@herb-tools/node` needs node-pre-gyp prebuilt/native compile. Same API
  (both `export * from "@herb-tools/core"`, same `HerbBackend`). Ships types + dual ESM/CJS `exports`;
  our project is `"type":"module"` → ESM `import` path.
- **Clone is NOT built** (no `dist/`, no `.wasm`; `nodes.ts`/`errors.ts` are rake-generated and absent).
  The clone is for reading only; running `Herb.parse` from it needs Ruby+Rake+emscripten. The real
  dependency comes prebuilt from npm — `pnpm add @herb-tools/node-wasm` (pin the version, pre-1.0).

### E. Net effect on the plan

- FR-005 (interpolation boundary) drops from "design decision needed" to **"reuse `groupNodesByClass` +
  `every(isLiteralNode)`"** — herb already made and tested this decision.
- The adapter is smaller than the first draft assumed: `getStaticAttributeName`,
  `splitLiteralsAtWhitespace`, `groupNodesByClass`, `isLiteralNode` are all imported; we write only the
  visitor glue + `{tokenString, line}` collection + `checkTailwindClasses` call + `.erb` glob/dispatch.
- Open choice: subclass `AttributeVisitorMixin` (needs it to be exported from `@herb-tools/core` /
  `@herb-tools/linter` — verify at install) vs a plain `Visitor` subclass using only the exported
  `core` helpers (fewer deps, safer). Recommend the plain-`Visitor` route unless the mixin is cleanly
  importable.

---

## Where this file is saved & why

`/.scratch/wire-ruby-parser/research.md`. `CLAUDE.md` states issues/PRDs live under
`.scratch/<feature-slug>/` as markdown; this research backs a prospective "wire Ruby parser" feature,
so it belongs in that feature's scratch folder. (An alternative home, `docs/research/`, already holds
`tailwindcss-class-parsing.md`; that dir suits durable standalone studies, whereas this is feature-scoped
pre-work, hence `.scratch/`.)
