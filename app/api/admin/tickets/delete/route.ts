import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const id = body?.id;
    if (!id) return NextResponse.json({ ok: false, message: "Hiányzó id." }, { status: 400 });

    const admin = createAdminClient();

    // Token -> actor
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });
    }
    const actorId = userRes.user.id;

    // jogosultság
    const { data: actorProfile } = await admin
      .from("profiles")
      .select("site_role,status")
      .eq("user_id", actorId)
      .maybeSingle();

    const allowed =
      actorProfile?.site_role === "owner" ||
      actorProfile?.site_role === "admin" ||
      actorProfile?.status === "leadership";

    if (!allowed) return NextResponse.json({ ok: false, message: "Nincs jogosultság." }, { status: 403 });

    const del = await admin.from("tickets").delete().eq("id", id);

    if (del.error) {
      console.error("ticket delete error:", del.error);
      return NextResponse.json({ ok: false, message: "Nem sikerült törölni." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("ticket delete fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}