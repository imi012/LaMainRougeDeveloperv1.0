import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { requireLeadership } from "../../_guard";
import { writeAdminAuditLog } from "@/lib/admin/audit";

export async function POST(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const user_id = body?.user_id ? String(body.user_id) : null;
    const ic_name = (body?.ic_name || "").toString().trim();
    const discord_name = (body?.discord_name || "").toString().trim() || null;
    const reason = (body?.reason || "").toString().trim();

    if (!reason) {
      return NextResponse.json({ ok: false, message: "A fekete lista oka kötelező." }, { status: 400 });
    }

    const admin = createAdminClient();

    let finalIcName = ic_name;
    let finalDiscordName = discord_name;
    let previousStatus: string | null = null;

    if (user_id) {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("ic_name,discord_name,status")
        .eq("user_id", user_id)
        .maybeSingle();

      if (profileError || !profile) {
        return NextResponse.json({ ok: false, message: "A kiválasztott felhasználó nem található." }, { status: 404 });
      }

      finalIcName = profile.ic_name || finalIcName;
      finalDiscordName = profile.discord_name || finalDiscordName;
      previousStatus = profile.status || null;

      const { data: existing } = await admin
        .from("blacklist_entries")
        .select("id")
        .eq("user_id", user_id)
        .limit(1);

      if ((existing ?? []).length > 0) {
        return NextResponse.json({ ok: false, message: "Ez a felhasználó már fekete listán van." }, { status: 400 });
      }
    }

    if (!finalIcName) {
      return NextResponse.json({ ok: false, message: "Az IC név kötelező." }, { status: 400 });
    }

    const insertPayload = {
      user_id,
      ic_name: finalIcName,
      discord_name: finalDiscordName,
      reason,
      previous_status: previousStatus,
      created_by: auth.userId,
    };

    const { data, error } = await admin
      .from("blacklist_entries")
      .insert(insertPayload)
      .select("id,user_id,ic_name,discord_name,reason,previous_status,created_at,created_by")
      .single();

    if (error) {
      console.error("blacklist create error:", error);
      return NextResponse.json({ ok: false, message: error.message || "Nem sikerült menteni." }, { status: 500 });
    }

    if (user_id) {
      const { error: updateError } = await admin.from("profiles").update({ status: "inactive" }).eq("user_id", user_id);
      if (updateError) {
        console.error("blacklist profile inactive update error:", updateError);
        return NextResponse.json({ ok: false, message: "A blacklist mentve lett, de a státuszt nem sikerült inaktívra állítani." }, { status: 500 });
      }
    }

    await writeAdminAuditLog({
      actor_user_id: auth.userId,
      action: "blacklist_create",
      target_type: "blacklist_entry",
      target_id: data?.id ?? null,
      target_label: finalIcName,
      details: { user_id, discord_name: finalDiscordName, reason, previous_status: previousStatus },
    });

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    console.error("blacklist create fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
