# Contract — `findSpectralMatch` (new export, `lint-color/classify.js`)

Single source of the "palette name immediately followed by a numeric shade" scan.
Consumed by `classifyColorPart` (for the `"spectral"` verdict) and by the
`no-spectral-color` rule (for the replacement-hint name + shade).

## Signature

```
findSpectralMatch(colorPart: string, spectralSet: Set<string>) → { name: string, shade: string } | null
```

## Behavior

- Split `colorPart` on `-`. Scan left to right. Return the **first** `{ name, shade }`
  where `name` is a segment in `spectralSet` and the **next** segment is all digits.
- Return `null` if no such adjacent pair exists, if `colorPart` is empty/falsy, or if
  `spectralSet` is nullish.
- Pure; no mutation of inputs.

## Cases (become `classify.test.ts` assertions)

| `colorPart` | result |
|-------------|--------|
| `"red-500"` | `{ name: "red", shade: "500" }` |
| `"blue-200"` | `{ name: "blue", shade: "200" }` |
| `"x-red-500"` (from `divide-x-red-500`) | `{ name: "red", shade: "500" }` |
| `"green-100"` | `{ name: "green", shade: "100" }` |
| `"red"` (name, no shade) | `null` |
| `"sm"` / `"cover"` (non-color) | `null` |
| `"primary"` (semantic) | `null` |
| `""` | `null` |

## Invariant vs. classifier

`classifyColorPart(colorPart, tokens)` returns `"spectral"`
**iff** `findSpectralMatch(colorPart, tokens.spectralSet)` is non-null
(for the non-arbitrary-value path). The classifier calls the helper; the two never
disagree because there is one implementation.
