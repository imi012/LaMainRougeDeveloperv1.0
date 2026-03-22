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
    <div className="flex min-h-screen items-center justify-center p-6 text-white">
      <div className="lmr-surface w-full max-w-md rounded-[28px] p-7 md:p-8">
        <div className="mb-6 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/40">
            Tetsuryū-Kai
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">IC név megadása</h1>

          <p className="mt-3 text-sm leading-relaxed text-white/65">
            Első belépésnél kötelező. Add meg a karaktered IC nevét a továbblépéshez.
          </p>
        </div>

        <form onSubmit={save} className="grid gap-3">
          <label className="text-sm font-medium text-white/82">IC neved</label>

          <input
            className="rounded-2xl border px-4 py-3 text-sm"
            placeholder="Pl.: Kovács Ádám"
            value={icName}
            onChange={(e) => setIcName(e.target.value)}
          />

          <button
            disabled={loading || icName.trim().length < 3}
            className="lmr-btn lmr-btn-primary mt-2 rounded-full py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? "..." : "Tovább"}
          </button>

          {msg && (
            <p className="mt-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
              {msg}
            </p>
          )}
        </form>

        <div className="mt-6 text-center text-xs text-white/45">
          Tipp: Ha nem vagy belépve, visszairányít a bejelentkezéshez.
        </div>
      </div>
    </div>
  );
}