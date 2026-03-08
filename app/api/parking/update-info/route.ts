import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

type Body = {
  parking_house_info?: string;
  hangar_info?: string;
};

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireLeadership: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const parkingHouseInfo = typeof body?.parking_house_info === "string" ? body.parking_house_info.trim() : "";
    const hangarInfo = typeof body?.hangar_info === "string" ? body.hangar_info.trim() : "";

    const { error } = await auth.admin.from("parking_page_settings").upsert(
      {
        id: 1,
        parking_house_info: parkingHouseInfo,
        hangar_info: hangarInfo,
        image_path: "/parkolasrend.png",
        updated_at: new Date().toISOString(),
        updated_by: auth.userId,
      },
      { onConflict: "id" }
    );

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
