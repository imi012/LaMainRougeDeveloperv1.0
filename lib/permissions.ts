export type ProfileStatus = "pending" | "active" | "leadership" | "inactive" | string | null;
export type SiteRole = "user" | "admin" | "owner" | string | null;
export type AppView = "tgf" | "member" | "leadership";

export type PermissionProfile = {
  user_id?: string | null;
  status?: ProfileStatus;
  site_role?: SiteRole;
  rank_id?: string | null;
  rank_name?: string | null;
} | null | undefined;

export type PermissionContext = {
  pathname?: string | null;
  rankName?: string | null;
  createdBy?: string | null;
  actorUserId?: string | null;
};

const ACTION_MANAGER_RANK_NAMES = new Set([
  "briscard",
  "briscard fondateur",
]);

const EVENT_MANAGER_RANK_NAMES = new Set([
  "borreau",
  "decoupeur",
  "briscard",
  "briscard fondateur",
]);

const PENDING_APP_PATHS = new Set([
  "/app",
  "/app/profile",
  "/app/helyszin",
  "/app/karakter-utmutato",
  "/app/karaktertortenet",
  "/app/skinek",
  "/app/szabalyzat",
  "/app/szotar",
]);

const ACTIVE_BASE_APP_PATHS = new Set([
  "/app",
  "/app/profile",
  "/app/tagok",
  "/app/akciok",
  "/app/rangok",
  "/app/jarmuvek",
  "/app/szereltetes",
  "/app/leadando",
  "/app/karaktertortenet",
  "/app/ticketek",
  "/app/parkolas",
  "/app/skinek",
  "/app/szabalyzat",
  "/app/szotar",
]);

const LEADERSHIP_APP_PATHS = new Set([
  ...ACTIVE_BASE_APP_PATHS,
  "/app/esemenyek",
  "/app/vezetoseg",
]);

function normalizePathname(pathname: string | null | undefined) {
  const raw = (pathname || "").trim();
  if (!raw) return "/";
  const withoutQuery = raw.split("?")[0] || raw;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

export function normalizeRankName(rankName: string | null | undefined) {
  return (rankName || "").trim().toLowerCase();
}

export function getProfileStatus(profile: PermissionProfile): ProfileStatus {
  return profile?.status ?? null;
}

export function getSiteRole(profile: PermissionProfile): SiteRole {
  return profile?.site_role ?? null;
}

export function isInactiveProfile(profile: PermissionProfile) {
  return getProfileStatus(profile) === "inactive";
}

export function isPendingProfile(profile: PermissionProfile) {
  return getProfileStatus(profile) === "pending";
}

export function isActiveProfile(profile: PermissionProfile) {
  return getProfileStatus(profile) === "active";
}

export function isAdminSiteRole(profile: PermissionProfile) {
  return getSiteRole(profile) === "admin";
}

export function isOwnerSiteRole(profile: PermissionProfile) {
  return getSiteRole(profile) === "owner";
}

export function isAdminOrOwner(profile: PermissionProfile) {
  return isAdminSiteRole(profile) || isOwnerSiteRole(profile);
}

export function isLeadershipStatus(profile: PermissionProfile) {
  return getProfileStatus(profile) === "leadership";
}

export function isLeadershipProfile(profile: PermissionProfile) {
  return isLeadershipStatus(profile) || isAdminOrOwner(profile);
}

export function canAccessApp(profile: PermissionProfile) {
  return !!profile && !isInactiveProfile(profile);
}

export function canUseMemberFeatures(profile: PermissionProfile) {
  return isActiveProfile(profile) || isLeadershipProfile(profile);
}

export function canAccessLeadership(profile: PermissionProfile) {
  return canAccessApp(profile) && isLeadershipProfile(profile);
}

export function canAccessAuditLog(profile: PermissionProfile) {
  return isAdminOrOwner(profile);
}

export function canViewActions(profile: PermissionProfile) {
  return canUseMemberFeatures(profile);
}

export function canViewDictionary(profile: PermissionProfile) {
  return isPendingProfile(profile) || isActiveProfile(profile) || isLeadershipProfile(profile);
}

export function canViewEvents(profile: PermissionProfile, rankName?: string | null) {
  return hasEventManagerPermission(profile, rankName);
}

export function canCreateAction(profile: PermissionProfile, rankName?: string | null) {
  return hasActionManagerPermission(profile, rankName);
}

export function canManageAction(profile: PermissionProfile, rankName?: string | null) {
  return hasActionManagerPermission(profile, rankName);
}

export function canCreateEvent(profile: PermissionProfile, rankName?: string | null) {
  return hasEventManagerPermission(profile, rankName);
}

export function canManageEvent(
  profile: PermissionProfile,
  rankName?: string | null,
  createdBy?: string | null,
  actorUserId?: string | null
) {
  if (isLeadershipProfile(profile)) return true;
  if (!hasEventManagerPermission(profile, rankName)) return false;
  return !!createdBy && !!actorUserId && createdBy === actorUserId;
}

export function hasActionManagerPermission(
  profile: PermissionProfile,
  rankName?: string | null
) {
  if (isLeadershipProfile(profile)) return true;
  if (!isActiveProfile(profile)) return false;
  return ACTION_MANAGER_RANK_NAMES.has(normalizeRankName(rankName));
}

export function hasEventManagerPermission(
  profile: PermissionProfile,
  rankName?: string | null
) {
  if (isLeadershipProfile(profile)) return true;
  if (!isActiveProfile(profile)) return false;
  return EVENT_MANAGER_RANK_NAMES.has(normalizeRankName(rankName));
}

export function getAppViewForProfile(profile: PermissionProfile): AppView {
  if (isLeadershipProfile(profile)) return "leadership";
  if (isPendingProfile(profile)) return "tgf";
  return "member";
}

export function getAllowedAppPaths(profile: PermissionProfile, rankName?: string | null) {
  if (!canAccessApp(profile)) return new Set<string>();
  if (isLeadershipProfile(profile)) {
    const paths = new Set(LEADERSHIP_APP_PATHS);
    if (canAccessAuditLog(profile)) {
      paths.add("/app/audit-log");
    }
    return paths;
  }
  if (isPendingProfile(profile)) return new Set(PENDING_APP_PATHS);

  const paths = new Set(ACTIVE_BASE_APP_PATHS);
  if (canViewEvents(profile, rankName)) {
    paths.add("/app/esemenyek");
  }
  return paths;
}

export function canAccessAppPath(
  profile: PermissionProfile,
  pathname: string,
  rankName?: string | null
) {
  const normalizedPath = normalizePathname(pathname);
  if (!normalizedPath.startsWith("/app")) return true;
  const allowedPaths = getAllowedAppPaths(profile, rankName);
  return allowedPaths.has(normalizedPath);
}

export function getMenuOptionsForProfile(profile: PermissionProfile, rankName?: string | null) {
  return {
    showEvents: canViewEvents(profile, rankName),
    showLeadership: canAccessLeadership(profile),
    showAuditLog: canAccessAuditLog(profile),
    showDictionary: canViewDictionary(profile),
  };
}

export function evaluatePermissions(profile: PermissionProfile, context: PermissionContext = {}) {
  const rankName = context.rankName ?? profile?.rank_name ?? null;
  const pathname = context.pathname ?? null;

  return {
    canAccessApp: canAccessApp(profile),
    canUseMemberFeatures: canUseMemberFeatures(profile),
    canAccessLeadership: canAccessLeadership(profile),
    canAccessAuditLog: canAccessAuditLog(profile),
    canViewActions: canViewActions(profile),
    canViewDictionary: canViewDictionary(profile),
    canViewEvents: canViewEvents(profile, rankName),
    canCreateAction: canCreateAction(profile, rankName),
    canManageAction: canManageAction(profile, rankName),
    canCreateEvent: canCreateEvent(profile, rankName),
    canManageEvent: canManageEvent(profile, rankName, context.createdBy, context.actorUserId),
    appView: getAppViewForProfile(profile),
    allowedAppPaths: getAllowedAppPaths(profile, rankName),
    canAccessCurrentPath: pathname ? canAccessAppPath(profile, pathname, rankName) : true,
    menu: getMenuOptionsForProfile(profile, rankName),
  };
}