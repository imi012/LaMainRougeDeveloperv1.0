import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;

  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function requireLeadership(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    return { ok: false as const, status: 401, message: "Nincs bejelentkezve." };
  }

  const admin = createAdminClient();

  // JWT ellenőrzés (client localStorage session -> Authorization: Bearer)
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);

  if (userErr || !userRes?.user) {
    return { ok: false as const, status: 401, message: "Nincs bejelentkezve." };
  }

  const userId = userRes.user.id;

  const { data: me, error } = await admin
    .from("profiles")
    .select("user_id,status,site_role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !me) {
    return { ok: false as const, status: 403, message: "Nincs jogosultságod." };
  }

  const allowed =
    me.status === "leadership" || me.site_role === "admin" || me.site_role === "owner";

  if (!allowed) {
    return { ok: false as const, status: 403, message: "Nincs jogosultságod." };
  }

  return { ok: true as const, userId };
}