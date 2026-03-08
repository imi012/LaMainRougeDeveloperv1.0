import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { requireLeadership } from "../../_guard";
import { writeAdminAuditLog } from "@/lib/admin/audit";

export async function POST(req: Request) {
  const auth = await requireLeadership(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const id = (body?.id || "").toString().trim();

    if (!id) {
      return NextResponse.json({ ok: false, message: "Hiányzó blacklist azonosító." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: row, error: rowError } = await admin
      .from("blacklist_entries")
      .select("id,user_id,ic_name,previous_status")
      .eq("id", id)
      .maybeSingle();

    if (rowError || !row) {
      return NextResponse.json({ ok: false, message: "A blacklist bejegyzés nem található." }, { status: 404 });
    }

    if (row.user_id) {
      const { error: deleteError } = await admin
        .from("blacklist_entries")
        .delete()
        .eq("user_id", row.user_id);

      if (deleteError) {
        console.error("blacklist delete by user_id error:", deleteError);
        return NextResponse.json({ ok: false, message: "Nem sikerült törölni a blacklist bejegyzéseket." }, { status: 500 });
      }

      const restoreStatus = row.previous_status || "pending";
      const { error: profileUpdateError } = await admin
        .from("profiles")
        .update({ status: restoreStatus })
        .eq("user_id", row.user_id);

      if (profileUpdateError) {
        console.error("blacklist restore profile status error:", profileUpdateError);
        return NextResponse.json(
          { ok: false, message: "A blacklist törölve lett, de a státuszt nem sikerült visszaállítani." },
          { status: 500 }
        );
      }

      await writeAdminAuditLog({
        actor_user_id: auth.userId,
        action: "blacklist_delete",
        target_type: "blacklist_entry",
        target_id: id,
        target_label: row.ic_name,
        details: {
          user_id: row.user_id,
          restored_status: restoreStatus,
          delete_mode: "delete_all_entries_for_user",
        },
      });

      return NextResponse.json({ ok: true });
    }

    const { error: deleteError } = await admin
      .from("blacklist_entries")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("blacklist delete by id error:", deleteError);
      return NextResponse.json({ ok: false, message: "Nem sikerült törölni a blacklist bejegyzést." }, { status: 500 });
    }

    await writeAdminAuditLog({
      actor_user_id: auth.userId,
      action: "blacklist_delete",
      target_type: "blacklist_entry",
      target_id: id,
      target_label: row.ic_name,
      details: {
        user_id: null,
        restored_status: null,
        delete_mode: "delete_single_manual_entry",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("blacklist delete fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}