// Rule 3 — No opacity modifiers on color classes (e.g. bg-destructive/5).
// Use a dedicated token with the opacity baked in instead.

export const id = 3;
export const name = "no-opacity-modifier";

// checkToken(rawTok, tok, normalized, ctx) → message string or null.
// Returns a message and signals the orchestrator to stop checking this token further.
export function checkToken(rawTok, tok, normalized, ctx) {
  const { tokens, ansi } = ctx;
  const slashIdx = normalized.lastIndexOf("/");
  if (slashIdx !== -1 && /^\d+$/.test(normalized.slice(slashIdx + 1))) {
    if (tokens.colorPrefixes.some((p) => tok.startsWith(p + "-"))) {
      return `${ansi.red(normalized)} — opacity modifier on color class; use a dedicated token`;
    }
  }
  return null;
}
