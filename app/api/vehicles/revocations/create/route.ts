import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

type Body = {
  vehicle_id?: string;
  revoked_until?: string;
  note?: string | null;
};

type RevocationRow = {
  id: string;
  vehicle_id: string;
  revoked_until: string;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireLeadership: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const vehicleId = (body?.vehicle_id || "").trim();
    const revokedUntil = (body?.revoked_until || "").trim();
    const note = (body?.note || "").trim() || null;

    if (!vehicleId) {
      return NextResponse.json({ ok: false, message: "Hiányzó jármű azonosító." }, { status: 400 });
    }

    if (!revokedUntil) {
      return NextResponse.json({ ok: false, message: "Add meg, meddig legyen elvéve a jog." }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const { data: activeExisting, error: activeError } = await auth.admin
      .from("vehicle_access_revocations")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .gte("revoked_until", nowIso)
      .limit(1);

    if (activeError) {
      return NextResponse.json({ ok: false, message: activeError.message }, { status: 500 });
    }

    if ((activeExisting ?? []).length > 0) {
      return NextResponse.json(
        { ok: false, message: "Ehhez a járműhöz már tartozik aktív jogelvétel." },
        { status: 400 }
      );
    }

    const { data, error } = await auth.admin
      .from("vehicle_access_revocations")
      .insert({ vehicle_id: vehicleId, revoked_until: revokedUntil, note })
      .select("id, vehicle_id, revoked_until, note, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, revocation: data as RevocationRow });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
