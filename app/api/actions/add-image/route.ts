import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

function isAllowedImgurUrl(value: string) {
  return /^(https?:\/\/)?(i\.)?imgur\.com\//i.test(value.trim());
}

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireMember: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const actionId = String(body?.action_id || "").trim();
    const imgurUrl = String(body?.imgur_url || "").trim();

    if (!actionId || !imgurUrl) {
      return NextResponse.json({ ok: false, message: "Hiányzó akció vagy link." }, { status: 400 });
    }

    if (!isAllowedImgurUrl(imgurUrl)) {
      return NextResponse.json({ ok: false, message: "Csak Imgur link engedélyezett." }, { status: 400 });
    }

    const { data: action, error: actionErr } = await auth.admin
      .from("actions")
      .select("id,is_closed")
      .eq("id", actionId)
      .maybeSingle();

    if (actionErr || !action) {
      return NextResponse.json({ ok: false, message: "Az akció nem található." }, { status: 404 });
    }

    if (action.is_closed) {
      return NextResponse.json({ ok: false, message: "Ez az akció le van zárva. Nem lehet képet hozzáadni." }, { status: 409 });
    }

    const { data, error } = await auth.admin
      .from("action_images")
      .insert({ action_id: actionId, imgur_url: imgurUrl, uploaded_by: auth.userId })
      .select("id,action_id,imgur_url,uploaded_by,created_at")
      .maybeSingle();

    if (error || !data) {
      console.error("actions add-image error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült hozzáadni a képet." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (error: any) {
    console.error("actions add-image fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
