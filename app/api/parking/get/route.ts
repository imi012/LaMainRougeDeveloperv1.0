import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

type ParkingSettingsRow = {
  id: number;
  parking_house_info: string | null;
  hangar_info: string | null;
  image_path: string | null;
};

type ParkingAssignmentRow = {
  id: string;
  area: "garage" | "hangar";
  slot_key: string;
  user_id: string | null;
  updated_at: string | null;
};

type MemberRow = {
  user_id: string;
  ic_name: string | null;
  discord_name: string | null;
  status: string | null;
  site_role: string | null;
};

export async function GET(req: Request) {
  const auth = await requireAppUser(req, { requireMember: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { admin, profile } = auth;

    const [settingsRes, assignmentsRes, membersRes] = await Promise.all([
      admin
        .from("parking_page_settings")
        .select("id, parking_house_info, hangar_info, image_path")
        .eq("id", 1)
        .maybeSingle<ParkingSettingsRow>(),
      admin
        .from("parking_assignments")
        .select("id, area, slot_key, user_id, updated_at")
        .order("area", { ascending: true })
        .order("slot_key", { ascending: true }),
      admin
        .from("profiles")
        .select("user_id, ic_name, discord_name, status, site_role")
        .in("status", ["active", "leadership"])
        .order("ic_name", { ascending: true }),
    ]);

    if (settingsRes.error) {
      return NextResponse.json({ ok: false, message: settingsRes.error.message }, { status: 500 });
    }
    if (assignmentsRes.error) {
      return NextResponse.json({ ok: false, message: assignmentsRes.error.message }, { status: 500 });
    }
    if (membersRes.error) {
      return NextResponse.json({ ok: false, message: membersRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      viewer: {
        user_id: profile.user_id,
        status: profile.status,
        site_role: profile.site_role,
      },
      settings: settingsRes.data ?? {
        id: 1,
        parking_house_info:
          "A parkoló számozások a betű jelzéssel szemben állva, balról kezdődik. A betűs parkolókból mindenki maximum 2-t kérhet.",
        hangar_info: "",
        image_path: "/parkolasrend.png",
      },
      assignments: (assignmentsRes.data ?? []) as ParkingAssignmentRow[],
      members: (membersRes.data ?? []) as MemberRow[],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
