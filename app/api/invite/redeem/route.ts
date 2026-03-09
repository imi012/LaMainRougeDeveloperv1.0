export const runtime = "nodejs";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_WINDOW_MS = 30_000;

type RateLimitRow = {
  key: string;
  user_id: string;
  ip_address: string;
  failed_count: number;
  blocked_until: string | null;
};

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function getClientAddress(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for") || "";
  const realIp = req.headers.get("x-real-ip") || "";
  return forwardedFor.split(",")[0]?.trim() || realIp.trim() || "unknown";
}

function getInviteAttemptKey(userId: string, ipAddress: string) {
  return `${userId}:${ipAddress}`;
}

async function getAuthenticatedUserId(req: Request) {
  const admin = createAdminClient();
  const bearer = getBearerToken(req);

  if (bearer) {
    const { data, error } = await admin.auth.getUser(bearer);
    if (!error && data?.user?.id) {
      return data.user.id;
    }
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function getRateLimitRow(admin: ReturnType<typeof createAdminClient>, key: string) {
  const { data, error } = await admin
    .from("invite_redeem_rate_limits")
    .select("key,user_id,ip_address,failed_count,blocked_until")
    .eq("key", key)
    .maybeSingle<RateLimitRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function registerInviteFailure(
  admin: ReturnType<typeof createAdminClient>,
  key: string,
  userId: string,
  ipAddress: string
) {
  const current = await getRateLimitRow(admin, key);
  const nextCount = (current?.failed_count ?? 0) + 1;
  const blockedUntil =
    nextCount >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + BLOCK_WINDOW_MS).toISOString()
      : null;

  const { error } = await admin.from("invite_redeem_rate_limits").upsert(
    {
      key,
      user_id: userId,
      ip_address: ipAddress,
      failed_count: nextCount,
      blocked_until: blockedUntil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    throw error;
  }

  return {
    failed_count: nextCount,
    blocked_until: blockedUntil,
  };
}

async function clearInviteFailures(
  admin: ReturnType<typeof createAdminClient>,
  key: string,
  userId: string,
  ipAddress: string
) {
  const { error } = await admin.from("invite_redeem_rate_limits").upsert(
    {
      key,
      user_id: userId,
      ip_address: ipAddress,
      failed_count: 0,
      blocked_until: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Nincs bejelentkezve." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const code = (body?.code ?? "").toString().trim();

    const ipAddress = getClientAddress(req);
    const attemptKey = getInviteAttemptKey(userId, ipAddress);

    const admin = createAdminClient();
    const limiter = await getRateLimitRow(admin, attemptKey);

    if (limiter?.blocked_until && new Date(limiter.blocked_until).getTime() > Date.now()) {
      const waitSeconds = Math.max(
        1,
        Math.ceil((new Date(limiter.blocked_until).getTime() - Date.now()) / 1000)
      );

      return NextResponse.json(
        {
          ok: false,
          message: `Túl sok hibás próbálkozás. Várj ${waitSeconds} másodpercet, és utána próbáld újra.`,
        },
        { status: 429 }
      );
    }

    if (code.length < 6 || code.length > 64) {
      await registerInviteFailure(admin, attemptKey, userId, ipAddress);
      return NextResponse.json(
        { ok: false, message: "Érvénytelen kód." },
        { status: 400 }
      );
    }

    const codeHash = sha256(code);

    const { data: invite, error: invErr } = await admin
      .from("invite_codes")
      .select("id, uses, max_uses, revoked, expires_at")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (invErr || !invite) {
      await registerInviteFailure(admin, attemptKey, userId, ipAddress);
      return NextResponse.json(
        { ok: false, message: "Hibás kód." },
        { status: 400 }
      );
    }

    if (invite.revoked) {
      await registerInviteFailure(admin, attemptKey, userId, ipAddress);
      return NextResponse.json(
        { ok: false, message: "Ez a kód vissza lett vonva." },
        { status: 400 }
      );
    }

    if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
      await registerInviteFailure(admin, attemptKey, userId, ipAddress);
      return NextResponse.json(
        { ok: false, message: "Ez a kód lejárt." },
        { status: 400 }
      );
    }

    if ((invite.uses ?? 0) >= (invite.max_uses ?? 1)) {
      await registerInviteFailure(admin, attemptKey, userId, ipAddress);
      return NextResponse.json(
        { ok: false, message: "Ez a kód már fel lett használva." },
        { status: 400 }
      );
    }

    const redeemedAt = new Date().toISOString();

    const { error: updInviteErr } = await admin
      .from("invite_codes")
      .update({ uses: (invite.uses ?? 0) + 1 })
      .eq("id", invite.id);

    if (updInviteErr) {
      console.error("invite redeem update invite error:", updInviteErr);
      return NextResponse.json(
        { ok: false, message: "Nem sikerült frissíteni a kód használatát." },
        { status: 500 }
      );
    }

    const { error: profErr } = await admin.from("profiles").upsert(
      {
        user_id: userId,
        invite_redeemed_at: redeemedAt,
        status: "pending",
      },
      { onConflict: "user_id" }
    );

    if (profErr) {
      console.error("invite redeem profile upsert error:", profErr);
      return NextResponse.json(
        { ok: false, message: "Nem sikerült a profil frissítése." },
        { status: 500 }
      );
    }

    await clearInviteFailures(admin, attemptKey, userId, ipAddress);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("invite redeem fatal:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Szerver hiba." },
      { status: 500 }
    );
  }
}