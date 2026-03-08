import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { requireAppUser } from "@/lib/server/app-auth";

export async function GET(req: Request) {
  try {
    const auth = await requireAppUser(req, {
      allowPending: true,
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("lore_submissions")
      .select("id,discord_name,pastebin_url,lore_url,submitted_at,is_approved,approved_at,approved_by")
      .eq("user_id", auth.userId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message || "Nem sikerült betölteni." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data ?? null });
  } catch (e: any) {
    console.error("lore mine fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
