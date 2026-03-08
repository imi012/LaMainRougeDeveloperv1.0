import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { requireLeadership } from "../../_guard";

export async function POST(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  const id = (body?.id ?? "").toString().trim();
  const approvedUntilRaw = (body?.approved_until ?? "").toString().trim();

  if (!id) {
    return NextResponse.json({ ok: false, message: "Hiányzó id." }, { status: 400 });
  }

  if (!approvedUntilRaw) {
    return NextResponse.json({ ok: false, message: "Add meg a leadandó érvényességi határidejét." }, { status: 400 });
  }

  const approvedUntil = new Date(`${approvedUntilRaw}T23:59:59`).toISOString();
  const admin = createAdminClient();

  const { data: beforeRow, error: beforeError } = await admin
    .from("leadando_submissions")
    .select("id,is_approved,approved_until,user_id")
    .eq("id", id)
    .maybeSingle();

  if (beforeError) {
    console.error("leadando update-deadline before error:", beforeError);
    return NextResponse.json({ ok: false, message: "Nem sikerült lekérni a leadandót." }, { status: 500 });
  }

  if (!beforeRow) {
    return NextResponse.json({ ok: false, message: "A leadandó nem található." }, { status: 404 });
  }

  if (!beforeRow.is_approved) {
    return NextResponse.json({ ok: false, message: "Csak jóváhagyott leadandó határideje menthető külön." }, { status: 400 });
  }

  const { error } = await admin
    .from("leadando_submissions")
    .update({ approved_until: approvedUntil })
    .eq("id", id);

  if (error) {
    console.error("leadando update-deadline error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült menteni." }, { status: 500 });
  }

  await writeAdminAuditLog({
    actor_user_id: auth.userId,
    action: "leadando_deadline_update",
    target_type: "leadando_submission",
    target_id: id,
    details: {
      before: beforeRow.approved_until ?? null,
      approved_until: approvedUntil,
      user_id: beforeRow.user_id ?? null,
    },
  });

  return NextResponse.json({ ok: true, approved_until: approvedUntil });
}
