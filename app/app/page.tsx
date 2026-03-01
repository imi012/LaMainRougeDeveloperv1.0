"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MyProfile = {
  user_id: string;
  ic_name: string | null;
  status: "preinvite" | "pending" | "active" | "leadership" | "inactive";
  site_role: "user" | "admin" | "owner";
};

type RankRow = { id: string; name: string; category: string; priority: number; is_archived: boolean };

type InviteRow = {
  id: number;
  created_at: string;
  expires_at: string | null;
  uses: number;
  max_uses: number;
  revoked: boolean;
  created_by: string | null;
};

type UserRow = {
  user_id: string;
  ic_name: string | null;
  status: string | null;
  site_role: string | null;
  rank_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type WarningRow = {
  id: string;
  reason: string;
  issued_at: string;
  expires_at: string | null;
  issued_by: string | null;
  is_active: boolean;
};

type LeadandoRow = {
  id: string;
  imgur_url: string;
  weeks: number;
  submitted_at: string;
  is_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
};

type TabKey = "kezelo" | "invites" | "users";

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

function isInviteActive(row: InviteRow) {
  if (row.revoked) return false;
  if (row.max_uses != null && row.uses != null && row.uses >= row.max_uses) return false;
  if (!row.expires_at) return true;
  const exp = new Date(row.expires_at).getTime();
  if (Number.isNaN(exp)) return true;
  return exp > Date.now();
}

function isAbortError(e: any) {
  const name = e?.name || e?.cause?.name;
  const msg = String(e?.message || "");
  return name === "AbortError" || msg.toLowerCase().includes("lock request is aborted");
}

export default function VezetosegPage() {
  const supabase = createClient();

  const [tab, setTab] = useState<TabKey>("kezelo");

  const [token, setToken] = useState<string | null>(null);

  const [me, setMe] = useState<MyProfile | null>(null);

  const [members, setMembers] = useState<{ user_id: string; ic_name: string | null }[]>([]);
  const nameMap = useMemo(() => new Map(members.map((m) => [m.user_id, m.ic_name || "—"])), [members]);

  const [ranks, setRanks] = useState<RankRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Invites
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const activeInvites = useMemo(() => invites.filter(isInviteActive), [invites]);
  const [lastGeneratedCode, setLastGeneratedCode] = useState<{ code: string; expires_at: string } | null>(null);

  // Users
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [leadando, setLeadando] = useState<LeadandoRow[]>([]);

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));

  function tabBtnStyle(active: boolean) {
    return `rounded-lg border px-3 py-2 text-sm ${
      active ? "bg-red-600/90 border-red-500" : "bg-white/5 border-white/10 hover:bg-white/10"
    }`;
  }

  async function authHeaders(extra?: HeadersInit) {
    const t = token;
    const base: Record<string, string> = {};
    if (t) base["Authorization"] = `Bearer ${t}`;
    return { ...base, ...(extra as any) };
  }

  async function apiFetch(url: string, init?: RequestInit) {
    const headers = await authHeaders(init?.headers);
    const res = await fetch(url, { ...init, headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      throw new Error(json?.message || "Hiba történt.");
    }
    return json;
  }

  // ✅ AbortError-safe session betöltés
  async function loadSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (isAbortError(error)) return; // ezt nyeljük le (dev/fast refresh alatt előfordul)
        throw error;
      }
      const t = data.session?.access_token ?? null;
      setToken(t);
    } catch (e: any) {
      if (isAbortError(e)) return; // ezt is nyeljük le
      // csak a valódi hibákat mutassuk
      console.error("loadSession error:", e);
      setError(e?.message ?? "Session hiba.");
    }
  }

  async function loadBaseData() {
    const [{ data: meRes }, membersRes, ranksRes] = await Promise.all([
      supabase.from("profiles").select("user_id,ic_name,status,site_role").maybeSingle(),
      supabase.from("profiles").select("user_id,ic_name").limit(1000),
      supabase
        .from("ranks")
        .select("id,name,category,priority,is_archived")
        .order("priority", { ascending: true }),
    ]);

    setMe((meRes as any) ?? null);
    setMembers((membersRes.data as any) ?? []);
    setRanks((ranksRes.data as any) ?? []);
  }

  async function loadInvites() {
    const json = await apiFetch("/api/admin/invites/list");
    setInvites((json.rows ?? []) as InviteRow[]);
  }

  async function generateInvite() {
    setError(null);
    setBusy("gen");
    try {
      const json = await apiFetch("/api/admin/invites/generate", { method: "POST" });
      setLastGeneratedCode({ code: json.code, expires_at: json.expires_at });
      await loadInvites();
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function revokeInvite(id: number) {
    setError(null);
    setBusy(`rev:${id}`);
    try {
      await apiFetch("/api/admin/invites/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await loadInvites();
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function loadUsers(nextPage?: number) {
    const p = nextPage ?? page;
    const qs = new URLSearchParams();
    qs.set("q", q.trim());
    qs.set("page", String(p));
    qs.set("pageSize", String(pageSize));

    const json = await apiFetch(`/api/admin/users/list?${qs.toString()}`);
    setUsers((json.rows ?? []) as UserRow[]);
    setCount(Number(json.count ?? 0));
    setPage(Number(json.page ?? p));
  }

  async function openUser(row: UserRow) {
    setSelectedUser(row);
    setError(null);
    setBusy(`open:${row.user_id}`);
    try {
      const json = await apiFetch("/api/admin/users/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: row.user_id }),
      });
      setWarnings((json.warnings ?? []) as WarningRow[]);
      setLeadando((json.leadando ?? []) as LeadandoRow[]);
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function saveUserPatch(patch: Partial<UserRow>) {
    if (!selectedUser) return;
    setError(null);
    setBusy(`save:${selectedUser.user_id}`);
    try {
      await apiFetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUser.user_id, ...patch }),
      });

      const merged: UserRow = { ...selectedUser, ...patch } as any;
      setSelectedUser(merged);
      setUsers((prev) => prev.map((u) => (u.user_id === merged.user_id ? merged : u)));

      await loadUsers(page);
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function approveLeadando(id: string, approve: boolean) {
    setError(null);
    setBusy(`lead:${id}`);
    try {
      await apiFetch("/api/admin/leadando/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approve }),
      });

      setLeadando((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                is_approved: approve,
                approved_at: approve ? new Date().toISOString() : null,
              }
            : x
        )
      );
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshAll() {
    setError(null);
    setBusy("refresh");
    try {
      await loadSession();
      await loadBaseData();
      // ha közben AbortError volt és nincs token, csak base data töltődik, admin fetch nem
      if (token) {
        await Promise.all([loadInvites(), loadUsers(1)]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    loadSession();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      // ✅ ez is dobhat AbortError-t dev alatt → safe
      await loadSession();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBaseData().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;
    Promise.all([loadInvites(), loadUsers(1)]).catch((e) => {
      if (isAbortError(e)) return;
      setError(e?.message ?? "Hiba történt.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Vezetőség</h1>
          <p className="mt-1 text-sm opacity-80">
            Kezelőpanel (vezetőség / admin). Bejelentkezve:{" "}
            <span className="font-semibold">{me?.ic_name || "—"}</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className={tabBtnStyle(tab === "kezelo")} onClick={() => setTab("kezelo")}>
              Kezelőpanel
            </button>
            <button className={tabBtnStyle(tab === "invites")} onClick={() => setTab("invites")}>
              Meghívókódok
            </button>
            <button className={tabBtnStyle(tab === "users")} onClick={() => setTab("users")}>
              Felhasználók
            </button>
          </div>
        </div>

        <button
          onClick={refreshAll}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          disabled={busy === "refresh"}
          title="Frissít minden adatot"
        >
          {busy === "refresh" ? "..." : "Frissítés"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!token && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-200">
          Nincs bejelentkezve.
        </div>
      )}

      {/* ===== Kezelőpult (dashboard) ===== */}
      {tab === "kezelo" && (
        <div className="mt-6 grid gap-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
              <div className="text-lg font-semibold">Meghívókód generálás</div>
              <div className="mt-1 text-sm opacity-80">6 számjegy, 24 óra, egyszer használatos.</div>

              <button
                onClick={generateInvite}
                disabled={!token || busy === "gen"}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
              >
                {busy === "gen" ? "..." : "Kód generálás"}
              </button>

              {lastGeneratedCode && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm opacity-80">Új kód (másold ki):</div>
                  <div className="mt-1 text-2xl font-bold tracking-widest">{lastGeneratedCode.code}</div>
                  <div className="mt-1 text-xs opacity-70">Lejár: {fmt(lastGeneratedCode.expires_at)}</div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
              <div className="text-lg font-semibold">Gyors felhasználó keresés</div>
              <div className="mt-1 text-sm opacity-80">IC név alapján.</div>

              <div className="mt-4 flex gap-2">
                <input
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
                  placeholder="pl. Thibault"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <button
                  onClick={() => loadUsers(1)}
                  disabled={!token || busy === "refresh"}
                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                >
                  Keresés
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
              <div className="text-lg font-semibold">Info</div>
              <div className="mt-2 text-sm opacity-80">
                Itt fogjuk később rendezni a permission-okat (rank.permissions + site_role).
                <br />
                Most service-role API-kal megy, hogy stabilan működjön.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Aktív meghívókódok</div>
                <div className="text-sm opacity-80">Le nem járt, nem visszavont, fel nem használt kódok.</div>
              </div>
              <button
                onClick={loadInvites}
                disabled={!token}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
              >
                Frissítés
              </button>
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-left">
                    <th className="px-3 py-2">Létrehozva</th>
                    <th className="px-3 py-2">Lejár</th>
                    <th className="px-3 py-2">Használat</th>
                    <th className="px-3 py-2">Visszavonva</th>
                    <th className="px-3 py-2">Létrehozó</th>
                    <th className="px-3 py-2 text-right">Művelet</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInvites.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 opacity-70" colSpan={6}>
                        Nincs aktív meghívó.
                      </td>
                    </tr>
                  ) : (
                    activeInvites.map((row) => (
                      <tr key={row.id} className="border-t border-white/10">
                        <td className="px-3 py-2">{fmt(row.created_at)}</td>
                        <td className="px-3 py-2">{fmt(row.expires_at)}</td>
                        <td className="px-3 py-2">
                          {row.uses}/{row.max_uses}
                        </td>
                        <td className="px-3 py-2">{row.revoked ? "Igen" : "Nem"}</td>
                        <td className="px-3 py-2">{row.created_by ? nameMap.get(row.created_by) || "—" : "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => revokeInvite(row.id)}
                            disabled={!token || busy === `rev:${row.id}`}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
                          >
                            {busy === `rev:${row.id}` ? "..." : "Visszavonás"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-xs opacity-70">
              A kód csak generáláskor látszik (hash tárolás miatt).
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Felhasználók kezelése</div>
                <div className="text-sm opacity-80">Keresés IC név alapján + lapozás.</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadUsers(Math.max(1, page - 1))}
                  disabled={!token || page <= 1}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                >
                  ◀
                </button>
                <div className="text-sm opacity-80">
                  {page}/{totalPages}
                </div>
                <button
                  onClick={() => loadUsers(Math.min(totalPages, page + 1))}
                  disabled={!token || page >= totalPages}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                >
                  ▶
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-left">
                    <th className="px-3 py-2">Név</th>
                    <th className="px-3 py-2">Státusz</th>
                    <th className="px-3 py-2">Rang</th>
                    <th className="px-3 py-2 text-right">Művelet</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 opacity-70" colSpan={4}>
                        Nincs találat.
                      </td>
                    </tr>
                  ) : (
                    users.map((row) => (
                      <tr key={row.user_id} className="border-t border-white/10">
                        <td className="px-3 py-2 font-medium">{row.ic_name || "—"}</td>
                        <td className="px-3 py-2">{row.status || "—"}</td>
                        <td className="px-3 py-2">
                          {row.rank_id ? ranks.find((r) => r.id === row.rank_id)?.name || "—" : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => openUser(row)}
                            disabled={!token || busy === `open:${row.user_id}`}
                            className="rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15 disabled:opacity-50"
                          >
                            {busy === `open:${row.user_id}` ? "..." : "Megnyitás"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {selectedUser && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{selectedUser.ic_name || "—"}</div>
                    <div className="text-xs opacity-70">user_id: {selectedUser.user_id}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div>
                    <div className="text-sm opacity-80">Státusz</div>
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                      value={selectedUser.status || ""}
                      onChange={(e) => saveUserPatch({ status: e.target.value })}
                      disabled={!token}
                    >
                      <option value="">—</option>
                      <option value="preinvite">preinvite</option>
                      <option value="pending">pending</option>
                      <option value="active">active</option>
                      <option value="leadership">leadership</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </div>

                  <div>
                    <div className="text-sm opacity-80">Rang</div>
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                      value={selectedUser.rank_id || ""}
                      onChange={(e) => saveUserPatch({ rank_id: e.target.value || null })}
                      disabled={!token}
                    >
                      <option value="">—</option>
                      {ranks
                        .filter((r) => !r.is_archived)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <div className="text-sm opacity-80">Site role</div>
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                      value={selectedUser.site_role || "user"}
                      onChange={(e) => saveUserPatch({ site_role: e.target.value })}
                      disabled={!token}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="owner">owner</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold">Figyelmeztetések</div>
                  <div className="mt-2 space-y-2">
                    {warnings.length === 0 ? (
                      <div className="text-sm opacity-70">Nincs figyelmeztetés.</div>
                    ) : (
                      warnings.map((w) => (
                        <div key={w.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                          <div className="font-medium">{w.reason}</div>
                          <div className="mt-1 text-xs opacity-70">
                            {fmt(w.issued_at)} • lejár: {fmt(w.expires_at)} • aktív: {w.is_active ? "igen" : "nem"}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold">Leadandó anyagok</div>
                  <div className="mt-2 space-y-2">
                    {leadando.length === 0 ? (
                      <div className="text-sm opacity-70">Nincs leadandó.</div>
                    ) : (
                      leadando.map((l) => (
                        <div key={l.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="font-medium">
                                Hetek száma: {l.weeks} • Beküldve: {fmt(l.submitted_at)}
                              </div>
                              <div className="mt-1 text-xs opacity-70">
                                Imgur: <span className="underline">{l.imgur_url}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs opacity-70">
                                Állapot: {l.is_approved ? "Approved" : "Pending"}
                              </span>
                              <button
                                onClick={() => approveLeadando(l.id, true)}
                                disabled={!token || busy === `lead:${l.id}`}
                                className="rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15 disabled:opacity-50"
                              >
                                Jóváhagy
                              </button>
                              <button
                                onClick={() => approveLeadando(l.id, false)}
                                disabled={!token || busy === `lead:${l.id}`}
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-50"
                              >
                                Visszavon
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meghívókódok tab */}
      {tab === "invites" && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Meghívókódok</div>
              <div className="text-sm opacity-80">Generálás + lista + visszavonás.</div>
            </div>
            <button
              onClick={generateInvite}
              disabled={!token || busy === "gen"}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
            >
              {busy === "gen" ? "..." : "Új kód"}
            </button>
          </div>

          {lastGeneratedCode && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-sm opacity-80">Új kód (másold ki):</div>
              <div className="mt-1 text-2xl font-bold tracking-widest">{lastGeneratedCode.code}</div>
              <div className="mt-1 text-xs opacity-70">Lejár: {fmt(lastGeneratedCode.expires_at)}</div>
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={loadInvites}
              disabled={!token}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              Lista frissítése
            </button>

            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-left">
                    <th className="px-3 py-2">Létrehozva</th>
                    <th className="px-3 py-2">Lejár</th>
                    <th className="px-3 py-2">Használat</th>
                    <th className="px-3 py-2">Visszavonva</th>
                    <th className="px-3 py-2">Létrehozó</th>
                    <th className="px-3 py-2 text-right">Művelet</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 opacity-70" colSpan={6}>
                        Nincs adat.
                      </td>
                    </tr>
                  ) : (
                    invites.map((row) => (
                      <tr key={row.id} className="border-t border-white/10">
                        <td className="px-3 py-2">{fmt(row.created_at)}</td>
                        <td className="px-3 py-2">{fmt(row.expires_at)}</td>
                        <td className="px-3 py-2">
                          {row.uses}/{row.max_uses}
                        </td>
                        <td className="px-3 py-2">{row.revoked ? "Igen" : "Nem"}</td>
                        <td className="px-3 py-2">{row.created_by ? nameMap.get(row.created_by) || "—" : "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => revokeInvite(row.id)}
                            disabled={!token || busy === `rev:${row.id}`}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
                          >
                            {busy === `rev:${row.id}` ? "..." : "Visszavonás"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-xs opacity-70">A kód csak generáláskor látszik (hash tárolás miatt).</div>
          </div>
        </div>
      )}

      {/* Felhasználók tab */}
      {tab === "users" && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Felhasználók</div>
              <div className="text-sm opacity-80">Keresés IC név alapján + lapozás.</div>
            </div>

            <div className="flex gap-2">
              <input
                className="w-64 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
                placeholder="Keresés IC névre..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                onClick={() => loadUsers(1)}
                disabled={!token}
                className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
              >
                Keresés
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm opacity-80">Találat: {count}</div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left">
                  <th className="px-3 py-2">Név</th>
                  <th className="px-3 py-2">Státusz</th>
                  <th className="px-3 py-2">Rang</th>
                  <th className="px-3 py-2 text-right">Művelet</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 opacity-70" colSpan={4}>
                      Nincs találat.
                    </td>
                  </tr>
                ) : (
                  users.map((row) => (
                    <tr key={row.user_id} className="border-t border-white/10">
                      <td className="px-3 py-2 font-medium">{row.ic_name || "—"}</td>
                      <td className="px-3 py-2">{row.status || "—"}</td>
                      <td className="px-3 py-2">
                        {row.rank_id ? ranks.find((r) => r.id === row.rank_id)?.name || "—" : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => openUser(row)}
                          disabled={!token || busy === `open:${row.user_id}`}
                          className="rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15 disabled:opacity-50"
                        >
                          {busy === `open:${row.user_id}` ? "..." : "Megnyitás"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => loadUsers(Math.max(1, page - 1))}
              disabled={!token || page <= 1}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              ◀
            </button>
            <div className="text-sm opacity-80">
              {page}/{totalPages}
            </div>
            <button
              onClick={() => loadUsers(Math.min(totalPages, page + 1))}
              disabled={!token || page >= totalPages}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}