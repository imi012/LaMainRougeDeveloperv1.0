import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

function parseActionLog(raw: string) {
  const lines = raw.split(/\r?\n/);
  let cassetteCount = 0;
  let cassetteGross = 0;
  let saleGross = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.includes("A kazettában") && line.includes("$") && line.includes("volt")) {
      const tail = line.slice(line.indexOf("A kazettában"));
      const idxDollar = tail.indexOf("$");
      if (idxDollar >= 0) {
        const beforeDollar = tail.slice(0, idxDollar);
        const match = beforeDollar.match(/([\d\s]+)\s*$/);
        if (match) {
          const value = Number((match[1] || "").replace(/\s+/g, ""));
          if (Number.isFinite(value)) {
            cassetteGross += value;
            cassetteCount += 1;
            continue;
          }
        }
      }
    }

    if (line.includes("Sikeresen eladtál") && line.includes("darab tárgyat") && line.includes("$")) {
      const match = line.match(/darab\s+tárgyat\s+([\d\s]+)\s*\$/i);
      if (match) {
        const value = Number((match[1] || "").replace(/\s+/g, ""));
        if (Number.isFinite(value)) {
          saleGross += value;
        }
      }
    }
  }

  const gross = cassetteGross + saleGross;
  return { cassetteCount, gross, net: Math.round(gross * 0.9) };
}

export async function POST(req: Request) {
  const auth = await requireAppUser(req, { requireMember: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => null);
    const actionId = String(body?.action_id || "").trim();
    const rawText = String(body?.raw_text || "").trim();

    if (!actionId || !rawText) {
      return NextResponse.json({ ok: false, message: "Hiányzó akció vagy log." }, { status: 400 });
    }

    const { data: action, error: actionErr } = await auth.admin
      .from("actions")
      .select("id,is_closed")
      .eq("id", actionId)
      .maybeSingle();

    if (actionErr || !action) {
      return NextResponse.json({ ok: false, message: "Az akció nem található." }, { status: 404 });
    }

    if (action.is_closed) {
      return NextResponse.json({ ok: false, message: "Ez az akció le van zárva. Nem lehet logot feltölteni." }, { status: 409 });
    }

    const parsed = parseActionLog(rawText);
    const { data, error } = await auth.admin
      .from("action_logs")
      .insert({
        action_id: actionId,
        uploaded_by: auth.userId,
        raw_text: rawText,
        cassette_count: parsed.cassetteCount,
        gross_amount: parsed.gross,
        net_amount: parsed.net,
      })
      .select("id,action_id,uploaded_by,raw_text,cassette_count,gross_amount,net_amount,created_at")
      .maybeSingle();

    if (error || !data) {
      console.error("actions upload-log error:", error);
      return NextResponse.json({ ok: false, message: "Nem sikerült feltölteni a logot." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (error: any) {
    console.error("actions upload-log fatal:", error);
    return NextResponse.json({ ok: false, message: error?.message || "Szerver hiba." }, { status: 500 });
  }
}
