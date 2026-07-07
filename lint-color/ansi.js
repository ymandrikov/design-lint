// Terminal styling — ANSI escapes, gated on TTY.

export const isTTY = process.stdout.isTTY;
export const red = (s) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s);
export const blue = (s) => (isTTY ? `\x1b[34m${s}\x1b[0m` : s);
export const dim = (s) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s);
export const bold = (s) => (isTTY ? `\x1b[1m${s}\x1b[0m` : s);
