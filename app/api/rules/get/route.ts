import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const DEFAULT_CONTENT = {
  heroBadge: "La Main Rouge",
  heroTitle: "Frakciószabályzat",
  heroDescription:
    "Az alábbi szabályzat minden frakciótagra kötelező érvényű. A célja, hogy a közösség működése rendezett, követhető és egységes maradjon. A szabályok megszegése figyelmeztetést, hibapontot vagy súlyosabb esetben eltávolítást is eredményezhet.",
  infoCards: [
    {
      title: "Fontos alapelv",
      description:
        "A frakció szabályzata soha nem írja felül a szerverszabályzatot. Minden esetben először a szerver általános szabályai az irányadók.",
      tone: "amber",
    },
    {
      title: "Következmények",
      description:
        "A szabályszegések figyelmeztetést, hibapontot, rangbeli hátrányt vagy frakcióból való eltávolítást eredményezhetnek, a vétség súlyosságától függően.",
      tone: "red",
    },
  ],
  discordTitle: "Discord szerver szabályzat",
  discordCards: [
    {
      title: "Tiszteld a közösséget",
      bodyType: "paragraph",
      paragraphs: [
        "Ne rombold a hangulatot, és bánj tisztelettel mindenkivel. Nem megengedett a szidás, gúnyolódás vagy mások lenézése.",
      ],
    },
    {
      title: "Ne spammelj",
      bodyType: "paragraph",
      paragraphs: ["Kerüld a felesleges @ tag használatát."],
    },
    {
      title: "NSFW tartalom tilos",
      bodyType: "paragraph",
      paragraphs: [
        "Semmilyen 18+, erőszakos vagy más módon nem megfelelő tartalom nem megengedett.",
      ],
    },
    {
      title: "Maradj a témánál",
      bodyType: "paragraph",
      paragraphs: ["Csak az adott szoba témájához kapcsolódó tartalmakat ossz meg."],
    },
  ],
  factionTitle: "Frakciószabályzat",
  factionIntro: "Az alábbi szabályzat minden frakciótagra érvényes.",
  factionCards: [
    {
      title: "Általános frakciószabályok",
      bodyType: "list",
      items: [
        "A frakció szabályzata soha nem írja felül a szerverszabályzatot.",
        "Tilos engedély nélkül akciózni. Csak a frakció vezetőségének engedélyével lehet.",
        "Minden tagnak kötelező karaktertörténettel rendelkeznie.",
        "Nincs kivétel — ennek hiánya figyelmeztetést vonhat maga után.",
        "Tilos FUN kiegészítők hordása.",
        "Tilos civilt behozni HQ-ra. IRL barátnőt se.",
        "Tilos bármilyen féle illegális tárgyakat hirdetni, hogy elkerüljük a felesleges HQ raideket. Például: „Vásárolnék TEC-9 fegyvert”.",
        "Tilos ládanyitást hirdetni.",
        "Tilos a HQ előtt kereskedni.",
      ],
    },
    {
      title: "Kötelező bejelentések és aktivitás",
      bodyType: "list",
      items: [
        "Ha OOC szankciót kaptál, köteles vagy jelezni a ticket szobában.",
        "Inaktivitás esetén, ha az 3 napnál hosszabb, jelezd a ticket szobában.",
        "Ugyanitt kell bejelenteni, ha nevet váltasz.",
        "Ha fent vagy a szerveren, de nincs épp dolgod, köteles vagy megjelenni az aktuális RP-n.",
        "A tétlenség és aktivitáshiány hibapontot vonhat maga után.",
        "Reakció kötelező minden RP-re és akcióra.",
        "Aki nem reagál, hibapontot kap — kivételt képez, ha valaki munkában van vagy más valós elfoglaltsága van.",
      ],
    },
    {
      title: "Járművek és HQ rend",
      bodyType: "list",
      items: [
        "A frakció járműveit használat után mindig megszereltetve, a garázsban kell tárolni.",
        "Ennek elmulasztása a járműhasználati jog elvesztésével járhat.",
        "Helikoptert mindig le kell kézifékezni tetőn.",
        "Amennyiben akció során TK-s lesz a frakció kocsik vagy helikopterek, kötelesek vagytok azokat megjavíttatani, és garázsba lerakni.",
        "A javítás költségét csak akció esetén kapjátok vissza, kép formájában igazolt javítási számla bemutatásával.",
        "Ha saját célra használjátok, akkor is érvényben van ez a szabály, kivéve a javítási költség visszatérítése.",
      ],
    },
    {
      title: "Megjelenés és skin szabályok",
      bodyType: "list",
      items: [
        "Civil skin hordása engedélyezett, de csak a realitás határain belül.",
        "Öreg, FUN vagy nem illő skin használata tilos.",
        "Tilos koszosan megjelenni RP-n vagy akción.",
      ],
    },
    {
      title: "Hibapontok, rang-up és frakciófegyelem",
      bodyType: "list",
      items: [
        "A frakcióban hibapont rendszer működik.",
        "Minden hibapontot jelzünk a játékos felé.",
        "A 3. hibapont után automatikus eltávolítás következik.",
        "Rang-up általában havi rendszerességgel történik, de a vezetőség fenntartja a változtatás jogát.",
        "Tilos a vezetőket zaklatni rang-up miatt.",
        "Aki 1 hónapon belül kilép a frakcióból, FK Jump Jail büntetést kap.",
      ],
    },
    {
      title: "Leadandó, körözés, rádió és rangspecifikus szabályok",
      bodyType: "list",
      items: [
        "A körözés lelövése engedélyezett; aki szándékosan rakatja rá a körözést, figyelmeztetésben részesül. 3 figyelmeztetés után kirakás következik.",
        "Aki Candidat rangon van, vagyis nem beavatott, köteles elkerülni a lövöldözést és az illegális tevékenységet.",
        "Szigetezni és detektorozni viszont lehet.",
        "Tilos ládanyitást hirdetni.",
        "Aki nem teljesíti a leadandó mennyiséget, hibapontot kap.",
        "Candidat nem csatlakozhat a rádióra, csak beavatás után.",
        "Amennyiben ez megszegésre kerül, azonnali figyelmeztetés jár érte.",
      ],
    },
    {
      title: "Francia kifejezések használata",
      bodyType: "paragraph",
      tone: "blue",
      paragraphs: [
        "Mostantól mindenkit megkérünk, hogy az alap francia kifejezéseket, például bonjour, merci, au revoir és hasonló kifejezéseket használjátok a megfelelő helyzetekben.",
        "Az első egy-két hét során türelmesebbek leszünk azokkal, akik még újak ebben, azonban ezt követően a kifejezések mellőzése hibaponttal járó figyelmeztetést vonhat maga után.",
      ],
    },
  ],
  closingTitle: "Záró megjegyzés",
  closingParagraphs: [
    "A szabályzat célja nem a felesleges szigorítás, hanem az, hogy a frakció működése hosszú távon is rendezett, élvezhető és következetes maradjon minden tag számára.",
    "A vezetőség fenntartja a szabályzat módosításának jogát.",
  ],
};

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("faction_rules")
      .select("id,content,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("rules get error:", error);
      return NextResponse.json({ ok: true, id: null, content: DEFAULT_CONTENT, updated_at: null });
    }

    return NextResponse.json({
      ok: true,
      id: data?.id ?? null,
      content: data?.content ?? DEFAULT_CONTENT,
      updated_at: data?.updated_at ?? null,
    });
  } catch (e: any) {
    console.error("rules get fatal:", e);
    return NextResponse.json({ ok: true, id: null, content: DEFAULT_CONTENT, updated_at: null });
  }
}
