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
    if (!id) return NextResponse.json({ ok: false, message: "Hiányzó id." }, { status: 400 });

    const admin = createAdminClient();
    const { data: existing, error: findError } = await admin
      .from("service_requests")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (findError) {
      console.error("admin service delete find error:", findError);
      return NextResponse.json({ ok: false, message: "Nem sikerült ellenőrizni a törlendő bejegyzést." }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ ok: false, message: "A szereltetés igénylés nem található." }, { status: 404 });
    }

    const { error: deleteError } = await admin.from("service_requests").delete().eq("id", id);
    if (deleteError) {
      console.error("admin service delete error:", deleteError);
      return NextResponse.json({ ok: false, message: deleteError.message || "Nem sikerült törölni a szereltetés igénylést." }, { status: 500 });
    }

    await writeAdminAuditLog({
      actor_user_id: guard.userId,
      action: "service_delete",
      target_type: "service_request",
      target_id: id,
      details: {},
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("admin service delete fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Váratlan szerverhiba történt a törlés közben." }, { status: 500 });
  }
}
