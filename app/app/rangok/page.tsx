"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isLeadershipProfile } from "@/lib/permissions";

type Rank = {
  id: string;
  name: string;
  category: "member" | "organizer" | "leadership";
  priority: number;
  is_archived: boolean;
  permissions: any;
};

type Profile = {
  user_id: string;
  ic_name: string | null;
  site_role: "user" | "admin" | "owner";
  rank_id: string | null;
  status: string | null;
};

function reorderRanks(list: Rank[], draggedId: string, targetId: string) {
  const current = [...list];
  const fromIndex = current.findIndex((r) => r.id === draggedId);
  const toIndex = current.findIndex((r) => r.id === targetId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return current;
  const [moved] = current.splice(fromIndex, 1);
  current.splice(toIndex, 0, moved);
  return current.map((rank, index) => ({ ...rank, priority: (index + 1) * 10 }));
}

export default function RanksPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [myRank, setMyRank] = useState<Rank | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = useMemo(() => isLeadershipProfile(me), [me]);

  async function loadPage() {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      setError("Nincs bejelentkezve.");
      setLoading(false);
      return;
    }

    const { data: myProfile, error: myProfileErr } = await supabase
      .from("profiles")
      .select("user_id,ic_name,site_role,rank_id,status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (myProfileErr) {
      setError(myProfileErr.message);
      setLoading(false);
      return;
    }

    const typedProfile = (myProfile ?? null) as Profile | null;
    setMe(typedProfile);

    const { data: rankRows, error: rankErr } = await supabase
      .from("ranks")
      .select("id,name,category,priority,is_archived,permissions")
      .order("priority", { ascending: true });
    if (rankErr) {
      setError(rankErr.message);
      setLoading(false);
      return;
    }

    const typedRanks = (rankRows ?? []) as Rank[];
    setRanks(typedRanks);

    if (typedProfile?.rank_id) setMyRank(typedRanks.find((r) => r.id === typedProfile.rank_id) ?? null);
    else setMyRank(null);

    setLoading(false);
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateRank(rankId: string, patch: Partial<Rank>) {
    setSavingId(rankId);
    setError(null);
    try {
      const { error: upErr } = await supabase.from("ranks").update(patch).eq("id", rankId);
      if (upErr) throw new Error(upErr.message);
      setRanks((prev) => prev.map((r) => (r.id === rankId ? { ...r, ...patch } : r)));
    } catch (err: any) {
      setError(err?.message ?? "Nem sikerült menteni a rangot.");
      await loadPage();
    } finally {
      setSavingId(null);
    }
  }

  async function createRank() {
    if (!canEdit) return;
    setError(null);
    try {
      const maxPriority = ranks.reduce((max, item) => Math.max(max, item.priority), 0);
      const { data, error: insErr } = await supabase
        .from("ranks")
        .insert({ name: "Új rang", category: "member", priority: maxPriority + 10, is_archived: false, permissions: {} })
        .select("id,name,category,priority,is_archived,permissions")
        .single();
      if (insErr) throw new Error(insErr.message);
      setRanks((prev) => [...prev, data as Rank].sort((a, b) => a.priority - b.priority));
    } catch (err: any) {
      setError(err?.message ?? "Nem sikerült létrehozni a rangot.");
    }
  }

  async function persistOrder(nextRanks: Rank[]) {
    setSavingOrder(true);
    setError(null);
    try {
      for (const rank of nextRanks) {
        const { error: upErr } = await supabase.from("ranks").update({ priority: rank.priority }).eq("id", rank.id);
        if (upErr) throw new Error(upErr.message);
      }
    } catch (err: any) {
      setError(err?.message ?? "Nem sikerült menteni az új sorrendet.");
      await loadPage();
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleDrop(targetId: string) {
    if (!canEdit || !draggingId) return;
    if (draggingId === targetId) {
      setDraggingId(null);
      return;
    }
    const reordered = reorderRanks(ranks, draggingId, targetId);
    setRanks(reordered);
    setDraggingId(null);
    await persistOrder(reordered);
  }

  async function deleteRank(rank: Rank) {
    if (!canEdit) return;
    const confirmed = window.confirm(`Biztosan törölni szeretnéd ezt a rangot?\n\n${rank.name}\n\nEz a művelet nem vonható vissza.`);
    if (!confirmed) return;

    setDeletingId(rank.id);
    setError(null);
    try {
      const { count, error: countErr } = await supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("rank_id", rank.id);
      if (countErr) throw new Error(countErr.message);
      if ((count ?? 0) > 0) throw new Error("Ez a rang nem törölhető, mert jelenleg is hozzá van rendelve egy vagy több taghoz.");
      const { error: delErr } = await supabase.from("ranks").delete().eq("id", rank.id);
      if (delErr) throw new Error(delErr.message);
      const remaining = ranks.filter((r) => r.id !== rank.id).sort((a, b) => a.priority - b.priority).map((r, index) => ({ ...r, priority: (index + 1) * 10 }));
      setRanks(remaining);
      await persistOrder(remaining);
    } catch (err: any) {
      setError(err?.message ?? "Nem sikerült törölni a rangot.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="lmr-page"><div className="lmr-card rounded-[28px] p-6 text-sm text-white/70">Betöltés...</div></div>;

  return (
    <div className="lmr-page">
      <section className="lmr-hero rounded-[28px] p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Rangok</span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Rangkezelés</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">A rangokat húzással átrendezheted, szerkesztheted, archiválhatod vagy törölheted. Olvasó módban csak a ranglista jelenik meg.</p>
          </div>
          {canEdit && <button className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-medium" onClick={createRank} disabled={savingOrder}>+ Új rang</button>}
        </div>
      </section>

      {!!myRank && <div className="lmr-card rounded-[24px] px-4 py-3 text-sm text-white/75">Saját rangod: <b className="text-white">{myRank.name}</b></div>}
      {savingOrder && <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">Új sorrend mentése folyamatban...</div>}
      {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      <section className="lmr-card overflow-hidden rounded-[28px]">
        <div className="lmr-card-header grid grid-cols-12 gap-2 px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/62 md:px-5">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Rang</div>
          <div className="col-span-3">Kategória</div>
          <div className="col-span-2">Prioritás</div>
          <div className="col-span-2 text-right">Művelet</div>
        </div>

        {ranks.map((r, index) => {
          const isBusy = savingId === r.id || deletingId === r.id || savingOrder;
          return (
            <div
              key={r.id}
              draggable={canEdit && !isBusy}
              onDragStart={() => { if (!canEdit || isBusy) return; setDraggingId(r.id); }}
              onDragOver={(e) => { if (!canEdit) return; e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); void handleDrop(r.id); }}
              onDragEnd={() => setDraggingId(null)}
              className={`grid grid-cols-12 gap-2 border-t border-white/8 px-4 py-4 md:px-5 ${draggingId === r.id ? "bg-white/[0.07]" : ""} ${canEdit ? "cursor-move" : ""}`}
            >
              <div className="col-span-1 flex items-center text-sm text-white/55">{index + 1}</div>
              <div className="col-span-4">
                <div className="flex items-start gap-3">
                  {canEdit && <div className="mt-2 select-none text-white/35" title="Húzd a rendezéshez">☰</div>}
                  <div className="flex-1">
                    {canEdit ? <input className="w-full rounded-2xl border px-3 py-2.5 text-sm" value={r.name} onChange={(e) => setRanks((prev) => prev.map((item) => item.id === r.id ? { ...item, name: e.target.value } : item))} onBlur={() => updateRank(r.id, { name: r.name.trim() })} disabled={isBusy} /> : <div className="font-semibold">{r.name}</div>}
                    {r.is_archived && <div className="mt-2 text-xs text-white/50">Archiválva</div>}
                  </div>
                </div>
              </div>
              <div className="col-span-3">
                {canEdit ? (
                  <select className="w-full rounded-2xl border px-3 py-2.5 text-sm" value={r.category} onChange={(e) => updateRank(r.id, { category: e.target.value as "member" | "organizer" | "leadership" })} disabled={isBusy}>
                    <option value="member">member</option>
                    <option value="organizer">organizer</option>
                    <option value="leadership">leadership</option>
                  </select>
                ) : <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-white/80">{r.category}</div>}
              </div>
              <div className="col-span-2"><div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/80">{r.priority}</div></div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                {canEdit ? (
                  <>
                    <button className="lmr-btn rounded-2xl px-3 py-2 text-sm" onClick={() => updateRank(r.id, { is_archived: !r.is_archived })} disabled={isBusy}>{r.is_archived ? "Visszaállít" : "Archivál"}</button>
                    <button className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 hover:bg-red-500/15" onClick={() => deleteRank(r)} disabled={isBusy}>Törlés</button>
                  </>
                ) : <div className="text-sm text-white/45">—</div>}
              </div>
            </div>
          );
        })}
      </section>

      <section className="lmr-card rounded-[28px] p-5 text-sm text-white/70">
        <div>Jogelv: <b className="text-white">owner</b> és <b className="text-white">admin</b> tud rangokat kezelni.</div>
        <div className="mt-1">A sorrend húzással állítható, a rendszer a prioritásokat automatikusan újraírja.</div>
        <div className="mt-1">Rang törlése csak akkor lehetséges, ha nincs egyetlen profilhoz sem hozzárendelve.</div>
      </section>
    </div>
  );
}
