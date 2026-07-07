// File discovery — recursive walk + Storybook detection.

import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

export function getAllFiles(dir, ...exts) {
  const extSet = new Set(exts);
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && extSet.has(extname(e.name)))
    .map((e) => join(e.parentPath ?? e.path, e.name));
}

export function isStorybookFile(filePath) {
  return (
    filePath.includes("/stories/") ||
    filePath.endsWith(".stories.tsx") ||
    filePath.endsWith(".stories.ts")
  );
}
