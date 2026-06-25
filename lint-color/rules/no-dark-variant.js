// Rule 9 — No dark: variant.
// Dark theme is handled via CSS custom properties in the color token files.
// Use a semantic token (e.g. bg-success-muted) so it resolves correctly for each theme.

export const id = 9;
export const name = "no-dark-variant";

// checkToken(rawTok, tok, normalized, ctx) → message string or null.
// Returns a message and signals the orchestrator to stop checking this token further.
export function checkToken(rawTok, tok, normalized, ctx) {
  const { ansi } = ctx;
  if (/(?:^|:)dark:/.test(rawTok)) {
    return `${ansi.red(rawTok)} — dark: variant not allowed; use a semantic token (dark theme is handled via CSS custom properties)`;
  }
  return null;
}
