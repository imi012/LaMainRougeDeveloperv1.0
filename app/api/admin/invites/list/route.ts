import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";

export async function GET(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const admin = createAdminClient();

  // A kód nem visszafejthető (hash), ezért itt "code" nincs.
  // A generáláskor visszaadjuk egyszer a kódot, ott tudod kimásolni.
  const { data, error } = await admin
    .from("invite_codes")
    .select("id,created_at,expires_at,uses,max_uses,revoked,created_by")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("invite list error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült lekérni a meghívókódokat." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [] });
}