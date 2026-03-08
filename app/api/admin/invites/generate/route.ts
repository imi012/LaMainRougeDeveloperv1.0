import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";
import { writeAdminAuditLog } from "@/lib/admin/audit";

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function gen6Digit() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const code = gen6Digit();
  const code_hash = sha256(code);

  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("invite_codes").insert({
    code_hash,
    created_by: auth.userId,
    expires_at: expiresAt,
    max_uses: 1,
    uses: 0,
    revoked: false,
  });

  if (error) {
    console.error("invite generate error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült létrehozni a kódot." }, { status: 500 });
  }

  await writeAdminAuditLog({
    actor_user_id: auth.userId,
    action: "invite_generate",
    target_type: "invite_code",
    target_label: code,
    details: { expires_at: expiresAt, max_uses: 1 },
  });

  return NextResponse.json({ ok: true, invite: { code, expires_at: expiresAt } });
}