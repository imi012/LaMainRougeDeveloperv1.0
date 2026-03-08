import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";

type ProfileRow = {
  user_id: string;
  ic_name: string | null;
  status: string | null;
  site_role: string | null;
  rank_id: string | null;
};

type RankRow = {
  id: string;
  name: string;
  priority: number | null;
};

type LeadandoRow = {
  id: string;
  user_id: string | null;
  imgur_url: string;
  weeks: number;
  submitted_at: string;
  is_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  approved_until: string | null;
};

export async function GET(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const admin = createAdminClient();

    const [{ data: profiles, error: profilesError }, { data: ranks, error: ranksError }] = await Promise.all([
      admin
        .from("profiles")
        .select("user_id,ic_name,status,site_role,rank_id")
        .in("status", ["active", "leadership"]),
      admin.from("ranks").select("id,name,priority"),
    ]);

    if (profilesError) {
      console.error("leadando dashboard profiles error:", profilesError);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni a tagokat." }, { status: 500 });
    }

    if (ranksError) {
      console.error("leadando dashboard ranks error:", ranksError);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni a rangokat." }, { status: 500 });
    }

    const memberRows = (profiles ?? []) as ProfileRow[];
    const rankMap = new Map<string, RankRow>((ranks ?? []).map((row: any) => [row.id, row as RankRow]));
    const userIds = memberRows.map((row) => row.user_id).filter(Boolean);

    let latestSubmissionByUser = new Map<string, LeadandoRow>();
    if (userIds.length > 0) {
      const { data: leadandoRows, error: leadandoError } = await admin
        .from("leadando_submissions")
        .select("id,user_id,imgur_url,weeks,submitted_at,is_approved,approved_at,approved_by,approved_until")
        .in("user_id", userIds)
        .order("submitted_at", { ascending: false });

      if (leadandoError) {
        console.error("leadando dashboard leadando error:", leadandoError);
        return NextResponse.json({ ok: false, message: "Nem sikerült betölteni a leadandókat." }, { status: 500 });
      }

      for (const row of (leadandoRows ?? []) as LeadandoRow[]) {
        if (!row.user_id) continue;
        if (latestSubmissionByUser.has(row.user_id)) continue;
        latestSubmissionByUser.set(row.user_id, row);
      }
    }

    const rows = memberRows
      .map((profile) => {
        const rank = profile.rank_id ? rankMap.get(profile.rank_id) ?? null : null;
        const latestSubmission = latestSubmissionByUser.get(profile.user_id) ?? null;

        return {
          user_id: profile.user_id,
          ic_name: profile.ic_name ?? null,
          status: profile.status ?? null,
          site_role: profile.site_role ?? null,
          rank_id: profile.rank_id ?? null,
          rank_name: rank?.name ?? null,
          rank_priority: rank?.priority ?? null,
          leadando_due_at: latestSubmission?.is_approved ? latestSubmission.approved_until ?? null : null,
          latest_submission: latestSubmission,
        };
      })
      .sort((a, b) => {
        const ap = a.rank_priority ?? Number.MAX_SAFE_INTEGER;
        const bp = b.rank_priority ?? Number.MAX_SAFE_INTEGER;
        if (ap !== bp) return ap - bp;
        return (a.ic_name || "").localeCompare(b.ic_name || "", "hu");
      });

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    console.error("leadando dashboard fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
