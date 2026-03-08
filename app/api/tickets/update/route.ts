import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "@/app/api/admin/_guard";

export async function POST(req: Request) {
  try {
    const auth = await requireLeadership(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    const id = body?.id;
    const status = String(body?.status || "").trim(); // open | in_progress | closed

    if (!id) return NextResponse.json({ ok: false, message: "Hiányzó id." }, { status: 400 });
    if (!["open", "in_progress", "closed"].includes(status)) {
      return NextResponse.json({ ok: false, message: "Érvénytelen státusz." }, { status: 400 });
    }

    const admin = createAdminClient();

    const upd = await admin
      .from("tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (upd.error) {
      console.error("ticket update error:", upd.error);
      return NextResponse.json({ ok: false, message: "Nem sikerült menteni." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("ticket update fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
