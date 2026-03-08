import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";
import { writeAdminAuditLog } from "@/lib/admin/audit";

export async function POST(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  const id = (body?.id ?? "").toString().trim();

  if (!id) {
    return NextResponse.json({ ok: false, message: "Hiányzó id." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("lore_submissions").delete().eq("id", id);

  if (error) {
    console.error("lore delete error:", error);
    return NextResponse.json({ ok: false, message: error.message || "Nem sikerült törölni." }, { status: 500 });
  }

  await writeAdminAuditLog({
    actor_user_id: auth.userId,
    action: "lore_delete",
    target_type: "lore_submission",
    target_id: String(id),
    details: {},
  });

  return NextResponse.json({ ok: true });
}
