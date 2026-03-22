import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

type RequestRow = {
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

type ProfileRow = {
  user_id: string;
  ic_name: string | null;
  discord_name: string | null;
  status: string | null;
  site_role: string | null;
};

export async function GET(req: Request) {
  const auth = await requireAppUser(req, { requireLeadership: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const [requestsRes, profilesRes] = await Promise.all([
      auth.admin
        .from("parking_requests")
        .select("id, user_id, garage_slots, hangar_slots, status, review_note, created_at, updated_at, approved_at, approved_by, rejected_at, rejected_by")
        .order("updated_at", { ascending: false }),
      auth.admin
        .from("profiles")
        .select("user_id, ic_name, discord_name, status, site_role")
        .order("ic_name", { ascending: true }),
    ]);

    if (requestsRes.error) {
      return NextResponse.json({ ok: false, message: requestsRes.error.message }, { status: 500 });
    }
    if (profilesRes.error) {
      return NextResponse.json({ ok: false, message: profilesRes.error.message }, { status: 500 });
    }

    const profiles = new Map<string, ProfileRow>();
    for (const row of (profilesRes.data ?? []) as ProfileRow[]) profiles.set(row.user_id, row);

    const rows = ((requestsRes.data ?? []) as RequestRow[]).map((row) => ({
      ...row,
      profile: profiles.get(row.user_id) ?? null,
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
