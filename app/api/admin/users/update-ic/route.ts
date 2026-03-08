import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { requireLeadership } from "../../_guard";
import { writeAdminAuditLog } from "@/lib/admin/audit";

export async function POST(req: Request) {
  try {
    const guard = await requireLeadership(req);

    if (!guard.ok) {
      return NextResponse.json(
        { ok: false, message: guard.message },
        { status: guard.status }
      );
    }

    const body = await req.json().catch(() => null);

    const userId = (body?.user_id ?? "").toString().trim();
    const icName = (body?.ic_name ?? "").toString().trim();

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Hiányzó user_id." },
        { status: 400 }
      );
    }

    if (!icName) {
      return NextResponse.json(
        { ok: false, message: "Az IC név nem lehet üres." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: targetBefore } = await admin
      .from("profiles")
      .select("ic_name")
      .eq("user_id", userId)
      .maybeSingle();

    const { error } = await admin
      .from("profiles")
      .update({
        ic_name: icName,
      })
      .eq("user_id", userId);

    if (error) {
      console.error("update ic_name error:", error);
      return NextResponse.json(
        { ok: false, message: error.message || "Nem sikerült frissíteni az IC nevet." },
        { status: 500 }
      );
    }

    await writeAdminAuditLog({
      actor_user_id: guard.userId,
      action: "user_update_ic",
      target_type: "profile",
      target_id: userId,
      target_label: icName,
      details: { before_ic_name: targetBefore?.ic_name ?? null, after_ic_name: icName },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("update ic_name fatal:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Váratlan hiba történt." },
      { status: 500 }
    );
  }
}