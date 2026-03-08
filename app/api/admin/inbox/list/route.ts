import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";

type ProfileRow = {
  user_id: string;
  ic_name: string | null;
  discord_name: string | null;
  status: string | null;
  site_role: string | null;
  rank_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function GET(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const admin = createAdminClient();

    const [leadandoRes, ticketRes, serviceRes, loreRes] = await Promise.all([
      admin
        .from("leadando_submissions")
        .select("id,user_id,imgur_url,weeks,submitted_at,is_approved,approved_at,approved_by")
        .eq("is_approved", false)
        .order("submitted_at", { ascending: false })
        .limit(500),
      admin
        .from("tickets")
        .select(
          "id,user_id,type,status,title,description,created_at,updated_at,sanction_reason,inactivity_from,inactivity_to,old_name,new_name,namechange_reason"
        )
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("service_requests")
        .select(
          "id,user_id,title,description,status,created_at,updated_at,vehicle_type,plate,event_name,amount,imgur_url,reviewed_at,reviewed_by"
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("lore_submissions")
        .select("id,user_id,discord_name,pastebin_url,lore_url,submitted_at,is_approved,approved_at,approved_by")
        .eq("is_approved", false)
        .order("submitted_at", { ascending: false })
        .limit(500),
    ]);

    if (leadandoRes.error) {
      console.error("admin inbox leadando error:", leadandoRes.error);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni a leadandókat." }, { status: 500 });
    }
    if (ticketRes.error) {
      console.error("admin inbox tickets error:", ticketRes.error);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni a ticketeket." }, { status: 500 });
    }
    if (serviceRes.error) {
      console.error("admin inbox service error:", serviceRes.error);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni a szereltetés igényléseket." }, { status: 500 });
    }
    if (loreRes.error) {
      console.error("admin inbox lore error:", loreRes.error);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni a karaktertörténeteket." }, { status: 500 });
    }

    const userIds = Array.from(
      new Set(
        [
          ...(leadandoRes.data ?? []).map((row: any) => row.user_id),
          ...(ticketRes.data ?? []).map((row: any) => row.user_id),
          ...(serviceRes.data ?? []).map((row: any) => row.user_id),
          ...(loreRes.data ?? []).map((row: any) => row.user_id),
        ].filter(Boolean)
      )
    ) as string[];

    let profileMap = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      const { data: profiles, error: profileErr } = await admin
        .from("profiles")
        .select("user_id,ic_name,discord_name,status,site_role,rank_id,created_at,updated_at")
        .in("user_id", userIds);

      if (profileErr) {
        console.error("admin inbox profiles error:", profileErr);
      } else {
        profileMap = new Map((profiles ?? []).map((row: any) => [row.user_id, row as ProfileRow]));
      }
    }

    const rows = [
      ...(leadandoRes.data ?? []).map((row: any) => ({
        inbox_type: "leadando",
        id: row.id,
        user_id: row.user_id ?? null,
        submitted_at: row.submitted_at,
        title: `Hetek: ${row.weeks}`,
        subtitle: row.imgur_url || null,
        status_label: row.is_approved ? "Elfogadva" : "Függőben",
        profile: row.user_id ? profileMap.get(row.user_id) ?? null : null,
        leadando: row,
      })),
      ...(ticketRes.data ?? []).map((row: any) => ({
        inbox_type: "ticket",
        id: row.id,
        user_id: row.user_id ?? null,
        submitted_at: row.created_at,
        title: row.title || "Ticket",
        subtitle: row.description || row.sanction_reason || row.namechange_reason || null,
        status_label: row.status || "open",
        profile: row.user_id ? profileMap.get(row.user_id) ?? null : null,
        ticket: row,
      })),
      ...(serviceRes.data ?? []).map((row: any) => ({
        inbox_type: "service",
        id: row.id,
        user_id: row.user_id ?? null,
        submitted_at: row.created_at,
        title: row.title || row.vehicle_type || "Szereltetés igénylés",
        subtitle: row.plate || row.event_name || row.description || null,
        status_label: row.status || "pending",
        profile: row.user_id ? profileMap.get(row.user_id) ?? null : null,
        service: row,
      })),
      ...(loreRes.data ?? []).map((row: any) => ({
        inbox_type: "lore",
        id: row.id,
        user_id: row.user_id ?? null,
        submitted_at: row.submitted_at,
        title: row.discord_name || "Karaktertörténet",
        subtitle: row.lore_url || row.pastebin_url || null,
        status_label: row.is_approved ? "Elfogadva" : "Függőben",
        profile: row.user_id ? profileMap.get(row.user_id) ?? null : null,
        lore: row,
      })),
    ].sort((a: any, b: any) => {
      const ta = new Date(a.submitted_at || 0).getTime();
      const tb = new Date(b.submitted_at || 0).getTime();
      return tb - ta;
    });

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    console.error("admin inbox list fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
