import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { requireLeadership } from "@/app/api/admin/_guard";

export async function POST(req: Request) {
  try {
    const auth = await requireLeadership(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    const id = (body?.id ?? "").toString().trim();
    const status = (body?.status ?? "").toString().trim();

    if (!id || !status) return NextResponse.json({ ok: false, message: "Hiányzó id vagy status." }, { status: 400 });

    const admin = createAdminClient();

    const upd = await admin
      .from("tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (upd.error) {
      console.error("ticket update error:", upd.error);
      return NextResponse.json({ ok: false, message: "Nem sikerült frissíteni." }, { status: 500 });
    }

    await writeAdminAuditLog({
      actor_user_id: auth.userId,
      action: "ticket_update",
      target_type: "ticket",
      target_id: id,
      details: { status },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("ticket update fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
