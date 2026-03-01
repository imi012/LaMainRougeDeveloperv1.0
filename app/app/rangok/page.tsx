"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

export default function RanksPage() {
  const supabase = createClient();

  const [me, setMe] = useState<Profile | null>(null);
  const [myRank, setMyRank] = useState<Rank | null>(null);

  const [ranks, setRanks] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = useMemo(() => me?.site_role === "admin" || me?.site_role === "owner", [me]);

  useEffect(() => {
    (async () => {
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
        .select("user_id,ic_name,site_role,rank_id,status")
        .eq("user_id", user.id)
        .maybeSingle();

      setMe(myProfile as any);

      const { data: allRanks, error: ranksErr } = await supabase
        .from("ranks")
        .select("id,name,category,priority,is_archived,permissions")
        .order("priority", { ascending: true });

      if (ranksErr) {
        setError(ranksErr.message);
        setLoading(false);
        return;
      }

      setRanks((allRanks ?? []) as any);

      if (myProfile?.rank_id) {
        const r = (allRanks ?? []).find((x: any) => x.id === myProfile.rank_id) ?? null;
        setMyRank(r as any);
      } else {
        setMyRank(null);
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateRank(id: string, patch: Partial<Rank>) {
    setSavingId(id);
    setError(null);

    const { error: upErr } = await supabase.from("ranks").update(patch).eq("id", id);
    if (upErr) {
      setError(upErr.message);
    } else {
      setRanks((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    }

    setSavingId(null);
  }

  async function createRank() {
    setError(null);
    if (!canEdit) return;

    const name = prompt("Új rang neve:");
    if (!name) return;

    const { data, error: insErr } = await supabase
      .from("ranks")
      .insert({
        name,
        category: "member",
        priority: (ranks[ranks.length - 1]?.priority ?? 0) + 10,
        is_archived: false,
        permissions: {},
      })
      .select("id,name,category,priority,is_archived,permissions")
      .single();

    if (insErr) {
      setError(insErr.message);
      return;
    }

    setRanks((prev) => [...prev, data as any].sort((a, b) => a.priority - b.priority));
  }

  if (loading) return <div className="p-6">Betöltés…</div>;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">Rangok</h1>
        {canEdit && (
          <button
            className="ml-auto rounded-xl border border-white/15 px-4 py-2 hover:bg-white/5"
            onClick={createRank}
          >
            + Új rang
          </button>
        )}
      </div>

      <p className="mt-2 opacity-80">
        {canEdit
          ? "Vezetőségként szerkesztheted a rangokat (név, kategória, prioritás, archiválás)."
          : "Itt a frakció ranglistája látható."}
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
          {error}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 bg-white/5 px-4 py-3 text-xs font-semibold opacity-80">
          <div className="col-span-4">Rang</div>
          <div className="col-span-3">Kategória</div>
          <div className="col-span-2">Prioritás</div>
          <div className="col-span-3 text-right">Művelet</div>
        </div>

        {ranks.map((r) => (
          <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-white/10 items-center">
            <div className="col-span-4">
              {canEdit ? (
                <input
                  className="w-full rounded-xl border border-white/15 bg-transparent px-3 py-2"
                  value={r.name}
                  onChange={(e) => updateRank(r.id, { name: e.target.value })}
                />
              ) : (
                <div className="font-semibold">{r.name}</div>
              )}
              {r.is_archived && <div className="text-xs opacity-60 mt-1">Archiválva</div>}
            </div>

            <div className="col-span-3">
              {canEdit ? (
                <select
                  className="w-full rounded-xl border border-white/15 bg-black px-3 py-2"
                  value={r.category}
                  onChange={(e) => updateRank(r.id, { category: e.target.value as any })}
                >
                  <option value="member">member</option>
                  <option value="organizer">organizer</option>
                  <option value="leadership">leadership</option>
                </select>
              ) : (
                <div className="opacity-80">{r.category}</div>
              )}
            </div>

            <div className="col-span-2">
              {canEdit ? (
                <input
                  type="number"
                  className="w-full rounded-xl border border-white/15 bg-transparent px-3 py-2"
                  value={r.priority}
                  onChange={(e) => updateRank(r.id, { priority: Number(e.target.value) })}
                />
              ) : (
                <div className="opacity-80">{r.priority}</div>
              )}
            </div>

            <div className="col-span-3 text-right">
              {canEdit ? (
                <button
                  className="rounded-xl border border-white/15 px-3 py-2 hover:bg-white/5"
                  onClick={() => updateRank(r.id, { is_archived: !r.is_archived })}
                  disabled={savingId === r.id}
                >
                  {r.is_archived ? "Visszaállít" : "Archivál"}
                </button>
              ) : (
                <div className="opacity-60 text-sm">—</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-sm opacity-70">
        <div>Jogosultság elv: <b>owner</b> mindig mindent tud, <b>admin</b> vezetőségi funkciókat kezel.</div>
        <div>A “húzogatós prioritás” (drag & drop) a következő lépés lesz.</div>
      </div>
    </div>
  );
}