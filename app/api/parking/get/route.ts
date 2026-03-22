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

type ParkingRequestRow = {
  id: string;
  user_id: string;
  garage_slots: string[] | null;
  hangar_slots: string[] | null;
  status: string;
  review_note: string | null;
  created_at: string | null;
  updated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
};

export async function GET(req: Request) {
  const auth = await requireAppUser(req, { requireMember: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { admin, profile } = auth;

    const [settingsRes, assignmentsRes, membersRes, myRequestRes, pendingRequestsRes] = await Promise.all([
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
      admin
        .from("parking_requests")
        .select("id, user_id, garage_slots, hangar_slots, status, review_note, created_at, updated_at, approved_at, approved_by, rejected_at, rejected_by")
        .eq("user_id", profile.user_id)
        .maybeSingle<ParkingRequestRow>(),
      admin
        .from("parking_requests")
        .select("user_id, garage_slots, hangar_slots, status")
        .eq("status", "pending"),
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
    if (myRequestRes.error && myRequestRes.error.code !== "PGRST116") {
      return NextResponse.json({ ok: false, message: myRequestRes.error.message }, { status: 500 });
    }
    if (pendingRequestsRes.error) {
      return NextResponse.json({ ok: false, message: pendingRequestsRes.error.message }, { status: 500 });
    }

    const assignments = (assignmentsRes.data ?? []) as ParkingAssignmentRow[];

    const occupiedGarageSet = new Set(
      assignments
        .filter((row) => row.area === "garage" && row.user_id && row.user_id !== profile.user_id)
        .map((row) => row.slot_key)
    );

    const occupiedHangarSet = new Set(
      assignments
        .filter((row) => row.area === "hangar" && row.user_id && row.user_id !== profile.user_id)
        .map((row) => row.slot_key)
    );

    for (const row of pendingRequestsRes.data ?? []) {
      const userId = row.user_id as string | null;
      if (!userId || userId === profile.user_id) continue;

      const garageSlots = Array.isArray(row.garage_slots) ? row.garage_slots : [];
      const hangarSlots = Array.isArray(row.hangar_slots) ? row.hangar_slots : [];

      for (const slot of garageSlots) {
        if (slot) occupiedGarageSet.add(String(slot));
      }

      for (const slot of hangarSlots) {
        if (slot) occupiedHangarSet.add(String(slot));
      }
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
      assignments,
      members: (membersRes.data ?? []) as MemberRow[],
      my_request: myRequestRes.data ?? null,
      available_slots: {
        garage: Array.from(occupiedGarageSet),
        hangar: Array.from(occupiedHangarSet),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}