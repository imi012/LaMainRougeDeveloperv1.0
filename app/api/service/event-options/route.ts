import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAppUser } from "@/lib/server/app-auth";

type EventOptionRow = {
  value: string;
  label: string;
  source: "event" | "action";
  created_at: string | null;
  is_closed: boolean;
};

export async function GET(req: Request) {
  const auth = await requireAppUser(req, {
    requireMember: true,
    allowPending: false,
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const admin = createAdminClient();

    const [eventsRes, actionsRes] = await Promise.all([
      admin
        .from("events")
        .select("id,name,created_at,is_closed")
        .not("name", "is", null)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("actions")
        .select("id,name,created_at,is_closed")
        .not("name", "is", null)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (eventsRes.error) {
      console.error("service event-options events error:", eventsRes.error);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni az eseményeket." }, { status: 500 });
    }

    if (actionsRes.error) {
      console.error("service event-options actions error:", actionsRes.error);
      return NextResponse.json({ ok: false, message: "Nem sikerült betölteni az akciókat." }, { status: 500 });
    }

    const eventOptions: EventOptionRow[] = (eventsRes.data ?? [])
      .map((row: any) => ({
        value: `event:${row.id}`,
        label: String(row.name || "").trim(),
        source: "event" as const,
        created_at: row.created_at ?? null,
        is_closed: !!row.is_closed,
      }))
      .filter((row) => !!row.label);

    const actionOptions: EventOptionRow[] = (actionsRes.data ?? [])
      .map((row: any) => ({
        value: `action:${row.id}`,
        label: String(row.name || "").trim(),
        source: "action" as const,
        created_at: row.created_at ?? null,
        is_closed: !!row.is_closed,
      }))
      .filter((row) => !!row.label);

    const rows = [...eventOptions, ...actionOptions].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0;
      const right = b.created_at ? new Date(b.created_at).getTime() : 0;
      return right - left;
    });

    return NextResponse.json({ ok: true, rows });
  } catch (error: any) {
    console.error("service event-options fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
