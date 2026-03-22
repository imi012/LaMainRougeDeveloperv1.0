import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";

type ProfileRow = {
  user_id: string;
  ic_name: string | null;
  discord_name?: string | null;
  status: string | null;
  site_role: string | null;
  rank_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type RankRow = {
  id: string;
  priority: number | null;
};

type LeadandoApprovalRow = {
  user_id: string | null;
  approved_until: string | null;
  approved_at: string | null;
};

type InactivityTicketRow = {
  user_id: string;
  inactivity_from: string | null;
  inactivity_to: string | null;
  status: string | null;
  created_at: string | null;
  type: string | null;
};

type EnrichedProfileRow = ProfileRow & {
  inactive_from: string | null;
  inactive_to: string | null;
  leadando_due_at: string | null;
};

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getActiveInactivityByUser(rows: InactivityTicketRow[]) {
  const today = todayKey();
  const map = new Map<string, { inactive_from: string | null; inactive_to: string | null }>();

  for (const row of rows) {
    if (!row.user_id || !row.inactivity_from || !row.inactivity_to) continue;

    const status = (row.status || "").toLowerCase();
    if (status === "closed") continue;

    const type = (row.type || "").toLowerCase();
    if (type !== "inactivity" && type !== "inaktivitas") continue;

    const fromKey = String(row.inactivity_from).slice(0, 10);
    const toKey = String(row.inactivity_to).slice(0, 10);
    if (!fromKey || !toKey) continue;

    if (today < fromKey || today > toKey) continue;

    if (!map.has(row.user_id)) {
      map.set(row.user_id, {
        inactive_from: row.inactivity_from,
        inactive_to: row.inactivity_to,
      });
    }
  }

  return map;
}

function getUserStatusOrder(status: string | null | undefined) {
  const s = (status || "").toLowerCase();

  if (s === "preinvite") return 0;
  if (s === "pending") return 1;
  if (s === "active" || s === "leadership") return 2;
  if (s === "inactive") return 3;

  return 4;
}

function getRankPriority(rankId: string | null | undefined, rankPriorityMap: Map<string, number>) {
  if (!rankId) return Number.MAX_SAFE_INTEGER;
  return rankPriorityMap.get(rankId) ?? Number.MAX_SAFE_INTEGER;
}

function compareUsersForLeadershipList(
  a: EnrichedProfileRow,
  b: EnrichedProfileRow,
  rankPriorityMap: Map<string, number>
) {
  const aStatusOrder = getUserStatusOrder(a.status);
  const bStatusOrder = getUserStatusOrder(b.status);

  if (aStatusOrder !== bStatusOrder) {
    return aStatusOrder - bStatusOrder;
  }

  const aStatus = (a.status || "").toLowerCase();
  const bStatus = (b.status || "").toLowerCase();
  const aUsesRankPriority = aStatus === "active" || aStatus === "leadership";
  const bUsesRankPriority = bStatus === "active" || bStatus === "leadership";

  if (aUsesRankPriority && bUsesRankPriority) {
    const aPriority = getRankPriority(a.rank_id, rankPriorityMap);
    const bPriority = getRankPriority(b.rank_id, rankPriorityMap);

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

export async function GET(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize") ?? "10")));

  const admin = createAdminClient();

  let query = admin
    .from("profiles")
    .select("user_id,ic_name,discord_name,status,site_role,rank_id,created_at,updated_at", { count: "exact" });

  if (q) {
    query = query.ilike("ic_name", `%${q}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("users list error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült lekérni a felhasználókat." }, { status: 500 });
  }

  const rows = (data ?? []) as ProfileRow[];
  const userIds = rows.map((row) => row.user_id).filter(Boolean);
  const uniqueRankIds = Array.from(new Set(rows.map((row) => row.rank_id).filter(Boolean))) as string[];

  let inactivityMap = new Map<string, { inactive_from: string | null; inactive_to: string | null }>();
  let leadandoDueMap = new Map<string, string | null>();
  let rankPriorityMap = new Map<string, number>();

  if (userIds.length > 0) {
    const { data: ticketRows, error: ticketsError } = await admin
      .from("tickets")
      .select("user_id,inactivity_from,inactivity_to,status,created_at,type")
      .in("user_id", userIds)
      .in("type", ["inactivity", "inaktivitas"])
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false });

    if (ticketsError) {
      console.error("users list inactivity tickets error:", ticketsError);
    } else {
      inactivityMap = getActiveInactivityByUser((ticketRows ?? []) as InactivityTicketRow[]);
    }

    const { data: leadandoRows, error: leadandoError } = await admin
      .from("leadando_submissions")
      .select("user_id,approved_until,approved_at")
      .eq("is_approved", true)
      .in("user_id", userIds)
      .order("approved_at", { ascending: false });

    if (leadandoError) {
      console.error("users list leadando error:", leadandoError);
    } else {
      for (const row of (leadandoRows ?? []) as LeadandoApprovalRow[]) {
        if (!row.user_id) continue;
        if (leadandoDueMap.has(row.user_id)) continue;
        leadandoDueMap.set(row.user_id, row.approved_until ?? null);
      }
    }
  }

  if (uniqueRankIds.length > 0) {
    const { data: rankRows, error: ranksError } = await admin
      .from("ranks")
      .select("id,priority")
      .in("id", uniqueRankIds);

    if (ranksError) {
      console.error("users list ranks error:", ranksError);
    } else {
      for (const rank of (rankRows ?? []) as RankRow[]) {
        if (!rank.id) continue;
        rankPriorityMap.set(
          rank.id,
          typeof rank.priority === "number" ? rank.priority : Number.MAX_SAFE_INTEGER
        );
      }
    }
  }

  const enrichedRows: EnrichedProfileRow[] = rows.map((row) => {
    const inactive = inactivityMap.get(row.user_id);
    return {
      ...row,
      inactive_from: inactive?.inactive_from ?? null,
      inactive_to: inactive?.inactive_to ?? null,
      leadando_due_at: leadandoDueMap.get(row.user_id) ?? null,
    };
  });

  const sortedRows = [...enrichedRows].sort((a, b) =>
    compareUsersForLeadershipList(a, b, rankPriorityMap)
  );

  const totalCount = count ?? sortedRows.length;
  const from = (page - 1) * pageSize;
  const pagedRows = sortedRows.slice(from, from + pageSize);

  return NextResponse.json({
    ok: true,
    rows: pagedRows,
    count: totalCount,
    page,
    pageSize,
  });
}