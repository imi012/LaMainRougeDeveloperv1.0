import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

type VehicleWarningRow = {
  id: string;
  vehicle_id: string;
  reason: string | null;
  created_at: string | null;
  created_by: string | null;
};

export async function GET(req: Request) {
  const auth = await requireAppUser(req, { requireMember: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { data, error } = await auth.admin
      .from("vehicle_warnings")
      .select("id, vehicle_id, reason, created_at, created_by")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, warnings: (data ?? []) as VehicleWarningRow[] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
