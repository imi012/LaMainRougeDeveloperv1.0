import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });

  const admin = createAdminClient();

  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });
  }

  const user_id = userRes.user.id;

  const { data, error } = await admin
    .from("leadando_submissions")
    .select("id,imgur_url,weeks,submitted_at,is_approved,approved_at,approved_by")
    .eq("user_id", user_id)
    .order("submitted_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("leadando mine error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült betölteni." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [] });
}