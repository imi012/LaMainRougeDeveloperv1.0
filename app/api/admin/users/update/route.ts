import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { requireLeadership } from "@/app/api/admin/_guard";

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
    const auth = await requireLeadership(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    const body = (await req.json().catch(() => null)) as PatchBody | null;
    if (!body?.user_id) {
      return NextResponse.json({ ok: false, message: "Hiányzó user_id." }, { status: 400 });
    }

    const admin = createAdminClient();
    const patch = pickAllowedPatch(body);

    if ("site_role" in patch && auth.profile.site_role !== "owner") {
      return NextResponse.json({ ok: false, message: "Webjogot csak owner módosíthat." }, { status: 403 });
    }

    const { data: targetBefore } = await admin
      .from("profiles")
      .select("ic_name,status,site_role,rank_id")
      .eq("user_id", body.user_id)
      .maybeSingle();

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, message: "Nincs frissítendő mező." }, { status: 400 });
    }

    const { error: upErr } = await admin.from("profiles").update(patch).eq("user_id", body.user_id);

    if (upErr) {
      console.error("admin users/update error:", upErr);
      return NextResponse.json({ ok: false, message: "Nem sikerült menteni." }, { status: 500 });
    }

    await writeAdminAuditLog({
      actor_user_id: auth.userId,
      action: "user_update",
      target_type: "profile",
      target_id: body.user_id,
      target_label: targetBefore?.ic_name ?? null,
      details: { before: targetBefore ?? null, patch },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("admin users/update fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
