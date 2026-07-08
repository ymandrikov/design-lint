// Pure unit tests for the source-directory validator + existence resolver.
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveExistingSourceDirs, validateSourceDirs } from "./files.ts";

// The repo root (two dirs up from lint-color/) — used as a real existence root.
const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

describe("validateSourceDirs", () => {
  it("defaults omitted/null to [\"src\"]", () => {
    expect(validateSourceDirs(undefined)).toEqual(["src"]);
    expect(validateSourceDirs(null)).toEqual(["src"]);
  });

  it("passes a valid list through unchanged", () => {
    expect(validateSourceDirs(["app"])).toEqual(["app"]);
    expect(validateSourceDirs(["app", "lib"])).toEqual(["app", "lib"]);
  });

  it("rejects an empty list", () => {
    expect(() => validateSourceDirs([])).toThrow(/empty/);
  });

  it("rejects a non-array value", () => {
    expect(() => validateSourceDirs("app")).toThrow(/list/);
  });

  it("rejects a non-string entry, naming the offender", () => {
    expect(() => validateSourceDirs(["app", 3])).toThrow(/3/);
  });

  it("rejects an absolute path", () => {
    expect(() => validateSourceDirs(["/etc"])).toThrow(/relative/);
  });

  it("rejects paths that escape the target root", () => {
    expect(() => validateSourceDirs(["../x"])).toThrow(/escape/);
    expect(() => validateSourceDirs(["a/../.."])).toThrow(/escape/);
  });
});

describe("resolveExistingSourceDirs", () => {
  it("partitions existing vs missing against a real root", () => {
    const { existing, missing } = resolveExistingSourceDirs(
      ["lint-color", "nope-xyz"],
      REPO_ROOT,
    );
    expect(existing).toEqual([join(REPO_ROOT, "lint-color")]);
    expect(missing).toEqual(["nope-xyz"]);
  });
});
