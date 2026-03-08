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
  const idRaw = body?.id;

  // invite_codes.id nálad BIGSERIAL -> number
  const id = typeof idRaw === "number" ? idRaw : Number(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, message: "Hiányzó/hibás id." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("invite_codes").update({ revoked: true }).eq("id", id);

  if (error) {
    console.error("invite revoke error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült visszavonni." }, { status: 500 });
  }

  await writeAdminAuditLog({
    actor_user_id: auth.userId,
    action: "invite_revoke",
    target_type: "invite_code",
    target_id: String(id),
    details: { id },
  });

  return NextResponse.json({ ok: true });
}