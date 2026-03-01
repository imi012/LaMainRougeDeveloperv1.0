import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

type PatchBody = {
  user_id?: string;
  status?: string | null;
  site_role?: string | null;
  rank_id?: string | null;
};

function pickAllowedPatch(body: PatchBody) {
  const patch: Record<string, any> = {};

  if ("status" in body) patch.status = body.status ?? null;
  if ("site_role" in body) patch.site_role = body.site_role ?? null;
  if ("rank_id" in body) patch.rank_id = body.rank_id ?? null;

  if (patch.status === "") patch.status = null;
  if (patch.site_role === "") patch.site_role = null;
  if (patch.rank_id === "") patch.rank_id = null;

  return patch;
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });

    const body = (await req.json().catch(() => null)) as PatchBody | null;
    if (!body?.user_id) {
      return NextResponse.json({ ok: false, message: "Hiányzó user_id." }, { status: 400 });
    }

    const admin = createAdminClient();

    // Token -> user
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });
    }
    const actorId = userRes.user.id;

    // Jogosultság ellenőrzés (admin/owner/leadership)
    const { data: actorProfile, error: actorProfileErr } = await admin
      .from("profiles")
      .select("site_role,status")
      .eq("user_id", actorId)
      .maybeSingle();

    if (actorProfileErr || !actorProfile) {
      return NextResponse.json({ ok: false, message: "Nincs jogosultság (profil hiba)." }, { status: 403 });
    }

    const allowed =
      actorProfile.site_role === "owner" ||
      actorProfile.site_role === "admin" ||
      actorProfile.status === "leadership";

    if (!allowed) {
      return NextResponse.json({ ok: false, message: "Nincs jogosultság." }, { status: 403 });
    }

    const patch = pickAllowedPatch(body);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, message: "Nincs frissítendő mező." }, { status: 400 });
    }

    const { error: upErr } = await admin.from("profiles").update(patch).eq("user_id", body.user_id);

    if (upErr) {
      console.error("admin users/update error:", upErr);
      return NextResponse.json({ ok: false, message: "Nem sikerült menteni." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("admin users/update fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}