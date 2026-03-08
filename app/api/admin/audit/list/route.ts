import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";
import { canViewAdminAudit } from "@/lib/admin/audit";

export async function GET(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (!canViewAdminAudit(auth.profile)) {
    return NextResponse.json({ ok: false, message: "Ehhez a menühöz csak admin vagy owner férhet hozzá." }, { status: 403 });
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") || 100);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 250) : 100;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_audit_logs")
    .select("id,created_at,actor_user_id,actor_ic_name,actor_site_role,action,target_type,target_id,target_label,details")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("audit list error:", error);
    return NextResponse.json({ ok: false, message: error.message || "Nem sikerült betölteni az audit logot." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [] });
}
