import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireEventManager: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const name = String(body?.name || "").trim();
    const holderUserId = String(body?.holder_user_id || "").trim() || null;

    if (!name) {
      return NextResponse.json({ ok: false, message: "Add meg az esemény címét." }, { status: 400 });
    }

    const { data, error } = await auth.admin
      .from("events")
      .insert({ name, holder_user_id: holderUserId, created_by: auth.userId, is_closed: false })
      .select("id,name,holder_user_id,is_closed,created_by,created_at")
      .maybeSingle();

    if (error || !data) {
      console.error("events create error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült létrehozni az eseményt." }, { status: 500 });
    }

    const { data: members, error: membersErr } = await auth.admin
      .from("profiles")
      .select("user_id,status,site_role")
      .or("status.eq.pending,status.eq.active,status.eq.leadership,site_role.eq.admin,site_role.eq.owner");

    if (membersErr) {
      console.error("events create roster members error:", membersErr);
      return NextResponse.json({ ok: true, row: data, roster_imported: false });
    }

    const payload = (members ?? []).map((member: any) => ({
      event_id: data.id,
      user_id: member.user_id,
      was_online: false,
      attended: false,
      pending_feedback: null,
    }));

    if (payload.length > 0) {
      const { error: importErr } = await auth.admin
        .from("event_participants")
        .upsert(payload, { onConflict: "event_id,user_id" });

      if (importErr) {
        console.error("events create roster import error:", importErr);
        return NextResponse.json({ ok: true, row: data, roster_imported: false });
      }
    }

    return NextResponse.json({ ok: true, row: data, roster_imported: true });
  } catch (error: any) {
    console.error("events create fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
