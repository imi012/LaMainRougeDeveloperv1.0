import { NextResponse } from "next/server";
import { canManageOwnedEvent, requireAppUser } from "@/lib/server/app-auth";

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireEventManager: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const eventId = String(body?.event_id || "").trim();
    const isClosed = !!body?.is_closed;

    if (!eventId) {
      return NextResponse.json({ ok: false, message: "Hiányzó esemény azonosító." }, { status: 400 });
    }

    const { data: eventRow, error: eventErr } = await auth.admin
      .from("events")
      .select("id,created_by")
      .eq("id", eventId)
      .maybeSingle();

    if (eventErr || !eventRow) {
      return NextResponse.json({ ok: false, message: "Az esemény nem található." }, { status: 404 });
    }

    if (!canManageOwnedEvent(auth.profile, auth.profile.rank_name, eventRow.created_by, auth.userId)) {
      return NextResponse.json({ ok: false, message: "Csak a saját eseményedet szerkesztheted." }, { status: 403 });
    }

    const { data, error } = await auth.admin
      .from("events")
      .update({ is_closed: isClosed })
      .eq("id", eventId)
      .select("id,name,holder_user_id,is_closed,created_by,created_at")
      .maybeSingle();

    if (error || !data) {
      console.error("events set-closed error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült menteni a lezárást." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (error: any) {
    console.error("events set-closed fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
