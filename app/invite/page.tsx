"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function InvitePage() {
  const supabase = createClient();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Ha nincs user -> login
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) router.replace("/login");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setMsg("Érvénytelen kód.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Hiba történt a kód beváltásakor.");
      }

      // Siker: vissza az appba (guard majd eldönti TGF/active)
      router.push("/app");
    } catch (err: any) {
      setMsg(err?.message ?? "Hiba történt.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white/5 p-6 shadow">
        <h1 className="text-2xl font-bold">Meghívókód</h1>
        <p className="mt-2 text-sm opacity-80">
          Add meg a vezetőség által generált egyszer használatos kódot. A beváltás után TGF státuszba kerülsz.
        </p>

        <form onSubmit={redeem} className="mt-4 grid gap-3">
          <label className="text-sm opacity-80">Meghívókód</label>
          <input
            className="rounded-lg border bg-transparent p-3"
            placeholder="Pl.: LMR-9F3K-2Q7P"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />

          <button
            disabled={loading || code.trim().length < 6}
            className="rounded-xl border px-4 py-3 font-semibold"
          >
            {loading ? "..." : "Kód beváltása"}
          </button>

          {msg && <p className="text-sm opacity-80">{msg}</p>}
        </form>

        <div className="mt-6 flex items-center justify-between text-xs opacity-70">
          <span>Ha nincs kódod, kérj egyet a vezetőségtől.</span>
          <button onClick={logout} className="underline">
            Kijelentkezés
          </button>
        </div>
      </div>
    </div>
  );
}