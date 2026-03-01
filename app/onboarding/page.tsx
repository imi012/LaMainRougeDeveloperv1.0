"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [icName, setIcName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // Ha nincs user -> login
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) router.replace("/login");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const trimmed = icName.trim();
    if (trimmed.length < 3) {
      setMsg("Az IC név túl rövid.");
      setLoading(false);
      return;
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      router.replace("/login");
      return;
    }

    const user = userData.user;

    // Profil upsert: IC név beállítása + státusz preinvite
    // (Email verify után ide jut, kód még nincs)
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { user_id: user.id, ic_name: trimmed, status: "preinvite" },
        { onConflict: "user_id" }
      );

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    router.push("/invite");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white/5 p-6 shadow">
        <h1 className="text-2xl font-bold">IC név megadása</h1>
        <p className="mt-2 text-sm opacity-80">
          Első belépésnél kötelező. Később a profilban módosítható (ha engedjük).
        </p>

        <form onSubmit={save} className="mt-4 grid gap-3">
          <label className="text-sm opacity-80">IC neved</label>
          <input
            className="rounded-lg border bg-transparent p-3"
            placeholder="Pl.: Kovács Ádám"
            value={icName}
            onChange={(e) => setIcName(e.target.value)}
          />

          <button
            disabled={loading || icName.trim().length < 3}
            className="rounded-xl border px-4 py-3 font-semibold"
          >
            {loading ? "..." : "Tovább"}
          </button>

          {msg && <p className="text-sm opacity-80">{msg}</p>}
        </form>

        <div className="mt-6 text-xs opacity-60">
          Tipp: Ha nem vagy belépve, visszadob a bejelentkezéshez.
        </div>
      </div>
    </div>
  );
}