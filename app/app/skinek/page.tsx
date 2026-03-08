export default function SkinekPage() {
  return (
    <div className="lmr-page lmr-page-compact">
      <section className="lmr-hero rounded-[28px] px-6 py-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Frakció skinek
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72">
          Ezen az oldalon találhatóak meg a frakció tagjai számára beállítható
          karakter skinek. A frakció tagjai ezek közül választhatnak a
          karakterük megjelenéséhez.
        </p>
      </section>

      <section className="lmr-card overflow-hidden rounded-[28px]">
        <div className="lmr-card-header px-5 py-4">
          <h2 className="text-sm font-medium text-white/90">
            La Main Rouge frakció skinek
          </h2>
        </div>

        <div className="p-4 md:p-6">
          <img
            src="/skinek.png"
            alt="La Main Rouge frakció skinek"
            className="block w-full rounded-2xl border border-white/10 bg-black/30 object-contain"
          />
        </div>
      </section>
    </div>
  );
}
