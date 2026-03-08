import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireActionManager: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const actionId = String(body?.action_id || "").trim();
    if (!actionId) {
      return NextResponse.json({ ok: false, message: "Hiányzó akció azonosító." }, { status: 400 });
    }

    const { error } = await auth.admin.from("actions").delete().eq("id", actionId);
    if (error) {
      console.error("actions delete error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült törölni az akciót." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("actions delete fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
