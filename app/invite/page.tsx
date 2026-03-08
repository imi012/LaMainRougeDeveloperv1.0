"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function InvitePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        const hasSession = !!data.session?.access_token;
        if (error || !hasSession) {
          setIsLoggedIn(false);
          router.replace("/login");
          return;
        }

        setIsLoggedIn(true);
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    }

    checkUser();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

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
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (sessionError || !token) {
        throw new Error("Nincs bejelentkezve.");
      }

      const res = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: trimmed }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Hiba történt a kód beváltásakor.");
      }

      router.push("/app");
      router.refresh();
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
            placeholder="Pl.: 399222"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />

          <button
            disabled={checkingAuth || loading || code.trim().length < 6 || !isLoggedIn}
            className="rounded-xl border px-4 py-3 font-semibold disabled:opacity-50"
          >
            {loading ? "..." : "Kód beváltása"}
          </button>

          {msg && <p className="text-sm opacity-80">{msg}</p>}
          {!msg && checkingAuth && <p className="text-sm opacity-80">Bejelentkezés ellenőrzése...</p>}
          {!msg && !checkingAuth && !isLoggedIn && <p className="text-sm opacity-80">Nincs bejelentkezve.</p>}
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
