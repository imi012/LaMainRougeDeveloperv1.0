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
    const carsChecked = !!body?.cars_checked;

    if (!actionId) {
      return NextResponse.json({ ok: false, message: "Hiányzó akció azonosító." }, { status: 400 });
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

    const { data, error } = await auth.admin
      .from("actions")
      .update({ cars_checked: carsChecked })
      .eq("id", actionId)
      .select("id,name,organizer_id,cars_checked,is_closed,created_by,created_at")
      .maybeSingle();

    if (error || !data) {
      console.error("actions set-cars error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült frissíteni." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (error: any) {
    console.error("actions set-cars fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
