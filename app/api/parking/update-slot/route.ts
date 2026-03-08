import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

const GARAGE_LETTERS = "ABCDEFGHIJKLMNOP".split("");
const GARAGE_SLOT_SET = new Set(
  GARAGE_LETTERS.flatMap((letter) => [1, 2, 3, 4, 5].map((row) => `${letter}${row}`))
);
const HANGAR_SLOT_SET = new Set(Array.from({ length: 67 }, (_, index) => String(index + 1)));

type Body = {
  area?: string;
  slot_key?: string;
  user_id?: string | null;
};

function isValidSlot(area: string, slotKey: string) {
  if (area === "garage") return GARAGE_SLOT_SET.has(slotKey);
  if (area === "hangar") return HANGAR_SLOT_SET.has(slotKey);
  return false;
}

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireLeadership: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const area = (body?.area || "").trim();
    const slotKey = (body?.slot_key || "").trim();
    const userId = typeof body?.user_id === "string" && body.user_id.trim() ? body.user_id.trim() : null;

    if (!isValidSlot(area, slotKey)) {
      return NextResponse.json({ ok: false, message: "Érvénytelen parkolóhely." }, { status: 400 });
    }

    if (userId) {
      const { data: member, error: memberError } = await auth.admin
        .from("profiles")
        .select("user_id, status")
        .eq("user_id", userId)
        .maybeSingle<{ user_id: string; status: string | null }>();

      if (memberError || !member || !["active", "leadership"].includes(member.status || "")) {
        return NextResponse.json({ ok: false, message: "Csak aktív vagy vezetőségi tag választható ki." }, { status: 400 });
      }

      const { data: existingAssignments, error: existingError } = await auth.admin
        .from("parking_assignments")
        .select("id, area, slot_key")
        .eq("user_id", userId);

      if (existingError) {
        return NextResponse.json({ ok: false, message: existingError.message }, { status: 500 });
      }

      const items = existingAssignments ?? [];
      const garageCount = items.filter((item) => item.area === "garage" && item.slot_key !== slotKey).length;
      const hangarCount = items.filter((item) => item.area === "hangar" && item.slot_key !== slotKey).length;

      if (area === "garage" && garageCount >= 2) {
        return NextResponse.json(
          { ok: false, message: "Egy felhasználóhoz maximum 2 parkolóházas hely tartozhat." },
          { status: 400 }
        );
      }

      if (area === "hangar" && hangarCount >= 3) {
        return NextResponse.json(
          { ok: false, message: "Egy felhasználóhoz maximum 3 hangárhely tartozhat." },
          { status: 400 }
        );
      }
    }

    if (!userId) {
      const { error } = await auth.admin.from("parking_assignments").delete().eq("slot_key", slotKey);
      if (error) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const { error } = await auth.admin.from("parking_assignments").upsert(
      {
        area,
        slot_key: slotKey,
        user_id: userId,
        updated_at: new Date().toISOString(),
        updated_by: auth.userId,
      },
      { onConflict: "slot_key" }
    );

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
