import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

type TicketType = "sanction" | "inactivity" | "namechange";

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });

    const body = await req.json().catch(() => null);

    const type = body?.type as TicketType | undefined;
    if (!type || !["sanction", "inactivity", "namechange"].includes(type)) {
      return NextResponse.json({ ok: false, message: "Érvénytelen ticket típus." }, { status: 400 });
    }

    const admin = createAdminClient();

    // token -> user
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });

    const user_id = userRes.user.id;

    // validálás + mapping
    let row: any = {
      user_id,
      type,
      status: "open",
      title: body?.title ?? null,
      description: body?.description ?? null,
    };

    if (type === "sanction") {
      const sanction_imgur_url = String(body?.sanction_imgur_url || "").trim();
      const sanction_reason = String(body?.sanction_reason || "").trim();
      if (!sanction_imgur_url || !sanction_reason) {
        return NextResponse.json({ ok: false, message: "Szankcióhoz link és ok kötelező." }, { status: 400 });
      }
      row.sanction_imgur_url = sanction_imgur_url;
      row.sanction_reason = sanction_reason;
      row.title = "Szankció";
      row.description = sanction_reason;
    }

    if (type === "inactivity") {
      const inactivity_from = String(body?.inactivity_from || "").trim();
      const inactivity_to = String(body?.inactivity_to || "").trim();
      if (!inactivity_from || !inactivity_to) {
        return NextResponse.json({ ok: false, message: "Inaktivitásnál mettől-meddig kötelező." }, { status: 400 });
      }
      row.inactivity_from = inactivity_from; // date (YYYY-MM-DD)
      row.inactivity_to = inactivity_to;
      row.title = "Inaktivitás";
      row.description = `${inactivity_from} → ${inactivity_to}`;
    }

    if (type === "namechange") {
      const old_name = String(body?.old_name || "").trim();
      const new_name = String(body?.new_name || "").trim();
      const namechange_reason = String(body?.namechange_reason || "").trim();
      if (!old_name || !new_name || !namechange_reason) {
        return NextResponse.json({ ok: false, message: "Névváltásnál minden mező kötelező." }, { status: 400 });
      }
      row.old_name = old_name;
      row.new_name = new_name;
      row.namechange_reason = namechange_reason;
      row.title = "Névváltás";
      row.description = `${old_name} → ${new_name} (${namechange_reason})`;
    }

    const ins = await admin.from("tickets").insert(row).select("id").maybeSingle();
    if (ins.error) {
      console.error("ticket create error:", ins.error);
      return NextResponse.json({ ok: false, message: "Nem sikerült elküldeni a ticketet." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: ins.data?.id ?? null });
  } catch (e: any) {
    console.error("ticket create fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}