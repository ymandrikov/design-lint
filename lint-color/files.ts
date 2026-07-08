import { readdirSync, statSync } from "node:fs";
import { extname, isAbsolute, join, normalize } from "node:path";

// Validate the raw `sourceDirectories` config value (as parsed from JSON, so
// `unknown` — every type check lives here). Returns the default `["src"]` when
// omitted; otherwise a non-empty list of within-root relative directory paths.
// Throws a plain Error naming the problem on any rejection; the CLI seam catches,
// prints to stderr, and exits non-zero without scanning.
export function validateSourceDirs(raw: unknown): string[] {
  if (raw === undefined || raw === null) return ["src"];
  if (!Array.isArray(raw)) {
    throw new Error("sourceDirectories must be a list of directories");
  }
  if (raw.length === 0) {
    throw new Error("sourceDirectories is empty; configure at least one directory");
  }
  for (const entry of raw) {
    if (typeof entry !== "string") {
      throw new Error(
        `sourceDirectories entry is not a string: ${JSON.stringify(entry)}`,
      );
    }
    if (isAbsolute(entry)) {
      throw new Error(
        `sourceDirectories entry must be relative to the target root: ${entry}`,
      );
    }
    if (normalize(entry).split(/[\\/]/).includes("..")) {
      throw new Error(
        `sourceDirectories entry escapes the target root: ${entry}`,
      );
    }
  }
  return raw as string[];
}

// Partition validated relative dirs against the target root: `existing` holds the
// absolute paths that are real directories (the roots discovery walks); `missing`
// holds the original relative names of dirs that don't exist (or aren't dirs), for
// a clean fail-loud message. A missing dir never silently drops.
export function resolveExistingSourceDirs(
  dirs: string[],
  root: string,
): { existing: string[]; missing: string[] } {
  const existing: string[] = [];
  const missing: string[] = [];
  for (const d of dirs) {
    const abs = join(root, d);
    try {
      if (statSync(abs).isDirectory()) existing.push(abs);
      else missing.push(d);
    } catch {
      missing.push(d);
    }
  }
  return { existing, missing };
}

export function getAllFiles(dir: string, ...exts: string[]): string[] {
  const extSet = new Set(exts);
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && extSet.has(extname(e.name)))
    // parentPath is always populated; the old `?? e.path` fell back to a since-removed alias.
    .map((e) => join(e.parentPath, e.name));
}

export function isStorybookFile(filePath: string): boolean {
  return (
    filePath.includes("/stories/") ||
    filePath.endsWith(".stories.tsx") ||
    filePath.endsWith(".stories.ts")
  );
}
