import { requireAppUser } from "@/lib/server/app-auth";

export type GuardResult =
  | {
      ok: true;
      userId: string;
      profile: {
        site_role: string | null;
        status: string | null;
      };
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

export async function requireLeadership(req: Request): Promise<GuardResult> {
  const auth = await requireAppUser(req, {
    requireLeadership: true,
    allowPending: false,
  });

  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      message: auth.message,
    };
  }

  return {
    ok: true,
    userId: auth.userId,
    profile: {
      site_role: auth.profile.site_role ?? null,
      status: auth.profile.status ?? null,
    },
  };
}
