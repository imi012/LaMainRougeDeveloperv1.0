import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

type Body = {
  vehicle_id?: string;
  reason?: string | null;
};

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireLeadership: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const vehicleId = (body?.vehicle_id || "").trim();
    const reason = (body?.reason || "").trim();

    if (!vehicleId) {
      return NextResponse.json({ ok: false, message: "Hiányzó jármű azonosító." }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ ok: false, message: "Add meg a figyelmeztetés okát." }, { status: 400 });
    }

    const { data, error } = await auth.admin
      .from("vehicle_warnings")
      .insert({
        vehicle_id: vehicleId,
        reason,
        created_by: auth.userId,
      })
      .select("id, vehicle_id, reason, created_at, created_by")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, warning: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
