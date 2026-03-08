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
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const content = body?.content;

    if (!content || typeof content !== "object") {
      return NextResponse.json({ ok: false, message: "Hiányzó vagy hibás tartalom." }, { status: 400 });
    }

    const admin = createAdminClient();
    const payload = {
      content,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    };

    let query;
    if (id) {
      query = admin.from("faction_rules").update(payload).eq("id", id).select("id,content,updated_at").single();
    } else {
      query = admin.from("faction_rules").insert(payload).select("id,content,updated_at").single();
    }

    const { data, error } = await query;

    if (error) {
      console.error("rules update error:", error);
      return NextResponse.json({ ok: false, message: error.message || "Nem sikerült menteni." }, { status: 500 });
    }

    await writeAdminAuditLog({
      actor_user_id: auth.userId,
      action: "rules_update",
      target_type: "faction_rules",
      target_id: data?.id ?? (id || null),
      details: { content_length: JSON.stringify(content).length },
    });

    return NextResponse.json({
      ok: true,
      id: data?.id ?? null,
      content: data?.content ?? content,
      updated_at: data?.updated_at ?? payload.updated_at,
    });
  } catch (e: any) {
    console.error("rules update fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
