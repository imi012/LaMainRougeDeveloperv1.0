import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const user_id = body?.user_id;
    if (!user_id) return NextResponse.json({ ok: false, message: "Hiányzó user_id." }, { status: 400 });

    const admin = createAdminClient();

    // Token -> actor
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });
    }
    const actorId = userRes.user.id;

    // jogosultság
    const { data: actorProfile } = await admin
      .from("profiles")
      .select("site_role,status")
      .eq("user_id", actorId)
      .maybeSingle();

    const allowed =
      actorProfile?.site_role === "owner" ||
      actorProfile?.site_role === "admin" ||
      actorProfile?.status === "leadership";

    if (!allowed) return NextResponse.json({ ok: false, message: "Nincs jogosultság." }, { status: 403 });

    // warnings
    const warningsRes = await admin
      .from("warnings")
      .select("id,reason,issued_at,expires_at,issued_by,is_active")
      .eq("user_id", user_id)
      .order("issued_at", { ascending: false })
      .limit(50);

    if (warningsRes.error) {
      console.error("detail warnings error:", warningsRes.error);
      return NextResponse.json({ ok: false, message: "Warnings betöltési hiba." }, { status: 500 });
    }

    // ✅ Lejárt figyelmeztetések automatikus inaktiválása
    const now = Date.now();
    const expiredIds =
      (warningsRes.data ?? [])
        .filter((w: any) => {
          if (!w?.is_active) return false;
          if (!w?.expires_at) return false;
          const t = new Date(w.expires_at).getTime();
          if (Number.isNaN(t)) return false;
          return t <= now;
        })
        .map((w: any) => w.id) ?? [];

    if (expiredIds.length > 0) {
      const upd = await admin.from("warnings").update({ is_active: false }).in("id", expiredIds);
      if (upd.error) console.error("auto-expire warnings update error:", upd.error);

      warningsRes.data = (warningsRes.data ?? []).map((w: any) =>
        expiredIds.includes(w.id) ? { ...w, is_active: false } : w
      );
    }

    // leadandó
    const leadandoRes = await admin
      .from("leadando_submissions")
      .select("id,imgur_url,weeks,submitted_at,is_approved,approved_at,approved_by")
      .eq("user_id", user_id)
      .order("submitted_at", { ascending: false })
      .limit(50);

    if (leadandoRes.error) {
      console.error("detail leadando error:", leadandoRes.error);
      return NextResponse.json({ ok: false, message: "Leadandó betöltési hiba." }, { status: 500 });
    }

    // tickets
    const ticketsRes = await admin
      .from("tickets")
      .select(
        "id,type,status,created_at,updated_at,title,description,sanction_imgur_url,sanction_reason,inactivity_from,inactivity_to,old_name,new_name,namechange_reason"
      )
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(200);

    // service requests
    const serviceRes = await admin
      .from("service_requests")
      .select("id,title,description,status,created_at,updated_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(200);

    // lore
    const loreRes = await admin
      .from("lore_submissions")
      .select("id,lore_url,submitted_at,is_approved,approved_at,approved_by")
      .eq("user_id", user_id)
      .order("submitted_at", { ascending: false })
      .limit(100);

    const rawTickets = ticketsRes.error ? [] : ticketsRes.data ?? [];
    const service_requests = serviceRes.error ? [] : serviceRes.data ?? [];
    const lore = loreRes.error ? [] : loreRes.data ?? [];

    // ✅ Ticketek egységesítése: payload + (opcionális) imgur_url
    const tickets = rawTickets.map((t: any) => {
      const type = (t.type || "").toString();

      if (type === "szankcio") {
        return {
          ...t,
          imgur_url: t.sanction_imgur_url ?? null,
          payload: {
            imgur_url: t.sanction_imgur_url ?? null,
            reason: t.sanction_reason ?? null,
          },
        };
      }

      if (type === "inaktivitas") {
        return {
          ...t,
          payload: {
            inactive_from: t.inactivity_from ?? null,
            inactive_to: t.inactivity_to ?? null,
          },
        };
      }

      if (type === "nevvaltas") {
        return {
          ...t,
          payload: {
            old_name: t.old_name ?? null,
            new_name: t.new_name ?? null,
            reason: t.namechange_reason ?? null,
          },
        };
      }

      // default
      return { ...t, payload: t.payload ?? null };
    });

    const openTickets = tickets.filter((t: any) => t.status === "open" || t.status === "in_progress").length;
    const pendingService = service_requests.filter((s: any) => s.status === "pending").length;
    const lastLore = lore[0] ?? null;
    const lastLeadando = (leadandoRes.data ?? [])[0] ?? null;

    return NextResponse.json({
      ok: true,
      warnings: warningsRes.data ?? [],
      leadando: leadandoRes.data ?? [],
      tickets,
      service_requests,
      lore,
      summary: {
        open_tickets: openTickets,
        total_tickets: tickets.length,
        pending_service: pendingService,
        total_service: service_requests.length,
        lore_submitted: !!lastLore,
        lore_approved: lastLore ? !!lastLore.is_approved : false,
        last_leadando_submitted: lastLeadando ? lastLeadando.submitted_at : null,
      },
    });
  } catch (e: any) {
    console.error("admin users/detail fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}