import { NextResponse } from "next/server";
import { canManageOwnedEvent, requireAppUser } from "@/lib/server/app-auth";

const ALLOWED_PENDING_FEEDBACK = new Set(["jo", "semleges", "rossz", "nagyon_rossz"]);

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireEventManager: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const eventId = String(body?.event_id || "").trim();
    const userId = String(body?.user_id || "").trim();
    const attended = body?.attended;
    const wasOnline = body?.was_online;
    const pendingFeedbackRaw = body?.pending_feedback;

    if (!eventId || !userId) {
      return NextResponse.json({ ok: false, message: "Hiányzó azonosító." }, { status: 400 });
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
      return NextResponse.json({ ok: false, message: "Ez az esemény le van zárva." }, { status: 409 });
    }

    const { data: targetProfile, error: targetErr } = await auth.admin
      .from("profiles")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle<{ status: string | null }>();

    if (targetErr || !targetProfile) {
      return NextResponse.json({ ok: false, message: "A felhasználó nem található." }, { status: 404 });
    }

    const payload: Record<string, any> = { event_id: eventId, user_id: userId };
    if (typeof attended === "boolean") payload.attended = attended;
    if (typeof wasOnline === "boolean") payload.was_online = wasOnline;

    if (pendingFeedbackRaw !== undefined) {
      const pendingFeedback = String(pendingFeedbackRaw || "").trim().toLowerCase();

      if (targetProfile.status !== "pending") {
        return NextResponse.json(
          { ok: false, message: "Értékelést csak pending státuszú tagnál lehet rögzíteni." },
          { status: 400 }
        );
      }

      if (!pendingFeedback) {
        payload.pending_feedback = null;
      } else {
        if (!ALLOWED_PENDING_FEEDBACK.has(pendingFeedback)) {
          return NextResponse.json({ ok: false, message: "Érvénytelen értékelés." }, { status: 400 });
        }
        payload.pending_feedback = pendingFeedback;
      }
    }

    const { error } = await auth.admin
      .from("event_participants")
      .upsert(payload, { onConflict: "event_id,user_id" });

    if (error) {
      console.error("events set-participant error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült menteni." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("events set-participant fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
