"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type InfoCard = {
  title: string;
  description: string;
  tone: "amber" | "red";
};

type RuleCard = {
  title: string;
  bodyType: "paragraph" | "list";
  paragraphs?: string[];
  items?: string[];
  tone?: "default" | "blue";
};

type RulesContent = {
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  infoCards: InfoCard[];
  discordTitle: string;
  discordCards: RuleCard[];
  factionTitle: string;
  factionIntro: string;
  factionCards: RuleCard[];
  closingTitle: string;
  closingParagraphs: string[];
};

type RulesPayload = {
  id: string | null;
  content: RulesContent;
  updated_at: string | null;
};

const DEFAULT_CONTENT: RulesContent = {
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

function cloneDefaultContent() {
  return JSON.parse(JSON.stringify(DEFAULT_CONTENT)) as RulesContent;
}

function normalizeContent(input: any): RulesContent {
  const fallback = cloneDefaultContent();
  if (!input || typeof input !== "object") return fallback;

  return {
    heroBadge: typeof input.heroBadge === "string" && input.heroBadge.trim() ? input.heroBadge : fallback.heroBadge,
    heroTitle: typeof input.heroTitle === "string" && input.heroTitle.trim() ? input.heroTitle : fallback.heroTitle,
    heroDescription:
      typeof input.heroDescription === "string" && input.heroDescription.trim()
        ? input.heroDescription
        : fallback.heroDescription,
    infoCards: Array.isArray(input.infoCards) && input.infoCards.length === fallback.infoCards.length
      ? input.infoCards.map((card: any, index: number) => ({
          title: typeof card?.title === "string" && card.title.trim() ? card.title : fallback.infoCards[index].title,
          description:
            typeof card?.description === "string" && card.description.trim()
              ? card.description
              : fallback.infoCards[index].description,
          tone: card?.tone === "red" ? "red" : "amber",
        }))
      : fallback.infoCards,
    discordTitle:
      typeof input.discordTitle === "string" && input.discordTitle.trim() ? input.discordTitle : fallback.discordTitle,
    discordCards: Array.isArray(input.discordCards) && input.discordCards.length === fallback.discordCards.length
      ? input.discordCards.map((card: any, index: number) => ({
          title: typeof card?.title === "string" && card.title.trim() ? card.title : fallback.discordCards[index].title,
          bodyType: "paragraph",
          paragraphs: Array.isArray(card?.paragraphs) && card.paragraphs.length > 0
            ? card.paragraphs.map((p: any) => (typeof p === "string" ? p : "")).filter(Boolean)
            : fallback.discordCards[index].paragraphs,
        }))
      : fallback.discordCards,
    factionTitle:
      typeof input.factionTitle === "string" && input.factionTitle.trim() ? input.factionTitle : fallback.factionTitle,
    factionIntro:
      typeof input.factionIntro === "string" && input.factionIntro.trim() ? input.factionIntro : fallback.factionIntro,
    factionCards: Array.isArray(input.factionCards) && input.factionCards.length === fallback.factionCards.length
      ? input.factionCards.map((card: any, index: number) => ({
          title: typeof card?.title === "string" && card.title.trim() ? card.title : fallback.factionCards[index].title,
          bodyType: fallback.factionCards[index].bodyType,
          tone: fallback.factionCards[index].tone,
          paragraphs:
            fallback.factionCards[index].bodyType === "paragraph"
              ? Array.isArray(card?.paragraphs) && card.paragraphs.length > 0
                ? card.paragraphs.map((p: any) => (typeof p === "string" ? p : "")).filter(Boolean)
                : fallback.factionCards[index].paragraphs
              : undefined,
          items:
            fallback.factionCards[index].bodyType === "list"
              ? Array.isArray(card?.items) && card.items.length > 0
                ? card.items.map((item: any) => (typeof item === "string" ? item : "")).filter(Boolean)
                : fallback.factionCards[index].items
              : undefined,
        }))
      : fallback.factionCards,
    closingTitle:
      typeof input.closingTitle === "string" && input.closingTitle.trim() ? input.closingTitle : fallback.closingTitle,
    closingParagraphs: Array.isArray(input.closingParagraphs) && input.closingParagraphs.length > 0
      ? input.closingParagraphs.map((p: any) => (typeof p === "string" ? p : "")).filter(Boolean)
      : fallback.closingParagraphs,
  };
}

function splitMultiline(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinMultiline(values?: string[]) {
  return (values ?? []).join("\n");
}

function cardToneClass(tone?: "default" | "blue") {
  if (tone === "blue") {
    return "rounded-[24px] border border-sky-400/18 bg-sky-400/7 p-5 md:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl";
  }
  return "rounded-[24px] border border-white/10 bg-white/[0.035] p-5 md:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl";
}

function infoToneClass(tone: "amber" | "red") {
  return tone === "red"
    ? "rounded-[24px] border border-red-400/20 bg-red-400/8 p-5 md:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl"
    : "rounded-[24px] border border-amber-400/20 bg-amber-400/8 p-5 md:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl";
}

export default function SzabalyzatPage() {
  const supabase = useMemo(() => createClient(), []);

  const [content, setContent] = useState<RulesContent>(cloneDefaultContent());
  const [rowId, setRowId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLeadership, setIsLeadership] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const [rulesRes, authRes] = await Promise.all([
          fetch("/api/rules/get", { cache: "no-store" }),
          supabase.auth.getUser(),
        ]);

        const rulesJson = await rulesRes.json().catch(() => null);
        if (!rulesRes.ok || !rulesJson?.ok) {
          throw new Error(rulesJson?.message || "Nem sikerült betölteni a szabályzatot.");
        }

        if (!mounted) return;
        setRowId(rulesJson.id ?? null);
        setUpdatedAt(rulesJson.updated_at ?? null);
        setContent(normalizeContent(rulesJson.content));

        const user = authRes.data.user;
        if (!user) {
          setIsLeadership(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("status,site_role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          throw new Error(profileError.message || "Nem sikerült ellenőrizni a jogosultságot.");
        }

        if (!mounted) return;
        const allowed =
          profile?.site_role === "owner" ||
          profile?.site_role === "admin" ||
                    profile?.status === "leadership";

        setIsLeadership(Boolean(allowed));
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Hiba történt.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function withAccessToken() {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(sessionError.message || "Nem sikerült lekérni a munkamenetet.");
    }
    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Nincs bejelentkezve.");
    }
    return token;
  }

  async function saveRules() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await withAccessToken();
      const res = await fetch("/api/admin/rules/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: rowId, content }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "Nem sikerült menteni a szabályzatot.");
      }

      setRowId(json.id ?? rowId);
      setUpdatedAt(json.updated_at ?? updatedAt);
      setContent(normalizeContent(json.content));
      setEditing(false);
      setSuccess("Szabályzat sikeresen elmentve.");
    } catch (e: any) {
      setError(e?.message || "Nem sikerült menteni a szabályzatot.");
    } finally {
      setSaving(false);
    }
  }

  function resetToDefault() {
    setContent(cloneDefaultContent());
    setSuccess(null);
    setError(null);
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl rounded-[28px] border border-white/10 bg-white/[0.035] p-6 text-sm text-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">Betöltés...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] px-6 py-6 md:px-8 md:py-8 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="space-y-4">
          <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            {content.heroBadge}
          </span>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">{content.heroTitle}</h1>

              <p className="max-w-3xl text-sm leading-7 text-white/75 md:text-base">{content.heroDescription}</p>
            </div>

            {isLeadership ? (
              <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                {!editing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setSuccess(null);
                      setError(null);
                    }}
                    className="rounded-2xl border border-white/14 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                  >
                    Szabályzat szerkesztése
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={resetToDefault}
                      className="rounded-2xl border border-white/14 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                    >
                      Alapértelmezett visszaállítása
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setSuccess(null);
                        setError(null);
                      }}
                      className="rounded-2xl border border-white/14 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                    >
                      Mégse
                    </button>
                    <button
                      type="button"
                      onClick={saveRules}
                      disabled={saving}
                      className="rounded-2xl border border-emerald-400/22 bg-emerald-400/12 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/18 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Mentés..." : "Mentés"}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>

          {updatedAt ? <p className="text-xs text-white/45">Legutóbb frissítve: {new Date(updatedAt).toLocaleString("hu-HU")}</p> : null}
          {error ? <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
          {success ? <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div> : null}
        </div>
      </section>

      {editing && isLeadership ? (
        <section className="space-y-6 rounded-[28px] border border-white/10 bg-white/[0.035] p-6 md:p-8 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div>
            <h2 className="text-2xl font-semibold">Vezetőségi szerkesztő</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Az alábbi mezők szerkesztik a jelenlegi, hosszabb szabályzat oldalt. A mentés után a tagok ugyanebben a blokkos kinézetben fogják látni a tartalmat.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-semibold text-white/80">Felső badge</span>
              <input
                value={content.heroBadge}
                onChange={(e) => setContent((prev) => ({ ...prev, heroBadge: e.target.value }))}
                className="w-full rounded-2xl border px-4 py-3 text-sm"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-semibold text-white/80">Főcím</span>
              <input
                value={content.heroTitle}
                onChange={(e) => setContent((prev) => ({ ...prev, heroTitle: e.target.value }))}
                className="w-full rounded-2xl border px-4 py-3 text-sm"
              />
            </label>
          </div>

          <label className="block space-y-2 text-sm">
            <span className="font-semibold text-white/80">Bevezető leírás</span>
            <textarea
              value={content.heroDescription}
              onChange={(e) => setContent((prev) => ({ ...prev, heroDescription: e.target.value }))}
              className="h-32 w-full rounded-2xl border px-4 py-3 text-sm"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            {content.infoCards.map((card, index) => (
              <div key={`info-${index}`} className="space-y-3 rounded-[24px] border border-white/10 bg-white/[0.035] p-4 md:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                <div className="text-sm font-semibold text-white/80">Felső információs kártya #{index + 1}</div>
                <input
                  value={card.title}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      infoCards: prev.infoCards.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)),
                    }))
                  }
                  className="w-full rounded-2xl border px-4 py-3 text-sm"
                />
                <textarea
                  value={card.description}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      infoCards: prev.infoCards.map((item, i) => (i === index ? { ...item, description: e.target.value } : item)),
                    }))
                  }
                  className="h-28 w-full rounded-2xl border px-4 py-3 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-4 md:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <input
              value={content.discordTitle}
              onChange={(e) => setContent((prev) => ({ ...prev, discordTitle: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none"
            />

            {content.discordCards.map((card, index) => (
              <div key={`discord-${index}`} className="space-y-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                <input
                  value={card.title}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      discordCards: prev.discordCards.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)),
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none"
                />
                <textarea
                  value={joinMultiline(card.paragraphs)}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      discordCards: prev.discordCards.map((item, i) =>
                        i === index ? { ...item, paragraphs: splitMultiline(e.target.value) } : item
                      ),
                    }))
                  }
                  className="h-28 w-full rounded-2xl border px-4 py-3 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-4 md:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <input
              value={content.factionTitle}
              onChange={(e) => setContent((prev) => ({ ...prev, factionTitle: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none"
            />
            <textarea
              value={content.factionIntro}
              onChange={(e) => setContent((prev) => ({ ...prev, factionIntro: e.target.value }))}
              className="h-24 w-full rounded-2xl border px-4 py-3 text-sm"
            />

            {content.factionCards.map((card, index) => (
              <div key={`faction-${index}`} className="space-y-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                <input
                  value={card.title}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      factionCards: prev.factionCards.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)),
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none"
                />

                {card.bodyType === "list" ? (
                  <textarea
                    value={joinMultiline(card.items)}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        factionCards: prev.factionCards.map((item, i) =>
                          i === index ? { ...item, items: splitMultiline(e.target.value) } : item
                        ),
                      }))
                    }
                    className="h-48 w-full rounded-2xl border px-4 py-3 text-sm"
                  />
                ) : (
                  <textarea
                    value={joinMultiline(card.paragraphs)}
                    onChange={(e) =>
                      setContent((prev) => ({
                        ...prev,
                        factionCards: prev.factionCards.map((item, i) =>
                          i === index ? { ...item, paragraphs: splitMultiline(e.target.value) } : item
                        ),
                      }))
                    }
                    className="h-32 w-full rounded-2xl border px-4 py-3 text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-4 md:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <input
              value={content.closingTitle}
              onChange={(e) => setContent((prev) => ({ ...prev, closingTitle: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none"
            />
            <textarea
              value={joinMultiline(content.closingParagraphs)}
              onChange={(e) => setContent((prev) => ({ ...prev, closingParagraphs: splitMultiline(e.target.value) }))}
              className="h-32 w-full rounded-2xl border px-4 py-3 text-sm"
            />
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {content.infoCards.map((card, index) => (
          <div key={`info-view-${index}`} className={infoToneClass(card.tone)}>
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-white/80">{card.description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-6 md:p-8 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold">📜</div>
          <h2 className="text-2xl font-semibold">{content.discordTitle}</h2>
        </div>

        <div className="mt-6 grid gap-4">
          {content.discordCards.map((card, index) => (
            <div key={`discord-view-${index}`} className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 md:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <div className="mt-3 space-y-3 text-sm leading-7 text-white/80">
                {(card.paragraphs ?? []).map((paragraph, pIndex) => (
                  <p key={`discord-paragraph-${index}-${pIndex}`}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-6 md:p-8 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold">📘</div>
          <h2 className="text-2xl font-semibold">{content.factionTitle}</h2>
        </div>

        <p className="mt-4 text-sm leading-7 text-white/75">{content.factionIntro}</p>

        <div className="mt-6 space-y-6">
          {content.factionCards.map((card, index) => (
            <div key={`faction-view-${index}`} className={cardToneClass(card.tone)}>
              <h3 className="text-lg font-semibold">{card.title}</h3>

              {card.bodyType === "list" ? (
                <ul className="mt-4 space-y-3 text-sm leading-7 text-white/80">
                  {(card.items ?? []).map((item, itemIndex) => (
                    <li key={`faction-item-${index}-${itemIndex}`}>• {item}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 space-y-3 text-sm leading-7 text-white/80">
                  {(card.paragraphs ?? []).map((paragraph, paragraphIndex) => (
                    <p key={`faction-paragraph-${index}-${paragraphIndex}`}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-white/[0.02] p-6">
        <h2 className="text-xl font-semibold">{content.closingTitle}</h2>
        <div className="mt-3 space-y-3 text-sm leading-7 text-white/75">
          {content.closingParagraphs.map((paragraph, index) => (
            <p key={`closing-${index}`}>{paragraph}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
