export const runtime = "nodejs";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function POST(req: Request) {
  // 1) Ki van-e jelentkezve? (user azonosítás a sessionből)
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });
  }

  // 2) Kód beolvasás
  const body = await req.json().catch(() => null);
  const code = (body?.code ?? "").toString().trim();

  if (code.length < 6) {
    return NextResponse.json({ ok: false, message: "Érvénytelen kód." }, { status: 400 });
  }

  const codeHash = sha256(code);

  // 3) Admin kliens (service role) — invite_codes tábla olvasás/írás
  const admin = createAdminClient();

  const { data: invite, error: invErr } = await admin
    .from("invite_codes")
    .select("id, uses, max_uses, revoked, expires_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (invErr || !invite) {
    return NextResponse.json({ ok: false, message: "Hibás kód." }, { status: 400 });
  }
  if (invite.revoked) {
    return NextResponse.json({ ok: false, message: "Ez a kód vissza lett vonva." }, { status: 400 });
  }
  if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
    return NextResponse.json({ ok: false, message: "Ez a kód lejárt." }, { status: 400 });
  }
  if (invite.uses >= invite.max_uses) {
    return NextResponse.json({ ok: false, message: "Ez a kód már fel lett használva." }, { status: 400 });
  }

  // 4) uses +1
  const { error: updInviteErr } = await admin
    .from("invite_codes")
    .update({ uses: invite.uses + 1 })
    .eq("id", invite.id);

  if (updInviteErr) {
    return NextResponse.json({ ok: false, message: "Nem sikerült frissíteni a kód használatát." }, { status: 500 });
  }

  // 5) Profil frissítése: invite_redeemed_at + status=pending
  const { error: profErr } = await admin
    .from("profiles")
    .upsert(
      {
        user_id: userData.user.id,
        invite_redeemed_at: new Date().toISOString(),
        status: "pending",
      },
      { onConflict: "user_id" }
    );

  if (profErr) {
    return NextResponse.json({ ok: false, message: "Nem sikerült a profil frissítése." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}