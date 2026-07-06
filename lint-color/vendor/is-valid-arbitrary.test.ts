// Parity suite for the vendored `isValidArbitrary` primitive (ADR 0002), pinned
// to tailwindcss commit 9b0e8af25861ad5b8f5af420ad3ee0b188665027 (v4.3.2).
//
// tailwindcss ships no dedicated `is-valid-arbitrary.test.ts`; these cases
// encode the semantics documented on the source function and exercised by its
// call sites in `candidate.ts` (arbitrary values, var shorthand, modifiers).
// A re-vendor against a new commit that changes those semantics fails here.
import { expect, it } from "vitest";
import { isValidArbitrary } from "./is-valid-arbitrary.js";

it("accepts a plain value", () => {
  expect(isValidArbitrary("red")).toBe(true);
  expect(isValidArbitrary("#0088cc")).toBe(true);
  expect(isValidArbitrary("--my-var")).toBe(true);
});

it("accepts balanced parens, brackets, and curlies", () => {
  expect(isValidArbitrary("rgb(0,0,0)")).toBe(true);
  expect(isValidArbitrary("var(--x,rgb(0_0_0))")).toBe(true);
  expect(isValidArbitrary("calc((1+2)*3)")).toBe(true);
  expect(isValidArbitrary("[a]")).toBe(true);
});

it("rejects an unbalanced closing bracket at the top level", () => {
  expect(isValidArbitrary(")")).toBe(false);
  expect(isValidArbitrary("]")).toBe(false);
  expect(isValidArbitrary("}")).toBe(false);
  expect(isValidArbitrary("rgb(0,0,0))")).toBe(false);
  expect(isValidArbitrary("a]b")).toBe(false);
});

it("accepts an unbalanced OPENING bracket (only closers move validity)", () => {
  // The `must end with ]` check lives in the caller, not here.
  expect(isValidArbitrary("url(foo")).toBe(true);
  expect(isValidArbitrary("[color:red")).toBe(true);
});

it("rejects a top-level semicolon", () => {
  expect(isValidArbitrary("red;")).toBe(false);
  expect(isValidArbitrary("a;b")).toBe(false);
});

it("accepts a semicolon nested inside brackets or parens", () => {
  expect(isValidArbitrary("[a;b]")).toBe(true);
  expect(isValidArbitrary("(a;b)")).toBe(true);
});

it("treats `{` as a non-nesting character so a top-level `}` is unbalanced", () => {
  // NOTE upstream: `[&{color:red}]:flex` must not validate as an arbitrary value.
  expect(isValidArbitrary("a{b}")).toBe(false);
  expect(isValidArbitrary("{color:red}")).toBe(false);
});

it("ignores brackets, semicolons, and closers inside a quoted string", () => {
  expect(isValidArbitrary("url('a;b')")).toBe(true);
  expect(isValidArbitrary("'a]b'")).toBe(true);
  expect(isValidArbitrary('"a}b"')).toBe(true);
  expect(isValidArbitrary("'a:b/c'")).toBe(true);
});

it("skips the character after a backslash escape", () => {
  expect(isValidArbitrary(String.raw`a\]b`)).toBe(true);
  expect(isValidArbitrary(String.raw`a\;b`)).toBe(true);
});
