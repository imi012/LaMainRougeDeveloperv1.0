import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { requireLeadership } from "@/app/api/admin/_guard";

export async function POST(req: Request) {
  try {
    const guard = await requireLeadership(req);
    if (!guard.ok) {
      return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status });
    }

    const body = await req.json().catch(() => null);
    const id = (body?.id ?? "").toString().trim();
    const status = (body?.status ?? "").toString().trim();

    if (!id) return NextResponse.json({ ok: false, message: "Hiányzó id." }, { status: 400 });
    if (!status) return NextResponse.json({ ok: false, message: "Hiányzó státusz." }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin
      .from("service_requests")
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: guard.userId })
      .eq("id", id);

    if (error) {
      console.error("admin service update error:", error);
      return NextResponse.json({ ok: false, message: error.message || "Nem sikerült frissíteni." }, { status: 500 });
    }

    await writeAdminAuditLog({
      actor_user_id: guard.userId,
      action: "service_update",
      target_type: "service_request",
      target_id: id,
      details: { status },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("admin service update fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Váratlan szerverhiba történt." }, { status: 500 });
  }
}
