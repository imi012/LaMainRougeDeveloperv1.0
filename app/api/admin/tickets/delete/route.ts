import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { requireLeadership } from "../../_guard";

export async function POST(req: Request) {
  try {
    const auth = await requireLeadership(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    const id = (body?.id ?? "").toString().trim();
    if (!id) return NextResponse.json({ ok: false, message: "Hiányzó id." }, { status: 400 });

    const admin = createAdminClient();
    const actorId = auth.userId;

    const del = await admin.from("tickets").delete().eq("id", id);
    if (del.error) {
      console.error("ticket delete error:", del.error);
      return NextResponse.json({ ok: false, message: "Nem sikerült törölni." }, { status: 500 });
    }

    await writeAdminAuditLog({
      actor_user_id: actorId,
      action: "ticket_delete",
      target_type: "ticket",
      target_id: id,
      details: {},
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("ticket delete fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
