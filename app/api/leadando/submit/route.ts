import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAppUser } from "@/lib/server/app-auth";
import { checkFormSpamProtection } from "@/lib/server/form-spam-protection";

export async function POST(req: Request) {
  const auth = await requireAppUser(req, {
    requireMember: true,
    allowPending: false,
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  const imgur_url = (body?.imgur_url ?? "").toString().trim();
  const weeks = Number(body?.weeks);

  if (!imgur_url) {
    return NextResponse.json({ ok: false, message: "Hiányzó Imgur link." }, { status: 400 });
  }
  if (!Number.isFinite(weeks) || weeks <= 0 || !Number.isInteger(weeks)) {
    return NextResponse.json({ ok: false, message: "A hetek száma csak pozitív egész lehet." }, { status: 400 });
  }

  const admin = createAdminClient();

  const spamMessage = await checkFormSpamProtection({
    admin,
    table: "leadando_submissions",
    userId: auth.userId,
    timeColumn: "submitted_at",
    fingerprint: {
      imgur_url,
      weeks,
    },
    selectColumns: ["imgur_url", "weeks"],
  });

  if (spamMessage) {
    return NextResponse.json({ ok: false, message: spamMessage }, { status: 429 });
  }

  const { data, error } = await admin
    .from("leadando_submissions")
    .insert({
      user_id: auth.userId,
      imgur_url,
      weeks,
      submitted_at: new Date().toISOString(),
      is_approved: false,
      approved_at: null,
      approved_by: null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("leadando submit error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült menteni." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}