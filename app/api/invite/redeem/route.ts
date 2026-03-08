export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type InviteAttemptState = {
  count: number;
  blockedUntil: number;
};

const inviteAttemptStore = new Map<string, InviteAttemptState>();
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_WINDOW_MS = 30_000;

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

function getInviteAttemptKey(req: Request, userId: string) {
  return `${userId}:${getClientAddress(req)}`;
}

function getInviteAttemptState(key: string) {
  const current = inviteAttemptStore.get(key);
  if (!current) {
    return { count: 0, blockedUntil: 0 };
  }

  if (current.blockedUntil && current.blockedUntil <= Date.now()) {
    inviteAttemptStore.delete(key);
    return { count: 0, blockedUntil: 0 };
  }

  return current;
}

function registerInviteFailure(key: string) {
  const current = getInviteAttemptState(key);
  const nextCount = current.count + 1;
  const blockedUntil = nextCount >= MAX_FAILED_ATTEMPTS ? Date.now() + BLOCK_WINDOW_MS : 0;
  const nextState = { count: nextCount, blockedUntil };
  inviteAttemptStore.set(key, nextState);
  return nextState;
}

function clearInviteFailures(key: string) {
  inviteAttemptStore.delete(key);
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

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);

    if (!userId) {
      return NextResponse.json({ ok: false, message: "Nincs bejelentkezve." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const code = (body?.code ?? "").toString().trim();
    const attemptKey = getInviteAttemptKey(req, userId);
    const attemptState = getInviteAttemptState(attemptKey);

    if (attemptState.blockedUntil > Date.now()) {
      const waitSeconds = Math.max(1, Math.ceil((attemptState.blockedUntil - Date.now()) / 1000));
      return NextResponse.json(
        { ok: false, message: `Túl sok hibás próbálkozás. Várj ${waitSeconds} másodpercet, és utána próbáld újra.` },
        { status: 429 }
      );
    }

    if (code.length < 6) {
      registerInviteFailure(attemptKey);
      return NextResponse.json({ ok: false, message: "Érvénytelen kód." }, { status: 400 });
    }

    const codeHash = sha256(code);
    const admin = createAdminClient();

    const { data: invite, error: invErr } = await admin
      .from("invite_codes")
      .select("id, uses, max_uses, revoked, expires_at")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (invErr || !invite) {
      registerInviteFailure(attemptKey);
      return NextResponse.json({ ok: false, message: "Hibás kód." }, { status: 400 });
    }

    if (invite.revoked) {
      registerInviteFailure(attemptKey);
      return NextResponse.json({ ok: false, message: "Ez a kód vissza lett vonva." }, { status: 400 });
    }

    if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
      registerInviteFailure(attemptKey);
      return NextResponse.json({ ok: false, message: "Ez a kód lejárt." }, { status: 400 });
    }

    if ((invite.uses ?? 0) >= (invite.max_uses ?? 1)) {
      registerInviteFailure(attemptKey);
      return NextResponse.json({ ok: false, message: "Ez a kód már fel lett használva." }, { status: 400 });
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

    const { error: profErr } = await admin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          invite_redeemed_at: redeemedAt,
          status: "pending",
        },
        { onConflict: "user_id" }
      );

    if (profErr) {
      console.error("invite redeem profile upsert error:", profErr);
      return NextResponse.json({ ok: false, message: "Nem sikerült a profil frissítése." }, { status: 500 });
    }

    clearInviteFailures(attemptKey);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("invite redeem fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
