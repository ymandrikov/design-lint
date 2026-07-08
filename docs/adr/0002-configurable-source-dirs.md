# Source directories are configurable per target, replace-not-augment, sandboxed within the root

**Status:** accepted

The linter used to hardcode `SRC = join(ROOT, "src")` and walk it three times
(`.css`, `.ts`/`.tsx`, `.erb`). Targets whose source lives elsewhere — a Rails
app under `app/`, a multi-root layout — could not be linted. We add an optional
`sourceDirectories: string[]` key to the per-target lint config
(`design-system/lint/colors.json`), alongside `colorTokenFiles` and `rules`.

**No CLI flag.** Source roots are a stable per-target property a team commits
once, resolved like `colorTokenFiles`/`componentsDirectory` already are. A
per-invocation flag would force every run/CI call to re-specify them and could
drift from the committed config. See `specs/013-configurable-source-dirs/research.md` (D1–D2).

**Replace, not augment.** Absent ⇒ default `["src"]` (byte-identical
back-compat). Present ⇒ the list fully replaces `src`; it is not implicitly
added. Rails apps have no `src/`; augmenting would force every custom config to
also list `src` or accept scanning a nonexistent directory (D3).

**Fail loud, sandboxed within the root.** A pure `validateSourceDirs` rejects — with
a message naming the problem — a present-but-empty list, a non-array value, a
non-string entry, an absolute path, and any `..`-escaping path; a linter should
not walk outside its target (D6). A configured directory that does not exist is
surfaced by name and forces a non-zero exit; existing siblings still lint, but a
missing path is never a silent clean pass (D4, Constitution III). Files reachable
through overlapping or nested configured dirs are deduplicated by resolved
absolute path, so each is linted exactly once (D5).

**Scope guard.** Only the walked roots become configurable. `colorTokenFiles`
(token derivation + CSS exemption) and `componentsDirectory` (protected
components) stay target-root-relative and independent — none depend on which
roots are walked (D7).

**Consequences:** the config surface gains one optional, additive key with a
`["src"]` default — no breaking change, demo output unchanged (SC-002). The
validator is pure (unit-tested without fixtures); existence resolution and
dedup live at the CLI seam (`index.ts`) over the reusable path logic in
`files.ts`. Rule modules, `ast*.ts`, and every `lint*Source` method are
untouched — this feature only changes which files reach the lint path.
