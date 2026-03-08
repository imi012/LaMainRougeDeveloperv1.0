import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireActionManager: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const actionId = String(body?.action_id || "").trim();
    const userId = String(body?.user_id || "").trim();
    const attended = body?.attended;
    const paid = body?.paid;

    if (!actionId || !userId) {
      return NextResponse.json({ ok: false, message: "Hiányzó azonosító." }, { status: 400 });
    }

    const { data: action, error: actionErr } = await auth.admin
      .from("actions")
      .select("id,is_closed")
      .eq("id", actionId)
      .maybeSingle();

    if (actionErr || !action) {
      return NextResponse.json({ ok: false, message: "Az akció nem található." }, { status: 404 });
    }

    if (action.is_closed) {
      return NextResponse.json({ ok: false, message: "Ez az akció le van zárva." }, { status: 409 });
    }

    const payload: Record<string, any> = { action_id: actionId, user_id: userId };
    if (typeof attended === "boolean") {
      payload.attended = attended;
      if (!attended) payload.paid = false;
    }
    if (typeof paid === "boolean") {
      payload.paid = paid;
    }

    const { error } = await auth.admin
      .from("action_participants")
      .upsert(payload, { onConflict: "action_id,user_id" });

    if (error) {
      console.error("actions set-participant error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült menteni." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("actions set-participant fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
