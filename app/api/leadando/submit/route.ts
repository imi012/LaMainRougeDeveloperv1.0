import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const imgur_url = (body?.imgur_url ?? "").toString().trim();
  const weeks = Number(body?.weeks);

  if (!imgur_url) {
    return NextResponse.json({ ok: false, message: "Hiányzó Imgur link." }, { status: 400 });
  }
  if (!Number.isFinite(weeks) || weeks <= 0 || !Number.isInteger(weeks)) {
    return NextResponse.json({ ok: false, message: "A hetek száma csak pozitív egész lehet." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Token -> user
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });
  }

  const user_id = userRes.user.id;

  const { data, error } = await admin
    .from("leadando_submissions")
    .insert({
      user_id,
      imgur_url,
      weeks,
      submitted_at: new Date().toISOString(),
      is_approved: false,
      approved_at: null,
      approved_by: null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("leadando submit error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült menteni." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}