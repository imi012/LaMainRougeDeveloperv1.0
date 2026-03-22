import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAppUser } from "@/lib/server/app-auth";
import { checkFormSpamProtection } from "@/lib/server/form-spam-protection";

export async function POST(req: Request) {
  try {
    const auth = await requireAppUser(req, {
      allowPending: true,
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    const discord_name = (body?.discord_name ?? "").toString().trim();
    const pastebin_url = (body?.pastebin_url ?? "").toString().trim();

    if (!discord_name || !pastebin_url) {
      return NextResponse.json({ ok: false, message: "Hiányzó adatok." }, { status: 400 });
    }

    const admin = createAdminClient();

    const spamMessage = await checkFormSpamProtection({
      admin,
      table: "character_stories",
      userId: auth.userId,
      timeColumn: "updated_at",
      fingerprint: {
        discord_name,
        pastebin_url,
      },
      selectColumns: ["discord_name", "pastebin_url"],
    });

    if (spamMessage) {
      return NextResponse.json({ ok: false, message: spamMessage }, { status: 429 });
    }

    const { error } = await admin
      .from("character_stories")
      .upsert({
        user_id: auth.userId,
        discord_name,
        pastebin_url,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("character-story create error:", error);
      return NextResponse.json(
        { ok: false, message: error.message || "Nem sikerült menteni a karaktertörténetet." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("character-story create fatal:", error);
    return NextResponse.json(
      { ok: false, message: error?.message || "Szerver hiba." },
      { status: 500 }
    );
  }
}