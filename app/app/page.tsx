export default function AppHomePage() {
  return (
    <div className="lmr-page lmr-page-compact">
      <section className="lmr-hero rounded-[28px] p-6 md:p-8">
        <div className="space-y-4">
          <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            La Main Rouge
          </span>

          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Üdvözlünk a La Main Rouge weboldalán
          </h1>

          <p className="max-w-3xl text-sm leading-7 text-white/75 md:text-base">
            Ez a felület a frakció belső rendszere, ahol egy helyen érhetők el a
            legfontosabb információk, kezelőfelületek és leadási lehetőségek.
            A cél, hogy a tagság, a TGF-ek és a vezetőség gyorsan, átláthatóan
            és egységesen tudja használni a weboldalt.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="lmr-card rounded-[24px] p-5">
          <h2 className="text-lg font-semibold">Mi található itt?</h2>
          <p className="mt-3 text-sm leading-6 text-white/75">
            A weboldalon megtalálhatók a profilhoz kapcsolódó adatok, a
            frakciós információk, a leadandók, a ticketek, valamint a
            karaktertörténeti és egyéb belsős felületek.
          </p>
        </div>

        <div className="lmr-card rounded-[24px] p-5">
          <h2 className="text-lg font-semibold">Kiknek készült?</h2>
          <p className="mt-3 text-sm leading-6 text-white/75">
            A rendszer külön nézetekkel működik TGF, tag és vezetőségi
            státuszhoz igazítva, így mindenki a számára releváns menüpontokat
            és lehetőségeket látja.
          </p>
        </div>

        <div className="lmr-card rounded-[24px] p-5">
          <h2 className="text-lg font-semibold">Mi a cél?</h2>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Egy stabil, letisztult és könnyen használható belső webapp, amely
            hosszú távon összefogja a frakció mindennapi adminisztrációját és
            közös információs felületeit.
          </p>
        </div>
      </section>

      <section className="lmr-card rounded-[28px] p-6 md:p-8">
        <h2 className="text-2xl font-semibold">Rövid bemutató</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="lmr-surface-soft rounded-[24px] p-5">
            <h3 className="text-base font-semibold">Főbb funkciók</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
              <li>• profil és státusz alapú megjelenítés</li>
              <li>• meghívókód rendszer</li>
              <li>• leadandó beküldés és kezelés</li>
              <li>• ticket rendszer</li>
              <li>• karaktertörténet leadása</li>
              <li>• vezetőségi kezelőpanel</li>
            </ul>
          </div>

          <div className="lmr-surface-soft rounded-[24px] p-5">
            <h3 className="text-base font-semibold">Használat</h3>
            <p className="mt-3 text-sm leading-6 text-white/75">
              A bal oldali hamburger menü segítségével tudsz navigálni az
              oldalak között. A Főoldal mindig visszahoz erre a kezdőfelületre,
              ahonnan könnyen tovább tudsz menni a profilodra vagy a frakció
              egyéb menüpontjaira.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
