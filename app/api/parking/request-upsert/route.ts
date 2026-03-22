import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";
import { checkFormSpamProtection } from "@/lib/server/form-spam-protection";

const GARAGE_LETTERS = "ABCDEFGHIJKLMNOP".split("");
const GARAGE_SLOT_SET = new Set(
  GARAGE_LETTERS.flatMap((letter) => [1, 2, 3, 4, 5].map((row) => `${letter}${row}`))
);
const HANGAR_SLOT_SET = new Set(Array.from({ length: 67 }, (_, index) => String(index + 1)));

type Body = {
  garage_slots?: string[] | null;
  hangar_slots?: string[] | null;
};

function uniq(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeSlots(values: string[] | null | undefined) {
  return uniq(
    Array.isArray(values)
      ? values.map((item) => String(item || "").trim()).filter(Boolean)
      : []
  );
}

function validateSlots(area: "garage" | "hangar", slots: string[]) {
  const slotSet = area === "garage" ? GARAGE_SLOT_SET : HANGAR_SLOT_SET;
  return slots.every((slot) => slotSet.has(slot));
}

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireMember: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const garageSlots = normalizeSlots(body?.garage_slots);
    const hangarSlots = normalizeSlots(body?.hangar_slots);

    if (garageSlots.length === 0 && hangarSlots.length === 0) {
      return NextResponse.json({ ok: false, message: "Legalább egy parkolóhelyet ki kell választani." }, { status: 400 });
    }
    if (garageSlots.length > 2) {
      return NextResponse.json({ ok: false, message: "Maximum 2 parkolóházas hely kérhető." }, { status: 400 });
    }
    if (hangarSlots.length > 3) {
      return NextResponse.json({ ok: false, message: "Maximum 3 hangárhely kérhető." }, { status: 400 });
    }
    if (!validateSlots("garage", garageSlots) || !validateSlots("hangar", hangarSlots)) {
      return NextResponse.json({ ok: false, message: "Érvénytelen parkolóhely szerepel az igénylésben." }, { status: 400 });
    }

    const spamMessage = await checkFormSpamProtection({
      admin: auth.admin,
      table: "parking_requests",
      userId: auth.userId,
      timeColumn: "updated_at",
      fingerprint: {
        garage_slots: garageSlots,
        hangar_slots: hangarSlots,
      },
      selectColumns: ["garage_slots", "hangar_slots"],
    });

    if (spamMessage) {
      return NextResponse.json({ ok: false, message: spamMessage }, { status: 429 });
    }

    const requestedGarageSet = new Set(garageSlots);
    const requestedHangarSet = new Set(hangarSlots);

    const { data: occupiedRows, error: occupiedErr } = await auth.admin
      .from("parking_assignments")
      .select("area, slot_key, user_id")
      .in("slot_key", [...garageSlots, ...hangarSlots]);

    if (occupiedErr) {
      return NextResponse.json({ ok: false, message: occupiedErr.message }, { status: 500 });
    }

    const takenByOthers = (occupiedRows ?? []).filter(
      (row: any) => row.user_id && row.user_id !== auth.userId
    );

    if (takenByOthers.length > 0) {
      return NextResponse.json({ ok: false, message: "Az egyik kiválasztott parkolóhely időközben foglalt lett." }, { status: 400 });
    }

    const { data: pendingRows, error: pendingErr } = await auth.admin
      .from("parking_requests")
      .select("user_id, garage_slots, hangar_slots, status")
      .eq("status", "pending");

    if (pendingErr) {
      return NextResponse.json({ ok: false, message: pendingErr.message }, { status: 500 });
    }

    const pendingConflict = (pendingRows ?? []).some((row: any) => {
      if (!row?.user_id || row.user_id === auth.userId) return false;

      const otherGarageSlots = Array.isArray(row.garage_slots) ? row.garage_slots : [];
      const otherHangarSlots = Array.isArray(row.hangar_slots) ? row.hangar_slots : [];

      return (
        otherGarageSlots.some((slot: string) => requestedGarageSet.has(String(slot))) ||
        otherHangarSlots.some((slot: string) => requestedHangarSet.has(String(slot)))
      );
    });

    if (pendingConflict) {
      return NextResponse.json(
        { ok: false, message: "Az egyik kiválasztott parkolóhelyre már van függőben lévő igénylés." },
        { status: 400 }
      );
    }

    const payload = {
      user_id: auth.userId,
      garage_slots: garageSlots,
      hangar_slots: hangarSlots,
      status: "pending",
      review_note: null,
      approved_at: null,
      approved_by: null,
      rejected_at: null,
      rejected_by: null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await auth.admin
      .from("parking_requests")
      .upsert(payload, { onConflict: "user_id" })
      .select("id, user_id, garage_slots, hangar_slots, status, review_note, created_at, updated_at, approved_at, approved_by, rejected_at, rejected_by")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}