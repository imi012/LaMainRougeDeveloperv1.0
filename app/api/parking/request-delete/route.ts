import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

type Body = {
  request_id?: string;
};

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireMember: true, allowPending: false });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const requestId = (body?.request_id || "").trim();

    const canManageAll = auth.profile.site_role === "owner" || auth.profile.site_role === "admin" || auth.profile.status === "leadership";

    let query = auth.admin.from("parking_requests").delete();

    if (requestId) {
      if (canManageAll) {
        query = query.eq("id", requestId);
      } else {
        query = query.eq("id", requestId).eq("user_id", auth.userId);
      }
    } else {
      query = query.eq("user_id", auth.userId);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
