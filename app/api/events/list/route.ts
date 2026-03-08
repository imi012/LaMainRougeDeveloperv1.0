import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

export async function GET(req: Request) {
  const auth = await requireAppUser(req, { requireEventManager: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { data: eventRows, error: eventsErr } = await auth.admin
      .from("events")
      .select("id,name,holder_user_id,is_closed,created_by,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (eventsErr) {
      console.error("events list events error:", eventsErr);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni az eseményeket." }, { status: 500 });
    }

    const events = (eventRows ?? []).map((row: any) => ({
      ...row,
      is_closed: !!row.is_closed,
    }));

    const eventIds = events.map((row: any) => row.id).filter(Boolean);
    if (eventIds.length === 0) {
      return NextResponse.json({ ok: true, events: [], participants: [], images: [] });
    }

    const [{ data: participantRows, error: participantsErr }, { data: imageRows, error: imagesErr }] = await Promise.all([
      auth.admin
        .from("event_participants")
        .select("event_id,user_id,was_online,attended,pending_feedback")
        .in("event_id", eventIds),
      auth.admin
        .from("event_images")
        .select("id,event_id,imgur_url,uploaded_by,created_at")
        .in("event_id", eventIds)
        .order("created_at", { ascending: false }),
    ]);

    if (participantsErr) {
      console.error("events list participants error:", participantsErr);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni az esemény résztvevőit." }, { status: 500 });
    }

    if (imagesErr) {
      console.error("events list images error:", imagesErr);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni az esemény képeit." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      events,
      participants: participantRows ?? [],
      images: imageRows ?? [],
    });
  } catch (error: any) {
    console.error("events list fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
