import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";

export async function GET(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize") ?? "10")));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = createAdminClient();

  let query = admin
    .from("profiles")
    .select("user_id,ic_name,status,site_role,rank_id,created_at,updated_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("ic_name", `%${q}%`);

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("users list error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült lekérni a felhasználókat." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [], count: count ?? 0, page, pageSize });
}