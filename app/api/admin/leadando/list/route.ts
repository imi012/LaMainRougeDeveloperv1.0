import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLeadership } from "../../_guard";

export async function GET(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("leadando_submissions")
      .select("id,user_id,imgur_url,weeks,submitted_at,is_approved,approved_at,approved_by,approved_until")
      .order("submitted_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("leadando list error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni a kérdőíveket." }, { status: 500 });
    }

    const userIds = Array.from(new Set((data ?? []).map((row: any) => row.user_id).filter(Boolean)));

    let profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profiles, error: profileErr } = await admin
        .from("profiles")
        .select("user_id,ic_name,discord_name,status,site_role,rank_id,created_at,updated_at")
        .in("user_id", userIds);

      if (profileErr) {
        console.error("leadando list profiles error:", profileErr);
      } else {
        profileMap = new Map((profiles ?? []).map((row: any) => [row.user_id, row]));
      }
    }

    const rows = (data ?? []).map((row: any) => {
      const profile = row.user_id ? profileMap.get(row.user_id) : null;
      return {
        ...row,
        profile: profile
          ? {
              user_id: profile.user_id,
              ic_name: profile.ic_name ?? null,
              discord_name: profile.discord_name ?? null,
              status: profile.status ?? null,
              site_role: profile.site_role ?? null,
              rank_id: profile.rank_id ?? null,
              created_at: profile.created_at ?? null,
              updated_at: profile.updated_at ?? null,
            }
          : null,
      };
    });

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    console.error("leadando list fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
