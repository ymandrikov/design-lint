import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `.repos/` holds vendored reference source (oxc, etc.) with its own test
    // files — not part of this project's suite. `.scratch/` is PRD/working notes.
    exclude: ["**/node_modules/**", ".repos/**", ".scratch/**"],
  },
});
