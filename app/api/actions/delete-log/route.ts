import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireActionManager: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const logId = String(body?.log_id || "").trim();
    if (!logId) {
      return NextResponse.json({ ok: false, message: "Hiányzó log azonosító." }, { status: 400 });
    }

    const { data: logRow, error: logErr } = await auth.admin
      .from("action_logs")
      .select("id,action_id")
      .eq("id", logId)
      .maybeSingle();

    if (logErr || !logRow) {
      return NextResponse.json({ ok: false, message: "A log nem található." }, { status: 404 });
    }

    const { data: action, error: actionErr } = await auth.admin
      .from("actions")
      .select("id,is_closed")
      .eq("id", logRow.action_id)
      .maybeSingle();

    if (actionErr || !action) {
      return NextResponse.json({ ok: false, message: "Az akció nem található." }, { status: 404 });
    }

    if (action.is_closed) {
      return NextResponse.json({ ok: false, message: "Lezárt akción log nem szerkeszthető." }, { status: 409 });
    }

    const { error } = await auth.admin.from("action_logs").delete().eq("id", logId);
    if (error) {
      console.error("actions delete-log error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült törölni a logot." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("actions delete-log fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
