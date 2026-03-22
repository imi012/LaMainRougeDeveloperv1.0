import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";

type Body = {
  request_id?: string;
};

export async function POST(req: Request) {
  try {
    const auth = await requireLeadership(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    const requestId = (body?.request_id || "").trim();
    if (!requestId) {
      return NextResponse.json({ ok: false, message: "Hiányzó request_id." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("parking_requests").delete().eq("id", requestId);
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
