# Ruby ERB templates are linted via the herb parser, static-`class` only

**Status:** accepted

To extend color linting to Ruby ERB/HTML templates (`.erb`, `.html.erb`) we
depend on the [herb](https://github.com/marcoroth/herb) parser through
`@herb-tools/node-wasm`, pinned to an exact pre-1.0 version (`0.10.1`). We chose
the WASM binding over `@herb-tools/node` (native addon, node-pre-gyp) for
portability — no per-platform compile — accepting a one-time `await Herb.load()`
WASM init at startup. herb's own exported helpers (`getStaticAttributeName`,
`splitLiteralsAtWhitespace`, `groupNodesByClass`, `isLiteralNode`) do the
class-attribute tokenization exactly as herb's own linter does, so we reuse them
rather than reimplement.

**Scope is deliberately narrow: only fully-static `class` attributes are linted.**
Any attribute value group containing ERB interpolation (`<%= %>`) or control flow
(`<% if %>`) is treated as a boundary and skipped whole — `text-<%= s %>-500`
emits nothing rather than risk the false fragments `text-`/`-500`. The three
JSX/React-shaped rules (`no-style-color`, `no-component-color-override`,
`no-useless-hover`) are not ported to ERB; ERB `style="…"` is a plain string, not
a JS object, and the component rules are React concepts. The extractor
(`lint-color/ast-erb.ts`) is the herb analog of the oxc seam in `ast.ts`, feeding
the unchanged inner token pipeline. See `.scratch/wire-ruby-parser/research.md`.

**Consequences:** the pre-1.0 dependency generates its AST node classes from a
`config.yml`, so field names can shift between minor versions — the exact pin is
load-bearing, and the generator is the source of truth if fields drift.
