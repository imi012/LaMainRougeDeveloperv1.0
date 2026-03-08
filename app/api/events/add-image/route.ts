import { NextResponse } from "next/server";
import { canManageOwnedEvent, requireAppUser } from "@/lib/server/app-auth";

function isAllowedImgurUrl(value: string) {
  return /^(https?:\/\/)?(i\.)?imgur\.com\//i.test(value.trim());
}

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireEventManager: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const eventId = String(body?.event_id || "").trim();
    const imgurUrl = String(body?.imgur_url || "").trim();

    if (!eventId || !imgurUrl) {
      return NextResponse.json({ ok: false, message: "Hiányzó esemény vagy link." }, { status: 400 });
    }

    if (!isAllowedImgurUrl(imgurUrl)) {
      return NextResponse.json({ ok: false, message: "Csak Imgur link engedélyezett." }, { status: 400 });
    }

    const { data: eventRow, error: eventErr } = await auth.admin
      .from("events")
      .select("id,is_closed,created_by")
      .eq("id", eventId)
      .maybeSingle();

    if (eventErr || !eventRow) {
      return NextResponse.json({ ok: false, message: "Az esemény nem található." }, { status: 404 });
    }

    if (!canManageOwnedEvent(auth.profile, auth.profile.rank_name, eventRow.created_by, auth.userId)) {
      return NextResponse.json({ ok: false, message: "Csak a saját eseményedet szerkesztheted." }, { status: 403 });
    }

    if (eventRow.is_closed) {
      return NextResponse.json({ ok: false, message: "Ez az esemény le van zárva. Nem lehet képet hozzáadni." }, { status: 409 });
    }

    const { data, error } = await auth.admin
      .from("event_images")
      .insert({ event_id: eventId, imgur_url: imgurUrl, uploaded_by: auth.userId })
      .select("id,event_id,imgur_url,uploaded_by,created_at")
      .maybeSingle();

    if (error || !data) {
      console.error("events add-image error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült hozzáadni a képet." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (error: any) {
    console.error("events add-image fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
