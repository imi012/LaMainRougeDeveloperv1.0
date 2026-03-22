import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

function extractPastebinRawUrl(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase();

    if (!["pastebin.com", "www.pastebin.com"].includes(host)) {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;

    const pasteId = parts[0] === "raw" ? parts[1] : parts[0];
    if (!pasteId) return null;

    return `https://pastebin.com/raw/${pasteId}`;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAppUser(req, {
      allowPending: true,
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    const pastebinUrl = (body?.pastebin_url || "").toString().trim();

    if (!pastebinUrl) {
      return NextResponse.json({ ok: false, message: "Hiányzó Pastebin link." }, { status: 400 });
    }

    const rawUrl = extractPastebinRawUrl(pastebinUrl);
    if (!rawUrl) {
      return NextResponse.json({ ok: false, message: "Érvénytelen Pastebin link." }, { status: 400 });
    }

    const res = await fetch(rawUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: "Nem sikerült lekérni a Pastebin tartalmát." },
        { status: 400 }
      );
    }

    const text = await res.text();
    const preview = text.trim();

    return NextResponse.json({
      ok: true,
      text: preview,
    });
  } catch (e: any) {
    console.error("lore preview fatal:", e);
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}