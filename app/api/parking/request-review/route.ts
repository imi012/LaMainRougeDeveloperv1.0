import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

const GARAGE_LETTERS = "ABCDEFGHIJKLMNOP".split("");
const GARAGE_SLOT_SET = new Set(
  GARAGE_LETTERS.flatMap((letter) => [1, 2, 3, 4, 5].map((row) => `${letter}${row}`))
);
const HANGAR_SLOT_SET = new Set(Array.from({ length: 67 }, (_, index) => String(index + 1)));

type Body = {
  request_id?: string;
  approve?: boolean;
  review_note?: string | null;
};

function uniq(values: string[]) {
  return Array.from(new Set(values));
}

function validateSlots(area: "garage" | "hangar", slots: string[]) {
  const slotSet = area === "garage" ? GARAGE_SLOT_SET : HANGAR_SLOT_SET;
  return slots.every((slot) => slotSet.has(slot));
}

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireLeadership: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const requestId = (body?.request_id || "").trim();
    const approve = !!body?.approve;
    const reviewNote = typeof body?.review_note === "string" ? body.review_note.trim() || null : null;

    if (!requestId) {
      return NextResponse.json({ ok: false, message: "Hiányzó request_id." }, { status: 400 });
    }

    const { data: row, error: rowErr } = await auth.admin
      .from("parking_requests")
      .select("id, user_id, garage_slots, hangar_slots, status")
      .eq("id", requestId)
      .maybeSingle();

    if (rowErr || !row) {
      return NextResponse.json({ ok: false, message: rowErr?.message || "A parkolás igénylés nem található." }, { status: 404 });
    }

    const garageSlots = uniq(Array.isArray(row.garage_slots) ? row.garage_slots.map((item: any) => String(item)) : []);
    const hangarSlots = uniq(Array.isArray(row.hangar_slots) ? row.hangar_slots.map((item: any) => String(item)) : []);

    if (!validateSlots("garage", garageSlots) || !validateSlots("hangar", hangarSlots)) {
      return NextResponse.json({ ok: false, message: "Az igénylés érvénytelen parkolóhelyet tartalmaz." }, { status: 400 });
    }

    if (approve) {
      const { data: profile, error: profileErr } = await auth.admin
        .from("profiles")
        .select("user_id, status")
        .eq("user_id", row.user_id)
        .maybeSingle();

      if (profileErr || !profile || !["active", "leadership"].includes(profile.status || "")) {
        return NextResponse.json({ ok: false, message: "Csak aktív vagy vezetőségi felhasználó igénylése fogadható el." }, { status: 400 });
      }

      const allSlots = [...garageSlots, ...hangarSlots];
      if (allSlots.length === 0) {
        return NextResponse.json({ ok: false, message: "Az igénylés nem tartalmaz parkolóhelyet." }, { status: 400 });
      }

      const { data: occupiedRows, error: occupiedErr } = await auth.admin
        .from("parking_assignments")
        .select("area, slot_key, user_id")
        .in("slot_key", allSlots);

      if (occupiedErr) {
        return NextResponse.json({ ok: false, message: occupiedErr.message }, { status: 500 });
      }

      const takenByOthers = (occupiedRows ?? []).filter(
        (item: any) => allSlots.includes(item.slot_key) && item.user_id && item.user_id !== row.user_id
      );
      if (takenByOthers.length > 0) {
        return NextResponse.json({ ok: false, message: "Az egyik kért parkolóhely már foglalt." }, { status: 400 });
      }

      const { error: clearErr } = await auth.admin.from("parking_assignments").delete().eq("user_id", row.user_id);
      if (clearErr) {
        return NextResponse.json({ ok: false, message: clearErr.message }, { status: 500 });
      }

      const inserts = [
        ...garageSlots.map((slot_key) => ({ area: "garage", slot_key, user_id: row.user_id, updated_at: new Date().toISOString(), updated_by: auth.userId })),
        ...hangarSlots.map((slot_key) => ({ area: "hangar", slot_key, user_id: row.user_id, updated_at: new Date().toISOString(), updated_by: auth.userId })),
      ];
      if (inserts.length > 0) {
        const { error: insertErr } = await auth.admin.from("parking_assignments").upsert(inserts, { onConflict: "slot_key" });
        if (insertErr) {
          return NextResponse.json({ ok: false, message: insertErr.message }, { status: 500 });
        }
      }
    }

    const patch = approve
      ? {
          status: "approved",
          review_note: reviewNote,
          approved_at: new Date().toISOString(),
          approved_by: auth.userId,
          rejected_at: null,
          rejected_by: null,
          updated_at: new Date().toISOString(),
        }
      : {
          status: "rejected",
          review_note: reviewNote,
          rejected_at: new Date().toISOString(),
          rejected_by: auth.userId,
          approved_at: null,
          approved_by: null,
          updated_at: new Date().toISOString(),
        };

    const { data: updated, error: updateErr } = await auth.admin
      .from("parking_requests")
      .update(patch)
      .eq("id", requestId)
      .select("id, user_id, garage_slots, hangar_slots, status, review_note, created_at, updated_at, approved_at, approved_by, rejected_at, rejected_by")
      .single();

    if (updateErr) {
      return NextResponse.json({ ok: false, message: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
