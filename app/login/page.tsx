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
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white/5 p-6 shadow">
        <h1 className="text-2xl font-bold">Belépés</h1>

        <div className="mt-4 flex gap-2">
          <button
            className={`rounded-lg border px-3 py-2 ${mode === "login" ? "bg-white/10" : ""}`}
            onClick={() => setMode("login")}
            type="button"
          >
            Belépés
          </button>
          <button
            className={`rounded-lg border px-3 py-2 ${mode === "signup" ? "bg-white/10" : ""}`}
            onClick={() => setMode("signup")}
            type="button"
          >
            Regisztráció
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 grid gap-3">
          <input
            className="rounded-lg border bg-transparent p-3"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded-lg border bg-transparent p-3"
            placeholder="Jelszó"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button disabled={loading} className="rounded-xl border px-4 py-3 font-semibold">
            {loading ? "..." : mode === "login" ? "Belépés" : "Regisztráció"}
          </button>

          {msg && <p className="text-sm opacity-80">{msg}</p>}
        </form>
      </div>
    </div>
  );
}