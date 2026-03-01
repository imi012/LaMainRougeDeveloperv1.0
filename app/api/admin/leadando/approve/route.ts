import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";

export async function POST(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const id = (body?.id ?? "").toString();
  const approve = Boolean(body?.approve);

  if (!id) {
    return NextResponse.json({ ok: false, message: "Hiányzó id." }, { status: 400 });
  }

  const admin = createAdminClient();

  const patch = approve
    ? { is_approved: true, approved_at: new Date().toISOString(), approved_by: auth.userId }
    : { is_approved: false, approved_at: null, approved_by: null };

  const { error } = await admin.from("leadando_submissions").update(patch).eq("id", id);

  if (error) {
    console.error("leadando approve error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült menteni." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}