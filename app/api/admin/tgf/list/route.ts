import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";

type TgfProfileRow = {
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

    const { data: profiles, error: profilesErr } = await admin
      .from("profiles")
      .select("user_id,ic_name,discord_name,status,site_role,rank_id,created_at,updated_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1000);

    if (profilesErr) {
      console.error("admin tgf list profiles error:", profilesErr);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni a TGF listát." }, { status: 500 });
    }

    const userIds = (profiles ?? []).map((row: any) => row.user_id).filter(Boolean) as string[];

    let notesMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: notes, error: notesErr } = await admin
        .from("tgf_notes")
        .select("id,user_id,notes,created_at,updated_at,created_by,updated_by")
        .in("user_id", userIds);

      if (notesErr) {
        console.error("admin tgf list notes error:", notesErr);
        return NextResponse.json({ ok: false, message: "Nem sikerült betölteni a TGF jegyzeteket." }, { status: 500 });
      }

      notesMap = new Map((notes ?? []).map((row: any) => [row.user_id, row]));
    }

    const rows = (profiles ?? []).map((profile: TgfProfileRow) => ({
      profile,
      tgf_note: notesMap.get(profile.user_id) ?? null,
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    console.error("admin tgf list fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
