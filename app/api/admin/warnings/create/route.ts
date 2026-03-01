import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";

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
  const { error } = await admin.from("warnings").insert({
    user_id,
    reason,
    issued_by: auth.userId,
    expires_at: expires_at ? new Date(expires_at).toISOString() : null,
    is_active: true,
  });

  if (error) {
    console.error("warnings create error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült létrehozni a figyelmeztetést." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}