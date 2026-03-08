import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { requireLeadership } from "../../_guard";

export async function GET(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blacklist_entries")
    .select("id,user_id,ic_name,discord_name,reason,previous_status,created_at,created_by")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("blacklist list error:", error);
    return NextResponse.json({ ok: false, message: error.message || "Nem sikerült betölteni a blacklistet." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [] });
}
