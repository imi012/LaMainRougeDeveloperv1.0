import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireActionManager: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const imageId = String(body?.image_id || "").trim();
    if (!imageId) {
      return NextResponse.json({ ok: false, message: "Hiányzó kép azonosító." }, { status: 400 });
    }

    const { data: imageRow, error: imageErr } = await auth.admin
      .from("action_images")
      .select("id,action_id")
      .eq("id", imageId)
      .maybeSingle();

    if (imageErr || !imageRow) {
      return NextResponse.json({ ok: false, message: "A kép nem található." }, { status: 404 });
    }

    const { data: action, error: actionErr } = await auth.admin
      .from("actions")
      .select("id,is_closed")
      .eq("id", imageRow.action_id)
      .maybeSingle();

    if (actionErr || !action) {
      return NextResponse.json({ ok: false, message: "Az akció nem található." }, { status: 404 });
    }

    if (action.is_closed) {
      return NextResponse.json({ ok: false, message: "Lezárt akción képlink nem szerkeszthető." }, { status: 409 });
    }

    const { error } = await auth.admin.from("action_images").delete().eq("id", imageId);
    if (error) {
      console.error("actions delete-image error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült törölni a képet." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("actions delete-image fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
