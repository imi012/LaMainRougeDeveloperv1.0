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

type BadgeTone = {
  className: string;
};

function reorderRanks(list: Rank[], draggedId: string, targetId: string) {
  const current = [...list];
  const fromIndex = current.findIndex((r) => r.id === draggedId);
  const toIndex = current.findIndex((r) => r.id === targetId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return current;

  const [moved] = current.splice(fromIndex, 1);
  current.splice(toIndex, 0, moved);

  return current.map((rank, index) => ({
    ...rank,
    priority: (index + 1) * 10,
  }));
}

function normalizeRankName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeRankKey(value: string) {
  return normalizeRankName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getRankBadgeTone(rankName: string | null | undefined): BadgeTone {
  const key = normalizeRankKey(rankName || "");

  if (["candidat"].includes(key)) {
    return {
      className: "border-cyan-400/35 bg-cyan-400/15 text-cyan-100",
    };
  }

  if (["soldat"].includes(key)) {
    return {
      className: "border-violet-400/35 bg-violet-500/15 text-violet-100",
    };
  }

  if (["frappeur"].includes(key)) {
    return {
      className: "border-yellow-300/35 bg-yellow-300/15 text-yellow-100",
    };
  }

  if (["veilleur"].includes(key)) {
    return {
      className: "border-sky-300/35 bg-sky-300/15 text-sky-100",
    };
  }

  if (["borreau", "bourreau"].includes(key)) {
    return {
      className: "border-amber-400/35 bg-amber-500/15 text-amber-100",
    };
  }

  if (
    [
      "les executeurs",
      "les executeur",
      "les executeurs",
      "les executeurs",
      "les executeurs ",
      "les executeur ",
    ].includes(key)
  ) {
    return {
      className: "border-violet-400/35 bg-violet-500/15 text-violet-100",
    };
  }

  if (["briscard"].includes(key)) {
    return {
      className: "border-orange-400/35 bg-orange-500/15 text-orange-100",
    };
  }

  if (["briscard fondateur"].includes(key)) {
    return {
      className: "border-orange-500/40 bg-orange-600/15 text-orange-100",
    };
  }

  if (["racoleur"].includes(key)) {
    return {
      className: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100",
    };
  }

  if (["heritier", "héritier"].includes(key)) {
    return {
      className: "border-red-500/40 bg-red-600/15 text-red-100",
    };
  }

  if (["la chef"].includes(key)) {
    return {
      className: "border-red-600/45 bg-red-700/20 text-red-100",
    };
  }

  return {
    className: "border-white/15 bg-white/5 text-white/80",
  };
}

function RankBadge({ name }: { name: string | null | undefined }) {
  const tone = getRankBadgeTone(name);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.08em] ${tone.className}`}
    >
      {name || "Nincs rang"}
    </span>
  );
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
  const [creating, setCreating] = useState(false);
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

    if (typedProfile?.rank_id) {
      setMyRank(typedRanks.find((r) => r.id === typedProfile.rank_id) ?? null);
    } else {
      setMyRank(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateRank(rankId: string, patch: Partial<Rank>) {
    setSavingId(rankId);
    setError(null);

    try {
      const safePatch: Partial<Rank> = { ...patch };

      if (typeof safePatch.name === "string") {
        safePatch.name = normalizeRankName(safePatch.name);
        if (!safePatch.name) {
          throw new Error("A rang neve nem lehet üres.");
        }
      }

      const { error: upErr } = await supabase.from("ranks").update(safePatch).eq("id", rankId);
      if (upErr) throw new Error(upErr.message);

      setRanks((prev) => prev.map((r) => (r.id === rankId ? { ...r, ...safePatch } : r)));
    } catch (err: any) {
      setError(err?.message ?? "Nem sikerült menteni a rangot.");
      await loadPage();
    } finally {
      setSavingId(null);
    }
  }

  async function createRank() {
    if (!canEdit) return;

    setCreating(true);
    setError(null);

    try {
      const maxPriority = ranks.reduce((max, item) => Math.max(max, item.priority ?? 0), 0);

      const insertPayload = {
        name: "Új rang",
        category: "member" as const,
        priority: maxPriority + 10,
        is_archived: false,
      };

      const { error: insErr } = await supabase.from("ranks").insert(insertPayload);
      if (insErr) throw new Error(insErr.message);

      await loadPage();
    } catch (err: any) {
      setError(err?.message ?? "Nem sikerült létrehozni a rangot.");
    } finally {
      setCreating(false);
    }
  }

  async function persistOrder(nextRanks: Rank[]) {
    setSavingOrder(true);
    setError(null);

    try {
      for (const rank of nextRanks) {
        const { error: upErr } = await supabase
          .from("ranks")
          .update({ priority: rank.priority })
          .eq("id", rank.id);

        if (upErr) throw new Error(upErr.message);
      }

      await loadPage();
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

    const confirmed = window.confirm(
      `Biztosan törölni szeretnéd ezt a rangot?\n\n${rank.name}\n\nEz a művelet nem vonható vissza.`
    );
    if (!confirmed) return;

    setDeletingId(rank.id);
    setError(null);

    try {
      const { count, error: countErr } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("rank_id", rank.id);

      if (countErr) throw new Error(countErr.message);

      if ((count ?? 0) > 0) {
        throw new Error(
          "Ez a rang nem törölhető, mert jelenleg is hozzá van rendelve egy vagy több taghoz."
        );
      }

      const { error: delErr } = await supabase.from("ranks").delete().eq("id", rank.id);
      if (delErr) throw new Error(delErr.message);

      const remaining = ranks
        .filter((r) => r.id !== rank.id)
        .sort((a, b) => a.priority - b.priority)
        .map((r, index) => ({ ...r, priority: (index + 1) * 10 }));

      setRanks(remaining);
      await persistOrder(remaining);
      await loadPage();
    } catch (err: any) {
      setError(err?.message ?? "Nem sikerült törölni a rangot.");
      await loadPage();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="lmr-page">
        <div className="px-1 py-2 text-sm text-white/70">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="lmr-page space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              Rangok
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Rangkezelés
            </h1>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
          </div>

          {canEdit && (
            <button
              className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-medium"
              onClick={() => void createRank()}
              disabled={savingOrder || creating}
            >
              {creating ? "Létrehozás..." : "+ Új rang"}
            </button>
          )}
        </div>
      </section>

      {!!myRank && (
        <section className="space-y-2">
          <div className="text-sm text-white/75">
            Saját rangod: <RankBadge name={myRank.name} />
          </div>
        </section>
      )}

      {savingOrder && canEdit && (
        <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          Új sorrend mentése folyamatban...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Ranglista</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        <div className="overflow-x-auto rounded-[24px] border border-white/10">
          <div className={canEdit ? "min-w-[860px]" : "min-w-[580px]"}>
            {canEdit ? (
              <div className="grid grid-cols-12 gap-3 px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/62 md:px-5">
                <div className="col-span-8 text-left">Rang</div>
                <div className="col-span-3 text-right">Művelet</div>
                <div className="col-span-1 text-right">#</div>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-3 px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/62 md:px-5">
                <div className="col-span-11 text-left">Rang</div>
                <div className="col-span-1 text-right">#</div>
              </div>
            )}

            {ranks.map((r, index) => {
              const isBusy = savingId === r.id || deletingId === r.id || savingOrder || creating;

              if (canEdit) {
                return (
                  <div
                    key={r.id}
                    draggable={!isBusy}
                    onDragStart={() => {
                      if (isBusy) return;
                      setDraggingId(r.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      void handleDrop(r.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`grid grid-cols-12 gap-3 border-t border-white/8 px-4 py-4 md:px-5 ${
                      draggingId === r.id ? "bg-white/[0.05]" : ""
                    } cursor-move`}
                  >
                    <div className="col-span-8 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="mt-2 select-none text-white/35" title="Húzd a rendezéshez">
                          ☰
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2">
                            <RankBadge name={r.name} />
                          </div>

                          <input
                            className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-red-500/50"
                            value={r.name}
                            onChange={(e) =>
                              setRanks((prev) =>
                                prev.map((item) =>
                                  item.id === r.id ? { ...item, name: e.target.value } : item
                                )
                              )
                            }
                            onBlur={() =>
                              void updateRank(r.id, {
                                name: normalizeRankName(r.name),
                              })
                            }
                            disabled={isBusy}
                          />

                          {r.is_archived && (
                            <div className="mt-2 text-xs text-white/50">Archiválva</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-2">
                      <button
                        className="lmr-btn rounded-2xl px-3 py-2 text-sm"
                        onClick={() => void updateRank(r.id, { is_archived: !r.is_archived })}
                        disabled={isBusy}
                      >
                        {r.is_archived ? "Visszaállít" : "Archivál"}
                      </button>

                      <button
                        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 hover:bg-red-500/15 disabled:opacity-60"
                        onClick={() => void deleteRank(r)}
                        disabled={isBusy}
                      >
                        {deletingId === r.id ? "Törlés..." : "Törlés"}
                      </button>
                    </div>

                    <div className="col-span-1 flex items-center justify-end text-sm text-white/55">
                      {index + 1}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={r.id}
                  className="grid grid-cols-12 gap-3 border-t border-white/8 px-4 py-4 md:px-5"
                >
                  <div className="col-span-11 min-w-0">
                    <RankBadge name={r.name} />
                    {r.is_archived && <div className="mt-2 text-xs text-white/50">Archiválva</div>}
                  </div>

                  <div className="col-span-1 flex items-center justify-end text-sm text-white/55">
                    {index + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}