// ERB AST layer — the herb-side analog of ast.ts, the single boundary between
// raw Ruby ERB/HTML source and the parser-agnostic inner token pipeline.
//
// oxc/ast.ts cannot walk herb nodes: herb nodes are class instances with typed
// child getters, not the plain enumerable `.type` objects `walk` assumes. herb
// ships a Visitor and the same class-attribute tokenization its own linter uses
// (getStaticAttributeName / splitLiteralsAtWhitespace / groupNodesByClass /
// isLiteralNode) — we consume those verbatim rather than reimplement them.
// Upstream: @herb-tools/core `ast-utils.ts` (re-exported by node-wasm), model
// rule `linter/src/rules/erb-no-interpolated-class-names.ts`. See
// `.scratch/wire-ruby-parser/research.md` Addendum A.

import {
  Herb,
  Visitor,
  getStaticAttributeName,
  splitLiteralsAtWhitespace,
  groupNodesByClass,
  isLiteralNode,
  isPureWhitespaceNode,
} from "@herb-tools/node-wasm";
import type {
  ParseResult,
  HTMLAttributeNode,
  ERBContentNode,
  HerbError,
} from "@herb-tools/node-wasm";

// One static, whitespace-complete class token plus its source line — the herb
// analog of the `{ text, node }` pairs classNameStatics produces on the oxc side.
export type ClassToken = { text: string; line: number };

// herb requires an async WASM init before any parse. index.ts awaits this once
// at startup; tests await it in setup. Memoized so repeated callers share the
// single load. `Herb.parse` is synchronous thereafter, keeping lintErbSource
// synchronous like its lint*Source siblings.
let loaded: Promise<void> | null = null;
export function loadHerb(): Promise<void> {
  if (!loaded) loaded = Herb.load().then(() => undefined);
  return loaded;
}

// Parse ERB source to herb's ParseResult. Herb.parse never throws — a malformed
// template yields a recovered tree plus populated errors (see erbParseErrors).
// loadHerb() must have resolved first.
export function parseErb(source: string): ParseResult {
  return Herb.parse(source);
}

const IGNORE_MARKER = "color-lint-ignore";

// Lines carrying a `<%# color-lint-ignore %>` ERB comment — the ERB analog of
// ignoredLines(ast) (JSX) and the CSS `walkComments` suppression. An ERB comment
// parses as an ERBContentNode whose `tag_opening` token is `<%#`.
export function collectErbIgnoredLines(result: ParseResult): Set<number> {
  const lines = new Set<number>();
  class IgnoreVisitor extends Visitor {
    override visitERBContentNode(node: ERBContentNode): void {
      if (
        node.tag_opening?.value === "<%#" &&
        (node.content?.value ?? "").trim() === IGNORE_MARKER
      ) {
        lines.add(node.location.start.line);
      }
      this.visitChildNodes(node);
    }
  }
  result.visit(new IgnoreVisitor());
  return lines;
}

// Static class tokens from every static `class` attribute. herb's split→group
// pipeline yields one group per class token; a group that contains any
// non-literal node (an `<%= %>` hole or `<% %>` control-flow node) is an
// interpolation boundary and is skipped whole (FR-005) — so `text-<%= s %>-500`
// collapses to one mixed group and emits nothing, while `text-red-500 <%= x %>`
// emits only the static `text-red-500`. Pure-whitespace groups are dropped.
export function collectErbClassTokens(result: ParseResult): ClassToken[] {
  const tokens: ClassToken[] = [];
  class ClassVisitor extends Visitor {
    override visitHTMLAttributeNode(node: HTMLAttributeNode): void {
      if (node.name && node.value && getStaticAttributeName(node.name) === "class") {
        const groups = groupNodesByClass(
          splitLiteralsAtWhitespace(node.value.children),
        );
        for (const group of groups) {
          if (group.length === 0) continue;
          if (group.every(isPureWhitespaceNode)) continue;
          if (!group.every(isLiteralNode)) continue;
          const text = group.map((n) => n.content).join("");
          if (text.trim() === "") continue;
          tokens.push({ text, line: group[0].location.start.line });
        }
      }
      this.visitChildNodes(node);
    }
  }
  result.visit(new ClassVisitor());
  return tokens;
}

// Parse errors surfaced by herb. The error-recovering parser attaches errors to
// nested nodes, not the top-level `errors` array, so `recursiveErrors()` is the
// real signal (research.md Addendum D). Callers surface these as a note and keep
// linting — the run never aborts (FR-006, D4).
export function erbParseErrors(result: ParseResult): HerbError[] {
  return result.recursiveErrors();
}
