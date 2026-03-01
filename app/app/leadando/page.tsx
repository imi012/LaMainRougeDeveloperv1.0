"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  // minimál ellenőrzés: imgur domain legyen benne
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
    // lock-biztosabban: getUser -> getSession
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
    (async () => {
      await loadToken();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMine(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submit() {
    setError(null);
    setOkMsg(null);

    const u = imgurUrl.trim();
    const w = Number(weeks);

    if (!u) {
      setError("Az Imgur link megadása kötelező.");
      return;
    }
    if (!looksLikeImgurUrl(u)) {
      setError("Kérlek, Imgur linket adj meg (imgur.com).");
      return;
    }
    if (!weeks.trim()) {
      setError("A hetek száma kötelező.");
      return;
    }
    if (!Number.isFinite(w) || w <= 0 || !Number.isInteger(w)) {
      setError("A hetek száma csak pozitív egész szám lehet.");
      return;
    }
    if (!token) {
      setError("Nincs bejelentkezve.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/leadando/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imgur_url: u,
          weeks: w,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message || "Nem sikerült beküldeni.");
      }

      setOkMsg("Sikeres beküldés! A vezetőség látja az adatlapodon.");
      setImgurUrl("");
      setWeeks("");

      // frissítsük a listát
      await loadMine(token);
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Leadandó</h1>
      <p className="mt-1 text-sm opacity-80">Kérdőív kitöltése és leadandó beküldése.</p>

      {/* Tájékoztató */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
        <div className="text-lg font-semibold">Tájékoztató</div>
        <div className="mt-2 space-y-1 text-sm opacity-90">
          <div>Soldat - Vellieur: <span className="font-semibold">250k/hét</span></div>
          <div>Borreau - Briscard: <span className="font-semibold">150k/hét</span></div>
          <div>Borreautól - Decopeur-ig lehetséges heti <span className="font-semibold">2 RP</span>-vel kiváltani a leadandót.</div>
        </div>
      </div>

      {/* Hibák / siker */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {okMsg && (
        <div className="mt-4 rounded-xl border border-green-500/30 bg-green-900/20 p-3 text-sm text-green-200">
          {okMsg}
        </div>
      )}

      {/* Űrlap */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
        <div className="text-lg font-semibold">Leadandó beküldése</div>
        <div className="mt-1 text-sm opacity-80">Mindkét mező kitöltése kötelező.</div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="text-sm opacity-80">Leadandó feltöltéséről készült kép (Imgur link)</div>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              placeholder="Ide imgur linket kell feltölteni."
              value={imgurUrl}
              onChange={(e) => setImgurUrl(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <div className="text-sm opacity-80">Hány hétre adod le a leadandót?</div>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              placeholder="pl. 2"
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              disabled={busy}
              inputMode="numeric"
            />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={busy || !token}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
        >
          {busy ? "Küldés..." : "Beküldés"}
        </button>

        {!token && (
          <div className="mt-3 text-sm text-red-200 opacity-90">
            Nincs bejelentkezve.
          </div>
        )}
      </div>

      {/* Saját beküldések */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
        <div className="text-lg font-semibold">Beküldéseim</div>
        <div className="mt-1 text-sm opacity-80">A legutóbbi leadandó beküldéseid.</div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left">
                <th className="px-3 py-2">Beküldve</th>
                <th className="px-3 py-2">Hetek</th>
                <th className="px-3 py-2">Imgur</th>
                <th className="px-3 py-2">Állapot</th>
              </tr>
            </thead>
            <tbody>
              {loadingMine ? (
                <tr>
                  <td className="px-3 py-3 opacity-70" colSpan={4}>
                    Betöltés...
                  </td>
                </tr>
              ) : mine.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 opacity-70" colSpan={4}>
                    Nincs beküldött leadandó.
                  </td>
                </tr>
              ) : (
                mine.map((x) => (
                  <tr key={x.id} className="border-t border-white/10">
                    <td className="px-3 py-2">{fmt(x.submitted_at)}</td>
                    <td className="px-3 py-2">{x.weeks}</td>
                    <td className="px-3 py-2">
                      <span className="underline">{x.imgur_url}</span>
                    </td>
                    <td className="px-3 py-2">
                      {x.is_approved ? "Approved" : "Pending"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}