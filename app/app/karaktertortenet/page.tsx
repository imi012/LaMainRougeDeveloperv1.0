"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DecisionBadge from "@/app/app/_components/decision-badge";

type LoreRow = {
  id: string;
  discord_name: string | null;
  pastebin_url: string | null;
  lore_url: string | null;
  submitted_at: string;
  is_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

export default function Page() {
  const supabase = useMemo(() => createClient(), []);

  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [discordName, setDiscordName] = useState("");
  const [pastebinUrl, setPastebinUrl] = useState("");
  const [row, setRow] = useState<LoreRow | null>(null);

  async function authedFetch(url: string, init?: RequestInit) {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { ...init, headers });
    const text = await res.text();
    let json: any = {};

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }

    if (!res.ok || json?.ok === false) {
      throw new Error(json?.message || text || "Hiba történt.");
    }

    return json;
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);

        const [{ data: userData, error: userErr }, { data: sessData, error: sessErr }] =
          await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

        if (userErr) throw new Error(userErr.message || "Nem sikerült lekérni a felhasználót.");
        if (sessErr) throw new Error(sessErr.message || "Nem sikerült lekérni a munkamenetet.");
        if (!userData.user) throw new Error("Nincs bejelentkezve.");

        const accessToken = sessData.session?.access_token ?? null;
        if (!accessToken) throw new Error("Hiányzik a munkamenet token.");
        if (cancelled) return;

        setToken(accessToken);

        const res = await fetch("/api/lore/mine", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const text = await res.text();
        const json = text ? JSON.parse(text) : {};

        if (!res.ok || json?.ok === false) {
          throw new Error(json?.message || "Nem sikerült betölteni a karaktertörténetet.");
        }
        if (cancelled) return;

        const current = (json.row ?? null) as LoreRow | null;
        setRow(current);
        setDiscordName(current?.discord_name ?? "");
        setPastebinUrl(current?.pastebin_url ?? current?.lore_url ?? "");
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Hiba történt.");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function submitLore() {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const cleanDiscordName = discordName.trim();
      const cleanPastebinUrl = normalizeUrl(pastebinUrl);

      if (!cleanDiscordName) throw new Error("Add meg a Discord neved.");
      if (!cleanPastebinUrl) throw new Error("Add meg a karaktertörténet linkedet.");

      const json = await authedFetch("/api/lore/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discord_name: cleanDiscordName,
          pastebin_url: cleanPastebinUrl,
        }),
      });

      setRow((json.row ?? null) as LoreRow | null);
      setDiscordName(json.row?.discord_name ?? cleanDiscordName);
      setPastebinUrl(json.row?.pastebin_url ?? cleanPastebinUrl);
      setSuccess("Karaktertörténet sikeresen elmentve.");
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lmr-page lmr-page-compact">
      <section className="lmr-hero">
        <div className="max-w-4xl">
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Karaktertörténet
          </h1>

          <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72">
            Itt tudod leadni vagy frissíteni a karaktertörténetedet a vezetőség
            számára. A karaktered háttér storyja, megjelenése és viselkedése legyen
            illeszkedő a frakció tematikájához.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-white">Karakterútmutató</h2>
        <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />

        <div className="mt-6 space-y-3 text-sm leading-7 text-white/78">
          <p>Kedves új Tagjaink!</p>
          <p>• Az alap a francia név, hiszen mégiscsak egy francia MOB-ról van szó.</p>
          <p>• A tagok fiatalok, nagyjából 20–30 év közöttiek.</p>
          <p>
            • Gondolj ki egy érdekes, hiteles sztorit, ami megmagyarázza, hogyan
            kerültél ide.
          </p>
          <p>
            • Ne érkezz koszosan, csákánnyal a hátadon vagy virággal az oldaladon –
            kerüld a fun skineket és kiegészítőket.
          </p>
          <p>
            • A hierarchia alapvető: bánj tisztelettel mindenkivel, és úgy
            közeledj az adott személyhez a HQ-n, ahogy a rang megkívánja.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-white">Beküldés</h2>
        <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />

        <div className="mt-6 grid gap-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/82">
              Discord neved
            </label>
            <input
              value={discordName}
              onChange={(e) => setDiscordName(e.target.value)}
              placeholder="pl. valami_nev"
              className="w-full rounded-2xl border px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/82">
              Karaktertörténet linke (lehetőleg Pastebin)
            </label>
            <input
              value={pastebinUrl}
              onChange={(e) => setPastebinUrl(e.target.value)}
              placeholder="https://pastebin.com/..."
              className="w-full rounded-2xl border px-4 py-3 text-sm"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {success}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={submitLore}
              disabled={busy || !token}
              className="rounded-2xl border border-white/14 bg-white/[0.07] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.11] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy ? "Mentés..." : row ? "Frissítés" : "Beküldés"}
            </button>

            <div className="flex items-center gap-2 text-sm text-white/65">
              <span>Állapot:</span>
              {row ? (
                <DecisionBadge value={row.is_approved ? "approved" : "pending"} />
              ) : (
                <span className="text-white/72">Nincs még leadva</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-white">Jelenlegi leadás</h2>
        <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />

        <div className="mt-6 text-sm text-white/80">
          {row ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Discord név
                </div>
                <div className="mt-2 text-base font-medium text-white">
                  {row.discord_name || "—"}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Beküldve
                </div>
                <div className="mt-2 text-base font-medium text-white">
                  {fmt(row.submitted_at)}
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Link
                </div>
                <a
                  className="mt-2 inline-block break-all text-base text-white underline decoration-white/35 underline-offset-4 hover:text-white/82"
                  href={normalizeUrl(row.pastebin_url || row.lore_url || "")}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.pastebin_url || row.lore_url || "—"}
                </a>
              </div>
            </div>
          ) : (
            <div className="text-sm text-white/60">
              Még nincs leadott karaktertörténet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}