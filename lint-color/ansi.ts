// Terminal styling — ANSI escapes, gated on TTY.

export const isTTY = process.stdout.isTTY;
export const red = (s: string) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s);
export const blue = (s: string) => (isTTY ? `\x1b[34m${s}\x1b[0m` : s);
export const dim = (s: string) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s);
export const bold = (s: string) => (isTTY ? `\x1b[1m${s}\x1b[0m` : s);
