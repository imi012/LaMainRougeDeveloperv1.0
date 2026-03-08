import { NextResponse } from "next/server";
import { canManageOwnedEvent, requireAppUser } from "@/lib/server/app-auth";

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireEventManager: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const imageId = String(body?.image_id || "").trim();
    if (!imageId) {
      return NextResponse.json({ ok: false, message: "Hiányzó kép azonosító." }, { status: 400 });
    }

    const { data: imageRow, error: imageErr } = await auth.admin
      .from("event_images")
      .select("id,event_id")
      .eq("id", imageId)
      .maybeSingle();

    if (imageErr || !imageRow) {
      return NextResponse.json({ ok: false, message: "A kép nem található." }, { status: 404 });
    }

    const { data: eventRow, error: eventErr } = await auth.admin
      .from("events")
      .select("id,is_closed,created_by")
      .eq("id", imageRow.event_id)
      .maybeSingle();

    if (eventErr || !eventRow) {
      return NextResponse.json({ ok: false, message: "Az esemény nem található." }, { status: 404 });
    }

    if (!canManageOwnedEvent(auth.profile, auth.profile.rank_name, eventRow.created_by, auth.userId)) {
      return NextResponse.json({ ok: false, message: "Csak a saját eseményedet szerkesztheted." }, { status: 403 });
    }

    if (eventRow.is_closed) {
      return NextResponse.json({ ok: false, message: "Lezárt eseményen képlink nem szerkeszthető." }, { status: 409 });
    }

    const { error } = await auth.admin.from("event_images").delete().eq("id", imageId);
    if (error) {
      console.error("events delete-image error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült törölni a képet." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("events delete-image fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
