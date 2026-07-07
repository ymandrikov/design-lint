// File discovery — recursive walk + Storybook detection.

import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

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
