import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });

  // Next.js Request cookies olvasása
  // (A route handlerben a req-nek nincs közvetlen .cookies API-ja, ezért így oldjuk meg:)
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieNames = cookieHeader
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter(Boolean);

  // Supabase cookie-k tipikusan sb-... kezdetűek
  for (const name of cookieNames) {
    if (name.startsWith("sb-") || name.includes("supabase")) {
      res.cookies.set(name, "", { maxAge: 0, path: "/" });
    }
  }

  return res;
}