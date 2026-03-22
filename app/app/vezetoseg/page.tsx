"use client";

import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DecisionBadge from "@/app/app/_components/decision-badge";
import RankBadge from "@/app/app/_components/rank-badge";

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
  discord_name?: string | null;
  status: string | null;
  site_role: string | null;
  rank_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  inactive_from?: string | null;
  inactive_to?: string | null;
  leadando_due_at?: string | null;
};

type MemberOption = {
  user_id: string;
  ic_name: string | null;
  discord_name?: string | null;
  status?: string | null;
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
  user_id?: string | null;
  imgur_url: string;
  weeks: number;
  submitted_at: string;
  is_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  approved_until?: string | null;
};

type ParkingRequestRow = {
  id: string;
  user_id: string;
  garage_slots: string[] | null;
  hangar_slots: string[] | null;
  status: "pending" | "approved" | "rejected" | string;
  review_note: string | null;
  created_at: string | null;
  updated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  profile?: UserRow | null;
};

type ParkingAssignmentRow = {
  id: string;
  area: "garage" | "hangar";
  slot_key: string;
  user_id: string | null;
  updated_at: string | null;
};

type InboxItemType = "leadando" | "ticket" | "service" | "lore" | "parking";

type UnifiedInboxRow = {
  inbox_type: InboxItemType;
  id: string;
  user_id: string | null;
  submitted_at: string;
  title?: string | null;
  subtitle?: string | null;
  status_label?: string | null;
  profile: UserRow | null;
  leadando?: LeadandoRow | null;
  ticket?: TicketRow | null;
  service?: ServiceRow | null;
  lore?: LoreRow | null;
  parking_request?: ParkingRequestRow | null;
};

type TicketRow = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "open" | "in_progress" | "closed" | string;
  created_at: string;
  updated_at: string;
  type?: "szankcio" | "inaktivitas" | "nevvaltas" | string | null;
  sanction_imgur_url?: string | null;
  sanction_reason?: string | null;
  inactivity_from?: string | null;
  inactivity_to?: string | null;
  old_name?: string | null;
  new_name?: string | null;
  namechange_reason?: string | null;
  payload?: any;
};

type ServiceRow = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "done" | string;
  created_at: string;
  updated_at: string;
  vehicle_type?: string | null;
  plate?: string | null;
  event_name?: string | null;
  amount?: string | null;
  imgur_url?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};

type LoreRow = {
  id: string;
  lore_url: string;
  submitted_at: string;
  is_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  discord_name?: string | null;
  pastebin_url?: string | null;
};

type Summary = {
  open_tickets: number;
  total_tickets: number;
  pending_service: number;
  total_service: number;
  lore_submitted: boolean;
  lore_approved: boolean;
  last_leadando_submitted: string | null;
  discord_name?: string | null;
  joined_at?: string | null;
  is_blacklisted?: boolean;
  pending_event_feedback_count?: number;
  assigned_garage_slots?: string[];
  assigned_hangar_slots?: string[];
};

type EventFeedbackRow = {
  event_id: string;
  event_name: string;
  attended: boolean;
  was_online: boolean;
  pending_feedback: "jo" | "semleges" | "rossz" | "nagyon_rossz" | string;
};

type BlacklistRow = {
  id: string;
  user_id: string | null;
  ic_name: string;
  discord_name: string | null;
  reason: string;
  previous_status?: string | null;
  created_at: string;
  created_by: string | null;
};

type TgfNoteRow = {
  id?: string;
  user_id: string;
  notes: string;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
};

type TgfListRow = {
  profile: UserRow;
  tgf_note: TgfNoteRow | null;
};

type LeadandoDashboardRow = {
  user_id: string;
  ic_name: string | null;
  status: string | null;
  site_role: string | null;
  rank_id: string | null;
  rank_name: string | null;
  rank_priority: number | null;
  leadando_due_at: string | null;
  latest_submission: LeadandoRow | null;
};

type TabKey = "kezelo" | "invites" | "users" | "leadandok" | "parking" | "kerdoivek" | "tgf" | "blacklist";
type UserPanelTab = "osszegzo" | "tgf" | "leadando" | "tickets" | "service" | "lore" | "warnings";

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

function formatMoney(value: string | null | undefined) {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "—";
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}$`;
}

function formatDateOnly(dateString?: string | null) {
  if (!dateString) return "—";
  return dateString.split("T")[0];
}

function toDateInputValue(dateString?: string | null) {
  if (!dateString) return "";
  return String(dateString).slice(0, 10);
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

function prettyPendingFeedback(value: string | null | undefined) {
  const s = (value || "").toLowerCase();
  if (s === "jo") return "Jó";
  if (s === "semleges") return "Semleges";
  if (s === "rossz") return "Rossz";
  if (s === "nagyon_rossz") return "Nagyon rossz";
  return value || "—";
}

function ticketTypeLabel(t: TicketRow) {
  const type = (t.type || t.payload?.type || "").toString().toLowerCase();
  if (type === "szankcio" || type === "sanction") return "Szankció";
  if (type === "inaktivitas" || type === "inactivity") return "Inaktivitás";
  if (type === "nevvaltas" || type === "namechange") return "Névváltás";
  return type ? type : "—";
}

function normalizeTicketDecisionStatus(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  if (s === "approved" || s === "accepted" || s === "closed") return "approved";
  if (s === "rejected") return "rejected";
  return "pending";
}

function prettyTicketDecision(status: string | null | undefined) {
  const s = normalizeTicketDecisionStatus(status);
  if (s === "approved") return "Elfogadva";
  if (s === "rejected") return "Elutasítva";
  return "Függőben";
}

function statusBadgeStyle(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "leadership":
      return "border-amber-500/30 bg-amber-500/15 text-amber-200";
    case "active":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
    case "pending":
      return "border-yellow-500/30 bg-yellow-500/15 text-yellow-200";
    case "inactive":
      return "border-zinc-500/30 bg-zinc-500/15 text-zinc-200";
    case "preinvite":
      return "border-sky-500/30 bg-sky-500/15 text-sky-200";
    default:
      return "border-white/10 bg-white/5 text-white/80";
  }
}

function roleBadgeStyle(role: string | null | undefined) {
  switch ((role || "").toLowerCase()) {
    case "owner":
      return "border-red-500/30 bg-red-500/15 text-red-200";
    case "admin":
      return "border-violet-500/30 bg-violet-500/15 text-violet-200";
    case "user":
      return "border-white/10 bg-white/5 text-white/80";
    default:
      return "border-white/10 bg-white/5 text-white/80";
  }
}

function prettyStatus(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  if (s === "leadership") return "Vezetőség";
  if (s === "active") return "Aktív";
  if (s === "pending") return "Pending";
  if (s === "inactive") return "Inaktív";
  if (s === "preinvite") return "Meghívás előtt";
  return status || "—";
}

function prettyRole(role: string | null | undefined) {
  const s = (role || "").toLowerCase();
  if (s === "owner") return "Tulajdonos";
  if (s === "admin") return "Admin";
  if (s === "user") return "User";
  return role || "—";
}

function activeInactivityBadge(user: UserRow) {
  if (!user.inactive_from || !user.inactive_to) {
    return <span className="text-white/25 line-through">—</span>;
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const fromKey = String(user.inactive_from).slice(0, 10);
  const toKey = String(user.inactive_to).slice(0, 10);

  if (!fromKey || !toKey || todayKey < fromKey || todayKey > toKey) {
    return <span className="text-white/25 line-through">—</span>;
  }

  return (
    <span className="inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/15 px-2 py-1 text-xs font-medium text-yellow-200">
      Inaktív: {formatDateOnly(user.inactive_from)}–{formatDateOnly(user.inactive_to)}
    </span>
  );
}

function getUserStatusOrder(status: string | null | undefined) {
  const s = (status || "").toLowerCase();

  if (s === "preinvite") return 0;
  if (s === "pending") return 1;
  if (s === "active" || s === "leadership") return 2;
  if (s === "inactive") return 3;

  return 4;
}

function getUserRankPriority(rankId: string | null | undefined, ranks: RankRow[]) {
  if (!rankId) return Number.MAX_SAFE_INTEGER;
  const rank = ranks.find((r) => r.id === rankId);
  return typeof rank?.priority === "number" ? rank.priority : Number.MAX_SAFE_INTEGER;
}

function compareUsersForLeadershipTable(a: UserRow, b: UserRow, ranks: RankRow[]) {
  const aStatusOrder = getUserStatusOrder(a.status);
  const bStatusOrder = getUserStatusOrder(b.status);

  if (aStatusOrder !== bStatusOrder) {
    return aStatusOrder - bStatusOrder;
  }

  const aStatus = (a.status || "").toLowerCase();
  const bStatus = (b.status || "").toLowerCase();
  const aIsRankSorted = aStatus === "active" || aStatus === "leadership";
  const bIsRankSorted = bStatus === "active" || bStatus === "leadership";

  if (aIsRankSorted && bIsRankSorted) {
    const aPriority = getUserRankPriority(a.rank_id, ranks);
    const bPriority = getUserRankPriority(b.rank_id, ranks);

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
  }

  const aName = (a.ic_name || "").trim().toLocaleLowerCase("hu");
  const bName = (b.ic_name || "").trim().toLocaleLowerCase("hu");

  if (aName !== bName) {
    return aName.localeCompare(bName, "hu");
  }

  return (a.created_at || "").localeCompare(b.created_at || "");
}

function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}`.trim()}>
      {children}
    </span>
  );
}

function getTicketImgurUrl(t: TicketRow) {
  const a = (t.sanction_imgur_url || "").trim();
  if (a) return a;

  const b = (t.payload?.sanction_imgur_url || t.payload?.imgur_url || t.payload?.imgur || t.payload?.image || "")
    .toString()
    .trim();
  if (b) return b;

  const c = extractFirstImgurUrl(t.description);
  if (c) return c;

  return null;
}

export default function VezetosegPage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<TabKey>("kezelo");
  const [token, setToken] = useState<string | null>(null);

  const [me, setMe] = useState<MyProfile | null>(null);

  const [members, setMembers] = useState<MemberOption[]>([]);
  const nameMap = useMemo(() => new Map(members.map((m) => [m.user_id, m.ic_name || "—"])), [members]);
  const selectableBlacklistUsers = useMemo(
    () => members.filter((m) => m.status === "active" || m.status === "leadership"),
    [members]
  );

  const [ranks, setRanks] = useState<RankRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const activeInvites = useMemo(() => invites.filter(isInviteActive), [invites]);
  const [lastGeneratedCode, setLastGeneratedCode] = useState<{ code: string; expires_at: string } | null>(null);

  const [blacklist, setBlacklist] = useState<BlacklistRow[]>([]);
  const [blacklistMode, setBlacklistMode] = useState<"existing" | "manual">("existing");
  const [blacklistSelectedUserId, setBlacklistSelectedUserId] = useState("");
  const [blacklistManualIcName, setBlacklistManualIcName] = useState("");
  const [blacklistManualDiscordName, setBlacklistManualDiscordName] = useState("");
  const [blacklistReason, setBlacklistReason] = useState("");

  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => compareUsersForLeadershipTable(a, b, ranks));
  }, [users, ranks]);

  const [leadandoDashboardRows, setLeadandoDashboardRows] = useState<LeadandoDashboardRow[]>([]);
  const [leadandoDeadlineDrafts, setLeadandoDeadlineDrafts] = useState<Record<string, string>>({});
  const [leadandoDeadlineEditing, setLeadandoDeadlineEditing] = useState<Record<string, boolean>>({});

  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [userPanelTab, setUserPanelTab] = useState<UserPanelTab>("osszegzo");

  const [editingIcName, setEditingIcName] = useState(false);
  const [editedIcName, setEditedIcName] = useState("");

  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [leadando, setLeadando] = useState<LeadandoRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRow[]>([]);
  const [lore, setLore] = useState<LoreRow[]>([]);
  const [parkingRequests, setParkingRequests] = useState<ParkingRequestRow[]>([]);
  const [parkingAssignments, setParkingAssignments] = useState<ParkingAssignmentRow[]>([]);
  const [unifiedInbox, setUnifiedInbox] = useState<UnifiedInboxRow[]>([]);
  const [tgfRows, setTgfRows] = useState<TgfListRow[]>([]);
  const [tgfDrafts, setTgfDrafts] = useState<Record<string, string>>({});
  const [tgfEditingRows, setTgfEditingRows] = useState<Record<string, boolean>>({});
  const [tgfNote, setTgfNote] = useState<TgfNoteRow | null>(null);
  const [tgfDraft, setTgfDraft] = useState("");
  const [isEditingTgfDetail, setIsEditingTgfDetail] = useState(false);
  const [eventFeedbacks, setEventFeedbacks] = useState<EventFeedbackRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));

  const canAccessLeadership =
    me?.site_role === "owner" || me?.site_role === "admin" || me?.status === "leadership";

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

  function getRankName(rankId: string | null | undefined) {
    if (!rankId) return null;
    return ranks.find((r) => r.id === rankId)?.name ?? "Törölt rang";
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

  async function loadSessionStable() {
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();

      if (userErr) {
        if (!isLockAbortError(userErr)) {
          console.error("getUser error:", userErr);
          setError(userErr.message || "Auth hiba.");
        }
        return;
      }

      const user = userData?.user;
      if (!user) return;

      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) {
        if (!isLockAbortError(sessErr)) {
          console.error("getSession error:", sessErr);
          setError(sessErr.message || "Session hiba.");
        }
        return;
      }

      setToken(sessData.session?.access_token ?? null);

      const { data: myProfile, error: myErr } = await supabase
        .from("profiles")
        .select("user_id,ic_name,status,site_role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (myErr) {
        setError(myErr.message);
        return;
      }

      setMe((myProfile ?? null) as MyProfile | null);
    } catch (e: any) {
      if (!isLockAbortError(e)) {
        setError(e?.message ?? "Auth hiba.");
      }
    }
  }

  async function loadSharedData() {
    const [membersRes, ranksRes] = await Promise.all([
      supabase.from("profiles").select("user_id,ic_name,discord_name,status").order("ic_name", { ascending: true }),
      supabase.from("ranks").select("id,name,category,priority,is_archived").order("priority", { ascending: true }),
    ]);

    if (!membersRes.error) setMembers((membersRes.data ?? []) as any);
    if (!ranksRes.error) setRanks((ranksRes.data ?? []) as any);
  }

  async function loadInvites() {
    const json = await apiFetch("/api/admin/invites/list");
    setInvites((json.rows ?? []) as InviteRow[]);
  }

  async function loadBlacklist() {
    const json = await apiFetch("/api/admin/blacklist/list");
    setBlacklist((json.rows ?? []) as BlacklistRow[]);
  }

  async function generateInvite() {
    setError(null);
    setBusy("invite:generate");
    try {
      const json = await apiFetch("/api/admin/invites/generate", { method: "POST" });
      setLastGeneratedCode(json.invite ?? null);
      await loadInvites();
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function revokeInvite(id: number) {
    setError(null);
    setBusy(`invite:revoke:${id}`);
    try {
      await apiFetch("/api/admin/invites/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      setInvites((prev) => prev.map((it) => (it.id === id ? { ...it, revoked: true } : it)));
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

  async function loadLeadandoDashboard() {
    try {
      const json = await apiFetch("/api/admin/leadando/dashboard");
      const rows = (json.rows ?? []) as LeadandoDashboardRow[];
      setLeadandoDashboardRows(rows);
      setLeadandoDeadlineDrafts(
        Object.fromEntries(
          rows.map((row) => [
            row.user_id,
            toDateInputValue(row.latest_submission?.approved_until || row.leadando_due_at || null),
          ])
        )
      );
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    }
  }

  async function saveLeadandoDeadline(submissionId: string, userId: string, approvedUntil: string) {
    const normalized = approvedUntil.trim();
    if (!normalized) {
      setError("Add meg a leadandó érvényességi határidejét.");
      return;
    }

    setError(null);
    setBusy(`leadando:deadline:${submissionId}`);

    try {
      const json = await apiFetch("/api/admin/leadando/update-deadline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: submissionId, approved_until: normalized }),
      });

      const approvedUntilIso = json?.approved_until
        ? String(json.approved_until)
        : new Date(`${normalized}T23:59:59`).toISOString();

      setLeadando((prev) =>
        prev.map((l) => (l.id === submissionId ? { ...l, approved_until: approvedUntilIso } : l))
      );

      setLeadandoDashboardRows((prev) =>
        prev.map((row) =>
          row.user_id === userId
            ? {
                ...row,
                leadando_due_at: approvedUntilIso,
                latest_submission:
                  row.latest_submission && row.latest_submission.id === submissionId
                    ? { ...row.latest_submission, approved_until: approvedUntilIso }
                    : row.latest_submission,
              }
            : row
        )
      );

      setLeadandoDeadlineDrafts((prev) => ({
        ...prev,
        [userId]: toDateInputValue(approvedUntilIso),
      }));

      setLeadandoDeadlineEditing((prev) => ({
        ...prev,
        [userId]: false,
      }));

      if (selectedUser?.user_id === userId) {
        setSelectedUser((prev) => (prev ? { ...prev, leadando_due_at: approvedUntilIso } : prev));
      }

      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, leadando_due_at: approvedUntilIso } : u)));
      await loadUsers(page);
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  function clearUserDetailState() {
    setWarnings([]);
    setLeadando([]);
    setTickets([]);
    setServiceRequests([]);
    setLore([]);
    setParkingAssignments([]);
    setTgfNote(null);
    setTgfDraft("");
    setIsEditingTgfDetail(false);
    setSummary(null);
    setUserPanelTab("osszegzo");
    setEditingIcName(false);
    setEditedIcName("");
  }

async function refreshSelectedUserDetails(userId: string) {
  try {
    const json = await apiFetch("/api/admin/users/detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });

    setWarnings((json.warnings ?? []) as WarningRow[]);
    setLeadando((json.leadando ?? []) as LeadandoRow[]);
    setTickets((json.tickets ?? []) as TicketRow[]);
    setServiceRequests((json.service_requests ?? []) as ServiceRow[]);
    setLore((json.lore ?? []) as LoreRow[]);
    setParkingAssignments((json.parking_assignments ?? []) as ParkingAssignmentRow[]);
    setTgfNote((json.tgf_note ?? null) as TgfNoteRow | null);
    setTgfDraft(((json.tgf_note?.notes ?? "") as string));
    setEventFeedbacks((json.event_feedbacks ?? []) as EventFeedbackRow[]);
    setSummary((json.summary ?? null) as Summary | null);

    if (json.summary?.discord_name) {
      setSelectedUser((prev) =>
        prev && prev.user_id === userId
          ? { ...prev, discord_name: json.summary.discord_name }
          : prev
      );
    }
  } catch (e: any) {
    console.error("refreshSelectedUserDetails error:", e);
  }
}

async function reloadVisibleLeadershipData(options?: { includeSelectedUser?: boolean }) {
  const jobs: Promise<any>[] = [loadSharedData()];

  if (tab === "invites") jobs.push(loadInvites());
  if (tab === "users") jobs.push(loadUsers(page));
  if (tab === "leadandok") jobs.push(loadLeadandoDashboard());
  if (tab === "parking" || tab === "kezelo") jobs.push(loadParkingRequests());
  if (tab === "kezelo" || tab === "kerdoivek") jobs.push(loadUnifiedInbox());
  if (tab === "kezelo" || tab === "tgf") jobs.push(loadTgfRows());
  if (tab === "blacklist") jobs.push(loadBlacklist());

  await Promise.allSettled(jobs);

  if (options?.includeSelectedUser && selectedUser?.user_id) {
    await refreshSelectedUserDetails(selectedUser.user_id);
  }
}

function scheduleRealtimeRefresh(includeSelectedUser = true) {
  if (realtimeRefreshTimeoutRef.current) {
    clearTimeout(realtimeRefreshTimeoutRef.current);
  }

  realtimeRefreshTimeoutRef.current = setTimeout(() => {
    void reloadVisibleLeadershipData({ includeSelectedUser });
  }, 250);
}

async function openUser(row: UserRow) {
  if (selectedUser?.user_id === row.user_id) {
    setSelectedUser(null);
    clearUserDetailState();
    return;
  }

  setSelectedUser(row);
    setEditedIcName(row.ic_name || "");
    setEditingIcName(false);
    setWarnings([]);
    setLeadando([]);
    setTickets([]);
    setServiceRequests([]);
    setLore([]);
    setParkingAssignments([]);
    setTgfNote(null);
    setTgfDraft("");
    setIsEditingTgfDetail(false);
    setSummary(null);
    setUserPanelTab("osszegzo");
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
      setParkingAssignments((json.parking_assignments ?? []) as ParkingAssignmentRow[]);
      setTgfNote((json.tgf_note ?? null) as TgfNoteRow | null);
      setTgfDraft(((json.tgf_note?.notes ?? "") as string));
      setEventFeedbacks((json.event_feedbacks ?? []) as EventFeedbackRow[]);
      setSummary((json.summary ?? null) as Summary | null);

      if (json.summary?.discord_name) {
        setSelectedUser((prev) => (prev ? { ...prev, discord_name: json.summary.discord_name } : prev));
      }
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

  async function saveIcName() {
    if (!selectedUser) return;

    const newName = editedIcName.trim();
    if (!newName) {
      setError("Az IC név nem lehet üres.");
      return;
    }

    setError(null);
    setBusy(`icname:${selectedUser.user_id}`);

    try {
      await apiFetch("/api/admin/users/update-ic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUser.user_id,
          ic_name: newName,
        }),
      });

      const merged: UserRow = { ...selectedUser, ic_name: newName };
      setSelectedUser(merged);

      setUsers((prev) => prev.map((u) => (u.user_id === selectedUser.user_id ? { ...u, ic_name: newName } : u)));
      setMembers((prev) => prev.map((m) => (m.user_id === selectedUser.user_id ? { ...m, ic_name: newName } : m)));

      setEditingIcName(false);
      setEditedIcName(newName);

      await loadUsers(page);
    } catch (e: any) {
      setError(e?.message ?? "Nem sikerült frissíteni az IC nevet.");
    } finally {
      setBusy(null);
    }
  }

  async function approveLeadando(id: string, approve: boolean, approvedUntil?: string | null) {
    setError(null);
    setBusy(`leadando:${id}`);

    try {
      const normalizedApprovedUntil = approve
        ? approvedUntil && approvedUntil.trim()
          ? new Date(`${approvedUntil.trim()}T23:59:59`).toISOString()
          : null
        : null;

      await apiFetch("/api/admin/leadando/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approve, approved_until: normalizedApprovedUntil }),
      });

      setLeadando((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                is_approved: approve,
                approved_at: approve ? new Date().toISOString() : null,
                approved_until: normalizedApprovedUntil,
              }
            : l
        )
      );

      setUsers((prev) =>
        prev.map((u) =>
          selectedUser && u.user_id === selectedUser.user_id
            ? { ...u, leadando_due_at: approve ? normalizedApprovedUntil : null }
            : u
        )
      );

      if (selectedUser) {
        setSelectedUser((prev) => (prev ? { ...prev, leadando_due_at: approve ? normalizedApprovedUntil : null } : prev));
      }

      await loadUnifiedInbox();
      await loadUsers(page);
      await loadLeadandoDashboard();
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteLeadando(id: string) {
    setError(null);
    setBusy(`leadandodel:${id}`);

    try {
      await apiFetch("/api/admin/leadando/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      setLeadando((prev) => prev.filter((l) => l.id !== id));
      await loadUnifiedInbox();
      await loadLeadandoDashboard();
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function updateTicketStatus(id: string, status: string) {
    setError(null);
    setBusy(`ticket:${id}`);

    try {
      await apiFetch("/api/admin/tickets/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      await loadUnifiedInbox();
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

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
      await loadUnifiedInbox();
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function createWarning() {
    if (!selectedUser) return;

    const reason = window.prompt("Figyelmeztetés oka:");
    if (!reason || !reason.trim()) return;

    const expires_at = window.prompt("Lejárat (opcionális, pl. 2026-03-31):")?.trim() || null;

    setError(null);
    setBusy(`warncreate:${selectedUser.user_id}`);

    try {
      const json = await apiFetch("/api/admin/warnings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUser.user_id, reason: reason.trim(), expires_at }),
      });

      if (json.row) {
        setWarnings((prev) => [json.row as WarningRow, ...prev]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteWarning(id: string) {
    setError(null);
    setBusy(`warndel:${id}`);

    try {
      await apiFetch("/api/admin/warnings/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      setWarnings((prev) => prev.filter((w) => w.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function approveServiceRequest(id: string) {
    setError(null);
    setBusy(`service:${id}`);

    try {
      await apiFetch("/api/admin/service/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "approved" }),
      });

      await loadUnifiedInbox();

      setServiceRequests((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: "approved",
                reviewed_at: new Date().toISOString(),
              }
            : s
        )
      );
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteServiceRequest(id: string) {
    setError(null);
    setBusy(`servicedel:${id}`);

    try {
      await apiFetch("/api/admin/service/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      setServiceRequests((prev) => prev.filter((s) => s.id !== id));
      await loadUnifiedInbox();
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function approveLoreSubmission(id: string, approve: boolean) {
    setError(null);
    setBusy(`lore:${id}:${approve ? "approve" : "revoke"}`);

    try {
      await apiFetch("/api/admin/lore/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approve }),
      });

      setLore((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, is_approved: approve, approved_at: approve ? new Date().toISOString() : null }
            : l
        )
      );

      await loadUnifiedInbox();

      setSummary((prev) => {
        if (!prev) return prev;
        const firstLoreId = lore[0]?.id;
        if (firstLoreId !== id) return prev;
        return { ...prev, lore_approved: approve };
      });
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteLoreSubmission(id: string) {
    setError(null);
    setBusy(`loredel:${id}`);

    try {
      await apiFetch("/api/admin/lore/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const remaining = lore.filter((l) => l.id !== id);
      setLore(remaining);
      await loadUnifiedInbox();

      setSummary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lore_submitted: remaining.length > 0,
          lore_approved: remaining.length > 0 ? !!remaining[0]?.is_approved : false,
          discord_name: remaining[0]?.discord_name ?? prev.discord_name ?? null,
        };
      });
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function loadParkingRequests() {
    try {
      const json = await apiFetch("/api/parking/request-list");
      setParkingRequests((json.rows ?? []) as ParkingRequestRow[]);
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    }
  }

  async function reviewParkingRequest(requestId: string, approve: boolean) {
    setError(null);
    setBusy(`parking:${requestId}`);

    try {
      const json = await apiFetch("/api/parking/request-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, approve }),
      });

      const updated = json.row as ParkingRequestRow;
      setParkingRequests((prev) => prev.map((item) => (item.id === requestId ? { ...item, ...updated } : item)));
      await loadUnifiedInbox();
      await loadUsers(page);
      if (selectedUser?.user_id === updated.user_id) {
        const currentUser = selectedUser;
        setSelectedUser(null);
        await openUser({ ...currentUser });
      }
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteParkingRequest(requestId: string) {
    setError(null);
    setBusy(`parkingdel:${requestId}`);

    try {
      await apiFetch("/api/admin/parking-request/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });

      setParkingRequests((prev) => prev.filter((item) => item.id !== requestId));
      await loadUnifiedInbox();
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function loadUnifiedInbox() {
    try {
      const json = await apiFetch("/api/admin/inbox/list");
      setUnifiedInbox((json.rows ?? []) as UnifiedInboxRow[]);
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    }
  }

  async function loadTgfRows() {
    try {
      const json = await apiFetch("/api/admin/tgf/list");
      const rows = (json.rows ?? []) as TgfListRow[];
      setTgfRows(rows);
      setTgfDrafts(Object.fromEntries(rows.map((row) => [row.profile.user_id, row.tgf_note?.notes ?? ""])));
      setTgfEditingRows({});
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    }
  }

  async function saveTgfNote(userId: string, notes: string) {
    setError(null);
    setBusy(`tgf:${userId}`);

    try {
      const json = await apiFetch("/api/admin/tgf/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, notes }),
      });

      const row = (json.row ?? null) as TgfNoteRow | null;

      setTgfRows((prev) => prev.map((item) => (item.profile.user_id === userId ? { ...item, tgf_note: row } : item)));
      setTgfDrafts((prev) => ({ ...prev, [userId]: notes }));

      if (selectedUser?.user_id === userId) {
        setTgfNote(row);
        setTgfDraft(notes);
        setIsEditingTgfDetail(false);
      }

      setTgfEditingRows((prev) => ({ ...prev, [userId]: false }));
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function openInboxItem(row: UnifiedInboxRow) {
    if (row.inbox_type === "leadando") {
      setError(null);
      setTab("leadandok");
      await loadLeadandoDashboard();
      return;
    }

    if (row.inbox_type === "parking") {
      setError(null);
      setTab("parking");
      await loadParkingRequests();
      return;
    }

    if (!row.profile?.user_id) {
      setError("Ehhez a beküldéshez nem található felhasználó.");
      return;
    }

    const profile = row.profile;
    setSelectedUser(profile);
    setEditedIcName(profile.ic_name || "");
    setEditingIcName(false);
    setWarnings([]);
    setLeadando([]);
    setTickets([]);
    setServiceRequests([]);
    setLore([]);
    setParkingAssignments([]);
    setTgfNote(null);
    setTgfDraft("");
    setIsEditingTgfDetail(false);
    setSummary(null);
    setUserPanelTab(row.inbox_type === "ticket" ? "tickets" : row.inbox_type === "service" ? "service" : "lore");
    setError(null);
    setBusy(`open:${profile.user_id}`);
    setTab("users");

    try {
      const json = await apiFetch("/api/admin/users/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: profile.user_id }),
      });

      setWarnings((json.warnings ?? []) as WarningRow[]);
      setLeadando((json.leadando ?? []) as LeadandoRow[]);
      setTickets((json.tickets ?? []) as TicketRow[]);
      setServiceRequests((json.service_requests ?? []) as ServiceRow[]);
      setLore((json.lore ?? []) as LoreRow[]);
      setParkingAssignments((json.parking_assignments ?? []) as ParkingAssignmentRow[]);
      setTgfNote((json.tgf_note ?? null) as TgfNoteRow | null);
      setTgfDraft(((json.tgf_note?.notes ?? "") as string));
      setEventFeedbacks((json.event_feedbacks ?? []) as EventFeedbackRow[]);
      setSummary((json.summary ?? null) as Summary | null);

      if (json.summary?.discord_name) {
        setSelectedUser((prev) => (prev ? { ...prev, discord_name: json.summary.discord_name } : prev));
      }
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function createBlacklistEntry() {
    setError(null);
    setBusy("blacklist:create");

    try {
      const body =
        blacklistMode === "existing"
          ? { user_id: blacklistSelectedUserId, reason: blacklistReason }
          : {
              ic_name: blacklistManualIcName,
              discord_name: blacklistManualDiscordName,
              reason: blacklistReason,
            };

      const json = await apiFetch("/api/admin/blacklist/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (json.row) {
        setBlacklist((prev) => [json.row as BlacklistRow, ...prev]);
      }

      if (blacklistMode === "existing" && blacklistSelectedUserId) {
        setUsers((prev) => prev.map((u) => (u.user_id === blacklistSelectedUserId ? { ...u, status: "inactive" } : u)));
        setSelectedUser((prev) =>
          prev && prev.user_id === blacklistSelectedUserId ? { ...prev, status: "inactive" } : prev
        );
        setSummary((prev) => (prev ? { ...prev, is_blacklisted: true } : prev));
      }

      setBlacklistSelectedUserId("");
      setBlacklistManualIcName("");
      setBlacklistManualDiscordName("");
      setBlacklistReason("");

      await loadSharedData();
      await loadUsers(page);
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteBlacklistEntry(row: BlacklistRow) {
    setError(null);
    setBusy(`blacklist:delete:${row.id}`);

    try {
      await apiFetch("/api/admin/blacklist/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });

      setBlacklist((prev) => prev.filter((it) => it.id !== row.id));

      if (row.user_id) {
        const restoredStatus = row.previous_status || "pending";
        setUsers((prev) => prev.map((u) => (u.user_id === row.user_id ? { ...u, status: restoredStatus } : u)));
        setSelectedUser((prev) =>
          prev && prev.user_id === row.user_id ? { ...prev, status: restoredStatus } : prev
        );
        setSummary((prev) => (prev ? { ...prev, is_blacklisted: false } : prev));
      }

      await loadSharedData();
      await loadUsers(page);
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    loadSessionStable();
    loadSharedData();
  }, []);

  useEffect(() => {
    const incomingTab = searchParams.get("tab");
    if (
      incomingTab === "invites" ||
      incomingTab === "users" ||
      incomingTab === "leadandok" ||
      incomingTab === "parking" ||
      incomingTab === "kerdoivek" ||
      incomingTab === "tgf" ||
      incomingTab === "blacklist" ||
      incomingTab === "kezelo"
    ) {
      setTab(incomingTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!token) return;
    if (tab === "invites") loadInvites();
    if (tab === "users") loadUsers(1);
    if (tab === "leadandok") loadLeadandoDashboard();
    if (tab === "parking" || tab === "kezelo") loadParkingRequests();
    if (tab === "kezelo" || tab === "kerdoivek") loadUnifiedInbox();
    if (tab === "kezelo" || tab === "tgf") loadTgfRows();
    if (tab === "blacklist") loadBlacklist();
  }, [tab, token]);

  useEffect(() => {
    if (!token) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;

      if (tab === "invites") loadInvites();
      if (tab === "users") loadUsers(page);
      if (tab === "leadandok") loadLeadandoDashboard();
      if (tab === "parking" || tab === "kezelo") loadParkingRequests();
      if (tab === "kezelo" || tab === "kerdoivek") loadUnifiedInbox();
      if (tab === "kezelo" || tab === "tgf") loadTgfRows();
      if (tab === "blacklist") loadBlacklist();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [token, tab, page]);

useEffect(() => {
  if (!token) return;

  const tables = [
    "profiles",
    "ranks",
    "invite_codes",
    "warnings",
    "leadando_submissions",
    "tickets",
    "service_requests",
    "character_lore",
    "parking_requests",
    "parking_assignments",
    "tgf_notes",
    "blacklist",
    "event_feedback",
  ] as const;

  const channel = supabase.channel("vezetoseg-live-sync");

  tables.forEach((table) => {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => {
        if (document.visibilityState !== "visible") return;
        scheduleRealtimeRefresh(true);
      }
    );
  });

  channel.subscribe();

  return () => {
    if (realtimeRefreshTimeoutRef.current) {
      clearTimeout(realtimeRefreshTimeoutRef.current);
      realtimeRefreshTimeoutRef.current = null;
    }
    void supabase.removeChannel(channel);
  };
}, [token, tab, page, selectedUser?.user_id, supabase]);


  const pendingServiceCount = serviceRequests.filter((s) => s.status === "pending").length;
  const activeWarningsCount = warnings.filter((w) => w.is_active).length;
  const approvedLeadandoCount = leadando.filter((l) => l.is_approved).length;

  if (me && !canAccessLeadership) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold">Vezetőség</h1>
        <p className="mt-2 opacity-80">Nincs jogosultságod ehhez az oldalhoz.</p>
      </div>
    );
  }

  return (
    <div className="lmr-page lmr-page-wide space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              La Main Rouge
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Vezetőség
            </h1>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">
              Vezetőségi kezelőfelület, meghívókódokkal, felhasználókezeléssel, beérkezettekkel, TGF-fel és blacklist nézettel.
            </p>
          </div>

          <div className="text-sm text-white/55">
            Service-role API-kkal működik.
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-900/20 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button className={tabBtnStyle(tab === "kezelo")} onClick={() => setTab("kezelo")}>Kezelőpanel</button>
        <button className={tabBtnStyle(tab === "kerdoivek")} onClick={() => setTab("kerdoivek")}>Beérkezettek</button>
        <button className={tabBtnStyle(tab === "users")} onClick={() => setTab("users")}>Felhasználók</button>
        <button className={tabBtnStyle(tab === "leadandok")} onClick={() => setTab("leadandok")}>Leadandók</button>
        <button className={tabBtnStyle(tab === "parking")} onClick={() => setTab("parking")}>Parkolás igénylés</button>
        <button className={tabBtnStyle(tab === "tgf")} onClick={() => setTab("tgf")}>TGF</button>
        <button className={tabBtnStyle(tab === "invites")} onClick={() => setTab("invites")}>Meghívókódok</button>
        <button className={tabBtnStyle(tab === "blacklist")} onClick={() => setTab("blacklist")}>Blacklist</button>
      </div>

      {tab === "kezelo" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Kezelőpanel</h2>
            <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="border border-white/10 rounded-[24px] p-5">
              <div className="text-sm text-white/65">Aktív meghívók</div>
              <div className="mt-2 text-3xl font-bold">{activeInvites.length}</div>
            </div>

            <div className="border border-white/10 rounded-[24px] p-5">
              <div className="text-sm text-white/65">Felhasználók</div>
              <div className="mt-2 text-3xl font-bold">{count || users.length}</div>
            </div>

            <div className="border border-white/10 rounded-[24px] p-5">
              <div className="text-sm text-white/65">Rangok</div>
              <div className="mt-2 text-3xl font-bold">{ranks.length}</div>
            </div>

            <div className="border border-white/10 rounded-[24px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white/65">Leadandók</div>
                  <div className="mt-2 text-3xl font-bold">{leadandoDashboardRows.length}</div>
                </div>
                <button
                  onClick={() => setTab("leadandok")}
                  className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Megnyitás
                </button>
              </div>
            </div>

            <div className="border border-white/10 rounded-[24px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white/65">Beérkezett ügyek</div>
                  <div className="mt-2 text-3xl font-bold">{unifiedInbox.length}</div>
                </div>
                <button
                  onClick={() => setTab("kerdoivek")}
                  className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Megnyitás
                </button>
              </div>
            </div>

            <div className="border border-white/10 rounded-[24px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white/65">Parkolás igénylések</div>
                  <div className="mt-2 text-3xl font-bold">{parkingRequests.filter((row) => row.status === "pending").length}</div>
                </div>
                <button
                  onClick={() => setTab("parking")}
                  className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Megnyitás
                </button>
              </div>
            </div>

            <div className="border border-white/10 rounded-[24px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white/65">TGF jelentkezők</div>
                  <div className="mt-2 text-3xl font-bold">{tgfRows.length}</div>
                </div>
                <button
                  onClick={() => setTab("tgf")}
                  className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Megnyitás
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "invites" && (
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-xl font-semibold text-white">Meghívókódok</h2>
              <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
            </div>

            <button
              onClick={generateInvite}
              disabled={!token || busy === "invite:generate"}
              className="ml-auto rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
            >
              {busy === "invite:generate" ? "Generálás..." : "Új kód generálása"}
            </button>
          </div>

          {lastGeneratedCode && (
            <div className="rounded-xl border border-green-500/30 bg-green-900/20 p-3 text-sm text-green-200">
              Új kód: <span className="font-semibold">{lastGeneratedCode.code}</span> • Lejárat: {fmt(lastGeneratedCode.expires_at)}
            </div>
          )}

          <div className="overflow-x-auto rounded-[24px] border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Létrehozva</th>
                  <th className="px-3 py-2">Lejárat</th>
                  <th className="px-3 py-2">Használat</th>
                  <th className="px-3 py-2">Állapot</th>
                  <th className="px-3 py-2">Művelet</th>
                </tr>
              </thead>
              <tbody>
                {invites.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 opacity-70" colSpan={7}>Nincs meghívókód.</td>
                  </tr>
                ) : (
                  invites.map((row) => (
                    <tr key={row.id} className="border-t border-white/10">
                      <td className="px-3 py-2">{row.id}</td>
                      <td className="px-3 py-2">{fmt(row.created_at)}</td>
                      <td className="px-3 py-2">{fmt(row.expires_at)}</td>
                      <td className="px-3 py-2">{row.uses}/{row.max_uses}</td>
                      <td className="px-3 py-2">{isInviteActive(row) ? "Aktív" : "Lejárt / Inaktív"}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => revokeInvite(row.id)}
                          disabled={!token || busy === `invite:revoke:${row.id}` || row.revoked}
                          className="rounded-2xl border border-red-400/20 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          {busy === `invite:revoke:${row.id}` ? "..." : "Visszavonás"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "users" && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <h2 className="text-xl font-semibold text-white">Felhasználók</h2>
              <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
            </div>

            <input
              className="ml-auto rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              placeholder="Keresés név alapján..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              onClick={() => loadUsers(1)}
              disabled={!token}
              className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              Keresés
            </button>
          </div>

          <div className="overflow-x-auto rounded-[24px] border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left">
                  <th className="px-3 py-2">InGame név</th>
                  <th className="px-3 py-2">Státusz</th>
                  <th className="px-3 py-2">Site role</th>
                  <th className="px-3 py-2">Rang</th>
                  <th className="px-3 py-2">Felvéve</th>
                  <th className="px-3 py-2">Leadandó érvényes</th>
                  <th className="px-3 py-2">Inaktív</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 opacity-70" colSpan={7}>Nincs találat.</td>
                  </tr>
                ) : (
                  sortedUsers.map((u) => {
                    const rankName = getRankName(u.rank_id);
                    const isOpen = selectedUser?.user_id === u.user_id;
                    const isBusy = !token || busy === `open:${u.user_id}`;

                    return (
                      <tr
                        key={u.user_id}
                        className={`border-t border-white/10 transition ${isBusy ? "opacity-70" : "cursor-pointer hover:bg-white/[0.03]"} ${isOpen ? "bg-white/[0.04]" : ""}`}
                        onClick={() => {
                          if (isBusy) return;
                          void openUser(u);
                        }}
                      >
                        <td className="px-3 py-2">{u.ic_name || "—"}</td>
                        <td className="px-3 py-2"><Badge className={statusBadgeStyle(u.status)}>{prettyStatus(u.status)}</Badge></td>
                        <td className="px-3 py-2"><Badge className={roleBadgeStyle(u.site_role)}>{prettyRole(u.site_role)}</Badge></td>
                        <td className="px-3 py-2">{rankName ? <RankBadge name={rankName} /> : "—"}</td>
                        <td className="px-3 py-2">{fmt(u.created_at)}</td>
                        <td className="px-3 py-2">{formatDateOnly(u.leadando_due_at)}</td>
                        <td className="px-3 py-2">{activeInactivityBadge(u)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadUsers(Math.max(1, page - 1))}
              disabled={!token || page <= 1}
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-3.5 py-2.5 text-sm hover:bg-white/[0.08] disabled:opacity-50"
            >
              Előző
            </button>
            <div className="text-sm opacity-70">Oldal: {page} / {totalPages}</div>
            <button
              onClick={() => loadUsers(Math.min(totalPages, page + 1))}
              disabled={!token || page >= totalPages}
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-3.5 py-2.5 text-sm hover:bg-white/[0.08] disabled:opacity-50"
            >
              Következő
            </button>
          </div>

          {selectedUser && (
            <div className="space-y-5 border border-white/10 rounded-[26px] p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div className="min-w-0">
                  {!editingIcName ? (
                    <>
                      <div className="text-xl font-semibold">{selectedUser.ic_name || "—"}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge className={statusBadgeStyle(selectedUser.status)}>{prettyStatus(selectedUser.status)}</Badge>
                        <Badge className={roleBadgeStyle(selectedUser.site_role)}>{prettyRole(selectedUser.site_role)}</Badge>
                        {getRankName(selectedUser.rank_id) ? <RankBadge name={getRankName(selectedUser.rank_id)!} /> : null}
                        {summary?.is_blacklisted ? (
                          <Badge className="border-red-500/30 bg-red-500/15 text-red-200">Blacklisten</Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 text-sm opacity-70">Discord név: {summary?.discord_name || selectedUser.discord_name || "—"}</div>
                      <div className="mt-1 text-sm opacity-70">User ID: {selectedUser.user_id}</div>

                      <button
                        onClick={() => {
                          setEditedIcName(selectedUser.ic_name || "");
                          setEditingIcName(true);
                        }}
                        className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                      >
                        IC név szerkesztése
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-sm opacity-70">IC név szerkesztése</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          value={editedIcName}
                          onChange={(e) => setEditedIcName(e.target.value)}
                          className="min-w-[260px] rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
                          placeholder="Új IC név"
                        />

                        <button
                          onClick={saveIcName}
                          disabled={!token || busy === `icname:${selectedUser.user_id}`}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
                        >
                          {busy === `icname:${selectedUser.user_id}` ? "Mentés..." : "Mentés"}
                        </button>

                        <button
                          onClick={() => {
                            setEditingIcName(false);
                            setEditedIcName(selectedUser.ic_name || "");
                          }}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                        >
                          Mégse
                        </button>
                      </div>
                      <div className="mt-2 text-sm opacity-70">User ID: {selectedUser.user_id}</div>
                    </>
                  )}
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <select
                    value={selectedUser.status || ""}
                    onChange={(e) => saveUserPatch({ status: e.target.value })}
                    className="rounded-2xl border px-3.5 py-3 text-sm"
                    disabled={!token || busy === `save:${selectedUser.user_id}`}
                  >
                    <option value="preinvite">preinvite</option>
                    <option value="pending">pending</option>
                    <option value="active">active</option>
                    <option value="leadership">leadership</option>
                    <option value="inactive">inactive</option>
                  </select>

                  <select
                    value={selectedUser.site_role || "user"}
                    onChange={(e) => saveUserPatch({ site_role: e.target.value })}
                    className="rounded-2xl border px-3.5 py-3 text-sm"
                    disabled={!token || busy === `save:${selectedUser.user_id}`}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="owner">owner</option>
                  </select>

                  <select
                    value={selectedUser.rank_id || ""}
                    onChange={(e) => saveUserPatch({ rank_id: e.target.value || null })}
                    className="rounded-2xl border px-3.5 py-3 text-sm"
                    disabled={!token || busy === `save:${selectedUser.user_id}`}
                  >
                    <option value="">Nincs rang</option>
                    {ranks.filter((r) => !r.is_archived).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className={subTabStyle(userPanelTab === "osszegzo")} onClick={() => setUserPanelTab("osszegzo")}>Összegző</button>
                <button className={subTabStyle(userPanelTab === "tgf")} onClick={() => setUserPanelTab("tgf")}>TGF</button>
                <button className={subTabStyle(userPanelTab === "leadando")} onClick={() => setUserPanelTab("leadando")}>Leadandó</button>
                <button className={subTabStyle(userPanelTab === "tickets")} onClick={() => setUserPanelTab("tickets")}>Ticketek</button>
                <button className={subTabStyle(userPanelTab === "service")} onClick={() => setUserPanelTab("service")}>Szereltetés</button>
                <button className={subTabStyle(userPanelTab === "lore")} onClick={() => setUserPanelTab("lore")}>Karaktertörténet</button>
                <button className={subTabStyle(userPanelTab === "warnings")} onClick={() => setUserPanelTab("warnings")}>Figyelmeztetések</button>
              </div>

              {userPanelTab === "osszegzo" && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="border border-white/10 rounded-[24px] p-4">
                    <div className="text-xs opacity-70">Leadandó</div>
                    <div className="mt-2 text-lg font-semibold">Jóváhagyott: {approvedLeadandoCount} / Összes: {leadando.length}</div>
                  </div>

                  <div className="border border-white/10 rounded-[24px] p-4">
                    <div className="text-xs opacity-70">Ticketek</div>
                    <div className="mt-2 text-lg font-semibold">Nyitott: {summary?.open_tickets ?? 0} / Összes: {summary?.total_tickets ?? tickets.length}</div>
                  </div>

                  <div className="border border-white/10 rounded-[24px] p-4">
                    <div className="text-xs opacity-70">Szereltetés</div>
                    <div className="mt-2 text-lg font-semibold">Függő: {summary?.pending_service ?? pendingServiceCount} / Összes: {summary?.total_service ?? serviceRequests.length}</div>
                  </div>

                  <div className="border border-white/10 rounded-[24px] p-4">
                    <div className="text-xs opacity-70">Figyelmeztetések</div>
                    <div className="mt-2 text-lg font-semibold">{activeWarningsCount}</div>
                  </div>

                  <div className="border border-white/10 rounded-[24px] p-4">
                    <div className="text-xs opacity-70">Karaktertörténet</div>
                    <div className="mt-2 text-lg font-semibold">
                      {summary?.lore_submitted ? <DecisionBadge value={summary?.lore_approved ? "approved" : "pending"} /> : "Nincs"}
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-[24px] p-4">
                    <div className="text-xs opacity-70">Discord név</div>
                    <div className="mt-2 text-lg font-semibold">{summary?.discord_name || selectedUser.discord_name || "—"}</div>
                  </div>

                  <div className="border border-white/10 rounded-[24px] p-4">
                    <div className="text-xs opacity-70">Fekete lista</div>
                    <div className="mt-2 text-lg font-semibold">{summary?.is_blacklisted ? "Igen" : "Nem"}</div>
                  </div>

                  <div className="border border-white/10 rounded-[24px] p-4">
                    <div className="text-xs opacity-70">Utolsó leadandó</div>
                    <div className="mt-2 text-lg font-semibold">{summary?.last_leadando_submitted ? fmt(summary.last_leadando_submitted) : "—"}</div>
                  </div>

                  <div className="border border-white/10 rounded-[24px] p-4">
                    <div className="text-xs opacity-70">Parkolóhelyek</div>
                    <div className="mt-2 text-sm font-semibold leading-6">
                      <div>Parkolóház: {(summary?.assigned_garage_slots?.length ?? 0) > 0 ? summary?.assigned_garage_slots?.join(", ") : "—"}</div>
                      <div>Hangár: {(summary?.assigned_hangar_slots?.length ?? 0) > 0 ? summary?.assigned_hangar_slots?.join(", ") : "—"}</div>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-[24px] p-4">
                    <div className="text-xs opacity-70">Pending esemény értékelések</div>
                    <div className="mt-2 text-lg font-semibold">{summary?.pending_event_feedback_count ?? eventFeedbacks.length}</div>
                  </div>
                </div>
              )}

              {userPanelTab === "osszegzo" && eventFeedbacks.length > 0 && (
                <div className="border border-white/10 rounded-xl p-4">
                  <div className="text-sm font-semibold">TGF RP értékelések</div>
                  <div className="mt-3 overflow-x-auto rounded border border-white/10">
                    <table className="w-full text-sm">
                      <thead className="bg-white/5 text-white/70">
                        <tr>
                          <th className="text-left p-2">Esemény</th>
                          <th className="text-left p-2">Értékelés</th>
                          <th className="text-left p-2">Részt vett</th>
                          <th className="text-left p-2">Online volt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventFeedbacks.map((row) => (
                          <tr key={`${row.event_id}:${row.pending_feedback}`} className="border-t border-white/10">
                            <td className="p-2">{row.event_name || "—"}</td>
                            <td className="p-2">{prettyPendingFeedback(row.pending_feedback)}</td>
                            <td className="p-2">{row.attended ? "Igen" : "Nem"}</td>
                            <td className="p-2">{row.was_online ? "Igen" : "Nem"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {userPanelTab === "tgf" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold text-white">TGF adatok</h3>
                    <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 p-3 text-sm">
                      <div className="opacity-70">IC név</div>
                      <div className="mt-1 font-medium">{selectedUser.ic_name || "—"}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 p-3 text-sm">
                      <div className="opacity-70">Discord név</div>
                      <div className="mt-1 font-medium">{summary?.discord_name || selectedUser.discord_name || "—"}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 p-3 text-sm">
                      <div className="opacity-70">Felvétel dátuma</div>
                      <div className="mt-1 font-medium">{fmt(summary?.joined_at || selectedUser.created_at || null)}</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="block text-sm font-medium">Vezetőségi információk</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsEditingTgfDetail((prev) => !prev)}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
                        >
                          {isEditingTgfDetail ? "Mégse" : "Szerkesztés"}
                        </button>
                        <button
                          onClick={() => saveTgfNote(selectedUser.user_id, tgfDraft)}
                          disabled={!token || !isEditingTgfDetail || busy === `tgf:${selectedUser.user_id}`}
                          title="Mentés"
                          aria-label="Mentés"
                          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
                        >
                          {busy === `tgf:${selectedUser.user_id}` ? "Mentés..." : "💾"}
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="mt-2 min-h-[180px] w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none disabled:opacity-70"
                      value={tgfDraft}
                      onChange={(e) => setTgfDraft(e.target.value)}
                      placeholder="Ide írhatók a pending / TGF felhasználóval kapcsolatos vezetőségi információk..."
                      disabled={!isEditingTgfDetail}
                    />
                  </div>

                  <div className="text-xs opacity-70">Utolsó frissítés: {fmt(tgfNote?.updated_at || tgfNote?.created_at || null)}</div>
                </div>
              )}

              {userPanelTab === "leadando" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Leadandó beküldések</h3>
                    <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
                  </div>

                  {leadando.length === 0 ? (
                    <div className="text-sm opacity-70">Nincs leadandó beküldés.</div>
                  ) : (
                    leadando.map((l) => (
                      <div key={l.id} className="rounded-xl border border-white/10 p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">Beküldve: {fmt(l.submitted_at)} • Hetek: {l.weeks}</div>
                            <div className="mt-1 text-xs opacity-70">Állapot: <DecisionBadge value={l.is_approved ? "approved" : "pending"} /></div>
                            <div className="mt-1 text-xs opacity-70">
                              Imgur:{" "}
                              <a className="underline" target="_blank" rel="noreferrer" href={normalizeUrl(l.imgur_url)}>
                                {l.imgur_url}
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                approveLeadando(
                                  l.id,
                                  !l.is_approved,
                                  toDateInputValue(l.approved_until || selectedUser?.leadando_due_at || null)
                                )
                              }
                              disabled={!token || busy === `leadando:${l.id}`}
                              className="rounded-2xl border border-red-400/20 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              {busy === `leadando:${l.id}` ? "..." : l.is_approved ? "Visszavonás" : "Elfogadás"}
                            </button>

                            <button
                              onClick={() => deleteLeadando(l.id)}
                              disabled={!token || busy === `leadandodel:${l.id}`}
                              className="rounded-2xl border border-red-400/20 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              {busy === `leadandodel:${l.id}` ? "..." : "Törlés"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {userPanelTab === "tickets" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Ticketek</h3>
                    <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
                  </div>

                  {tickets.length === 0 ? (
                    <div className="text-sm opacity-70">Nincs ticket.</div>
                  ) : (
                    tickets.map((t) => {
                      const imgurUrl = getTicketImgurUrl(t);
                      const sanctionReason = (t.sanction_reason || t.payload?.reason || "").toString().trim();
                      const normalizedStatus = normalizeTicketDecisionStatus(t.status);

                      return (
                        <div key={t.id} className="rounded-xl border border-white/10 p-4 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">{t.title || "Ticket"} • {ticketTypeLabel(t)}</div>
                              <div className="mt-1 text-xs opacity-70 whitespace-pre-wrap">{t.description || "—"}</div>

                              <div className="mt-3 grid gap-2 text-xs text-white/75 md:grid-cols-2">
                                <div className="rounded-lg border border-white/10 px-3 py-2">
                                  <span className="text-white/45">Állapot:</span>{" "}
                                  <span className="font-medium text-white">{prettyTicketDecision(t.status)}</span>
                                </div>
                                <div className="rounded-lg border border-white/10 px-3 py-2">
                                  <span className="text-white/45">Létrehozva:</span>{" "}
                                  <span className="font-medium text-white">{fmt(t.created_at)}</span>
                                </div>

                                {imgurUrl ? (
                                  <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2">
                                    <span className="text-white/45">Imgur:</span>{" "}
                                    <a className="underline text-white" target="_blank" rel="noreferrer" href={normalizeUrl(imgurUrl)}>
                                      {imgurUrl}
                                    </a>
                                  </div>
                                ) : null}

                                {sanctionReason ? (
                                  <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2">
                                    <span className="text-white/45">Indok:</span>{" "}
                                    <span className="text-white">{sanctionReason}</span>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => updateTicketStatus(t.id, "approved")}
                                disabled={!token || busy === `ticket:${t.id}` || normalizedStatus !== "pending"}
                                className="rounded-2xl border border-emerald-400/20 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                {busy === `ticket:${t.id}` && normalizedStatus === "pending" ? "..." : "Elfogadás"}
                              </button>

                              <button
                                onClick={() => updateTicketStatus(t.id, "rejected")}
                                disabled={!token || busy === `ticket:${t.id}` || normalizedStatus !== "pending"}
                                className="rounded-2xl border border-yellow-400/20 bg-yellow-600 px-3 py-2 text-xs font-semibold text-white hover:bg-yellow-500 disabled:opacity-50"
                              >
                                {busy === `ticket:${t.id}` && normalizedStatus === "pending" ? "..." : "Elutasítás"}
                              </button>

                              <button
                                onClick={() => deleteTicket(t.id)}
                                disabled={!token || busy === `ticketdel:${t.id}`}
                                className="rounded-2xl border border-red-400/20 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
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
              )}

              {userPanelTab === "service" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Szereltetés igénylések</h3>
                    <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
                  </div>

                  {serviceRequests.length === 0 ? (
                    <div className="text-sm opacity-70">Nincs szereltetés igénylés.</div>
                  ) : (
                    serviceRequests.map((s) => (
                      <div key={s.id} className="rounded-xl border border-white/10 p-4 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{s.vehicle_type || "—"} • {s.plate || "—"}</div>

                            <div className="mt-3 grid gap-2 text-xs text-white/75 md:grid-cols-2">
                              <div className="rounded-lg border border-white/10 px-3 py-2"><span className="text-white/45">Esemény:</span> <span className="text-white">{s.event_name || "—"}</span></div>
                              <div className="rounded-lg border border-white/10 px-3 py-2"><span className="text-white/45">Összeg:</span> <span className="text-white">{formatMoney(s.amount)}</span></div>
                              <div className="rounded-lg border border-white/10 px-3 py-2"><span className="text-white/45">Státusz:</span> <span className="text-white">{s.status}</span></div>
                              <div className="rounded-lg border border-white/10 px-3 py-2"><span className="text-white/45">Létrehozva:</span> <span className="text-white">{fmt(s.created_at)}</span></div>
                              <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2"><span className="text-white/45">Elbírálva:</span> <span className="text-white">{fmt(s.reviewed_at)}</span></div>

                              {s.imgur_url ? (
                                <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2">
                                  <span className="text-white/45">Imgur:</span>{" "}
                                  <a className="underline text-white" target="_blank" rel="noreferrer" href={normalizeUrl(s.imgur_url)}>
                                    Megnyitás
                                  </a>
                                </div>
                              ) : null}
                            </div>

                            {s.description ? (
                              <div className="mt-3 whitespace-pre-wrap text-xs opacity-65">{s.description}</div>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => approveServiceRequest(s.id)}
                              disabled={!token || s.status === "approved" || busy === `service:${s.id}`}
                              className="rounded-2xl border border-red-400/20 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              {busy === `service:${s.id}` ? "..." : s.status === "approved" ? "Elfogadva" : "Elfogadás"}
                            </button>

                            <button
                              onClick={() => deleteServiceRequest(s.id)}
                              disabled={!token || busy === `servicedel:${s.id}`}
                              className="rounded-2xl border border-red-400/20 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              {busy === `servicedel:${s.id}` ? "..." : "Törlés"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {userPanelTab === "lore" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Karaktertörténet leadások</h3>
                    <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
                  </div>

                  {lore.length === 0 ? (
                    <div className="text-sm opacity-70">Nincs karaktertörténet leadva.</div>
                  ) : (
                    lore.map((l) => {
                      const loreLink = l.pastebin_url || l.lore_url;

                      return (
                        <div key={l.id} className="rounded-xl border border-white/10 p-4 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="font-medium">Beküldve: {fmt(l.submitted_at)} • Állapot: <DecisionBadge value={l.is_approved ? "approved" : "pending"} /></div>
                              {l.discord_name ? <div className="mt-1 text-xs opacity-70">Discord név: {l.discord_name}</div> : null}
                              <div className="mt-1 text-xs opacity-70">
                                Link:{" "}
                                <a className="underline" target="_blank" rel="noreferrer" href={normalizeUrl(loreLink)}>
                                  {loreLink}
                                </a>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => approveLoreSubmission(l.id, !l.is_approved)}
                                disabled={!token || busy === `lore:${l.id}:approve` || busy === `lore:${l.id}:revoke`}
                                className="rounded-2xl border border-red-400/20 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                              >
                                {busy === `lore:${l.id}:approve` || busy === `lore:${l.id}:revoke`
                                  ? "..."
                                  : l.is_approved
                                    ? "Elfogadás visszavonása"
                                    : "Elfogadás"}
                              </button>

                              <button
                                onClick={() => deleteLoreSubmission(l.id)}
                                disabled={!token || busy === `loredel:${l.id}`}
                                className="rounded-2xl border border-red-400/20 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                              >
                                {busy === `loredel:${l.id}` ? "..." : "Törlés"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {userPanelTab === "warnings" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Figyelmeztetések</h3>
                      <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
                    </div>

                    <button
                      onClick={createWarning}
                      disabled={!token || busy === `warncreate:${selectedUser.user_id}`}
                      className="ml-auto rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
                    >
                      {busy === `warncreate:${selectedUser.user_id}` ? "..." : "Új figyelmeztetés"}
                    </button>
                  </div>

                  {warnings.length === 0 ? (
                    <div className="text-sm opacity-70">Nincs figyelmeztetés.</div>
                  ) : (
                    warnings.map((w) => (
                      <div key={w.id} className="rounded-xl border border-white/10 p-4 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="font-medium">{w.reason}</div>
                            <div className="mt-1 text-xs opacity-70">
                              Kiállítva: {fmt(w.issued_at)} • Lejár: {fmt(w.expires_at)} • Állapot: {w.is_active ? "Aktív" : "Inaktív"}
                            </div>
                            <div className="mt-1 text-xs opacity-70">
                              Kiállította: {w.issued_by ? nameMap.get(w.issued_by) || w.issued_by : "—"}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => deleteWarning(w.id)}
                              disabled={!token || busy === `warndel:${w.id}`}
                              className="rounded-2xl border border-red-400/20 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              {busy === `warndel:${w.id}` ? "..." : "Törlés"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "leadandok" && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Leadandók</h2>
              <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
              <div className="mt-4 text-sm text-white/70">
                Az összes aktív és vezetőségi tag egy helyen, rang prioritás szerint rendezve.
              </div>
            </div>
            <button
              onClick={loadLeadandoDashboard}
              disabled={!token || busy === "leadando:dashboard"}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
            >
              Frissítés
            </button>
          </div>

          <div className="overflow-x-auto rounded-[24px] border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left">
                  <th className="px-3 py-2">IC név</th>
                  <th className="px-3 py-2">Rang</th>
                  <th className="px-3 py-2">Beküldés dátuma</th>
                  <th className="px-3 py-2">Státusz</th>
                  <th className="px-3 py-2">Mellékelt link / bizonyíték</th>
                  <th className="px-3 py-2">Hány hétre adta le</th>
                  <th className="px-3 py-2">Leadandó érvényességi határidő</th>
                  <th className="px-3 py-2">Szerkesztés</th>
                  <th className="px-3 py-2">Elfogadás</th>
                </tr>
              </thead>
              <tbody>
                {leadandoDashboardRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 opacity-70" colSpan={8}>Nincs megjeleníthető tag.</td>
                  </tr>
                ) : (
                  leadandoDashboardRows.map((row) => {
                    const submission = row.latest_submission;
                    const deadlineDraft = leadandoDeadlineDrafts[row.user_id] ?? "";
                    const statusLabel = submission ? (submission.is_approved ? "approved" : "pending") : "pending";

                    return (
                      <tr key={row.user_id} className="border-t border-white/10">
                        <td className="px-3 py-2 font-medium">{row.ic_name || "—"}</td>
                        <td className="px-3 py-2">{row.rank_name ? <RankBadge name={row.rank_name} /> : "—"}</td>
                        <td className="px-3 py-2">{submission ? fmt(submission.submitted_at) : "—"}</td>
                        <td className="px-3 py-2">{submission ? <DecisionBadge value={statusLabel} /> : "Nincs leadandó"}</td>
                        <td className="px-3 py-2">
                          {submission?.imgur_url ? (
                            <a className="underline underline-offset-4" target="_blank" rel="noreferrer" href={normalizeUrl(submission.imgur_url)}>
                              Megnyitás
                            </a>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2">{submission ? `${submission.weeks} hét` : "—"}</td>
                        <td className="px-3 py-2">
                          {leadandoDeadlineEditing[row.user_id] ? (
                            <input
                              type="date"
                              value={deadlineDraft}
                              onChange={(e) =>
                                setLeadandoDeadlineDrafts((prev) => ({
                                  ...prev,
                                  [row.user_id]: e.target.value,
                                }))
                              }
                              className="w-full min-w-[170px] rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
                            />
                          ) : (
                            <span>{deadlineDraft || "—"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => {
                              if (!submission) return;
                              if (leadandoDeadlineEditing[row.user_id] && submission.is_approved) {
                                void saveLeadandoDeadline(submission.id, row.user_id, deadlineDraft);
                                return;
                              }

                              setLeadandoDeadlineEditing((prev) => ({
                                ...prev,
                                [row.user_id]: !prev[row.user_id],
                              }));
                            }}
                            disabled={
                              !token ||
                              !submission ||
                              (submission.is_approved &&
                                leadandoDeadlineEditing[row.user_id] &&
                                (!deadlineDraft || busy === `leadando:deadline:${submission.id}`))
                            }
                            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/15 disabled:opacity-50"
                          >
                            {submission?.is_approved
                              ? busy === `leadando:deadline:${submission.id}`
                                ? "..."
                                : leadandoDeadlineEditing[row.user_id]
                                  ? "Mentés"
                                  : "Szerkesztés"
                              : leadandoDeadlineEditing[row.user_id]
                                ? "Kész"
                                : "Szerkesztés"}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => submission && approveLeadando(submission.id, !submission.is_approved, deadlineDraft || null)}
                            disabled={!token || !submission || busy === `leadando:${submission?.id}` || (!submission?.is_approved && !deadlineDraft)}
                            className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                          >
                            {busy === `leadando:${submission?.id}` ? "..." : submission?.is_approved ? "Visszavonás" : "Elfogadás"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "kerdoivek" && (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Beérkezett ügyek</h2>
              <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
              <div className="mt-4 text-sm text-white/70">
                A még kezelést igénylő ticketek, leadandók, szereltetés igénylések, parkolás igénylések és karaktertörténetek.
              </div>
            </div>

            <button
              onClick={loadUnifiedInbox}
              disabled={!token || busy === "leadando:inbox"}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
            >
              Frissítés
            </button>
          </div>

          <div className="space-y-3">
            {unifiedInbox.length === 0 ? (
              <div className="rounded-xl border border-white/10 p-4 text-sm opacity-70">Még nincs beérkezett ügy.</div>
            ) : (
              unifiedInbox.map((row) => (
                <div
                  key={`${row.inbox_type}:${row.id}`}
                  className="cursor-pointer rounded-[24px] border border-white/10 p-4 transition hover:bg-white/[0.04]"
                  onClick={() => void openInboxItem(row)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white">{row.profile?.ic_name || "—"}</div>

                      <div className="mt-3 grid gap-2 text-xs text-white/75 md:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-lg border border-white/10 px-3 py-2">
                          <span className="text-white/45">Típus:</span>{" "}
                          <span className="text-white">
                            {row.inbox_type === "leadando"
                              ? "Leadandó"
                              : row.inbox_type === "ticket"
                                ? "Ticket"
                                : row.inbox_type === "service"
                                  ? "Szereltetés igénylés"
                                  : row.inbox_type === "parking"
                                    ? "Parkolás igénylés"
                                    : "Karaktertörténet"}
                          </span>
                        </div>

                        <div className="rounded-lg border border-white/10 px-3 py-2">
                          <span className="text-white/45">Beérkezett:</span>{" "}
                          <span className="text-white">{fmt(row.submitted_at)}</span>
                        </div>

                        <div className="rounded-lg border border-white/10 px-3 py-2">
                          <span className="text-white/45">Állapot:</span>{" "}
                          {row.status_label ? <DecisionBadge value={row.status_label} /> : <span className="text-white">—</span>}
                        </div>

                        <div className="rounded-lg border border-white/10 px-3 py-2">
                          <span className="text-white/45">Profil státusz:</span>{" "}
                          <span className="text-white">{prettyStatus(row.profile?.status)}</span>
                        </div>

                        <div className="rounded-lg border border-white/10 px-3 py-2">
                          <span className="text-white/45">Discord:</span>{" "}
                          <span className="text-white">{row.profile?.discord_name || "—"}</span>
                        </div>

                        <div className="rounded-lg border border-white/10 px-3 py-2">
                          <span className="text-white/45">Cím:</span>{" "}
                          <span className="text-white">{row.title || "—"}</span>
                        </div>

                        {row.subtitle ? (
                          <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2 xl:col-span-3">
                            <span className="text-white/45">Részlet:</span>{" "}
                            <span className="text-white">{row.subtitle}</span>
                          </div>
                        ) : null}

                        {row.profile?.rank_id ? (
                          <div className="rounded-lg border border-white/10 px-3 py-2">
                            <span className="text-white/45">Rang:</span>{" "}
                            <span className="inline-block align-middle">
                              <RankBadge name={getRankName(row.profile.rank_id)!} />
                            </span>
                          </div>
                        ) : null}

                        {row.leadando?.imgur_url ? (
                          <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2 xl:col-span-3">
                            <span className="text-white/45">Imgur:</span>{" "}
                            <a
                              className="underline text-white"
                              target="_blank"
                              rel="noreferrer"
                              href={normalizeUrl(row.leadando.imgur_url)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.leadando.imgur_url}
                            </a>
                          </div>
                        ) : null}

                        {row.service?.imgur_url ? (
                          <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2 xl:col-span-3">
                            <span className="text-white/45">Imgur:</span>{" "}
                            <a
                              className="underline text-white"
                              target="_blank"
                              rel="noreferrer"
                              href={normalizeUrl(row.service.imgur_url)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.service.imgur_url}
                            </a>
                          </div>
                        ) : null}

                        {row.parking_request ? (
                          <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2 xl:col-span-3">
                            <span className="text-white/45">Kért helyek:</span>{" "}
                            <span className="text-white">
                              {[Array.isArray(row.parking_request.garage_slots) && row.parking_request.garage_slots.length > 0 ? `Parkolóház: ${row.parking_request.garage_slots.join(", ")}` : null,
                                Array.isArray(row.parking_request.hangar_slots) && row.parking_request.hangar_slots.length > 0 ? `Hangár: ${row.parking_request.hangar_slots.join(", ")}` : null]
                                .filter(Boolean)
                                .join(" • ") || "—"}
                            </span>
                          </div>
                        ) : null}

                        {row.lore?.lore_url ? (
                          <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2 xl:col-span-3">
                            <span className="text-white/45">Link:</span>{" "}
                            <a
                              className="underline text-white"
                              target="_blank"
                              rel="noreferrer"
                              href={normalizeUrl(row.lore.lore_url)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.lore.lore_url}
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "parking" && (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Parkolás igénylések</h2>
              <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
              <div className="mt-4 text-sm text-white/70">
                A felhasználók által beküldött parkolás igénylések. Elfogadás után a parkolóhelyek automatikusan kiosztásra kerülnek.
              </div>
            </div>

            <button
              onClick={loadParkingRequests}
              disabled={!token || busy === "parking:refresh"}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
            >
              Frissítés
            </button>
          </div>

          <div className="space-y-3">
            {parkingRequests.length === 0 ? (
              <div className="rounded-xl border border-white/10 p-4 text-sm opacity-70">Még nincs parkolás igénylés.</div>
            ) : (
              parkingRequests.map((row) => {
                const requestStatus = (row.status || "").toLowerCase();
                const canReview = requestStatus === "pending";

                return (
                  <div key={row.id} className="rounded-[24px] border border-white/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white">{row.profile?.ic_name || "—"}</div>

                        <div className="mt-3 grid gap-2 text-xs text-white/75 md:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-lg border border-white/10 px-3 py-2">
                            <span className="text-white/45">Állapot:</span>{" "}
                            <span className="inline-block align-middle"><DecisionBadge value={requestStatus || "pending"} /></span>
                          </div>
                          <div className="rounded-lg border border-white/10 px-3 py-2">
                            <span className="text-white/45">Beküldve:</span>{" "}
                            <span className="text-white">{fmt(row.created_at)}</span>
                          </div>
                          <div className="rounded-lg border border-white/10 px-3 py-2">
                            <span className="text-white/45">Frissítve:</span>{" "}
                            <span className="text-white">{fmt(row.updated_at)}</span>
                          </div>
                          <div className="rounded-lg border border-white/10 px-3 py-2">
                            <span className="text-white/45">Discord:</span>{" "}
                            <span className="text-white">{row.profile?.discord_name || "—"}</span>
                          </div>
                          <div className="rounded-lg border border-white/10 px-3 py-2">
                            <span className="text-white/45">Profil státusz:</span>{" "}
                            <span className="text-white">{prettyStatus(row.profile?.status)}</span>
                          </div>
                          {row.profile?.rank_id ? (
                            <div className="rounded-lg border border-white/10 px-3 py-2">
                              <span className="text-white/45">Rang:</span>{" "}
                              <span className="inline-block align-middle"><RankBadge name={getRankName(row.profile.rank_id)!} /></span>
                            </div>
                          ) : null}
                          <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2 xl:col-span-3">
                            <span className="text-white/45">Parkolóház:</span>{" "}
                            <span className="text-white">{Array.isArray(row.garage_slots) && row.garage_slots.length > 0 ? row.garage_slots.join(", ") : "—"}</span>
                          </div>
                          <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2 xl:col-span-3">
                            <span className="text-white/45">Hangár:</span>{" "}
                            <span className="text-white">{Array.isArray(row.hangar_slots) && row.hangar_slots.length > 0 ? row.hangar_slots.join(", ") : "—"}</span>
                          </div>
                          {row.review_note ? (
                            <div className="rounded-lg border border-white/10 px-3 py-2 md:col-span-2 xl:col-span-3">
                              <span className="text-white/45">Megjegyzés:</span>{" "}
                              <span className="text-white">{row.review_note}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => reviewParkingRequest(row.id, true)}
                          disabled={!token || !canReview || busy === `parking:${row.id}`}
                          className="rounded-2xl border border-emerald-400/20 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {busy === `parking:${row.id}` && canReview ? "..." : "Elfogadás"}
                        </button>

                        <button
                          onClick={() => reviewParkingRequest(row.id, false)}
                          disabled={!token || !canReview || busy === `parking:${row.id}`}
                          className="rounded-2xl border border-yellow-400/20 bg-yellow-600 px-3 py-2 text-xs font-semibold text-white hover:bg-yellow-500 disabled:opacity-50"
                        >
                          {busy === `parking:${row.id}` && canReview ? "..." : "Elutasítás"}
                        </button>

                        <button
                          onClick={() => deleteParkingRequest(row.id)}
                          disabled={!token || busy === `parkingdel:${row.id}`}
                          className="rounded-2xl border border-red-400/20 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          {busy === `parkingdel:${row.id}` ? "..." : "Törlés"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {tab === "tgf" && (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">TGF</h2>
              <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
              <div className="mt-4 text-sm text-white/70">
                Csak a pending státuszú felhasználók jelennek meg itt.
              </div>
            </div>

            <button
              onClick={loadTgfRows}
              disabled={!token || busy === "tgf:refresh"}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
            >
              Frissítés
            </button>
          </div>

          <div className="space-y-3">
            {tgfRows.length === 0 ? (
              <div className="rounded-xl border border-white/10 p-4 text-sm opacity-70">Jelenleg nincs pending státuszú felhasználó.</div>
            ) : (
              tgfRows.map((row) => (
                <details key={row.profile.user_id} className="rounded-[24px] border border-white/10 p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{row.profile.ic_name || "—"}</div>
                        <div className="mt-1 text-xs opacity-70">Discord: {row.profile.discord_name || "—"}</div>
                        <div className="mt-1 text-xs opacity-70">Felvétel dátuma: {fmt(row.profile.created_at)}</div>
                      </div>
                      <Badge className={statusBadgeStyle(row.profile.status)}>{prettyStatus(row.profile.status)}</Badge>
                    </div>
                  </summary>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="block text-sm font-medium">Vezetőségi információk</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setTgfEditingRows((prev) => ({
                                ...prev,
                                [row.profile.user_id]: !prev[row.profile.user_id],
                              }))
                            }
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
                          >
                            {tgfEditingRows[row.profile.user_id] ? "Mégse" : "Szerkesztés"}
                          </button>
                          <button
                            onClick={() => saveTgfNote(row.profile.user_id, tgfDrafts[row.profile.user_id] ?? "")}
                            disabled={!token || !tgfEditingRows[row.profile.user_id] || busy === `tgf:${row.profile.user_id}`}
                            title="Mentés"
                            aria-label="Mentés"
                            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
                          >
                            {busy === `tgf:${row.profile.user_id}` ? "Mentés..." : "💾"}
                          </button>
                        </div>
                      </div>

                      <textarea
                        className="mt-2 min-h-[160px] w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none disabled:opacity-70"
                        value={tgfDrafts[row.profile.user_id] ?? ""}
                        onChange={(e) => setTgfDrafts((prev) => ({ ...prev, [row.profile.user_id]: e.target.value }))}
                        placeholder="Ide írhatók a pending / TGF felhasználóval kapcsolatos információk..."
                        disabled={!tgfEditingRows[row.profile.user_id]}
                      />

                      <div className="mt-2 text-xs opacity-70">Utolsó frissítés: {fmt(row.tgf_note?.updated_at || row.tgf_note?.created_at || null)}</div>
                    </div>

                    <div className="flex flex-col gap-2 md:w-48">
                      <button
                        onClick={() => {
                          openUser(row.profile);
                          setTab("users");
                          setUserPanelTab("tgf");
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                      >
                        Adatlap megnyitása
                      </button>
                    </div>
                  </div>
                </details>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "blacklist" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Fekete lista</h2>
            <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
          </div>

          <div className="border border-white/10 rounded-[26px] p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-lg font-semibold">Új blacklist bejegyzés</div>
              <div className="ml-auto flex gap-2">
                <button className={tabBtnStyle(blacklistMode === "existing")} onClick={() => setBlacklistMode("existing")}>
                  Regisztrált felhasználó
                </button>
                <button className={tabBtnStyle(blacklistMode === "manual")} onClick={() => setBlacklistMode("manual")}>
                  Manuális felvétel
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {blacklistMode === "existing" ? (
                <>
                  <select
                    value={blacklistSelectedUserId}
                    onChange={(e) => {
                      const userId = e.target.value;
                      setBlacklistSelectedUserId(userId);
                      const found = selectableBlacklistUsers.find((u) => u.user_id === userId);
                      setBlacklistManualDiscordName(found?.discord_name || "");
                    }}
                    className="rounded-2xl border px-3.5 py-3 text-sm"
                  >
                    <option value="">Válassz felhasználót...</option>
                    {selectableBlacklistUsers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>{m.ic_name || "—"}</option>
                    ))}
                  </select>

                  <input
                    value={blacklistReason}
                    onChange={(e) => setBlacklistReason(e.target.value)}
                    placeholder="Fekete lista oka"
                    className="rounded-2xl border px-3.5 py-3 text-sm"
                  />

                  <button
                    onClick={createBlacklistEntry}
                    disabled={!token || !blacklistSelectedUserId || !blacklistReason.trim() || busy === "blacklist:create"}
                    className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {busy === "blacklist:create" ? "Mentés..." : "Feketelistára tesz"}
                  </button>
                </>
              ) : (
                <>
                  <input
                    value={blacklistManualIcName}
                    onChange={(e) => setBlacklistManualIcName(e.target.value)}
                    placeholder="IC név"
                    className="rounded-2xl border px-3.5 py-3 text-sm"
                  />
                  <input
                    value={blacklistManualDiscordName}
                    onChange={(e) => setBlacklistManualDiscordName(e.target.value)}
                    placeholder="Discord név"
                    className="rounded-2xl border px-3.5 py-3 text-sm"
                  />
                  <input
                    value={blacklistReason}
                    onChange={(e) => setBlacklistReason(e.target.value)}
                    placeholder="Fekete lista oka"
                    className="rounded-2xl border px-3.5 py-3 text-sm"
                  />
                  <button
                    onClick={createBlacklistEntry}
                    disabled={!token || !blacklistManualIcName.trim() || !blacklistReason.trim() || busy === "blacklist:create"}
                    className="md:col-span-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
                  >
                    {busy === "blacklist:create" ? "Mentés..." : "Manuális blacklist felvétel"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-[24px] border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left">
                  <th className="px-3 py-2">IC név</th>
                  <th className="px-3 py-2">Discord név</th>
                  <th className="px-3 py-2">Fekete lista oka</th>
                  <th className="px-3 py-2">Felvéve</th>
                  <th className="px-3 py-2">Művelet</th>
                </tr>
              </thead>
              <tbody>
                {blacklist.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 opacity-70" colSpan={5}>Nincs fekete listás bejegyzés.</td>
                  </tr>
                ) : (
                  blacklist.map((row) => (
                    <tr key={row.id} className="border-t border-white/10">
                      <td className="px-3 py-2">{row.ic_name || "—"}</td>
                      <td className="px-3 py-2">{row.discord_name || "—"}</td>
                      <td className="px-3 py-2">{row.reason || "—"}</td>
                      <td className="px-3 py-2">{fmt(row.created_at)}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => deleteBlacklistEntry(row)}
                          disabled={!token || busy === `blacklist:delete:${row.id}`}
                          className="rounded-2xl border border-red-400/20 bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          {busy === `blacklist:delete:${row.id}` ? "..." : "Törlés"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}