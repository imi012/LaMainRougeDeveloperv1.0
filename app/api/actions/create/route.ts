import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireActionManager: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const name = String(body?.name || "").trim();
    const organizerId = String(body?.organizer_id || "").trim() || null;

    if (!name) {
      return NextResponse.json({ ok: false, message: "Add meg az akció nevét." }, { status: 400 });
    }

    const { data, error } = await auth.admin
      .from("actions")
      .insert({ name, organizer_id: organizerId, created_by: auth.userId })
      .select("id,name,organizer_id,cars_checked,is_closed,created_by,created_at")
      .maybeSingle();

    if (error || !data) {
      console.error("actions create error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült létrehozni az akciót." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (error: any) {
    console.error("actions create fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
