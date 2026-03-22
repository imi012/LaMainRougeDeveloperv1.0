"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DecisionBadge from "@/app/app/_components/decision-badge";
import RankBadge from "@/app/app/_components/rank-badge";

type MySubmission = {
  id: string;
  imgur_url: string;
  weeks: number;
  submitted_at: string;
  is_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
};

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

function looksLikeImgurUrl(v: string) {
  const s = (v || "").trim();
  if (!s) return false;
  return /(^https?:\/\/)?(www\.)?imgur\.com\//i.test(s) || /(^https?:\/\/)?i\.imgur\.com\//i.test(s);
}

export default function LeadandoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [imgurUrl, setImgurUrl] = useState("");
  const [weeks, setWeeks] = useState<string>("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [mine, setMine] = useState<MySubmission[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);

  async function loadToken() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setToken(null);
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    setToken(sess.session?.access_token ?? null);
  }

  async function loadMine(t: string | null) {
    setLoadingMine(true);
    setError(null);
    try {
      if (!t) {
        setMine([]);
        setLoadingMine(false);
        return;
      }
      const res = await fetch("/api/leadando/mine", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message || "Nem sikerült betölteni a leadandókat.");
      }
      setMine((json.rows ?? []) as MySubmission[]);
    } catch (e: any) {
      setMine([]);
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setLoadingMine(false);
    }
  }

  useEffect(() => {
    void loadToken();
  }, []);

  useEffect(() => {
    void loadMine(token);
  }, [token]);

  async function submit() {
    setError(null);
    setOkMsg(null);

    const u = imgurUrl.trim();
    const w = Number(weeks);

    if (!u) return setError("Az Imgur link megadása kötelező.");
    if (!looksLikeImgurUrl(u)) return setError("Kérlek, Imgur linket adj meg (imgur.com).");
    if (!weeks.trim()) return setError("A hetek száma kötelező.");
    if (!Number.isFinite(w) || w <= 0 || !Number.isInteger(w)) {
      return setError("A hetek száma csak pozitív egész szám lehet.");
    }
    if (!token) return setError("Nincs bejelentkezve.");

    setBusy(true);
    try {
      const res = await fetch("/api/leadando/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imgur_url: u, weeks: w }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message || "Nem sikerült beküldeni.");
      }

      setOkMsg("Sikeres beküldés! A vezetőség látja az adatlapodon.");
      setImgurUrl("");
      setWeeks("");
      await loadMine(token);
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lmr-page lmr-page-compact space-y-8">
      <section className="space-y-4">
        <div>
          <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Leadandó
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Leadandó beküldése
          </h1>
          <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">
            
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Tájékoztató</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-3 border-t border-white/10 pt-4 text-sm text-white/80">
            <div className="flex flex-wrap items-center gap-2">
              <RankBadge name="Soldat" />
              <span className="text-white/55">-</span>
              <RankBadge name="Veilleur" />
            </div>
            <div>
              <span className="font-semibold text-white">250k / hét</span>
            </div>
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4 text-sm text-white/80">
            <div className="flex flex-wrap items-center gap-2">
              <RankBadge name="Borreau" />
              <span className="text-white/55">-</span>
              <RankBadge name="Briscard" />
            </div>
            <div>
              <span className="font-semibold text-white">150k / hét</span>
            </div>
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4 text-sm text-white/80">
            <div className="flex flex-wrap items-center gap-2">
              <RankBadge name="Borreau" />
              <span className="text-white/55">-</span>
              <RankBadge name="Briscard Fondateur" />
            </div>
            <div>
              heti <span className="font-semibold text-white">2 RP-vel</span> kiválthatja.
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {okMsg && (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {okMsg}
        </div>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Leadandó beküldése</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
          <p className="mt-4 text-sm text-white/60">Mindkét mező kitöltése kötelező.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.14em] text-white/55">Imgur link</label>
            <input
              className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm"
              placeholder="Ide imgur linket kell feltölteni."
              value={imgurUrl}
              onChange={(e) => setImgurUrl(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.14em] text-white/55">
              Hány hétre adod le?
            </label>
            <input
              className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm"
              placeholder="pl. 2"
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              disabled={busy}
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={submit}
            disabled={busy || !token}
            className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-medium"
          >
            {busy ? "Küldés..." : "Beküldés"}
          </button>

          {!token && <div className="text-sm text-red-200/90">Nincs bejelentkezve.</div>}
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Beküldéseim</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
          <p className="mt-4 text-sm text-white/60">A legutóbbi leadandó beküldéseid.</p>
        </div>

        <div className="overflow-x-auto rounded-[24px] border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>Beküldve</th>
                <th>Hetek</th>
                <th>Imgur</th>
                <th>Állapot</th>
              </tr>
            </thead>
            <tbody>
              {loadingMine ? (
                <tr>
                  <td colSpan={4} className="text-white/65">
                    Betöltés...
                  </td>
                </tr>
              ) : mine.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-white/65">
                    Nincs beküldött leadandó.
                  </td>
                </tr>
              ) : (
                mine.map((x) => (
                  <tr key={x.id}>
                    <td>{fmt(x.submitted_at)}</td>
                    <td>{x.weeks}</td>
                    <td>
                      <span className="underline underline-offset-4">{x.imgur_url}</span>
                    </td>
                    <td>
                      <DecisionBadge value={x.is_approved ? "approved" : "pending"} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}