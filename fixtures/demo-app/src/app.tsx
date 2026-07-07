// Seeded violations — one (or more) per rule. The e2e test asserts on the
// lint output produced from this file, card.css, and button.tsx.
import { Button } from "./components/ui/button";

export function App() {
  return (
    <main className="bg-muted">
      {/* rule 1: no-style-color (the "#ff0000" literal also trips rule 2) */}
      <div style={{ color: "#ff0000" }}>styled</div>

      {/* rule 2: no-raw-css-color — raw color in arbitrary value */}
      <div className="bg-[#123456]">raw</div>

      {/* rule 2: no-raw-css-color — named color inside an arbitrary value */}
      <div className="bg-[red]">arb-named</div>

      {/* rule 2: no-raw-css-color — var() with a literal-color fallback is raw */}
      <div className="bg-[var(--x,red)]">var-fallback</div>

      {/* rule 2: no-raw-css-color — arbitrary-property candidate applying a raw color */}
      <div className="[color:red]">arb-prop-raw</div>

      {/* rule 6: no-var-color — v4 var shorthand behind a color prefix */}
      <div className="bg-(--color-primary)">var-shorthand</div>

      {/* rule 6: no-var-color — bracketed color: typehinted var reference */}
      <span className="text-[color:var(--color-primary)]">var-hinted</span>

      {/* rule 6: no-var-color — arbitrary-property candidate referencing a var */}
      <div className="[color:var(--color-primary)]">arb-prop-var</div>

      {/* clean: invalid candidate (double modifier) — Tailwind discards it, so
          every rule stays silent. No spectral, no opacity, no violation. */}
      <div className="bg-red-500/50/50">invalid-dead-class</div>

      {/* clean: explicit non-color typehints never false-positive (story 7) */}
      <div className="bg-[length:200px] bg-[image:url(x)]">typehints</div>

      {/* rule 3: no-opacity-modifier */}
      <div className="bg-primary/50">translucent</div>

      {/* rule 3: no-opacity-modifier — arbitrary opacity (finding #3) */}
      <div className="bg-primary/[0.5]">arb-opacity</div>

      {/* rule 3: no-opacity-modifier — var-shorthand opacity (finding #3) */}
      <div className="bg-primary/(--alpha)">var-opacity</div>

      {/* rule 3: no-opacity-modifier — keyword color with opacity (static color) */}
      <div className="bg-black/50">scrim</div>

      {/* clean: line-height Modifier is not opacity — no rule 3 (finding #3) */}
      <p className="text-sm/6">line height</p>

      {/* rule 4: no-spectral-color — hint suggests text-success-content */}
      <span className="text-green-500">ok</span>

      {/* rule 5: token-constraints — muted not in the text allow list */}
      <span className="text-muted">note</span>

      {/* rule 5: token-constraints — hover: must use a -hover token */}
      <button className="hover:bg-primary">hover</button>

      {/* rule 9: no-dark-variant */}
      <div className="dark:bg-primary">dark</div>

      {/* rule 10: no-useless-hover — div is not interactive */}
      <div className="hover:bg-primary-hover">card</div>

      {/* rule 11: no-component-color-override */}
      <Button className="bg-success">save</Button>

      {/* finding #9: spectral name without a numeric shade is NOT an override.
          bg-red-foo is still an undefined token (rule 12), but not a color
          override (rule 11) — the false positive is gone. */}
      <Button className="bg-red-foo">not-an-override</Button>

      {/* rule 12: no-undefined-token */}
      <div className="bg-nonexistent">typo</div>

      {/* suppressed — counted, not reported */}
      <div className="text-red-500">legacy</div> {/* color-lint-ignore */}

      {/* clean usages — must produce no violations */}
      <a href="/docs" className="text-link hover:text-link-hover">
        docs
      </a>
      <p className="text-success-content border-border">done</p>
    </main>
  );
}
