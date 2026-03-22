import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/app-auth";

type Body = {
  id?: string;
};

function hasLeadershipAccess(profile: {
  status?: string | null;
  site_role?: string | null;
}) {
  return (
    profile.site_role === "owner" ||
    profile.site_role === "admin" ||
    profile.status === "leadership"
  );
}

export async function POST(req: Request) {
  const auth = await requireAppUser(req, {
    requireMember: true,
    allowPending: false,
  });

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }

  if (!hasLeadershipAccess(auth.profile)) {
    return NextResponse.json(
      { ok: false, message: "Nincs jogosultságod ehhez a művelethez." },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const id = String(body?.id || "").trim();

    if (!id) {
      return NextResponse.json(
        { ok: false, message: "Hiányzó azonosító." },
        { status: 400 }
      );
    }

    const { error } = await auth.admin
      .from("service_requests")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Szerver hiba." },
      { status: 500 }
    );
  }
}