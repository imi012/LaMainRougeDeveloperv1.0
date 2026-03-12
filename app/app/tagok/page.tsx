"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isLeadershipProfile } from "@/lib/permissions";
import RankBadge from "@/app/app/_components/rank-badge";

type Rank = {
  id: string;
  name: string;
  priority: number;
  is_archived: boolean;
};

type MemberStatus = "preinvite" | "pending" | "active" | "leadership" | "inactive";

type MemberRow = {
  user_id: string;
  ic_name: string | null;
  status: MemberStatus | string | null;
  site_role: "user" | "admin" | "owner" | string | null;
  rank_id: string | null;
};

type MyProfile = {
  user_id: string;
  site_role: "user" | "admin" | "owner" | string | null;
  status: MemberStatus | string | null;
  rank_id: string | null;
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

function isVisibleMemberStatus(status: string | null | undefined) {
  return status === "pending" || status === "active" || status === "leadership";
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("hu");
}

function sortMembersByRankPriority(rows: MemberRow[], ranks: Rank[]) {
  const rankMap = new Map<string, Rank>();
  ranks.forEach((r) => rankMap.set(r.id, r));

  return [...rows].sort((a, b) => {
    const aRank = a.rank_id ? rankMap.get(a.rank_id) : null;
    const bRank = b.rank_id ? rankMap.get(b.rank_id) : null;

    const aPriority = aRank?.priority ?? Number.MAX_SAFE_INTEGER;
    const bPriority = bRank?.priority ?? Number.MAX_SAFE_INTEGER;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return normalizeName(a.ic_name).localeCompare(normalizeName(b.ic_name), "hu");
  });
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

  const [warnOpenFor, setWarnOpenFor] = useState<string | null>(null);
  const [warnReason, setWarnReason] = useState("");
  const [warnExpires, setWarnExpires] = useState("");

  const canManage = useMemo(() => isLeadershipProfile(me), [me]);
  const isOwner = me?.site_role === "owner";

  const rankMap = useMemo(() => {
    const m = new Map<string, Rank>();
    ranks.forEach((r) => m.set(r.id, r));
    return m;
  }, [ranks]);

  const assignableRanks = useMemo(() => {
    if (!canManage) return [];
    const visible = [...ranks].filter((r) => !r.is_archived).sort((a, b) => a.priority - b.priority);

    if (isOwner) return visible;
    if (!myRank) return visible;

    return visible.filter((r) => r.priority >= myRank.priority);
  }, [canManage, isOwner, myRank, ranks]);

  function getRankName(rankId: string | null) {
    if (!rankId) return null;
    const rank = rankMap.get(rankId);
    return rank ? rank.name : "Törölt rang";
  }

  function canEditTarget(target: MemberRow | null) {
    if (!target || !me) return false;
    if (!canManage) return false;
    if (me.user_id === target.user_id) return false;
    if (isOwner) return true;

    const targetRank = target.rank_id ? rankMap.get(target.rank_id) : null;
    if (!myRank) return true;
    if (!targetRank) return true;

    return targetRank.priority >= myRank.priority;
  }

  async function reloadAll() {
    setLoading(true);
    setError(null);

    const { data: userData, error: authErr } = await supabase.auth.getUser();
    const authUser = userData?.user;

    if (authErr || !authUser) {
      setError(authErr?.message ?? "Nincs bejelentkezve.");
      setLoading(false);
      return;
    }

    const { data: meData, error: meErr } = await supabase
      .from("profiles")
      .select("user_id,site_role,status,rank_id")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (meErr) {
      setError(meErr.message);
      setLoading(false);
      return;
    }

    const myProfile = (meData ?? null) as MyProfile | null;
    setMe(myProfile);

    const { data: rankData, error: rankErr } = await supabase
      .from("ranks")
      .select("id,name,priority,is_archived")
      .order("priority", { ascending: true });

    if (rankErr) {
      setError(rankErr.message);
      setLoading(false);
      return;
    }

    const rankRows = (rankData ?? []) as Rank[];
    setRanks(rankRows);

    if (myProfile?.rank_id) {
      setMyRank(rankRows.find((r) => r.id === myProfile.rank_id) ?? null);
    } else {
      setMyRank(null);
    }

    const { data: memberData, error: memberErr } = await supabase
      .from("profiles")
      .select("user_id,ic_name,status,site_role,rank_id")
      .in("status", ["pending", "active", "leadership"])
      .order("ic_name", { ascending: true });

    if (memberErr) {
      setError(memberErr.message);
      setLoading(false);
      return;
    }

    const visibleRows = ((memberData ?? []) as MemberRow[]).filter((r) =>
      isVisibleMemberStatus(r.status)
    );
    setRows(sortMembersByRankPriority(visibleRows, rankRows));

    const visibleUserIds = visibleRows.map((r) => r.user_id);

    const { data: leadData, error: leadErr } = await supabase
      .from("leadando_submissions")
      .select("user_id,approved_at,is_approved")
      .eq("is_approved", true)
      .in(
        "user_id",
        visibleUserIds.length > 0 ? visibleUserIds : ["00000000-0000-0000-0000-000000000000"]
      )
      .order("approved_at", { ascending: false });

    if (!leadErr) {
      const map: Record<string, string | null> = {};
      for (const it of (leadData ?? []) as any[]) {
        if (!map[it.user_id]) map[it.user_id] = it.approved_at ?? null;
      }
      setLastLeadandoByUser(map);
    } else {
      setLastLeadandoByUser({});
    }

    const nowIso = new Date().toISOString();

    const { data: warnData, error: warnErr } = await supabase
      .from("warnings")
      .select("id,user_id,is_active,expires_at")
      .eq("is_active", true)
      .in(
        "user_id",
        visibleUserIds.length > 0 ? visibleUserIds : ["00000000-0000-0000-0000-000000000000"]
      );

    if (!warnErr) {
      const map: Record<string, number> = {};
      for (const w of (warnData ?? []) as WarningRow[]) {
        const exp = w.expires_at ? new Date(w.expires_at).toISOString() : null;
        const valid = !exp || exp > nowIso;
        if (!valid) continue;
        map[w.user_id] = (map[w.user_id] ?? 0) + 1;
      }
      setWarningCountByUser(map);
    } else {
      setWarningCountByUser({});
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

    setRows((prev) =>
      sortMembersByRankPriority(
        prev
          .map((r) => (r.user_id === user_id ? { ...r, ...patch } : r))
          .filter((r) => isVisibleMemberStatus(r.status)),
        ranks
      )
    );

    setBusyUserId(null);
  }

  async function addWarning(targetUserId: string) {
    if (!me) return;
    if (!canManage) return;
    if (!canEditTarget(rows.find((x) => x.user_id === targetUserId) as MemberRow)) return;

    const reason = warnReason.trim();
    if (!reason) {
      setError("Add meg a figyelmeztetés okát.");
      return;
    }

    const expiresAt =
      warnExpires.trim() !== "" ? new Date(`${warnExpires}T23:59:59`).toISOString() : null;

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

    setWarningCountByUser((prev) => ({
      ...prev,
      [targetUserId]: (prev[targetUserId] ?? 0) + 1,
    }));

    setWarnOpenFor(null);
    setWarnReason("");
    setWarnExpires("");
    setBusyUserId(null);
  }

  if (loading) {
    return (
      <div className="lmr-page">
        <div className="px-1 py-6 text-sm text-white/70">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="lmr-page">
      <section className="lmr-hero">
        <div className="max-w-4xl">
          <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Tagok
          </span>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Taglista
          </h1>

          <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <section className="overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-white/10 px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/62 md:px-5">
          <div className="col-span-4">InGame név</div>
          <div className="col-span-3">Rang</div>
          <div className="col-span-2">Leadandó leadva</div>
          <div className="col-span-1 text-center">Figy.</div>
          <div className="col-span-2 text-right">Művelet</div>
        </div>

        <div className="max-h-[65vh] overflow-y-auto pr-1">
          {rows.map((m) => {
            const targetEditable = canEditTarget(m);
            const rank = m.rank_id ? rankMap.get(m.rank_id) : null;
            const leadUntil = lastLeadandoByUser[m.user_id] ?? null;
            const warnCount = warningCountByUser[m.user_id] ?? 0;

            return (
              <div key={m.user_id} className="border-b border-white/8 last:border-b-0">
                <div className="grid grid-cols-12 gap-2 px-4 py-4 md:px-5">
                  <div className="col-span-4 flex items-center">
                    <Link
                      href={`/app/profile?user=${m.user_id}`}
                      className="font-semibold text-white transition hover:text-white/75"
                    >
                      {m.ic_name ?? "—"}
                    </Link>
                  </div>

                  <div className="col-span-3">
                    {canManage && targetEditable ? (
                      <select
                        className="w-full rounded-2xl border px-3 py-2.5 text-sm"
                        value={m.rank_id ?? ""}
                        onChange={(e) => updateMember(m.user_id, { rank_id: e.target.value || null })}
                        disabled={busyUserId === m.user_id}
                      >
                        <option value="">—</option>
                        {rank && rank.is_archived && (
                          <option value={rank.id}>{rank.name} (archivált)</option>
                        )}
                        {assignableRanks
                          .filter((r) => !(rank && rank.is_archived && r.id === m.rank_id))
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <div className="px-3 py-2.5 text-white/80">
                        {getRankName(m.rank_id) ? <RankBadge name={getRankName(m.rank_id)} /> : "—"}
                      </div>
                    )}

                    {canManage && targetEditable && m.rank_id && !rank && (
                      <div className="mt-2 text-xs text-red-200/85">
                        A felhasználóhoz törölt rang van rendelve.
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 flex items-center">
                    <div className="text-white/78">{formatDateYMD(leadUntil)}</div>
                  </div>

                  <div className="col-span-1 flex items-center justify-center">
                    <div className="inline-flex min-w-10 justify-center rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-white/85">
                      {warnCount}
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-2">
                    {canManage && targetEditable ? (
                      <button
                        className="lmr-btn rounded-2xl px-3.5 py-2 text-sm text-white/90"
                        onClick={() => setWarnOpenFor(warnOpenFor === m.user_id ? null : m.user_id)}
                      >
                        Figyelmeztetés
                      </button>
                    ) : (
                      <span className="text-sm text-white/45">—</span>
                    )}
                  </div>
                </div>

                {warnOpenFor === m.user_id && canManage && targetEditable && (
                  <div className="px-4 pb-4 md:px-5 md:pb-5">
                    <div className="border-t border-white/8 pt-4">
                      <div className="mb-3 text-sm font-semibold text-white">
                        Figyelmeztetés hozzáadása
                      </div>

                      <div className="grid grid-cols-12 items-end gap-3">
                        <div className="col-span-12 md:col-span-7">
                          <label className="text-xs uppercase tracking-[0.14em] text-white/55">
                            Ok
                          </label>
                          <input
                            className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm"
                            value={warnReason}
                            onChange={(e) => setWarnReason(e.target.value)}
                            placeholder="Pl.: Szabályszegés / AFK / ..."
                          />
                        </div>

                        <div className="col-span-12 md:col-span-3">
                          <label className="text-xs uppercase tracking-[0.14em] text-white/55">
                            Lejárat
                          </label>
                          <input
                            type="date"
                            className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm"
                            value={warnExpires}
                            onChange={(e) => setWarnExpires(e.target.value)}
                          />
                        </div>

                        <div className="col-span-12 md:col-span-2 flex gap-2">
                          <button
                            className="lmr-btn lmr-btn-primary w-full rounded-2xl px-3 py-2.5 text-sm font-medium"
                            onClick={() => addWarning(m.user_id)}
                            disabled={busyUserId === m.user_id}
                          >
                            Mentés
                          </button>
                          <button
                            className="lmr-btn w-full rounded-2xl px-3 py-2.5 text-sm"
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
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="px-4 py-8 text-sm text-white/60">Nincs megjeleníthető tag.</div>
          )}
        </div>
      </section>
    </div>
  );
}