import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { requireAppUser } from "@/lib/server/app-auth";

export async function POST(req: Request) {
  try {
    const auth = await requireAppUser(req, {
      allowPending: true,
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    const discord_name = (body?.discord_name || "").toString().trim();
    const pastebin_url = (body?.pastebin_url || "").toString().trim();

    if (!discord_name || !pastebin_url) {
      return NextResponse.json({ ok: false, message: "Minden mező kitöltése kötelező." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: existing, error: existingErr } = await admin
      .from("lore_submissions")
      .select("id")
      .eq("user_id", auth.userId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ ok: false, message: existingErr.message || "Nem sikerült menteni." }, { status: 500 });
    }

    const payload = {
      user_id: auth.userId,
      discord_name,
      pastebin_url,
      lore_url: pastebin_url,
      submitted_at: new Date().toISOString(),
      is_approved: false,
      approved_at: null,
      approved_by: null,
    };

    let query;
    if (existing?.id) {
      query = admin
        .from("lore_submissions")
        .update(payload)
        .eq("id", existing.id)
        .select("id,discord_name,pastebin_url,lore_url,submitted_at,is_approved,approved_at,approved_by")
        .single();
    } else {
      query = admin
        .from("lore_submissions")
        .insert(payload)
        .select("id,discord_name,pastebin_url,lore_url,submitted_at,is_approved,approved_at,approved_by")
        .single();
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, message: error.message || "Nem sikerült menteni." }, { status: 500 });
    }

    const profileDiscordUpdate = await admin
      .from("profiles")
      .update({ discord_name })
      .eq("user_id", auth.userId);

    if (profileDiscordUpdate.error) {
      console.error("profiles discord update error:", profileDiscordUpdate.error);
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    console.error("lore upsert fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
