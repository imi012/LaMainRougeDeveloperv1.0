import { NextResponse } from "next/server";
import { requireLeadershipUser } from "@/lib/server/app-auth";

type Body = {
  id?: string;
};

export async function POST(req: Request) {
  const auth = await requireLeadershipUser(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const id = String(body?.id || "").trim();

    if (!id) {
      return NextResponse.json({ ok: false, message: "Hiányzó szereltetés igénylés azonosító." }, { status: 400 });
    }

    const { error } = await auth.admin
      .from("service_requests")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Szerver hiba." }, { status: 500 });
  }
}
