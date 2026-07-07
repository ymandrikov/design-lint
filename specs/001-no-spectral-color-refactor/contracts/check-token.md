# Contract — `no-spectral-color` `checkToken` (behavior preserved)

`lint-color/rules/no-spectral-color.js`. Public surface unchanged by this refactor;
this contract pins the behavior the existing test suite already asserts, restated so the
refactor has an explicit target.

## Signature (unchanged)

```
checkToken(rawTok, parts, ctx) → string | null
```

- `parts` — composed color parts (from `composeColorParts`): `{ colorPrefix, colorPart, ... }`.
- `ctx` — `{ tokens, ansi, ruleConfig }`. `tokens.spectralSet`, `tokens.semanticSet`; `ruleConfig.replacement` optional.
- Returns a violation message, or `null` when the token is not a spectral color.
- `export const id = 4`, `export const name = "no-spectral-color"` — unchanged.

## Behavior

1. **Gate**: if `classifyParts(parts, tokens) !== "spectral"` → return `null`.
   (Mirrors `no-var-color` / `no-raw-css-color`.)
2. **Hint**: call `findSpectralMatch(parts.colorPart, tokens.spectralSet)` → `{ name, shade }`.
   If `parts.colorPrefix` and `ruleConfig.replacement` are present, look up
   `findReplacement(replacement, colorPrefix, name, shade)`; a hit yields
   `— try <prefix>-<semantic>` appended to the message, else no hint.
3. **Message** (byte-for-byte with today):
   `` `${ansi.red(base)} — spectral color class; use a design token instead${hint}` ``

## Cases (already in `no-spectral-color.test.ts` — must stay green, no edits)

| Input class | Result |
|-------------|--------|
| `bg-red-500`, `text-blue-200`, `border-slate-300` | violation naming the class |
| `ring-offset-blue-200` (compound prefix) | violation |
| `divide-green-100` | violation |
| `bg-primary` (semantic) | `null` |
| `text-red` (name, no shade) | `null` |
| `text-sm`, `bg-cover` (non-color sharing a prefix) | `null` |
| `text-green-400` w/ range map `green-400...600 → success-content` | message contains `text-success-content` |
| `bg-green-500` w/ `green-500 → success` | message contains `bg-success` |
| `bg-blue-500` (no map entry) | violation, message contains no ` try ` hint |
| `bg-green-700` (shade outside ranges) / `border-green-500` (prefix absent from map) | violation, no hint |
| `bg-red-500 {/* color-lint-ignore */}` | `null` (suppressed upstream) |

## Deleted

The private `segs = base.split("-")` loop and the standalone spectral detection inside
the rule. Detection now comes solely from `classifyParts`; the name/shade for the hint
comes solely from `findSpectralMatch`.
