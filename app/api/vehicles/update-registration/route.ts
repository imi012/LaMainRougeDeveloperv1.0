import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

type Body = {
  vehicle_id?: string;
  registration_valid_until?: string | null;
  registration_imgur_url?: string | null;
};

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw;
}

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireMember: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const vehicleId = (body?.vehicle_id || "").trim();
    const validUntil = normalizeDate(body?.registration_valid_until ?? null);
    const imgurUrl = normalizeUrl(body?.registration_imgur_url ?? null);

    if (!vehicleId) {
      return NextResponse.json({ ok: false, message: "Hiányzó jármű azonosító." }, { status: 400 });
    }

    if ((body?.registration_valid_until ?? "").toString().trim() && !validUntil) {
      return NextResponse.json({ ok: false, message: "Érvénytelen forgalmi dátum." }, { status: 400 });
    }

    if ((body?.registration_imgur_url ?? "").toString().trim() && !imgurUrl) {
      return NextResponse.json({ ok: false, message: "Érvénytelen Imgur link." }, { status: 400 });
    }

    const { data, error } = await auth.admin
      .from("faction_vehicles")
      .update({
        registration_valid_until: validUntil,
        registration_imgur_url: imgurUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", vehicleId)
      .select(
        "id, vehicle_type, game_vehicle_id, plate, allowed_rank_ids, notes, created_at, updated_at, registration_valid_until, registration_imgur_url"
      )
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, vehicle: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
