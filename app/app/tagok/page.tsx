"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Rank = {
  id: string;
  name: string;
  priority: number;
  is_archived: boolean;
};

type MemberRow = {
  user_id: string;
  ic_name: string | null;
  status: "preinvite" | "pending" | "active" | "inactive";
  site_role: "user" | "admin" | "owner";
  rank_id: string | null;
};

type MyProfile = {
  user_id: string;
  site_role: "user" | "admin" | "owner";
  rank_id: string | null;
};

type LeadandoRow = {
  user_id: string;
  approved_at: string | null;
};

type WarningRow = {
  id: string;
  user_id: string;
  is_active: boolean;
  expires_at: string | null;
};

function formatDateYMD(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export default function MembersPage() {
  const supabase = createClient();

  const [me, setMe] = useState<MyProfile | null>(null);
  const [myRank, setMyRank] = useState<Rank | null>(null);

  const [ranks, setRanks] = useState<Rank[]>([]);
  const [rows, setRows] = useState<MemberRow[]>([]);

  const [lastLeadandoByUser, setLastLeadandoByUser] = useState<Record<string, string | null>>({});
  const [warningCountByUser, setWarningCountByUser] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // figy. form
  const [warnOpenFor, setWarnOpenFor] = useState<string | null>(null);
  const [warnReason, setWarnReason] = useState("");
  const [warnExpires, setWarnExpires] = useState(""); // yyyy-mm-dd

  const canManage = useMemo(
    () => me?.site_role === "admin" || me?.site_role === "owner",
    [me]
  );
  const isOwner = me?.site_role === "owner";

  const rankMap = useMemo(() => {
    const m = new Map<string, Rank>();
    ranks.forEach((r) => m.set(r.id, r));
    return m;
  }, [ranks]);

  function canEditTarget(target: MemberRow) {
    if (!me) return false;

    if (me.site_role === "owner") return true;
    if (me.site_role !== "admin") return false;

    // admin nem piszkálhat ownert
    if (target.site_role === "owner") return false;

    // admin rangprioritás alapon: csak kisebbet tud állítani
    const myP = myRank?.priority ?? 0;
    const targetRank = target.rank_id ? rankMap.get(target.rank_id) : null;
    const targetP = targetRank?.priority ?? 0;

    return myP > targetP;
  }

  async function reloadAll() {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      setError("Nincs bejelentkezve.");
      setLoading(false);
      return;
    }

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("user_id,site_role,rank_id")
      .eq("user_id", user.id)
      .maybeSingle();

    setMe(myProfile as any);

    const { data: ranksData } = await supabase
      .from("ranks")
      .select("id,name,priority,is_archived")
      .eq("is_archived", false)
      .order("priority", { ascending: true });

    setRanks((ranksData ?? []) as any);

    if (myProfile?.rank_id) {
      const myR = (ranksData ?? []).find((r: any) => r.id === myProfile.rank_id) ?? null;
      setMyRank(myR as any);
    } else {
      setMyRank(null);
    }

    const { data: members, error: memErr } = await supabase
      .from("profiles")
      .select("user_id,ic_name,status,site_role,rank_id")
      .order("ic_name", { ascending: true });

    if (memErr) {
      setError(memErr.message);
      setLoading(false);
      return;
    }

    setRows((members ?? []) as any);

    // Leadandó: lekérjük az összes jóváhagyottat és kiszámoljuk a legutolsót userenként
    const { data: leadData, error: leadErr } = await supabase
      .from("leadando_submissions")
      .select("user_id,approved_at,is_approved")
      .eq("is_approved", true)
      .order("approved_at", { ascending: false });

    if (!leadErr) {
      const map: Record<string, string | null> = {};
      for (const it of (leadData ?? []) as any[]) {
        if (!map[it.user_id]) map[it.user_id] = it.approved_at ?? null;
      }
      setLastLeadandoByUser(map);
    }

    // Warnings: aktív + nem lejárt figyelmeztetések darabszáma
    const nowIso = new Date().toISOString();

    const { data: warnData, error: warnErr } = await supabase
      .from("warnings")
      .select("id,user_id,is_active,expires_at")
      .eq("is_active", true);

    if (!warnErr) {
      const map: Record<string, number> = {};
      for (const w of (warnData ?? []) as WarningRow[]) {
        const exp = w.expires_at ? new Date(w.expires_at).toISOString() : null;
        const valid = !exp || exp > nowIso;
        if (!valid) continue;
        map[w.user_id] = (map[w.user_id] ?? 0) + 1;
      }
      setWarningCountByUser(map);
    }

    setLoading(false);
  }

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateMember(user_id: string, patch: Partial<MemberRow>) {
    setError(null);
    setBusyUserId(user_id);

    const { error: upErr } = await supabase.from("profiles").update(patch).eq("user_id", user_id);
    if (upErr) {
      setError(upErr.message);
      setBusyUserId(null);
      return;
    }

    setRows((prev) => prev.map((r) => (r.user_id === user_id ? { ...r, ...patch } : r)));
    setBusyUserId(null);
  }

  async function addWarning(targetUserId: string) {
    if (!me) return;
    if (!canManage) return;
    if (!canEditTarget(rows.find((x) => x.user_id === targetUserId) as any)) return;

    const reason = warnReason.trim();
    if (!reason) {
      setError("Add meg a figyelmeztetés okát.");
      return;
    }

    const expiresAt =
      warnExpires.trim() !== ""
        ? new Date(`${warnExpires}T23:59:59`).toISOString()
        : null;

    setError(null);
    setBusyUserId(targetUserId);

    const { error: insErr } = await supabase.from("warnings").insert({
      user_id: targetUserId,
      reason,
      expires_at: expiresAt,
      issued_by: me.user_id,
      is_active: true,
    });

    if (insErr) {
      setError(insErr.message);
      setBusyUserId(null);
      return;
    }

    // UI frissítés: +1
    setWarningCountByUser((prev) => ({
      ...prev,
      [targetUserId]: (prev[targetUserId] ?? 0) + 1,
    }));

    setWarnOpenFor(null);
    setWarnReason("");
    setWarnExpires("");
    setBusyUserId(null);
  }

  if (loading) return <div className="p-6">Betöltés…</div>;

  return (
    <div className="max-w-7xl">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">Tagok</h1>
        <div className="ml-auto text-sm opacity-80">
          {canManage ? "Kezelő mód" : "Megtekintés"}
        </div>
      </div>

      <p className="mt-2 opacity-80">
        InGame név, rang, utolsó jóváhagyott leadandó és aktív figyelmeztetések száma.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
          {error}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 bg-white/5 px-4 py-3 text-xs font-semibold opacity-80">
          <div className="col-span-4">InGame név</div>
          <div className="col-span-3">Rang</div>
          <div className="col-span-2">Leadandó leadva eddig</div>
          <div className="col-span-1 text-center">Figy.</div>
          <div className="col-span-2 text-right">Művelet</div>
        </div>

        {rows.map((m) => {
          const isMe = me?.user_id === m.user_id;

          const targetEditable = canEditTarget(m);
          const rank = m.rank_id ? rankMap.get(m.rank_id) : null;

          // webjog: csak owner állíthat, és nem saját magán
          const canEditSiteRole = isOwner && !isMe && targetEditable;

          const leadUntil = lastLeadandoByUser[m.user_id] ?? null;
          const warnCount = warningCountByUser[m.user_id] ?? 0;

          return (
            <div key={m.user_id} className="border-t border-white/10">
              <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                <div className="col-span-4">
                  <div className="font-semibold">{m.ic_name ?? "—"}</div>
                  <div className="text-xs opacity-60">
                    <Link className="underline" href={`/app/profile?user=${m.user_id}`}>
                      Profil megnyitása
                    </Link>
                  </div>
                </div>

                <div className="col-span-3">
                  {canManage && targetEditable ? (
                    <select
                      className="w-full rounded-xl border border-white/15 bg-black px-3 py-2"
                      value={m.rank_id ?? ""}
                      onChange={(e) => updateMember(m.user_id, { rank_id: e.target.value || null })}
                      disabled={busyUserId === m.user_id}
                    >
                      <option value="">—</option>
                      {ranks.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="opacity-80">{rank?.name ?? "—"}</div>
                  )}
                </div>

                <div className="col-span-2">
                  <div className="opacity-80">{formatDateYMD(leadUntil)}</div>
                </div>

                <div className="col-span-1 text-center">
                  <div className="inline-flex min-w-9 justify-center rounded-full border border-white/15 px-2 py-1 text-xs">
                    {warnCount}
                  </div>
                </div>

                <div className="col-span-2 text-right flex justify-end gap-2">
                  {canManage && targetEditable ? (
                    <button
                      className="rounded-xl border border-white/15 px-3 py-2 hover:bg-white/5 text-sm"
                      onClick={() => setWarnOpenFor(warnOpenFor === m.user_id ? null : m.user_id)}
                    >
                      Figyelmeztetés
                    </button>
                  ) : (
                    <span className="text-sm opacity-60">—</span>
                  )}
                </div>
              </div>

              {/* Warning form row (vezetőség/owner) */}
              {warnOpenFor === m.user_id && canManage && targetEditable && (
                <div className="px-4 pb-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold mb-3">Figyelmeztetés hozzáadása</div>

                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-12 md:col-span-7">
                        <label className="text-xs opacity-70">Ok (csak te + az érintett látja)</label>
                        <input
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2"
                          value={warnReason}
                          onChange={(e) => setWarnReason(e.target.value)}
                          placeholder="Pl.: Szabályszegés / AFK / ..."
                        />
                      </div>

                      <div className="col-span-12 md:col-span-3">
                        <label className="text-xs opacity-70">Lejárat (opcionális)</label>
                        <input
                          type="date"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2"
                          value={warnExpires}
                          onChange={(e) => setWarnExpires(e.target.value)}
                        />
                      </div>

                      <div className="col-span-12 md:col-span-2 flex gap-2">
                        <button
                          className="w-full rounded-xl border border-white/15 px-3 py-2 hover:bg-white/5"
                          onClick={() => addWarning(m.user_id)}
                          disabled={busyUserId === m.user_id}
                        >
                          Mentés
                        </button>
                        <button
                          className="w-full rounded-xl border border-white/15 px-3 py-2 hover:bg-white/5"
                          onClick={() => {
                            setWarnOpenFor(null);
                            setWarnReason("");
                            setWarnExpires("");
                          }}
                        >
                          Mégse
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 text-xs opacity-60">
                      Megjegyzés: a részletes okok a profil oldalon lesznek listázva (csak saját + vezetőség).
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-sm opacity-70">
        <div>
          Szabály: owner = full. admin = rangot kezelhet (prioritás szerint), webjogot csak owner oszthat.
        </div>
      </div>
    </div>
  );
}