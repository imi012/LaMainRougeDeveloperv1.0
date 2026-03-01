"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MyProfile = {
  user_id: string;
  ic_name: string | null;
  status: "preinvite" | "pending" | "active" | "leadership" | "inactive";
  site_role: "user" | "admin" | "owner";
};

type RankRow = {
  id: string;
  name: string;
  category: string;
  priority: number;
  is_archived: boolean;
};

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

type TicketRow = {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "closed" | string;
  created_at: string;
  updated_at: string;

  type?: "szankcio" | "inaktivitas" | "nevvaltas" | string | null;

  // ticket specifikus mezők (users/detail SELECT-ben nálad benne vannak)
  sanction_imgur_url?: string | null;
  sanction_reason?: string | null;
  inactivity_from?: string | null;
  inactivity_to?: string | null;
  old_name?: string | null;
  new_name?: string | null;
  namechange_reason?: string | null;

  // ha később payload-al bővítesz
  payload?: any;
};

type ServiceRow = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "done" | string;
  created_at: string;
  updated_at: string;
};

type LoreRow = {
  id: string;
  lore_url: string;
  submitted_at: string;
  is_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
};

type Summary = {
  open_tickets: number;
  total_tickets: number;
  pending_service: number;
  total_service: number;
  lore_submitted: boolean;
  lore_approved: boolean;
  last_leadando_submitted: string | null;
};

type TabKey = "kezelo" | "invites" | "users";
type UserPanelTab = "osszegzo" | "leadando" | "tickets" | "service" | "lore" | "warnings";

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

function isLockAbortError(reason: any) {
  const name = reason?.name || reason?.cause?.name;
  const msg = String(reason?.message || "");
  return name === "AbortError" || msg.toLowerCase().includes("lock request is aborted");
}

function normalizeUrl(u: string) {
  const s = (u || "").trim();
  if (!s) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

function extractFirstImgurUrl(text: string | null | undefined) {
  const s = (text || "").trim();
  if (!s) return null;
  const m = s.match(/https?:\/\/(?:i\.)?imgur\.com\/[^\s)]+/i);
  return m?.[0] ?? null;
}

function ticketTypeLabel(t: TicketRow) {
  const type = (t.type || t.payload?.type || "").toString().toLowerCase();
  if (type === "szankcio") return "Szankció";
  if (type === "inaktivitas") return "Inaktivitás";
  if (type === "nevvaltas") return "Névváltás";
  return type ? type : "—";
}

function getTicketImgurUrl(t: TicketRow) {
  const a = (t.sanction_imgur_url || "").trim();
  if (a) return a;

  const b = (
    t.payload?.sanction_imgur_url ||
    t.payload?.imgur_url ||
    t.payload?.imgur ||
    t.payload?.image ||
    ""
  )
    .toString()
    .trim();
  if (b) return b;

  const c = extractFirstImgurUrl(t.description);
  if (c) return c;

  return null;
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
  const [userPanelTab, setUserPanelTab] = useState<UserPanelTab>("osszegzo");

  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [leadando, setLeadando] = useState<LeadandoRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRow[]>([]);
  const [lore, setLore] = useState<LoreRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));

  function tabBtnStyle(active: boolean) {
    return `rounded-lg border px-3 py-2 text-sm ${
      active ? "bg-red-600/90 border-red-500" : "bg-white/5 border-white/10 hover:bg-white/10"
    }`;
  }

  function subTabStyle(active: boolean) {
    return `rounded-lg border px-3 py-1.5 text-xs ${
      active ? "bg-red-600/80 border-red-500" : "bg-white/5 border-white/10 hover:bg-white/10"
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

  async function loadSessionStable() {
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();

      if (userErr) {
        if (!isLockAbortError(userErr)) {
          console.error("getUser error:", userErr);
          setError(userErr.message || "Auth hiba.");
        }
        setToken(null);
        return;
      }

      if (!userData?.user) {
        setToken(null);
        return;
      }

      const { data: sessData, error: sessErr } = await supabase.auth.getSession();

      if (sessErr) {
        if (!isLockAbortError(sessErr)) {
          console.error("getSession error:", sessErr);
          setError(sessErr.message || "Session hiba.");
        }
        setToken(null);
        return;
      }

      setToken(sessData.session?.access_token ?? null);
    } catch (e: any) {
      if (!isLockAbortError(e)) {
        console.error("loadSessionStable fatal:", e);
        setError(e?.message ?? "Session hiba.");
      }
      setToken(null);
    }
  }

  async function loadBaseData() {
    const [{ data: meRes }, membersRes, ranksRes] = await Promise.all([
      supabase.from("profiles").select("user_id,ic_name,status,site_role").maybeSingle(),
      supabase.from("profiles").select("user_id,ic_name").limit(1000),
      supabase.from("ranks").select("id,name,category,priority,is_archived").order("priority", { ascending: true }),
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

  function clearUserDetailState() {
    setWarnings([]);
    setLeadando([]);
    setTickets([]);
    setServiceRequests([]);
    setLore([]);
    setSummary(null);
    setUserPanelTab("osszegzo");
  }

  async function openUser(row: UserRow) {
    if (selectedUser?.user_id === row.user_id) {
      setSelectedUser(null);
      clearUserDetailState();
      return;
    }

    setSelectedUser(row);
    clearUserDetailState();
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
      setTickets((json.tickets ?? []) as TicketRow[]);
      setServiceRequests((json.service_requests ?? []) as ServiceRow[]);
      setLore((json.lore ?? []) as LoreRow[]);
      setSummary((json.summary ?? null) as Summary | null);
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
          x.id === id ? { ...x, is_approved: approve, approved_at: approve ? new Date().toISOString() : null } : x
        )
      );
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  // ✅ Leadandó törlés (route: /api/admin/leadando/delete)
  async function deleteLeadando(id: string) {
    setError(null);
    setBusy(`leaddel:${id}`);
    try {
      await apiFetch("/api/admin/leadando/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      setLeadando((prev) => prev.filter((l) => l.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Nem sikerült törölni a leadandót.");
    } finally {
      setBusy(null);
    }
  }

  // ✅ Ticket törlés (route: /api/admin/tickets/delete)
  async function deleteTicket(id: string) {
    setError(null);
    setBusy(`ticketdel:${id}`);
    try {
      await apiFetch("/api/admin/tickets/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      setTickets((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Nem sikerült törölni a ticketet.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshAll() {
    setError(null);
    setBusy("refresh");
    try {
      await loadSessionStable();
      await loadBaseData();
      if (token) {
        await Promise.all([loadInvites(), loadUsers(1)]);
      }
    } catch (e: any) {
      if (!isLockAbortError(e)) setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    loadSessionStable();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      await loadSessionStable();
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
      if (!isLockAbortError(e)) setError(e?.message ?? "Hiba történt.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const selectedRankName = useMemo(() => {
    if (!selectedUser?.rank_id) return "—";
    return ranks.find((r) => r.id === selectedUser.rank_id)?.name || "—";
  }, [selectedUser?.rank_id, ranks]);

  const lastLeadando = leadando[0] ?? null;
  const openTicketsCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const pendingServiceCount = serviceRequests.filter((s) => s.status === "pending").length;
  const lastLore = lore[0] ?? null;

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

      {/* ===== Kezelőpanel ===== */}
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
                  disabled={!token}
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
                            {selectedUser?.user_id === row.user_id ? "Bezárás" : "Megnyitás"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ===== USER DETAIL ===== */}
            {selectedUser && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{selectedUser.ic_name || "—"}</div>
                    <div className="text-xs opacity-70">user_id: {selectedUser.user_id}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button className={subTabStyle(userPanelTab === "osszegzo")} onClick={() => setUserPanelTab("osszegzo")}>
                      Összegző
                    </button>
                    <button className={subTabStyle(userPanelTab === "leadando")} onClick={() => setUserPanelTab("leadando")}>
                      Leadandó
                    </button>
                    <button className={subTabStyle(userPanelTab === "tickets")} onClick={() => setUserPanelTab("tickets")}>
                      Ticketek
                    </button>
                    <button className={subTabStyle(userPanelTab === "service")} onClick={() => setUserPanelTab("service")}>
                      Szereltetés
                    </button>
                    <button className={subTabStyle(userPanelTab === "lore")} onClick={() => setUserPanelTab("lore")}>
                      Karaktertörténet
                    </button>
                    <button className={subTabStyle(userPanelTab === "warnings")} onClick={() => setUserPanelTab("warnings")}>
                      Figyelmeztetések
                    </button>
                  </div>
                </div>

                {/* Állítható adatok */}
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div>
                    <div className="text-sm opacity-80">Státusz</div>
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                      value={selectedUser.status || ""}
                      onChange={(e) => saveUserPatch({ status: e.target.value })}
                      disabled={!token || busy?.startsWith("save:")}
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
                      disabled={!token || busy?.startsWith("save:")}
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
                      disabled={!token || busy?.startsWith("save:")}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="owner">owner</option>
                    </select>
                  </div>
                </div>

                {/* ===== ÖSSZEGZŐ ===== */}
                {userPanelTab === "osszegzo" && (
                  <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold">Összegző</div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                        <div className="opacity-80">Rang</div>
                        <div className="mt-1 font-semibold">{selectedRankName}</div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                        <div className="opacity-80">Leadandó (utolsó)</div>
                        <div className="mt-1 font-semibold">{summary?.last_leadando_submitted ? fmt(summary.last_leadando_submitted) : "—"}</div>
                        <div className="mt-1 text-xs opacity-70">
                          {lastLeadando ? (
                            <>
                              Hetek: {lastLeadando.weeks} •{" "}
                              <a className="underline" target="_blank" rel="noreferrer" href={normalizeUrl(lastLeadando.imgur_url)}>
                                Imgur
                              </a>
                            </>
                          ) : (
                            "Nincs leadandó."
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                        <div className="opacity-80">Ticketek</div>
                        <div className="mt-1 font-semibold">
                          Nyitott: {summary?.open_tickets ?? openTicketsCount} / Összes: {summary?.total_tickets ?? tickets.length}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                        <div className="opacity-80">Szereltetés</div>
                        <div className="mt-1 font-semibold">
                          Függő: {summary?.pending_service ?? pendingServiceCount} / Összes: {summary?.total_service ?? serviceRequests.length}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                        <div className="opacity-80">Karaktertörténet</div>
                        <div className="mt-1 font-semibold">
                          {summary?.lore_submitted ? (summary?.lore_approved ? "Leadva (Approved)" : "Leadva (Pending)") : "Nincs leadva"}
                        </div>
                        <div className="mt-1 text-xs opacity-70">
                          {lastLore ? (
                            <>
                              {fmt(lastLore.submitted_at)} •{" "}
                              <a className="underline" target="_blank" rel="noreferrer" href={normalizeUrl(lastLore.lore_url)}>
                                Link
                              </a>
                            </>
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== LEADANDÓ ===== */}
                {userPanelTab === "leadando" && (
                  <div className="mt-6">
                    <div className="text-sm font-semibold">Leadandó</div>
                    <div className="mt-2 space-y-2">
                      {leadando.length === 0 ? (
                        <div className="text-sm opacity-70">Nincs leadandó.</div>
                      ) : (
                        leadando.map((l) => (
                          <div key={l.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-medium">
                                  Hetek száma: {l.weeks} • Beküldve: {fmt(l.submitted_at)}
                                </div>
                                <div className="mt-1 text-xs opacity-70">
                                  Imgur:{" "}
                                  <a className="underline hover:opacity-90" target="_blank" rel="noreferrer" href={normalizeUrl(l.imgur_url)}>
                                    {l.imgur_url}
                                  </a>
                                </div>
                                <div className="mt-1 text-xs opacity-70">Állapot: {l.is_approved ? "Approved" : "Pending"}</div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => approveLeadando(l.id, true)}
                                  disabled={!token || busy === `lead:${l.id}`}
                                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15 disabled:opacity-50"
                                >
                                  {busy === `lead:${l.id}` ? "..." : "Jóváhagy"}
                                </button>

                                <button
                                  onClick={() => approveLeadando(l.id, false)}
                                  disabled={!token || busy === `lead:${l.id}`}
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-50"
                                >
                                  {busy === `lead:${l.id}` ? "..." : "Visszavon"}
                                </button>

                                <button
                                  onClick={() => deleteLeadando(l.id)}
                                  disabled={!token || busy === `leaddel:${l.id}`}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
                                >
                                  {busy === `leaddel:${l.id}` ? "..." : "Törlés"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* ===== TICKETEK ===== */}
                {userPanelTab === "tickets" && (
                  <div className="mt-6">
                    <div className="text-sm font-semibold">Ticketek</div>
                    <div className="mt-2 space-y-2">
                      {tickets.length === 0 ? (
                        <div className="text-sm opacity-70">Nincs ticket.</div>
                      ) : (
                        tickets.map((t) => {
                          const typeLbl = ticketTypeLabel(t);
                          const img = getTicketImgurUrl(t);

                          const sanctionReason = (t.sanction_reason || t.payload?.sanction_reason || t.payload?.reason || "")
                            .toString()
                            .trim();

                          return (
                            <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-[240px]">
                                  <div className="font-medium">{t.title}</div>
                                  <div className="mt-1 text-xs opacity-70">
                                    Típus: {typeLbl} • Státusz: {t.status} • Létrehozva: {fmt(t.created_at)}
                                  </div>

                                  {(t.description || "").trim() && (
                                    <div className="mt-2 text-xs opacity-80 whitespace-pre-wrap">{t.description}</div>
                                  )}

                                  {img && (
                                    <div className="mt-2 text-xs opacity-80">
                                      Kép:{" "}
                                      <a className="underline hover:opacity-90" target="_blank" rel="noreferrer" href={normalizeUrl(img)}>
                                        {img}
                                      </a>
                                    </div>
                                  )}

                                  {sanctionReason && (
                                    <div className="mt-2 text-xs opacity-80">
                                      Indok: <span className="opacity-90">{sanctionReason}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => deleteTicket(t.id)}
                                    disabled={!token || busy === `ticketdel:${t.id}`}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
                                  >
                                    {busy === `ticketdel:${t.id}` ? "..." : "Törlés"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* ===== SZERELTETÉS ===== */}
                {userPanelTab === "service" && (
                  <div className="mt-6">
                    <div className="text-sm font-semibold">Szereltetés igénylések</div>
                    <div className="mt-2 space-y-2">
                      {serviceRequests.length === 0 ? (
                        <div className="text-sm opacity-70">Nincs szereltetés igénylés.</div>
                      ) : (
                        serviceRequests.map((s) => (
                          <div key={s.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                            <div className="font-medium">{s.title}</div>
                            <div className="mt-1 text-xs opacity-70 whitespace-pre-wrap">{s.description}</div>
                            <div className="mt-1 text-xs opacity-70">
                              Státusz: {s.status} • Létrehozva: {fmt(s.created_at)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* ===== KARAKTERTÖRTÉNET ===== */}
                {userPanelTab === "lore" && (
                  <div className="mt-6">
                    <div className="text-sm font-semibold">Karaktertörténet leadások</div>
                    <div className="mt-2 space-y-2">
                      {lore.length === 0 ? (
                        <div className="text-sm opacity-70">Nincs karaktertörténet leadva.</div>
                      ) : (
                        lore.map((l) => (
                          <div key={l.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                            <div className="font-medium">
                              Beküldve: {fmt(l.submitted_at)} • Állapot: {l.is_approved ? "Approved" : "Pending"}
                            </div>
                            <div className="mt-1 text-xs opacity-70">
                              Link:{" "}
                              <a className="underline" target="_blank" rel="noreferrer" href={normalizeUrl(l.lore_url)}>
                                {l.lore_url}
                              </a>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* ===== FIGYELMEZTETÉSEK ===== */}
                {userPanelTab === "warnings" && (
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
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Invites ===== */}
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

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
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

          {lastGeneratedCode && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-sm opacity-80">Új kód (másold ki):</div>
              <div className="mt-1 text-2xl font-bold tracking-widest">{lastGeneratedCode.code}</div>
              <div className="mt-1 text-xs opacity-70">Lejár: {fmt(lastGeneratedCode.expires_at)}</div>
            </div>
          )}
        </div>
      )}

      {/* ===== Users tab ===== */}
      {tab === "users" && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
          <div className="text-sm opacity-80">Ezt a nézetet most nem használjuk, a Kezelőpanel alatt van minden.</div>
        </div>
      )}
    </div>
  );
}