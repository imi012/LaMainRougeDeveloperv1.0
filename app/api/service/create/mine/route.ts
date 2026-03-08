import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAppUser } from "@/lib/server/app-auth";

export async function GET(req: Request) {
  const auth = await requireAppUser(req, {
    requireMember: true,
    allowPending: false,
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("service_requests")
    .select("id,vehicle_type,plate,event_name,amount,imgur_url,status,created_at,reviewed_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("service mine error:", error);
    return NextResponse.json({ ok: false, message: "Nem sikerült betölteni." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [] });
}
