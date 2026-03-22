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
      <div className="lmr-surface w-full max-w-md rounded-[28px] p-7 md:p-8">

        {/* HEADER */}
        <div className="mb-6 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/40">
            Tetsuryū-Kai
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            {mode === "login" ? "Belépés" : "Regisztráció"}
          </h1>

          <p className="mt-3 text-sm text-white/65 leading-relaxed">
            {mode === "login"
              ? "Jelentkezz be a belső panelre."
              : "Hozz létre új fiókot a rendszer használatához."}
          </p>
        </div>

        {/* MODE SWITCH */}
        <div className="mb-5 flex gap-2">
          <button
            className={`flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
              mode === "login"
                ? "border-white/20 bg-white/12"
                : "border-white/10 bg-white/[0.04]"
            }`}
            onClick={() => setMode("login")}
            type="button"
          >
            Belépés
          </button>

          <button
            className={`flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
              mode === "signup"
                ? "border-white/20 bg-white/12"
                : "border-white/10 bg-white/[0.04]"
            }`}
            onClick={() => setMode("signup")}
            type="button"
          >
            Regisztráció
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={onSubmit} className="grid gap-3">

          <input
            className="rounded-2xl border px-4 py-3 text-sm"
            placeholder="Email cím"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="rounded-2xl border px-4 py-3 text-sm"
            placeholder="Jelszó"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            disabled={loading}
            className="lmr-btn lmr-btn-primary mt-2 rounded-full py-3 text-sm font-semibold"
          >
            {loading ? "..." : mode === "login" ? "Belépés" : "Regisztráció"}
          </button>

          {/* MESSAGE */}
          {msg && (
            <p className="mt-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
              {msg}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}