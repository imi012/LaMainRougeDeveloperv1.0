import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { requireLeadership } from "../../_guard";

export async function POST(req: Request) {
  try {
    const auth = await requireLeadership(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    const user_id = body?.user_id;
    if (!user_id) return NextResponse.json({ ok: false, message: "Hiányzó user_id." }, { status: 400 });

    const admin = createAdminClient();

    const [
      profileRes,
      warningsRes,
      leadandoRes,
      ticketsRes,
      serviceRes,
      loreRes,
      blacklistRes,
      eventFeedbackRes,
      tgfNoteRes,
      parkingAssignmentsRes,
      parkingRequestRes,
    ] = await Promise.all([
      admin.from("profiles").select("discord_name,created_at").eq("user_id", user_id).maybeSingle(),
      admin
        .from("warnings")
        .select("id,reason,issued_at,expires_at,issued_by,is_active")
        .eq("user_id", user_id)
        .order("issued_at", { ascending: false })
        .limit(50),
      admin
        .from("leadando_submissions")
        .select("id,imgur_url,weeks,submitted_at,is_approved,approved_at,approved_by,approved_until")
        .eq("user_id", user_id)
        .order("submitted_at", { ascending: false })
        .limit(50),
      admin
        .from("tickets")
        .select(
          "id,type,status,created_at,updated_at,title,description,sanction_imgur_url,sanction_reason,inactivity_from,inactivity_to,old_name,new_name,namechange_reason"
        )
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("service_requests")
        .select(
          "id,title,description,status,created_at,updated_at,vehicle_type,plate,event_name,amount,imgur_url,reviewed_at,reviewed_by"
        )
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("lore_submissions")
        .select("id,discord_name,pastebin_url,lore_url,submitted_at,is_approved,approved_at,approved_by")
        .eq("user_id", user_id)
        .order("submitted_at", { ascending: false })
        .limit(100),
      admin.from("blacklist_entries").select("id").eq("user_id", user_id).limit(1),
      admin.from("event_participants").select("event_id,attended,was_online,pending_feedback").eq("user_id", user_id),
      admin
        .from("tgf_notes")
        .select("id,user_id,notes,created_at,updated_at,created_by,updated_by")
        .eq("user_id", user_id)
        .maybeSingle(),
      admin
        .from("parking_assignments")
        .select("id,area,slot_key,user_id,updated_at")
        .eq("user_id", user_id)
        .order("area", { ascending: true })
        .order("slot_key", { ascending: true }),
      admin
        .from("parking_requests")
        .select("id,user_id,garage_slots,hangar_slots,status,review_note,created_at,updated_at,approved_at,approved_by,rejected_at,rejected_by")
        .eq("user_id", user_id)
        .maybeSingle(),
    ]);

    if (warningsRes.error) {
      console.error("detail warnings error:", warningsRes.error);
      return NextResponse.json({ ok: false, message: "Warnings betöltési hiba." }, { status: 500 });
    }
    if (leadandoRes.error) {
      console.error("detail leadando error:", leadandoRes.error);
      return NextResponse.json({ ok: false, message: "Leadandó betöltési hiba." }, { status: 500 });
    }

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

    const profileRow = profileRes.data ?? null;
    const rawTickets = ticketsRes.error ? [] : ticketsRes.data ?? [];
    const service_requests = serviceRes.error ? [] : serviceRes.data ?? [];
    const lore = loreRes.error ? [] : loreRes.data ?? [];
    const parking_assignments = parkingAssignmentsRes.error ? [] : parkingAssignmentsRes.data ?? [];
    const parking_request = parkingRequestRes.error ? null : parkingRequestRes.data ?? null;

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

      if (type === "inaktivitas" || type === "inactivity") {
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

      return { ...t, payload: t.payload ?? null };
    });

    const rawEventFeedback = eventFeedbackRes.error ? [] : eventFeedbackRes.data ?? [];
    const eventIds = Array.from(new Set(rawEventFeedback.map((row: any) => row.event_id).filter(Boolean)));

    let eventNameMap = new Map<string, string>();
    if (eventIds.length > 0) {
      const { data: eventRows, error: eventNamesErr } = await admin.from("events").select("id,name,created_at").in("id", eventIds);
      if (eventNamesErr) {
        console.error("detail event names error:", eventNamesErr);
      } else {
        eventNameMap = new Map((eventRows ?? []).map((row: any) => [row.id, row.name ?? "—"]));
      }
    }

    const event_feedbacks = rawEventFeedback
      .filter((row: any) => row.pending_feedback)
      .map((row: any) => ({
        event_id: row.event_id,
        event_name: eventNameMap.get(row.event_id) ?? "—",
        attended: !!row.attended,
        was_online: !!row.was_online,
        pending_feedback: row.pending_feedback,
      }));

    const openTickets = tickets.filter((t: any) => ["open", "in_progress", "pending"].includes((t.status || "").toLowerCase())).length;
    const pendingService = service_requests.filter((s: any) => s.status === "pending").length;
    const lastLore = lore[0] ?? null;
    const lastLeadando = (leadandoRes.data ?? [])[0] ?? null;
    const assignedGarageSlots = parking_assignments
      .filter((row: any) => row.area === "garage")
      .map((row: any) => row.slot_key);
    const assignedHangarSlots = parking_assignments
      .filter((row: any) => row.area === "hangar")
      .map((row: any) => row.slot_key);

    return NextResponse.json({
      ok: true,
      warnings: warningsRes.data ?? [],
      leadando: leadandoRes.data ?? [],
      tickets,
      service_requests,
      lore,
      event_feedbacks,
      parking_assignments,
      parking_request,
      summary: {
        open_tickets: openTickets,
        total_tickets: tickets.length,
        pending_service: pendingService,
        total_service: service_requests.length,
        lore_submitted: !!lastLore,
        lore_approved: lastLore ? !!lastLore.is_approved : false,
        last_leadando_submitted: lastLeadando ? lastLeadando.submitted_at : null,
        discord_name: profileRow?.discord_name ?? lastLore?.discord_name ?? null,
        joined_at: profileRow?.created_at ?? null,
        is_blacklisted: (blacklistRes.data ?? []).length > 0,
        pending_event_feedback_count: event_feedbacks.length,
        assigned_garage_slots: assignedGarageSlots,
        assigned_hangar_slots: assignedHangarSlots,
      },
      tgf_note: tgfNoteRes.error ? null : tgfNoteRes.data ?? null,
    });
  } catch (e: any) {
    console.error("admin users/detail fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
