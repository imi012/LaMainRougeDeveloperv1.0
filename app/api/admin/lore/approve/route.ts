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
  const approve = Boolean(body?.approve);

  if (!id) {
    return NextResponse.json({ ok: false, message: "Hiányzó id." }, { status: 400 });
  }

  const admin = createAdminClient();

  const patch = approve
    ? {
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: auth.userId,
      }
    : {
        is_approved: false,
        approved_at: null,
        approved_by: null,
      };

  const { error } = await admin.from("lore_submissions").update(patch).eq("id", id);

  if (error) {
    console.error("lore approve error:", error);
    return NextResponse.json({ ok: false, message: error.message || "Nem sikerült menteni." }, { status: 500 });
  }

  await writeAdminAuditLog({
    actor_user_id: auth.userId,
    action: approve ? "lore_approve" : "lore_unapprove",
    target_type: "lore_submission",
    target_id: String(id),
    details: { approve },
  });

  return NextResponse.json({ ok: true });
}
