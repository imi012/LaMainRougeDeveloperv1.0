export default function SzotarPage() {
  return (
    <div className="lmr-page lmr-page-wide">
      <div className="space-y-14">
        <section className="lmr-hero">
          <div className="max-w-4xl space-y-5">
            <p className="lmr-kicker">Szótár</p>
            <h1 className="lmr-title">Francia–magyar szótár</h1>
            <p className="lmr-text max-w-3xl">
              Egy gyors és könnyen átlátható francia szógyűjtemény az RP színesítésére.
            </p>
          </div>
        </section>

        <section className="space-y-7">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              1. Köszönések &amp; Elköszönések
            </h2>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-1/2" />
                <col className="w-1/2" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Magyarul
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Franciául
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Helló / Jó napot</td>
                  <td className="px-4 py-4 text-white">Bonjour</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Jó estét</td>
                  <td className="px-4 py-4 text-white">Bonsoir</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Jó éjt</td>
                  <td className="px-4 py-4 text-white">Bonne nuit</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Viszlát</td>
                  <td className="px-4 py-4 text-white">Au revoir</td>
                </tr>
                <tr>
                  <td className="px-4 py-4 text-white/85">Szia</td>
                  <td className="px-4 py-4 text-white">Salut</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-1/2" />
                <col className="w-1/2" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Magyarul
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Franciául
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Igen</td>
                  <td className="px-4 py-4 text-white">Oui</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Nem</td>
                  <td className="px-4 py-4 text-white">Non</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Köszönöm</td>
                  <td className="px-4 py-4 text-white">Merci</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Kérem</td>
                  <td className="px-4 py-4 text-white">S’il vous plaît</td>
                </tr>
                <tr>
                  <td className="px-4 py-4 text-white/85">Szívesen</td>
                  <td className="px-4 py-4 text-white">De rien</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-7">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              2. Udvariassági kifejezések
            </h2>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-1/2" />
                <col className="w-1/2" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Magyarul
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Franciául
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Köszönöm / Nagyon köszönöm</td>
                  <td className="px-4 py-4 text-white">Merci / Merci beaucoup</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Szívesen</td>
                  <td className="px-4 py-4 text-white">De rien</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Kérem</td>
                  <td className="px-4 py-4 text-white">S’il vous plaît</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Elnézést</td>
                  <td className="px-4 py-4 text-white">Excusez-moi</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Örvendek</td>
                  <td className="px-4 py-4 text-white">Enchanté</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Nagyon szívesen (udvariasabb)</td>
                  <td className="px-4 py-4 text-white">Je vous en prie</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Bocsánat</td>
                  <td className="px-4 py-4 text-white">Pardon</td>
                </tr>
                <tr className="border-b border-white/6">
                  <td className="px-4 py-4 text-white/85">Örömmel</td>
                  <td className="px-4 py-4 text-white">Avec plaisir</td>
                </tr>
                <tr>
                  <td className="px-4 py-4 text-white/85">Sajnálom</td>
                  <td className="px-4 py-4 text-white">Désolé(e)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-7">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              3. Megszólítások &amp; Emberek
            </h2>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-1/2" />
                <col className="w-1/2" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Magyarul
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Franciául
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Uram</td><td className="px-4 py-4 text-white">Monsieur</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Hölgyem</td><td className="px-4 py-4 text-white">Madame</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Kisasszony</td><td className="px-4 py-4 text-white">Mademoiselle</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Férfi</td><td className="px-4 py-4 text-white">Homme</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Nő</td><td className="px-4 py-4 text-white">Femme</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Fiú / pincér</td><td className="px-4 py-4 text-white">Garçon</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Lány</td><td className="px-4 py-4 text-white">Fille</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Pasi / csávó</td><td className="px-4 py-4 text-white">Mec</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Tesó</td><td className="px-4 py-4 text-white">Frère</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Csaj</td><td className="px-4 py-4 text-white">Nana / Meuf</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Főnök</td><td className="px-4 py-4 text-white">Chef</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Barátom</td><td className="px-4 py-4 text-white">Mon ami</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Haver</td><td className="px-4 py-4 text-white">Mon gars</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Zsaru</td><td className="px-4 py-4 text-white">Flic</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Pénz</td><td className="px-4 py-4 text-white">Thune</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Haver</td><td className="px-4 py-4 text-white">Pote</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Meló</td><td className="px-4 py-4 text-white">Boulot</td></tr>
                <tr><td className="px-4 py-4 text-white/85">Kaja</td><td className="px-4 py-4 text-white">Bouffe</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-7">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              4. Alap társalgási kifejezések
            </h2>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-1/2" />
                <col className="w-1/2" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Magyarul
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Franciául
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Hogy vagy?</td><td className="px-4 py-4 text-white">Comment ça va ?</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Jól / Oké</td><td className="px-4 py-4 text-white">Ça va / Ça va bien</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">És te?</td><td className="px-4 py-4 text-white">Et toi ?</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Igen / Nem</td><td className="px-4 py-4 text-white">Oui / Non</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Talán</td><td className="px-4 py-4 text-white">Peut-être</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Nem tudom</td><td className="px-4 py-4 text-white">Je ne sais pas</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Rendben</td><td className="px-4 py-4 text-white">D’accord</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Nos / Akkor</td><td className="px-4 py-4 text-white">Alors</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Rendben van</td><td className="px-4 py-4 text-white">C’est bon</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Semmi gond</td><td className="px-4 py-4 text-white">Pas de problème</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Természetesen</td><td className="px-4 py-4 text-white">Bien sûr</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Egyáltalán nem</td><td className="px-4 py-4 text-white">Pas du tout</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Pontosan</td><td className="px-4 py-4 text-white">Exactement</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Mint mindig</td><td className="px-4 py-4 text-white">Comme d’habitude</td></tr>
                <tr><td className="px-4 py-4 text-white/85">Attól függ</td><td className="px-4 py-4 text-white">Ça dépend</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-7">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              5. Reakciók &amp; Mindennapi beszéd
            </h2>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-1/2" />
                <col className="w-1/2" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Magyarul
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Franciául
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Ilyen az élet</td><td className="px-4 py-4 text-white">C’est la vie</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Vigyázz</td><td className="px-4 py-4 text-white">Fais attention</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Hagyd / Felejtsd el</td><td className="px-4 py-4 text-white">Laisse tomber</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Minden oké</td><td className="px-4 py-4 text-white">Ça roule</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Ne aggódj</td><td className="px-4 py-4 text-white">T’inquiète</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Hajrá! / Rajta!</td><td className="px-4 py-4 text-white">Vas-y !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Tökéletes</td><td className="px-4 py-4 text-white">Nickel</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Nyugi / Laza</td><td className="px-4 py-4 text-white">Tranquille</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Nagyon / Tényleg</td><td className="px-4 py-4 text-white">Grave !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Oké, megy</td><td className="px-4 py-4 text-white">Ça marche</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Így</td><td className="px-4 py-4 text-white">Comme ça</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Elég!</td><td className="px-4 py-4 text-white">Ça suffit</td></tr>
                <tr><td className="px-4 py-4 text-white/85">Minden rendben</td><td className="px-4 py-4 text-white">Tout va bien</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-7">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              6. Indulatszavak &amp; Erősebb szleng
            </h2>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-1/2" />
                <col className="w-1/2" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Magyarul
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                    Franciául
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">A francba!</td><td className="px-4 py-4 text-white">Merde !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">A fenébe!</td><td className="px-4 py-4 text-white">Putain !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Fene egye meg!</td><td className="px-4 py-4 text-white">Bordel !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Ejha!</td><td className="px-4 py-4 text-white">Zut !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Hűha!</td><td className="px-4 py-4 text-white">Oh là là !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Ez őrület!</td><td className="px-4 py-4 text-white">C’est fou !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Megőrültél?!</td><td className="px-4 py-4 text-white">T’es dingue !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Megőrültél?! (szleng)</td><td className="px-4 py-4 text-white">T’es ouf !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Micsoda káosz!</td><td className="px-4 py-4 text-white">Quel bordel !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">A francba! (enyhébb)</td><td className="px-4 py-4 text-white">Mince !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Ez béna!</td><td className="px-4 py-4 text-white">C’est nul !</td></tr>
                <tr className="border-b border-white/6"><td className="px-4 py-4 text-white/85">Ez gáz!</td><td className="px-4 py-4 text-white">Ça craint !</td></tr>
                <tr><td className="px-4 py-4 text-white/85">Azta!</td><td className="px-4 py-4 text-white">La vache !</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}