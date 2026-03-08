import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAppUser } from "@/lib/server/app-auth";

function formatMoney(value: string) {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}$`;
}

export async function POST(req: Request) {
  const auth = await requireAppUser(req, {
    requireMember: true,
    allowPending: false,
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  const vehicle_id = (body?.vehicle_id ?? "").toString().trim();
  const event_name = (body?.event_name ?? "").toString().trim();
  const rawAmount = (body?.amount ?? "").toString().trim();
  const imgur_url = (body?.imgur_url ?? "").toString().trim();

  if (!vehicle_id) {
    return NextResponse.json({ ok: false, message: "Hiányzó jármű." }, { status: 400 });
  }

  if (!event_name) {
    return NextResponse.json({ ok: false, message: "Hiányzó esemény leírás." }, { status: 400 });
  }

  const amount = formatMoney(rawAmount);

  if (!amount) {
    return NextResponse.json({ ok: false, message: "Hiányzó vagy hibás összeg." }, { status: 400 });
  }

  if (!imgur_url) {
    return NextResponse.json({ ok: false, message: "Hiányzó Imgur link." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: vehicle, error: vehicleErr } = await admin
    .from("faction_vehicles")
    .select("id,vehicle_type,plate")
    .eq("id", vehicle_id)
    .maybeSingle();

  if (vehicleErr || !vehicle) {
    return NextResponse.json({ ok: false, message: "A kiválasztott jármű nem található." }, { status: 400 });
  }

  const title = `Szereltetés igénylés - ${vehicle.vehicle_type ?? "Ismeretlen jármű"}`;
  const description = [
    `Jármű típusa: ${vehicle.vehicle_type ?? "—"}`,
    `Rendszám: ${vehicle.plate ?? "—"}`,
    `Esemény: ${event_name}`,
    `Összeg: ${amount}`,
    `Imgur: ${imgur_url}`,
  ].join("\n");

  const { data, error } = await admin
    .from("service_requests")
    .insert({
      user_id: auth.userId,
      vehicle_id: vehicle.id,
      vehicle_type: vehicle.vehicle_type ?? null,
      plate: vehicle.plate ?? null,
      event_name,
      amount,
      imgur_url,
      title,
      description,
      status: "pending",
      reviewed_at: null,
      reviewed_by: null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("service create error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült menteni." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
