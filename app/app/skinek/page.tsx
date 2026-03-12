export default function SkinekPage() {
  return (
    <div className="lmr-page lmr-page-compact">
      <section className="lmr-hero">
        <div className="max-w-4xl">
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Frakció skinek
          </h1>

          <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72">
            Ezen az oldalon találhatóak meg a frakció tagjai számára beállítható
            karakter skinek. A frakció tagjai ezek közül választhatnak a
            karakterük megjelenéséhez.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 text-sm font-medium text-white/85">
          La Main Rouge frakció skinek:
        </div>

        <img
          src="/skinek.png"
          alt="La Main Rouge frakció skinek"
          className="block w-full rounded-2xl border border-white/10 bg-black/30 object-contain"
        />
      </section>
    </div>
  );
}