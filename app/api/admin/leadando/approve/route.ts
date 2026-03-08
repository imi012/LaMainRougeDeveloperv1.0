import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";
import { writeAdminAuditLog } from "@/lib/admin/audit";

export async function POST(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const id = (body?.id ?? "").toString();
  const approve = Boolean(body?.approve);
  const approvedUntil = body?.approved_until ? new Date(body.approved_until).toISOString() : null;

  if (!id) {
    return NextResponse.json({ ok: false, message: "Hiányzó id." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (approve && !approvedUntil) {
    return NextResponse.json({ ok: false, message: "Add meg a leadandó érvényességi határidejét." }, { status: 400 });
  }

  const patch = approve
    ? { is_approved: true, approved_at: new Date().toISOString(), approved_by: auth.userId, approved_until: approvedUntil }
    : { is_approved: false, approved_at: null, approved_by: null, approved_until: null };

  const { error } = await admin.from("leadando_submissions").update(patch).eq("id", id);

  if (error) {
    console.error("leadando approve error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült menteni." }, { status: 500 });
  }

  await writeAdminAuditLog({
    actor_user_id: auth.userId,
    action: approve ? "leadando_approve" : "leadando_unapprove",
    target_type: "leadando_submission",
    target_id: String(id),
    details: { approve, approved_until: approvedUntil },
  });

  return NextResponse.json({ ok: true });
}