import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";
import { writeAdminAuditLog } from "@/lib/admin/audit";

export async function POST(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const user_id = (body?.user_id || "").toString().trim();
    const notes = (body?.notes ?? "").toString();

    if (!user_id) {
      return NextResponse.json({ ok: false, message: "Hiányzó user_id." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("user_id,ic_name,status")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json({ ok: false, message: "A kiválasztott felhasználó nem található." }, { status: 404 });
    }

    const payload = {
      user_id,
      notes,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    } as any;

    const { data: existing } = await admin
      .from("tgf_notes")
      .select("id,user_id,notes,created_at,updated_at,created_by,updated_by")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!existing) {
      payload.created_at = new Date().toISOString();
      payload.created_by = auth.userId;
    }

    const { data: row, error } = await admin
      .from("tgf_notes")
      .upsert(payload, { onConflict: "user_id" })
      .select("id,user_id,notes,created_at,updated_at,created_by,updated_by")
      .single();

    if (error) {
      console.error("admin tgf upsert error:", error);
      return NextResponse.json({ ok: false, message: error.message || "Nem sikerült menteni a TGF adatokat." }, { status: 500 });
    }

    await writeAdminAuditLog({
      actor_user_id: auth.userId,
      action: "tgf_note_upsert",
      target_type: "profile",
      target_id: user_id,
      target_label: profile.ic_name ?? null,
      details: {
        status: profile.status ?? null,
        notes_length: notes.length,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: any) {
    console.error("admin tgf upsert fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
