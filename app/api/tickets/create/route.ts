import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";
import { checkFormSpamProtection } from "@/lib/server/form-spam-protection";

type TicketType = "sanction" | "inactivity" | "namechange";

type TicketInsertRow = {
  user_id: string;
  type: TicketType;
  status: "open";
  title: string | null;
  description: string | null;
  sanction_imgur_url?: string | null;
  sanction_reason?: string | null;
  inactivity_from?: string | null;
  inactivity_to?: string | null;
  old_name?: string | null;
  new_name?: string | null;
  namechange_reason?: string | null;
};

function cleanText(value: unknown, max = 500) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.slice(0, max);
}

function cleanOptionalText(value: unknown, max = 500) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, max);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAppUser(req, {
      requireMember: false,
      allowPending: true,
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, message: auth.message },
        { status: auth.status }
      );
    }

    if (auth.profile.status === "inactive") {
      return NextResponse.json(
        { ok: false, message: "Inaktív státusszal ez a művelet nem engedélyezett." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const type = body?.type as TicketType | undefined;

    if (!type || !["sanction", "inactivity", "namechange"].includes(type)) {
      return NextResponse.json(
        { ok: false, message: "Érvénytelen ticket típus." },
        { status: 400 }
      );
    }

    const row: TicketInsertRow = {
      user_id: auth.userId,
      type,
      status: "open",
      title: cleanOptionalText(body?.title, 120),
      description: cleanOptionalText(body?.description, 2000),
    };

    if (type === "sanction") {
      const sanctionImgurUrl = normalizeUrl(body?.sanction_imgur_url);
      const sanctionReason = cleanText(body?.sanction_reason, 1000);

      if (!sanctionImgurUrl || !sanctionReason) {
        return NextResponse.json(
          { ok: false, message: "Szankcióhoz link és ok kötelező." },
          { status: 400 }
        );
      }

      row.sanction_imgur_url = sanctionImgurUrl;
      row.sanction_reason = sanctionReason;
      row.title = "Szankció";
      row.description = sanctionReason;
    }

    if (type === "inactivity") {
      const inactivityFrom = cleanText(body?.inactivity_from, 10);
      const inactivityTo = cleanText(body?.inactivity_to, 10);

      if (!inactivityFrom || !inactivityTo) {
        return NextResponse.json(
          { ok: false, message: "Inaktivitásnál mettől-meddig kötelező." },
          { status: 400 }
        );
      }

      if (!isIsoDate(inactivityFrom) || !isIsoDate(inactivityTo)) {
        return NextResponse.json(
          { ok: false, message: "Az inaktivitás dátuma érvénytelen." },
          { status: 400 }
        );
      }

      if (inactivityFrom > inactivityTo) {
        return NextResponse.json(
          { ok: false, message: "A kezdődátum nem lehet későbbi, mint a záródátum." },
          { status: 400 }
        );
      }

      row.inactivity_from = inactivityFrom;
      row.inactivity_to = inactivityTo;
      row.title = "Inaktivitás";
      row.description = `${inactivityFrom} → ${inactivityTo}`;
    }

    if (type === "namechange") {
      const oldName = cleanText(body?.old_name, 120);
      const newName = cleanText(body?.new_name, 120);
      const namechangeReason = cleanText(body?.namechange_reason, 1000);

      if (!oldName || !newName || !namechangeReason) {
        return NextResponse.json(
          { ok: false, message: "Névváltásnál minden mező kötelező." },
          { status: 400 }
        );
      }

      row.old_name = oldName;
      row.new_name = newName;
      row.namechange_reason = namechangeReason;
      row.title = "Névváltás";
      row.description = `${oldName} → ${newName} (${namechangeReason})`;
    }

    const spamMessage = await checkFormSpamProtection({
      admin: auth.admin,
      table: "tickets",
      userId: auth.userId,
      timeColumn: "created_at",
      fingerprint: {
        type,
        sanction_imgur_url: row.sanction_imgur_url ?? null,
        sanction_reason: row.sanction_reason ?? null,
        inactivity_from: row.inactivity_from ?? null,
        inactivity_to: row.inactivity_to ?? null,
        old_name: row.old_name ?? null,
        new_name: row.new_name ?? null,
        namechange_reason: row.namechange_reason ?? null,
      },
      selectColumns: [
        "type",
        "sanction_imgur_url",
        "sanction_reason",
        "inactivity_from",
        "inactivity_to",
        "old_name",
        "new_name",
        "namechange_reason",
      ],
    });

    if (spamMessage) {
      return NextResponse.json({ ok: false, message: spamMessage }, { status: 429 });
    }

    const ins = await auth.admin.from("tickets").insert(row).select("id").maybeSingle();

    if (ins.error) {
      console.error("ticket create error:", ins.error);
      return NextResponse.json(
        { ok: false, message: "Nem sikerült elküldeni a ticketet." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: ins.data?.id ?? null });
  } catch (e: any) {
    console.error("ticket create fatal:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Szerver hiba." },
      { status: 500 }
    );
  }
}