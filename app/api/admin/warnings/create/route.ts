import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";
import { writeAdminAuditLog } from "@/lib/admin/audit";

export async function POST(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const user_id = (body?.user_id ?? "").toString();
  const reason = (body?.reason ?? "").toString().trim();
  const expires_at = (body?.expires_at ?? "").toString().trim();

  if (!user_id || !reason) {
    return NextResponse.json({ ok: false, message: "Hiányzó user_id vagy reason." }, { status: 400 });
  }

  const admin = createAdminClient();
  const payload = {
    user_id,
    reason,
    issued_by: auth.userId,
    expires_at: expires_at ? new Date(expires_at).toISOString() : null,
    is_active: true,
  };

  const { data, error } = await admin.from("warnings").insert(payload).select("id,user_id,reason,issued_at,expires_at,issued_by,is_active").single();

  if (error) {
    console.error("warnings create error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült létrehozni a figyelmeztetést." }, { status: 500 });
  }

  await writeAdminAuditLog({
    actor_user_id: auth.userId,
    action: "warning_create",
    target_type: "warning",
    target_id: data?.id ?? null,
    details: { user_id, reason, expires_at: payload.expires_at },
  });

  return NextResponse.json({ ok: true, row: data });
}
