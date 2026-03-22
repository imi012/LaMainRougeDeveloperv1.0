import Image from "next/image";

export default function AppHomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <section className="relative overflow-hidden rounded-[36px] px-4 py-10 md:px-10 md:py-14">
        <div className="absolute inset-0 rounded-[36px] bg-[radial-gradient(circle_at_top,rgba(140,0,0,0.14),rgba(0,0,0,0.10)_35%,rgba(0,0,0,0.18)_100%)]" />
        <div className="relative z-10">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <div className="relative mb-4 h-48 w-48 md:h-72 md:w-72">
              <Image
                src="/logo-tetsuryu.png"
                alt="Tetsuryū-kai logó"
                fill
                className="object-contain drop-shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
                priority
              />
            </div>

            <p className="mb-2 text-lg font-medium text-white/90 md:text-2xl">
  義理と人情を忘れるな
</p>

<p className="mb-2 text-sm text-white/60 md:text-base">
  Soha ne feledd a kötelességet és az emberiességet.
</p>

            <h1 className="mb-6 text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Üdvözöljük a Tetsuryū-Kai weboldalán
            </h1>

            <p className="max-w-4xl text-base leading-8 text-white/76 md:text-lg">
              Ez a felület a frakció belső oldala, ahol egy helyen érhetők el a
              frakcióra vonatkozó legfontosabb információk és dokumentációs
              lehetőségek. A cél, hogy az új tagok, a frakció tagjai és a
              vezetőség gyorsan és átláthatóan tudja intézni a frakciós ügyeket.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 border-t border-white/8 pt-8 md:mt-10 md:pt-10">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              TGF információk
            </h2>

            <div className="mt-5 h-[2px] w-12 rounded-full bg-red-600/80" />

            <div className="mt-6 space-y-4 text-base leading-8 text-white/74">
              <p>
                Az oldalon jogrendszer működik, ezért néhány funkció és
                dokumentáció csak a frakció tagjai számára érhető el.
              </p>

              <p>
                Ha sikeresen teljesíted a tagfelvételi folyamatot, hozzáférést
                kapsz az oldal belső részeihez, ahol megtalálod a frakció
                működéséhez szükséges információkat és dokumentációkat.
              </p>

              <p>További információkat a menüben találsz.</p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              A frakcióról
            </h2>

            <div className="mt-5 h-[2px] w-12 rounded-full bg-red-600/80" />

            <div className="mt-6 space-y-4 text-base leading-8 text-white/74">
              <p>
                A LaMainRouge egy francia hátterű MOB szervezet, amely a
                szerveren az alvilági szerepjátékot képviseli.
              </p>

              <p>
                A frakció működése a szervezettségre, a belső rendre és a
                hierarchiára épül, miközben az utcai jelenlét és a
                kapcsolatrendszer is fontos szerepet játszik.
              </p>
            </div>

            <div className="mt-10">
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Mi az a MOB?
              </h2>

              <div className="mt-5 h-[2px] w-12 rounded-full bg-red-600/80" />

              <div className="mt-6 space-y-4 text-base leading-8 text-white/74">
                <p>
                  A MOB egy szervezett bűnözői csoport megnevezése, amely
                  működésében a klasszikus maffia és az utcai bandák egyes
                  jellemzőit ötvözi.
                </p>

                <p>
                  Az ilyen szervezetek hierarchikus felépítésűek, saját
                  vezetéssel és rangrendszerrel rendelkeznek.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}