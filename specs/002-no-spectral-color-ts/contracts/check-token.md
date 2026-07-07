# Contract: `checkToken` (no-spectral-color, TS)

The rule's single exported behavior. The migration preserves this contract exactly; only the
types around it become explicit. This is the CLI-internal rule interface every token rule
implements (see `shared.js` `checkTokenIfEnabled`).

## Signature

```ts
export const id = 4;
export const name = "no-spectral-color";

export function checkToken(rawTok: string, parts: Parts, ctx: Ctx): string | null;
```

- `rawTok` — the raw Tailwind token string (unused by this rule directly; part of the shared signature).
- `parts` — decomposed candidate (`NonNullable<ReturnType<typeof composeColorParts>>`). See data-model.
- `ctx` — `{ tokens, ansi, ruleConfig }`. See data-model.
- **Returns** — a violation message `string`, or `null` when the token is not a spectral color.

## Behavior (must match pre-migration byte-for-byte)

| # | Given | Then |
|---|-------|------|
| C1 | `classifyParts(parts, tokens) !== "spectral"` | return `null` (no violation). |
| C2 | classifier verdict is `"spectral"` | return the violation message for `parts.base`. |
| C3 | `ruleConfig.replacement` maps this prefix + palette name + shade (exact or in a `lo...hi` range) | message ends with ` — try <prefix>-<semantic>` (the `blue`-colored hint). |
| C4 | prefix absent from `replacement`, or shade outside every configured range, or no `replacement` config | message has no hint suffix; violation still reported. |
| C5 | any input | message = `` `${ansi.red(base)} — spectral color class; use a design token instead${hint}` ``. |

## Invariants

- **No private palette scan.** The spectral decision comes only from `classifyParts`; the
  name+shade for the hint come only from `findSpectralMatch(parts.colorPart, tokens.spectralSet)`
  — the same shared scan (FR-005). The migration must not reintroduce a local detection loop.
- **Public surface stable.** `id === 4`, `name === "no-spectral-color"`, and the 3-arg
  `checkToken` signature are unchanged (FR-002).
- **No `any`** in the module, or an inline-justified one (Constitution I).

## Verification

- Unit/behavior: `lint-color/rules/no-spectral-color.test.ts` passes **unmodified** (SC-003).
- Type: `pnpm typecheck` → zero errors (SC-002).
- End-to-end: `pnpm lint:demo` spectral-violation set unchanged (SC-004).
