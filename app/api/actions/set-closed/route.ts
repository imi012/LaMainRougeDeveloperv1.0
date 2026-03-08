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
    const isClosed = !!body?.is_closed;

    if (!actionId) {
      return NextResponse.json({ ok: false, message: "Hiányzó akció azonosító." }, { status: 400 });
    }

    const { data, error } = await auth.admin
      .from("actions")
      .update({ is_closed: isClosed })
      .eq("id", actionId)
      .select("id,name,organizer_id,cars_checked,is_closed,created_by,created_at")
      .maybeSingle();

    if (error || !data) {
      console.error("actions set-closed error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült menteni a lezárást." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (error: any) {
    console.error("actions set-closed fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
