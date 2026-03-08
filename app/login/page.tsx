"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Regisztráció kész. Nézd meg az emailed és erősítsd meg a fiókot, utána tudsz belépni.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/app");
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Hiba történt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-white">
      <div className="lmr-surface w-full max-w-md rounded-[28px] p-6 md:p-7">
        <div className="mb-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
            La Main Rouge
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Belépés</h1>
          <p className="mt-2 text-sm text-white/65">
            Jelentkezz be a belső panelre, vagy hozz létre új fiókot.
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className={`rounded-2xl border px-4 py-2.5 text-sm font-medium ${mode === "login" ? "border-white/18 bg-white/12" : "border-white/10 bg-white/[0.04]"}`}
            onClick={() => setMode("login")}
            type="button"
          >
            Belépés
          </button>
          <button
            className={`rounded-2xl border px-4 py-2.5 text-sm font-medium ${mode === "signup" ? "border-white/18 bg-white/12" : "border-white/10 bg-white/[0.04]"}`}
            onClick={() => setMode("signup")}
            type="button"
          >
            Regisztráció
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 grid gap-3">
          <input
            className="rounded-2xl border p-3.5"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded-2xl border p-3.5"
            placeholder="Jelszó"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button disabled={loading} className="rounded-2xl border border-white/14 bg-white/[0.06] px-4 py-3 font-semibold hover:bg-white/[0.09]">
            {loading ? "..." : mode === "login" ? "Belépés" : "Regisztráció"}
          </button>

          {msg && <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">{msg}</p>}
        </form>
      </div>
    </div>
  );
}
