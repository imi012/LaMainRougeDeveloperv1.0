import {
  canManageEvent,
  canUseMemberFeatures,
  evaluatePermissions,
  normalizeRankName,
} from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export type AppProfile = {
  user_id: string;
  status: string | null;
  site_role: string | null;
  rank_id?: string | null;
  rank_name?: string | null;
  ic_name?: string | null;
};

export type RequireAppUserOptions = {
  requireMember?: boolean;
  requireLeadership?: boolean;
  requireActionManager?: boolean;
  requireEventManager?: boolean;
  allowPending?: boolean;
};

export type RequireAppUserResult =
  | {
      ok: true;
      userId: string;
      profile: AppProfile;
      admin: ReturnType<typeof createAdminClient>;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

export function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export function isLeadershipProfile(profile: { status?: string | null; site_role?: string | null } | null | undefined) {
  return evaluatePermissions(profile).canAccessLeadership;
}

export function canManageOwnedEvent(
  profile: { status?: string | null; site_role?: string | null } | null | undefined,
  rankName: string | null | undefined,
  createdBy: string | null | undefined,
  actorUserId: string | null | undefined
) {
  return canManageEvent(profile, rankName, createdBy, actorUserId);
}

export async function requireAppUser(
  req: Request,
  options: RequireAppUserOptions = {}
): Promise<RequireAppUserResult> {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, message: "Nincs bejelentkezve." };
  }

  const admin = createAdminClient();
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);

  if (userErr || !userRes?.user) {
    return { ok: false, status: 401, message: "Nincs bejelentkezve." };
  }

  const userId = userRes.user.id;

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("user_id,status,site_role,rank_id,ic_name")
    .eq("user_id", userId)
    .maybeSingle<AppProfile>();

  if (profileErr || !profile) {
    return { ok: false, status: 403, message: "A profil nem található vagy nem elérhető." };
  }

  let rankName: string | null = null;

  if (profile.rank_id) {
    const { data: rankRow } = await admin
      .from("ranks")
      .select("name")
      .eq("id", profile.rank_id)
      .maybeSingle<{ name: string | null }>();

    rankName = rankRow?.name ?? null;
  }

  const enrichedProfile: AppProfile = {
    ...profile,
    rank_name: normalizeRankName(rankName),
  };

  const permissions = evaluatePermissions(enrichedProfile, { rankName: enrichedProfile.rank_name });

  if (!permissions.canAccessApp) {
    return { ok: false, status: 403, message: "Az oldal használata inaktív státusszal nem engedélyezett." };
  }

  if (options.requireLeadership && !permissions.canAccessLeadership) {
    return { ok: false, status: 403, message: "Nincs jogosultság." };
  }

  if (options.requireActionManager && !permissions.canManageAction) {
    return { ok: false, status: 403, message: "Nincs jogosultság." };
  }

  if (options.requireEventManager && !permissions.canCreateEvent) {
    return { ok: false, status: 403, message: "Nincs jogosultság." };
  }

  if (options.requireMember && !canUseMemberFeatures(enrichedProfile)) {
    return { ok: false, status: 403, message: "Nincs jogosultság." };
  }

  if (options.allowPending === false && enrichedProfile.status === "pending") {
    return { ok: false, status: 403, message: "Pending státusszal ez a művelet nem engedélyezett." };
  }

  return {
    ok: true,
    userId,
    profile: enrichedProfile,
    admin,
  };
}
