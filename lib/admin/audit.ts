import { createAdminClient } from "@/lib/supabase/admin";

export type AdminAuditPayload = {
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  target_label?: string | null;
  details?: Record<string, any> | null;
};

export async function writeAdminAuditLog(payload: AdminAuditPayload) {
  try {
    const admin = createAdminClient();

    const { data: actorProfile } = await admin
      .from("profiles")
      .select("ic_name,site_role")
      .eq("user_id", payload.actor_user_id)
      .maybeSingle();

    const row = {
      actor_user_id: payload.actor_user_id,
      actor_ic_name: actorProfile?.ic_name ?? null,
      actor_site_role: actorProfile?.site_role ?? null,
      action: payload.action,
      target_type: payload.target_type,
      target_id: payload.target_id ?? null,
      target_label: payload.target_label ?? null,
      details: payload.details ?? null,
    };

    const { error } = await admin.from("admin_audit_logs").insert(row);
    if (error) {
      console.error("writeAdminAuditLog insert error:", error);
    }
  } catch (error) {
    console.error("writeAdminAuditLog fatal:", error);
  }
}

export function canViewAdminAudit(profile: { site_role?: string | null } | null | undefined) {
  return profile?.site_role === "admin" || profile?.site_role === "owner";
}
